/**
 * battle.js - 战役详情页逻辑（增强版：动态沙盘 + 地图锚点 + 番号关联）
 */

initPage('battles');

let currentSegmentIndex = -1;
let battleMap = null;

// 标记类型配置
const MARKER_CONFIG = {
  battle:    { color: '#8B1A1A', label: '激战地',   icon: '⚔' },
  defense:   { color: '#4A5D3A', label: '防御阵地', icon: '🛡' },
  enemy:     { color: '#5D2A2A', label: '敌方位置', icon: '▼' },
  reinforce: { color: '#2C5F8F', label: '增援集结', icon: '↑' },
  base:      { color: '#5E7448', label: '根据地',   icon: '★' },
  city:      { color: '#A88830', label: '核心城市', icon: '◆' }
};

// 路径类型配置
const PATH_CONFIG = {
  attack:   { label: '进攻方向', dashArray: '8,6' },
  defense:  { label: '防御防线', dashArray: null },
  flank:    { label: '包抄路线', dashArray: '5,8' },
  movement: { label: '行军路线', dashArray: null }
};

async function loadBattleDetail() {
  const id = getQueryParam('id');
  if (!id) {
    document.getElementById('mainContent').innerHTML =
      '<div class="empty-state"><div class="icon">◆</div><p>未指定战役 ID</p></div>';
    return;
  }

  try {
    const data = await api(`/api/battles/${id}`);
    const { battle, recordings, veterans, units } = data;

    document.title = `${battle.name} · 烽火记忆`;

    const veteranTagsHtml = veterans.map(v =>
      `<a href="veteran.html?id=${v.id}" class="meta-tag">${escapeHtml(v.name)}</a>`
    ).join('');

    const unitTagsHtml = (units || []).map(u =>
      `<a href="unit.html?id=${u.id}" class="meta-tag">${escapeHtml(u.name)}</a>`
    ).join('');

    document.getElementById('mainContent').innerHTML = `
      <!-- 头部 -->
      <div class="detail-header">
        <h1>${escapeHtml(battle.name)}</h1>
        <div class="subtitle">
          ${escapeHtml(battle.startDate || '')} ~ ${escapeHtml(battle.endDate || '')} · ${escapeHtml(battle.location || '')}
        </div>
        <div class="meta-tags">
          <span class="meta-tag">${recordings.length} 条口述</span>
          <span class="meta-tag">${veterans.length} 位老兵</span>
          ${(units || []).length > 0 ? `<span class="meta-tag">${units.length} 个参战番号</span>` : ''}
          ${veteranTagsHtml}
          ${unitTagsHtml}
        </div>
      </div>

      <!-- 战役概况 -->
      <div class="profile-box">
        <h2>战役概况</h2>
        <div class="profile-info">
          <div class="info-item">
            <div class="label">开始日期</div>
            <div class="value">${escapeHtml(battle.startDate || '未知')}</div>
          </div>
          <div class="info-item">
            <div class="label">结束日期</div>
            <div class="value">${escapeHtml(battle.endDate || '未知')}</div>
          </div>
          <div class="info-item">
            <div class="label">作战地点</div>
            <div class="value">${escapeHtml(battle.location || '未知')}</div>
          </div>
          <div class="info-item">
            <div class="label">口述记录</div>
            <div class="value">${recordings.length} 条</div>
          </div>
        </div>
        <div class="profile-bio">${escapeHtml(battle.description || '暂无描述')}</div>
        ${battle.significance ? `
          <div style="margin-top: 16px; padding: 16px; background: rgba(168,136,48,0.06); border-radius: 8px; border-left: 4px solid var(--c-gold);">
            <div style="font-size: 13px; color: var(--c-gold); margin-bottom: 6px; font-weight: 600;">历史意义</div>
            <div style="font-size: 15px; color: var(--c-text);">${escapeHtml(battle.significance)}</div>
          </div>
        ` : ''}
      </div>

      <!-- 战役动态沙盘 -->
      ${battle.mapData ? `
        <div class="profile-box">
          <h2>战役动态沙盘</h2>
          <p style="font-size: 14px; color: var(--c-text-2); margin-bottom: 16px;">
            在现代地图上叠加战役时期的进攻箭头、防御阵地、行军路线。点击锚点查看详细战况。
          </p>
          <div id="battleMap"></div>
          <div class="map-legend" id="mapLegend"></div>
        </div>
      ` : ''}

      <!-- 参战番号 -->
      ${(units && units.length > 0) ? `
        <div class="profile-box">
          <h2>参战番号</h2>
          <div class="card-grid">
            ${units.map(u => `
              <div class="unit-card" onclick="location.href='unit.html?id=${u.id}'">
                <h3>${escapeHtml(u.name)}</h3>
                <div class="unit-level-tag">${escapeHtml(u.level || '')}${u.shortName ? ' · ' + escapeHtml(u.shortName) : ''}</div>
                ${u.honor ? `<div class="unit-honor">${escapeHtml(u.honor)}</div>` : ''}
                <div class="unit-card-desc">${escapeHtml(u.description || '')}</div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- 参战老兵 -->
      ${veterans.length > 0 ? `
        <div class="profile-box">
          <h2>参战老兵</h2>
          <div class="card-grid">
            ${veterans.map(v => `
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
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- 口述记录 -->
      <div class="profile-box">
        <h2>口述记录（${recordings.length} 条）</h2>
        <div id="recordingsContainer">
          ${recordings.length === 0
            ? '<div class="empty-state"><div class="icon">♪</div><p>暂无口述记录</p></div>'
            : recordings.map(r => renderAudioPlayer(r)).join('')
          }
        </div>
        <div class="copyright-notice">
          口述录音版权归原作者及受访老兵所有，本平台仅作历史记录与学术研究用途。如需引用，请注明采集志愿者及来源。
        </div>
      </div>

      ${renderCorrectionBtn('battle', battle.id)}
    `;

    // 初始化地图
    if (battle.mapData) {
      initBattleMap(battle.mapData, veterans);
    }

    // 初始化音频播放器
    recordings.forEach(r => initAudioPlayer(r));

  } catch (e) {
    document.getElementById('mainContent').innerHTML =
      `<div class="empty-state"><div class="icon">◆</div><p>加载失败: ${escapeHtml(e.message)}</p></div>`;
  }
}

// ======================== 地图初始化 ========================

function initBattleMap(mapData, veterans) {
  const mapEl = document.getElementById('battleMap');
  if (!mapEl) return;

  battleMap = L.map('battleMap').setView([mapData.centerLat, mapData.centerLng], mapData.zoom || 13);

  // 使用淡色底图，配合老照片风格
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
    maxZoom: 18
  }).addTo(battleMap);

  const usedMarkerTypes = new Set();
  const usedPathTypes = new Set();

  // 添加标记
  (mapData.markers || []).forEach(m => {
    const config = MARKER_CONFIG[m.type] || MARKER_CONFIG.battle;
    usedMarkerTypes.add(m.type);

    // 自定义图标
    const icon = L.divIcon({
      className: 'battle-marker',
      html: `<div style="
        width: 28px; height: 28px; border-radius: 50%;
        background: ${config.color}; color: #F5F1E8;
        display: flex; align-items: center; justify-content: center;
        font-size: 14px; font-weight: bold;
        border: 3px solid #F5F1E8;
        box-shadow: 0 2px 8px rgba(0,0,0,.3);
      ">${config.icon}</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });

    const popupContent = `
      <div style="min-width: 200px;">
        <div style="font-family: var(--font-serif, serif); font-size: 16px; font-weight: bold; color: ${config.color}; margin-bottom: 6px;">
          ${escapeHtml(m.title)}
        </div>
        <div style="font-size: 13px; color: #555; margin-bottom: 8px;">
          <span style="display: inline-block; padding: 2px 8px; border-radius: 8px; background: ${config.color}20; color: ${config.color};">${config.label}</span>
        </div>
        <div style="font-size: 14px; color: #333; line-height: 1.6;">${escapeHtml(m.description || '')}</div>
      </div>
    `;

    L.marker([m.lat, m.lng], { icon })
      .bindPopup(popupContent)
      .addTo(battleMap);
  });

  // 在标记弹窗中关联老兵信息
  if (veterans && veterans.length > 0) {
    (mapData.markers || []).forEach((m, idx) => {
      const markerObj = battleMap;
    });
  }

  // 添加路径
  (mapData.paths || []).forEach(p => {
    const config = PATH_CONFIG[p.type] || { label: p.label || '路线', dashArray: null };
    usedPathTypes.add(p.type);

    const latlngs = p.points.map(pt => [pt[0], pt[1]]);

    L.polyline(latlngs, {
      color: p.color || '#8B1A1A',
      weight: 3,
      opacity: 0.8,
      dashArray: config.dashArray
    })
      .bindTooltip(escapeHtml(p.label || config.label), { permanent: false, direction: 'top' })
      .addTo(battleMap);

    // 在路径终点添加箭头标记
    if (latlngs.length >= 2) {
      const endPoint = latlngs[latlngs.length - 1];
      const prevPoint = latlngs[latlngs.length - 2];
      const angle = Math.atan2(endPoint[1] - prevPoint[1], endPoint[0] - prevPoint[0]) * 180 / Math.PI;

      const arrowIcon = L.divIcon({
        className: 'path-arrow',
        html: `<div style="
          color: ${p.color || '#8B1A1A'};
          font-size: 22px; font-weight: bold;
          text-shadow: 0 0 4px #F5F1E8, 0 0 4px #F5F1E8;
          transform: rotate(${-angle - 45}deg);
        ">➤</div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });
      L.marker(endPoint, { icon: arrowIcon, interactive: false }).addTo(battleMap);
    }
  });

  // 添加老兵出生地锚点（如果有关联老兵且有坐标）
  if (veterans && veterans.length > 0) {
    veterans.forEach(v => {
      if (v.birthPlace && v.birthPlace.lat && v.birthPlace.lng) {
        const veteranIcon = L.divIcon({
          className: 'veteran-marker',
          html: `<div style="
            width: 22px; height: 22px; border-radius: 50%;
            background: var(--c-mil-green, #4A5D3A); color: #E8E2D4;
            display: flex; align-items: center; justify-content: center;
            font-size: 12px; font-weight: bold;
            border: 2px solid #F5F1E8;
            box-shadow: 0 2px 6px rgba(0,0,0,.2);
          ">${getInitials(v.name)}</div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11]
        });

        const vetPopup = `
          <div style="min-width: 180px;">
            <div style="font-family: var(--font-serif, serif); font-size: 15px; font-weight: bold; color: #4A5D3A; margin-bottom: 4px;">
              ${escapeHtml(v.name)} 出生地
            </div>
            <div style="font-size: 13px; color: #555; margin-bottom: 6px;">${escapeHtml(v.birthPlace.name || '')}</div>
            <a href="veteran.html?id=${v.id}" style="font-size: 13px; color: #4A5D3A;">查看老兵档案 →</a>
          </div>
        `;

        L.marker([v.birthPlace.lat, v.birthPlace.lng], { icon: veteranIcon })
          .bindPopup(vetPopup)
          .addTo(battleMap);
      }
    });
  }

  // 渲染图例
  renderMapLegend(usedMarkerTypes, usedPathTypes);
}

function renderMapLegend(usedMarkerTypes, usedPathTypes) {
  const legendEl = document.getElementById('mapLegend');
  if (!legendEl) return;

  let html = '';

  usedMarkerTypes.forEach(type => {
    const config = MARKER_CONFIG[type];
    if (config) {
      html += `<div class="legend-item">
        <div class="legend-dot" style="background: ${config.color};"></div>
        <span>${config.label}</span>
      </div>`;
    }
  });

  usedPathTypes.forEach(type => {
    const config = PATH_CONFIG[type];
    if (config) {
      const dashStyle = config.dashArray ? `border-top: 3px dashed #8B1A1A;` : `background: #4A5D3A; height: 3px; border-radius: 2px;`;
      html += `<div class="legend-item">
        <div style="width: 20px; ${dashStyle}"></div>
        <span>${config.label}</span>
      </div>`;
    }
  });

  // 老兵出生地图例
  html += `<div class="legend-item">
    <div class="legend-dot" style="background: var(--c-mil-green, #4A5D3A); width: 12px; height: 12px; border: 2px solid #F5F1E8;"></div>
    <span>老兵出生地</span>
  </div>`;

  legendEl.innerHTML = html;
}

// ======================== 音频播放器 ========================

function renderAudioPlayer(r) {
  const hasAudio = r.audioFileName && r.audioFileName.length > 0;
  const segmentsHtml = (r.transcriptSegments || []).map((seg, i) =>
    `<span class="transcript-segment" id="seg_${r.id}_${i}" data-start="${seg.start}" data-end="${seg.end}" onclick="seekToSegment('${r.id}', ${seg.start})">${escapeHtml(seg.text)}</span>`
  ).join('');

  const tagsHtml = (r.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('');

  return `
    <div class="audio-player-box" id="rec_${r.id}">
      <div class="audio-player-header">
        <div class="info">
          <div>
            <div class="veteran-name">${formatDateTime(r.recordedAt)}</div>
            <div class="volunteer">志愿者: ${escapeHtml(r.volunteerName)} · ${escapeHtml(r.volunteerLocation || '')}</div>
          </div>
        </div>
        <div class="duration">${formatDuration(r.audioDuration)}</div>
      </div>

      ${hasAudio
        ? `<div class="custom-audio-player">
            <button class="play-button" id="play_${r.id}" onclick="togglePlay('${r.id}')">▶</button>
            <div class="audio-progress" id="progress_${r.id}" onclick="seekAudio('${r.id}', event)">
              <div class="audio-progress-fill" id="progressFill_${r.id}"></div>
            </div>
            <div class="audio-time" id="time_${r.id}">00:00 / ${formatDuration(r.audioDuration)}</div>
          </div>
          <audio id="audio_${r.id}" src="/uploads/${r.audioFileName}" preload="metadata"></audio>`
        : `<div class="no-audio">
            <span>♪</span>
            <span>此记录为纯文字口述，无原始音频文件。${r.notes ? '备注：' + escapeHtml(r.notes) : ''}</span>
          </div>`
      }

      ${(r.transcriptSegments || []).length > 0 ? `
        <div class="transcript-anchor">
          ${r.transcriptSegments.map((seg, i) =>
            `<span onclick="seekToSegment('${r.id}', ${seg.start})">[${formatDuration(seg.start)}] ${truncate(escapeHtml(seg.text), 12)}</span>`
          ).join('')}
        </div>
      ` : ''}

      <div class="transcript-box" id="transcript_${r.id}">
        ${segmentsHtml || escapeHtml(r.transcript || '')}
      </div>

      ${tagsHtml ? `<div class="recording-tags" style="margin-top: 12px;">${tagsHtml}</div>` : ''}

      ${r.notes ? `<div style="margin-top: 8px; font-size: 13px; color: var(--c-text-3);">备注: ${escapeHtml(r.notes)}</div>` : ''}
    </div>
  `;
}

function initAudioPlayer(r) {
  const hasAudio = r.audioFileName && r.audioFileName.length > 0;
  if (!hasAudio) return;

  const audio = document.getElementById(`audio_${r.id}`);
  if (!audio) return;

  audio.addEventListener('timeupdate', () => {
    const progress = (audio.currentTime / audio.duration) * 100 || 0;
    const fillEl = document.getElementById(`progressFill_${r.id}`);
    const timeEl = document.getElementById(`time_${r.id}`);
    if (fillEl) fillEl.style.width = progress + '%';
    if (timeEl) timeEl.textContent =
      `${formatDuration(audio.currentTime)} / ${formatDuration(audio.duration)}`;
    highlightSegment(r.id, audio.currentTime);
  });

  audio.addEventListener('ended', () => {
    const btn = document.getElementById(`play_${r.id}`);
    if (btn) btn.textContent = '▶';
    clearHighlight(r.id);
  });
}

function togglePlay(recId) {
  const audio = document.getElementById(`audio_${recId}`);
  if (!audio) return;

  document.querySelectorAll('audio').forEach(a => {
    if (a !== audio) {
      a.pause();
      const playBtn = document.getElementById(`play_${a.id.replace('audio_', '')}`);
      if (playBtn) playBtn.textContent = '▶';
    }
  });

  if (audio.paused) {
    audio.play();
    document.getElementById(`play_${recId}`).textContent = '⏸';
  } else {
    audio.pause();
    document.getElementById(`play_${recId}`).textContent = '▶';
  }
}

function seekAudio(recId, event) {
  const audio = document.getElementById(`audio_${recId}`);
  const progress = document.getElementById(`progress_${recId}`);
  const rect = progress.getBoundingClientRect();
  const percent = (event.clientX - rect.left) / rect.width;
  audio.currentTime = percent * audio.duration;
}

function seekToSegment(recId, startTime) {
  const audio = document.getElementById(`audio_${recId}`);
  if (!audio) return;
  audio.currentTime = startTime;
  if (audio.paused) togglePlay(recId);
}

function highlightSegment(recId, currentTime) {
  const segments = document.querySelectorAll(`#transcript_${recId} .transcript-segment`);
  let activeIdx = -1;
  segments.forEach((seg, i) => {
    const start = parseFloat(seg.dataset.start);
    const end = parseFloat(seg.dataset.end);
    if (currentTime >= start && currentTime < end) {
      activeIdx = i;
    }
  });

  if (activeIdx !== currentSegmentIndex) {
    segments.forEach(s => s.classList.remove('active'));
    if (activeIdx >= 0) {
      segments[activeIdx].classList.add('active');
      segments[activeIdx].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    currentSegmentIndex = activeIdx;
  }
}

function clearHighlight(recId) {
  const segments = document.querySelectorAll(`#transcript_${recId} .transcript-segment`);
  segments.forEach(s => s.classList.remove('active'));
  currentSegmentIndex = -1;
}

// 启动
loadBattleDetail();
