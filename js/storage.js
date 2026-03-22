/**
 * 투표박스 - Storage Layer
 * 모든 데이터를 localStorage로 관리합니다.
 */

const KEYS = {
  POSTS: 'vb_posts',
  COMMENTS: 'vb_comments',
  ADMIN_SESSION: 'vb_admin_session',
};

const ADMIN_PASSWORD = 'admin1234'; // 운영 환경에서는 반드시 변경
const ADMIN_SESSION_TTL = 24 * 60 * 60 * 1000; // 24시간

/* ─── Utilities ─────────────────────────────────────── */

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(ts) {
  const d = new Date(ts);
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60000) return '방금 전';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}시간 전`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}일 전`;
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
}

function getItem(key, fallback = []) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function setItem(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch (e) { console.error('Storage error:', e); }
}

/* ─── Posts ─────────────────────────────────────────── */

const Storage = {

  // 전체 게시글 (삭제 포함, 관리자용)
  _getAllPosts() { return getItem(KEYS.POSTS); },

  // 공개 게시글 목록 (삭제 제외)
  getPosts() {
    return this._getAllPosts()
      .filter(p => !p.deleted)
      .sort((a, b) => b.createdAt - a.createdAt);
  },

  // 단일 게시글
  getPost(id) {
    return this._getAllPosts().find(p => p.id === id) || null;
  },

  // 게시글 생성
  createPost({ title, content, options }) {
    const posts = this._getAllPosts();
    const post = {
      id: uid(),
      title: title.trim(),
      content: (content || '').trim(),
      options: options.map((text, i) => ({ id: uid(), text: text.trim(), votes: 0, order: i })),
      likes: 0,
      totalVotes: 0,
      commentCount: 0,
      createdAt: Date.now(),
      deleted: false,
    };
    posts.unshift(post);
    setItem(KEYS.POSTS, posts);
    return post;
  },

  // 게시글 삭제 (소프트)
  deletePost(id) {
    const posts = this._getAllPosts().map(p =>
      p.id === id ? { ...p, deleted: true } : p
    );
    setItem(KEYS.POSTS, posts);
  },

  /* ─── Voting ─── */

  getUserVote(postId) {
    return localStorage.getItem(`vb_voted_${postId}`) || null;
  },

  vote(postId, optionId) {
    if (this.getUserVote(postId)) return false; // 이미 투표함
    const posts = this._getAllPosts();
    const idx = posts.findIndex(p => p.id === postId);
    if (idx === -1) return false;
    const post = { ...posts[idx] };
    post.options = post.options.map(o =>
      o.id === optionId ? { ...o, votes: o.votes + 1 } : o
    );
    post.totalVotes += 1;
    posts[idx] = post;
    setItem(KEYS.POSTS, posts);
    localStorage.setItem(`vb_voted_${postId}`, optionId);
    return true;
  },

  /* ─── Post Likes ─── */

  getPostLiked(postId) {
    return localStorage.getItem(`vb_like_post_${postId}`) === '1';
  },

  togglePostLike(postId) {
    const posts = this._getAllPosts();
    const idx = posts.findIndex(p => p.id === postId);
    if (idx === -1) return null;
    const isLiked = this.getPostLiked(postId);
    const post = { ...posts[idx] };
    post.likes = Math.max(0, post.likes + (isLiked ? -1 : 1));
    posts[idx] = post;
    setItem(KEYS.POSTS, posts);
    if (isLiked) localStorage.removeItem(`vb_like_post_${postId}`);
    else localStorage.setItem(`vb_like_post_${postId}`, '1');
    return { liked: !isLiked, count: post.likes };
  },

  /* ─── Comments ─── */

  _getAllComments() { return getItem(KEYS.COMMENTS); },

  getComments(postId) {
    return this._getAllComments().filter(c => c.postId === postId);
  },

  getComment(id) {
    return this._getAllComments().find(c => c.id === id) || null;
  },

  createComment({ postId, parentId = null, content }) {
    const comments = this._getAllComments();
    const anonNum = Math.floor(1000 + Math.random() * 9000);
    const comment = {
      id: uid(),
      postId,
      parentId,
      content: content.trim(),
      author: `익명${anonNum}`,
      likes: 0,
      createdAt: Date.now(),
      deleted: false,
    };
    comments.push(comment);
    setItem(KEYS.COMMENTS, comments);

    // 게시글 댓글 수 증가
    const posts = this._getAllPosts().map(p =>
      p.id === postId ? { ...p, commentCount: (p.commentCount || 0) + 1 } : p
    );
    setItem(KEYS.POSTS, posts);

    return comment;
  },

  deleteComment(id) {
    const comment = this.getComment(id);
    const comments = this._getAllComments().map(c =>
      c.id === id ? { ...c, deleted: true } : c
    );
    setItem(KEYS.COMMENTS, comments);

    // 게시글 댓글 수 감소
    if (comment) {
      const posts = this._getAllPosts().map(p =>
        p.id === comment.postId ? { ...p, commentCount: Math.max(0, (p.commentCount || 1) - 1) } : p
      );
      setItem(KEYS.POSTS, posts);
    }
  },

  /* ─── Comment Likes ─── */

  getCommentLiked(commentId) {
    return localStorage.getItem(`vb_like_comment_${commentId}`) === '1';
  },

  toggleCommentLike(commentId) {
    const comments = this._getAllComments();
    const idx = comments.findIndex(c => c.id === commentId);
    if (idx === -1) return null;
    const isLiked = this.getCommentLiked(commentId);
    const comment = { ...comments[idx] };
    comment.likes = Math.max(0, comment.likes + (isLiked ? -1 : 1));
    comments[idx] = comment;
    setItem(KEYS.COMMENTS, comments);
    if (isLiked) localStorage.removeItem(`vb_like_comment_${commentId}`);
    else localStorage.setItem(`vb_like_comment_${commentId}`, '1');
    return { liked: !isLiked, count: comment.likes };
  },

  /* ─── Admin ─── */

  adminLogin(password) {
    if (password !== ADMIN_PASSWORD) return false;
    setItem(KEYS.ADMIN_SESSION, { token: uid(), exp: Date.now() + ADMIN_SESSION_TTL });
    return true;
  },

  adminLogout() {
    localStorage.removeItem(KEYS.ADMIN_SESSION);
  },

  isAdminLoggedIn() {
    const session = getItem(KEYS.ADMIN_SESSION, null);
    if (!session || !session.token) return false;
    if (Date.now() > session.exp) {
      this.adminLogout();
      return false;
    }
    return true;
  },

  // 관리자용 전체 게시글 (삭제 포함)
  adminGetAllPosts() {
    return this._getAllPosts().sort((a, b) => b.createdAt - a.createdAt);
  },

  // 관리자용 전체 댓글 (삭제 포함)
  adminGetAllComments() {
    return this._getAllComments().sort((a, b) => b.createdAt - a.createdAt);
  },

  /* ─── Sample Data ─── */

  seedSampleData() {
    if (this._getAllPosts().length > 0) return;
    const samplePosts = [
      {
        title: '점심 뭐 먹을까요? 다같이 골라봐요!',
        content: '매일 고민되는 점심 메뉴... 여러분의 선택은?',
        options: ['치킨', '피자', '중국집', '편의점 도시락', '샐러드'],
      },
      {
        title: '올해 가장 기대되는 계절은?',
        content: '',
        options: ['봄 🌸', '여름 ☀️', '가을 🍂', '겨울 ❄️'],
      },
      {
        title: '재택근무 vs 출근, 어떤 게 더 좋으신가요?',
        content: '코로나 이후 근무 방식이 많이 바뀌었죠. 여러분의 선호는?',
        options: ['완전 재택', '주 3~4일 재택', '주 1~2일 재택', '완전 출근'],
      },
      {
        title: '주말에 주로 뭐 하세요?',
        content: '여러분의 주말 라이프 스타일이 궁금합니다!',
        options: ['집에서 쉬기', '친구/가족 만나기', '운동', '여행/나들이', '취미 활동', '알바/공부'],
      },
      {
        title: '커피 vs 차, 하루 첫 음료는?',
        content: '',
        options: ['아메리카노', '라떼', '녹차/홍차', '탄산음료', '주스', '물만 마셔요'],
      },
    ];

    samplePosts.forEach(({ title, content, options }) => {
      const post = this.createPost({ title, content, options });
      // 가상 투표 수 부여
      const posts = this._getAllPosts();
      const idx = posts.findIndex(p => p.id === post.id);
      if (idx !== -1) {
        let total = 0;
        posts[idx].options = posts[idx].options.map(o => {
          const v = Math.floor(Math.random() * 120 + 5);
          total += v;
          return { ...o, votes: v };
        });
        posts[idx].totalVotes = total;
        posts[idx].likes = Math.floor(Math.random() * 30);
        posts[idx].commentCount = Math.floor(Math.random() * 15);
        posts[idx].createdAt -= Math.floor(Math.random() * 7 * 86400000);
      }
      setItem(KEYS.POSTS, posts);
    });
  },
};

// Expose globally
window.Storage = Storage;
window.escapeHtml = escapeHtml;
window.formatDate = formatDate;
window.uid = uid;
