/**
 * 투표박스 - Post Detail Page Controller (Firebase async)
 */

document.addEventListener('DOMContentLoaded', () => {
  PostPage.init();
});

const Toast = {
  show(msg, type = 'info', duration = 3000) {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: '✓', error: '✕', info: 'ℹ' };
    toast.innerHTML = `<span>${icons[type] || 'ℹ'}</span><span>${escapeHtml(msg)}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },
};

const PostPage = {
  postId: null,
  post: null,
  commentSort: 'oldest',
  _cachedComments: [],

  async init() {
    const params = new URLSearchParams(location.search);
    this.postId = params.get('id');
    if (!this.postId) { location.href = 'index.html'; return; }

    // 로딩 오버레이
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(255,255,255,0.85);display:flex;align-items:center;justify-content:center;z-index:999';
    overlay.innerHTML = '<div class="spinner"></div>';
    document.body.appendChild(overlay);

    try {
      this.post = await Storage.getPost(this.postId);
      if (!this.post || this.post.deleted) {
        document.getElementById('post-content-area').innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">🚫</div>
            <div class="empty-state-title">게시글을 찾을 수 없습니다</div>
            <div class="empty-state-desc"><a href="index.html">목록으로 돌아가기</a></div>
          </div>`;
        return;
      }
      await this.render();
      this.bindEvents();
    } catch (e) {
      console.error(e);
      Toast.show('데이터를 불러오는 중 오류가 발생했습니다.', 'error');
    } finally {
      overlay.remove();
    }
  },

  async render() {
    this.renderPost();
    this.renderVote();
    await this.renderComments();
  },

  renderPost() {
    const post = this.post;
    document.title = `${post.title} - 투표박스`;

    const titleEl = document.getElementById('post-title');
    const bodyEl = document.getElementById('post-body');
    if (titleEl) titleEl.textContent = post.title;
    if (bodyEl) {
      bodyEl.textContent = post.content || '';
      bodyEl.style.display = post.content ? '' : 'none';
    }

    const actualCount = this._cachedComments.filter(c => !c.deleted).length;
    const metaEl = document.getElementById('post-meta');
    if (metaEl) metaEl.innerHTML = `
      <span>👤 익명</span>
      <span>🕐 ${formatDate(post.createdAt)}</span>
      <span>🗳️ ${post.totalVotes.toLocaleString()}표</span>
      <span>💬 ${actualCount || post.commentCount}개 댓글</span>`;

    const liked = Storage.getPostLiked(this.postId);
    const likeBtn = document.getElementById('btn-post-like');
    if (likeBtn) {
      likeBtn.className = 'btn btn-like' + (liked ? ' liked' : '');
      likeBtn.innerHTML = `
        <span class="like-icon">${liked ? '❤️' : '🤍'}</span>
        <span id="like-count">${post.likes}</span>
        <span>좋아요</span>`;
    }

    const breadcrumb = document.getElementById('breadcrumb-title');
    if (breadcrumb) breadcrumb.textContent = post.title;
  },

  renderVote() {
    const post = this.post;
    const userVote = Storage.getUserVote(this.postId);
    const container = document.getElementById('vote-area');
    if (!container) return;
    const totalVotes = post.totalVotes || 0;

    if (userVote) {
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
            <div class="vote-section-title"><span>✅</span> 투표 결과</div>
            <div class="vote-total">총 ${totalVotes.toLocaleString()}표</div>
          </div>
          <div class="vote-options">${results}</div>
        </div>`;
    } else {
      const options = post.options.map(o => `
        <button type="button" class="vote-option-btn" data-option-id="${o.id}">
          <span class="vote-option-circle"></span>
          <span>${escapeHtml(o.text)}</span>
        </button>`).join('');

      container.innerHTML = `
        <div class="vote-section">
          <div class="vote-section-header">
            <div class="vote-section-title"><span>🗳️</span> 투표하기</div>
            <div class="vote-total">총 ${totalVotes.toLocaleString()}표</div>
          </div>
          <div class="vote-options" id="vote-options-list">${options}</div>
          <div style="padding:0 1.5rem 1.25rem">
            <button class="btn btn-primary btn-full" id="btn-submit-vote" disabled>선택 후 투표하기</button>
            <p style="text-align:center;font-size:0.78rem;color:var(--text-muted);margin-top:0.5rem">한 번 투표하면 변경할 수 없습니다</p>
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

    submitBtn.addEventListener('click', async () => {
      if (!selected) return;
      submitBtn.disabled = true;
      submitBtn.textContent = '투표 중...';
      try {
        const ok = await Storage.vote(this.postId, selected);
        if (ok) {
          this.post = await Storage.getPost(this.postId);
          Toast.show('투표가 완료되었습니다! 결과를 확인해보세요.', 'success');
          this.renderPost();
          this.renderVote();
        } else {
          Toast.show('이미 투표하셨습니다.', 'error');
          submitBtn.disabled = false;
          submitBtn.textContent = '선택 후 투표하기';
        }
      } catch {
        Toast.show('오류가 발생했습니다.', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = '선택 후 투표하기';
      }
    });
  },

  async renderComments() {
    const allComments = await Storage.getComments(this.postId);
    this._cachedComments = allComments;

    const roots = allComments.filter(c => !c.parentId);
    const replies = allComments.filter(c => c.parentId);
    const sorted = [...roots].sort((a, b) =>
      this.commentSort === 'newest' ? b.createdAt - a.createdAt : a.createdAt - b.createdAt
    );

    const total = allComments.filter(c => !c.deleted).length;
    const countEl = document.getElementById('comment-count');
    if (countEl) countEl.textContent = total;

    const list = document.getElementById('comment-list');
    if (!list) return;
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
      replies
        .filter(r => r.parentId === comment.id)
        .sort((a, b) => a.createdAt - b.createdAt)
        .forEach(reply => list.appendChild(this.renderComment(reply, true)));
    });
  },

  renderComment(comment, isReply = false) {
    const el = document.createElement('div');
    el.className = 'comment-item' + (isReply ? ' reply' : '');
    el.dataset.commentId = comment.id;

    if (comment.deleted) {
      el.innerHTML = `<div class="deleted-comment">삭제된 댓글입니다.</div>`;
      return el;
    }

    const liked = Storage.getCommentLiked(comment.id);
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
    const likeBtn = document.getElementById('btn-post-like');
    if (likeBtn) {
      likeBtn.addEventListener('click', async () => {
        try {
          const result = await Storage.togglePostLike(this.postId);
          if (result) {
            this.post = await Storage.getPost(this.postId);
            const btn = document.getElementById('btn-post-like');
            btn.className = 'btn btn-like' + (result.liked ? ' liked' : '');
            btn.innerHTML = `
              <span class="like-icon">${result.liked ? '❤️' : '🤍'}</span>
              <span id="like-count">${result.count}</span>
              <span>좋아요</span>`;
          }
        } catch { Toast.show('오류가 발생했습니다.', 'error'); }
      });
    }

    const shareBtn = document.getElementById('btn-share');
    if (shareBtn) {
      shareBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(location.href);
          Toast.show('링크가 복사되었습니다!', 'success');
        } catch { Toast.show('링크: ' + location.href, 'info', 5000); }
      });
    }

    const sortOldest = document.getElementById('sort-oldest');
    const sortNewest = document.getElementById('sort-newest');
    if (sortOldest) {
      sortOldest.addEventListener('click', () => {
        this.commentSort = 'oldest';
        sortOldest.classList.add('active');
        sortNewest.classList.remove('active');
        this.renderComments();
      });
    }
    if (sortNewest) {
      sortNewest.addEventListener('click', () => {
        this.commentSort = 'newest';
        sortNewest.classList.add('active');
        sortOldest.classList.remove('active');
        this.renderComments();
      });
    }

    const commentSubmit = document.getElementById('comment-submit');
    if (commentSubmit) commentSubmit.addEventListener('click', () => this.submitComment());

    const commentInput = document.getElementById('comment-input');
    if (commentInput) commentInput.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'Enter') this.submitComment();
    });

    const commentList = document.getElementById('comment-list');
    if (commentList) {
      commentList.addEventListener('click', async (e) => {
        // 댓글 좋아요
        const likeBtn = e.target.closest('.comment-like-btn');
        if (likeBtn) {
          try {
            const result = await Storage.toggleCommentLike(likeBtn.dataset.commentId);
            if (result) {
              likeBtn.className = 'btn btn-like btn-sm comment-like-btn' + (result.liked ? ' liked' : '');
              likeBtn.querySelector('.like-icon').textContent = result.liked ? '❤️' : '🤍';
              likeBtn.querySelector('.comment-like-count').textContent = result.count;
            }
          } catch { Toast.show('오류가 발생했습니다.', 'error'); }
          return;
        }

        // 대댓글 토글
        const replyToggle = e.target.closest('.reply-toggle-btn');
        if (replyToggle) {
          const area = document.getElementById(`reply-area-${replyToggle.dataset.commentId}`);
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
          const area = replySubmit.closest('.reply-area');
          const input = area.querySelector('.reply-input');
          const content = input.value.trim();
          if (!content) { Toast.show('내용을 입력해주세요.', 'error'); return; }
          replySubmit.disabled = true;
          try {
            await Storage.createComment({ postId: this.postId, parentId: replySubmit.dataset.parentId, content });
            input.value = '';
            area.style.display = 'none';
            await this.renderComments();
            Toast.show('답글이 등록되었습니다.', 'success');
          } catch { Toast.show('오류가 발생했습니다.', 'error'); }
          finally { replySubmit.disabled = false; }
        }
      });
    }
  },

  async submitComment() {
    const input = document.getElementById('comment-input');
    const content = input.value.trim();
    if (!content) { Toast.show('내용을 입력해주세요.', 'error'); return; }
    const btn = document.getElementById('comment-submit');
    btn.disabled = true;
    try {
      await Storage.createComment({ postId: this.postId, parentId: null, content });
      input.value = '';
      await this.renderComments();
      Toast.show('댓글이 등록되었습니다.', 'success');
    } catch { Toast.show('오류가 발생했습니다.', 'error'); }
    finally { btn.disabled = false; }
  },
};

window.PostPage = PostPage;
