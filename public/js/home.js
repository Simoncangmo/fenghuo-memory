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
    const [veterans, recordings, battles, evidence] = await Promise.all([
      api('/api/veterans'),
      api('/api/recordings'),
      api('/api/battles'),
      api('/api/evidence')
    ]);
    const c = document.getElementById('veteransList');
    c.classList.remove('loading');
    if (!veterans.length) { c.innerHTML = '<div class="empty-state"><div class="icon">★</div><p>暂无老兵档案</p></div>'; return; }

    // Build battle name lookup
    const battleMap = {};
    battles.forEach(b => battleMap[b.id] = b.name);

    c.innerHTML = veterans.map(v => {
      // Find veteran's recordings
      const vetRecordings = recordings.filter(r => r.veteranIds && r.veteranIds.includes(v.id));
      // Find veteran's evidence
      const vetEvidence = evidence.filter(e => e.veteranId === v.id);

      // Extract a quote from recordings
      let quote = '';
      if (vetRecordings.length > 0) {
        const rec = vetRecordings[0];
        if (rec.transcriptSegments && rec.transcriptSegments.length > 1) {
          // Skip intro segments (我叫/我是/接着说), find an impactful quote
          const meaningful = rec.transcriptSegments.filter(s =>
            s.text.length >= 15 &&
            !s.text.startsWith('我叫') &&
            !s.text.startsWith('我是') &&
            !s.text.startsWith('再说') &&
            !s.text.startsWith('接着说')
          );
          quote = meaningful.length > 0 ? meaningful[0].text : rec.transcriptSegments[1]?.text || '';
        } else if (rec.transcript) {
          // Extract from full transcript — pick a meaningful sentence
          const sentences = rec.transcript.match(/[^。！？]+[。！？]+/g) || [];
          const meaningful = sentences.filter(s =>
            s.trim().length >= 10 &&
            !s.trim().startsWith('我叫') &&
            !s.trim().startsWith('我是') &&
            !s.trim().startsWith('再说') &&
            !s.trim().startsWith('接着说')
          );
          quote = meaningful.length > 0 ? meaningful[0].trim() : '';
        }
      }

      // If no recording quote, use timeline entry from 1937-1945
      if (!quote && v.timeline && v.timeline.length > 0) {
        const warEvents = v.timeline.filter(t => t.year >= 1937 && t.year <= 1945 && t.event && t.type !== 'birth');
        if (warEvents.length > 0) {
          quote = warEvents[0].event;
        }
      }
      // Final fallback: use bio
      if (!quote && v.bio) {
        const bioSentences = v.bio.match(/[^。！？]+[。！？]+/g) || [];
        quote = bioSentences.length > 0 ? bioSentences[0].trim() : v.bio.substring(0, 60);
      }

      // Build battle · unit string
      const battleNames = (v.battleIds || []).map(bid => battleMap[bid] || '').filter(Boolean);
      const battleStr = battleNames.join(' · ');
      const unitStr = v.militaryUnit || '';
      const locationStr = battleStr && unitStr ? battleStr + ' · ' + unitStr : battleStr || unitStr || v.hometown || '';

      // Link text varies by recordings
      const linkText = vetRecordings.length > 0 ? '查看他的口述记录 →' : '查看他的抗战经历 →';

      return `
        <div class="veteran-card" onclick="location.href='veteran.html?id=${v.id}'">
          <h3 class="veteran-card-name">${escapeHtml(v.name)}</h3>
          <img class="veteran-card-avatar" src="/images/avatar-placeholder.png" alt="${escapeHtml(v.name)}">
          ${quote ? `<div class="veteran-card-quote">"${escapeHtml(quote)}"</div>` : ''}
          <div class="veteran-card-location">${escapeHtml(locationStr)}</div>
          <div class="veteran-card-stats">
            <span class="stat-tag">口述记录 ${vetRecordings.length} 条</span>
            <span class="stat-tag">物件照片 ${vetEvidence.length} 件</span>
          </div>
          <a href="veteran.html?id=${v.id}" class="veteran-card-link" onclick="event.stopPropagation()">${linkText}</a>
        </div>
      `;
    }).join('');
  } catch (e) { document.getElementById('veteransList').innerHTML = `<div class="empty-state"><p>加载失败</p></div>`; }
}

async function loadBattles() {
  try {
    const battles = await api('/api/battles');
    const c = document.getElementById('battlesList');
    c.classList.remove('loading');
    if (!battles.length) { c.innerHTML = '<div class="empty-state"><div class="icon">◆</div><p>暂无战役记录</p></div>'; return; }
    c.innerHTML = battles.map(b => `
      <div class="battle-card" onclick="location.href='battle.html?id=${b.id}'">
        <h3>${escapeHtml(b.name)}</h3>
        <div class="battle-date">${escapeHtml(b.startDate || '')} ~ ${escapeHtml(b.endDate || '')}</div>
        <div class="battle-card-desc">${escapeHtml(b.description || '')}</div>
        ${b.significance ? `<div class="battle-significance">${escapeHtml(b.significance)}</div>` : ''}
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

async function init() {
  await preloadCaches();
  loadVeterans();
  loadBattles();
  loadUnits();
  loadRecordings();
}
init();
