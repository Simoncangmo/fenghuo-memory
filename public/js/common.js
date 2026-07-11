/**
 * common.js - 公共工具函数（增强版）
 */

const API_BASE = '';

async function api(path, options = {}) {
  const url = API_BASE + path;
  const config = { headers: {}, ...options };
  if (config.body && !(config.body instanceof FormData)) {
    config.headers['Content-Type'] = 'application/json';
    config.body = JSON.stringify(config.body);
  }
  const res = await fetch(url, config);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: '请求失败' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function formatDuration(seconds) {
  if (!seconds || seconds === 0) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function formatDateTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function getInitials(name) {
  if (!name) return '?';
  return name.charAt(0);
}

function truncate(text, length) {
  if (!text) return '';
  return text.length > length ? text.substring(0, length) + '...' : text;
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type === 'error' ? 'error' : ''}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s ease reverse';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 时间轴类型标签
function getTimelineTypeLabel(type) {
  const labels = {
    birth: '出生', enlist: '入伍', battle: '参战', injury: '负伤',
    discharge: '退伍', death: '辞世', honor: '荣誉',
    promotion: '晋升', milestone: '里程碑', interview: '口述采集',
    education: '求学'
  };
  return labels[type] || type;
}

// 物证类型图标
function getEvidenceIcon(type) {
  const icons = { photo: '📷', medal: '🎖️', document: '📜', letter: '✉️' };
  return icons[type] || '📄';
}

function getEvidenceTypeLabel(type) {
  const labels = { photo: '照片', medal: '勋章', document: '证件', letter: '书信' };
  return labels[type] || '其他';
}

// 关系类型标签
function getRelationTypeLabel(type) {
  const labels = { commander: '长官', comrade: '战友', descendant: '后代', family: '家属' };
  return labels[type] || type;
}

// 导航栏
function renderNavbar(activePage) {
  const links = [
    { href: 'index.html', key: 'home', label: '首页' },
    { href: 'search.html', key: 'search', label: '时空检索' },
    { href: 'index.html#units', key: 'units', label: '番号百科' },
    { href: 'index.html#battles', key: 'battles', label: '战役记录' },
    { href: 'index.html#recordings', key: 'recordings', label: '口述记录' },
  ];

  const linksHtml = links.map(l =>
    `<a href="${l.href}" class="${activePage === l.key ? 'active' : ''}">${l.label}</a>`
  ).join('');

  return `
    <nav class="navbar">
      <div class="navbar-container">
        <div class="navbar-logo" onclick="location.href='index.html'">
          <div class="navbar-logo-icon">烽</div>
          <div class="navbar-logo-text">
            烽火记忆
            <small>抗战实录 Wiki</small>
          </div>
        </div>
        <div class="navbar-links">
          ${linksHtml}
          <a href="record.html" class="btn-record">+ 上传口述</a>
          <a href="admin.html" class="btn-record" style="background:var(--c-mil-green);">+ 老兵建档</a>
        </div>
      </div>
    </nav>
  `;
}

function renderFooter() {
  return `
    <footer class="footer">
      <div class="footer-container">
        <p class="footer-quote">"勿忘国耻，铭记历史，珍爱和平"</p>
        <p>烽火记忆 · 抗战实录 Wiki</p>
        <p>时空检索 · 网状关联 · 多媒体还原 · 公众共创</p>
      </div>
    </footer>
  `;
}

function initPage(activePage) {
  const nav = document.getElementById('navbar');
  if (nav) nav.innerHTML = renderNavbar(activePage);
  const footer = document.getElementById('footer');
  if (footer) footer.innerHTML = renderFooter();
}

// 纠错按钮
function renderCorrectionBtn(targetType, targetId) {
  return `<button class="correction-btn" onclick="submitCorrection('${targetType}','${targetId}')">补充史料 / 纠错</button>`;
}

// 分享按钮
let _shareVeteranName = '';
function renderShareBtn(veteranName) {
  _shareVeteranName = veteranName || '';
  return `<button class="share-btn" onclick="openShareModal()">分享</button>`;
}

function openShareModal() {
  const existing = document.getElementById('shareOverlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'shareOverlay';
  overlay.className = 'share-overlay';
  overlay.innerHTML = `
    <div class="share-modal" onclick="event.stopPropagation()">
      <h3>分享</h3>
      <div class="share-options">
        <div class="share-option" onclick="shareToWeChat('friend')">
          <span class="share-opt-icon">💬</span>
          <div>
            <div class="share-opt-label">微信好友</div>
            <div class="share-opt-desc">分享给微信好友</div>
          </div>
        </div>
        <div class="share-option" onclick="shareToWeChat('moments')">
          <span class="share-opt-icon">📢</span>
          <div>
            <div class="share-opt-label">朋友圈</div>
            <div class="share-opt-desc">分享到微信朋友圈</div>
          </div>
        </div>
        <div class="share-option" onclick="copyShareLink()">
          <span class="share-opt-icon">🔗</span>
          <div>
            <div class="share-opt-label">复制链接</div>
            <div class="share-opt-desc">复制页面链接到剪贴板</div>
          </div>
        </div>
      </div>
      <div class="share-close">
        <button onclick="closeShareModal()">取消</button>
      </div>
    </div>
  `;
  overlay.addEventListener('click', () => closeShareModal());
  document.body.appendChild(overlay);
  setTimeout(() => overlay.classList.add('active'), 10);
}

function shareToWeChat(type) {
  const url = window.location.href;
  const shareText = _shareVeteranName
    ? `这是${_shareVeteranName}抗战英雄的抗战记忆，来看一下吧 ${url}`
    : `${document.title} - 烽火记忆 ${url}`;

  // 移动端优先尝试原生分享
  if (navigator.share) {
    navigator.share({ title: document.title, url, text: shareText }).catch(() => {});
    return;
  }

  // 桌面端：显示二维码引导
  const tipText = type === 'friend'
    ? '打开微信<strong>扫一扫</strong>识别下方二维码<br>在打开的页面点击右上角 <strong>···</strong> → 发送给朋友'
    : '打开微信<strong>扫一扫</strong>识别下方二维码<br>在打开的页面点击右上角 <strong>···</strong> → 分享到朋友圈';

  const modal = document.querySelector('.share-modal');
  if (!modal) return;
  modal.innerHTML = `
    <h3>${type === 'friend' ? '分享至微信好友' : '分享至朋友圈'}</h3>
    <div class="share-qr-box">
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${encodeURIComponent(url)}" alt="二维码" width="200" height="200">
      <div class="share-qr-tip">${tipText}</div>
    </div>
    <div class="share-close">
      <button onclick="closeShareModal()">关闭</button>
    </div>
  `;
}

function copyShareLink() {
  const url = window.location.href;
  const shareText = _shareVeteranName
    ? `这是${_shareVeteranName}抗战英雄的抗战记忆，来看一下吧\n${url}`
    : url;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(shareText).then(() => {
      showToast('链接已复制到剪贴板');
      closeShareModal();
    }).catch(() => {
      fallbackCopy(shareText);
    });
  } else {
    fallbackCopy(shareText);
  }
}

function fallbackCopy(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand('copy');
    showToast('链接已复制到剪贴板');
  } catch (e) {
    showToast('复制失败，请手动复制链接', 'error');
  }
  document.body.removeChild(textarea);
  closeShareModal();
}

function closeShareModal() {
  const overlay = document.getElementById('shareOverlay');
  if (overlay) {
    overlay.classList.remove('active');
    setTimeout(() => overlay.remove(), 250);
  }
}

async function submitCorrection(targetType, targetId) {
  const name = prompt('您的姓名（或昵称）：');
  if (!name) return;
  const content = prompt('请输入补充或纠错内容：');
  if (!content) return;

  try {
    await api('/api/corrections', {
      method: 'POST',
      body: {
        targetType, targetId,
        submitterName: name,
        type: 'correction',
        content
      }
    });
    showToast('感谢您的贡献！线索已提交，审核后将并入 Wiki。');
  } catch (e) {
    showToast('提交失败: ' + e.message, 'error');
  }
}
