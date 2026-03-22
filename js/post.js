/**
 * 투표박스 - Post Detail Page Controller
 */

document.addEventListener('DOMContentLoaded', () => {
  PostPage.init();
});

const PostPage = {
  postId: null,
  post: null,
  commentSort: 'oldest', // 'oldest' | 'newest'

  init() {
    const params = new URLSearchParams(location.search);
    this.postId = params.get('id');

    if (!this.postId) {
      location.href = 'index.html';
      return;
    }

    this.post = Storage.getPost(this.postId);
    if (!this.post || this.post.deleted) {
      document.getElementById('post-content-area').innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🚫</div>
          <div class="empty-state-title">게시글을 찾을 수 없습니다</div>
          <div class="empty-state-desc"><a href="index.html">목록으로 돌아가기</a></div>
        </div>`;
      return;
    }

    this.render();
    this.bindEvents();
  },

  render() {
    this.renderPost();
    this.renderVote();
    this.renderComments();
  },

  renderPost() {
    const post = Storage.getPost(this.postId); // 최신 데이터
    this.post = post;

    document.title = `${post.title} - 투표박스`;

    document.getElementById('post-title').textContent = post.title;
    document.getElementById('post-body').textContent = post.content || '';
    if (!post.content) document.getElementById('post-body').style.display = 'none';

    // 저장된 commentCount 대신 실제 댓글 배열에서 계산
    const actualCommentCount = Storage.getComments(this.postId).filter(c => !c.deleted).length;

    document.getElementById('post-meta').innerHTML = `
      <span>👤 익명</span>
      <span>🕐 ${formatDate(post.createdAt)}</span>
      <span>🗳️ ${post.totalVotes.toLocaleString()}표</span>
      <span>💬 ${actualCommentCount}개 댓글</span>`;

    // 좋아요 버튼
    const likeBtn = document.getElementById('btn-post-like');
    const liked = Storage.getPostLiked(this.postId);
    likeBtn.className = 'btn btn-like' + (liked ? ' liked' : '');
    likeBtn.innerHTML = `
      <span class="like-icon">${liked ? '❤️' : '🤍'}</span>
      <span id="like-count">${post.likes}</span>
      <span>좋아요</span>`;
  },

  renderVote() {
    const post = Storage.getPost(this.postId);
    const userVote = Storage.getUserVote(this.postId);
    const container = document.getElementById('vote-area');

    const totalVotes = post.totalVotes || 0;

    if (userVote) {
      // 결과 표시
      const maxVotes = Math.max(...post.options.map(o => o.votes));
      const results = post.options.map(o => {
        const pct = totalVotes > 0 ? Math.round((o.votes / totalVotes) * 100) : 0;
        const isWinner = o.votes === maxVotes && totalVotes > 0;
        const isMyVote = o.id === userVote;
        return `
          <div class="vote-result-item ${isWinner ? 'winner' : ''} ${isMyVote ? 'my-vote' : ''}">
            <div class="vote-result-bar" style="width:${pct}%"></div>
            <div class="vote-result-content">
              <div class="vote-result-label">
                ${isWinner ? '🥇 ' : ''}${escapeHtml(o.text)}
                ${isMyVote ? '<span class="vote-my-badge">내 선택</span>' : ''}
              </div>
              <div class="vote-result-stats">
                <div class="vote-percent">${pct}%</div>
                <div class="vote-count">${o.votes.toLocaleString()}표</div>
              </div>
            </div>
          </div>`;
      }).join('');

      container.innerHTML = `
        <div class="vote-section">
          <div class="vote-section-header">
            <div class="vote-section-title">
              <span>✅</span> 투표 결과
            </div>
            <div class="vote-total">총 ${totalVotes.toLocaleString()}표</div>
          </div>
          <div class="vote-options">${results}</div>
        </div>`;
    } else {
      // 투표 폼
      const options = post.options.map(o => `
        <button type="button" class="vote-option-btn" data-option-id="${o.id}">
          <span class="vote-option-circle"></span>
          <span>${escapeHtml(o.text)}</span>
        </button>`).join('');

      container.innerHTML = `
        <div class="vote-section">
          <div class="vote-section-header">
            <div class="vote-section-title">
              <span>🗳️</span> 투표하기
            </div>
            <div class="vote-total">총 ${totalVotes.toLocaleString()}표</div>
          </div>
          <div class="vote-options" id="vote-options-list">${options}</div>
          <div style="padding:0 1.5rem 1.25rem">
            <button class="btn btn-primary btn-full" id="btn-submit-vote" disabled>
              선택 후 투표하기
            </button>
            <p style="text-align:center;font-size:0.78rem;color:var(--text-muted);margin-top:0.5rem">
              한 번 투표하면 변경할 수 없습니다
            </p>
          </div>
        </div>`;

      this.bindVoteEvents();
    }
  },

  bindVoteEvents() {
    let selected = null;
    const submitBtn = document.getElementById('btn-submit-vote');

    document.querySelectorAll('.vote-option-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.vote-option-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selected = btn.dataset.optionId;
        submitBtn.disabled = false;
      });
    });

    submitBtn.addEventListener('click', () => {
      if (!selected) return;
      submitBtn.disabled = true;
      submitBtn.textContent = '투표 중...';
      const ok = Storage.vote(this.postId, selected);
      if (ok) {
        Toast.show('투표가 완료되었습니다! 결과를 확인해보세요.', 'success');
        this.renderPost();
        this.renderVote();
      } else {
        Toast.show('이미 투표하셨습니다.', 'error');
      }
    });
  },

  renderComments() {
    const allComments = Storage.getComments(this.postId);
    const roots = allComments.filter(c => !c.parentId);
    const replies = allComments.filter(c => c.parentId);

    // 정렬
    const sorted = [...roots].sort((a, b) =>
      this.commentSort === 'newest'
        ? b.createdAt - a.createdAt
        : a.createdAt - b.createdAt
    );

    const total = allComments.filter(c => !c.deleted).length;
    document.getElementById('comment-count').textContent = total;

    const list = document.getElementById('comment-list');
    list.innerHTML = '';

    if (sorted.length === 0) {
      list.innerHTML = `
        <div class="empty-state" style="padding:2rem">
          <div style="font-size:2rem;margin-bottom:0.5rem">💬</div>
          <div class="empty-state-title">아직 댓글이 없어요</div>
          <div class="empty-state-desc">첫 댓글을 남겨보세요!</div>
        </div>`;
      return;
    }

    sorted.forEach(comment => {
      list.appendChild(this.renderComment(comment));
      // 해당 댓글의 대댓글
      const commentReplies = replies
        .filter(r => r.parentId === comment.id)
        .sort((a, b) => a.createdAt - b.createdAt);
      commentReplies.forEach(reply => {
        list.appendChild(this.renderComment(reply, true));
      });
    });
  },

  renderComment(comment, isReply = false) {
    const el = document.createElement('div');
    el.className = 'comment-item' + (isReply ? ' reply' : '');
    el.dataset.commentId = comment.id;

    const liked = Storage.getCommentLiked(comment.id);

    if (comment.deleted) {
      el.innerHTML = `<div class="deleted-comment">삭제된 댓글입니다.</div>`;
      return el;
    }

    el.innerHTML = `
      <div class="comment-header">
        <span class="comment-author">${escapeHtml(comment.author)}</span>
        <span class="comment-time">${formatDate(comment.createdAt)}</span>
      </div>
      <div class="comment-body">${escapeHtml(comment.content)}</div>
      <div class="comment-actions">
        <button class="btn btn-like btn-sm comment-like-btn ${liked ? 'liked' : ''}" data-comment-id="${comment.id}">
          <span class="like-icon">${liked ? '❤️' : '🤍'}</span>
          <span class="comment-like-count">${comment.likes}</span>
        </button>
        ${!isReply ? `<button class="btn btn-ghost btn-sm reply-toggle-btn" data-comment-id="${comment.id}">💬 답글</button>` : ''}
      </div>
      ${!isReply ? `<div class="reply-area" id="reply-area-${comment.id}" style="display:none">
        <div class="comment-input-row">
          <textarea class="form-control reply-input" rows="2" placeholder="답글을 입력하세요..." style="resize:none"></textarea>
          <button class="btn btn-primary btn-sm reply-submit-btn" data-parent-id="${comment.id}">등록</button>
        </div>
      </div>` : ''}`;

    return el;
  },

  bindEvents() {
    // 게시글 좋아요
    document.getElementById('btn-post-like').addEventListener('click', () => {
      const result = Storage.togglePostLike(this.postId);
      if (result) {
        const btn = document.getElementById('btn-post-like');
        btn.className = 'btn btn-like' + (result.liked ? ' liked' : '');
        btn.innerHTML = `
          <span class="like-icon">${result.liked ? '❤️' : '🤍'}</span>
          <span id="like-count">${result.count}</span>
          <span>좋아요</span>`;
      }
    });

    // 공유
    document.getElementById('btn-share').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(location.href);
        Toast.show('링크가 복사되었습니다!', 'success');
      } catch {
        Toast.show('링크: ' + location.href, 'info', 5000);
      }
    });

    // 댓글 정렬
    document.getElementById('sort-oldest').addEventListener('click', () => {
      this.commentSort = 'oldest';
      document.getElementById('sort-oldest').classList.add('active');
      document.getElementById('sort-newest').classList.remove('active');
      this.renderComments();
    });
    document.getElementById('sort-newest').addEventListener('click', () => {
      this.commentSort = 'newest';
      document.getElementById('sort-newest').classList.add('active');
      document.getElementById('sort-oldest').classList.remove('active');
      this.renderComments();
    });

    // 댓글 작성
    document.getElementById('comment-submit').addEventListener('click', () => {
      this.submitComment();
    });
    document.getElementById('comment-input').addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'Enter') this.submitComment();
    });

    // 대댓글 / 좋아요 (이벤트 위임)
    document.getElementById('comment-list').addEventListener('click', (e) => {
      // 댓글 좋아요
      const likeBtn = e.target.closest('.comment-like-btn');
      if (likeBtn) {
        const commentId = likeBtn.dataset.commentId;
        const result = Storage.toggleCommentLike(commentId);
        if (result) {
          likeBtn.className = 'btn btn-like btn-sm comment-like-btn' + (result.liked ? ' liked' : '');
          likeBtn.querySelector('.like-icon').textContent = result.liked ? '❤️' : '🤍';
          likeBtn.querySelector('.comment-like-count').textContent = result.count;
        }
        return;
      }

      // 대댓글 토글
      const replyToggle = e.target.closest('.reply-toggle-btn');
      if (replyToggle) {
        const commentId = replyToggle.dataset.commentId;
        const area = document.getElementById(`reply-area-${commentId}`);
        if (area) {
          const isOpen = area.style.display !== 'none';
          area.style.display = isOpen ? 'none' : 'block';
          if (!isOpen) area.querySelector('.reply-input').focus();
        }
        return;
      }

      // 대댓글 등록
      const replySubmit = e.target.closest('.reply-submit-btn');
      if (replySubmit) {
        const parentId = replySubmit.dataset.parentId;
        const area = replySubmit.closest('.reply-area');
        const input = area.querySelector('.reply-input');
        const content = input.value.trim();
        if (!content) { Toast.show('내용을 입력해주세요.', 'error'); return; }
        Storage.createComment({ postId: this.postId, parentId, content });
        input.value = '';
        area.style.display = 'none';
        this.renderComments();
        Toast.show('답글이 등록되었습니다.', 'success');
      }
    });
  },

  submitComment() {
    const input = document.getElementById('comment-input');
    const content = input.value.trim();
    if (!content) {
      Toast.show('내용을 입력해주세요.', 'error');
      return;
    }
    Storage.createComment({ postId: this.postId, parentId: null, content });
    input.value = '';
    this.renderComments();
    Toast.show('댓글이 등록되었습니다.', 'success');
  },
};

window.PostPage = PostPage;
