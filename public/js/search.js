/**
 * search.js - 时空检索页面逻辑
 */
initPage('search');

let _veteranNameCache = {}, _battleNameCache = {};

async function preloadCaches() {
  try {
    const [veterans, battles] = await Promise.all([api('/api/veterans'), api('/api/battles')]);
    veterans.forEach(v => _veteranNameCache[v.id] = v.name);
    battles.forEach(b => _battleNameCache[b.id] = b.name);
  } catch (e) {}
}

// 番号联想（绑定到部队番号输入框）
let suggestTimer = null;
function onUnitInput() {
  clearTimeout(suggestTimer);
  const q = document.getElementById('filterUnit').value.trim();
  const dropdown = document.getElementById('suggestDropdown');

  if (!q || q.length < 1) { dropdown.style.display = 'none'; return; }

  suggestTimer = setTimeout(async () => {
    try {
      const suggestions = await api(`/api/units/suggest?q=${encodeURIComponent(q)}`);
      if (suggestions.length > 0) {
        dropdown.innerHTML = suggestions.map(s => `
          <div class="suggest-item" onclick="selectSuggestion('${escapeHtml(s.name)}')">
            <div class="suggest-name">${escapeHtml(s.name)}</div>
            ${s.honor ? `<div class="suggest-honor">${escapeHtml(s.honor)}</div>` : ''}
            <div class="suggest-level">${s.level === 'army' ? '军级' : s.level === 'division' ? '师级' : s.level === 'brigade' ? '旅级' : s.level === 'army_group' ? '集团军级' : ''} ${s.isParent ? '（含下属师级单位）' : ''}</div>
          </div>
        `).join('');
        dropdown.style.display = 'block';
      } else {
        dropdown.style.display = 'none';
      }
    } catch (e) { dropdown.style.display = 'none'; }
  }, 300);
}

function selectSuggestion(name) {
  document.getElementById('filterUnit').value = name;
  document.getElementById('suggestDropdown').style.display = 'none';
}

document.addEventListener('click', e => {
  if (!e.target.closest('.filter-group')) {
    document.getElementById('suggestDropdown').style.display = 'none';
  }
});

// 高级组合检索
async function advancedSearch() {
  const year = document.getElementById('filterYear').value;
  const region = document.getElementById('filterRegion').value.trim();
  const unit = document.getElementById('filterUnit').value.trim();
  const keyword = document.getElementById('filterKeyword').value.trim();

  const hasFilter = year || region || unit || keyword;
  if (!hasFilter) {
    showToast('请至少输入一个筛选条件', 'error');
    return;
  }

  const c = document.getElementById('searchResults');
  c.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  try {
    const results = await api('/api/advancedSearch', {
      method: 'POST',
      body: { year, region, unit, keyword }
    });
    const desc = [year, region, unit, keyword].filter(Boolean).join(' + ');
    renderSearchResults(results, `组合检索：${escapeHtml(desc)}`);
  } catch (e) {
    c.innerHTML = `<div class="empty-state"><p>检索失败: ${escapeHtml(e.message)}</p></div>`;
  }
}

function resetFilters() {
  document.getElementById('filterYear').value = '';
  document.getElementById('filterRegion').value = '';
  document.getElementById('filterUnit').value = '';
  document.getElementById('filterKeyword').value = '';
  document.getElementById('suggestDropdown').style.display = 'none';
  document.getElementById('searchResults').innerHTML = '';
}

