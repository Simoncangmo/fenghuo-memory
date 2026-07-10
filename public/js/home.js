/**
 * home.js - 首页逻辑
 */
initPage('home');

let _veteranNameCache = {}, _battleNameCache = {};

document.getElementById('searchInput').addEventListener('keypress', e => {
  if (e.key === 'Enter') performSearch();
});

function quickSearch(q) {
  document.getElementById('searchInput').value = q;
  performSearch();
}

function performSearch() {
  const q = document.getElementById('searchInput').value.trim();
  if (q) window.location.href = `search.html?q=${encodeURIComponent(q)}`;
}

async function loadStats() {
  try {
    const s = await api('/api/stats');
    document.getElementById('statVeterans').textContent = s.veteranCount;
    document.getElementById('statBattles').textContent = s.battleCount;
    document.getElementById('statUnits').textContent = s.unitCount;
    document.getElementById('statRecordings').textContent = s.recordingCount;
    document.getElementById('statVolunteers').textContent = s.volunteerCount;
    document.getElementById('statEvidence').textContent = s.evidenceCount;
  } catch (e) { console.error(e); }
}

async function preloadCaches() {
  try {
    const [veterans, battles] = await Promise.all([api('/api/veterans'), api('/api/battles')]);
    veterans.forEach(v => _veteranNameCache[v.id] = v.name);
    battles.forEach(b => _battleNameCache[b.id] = b.name);
  } catch (e) {}
}

function getVeteranName(r) {
  return (r.veteranIds && r.veteranIds[0]) ? (_veteranNameCache[r.veteranIds[0]] || '老兵') : '未知老兵';
}
function getBattleName(r) {
  return (r.battleIds && r.battleIds[0]) ? (_battleNameCache[r.battleIds[0]] || '') : '';
}

async function loadVeterans() {
  try {
    const veterans = await api('/api/veterans');
    const c = document.getElementById('veteransList');
    if (!veterans.length) { c.innerHTML = '<div class="empty-state"><div class="icon">★</div><p>暂无老兵档案</p></div>'; return; }
    c.innerHTML = veterans.map(v => `
      <div class="veteran-card" onclick="location.href='veteran.html?id=${v.id}'">
        <div class="veteran-card-header">
          <div class="veteran-avatar">${getInitials(v.name)}</div>
          <div class="veteran-card-info">
            <h3>${escapeHtml(v.name)}</h3>
            <div class="unit">${escapeHtml(v.militaryUnit || '')} · ${escapeHtml(v.rank || '')}</div>
          </div>
        </div>
        <div class="veteran-card-bio">${escapeHtml(v.bio || '')}</div>
        <div class="veteran-card-footer">
          <span>${escapeHtml(v.hometown || '')}</span>
          <span>${v.deathYear ? '<span class="status-deceased">已故</span>' : '<span class="status-alive">健在</span>'} · <span class="recording-count">${v.recordingCount || 0} 条口述</span></span>
        </div>
      </div>
    `).join('');
  } catch (e) { document.getElementById('veteransList').innerHTML = `<div class="empty-state"><p>加载失败</p></div>`; }
}

async function loadBattles() {
  try {
    const battles = await api('/api/battles');
    const c = document.getElementById('battlesList');
    if (!battles.length) { c.innerHTML = '<div class="empty-state"><div class="icon">◆</div><p>暂无战役记录</p></div>'; return; }
    c.innerHTML = battles.map(b => `
      <div class="battle-card" onclick="location.href='battle.html?id=${b.id}'">
        <h3>${escapeHtml(b.name)}</h3>
        <div class="battle-date">${escapeHtml(b.startDate || '')} ~ ${escapeHtml(b.endDate || '')}</div>
        <div class="battle-card-desc">${escapeHtml(b.description || '')}</div>
        <div class="battle-significance">${escapeHtml(b.significance || '')}</div>
        <div style="margin-top:10px;font-size:13px;color:var(--c-text-3);display:flex;justify-content:space-between;">
          <span>${escapeHtml(b.location || '')}</span>
          <span class="recording-count">${b.recordingCount || 0} 条口述</span>
        </div>
      </div>
    `).join('');
  } catch (e) { document.getElementById('battlesList').innerHTML = `<div class="empty-state"><p>加载失败</p></div>`; }
}

