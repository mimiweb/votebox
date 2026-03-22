/**
 * 투표박스 - Admin Page Controller
 */

document.addEventListener('DOMContentLoaded', () => {
  AdminPage.init();
});

const AdminPage = {
  currentTab: 'posts',

  init() {
    if (Storage.isAdminLoggedIn()) {
      this.showDashboard();
    } else {
      this.showLogin();
    }
  },

  showLogin() {
    document.getElementById('login-section').style.display = 'flex';
    document.getElementById('dashboard-section').style.display = 'none';
    document.getElementById('login-password').focus();

    document.getElementById('login-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const pw = document.getElementById('login-password').value;
      if (Storage.adminLogin(pw)) {
        this.showDashboard();
      } else {
        document.getElementById('login-error').style.display = 'block';
        document.getElementById('login-password').value = '';
        document.getElementById('login-password').focus();
      }
    });
  },

  showDashboard() {
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('dashboard-section').style.display = 'block';
    this.renderStats();
    this.showTab(this.currentTab);
    this.bindEvents();
  },

  bindEvents() {
    document.getElementById('btn-logout').addEventListener('click', () => {
      Storage.adminLogout();
      this.showLogin();
    });
    document.getElementById('tab-posts').addEventListener('click', () => this.showTab('posts'));
    document.getElementById('tab-comments').addEventListener('click', () => this.showTab('comments'));

    document.getElementById('search-input').addEventListener('input', (e) => {
      this.renderCurrentTab(e.target.value.trim().toLowerCase());
    });
  },

  showTab(tab) {
    this.currentTab = tab;
    document.getElementById('tab-posts').classList.toggle('active', tab === 'posts');
    document.getElementById('tab-comments').classList.toggle('active', tab === 'comments');
    document.getElementById('search-input').value = '';
    this.renderCurrentTab('');
  },

  renderCurrentTab(query = '') {
    if (this.currentTab === 'posts') this.renderPosts(query);
    else this.renderComments(query);
  },

  renderStats() {
    const posts = Storage.adminGetAllPosts();
    const comments = Storage.adminGetAllComments();
    const activePosts = posts.filter(p => !p.deleted).length;
    const deletedPosts = posts.filter(p => p.deleted).length;
    const totalVotes = posts.reduce((s, p) => s + (p.totalVotes || 0), 0);
    const activeComments = comments.filter(c => !c.deleted).length;

    document.getElementById('stat-posts').textContent = activePosts;
    document.getElementById('stat-deleted').textContent = deletedPosts;
    document.getElementById('stat-votes').textContent = totalVotes.toLocaleString();
    document.getElementById('stat-comments').textContent = activeComments;
  },

  renderPosts(query = '') {
    let posts = Storage.adminGetAllPosts();
    if (query) posts = posts.filter(p => p.title.toLowerCase().includes(query) || (p.content || '').toLowerCase().includes(query));

    const tbody = document.getElementById('posts-tbody');
    if (posts.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:2rem">게시글이 없습니다</td></tr>`;
      return;
    }

    tbody.innerHTML = posts.map(post => `
      <tr class="${post.deleted ? 'deleted' : ''}">
        <td style="max-width:250px">
          <div style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
            ${escapeHtml(post.title)}
          </div>
          ${post.deleted ? '<span class="badge badge-danger" style="margin-top:2px">삭제됨</span>' : ''}
        </td>
        <td style="text-align:center">${(post.totalVotes||0).toLocaleString()}</td>
        <td style="text-align:center">${post.likes||0}</td>
        <td style="text-align:center">${post.commentCount||0}</td>
        <td style="white-space:nowrap;color:var(--text-muted);font-size:0.8rem">${formatDate(post.createdAt)}</td>
        <td>
          <div style="display:flex;gap:0.4rem;flex-wrap:wrap">
            ${!post.deleted
              ? `<a href="post.html?id=${post.id}" target="_blank" class="btn btn-secondary btn-sm">보기</a>
                 <button class="btn btn-danger btn-sm" onclick="AdminPage.deletePost('${post.id}')">삭제</button>`
              : `<button class="btn btn-secondary btn-sm" disabled>삭제됨</button>`}
          </div>
        </td>
      </tr>`).join('');
  },

  renderComments(query = '') {
    let comments = Storage.adminGetAllComments();
    if (query) comments = comments.filter(c => (c.content||'').toLowerCase().includes(query) || (c.author||'').toLowerCase().includes(query));

    // 게시글 제목 캐시
    const postsMap = {};
    Storage.adminGetAllPosts().forEach(p => { postsMap[p.id] = p.title; });

    const tbody = document.getElementById('comments-tbody');
    if (comments.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:2rem">댓글이 없습니다</td></tr>`;
      return;
    }

    tbody.innerHTML = comments.map(c => `
      <tr class="${c.deleted ? 'deleted' : ''}">
        <td style="max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:0.82rem;color:var(--text-muted)">
          ${escapeHtml(postsMap[c.postId] || c.postId)}
        </td>
        <td style="color:var(--text-secondary);font-size:0.85rem">${escapeHtml(c.author||'익명')}</td>
        <td style="max-width:200px">
          <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
            ${c.deleted ? '<em style="color:var(--text-muted)">삭제된 댓글</em>' : escapeHtml(c.content)}
          </div>
          ${c.parentId ? '<span class="badge badge-gray" style="font-size:0.7rem">대댓글</span>' : ''}
        </td>
        <td style="white-space:nowrap;color:var(--text-muted);font-size:0.8rem">${formatDate(c.createdAt)}</td>
        <td>
          ${!c.deleted
            ? `<button class="btn btn-danger btn-sm" onclick="AdminPage.deleteComment('${c.id}')">삭제</button>`
            : `<span style="font-size:0.82rem;color:var(--text-muted)">삭제됨</span>`}
        </td>
      </tr>`).join('');
  },

  deletePost(id) {
    if (!confirm('이 게시글을 삭제하시겠습니까?')) return;
    Storage.deletePost(id);
    this.renderStats();
    this.renderPosts(document.getElementById('search-input').value.toLowerCase());
    Toast.show('게시글이 삭제되었습니다.', 'success');
  },

  deleteComment(id) {
    if (!confirm('이 댓글을 삭제하시겠습니까?')) return;
    Storage.deleteComment(id);
    this.renderStats();
    this.renderComments(document.getElementById('search-input').value.toLowerCase());
    Toast.show('댓글이 삭제되었습니다.', 'success');
  },
};

// Toast (admin page에서도 사용)
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

window.AdminPage = AdminPage;
window.Toast = Toast;
