/**
 * 투표박스 - Firebase Firestore Storage Layer
 */

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBIPddT5hc4FYOjAGs716QBAhiys_uTluM",
  authDomain: "vote-dea08.firebaseapp.com",
  projectId: "vote-dea08",
  storageBucket: "vote-dea08.firebasestorage.app",
  messagingSenderId: "63193872993",
  appId: "1:63193872993:web:65dded8ad536e0abd60820",
};

firebase.initializeApp(FIREBASE_CONFIG);
const db = firebase.firestore();

const ADMIN_PASSWORD = 'admin1234';
const ADMIN_SESSION_TTL = 24 * 60 * 60 * 1000;

/* ─── Utilities ─────────────────────────────────────── */

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// 디바이스 고정 익명 ID (localStorage에 영구 저장)
function getDeviceAnonId() {
  let id = localStorage.getItem('vb_device_anon');
  if (!id) {
    const num = Math.floor(1000 + Math.random() * 9000);
    id = `익명${num}`;
    localStorage.setItem('vb_device_anon', id);
  }
  return id;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function formatDate(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return '방금 전';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}시간 전`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}일 전`;
  const d = new Date(ts);
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
}

/* ─── Storage ────────────────────────────────────────── */

const Storage = {

  /* ── Posts ── */

  async getPosts() {
    const snap = await db.collection('posts').orderBy('createdAt', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => !p.deleted);
  },

  async getPost(id) {
    const doc = await db.collection('posts').doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
  },

  async createPost({ title, content, options }) {
    const post = {
      title: title.trim(),
      content: (content || '').trim(),
      options: options.map((text, i) => ({ id: uid(), text: text.trim(), votes: 0, order: i })),
      likes: 0,
      totalVotes: 0,
      commentCount: 0,
      createdAt: Date.now(),
      deleted: false,
    };
    const ref = await db.collection('posts').add(post);
    // 내 게시글 목록에 추가 (디바이스 기준)
    this._addMyPost(ref.id);
    return { id: ref.id, ...post };
  },

  async updatePost(id, { title, content }) {
    await db.collection('posts').doc(id).update({
      title: title.trim(),
      content: (content || '').trim(),
    });
  },

  /* ── 내 게시글 (디바이스 기준) ── */

  _addMyPost(postId) {
    const ids = this.getMyPostIds();
    if (!ids.includes(postId)) {
      ids.push(postId);
      localStorage.setItem('vb_my_posts', JSON.stringify(ids));
    }
  },

  getMyPostIds() {
    try { return JSON.parse(localStorage.getItem('vb_my_posts') || '[]'); }
    catch { return []; }
  },

  isMyPost(postId) {
    return this.getMyPostIds().includes(postId);
  },

  async deletePost(id) {
    await db.collection('posts').doc(id).update({ deleted: true });
  },

  /* ── Voting ── */

  getUserVote(postId) {
    return localStorage.getItem(`vb_voted_${postId}`) || null;
  },

  async vote(postId, optionId) {
    if (this.getUserVote(postId)) return false;
    await db.runTransaction(async (t) => {
      const ref = db.collection('posts').doc(postId);
      const doc = await t.get(ref);
      if (!doc.exists) throw new Error('Post not found');
      const post = doc.data();
      const updatedOptions = post.options.map(o =>
        o.id === optionId ? { ...o, votes: o.votes + 1 } : o
      );
      t.update(ref, { options: updatedOptions, totalVotes: post.totalVotes + 1 });
    });
    localStorage.setItem(`vb_voted_${postId}`, optionId);
    return true;
  },

  /* ── Post Likes ── */

  getPostLiked(postId) {
    return localStorage.getItem(`vb_like_post_${postId}`) === '1';
  },

  async togglePostLike(postId) {
    const isLiked = this.getPostLiked(postId);
    await db.collection('posts').doc(postId).update({
      likes: firebase.firestore.FieldValue.increment(isLiked ? -1 : 1),
    });
    if (isLiked) localStorage.removeItem(`vb_like_post_${postId}`);
    else localStorage.setItem(`vb_like_post_${postId}`, '1');
    const doc = await db.collection('posts').doc(postId).get();
    return { liked: !isLiked, count: doc.data().likes };
  },

  /* ── Comments ── */

  async getComments(postId) {
    // orderBy 없이 조회 후 JS에서 정렬 (복합 인덱스 불필요)
    const snap = await db.collection('comments').where('postId', '==', postId).get();
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => a.createdAt - b.createdAt);
  },

  async getComment(id) {
    const doc = await db.collection('comments').doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
  },

  async createComment({ postId, parentId = null, content }) {
    const comment = {
      postId,
      parentId,
      content: content.trim(),
      author: getDeviceAnonId(), // 디바이스 고정 익명 ID
      likes: 0,
      createdAt: Date.now(),
      deleted: false,
    };
    const ref = await db.collection('comments').add(comment);
    await db.collection('posts').doc(postId).update({
      commentCount: firebase.firestore.FieldValue.increment(1),
    });
    return { id: ref.id, ...comment };
  },

  async deleteComment(id) {
    const comment = await this.getComment(id);
    if (!comment) return;

    const repliesSnap = await db.collection('comments').where('parentId', '==', id).get();

    const batch = db.batch();
    let deleteCount = 0;

    if (!comment.deleted) {
      batch.update(db.collection('comments').doc(id), { deleted: true });
      deleteCount++;
    }
    repliesSnap.docs.forEach(doc => {
      if (!doc.data().deleted) {
        batch.update(doc.ref, { deleted: true });
        deleteCount++;
      }
    });
    await batch.commit();

    if (deleteCount > 0) {
      await db.collection('posts').doc(comment.postId).update({
        commentCount: firebase.firestore.FieldValue.increment(-deleteCount),
      });
    }
  },

  /* ── Comment Likes ── */

  getCommentLiked(commentId) {
    return localStorage.getItem(`vb_like_comment_${commentId}`) === '1';
  },

  async toggleCommentLike(commentId) {
    const isLiked = this.getCommentLiked(commentId);
    await db.collection('comments').doc(commentId).update({
      likes: firebase.firestore.FieldValue.increment(isLiked ? -1 : 1),
    });
    if (isLiked) localStorage.removeItem(`vb_like_comment_${commentId}`);
    else localStorage.setItem(`vb_like_comment_${commentId}`, '1');
    const doc = await db.collection('comments').doc(commentId).get();
    return { liked: !isLiked, count: doc.data().likes };
  },

  /* ── Admin ── */

  adminLogin(password) {
    if (password !== ADMIN_PASSWORD) return false;
    localStorage.setItem('vb_admin_session', JSON.stringify({ token: uid(), exp: Date.now() + ADMIN_SESSION_TTL }));
    return true;
  },

  adminLogout() { localStorage.removeItem('vb_admin_session'); },

  isAdminLoggedIn() {
    try {
      const s = JSON.parse(localStorage.getItem('vb_admin_session'));
      if (!s || !s.token) return false;
      if (Date.now() > s.exp) { this.adminLogout(); return false; }
      return true;
    } catch { return false; }
  },

  async adminGetAllPosts() {
    const snap = await db.collection('posts').orderBy('createdAt', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async adminGetAllComments() {
    const snap = await db.collection('comments').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => b.createdAt - a.createdAt);
  },

  async adminPurgeDeleted() {
    const [postsSnap, commentsSnap] = await Promise.all([
      db.collection('posts').where('deleted', '==', true).get(),
      db.collection('comments').where('deleted', '==', true).get(),
    ]);

    const batch = db.batch();
    postsSnap.docs.forEach(doc => batch.delete(doc.ref));
    commentsSnap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    return { posts: postsSnap.size, comments: commentsSnap.size };
  },

  /* ── Sample Data ── */

  async seedSampleData() {
    const snap = await db.collection('posts').limit(1).get();
    if (!snap.empty) return;

    const samples = [
      { title: '점심 뭐 먹을까요? 다같이 골라봐요!', content: '매일 고민되는 점심 메뉴... 여러분의 선택은?', options: ['치킨', '피자', '중국집', '편의점 도시락', '샐러드'] },
      { title: '올해 가장 기대되는 계절은?', content: '', options: ['봄 🌸', '여름 ☀️', '가을 🍂', '겨울 ❄️'] },
      { title: '재택근무 vs 출근, 어떤 게 더 좋으신가요?', content: '코로나 이후 근무 방식이 많이 바뀌었죠.', options: ['완전 재택', '주 3~4일 재택', '주 1~2일 재택', '완전 출근'] },
      { title: '주말에 주로 뭐 하세요?', content: '여러분의 주말 라이프 스타일이 궁금합니다!', options: ['집에서 쉬기', '친구/가족 만나기', '운동', '여행/나들이', '취미 활동', '알바/공부'] },
      { title: '커피 vs 차, 하루 첫 음료는?', content: '', options: ['아메리카노', '라떼', '녹차/홍차', '탄산음료', '주스', '물만 마셔요'] },
    ];

    for (const s of samples) {
      const post = await this.createPost(s);
      const votes = post.options.map(() => Math.floor(Math.random() * 120 + 5));
      const totalVotes = votes.reduce((a, b) => a + b, 0);
      await db.collection('posts').doc(post.id).update({
        options: post.options.map((o, i) => ({ ...o, votes: votes[i] })),
        totalVotes,
        likes: Math.floor(Math.random() * 30),
        commentCount: Math.floor(Math.random() * 15),
        createdAt: Date.now() - Math.floor(Math.random() * 7 * 86400000),
      });
    }
  },
};

window.Storage = Storage;
window.escapeHtml = escapeHtml;
window.formatDate = formatDate;
window.uid = uid;