async function loadUnits() {
  try {
    const units = await api('/api/units');
    const c = document.getElementById('unitsList');
    c.classList.remove('loading');
    if (!units.length) { c.innerHTML = '<div class="empty-state"><p>暂无番号记录</p></div>'; return; }
    // 只显示军级和独立单位
    const topUnits = units.filter(u => !u.parentId);
    c.innerHTML = topUnits.map(u => `
      <div class="unit-card" onclick="location.href='unit.html?id=${u.id}'">
        <h3>${escapeHtml(u.name)}</h3>
        <span class="unit-level-tag">${u.level === 'army_group' ? '集团军' : u.level === 'army' ? '军' : u.level === 'division' ? '师' : u.level === 'brigade' ? '旅' : '单位'}</span>
        ${u.honor ? `<div class="unit-honor">${escapeHtml(u.honor)}</div>` : ''}
        <div class="unit-card-desc">${escapeHtml(u.description || '')}</div>
      </div>
    `).join('');
  } catch (e) { document.getElementById('unitsList').innerHTML = `<div class="empty-state"><p>加载失败</p></div>`; }
}

async function loadRecordings() {
  try {
    const recordings = await api('/api/recordings');
    const c = document.getElementById('recordingsList');
    if (!recordings.length) { c.innerHTML = '<div class="empty-state"><div class="icon">♪</div><p>暂无口述记录</p></div>'; return; }
    c.innerHTML = recordings.slice(0, 6).map(r => {
      const tags = (r.tags || []).slice(0, 6).map(t => `<span class="tag" onclick="event.stopPropagation();location.href='search.html?q=${encodeURIComponent(t)}'">${escapeHtml(t)}</span>`).join('');
      return `
        <div class="recording-item" onclick="location.href='veteran.html?id=${r.veteranIds && r.veteranIds[0] || ''}#rec_${r.id}'">
          <div class="recording-header">
            <div class="recording-veteran">
              <div class="recording-veteran-name">${escapeHtml(getVeteranName(r))}</div>
              <div class="recording-veteran-battle">${escapeHtml(getBattleName(r))}</div>
            </div>
            <div class="recording-meta">${formatDuration(r.audioDuration)} · ${formatDate(r.submittedAt)}<br>志愿者: ${escapeHtml(r.volunteerName)}</div>
          </div>
          <div class="recording-transcript-preview">${escapeHtml(truncate(r.transcript, 120))}</div>
          <div class="recording-tags">${tags}</div>
        </div>
      `;
    }).join('');
  } catch (e) { document.getElementById('recordingsList').innerHTML = `<div class="empty-state"><p>加载失败</p></div>`; }
}

async function loadTags() {
  try {
    const tags = await api('/api/tags');
    const c = document.getElementById('tagCloud');
    c.classList.remove('loading');
    if (!tags.length) { c.innerHTML = '<span style="color:var(--c-text-3)">暂无标签</span>'; return; }
    c.innerHTML = tags.map(t => `<span class="tag-cloud-item" onclick="location.href='search.html?q=${encodeURIComponent(t.name)}'">${escapeHtml(t.name)} <span class="count">(${t.count})</span></span>`).join('');
  } catch (e) { document.getElementById('tagCloud').innerHTML = '<span style="color:var(--c-text-3)">加载失败</span>'; }
}

async function init() {
  loadStats();
  await preloadCaches();
  loadVeterans();
  loadBattles();
  loadUnits();
  loadRecordings();
  loadTags();
}
init();