// 渲染搜索结果
function renderSearchResults(results, title) {
  const c = document.getElementById('searchResults');
  let html = `<h2 class="section-title"><span><span class="icon">📋</span>${title}</span></h2>`;

  const total = results.veterans.length + results.battles.length + results.recordings.length +
    (results.units ? results.units.length : 0) + (results.places ? results.places.length : 0);

  if (total === 0) {
    html += '<div class="empty-state"><div class="icon">🔍</div><p>未找到匹配结果</p></div>';
    c.innerHTML = html;
    return;
  }

  // 老兵
  if (results.veterans && results.veterans.length > 0) {
    html += `<h3 style="margin:20px 0 12px;color:var(--c-mil-green);font-family:var(--font-serif);">老兵档案 (${results.veterans.length})</h3>`;
    html += '<div class="card-grid">';
    html += results.veterans.map(v => `
      <div class="veteran-card" onclick="location.href='veteran.html?id=${v.id}'">
        <div class="veteran-card-header">
          <div class="veteran-avatar">${getInitials(v.name)}</div>
          <div class="veteran-card-info">
            <h3>${escapeHtml(v.name)}</h3>
            <div class="unit">${escapeHtml(v.militaryUnit || '')}</div>
          </div>
        </div>
        <div class="veteran-card-bio">${escapeHtml(v.bio || '')}</div>
      </div>
    `).join('');
    html += '</div>';
  }

  // 番号
  if (results.units && results.units.length > 0) {
    html += `<h3 style="margin:24px 0 12px;color:var(--c-earth);font-family:var(--font-serif);">部队番号 (${results.units.length})</h3>`;
    html += '<div class="card-grid">';
    html += results.units.map(u => `
      <div class="unit-card" onclick="location.href='unit.html?id=${u.id}'">
        <h3>${escapeHtml(u.name)}</h3>
        <span class="unit-level-tag">${u.level === 'army' ? '军级' : u.level === 'division' ? '师级' : u.level === 'brigade' ? '旅级' : u.level === 'army_group' ? '集团军级' : ''}</span>
        ${u.honor ? `<div class="unit-honor">${escapeHtml(u.honor)}</div>` : ''}
        <div class="unit-card-desc">${escapeHtml(u.description || '')}</div>
      </div>
    `).join('');
    html += '</div>';
  }

  // 战役
  if (results.battles && results.battles.length > 0) {
    html += `<h3 style="margin:24px 0 12px;color:var(--c-gold);font-family:var(--font-serif);">战役 (${results.battles.length})</h3>`;
    html += '<div class="card-grid">';
    html += results.battles.map(b => `
      <div class="battle-card" onclick="location.href='battle.html?id=${b.id}'">
        <h3>${escapeHtml(b.name)}</h3>
        <div class="battle-date">${escapeHtml(b.startDate || '')} ~ ${escapeHtml(b.endDate || '')}</div>
        <div class="battle-card-desc">${escapeHtml(b.description || '')}</div>
      </div>
    `).join('');
    html += '</div>';
  }

  // 地名
  if (results.places && results.places.length > 0) {
    html += `<h3 style="margin:24px 0 12px;color:var(--c-blue);font-family:var(--font-serif);">历史地名 (${results.places.length})</h3>`;
    html += '<div class="card-grid">';
    html += results.places.map(p => `
      <div class="unit-card" style="border-left-color:var(--c-blue);" onclick="location.href='battle.html?id=${p.relatedBattles && p.relatedBattles[0] || ''}'">
        <h3>${escapeHtml(p.name)}</h3>
        <span class="unit-level-tag" style="color:var(--c-blue);">${escapeHtml(p.province || '')}</span>
        <div class="unit-card-desc">${escapeHtml(p.historicalNote || '')}</div>
      </div>
    `).join('');
    html += '</div>';
  }

  // 口述记录
  if (results.recordings && results.recordings.length > 0) {
    html += `<h3 style="margin:24px 0 12px;color:var(--c-text);font-family:var(--font-serif);">口述记录 (${results.recordings.length})</h3>`;
    html += results.recordings.map(r => {
      const tags = (r.tags || []).slice(0, 6).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('');
      return `
        <div class="recording-item" onclick="location.href='veteran.html?id=${r.veteranIds && r.veteranIds[0] || ''}#rec_${r.id}'">
          <div class="recording-header">
            <div class="recording-veteran">
              <div class="recording-veteran-name">${escapeHtml(_veteranNameCache[r.veteranIds[0]] || '老兵')}</div>
              <div class="recording-veteran-battle">${escapeHtml(_battleNameCache[r.battleIds && r.battleIds[0]] || '')}</div>
            </div>
            <div class="recording-meta">${formatDuration(r.audioDuration)} · ${formatDate(r.submittedAt)}</div>
          </div>
          <div class="recording-transcript-preview">${escapeHtml(truncate(r.transcript, 150))}</div>
          <div class="recording-tags">${tags}</div>
        </div>
      `;
    }).join('');
  }

  c.innerHTML = html;
}

// 初始化
async function init() {
  await preloadCaches();
  const q = getQueryParam('q');
  if (q) {
    document.getElementById('filterKeyword').value = q;
    advancedSearch();
  }
}
init();
