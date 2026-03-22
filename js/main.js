/**
 * 투표박스 - Main Page (index.html) Controller
 */

document.addEventListener('DOMContentLoaded', () => {
  Storage.seedSampleData();
  App.init();
});

const App = {
  currentPage: 1,
  PAGE_SIZE: 6,
  posts: [],

  init() {
    this.posts = Storage.getPosts();
    this.bindEvents();
    this.render();
  },

  bindEvents() {
    // 투표 작성 모달
    document.getElementById('btn-new-post').addEventListener('click', () => Modal.open());

    // 모달 닫기
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
      if (e.target === document.getElementById('modal-overlay')) Modal.close();
    });
    document.getElementById('modal-close').addEventListener('click', () => Modal.close());

    // 폼 제출
    document.getElementById('post-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.submitPost();
    });

    // 선택지 추가
    document.getElementById('btn-add-option').addEventListener('click', () => Modal.addOption());

    // ESC 키
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') Modal.close();
    });
  },

  render() {
    const start = (this.currentPage - 1) * this.PAGE_SIZE;
    const pagePosts = this.posts.slice(start, start + this.PAGE_SIZE);
    this.renderList(pagePosts);
    this.renderPagination();
    // 총 개수 배지
    const badge = document.getElementById('total-badge');
    if (badge) badge.textContent = `총 ${this.posts.length}개`;
  },

  renderList(posts) {
    const container = document.getElementById('post-list');
    container.innerHTML = '';

    if (posts.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🗳️</div>
          <div class="empty-state-title">아직 투표가 없어요</div>
          <div class="empty-state-desc">첫 번째 투표를 만들어 보세요!</div>
        </div>`;
      return;
    }

    posts.forEach((post, i) => {
      // 4번째마다 인피드 광고 삽입
      if (i === 3) {
        container.appendChild(this.createInfeedAd());
      }

      const card = this.createPostCard(post);
      container.appendChild(card);
    });
  },

  createPostCard(post) {
    const wrapper = document.createElement('a');
    wrapper.href = `post.html?id=${post.id}`;
    wrapper.className = 'card post-card mb-2';

    const topOptions = post.options.slice(0, 3);
    const moreCount = post.options.length - 3;

    const optionBadges = topOptions.map(o =>
      `<span class="option-badge">${escapeHtml(o.text)}</span>`
    ).join('') + (moreCount > 0 ? `<span class="option-badge">+${moreCount}개 더</span>` : '');

    wrapper.innerHTML = `
      <div class="card-body">
        <div class="post-card-title">${escapeHtml(post.title)}</div>
        ${post.content ? `<div class="post-card-content">${escapeHtml(post.content)}</div>` : ''}
        <div class="post-card-options">${optionBadges}</div>
        <div class="post-card-meta">
          <span class="meta-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
            ${post.totalVotes.toLocaleString()}표
          </span>
          <span class="meta-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
            ${post.commentCount}
          </span>
          <span class="meta-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
            ${post.likes}
          </span>
          <span class="meta-item" style="margin-left:auto">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            ${formatDate(post.createdAt)}
          </span>
        </div>
      </div>`;
    return wrapper;
  },

  createInfeedAd() {
    const div = document.createElement('div');
    div.innerHTML = `
      <div class="ad-slot ad-infeed">
        <div class="ad-slot-inner">
          <span class="ad-label">Advertisement</span>
          <span class="ad-size">728 × 90 — In-Feed Ad</span>
          <!-- Google AdSense: 여기에 광고 코드를 삽입하세요 -->
        </div>
      </div>`;
    return div.firstElementChild;
  },

  renderPagination() {
    const total = this.posts.length;
    const totalPages = Math.ceil(total / this.PAGE_SIZE);
    const container = document.getElementById('pagination');
    container.innerHTML = '';

    if (totalPages <= 1) return;

    const prev = document.createElement('button');
    prev.className = 'page-btn';
    prev.innerHTML = '&lsaquo;';
    prev.disabled = this.currentPage === 1;
    prev.addEventListener('click', () => { this.currentPage--; this.render(); window.scrollTo(0,0); });
    container.appendChild(prev);

    for (let i = 1; i <= totalPages; i++) {
      const btn = document.createElement('button');
      btn.className = 'page-btn' + (i === this.currentPage ? ' active' : '');
      btn.textContent = i;
      btn.addEventListener('click', () => { this.currentPage = i; this.render(); window.scrollTo(0,0); });
      container.appendChild(btn);
    }

    const next = document.createElement('button');
    next.className = 'page-btn';
    next.innerHTML = '&rsaquo;';
    next.disabled = this.currentPage === totalPages;
    next.addEventListener('click', () => { this.currentPage++; this.render(); window.scrollTo(0,0); });
    container.appendChild(next);
  },

  submitPost() {
    const title = document.getElementById('post-title').value.trim();
    const content = document.getElementById('post-content').value.trim();
    const optionInputs = document.querySelectorAll('.option-input');
    const options = Array.from(optionInputs).map(i => i.value.trim()).filter(v => v);

    let valid = true;

    if (!title) {
      document.getElementById('title-error').classList.add('visible');
      valid = false;
    } else {
      document.getElementById('title-error').classList.remove('visible');
    }

    const rawOptions = Array.from(optionInputs).map(i => i.value.trim());
    if (rawOptions.some(v => !v)) {
      document.getElementById('options-error').textContent = '빈 선택지가 있습니다. 모두 입력하거나 삭제해주세요.';
      document.getElementById('options-error').classList.add('visible');
      valid = false;
    } else if (options.length < 2) {
      document.getElementById('options-error').textContent = '선택지를 최소 2개 이상 입력해주세요.';
      document.getElementById('options-error').classList.add('visible');
      valid = false;
    } else {
      document.getElementById('options-error').classList.remove('visible');
    }

    if (!valid) return;

    Storage.createPost({ title, content, options });
    Modal.close();
    Toast.show('투표가 등록되었습니다! 🎉', 'success');

    // 목록 새로고침
    this.posts = Storage.getPosts();
    this.currentPage = 1;
    this.render();
  },
};

/* ─── Modal ──────────────────────────────────────────── */

const Modal = {
  optionCount: 2,
  MAX_OPTIONS: 6,

  open() {
    this.optionCount = 2;
    document.getElementById('post-form').reset();
    document.querySelectorAll('.form-error').forEach(e => e.classList.remove('visible'));
    this.resetOptions();
    document.getElementById('modal-overlay').classList.add('open');
    document.getElementById('post-title').focus();
  },

  close() {
    document.getElementById('modal-overlay').classList.remove('open');
  },

  resetOptions() {
    const list = document.getElementById('options-list');
    list.innerHTML = '';
    for (let i = 0; i < 2; i++) this._addOptionRow(i + 1);
    this._updateRemoveBtns();
    this._updateAddBtn();
  },

  addOption() {
    if (this.optionCount >= this.MAX_OPTIONS) return;
    this.optionCount++;
    this._addOptionRow(this.optionCount);
    this._updateRemoveBtns();
    this._updateAddBtn();
    // Focus new input
    const inputs = document.querySelectorAll('.option-input');
    inputs[inputs.length - 1].focus();
  },

  removeOption(btn) {
    if (this.optionCount <= 2) return;
    btn.closest('.option-input-row').remove();
    this.optionCount--;
    this._renumberOptions();
    this._updateRemoveBtns();
    this._updateAddBtn();
  },

  _addOptionRow(num) {
    const list = document.getElementById('options-list');
    const row = document.createElement('div');
    row.className = 'option-input-row';
    row.innerHTML = `
      <span class="option-num">${num}</span>
      <input type="text" class="form-control option-input" placeholder="선택지 ${num}" maxlength="60">
      <button type="button" class="btn-remove-option" onclick="Modal.removeOption(this)" title="삭제" ${num <= 2 ? 'disabled' : ''}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>`;
    list.appendChild(row);
  },

  _renumberOptions() {
    document.querySelectorAll('.option-input-row').forEach((row, i) => {
      row.querySelector('.option-num').textContent = i + 1;
      row.querySelector('.option-input').placeholder = `선택지 ${i + 1}`;
    });
  },

  _updateRemoveBtns() {
    document.querySelectorAll('.btn-remove-option').forEach(btn => {
      btn.disabled = this.optionCount <= 2;
    });
  },

  _updateAddBtn() {
    const btn = document.getElementById('btn-add-option');
    btn.disabled = this.optionCount >= this.MAX_OPTIONS;
    btn.textContent = `+ 선택지 추가 (${this.optionCount}/${this.MAX_OPTIONS})`;
  },
};

/* ─── Toast ──────────────────────────────────────────── */

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

window.Modal = Modal;
window.Toast = Toast;
