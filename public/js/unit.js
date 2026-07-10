/**
 * unit.js - 番号百科页面逻辑
 * 编制树状图 + 长官编年史 + 部队纪念墙 + 战历荣誉榜
 */
initPage('units');

async function loadUnitDetail() {
  const id = getQueryParam('id');
  if (!id) {
    document.getElementById('mainContent').innerHTML = '<div class="empty-state"><div class="icon">⬡</div><p>未指定番号 ID</p></div>';
    return;
  }

  try {
    const data = await api(`/api/units/${id}`);
    const { unit, parent, children, veterans, battles } = data;
    document.title = `${unit.name} · 烽火记忆`;

    const levelLabel = { army_group: '集团军', army: '军', division: '师', brigade: '旅' }[unit.level] || unit.level;

    document.getElementById('mainContent').innerHTML = `
      <div class="detail-header">
        <h1>${escapeHtml(unit.name)}</h1>
        <div class="subtitle">${levelLabel}级 · ${unit.shortName} · ${unit.aliases && unit.aliases.length ? '别名：' + escapeHtml(unit.aliases.join('、')) : ''}</div>
        <div class="meta-tags">
          ${unit.honor ? `<span class="meta-tag">★ ${escapeHtml(unit.honor)}</span>` : ''}
          ${parent ? `<a href="unit.html?id=${parent.id}" class="meta-tag">上级：${escapeHtml(parent.shortName)}</a>` : ''}
          ${children.length ? `<span class="meta-tag">下属 ${children.length} 个单位</span>` : ''}
          <span class="meta-tag">${veterans.length} 位已登记老兵</span>
        </div>
      </div>

      <!-- 简介 -->
      <div class="profile-box">
        <h2>部队简介</h2>
        <div class="profile-bio">${escapeHtml(unit.description || '暂无简介')}</div>
      </div>

      <!-- 编制树 -->
      ${(parent || children.length) ? `
        <div class="profile-box">
          <h2>编制隶属</h2>
          <div class="unit-tree">
            ${parent ? `
              <div class="unit-tree-node">
                <div class="unit-tree-label" onclick="location.href='unit.html?id=${parent.id}'">
                  <span style="color:var(--c-gold);font-weight:bold;">${escapeHtml(parent.name)}</span>
                  <span style="font-size:13px;color:var(--c-text-3);margin-left:auto;">上级单位</span>
                </div>
              </div>
            ` : ''}
            <div class="unit-tree-node">
              <div class="unit-tree-label" style="border-color:var(--c-mil-green);background:var(--c-bg-alt);">
                <span style="font-family:var(--font-serif);font-weight:bold;font-size:17px;">${escapeHtml(unit.name)}</span>
                <span style="font-size:13px;color:var(--c-mil-green);margin-left:auto;">当前单位</span>
              </div>
            </div>
            ${children.map(c => `
              <div class="unit-tree-node">
                <div class="unit-tree-label" onclick="location.href='unit.html?id=${c.id}'">
                  <span style="font-weight:600;">${escapeHtml(c.name)}</span>
                  ${c.honor ? `<span style="font-size:13px;color:var(--c-gold);">★ ${escapeHtml(c.honor)}</span>` : ''}
                  <span style="font-size:13px;color:var(--c-text-3);margin-left:auto;">下属 →</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- 长官编年史 -->
      ${unit.commanders && unit.commanders.length ? `
        <div class="profile-box">
          <h2>长官编年史</h2>
          <div class="commander-list">
            ${unit.commanders.map(cmd => `
              <div class="commander-item">
                <div class="commander-name">${escapeHtml(cmd.name)}</div>
                <div class="commander-role">${escapeHtml(cmd.role || '')}</div>
                <div class="commander-period">${escapeHtml(cmd.period || '')}</div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- 演变历程 -->
      ${unit.evolution && unit.evolution.length ? `
        <div class="profile-box">
          <h2>编制演变历程</h2>
          <div class="timeline">
            ${unit.evolution.map(ev => `
              <div class="timeline-item">
                <div class="timeline-year">${ev.year}年</div>
                <div class="timeline-event">${escapeHtml(ev.event || '')}${ev.parentUnit ? ` <span class="timeline-type-badge type-badge-enlist">隶属${escapeHtml(ev.parentUnit)}</span>` : ''}</div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- 战历荣誉榜 -->
      ${battles.length ? `
        <div class="profile-box">
          <h2>战历荣誉榜</h2>
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

      <!-- 部队纪念墙 -->
      ${veterans.length ? `
        <div class="profile-box">
          <h2>部队纪念墙（${veterans.length} 位已登记老兵）</h2>
          <div class="card-grid">
            ${veterans.map(v => `
              <div class="veteran-card" onclick="location.href='veteran.html?id=${v.id}'">
                <div class="veteran-card-header">
                  <div class="veteran-avatar">${getInitials(v.name)}</div>
                  <div class="veteran-card-info">
                    <h3>${escapeHtml(v.name)}</h3>
                    <div class="unit">${escapeHtml(v.rank || '')} · ${v.deathYear ? '已故' : '健在'}</div>
                  </div>
                </div>
                <div class="veteran-card-bio">${escapeHtml(v.bio || '')}</div>
                <div class="veteran-card-footer">
                  <span>${escapeHtml(v.hometown || '')}</span>
                  <span class="recording-count">${v.recordingCount || 0} 条口述</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : '<div class="profile-box"><div class="empty-state"><div class="icon">★</div><p>该番号暂无已登记老兵，欢迎志愿者录入口述信息</p></div></div>'}

      <!-- 版权标注 -->
      <div class="copyright-notice">
        本页面史料由志愿者团队采录整理，如发现遗漏或错误，请点击右下角"补充史料/纠错"按钮提交线索。
      </div>
    `;

    // 注入纠错按钮
    const btn = document.createElement('div');
    btn.innerHTML = renderCorrectionBtn('unit', id);
    document.getElementById('mainContent').appendChild(btn.firstElementChild);

  } catch (e) {
    document.getElementById('mainContent').innerHTML = `<div class="empty-state"><div class="icon">⬡</div><p>加载失败: ${escapeHtml(e.message)}</p></div>`;
  }
}

loadUnitDetail();
