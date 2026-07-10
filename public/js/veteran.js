/**
 * veteran.js - 老兵个人百科主页（增强版）
 * 生平编年史 + 物证展厅 + 关系图谱 + 音频锚点 + 数字祭奠
 */
initPage('veterans');

let currentSegmentIndex = -1;

async function loadVeteranDetail() {
  const id = getQueryParam('id');
  if (!id) {
    document.getElementById('mainContent').innerHTML = '<div class="empty-state"><div class="icon">★</div><p>未指定老兵 ID</p></div>';
    return;
  }

  try {
    const data = await api(`/api/veterans/${id}`);
    const { veteran, recordings, battles, evidence, relationships, memorials, unit } = data;
    document.title = `${veteran.name} · 烽火记忆`;

    const battleTags = battles.map(b => `<a href="battle.html?id=${b.id}" class="meta-tag">${escapeHtml(b.name)}</a>`).join('');
    const unitTag = unit ? `<a href="unit.html?id=${unit.id}" class="meta-tag">${escapeHtml(unit.shortName)}</a>` : '';

    document.getElementById('mainContent').innerHTML = `
      <div class="detail-header">
        <h1>${escapeHtml(veteran.name)}</h1>
        <div class="subtitle">
          ${veteran.birthYear ? `${veteran.birthYear}年出生` : ''}${veteran.deathYear ? ` · ${veteran.deathYear}年辞世` : ' · 健在'} · ${escapeHtml(veteran.hometown || '')}
        </div>
        <div class="meta-tags">
          ${unitTag}
          <span class="meta-tag">${escapeHtml(veteran.militaryUnit || '')}</span>
          <span class="meta-tag">${escapeHtml(veteran.rank || '')}</span>
          ${battleTags}
          <span class="meta-tag">${recordings.length} 条口述</span>
          ${evidence.length ? `<span class="meta-tag">${evidence.length} 件物证</span>` : ''}
        </div>
      </div>

      <!-- 个人档案 -->
      <div class="profile-box">
        <h2>个人档案</h2>
        <div class="profile-info">
          <div class="info-item"><div class="label">姓名</div><div class="value">${escapeHtml(veteran.name)}</div></div>
          <div class="info-item"><div class="label">籍贯</div><div class="value">${escapeHtml(veteran.hometown || '未知')}</div></div>
          <div class="info-item"><div class="label">出生年份</div><div class="value">${veteran.birthYear || '未知'}</div></div>
          <div class="info-item"><div class="label">部队番号</div><div class="value">${escapeHtml(veteran.militaryUnit || '未知')}</div></div>
          <div class="info-item"><div class="label">军衔</div><div class="value">${escapeHtml(veteran.rank || '未知')}</div></div>
          <div class="info-item"><div class="label">口述记录</div><div class="value">${recordings.length} 条</div></div>
        </div>
        <div class="profile-bio">${escapeHtml(veteran.bio || '暂无简介')}</div>
      </div>

      <!-- 生平编年史时间轴 -->
      ${veteran.timeline && veteran.timeline.length ? `
        <div class="profile-box">
          <h2>生平编年史</h2>
          <div class="timeline">
            ${veteran.timeline.map(t => `
              <div class="timeline-item type-${t.type || 'milestone'}">
                <div class="timeline-year">${t.year}${t.month ? '.' + t.month : ''}年</div>
                <div class="timeline-event">${escapeHtml(t.event || '')} <span class="timeline-type-badge type-badge-${t.type || 'milestone'}">${getTimelineTypeLabel(t.type)}</span></div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- 参与战役 -->
      ${battles.length ? `
        <div class="profile-box">
          <h2>参与战役</h2>
          <div class="card-grid">
            ${battles.map(b => `
              <div class="battle-card" onclick="location.href='battle.html?id=${b.id}'">
                <h3>${escapeHtml(b.name)}</h3>
                <div class="battle-date">${escapeHtml(b.startDate || '')} ~ ${escapeHtml(b.endDate || '')}</div>
                <div class="battle-card-desc">${escapeHtml(b.description || '')}</div>
                <div class="battle-significance">${escapeHtml(b.significance || '')}</div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- 口述记录（音频锚点） -->
      ${recordings.length ? `
        <div class="profile-box">
          <h2>口述记录（${recordings.length} 条）</h2>
          ${recordings.map(r => renderAudioPlayer(r)).join('')}
        </div>
      ` : ''}

      <!-- 物证数字展厅 -->
      ${evidence.length ? `
        <div class="profile-box">
          <h2>物证数字展厅（${evidence.length} 件）</h2>
          <div class="evidence-grid">
            ${evidence.map(evd => `
              <div class="evidence-item" title="${escapeHtml(evd.description || '')}">
                <div class="evidence-thumbnail">${getEvidenceIcon(evd.type)}</div>
                <div class="evidence-info">
                  <div class="evidence-title">${escapeHtml(evd.title || '')}</div>
                  <span class="evidence-type-badge">${getEvidenceTypeLabel(evd.type)}</span>
                  <div class="evidence-desc">${escapeHtml(evd.description || '')}</div>
                  <div class="evidence-meta">
                    <span>采集：${escapeHtml(evd.recordedBy || '')}</span>
                    <span>${formatDate(evd.recordedAt)}</span>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- 网状人物关系图谱 -->
      ${relationships.length ? `
        <div class="profile-box">
          <h2>人物关系图谱</h2>
          <div class="relation-graph">
            ${relationships.map(rel => `
              <div class="relation-node ${rel.relatedType}">
                <div class="relation-name">
                  ${escapeHtml(rel.relatedName)}
                  ${rel.isHistoricalFigure ? '<span class="relation-historical">历史人物</span>' : ''}
                </div>
                <div class="relation-type">${escapeHtml(rel.relation || getRelationTypeLabel(rel.relatedType))}</div>
                <div class="relation-desc">${escapeHtml(rel.description || '')}</div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- 数字祭奠 -->
      <div class="profile-box">
        <h2>数字祭奠 ${veteran.deathYear ? '' : '· 祝福墙'}</h2>
        <div class="memorial-box">
          <div class="memorial-form">
            <input type="text" id="memVisitorName" placeholder="您的姓名（或昵称）" maxlength="20">
            <textarea id="memMessage" rows="2" placeholder="写下您的缅怀或祝福..." maxlength="200"></textarea>
            <div style="display:flex;gap:12px;">
              <button onclick="submitMemorial('${id}', 'flower')" style="flex:1;">💐 献花</button>
              <button onclick="submitMemorial('${id}', 'candle')" style="flex:1;background:var(--c-gold);">🕯 点燃火炬</button>
            </div>
          </div>
          ${memorials && memorials.length ? `
            <div class="memorial-list">
              ${memorials.map(m => `
                <div class="memorial-item">
                  <div class="memorial-icon">${m.type === 'flower' ? '💐' : '🕯️'}</div>
                  <div class="memorial-content">
                    <div class="visitor">${escapeHtml(m.visitorName)}</div>
                    <div class="message">${escapeHtml(m.message)}</div>
                    <div class="time">${formatDateTime(m.createdAt)}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : '<p style="text-align:center;color:var(--c-text-3);margin-top:20px;">还没有留言，成为第一位缅怀者</p>'}
        </div>
      </div>

      <!-- 版权标注 -->
      <div class="copyright-notice">
        本档案史料由志愿者团队采录整理${recordings.length ? `，已获家属电子授权` : ''}。如需引用请注明来源。
        ${recordings.length ? '<br>采录志愿者：' + escapeHtml([...new Set(recordings.map(r => r.volunteerName))].join('、')) : ''}
      </div>
    `;

    // 初始化音频播放器
    recordings.forEach(r => initAudioPlayer(r));

    // 注入纠错按钮
    const btn = document.createElement('div');
    btn.innerHTML = renderCorrectionBtn('veteran', id);
    document.getElementById('mainContent').appendChild(btn.firstElementChild);

    // 滚动到指定录音
    setTimeout(() => {
      const hash = window.location.hash;
      if (hash) {
        const el = document.querySelector(hash);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 500);

  } catch (e) {
    document.getElementById('mainContent').innerHTML = `<div class="empty-state"><div class="icon">★</div><p>加载失败: ${escapeHtml(e.message)}</p></div>`;
  }
}

// 音频播放器
function renderAudioPlayer(r) {
  const hasAudio = r.audioFileName && r.audioFileName.length > 0;
  const segments = r.transcriptSegments || [];

  // 段落锚点
  const anchorsHtml = segments.length ? `
    <div class="transcript-anchor">
      <span style="color:var(--c-text-3);">段落锚点（点击跳转）：</span>
      ${segments.map((seg, i) => `<span onclick="seekToSegment('${r.id}', ${seg.start})" title="${escapeHtml(truncate(seg.text, 30))}">${escapeHtml(truncate(seg.text, 12))}</span>`).join('')}
    </div>
  ` : '';

  const segmentsHtml = segments.length
    ? segments.map((seg, i) => `<span class="transcript-segment" id="seg_${r.id}_${i}" data-start="${seg.start}" data-end="${seg.end}" onclick="seekToSegment('${r.id}', ${seg.start})">${escapeHtml(seg.text)}</span>`).join('')
    : escapeHtml(r.transcript || '');

  const tagsHtml = (r.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('');

  return `
    <div class="audio-player-box" id="rec_${r.id}">
      <div class="audio-player-header">
        <div>
          <div class="veteran-name">${formatDateTime(r.recordedAt)}</div>
          <div class="volunteer">志愿者: ${escapeHtml(r.volunteerName)} · ${escapeHtml(r.volunteerLocation || '')}</div>
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
        : `<div class="no-audio"><span>♪</span><span>此记录为纯文字口述，无原始音频文件。${r.notes ? '备注：' + escapeHtml(r.notes) : ''}</span></div>`
      }
      ${anchorsHtml}
      <div class="transcript-box" id="transcript_${r.id}">${segmentsHtml}</div>
      ${tagsHtml ? `<div class="recording-tags" style="margin-top:12px;">${tagsHtml}</div>` : ''}
      ${r.notes ? `<div style="margin-top:8px;font-size:13px;color:var(--c-text-3);">备注: ${escapeHtml(r.notes)}</div>` : ''}
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
    const fill = document.getElementById(`progressFill_${r.id}`);
    const time = document.getElementById(`time_${r.id}`);
    if (fill) fill.style.width = progress + '%';
    if (time) time.textContent = `${formatDuration(audio.currentTime)} / ${formatDuration(audio.duration)}`;
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
      const btn = document.getElementById(`play_${a.id.replace('audio_', '')}`);
      if (btn) btn.textContent = '▶';
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
  if (!audio || !progress) return;
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
    if (currentTime >= start && currentTime < end) activeIdx = i;
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
  document.querySelectorAll(`#transcript_${recId} .transcript-segment`).forEach(s => s.classList.remove('active'));
  currentSegmentIndex = -1;
}

// 数字祭奠提交
async function submitMemorial(veteranId, type) {
  const name = document.getElementById('memVisitorName').value.trim();
  const message = document.getElementById('memMessage').value.trim();
  if (!name) { showToast('请输入您的姓名', 'error'); return; }
  if (!message) { showToast('请写下留言内容', 'error'); return; }

  try {
    await api('/api/memorials', {
      method: 'POST',
      body: { veteranId, visitorName: name, message, type }
    });
    showToast(type === 'flower' ? '献花成功，感谢您的缅怀' : '火炬已点燃，感谢您的缅怀');
    setTimeout(() => location.reload(), 1200);
  } catch (e) {
    showToast('提交失败: ' + e.message, 'error');
  }
}

loadVeteranDetail();
