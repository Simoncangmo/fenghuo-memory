/**
 * 老兵录入管理页面
 * 表单填写 → 番号联想 → 战役多选 → 时间线编辑 → 一键提交
 */

let selectedUnitId = '';
let selectedBattles = [];
let customBattles = [];
let allBattles = [];
let timelineEntries = [];

const TIMELINE_TYPES = [
  { value: 'birth', label: '出生' },
  { value: 'enlist', label: '入伍' },
  { value: 'battle', label: '参战' },
  { value: 'injury', label: '负伤' },
  { value: 'death', label: '逝世' },
  { value: 'honor', label: '授勋' },
  { value: 'promotion', label: '晋升' },
  { value: 'milestone', label: '里程碑' },
  { value: 'interview', label: '口述采集' },
  { value: 'education', label: '求学' },
  { value: 'retire', label: '退伍' },
];

// === 初始化 ===
async function init() {
  // 渲染导航栏和页脚
  initPage('admin');

  // 加载战役列表
  try {
    allBattles = await api('/api/battles');
  } catch (e) {
    console.error('战役列表加载失败', e);
  }

  // 添加一个默认时间节点
  addTimelineEntry();

  // 番号搜索
  let unitTimer = null;
  document.getElementById('vUnitSearch').addEventListener('input', function() {
    clearTimeout(unitTimer);
    const q = this.value.trim();
    const dropdown = document.getElementById('unitDropdown');
    if (!q) { dropdown.style.display = 'none'; return; }
    unitTimer = setTimeout(() => searchUnits(q), 300);
  });

  // 战役搜索
  let battleTimer = null;
  document.getElementById('vBattleSearch').addEventListener('input', function() {
    clearTimeout(battleTimer);
    const q = this.value.trim();
    const dropdown = document.getElementById('battleDropdown');
    if (!q) { dropdown.style.display = 'none'; return; }
    battleTimer = setTimeout(() => searchBattles(q), 300);
  });

  // 点击外部关闭下拉
  document.addEventListener('click', function(e) {
    if (!e.target.closest('.unit-search-wrap')) {
      document.getElementById('unitDropdown').style.display = 'none';
    }
    if (!e.target.closest('.battle-search-wrap')) {
      document.getElementById('battleDropdown').style.display = 'none';
    }
  });

  // 自定义战役输入框支持回车添加
  document.getElementById('customBattleInput').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCustomBattle();
    }
  });

}
init();

// === 出生年份实时校验 ===
function checkBirthYear() {
  const input = document.getElementById('vBirthYear');
  const errorEl = document.getElementById('birthYearError');
  const unknownChecked = document.getElementById('vBirthYearUnknown').checked;
  const val = input.value.trim();
  if (!val || unknownChecked) {
    input.style.borderColor = '';
    errorEl.style.display = 'none';
    return;
  }
  // 必须是纯数字
  if (!/^\d+$/.test(val)) {
    input.style.borderColor = '#c0392b';
    errorEl.style.display = 'block';
    return;
  }
  const y = parseInt(val, 10);
  if (y > 1945 || y < 1880) {
    input.style.borderColor = '#c0392b';
    errorEl.style.display = 'block';
  } else {
    input.style.borderColor = '';
    errorEl.style.display = 'none';
  }
}

// === "不详" 选项切换 ===
function toggleUnknown(inputId, checkboxId) {
  const input = document.getElementById(inputId);
  const checkbox = document.getElementById(checkboxId);
  if (checkbox.checked) {
    input.value = '';
    input.disabled = true;
    input.style.opacity = '0.5';
    input.placeholder = '不详';
  } else {
    input.disabled = false;
    input.style.opacity = '1';
    // 恢复原 placeholder
    if (inputId === 'vBirthYear') input.placeholder = '如：1918';
    else if (inputId === 'vHometown') input.placeholder = '如：山东枣庄';
  }
}

function toggleUnitUnknown() {
  const checkbox = document.getElementById('vUnitUnknown');
  const searchInput = document.getElementById('vUnitSearch');
  if (checkbox.checked) {
    searchInput.value = '';
    searchInput.disabled = true;
    searchInput.style.opacity = '0.5';
    searchInput.placeholder = '不详';
    document.getElementById('unitDropdown').style.display = 'none';
    clearUnitSelection();
    document.getElementById('selectedUnit').style.display = 'none';
  } else {
    searchInput.disabled = false;
    searchInput.style.opacity = '1';
    searchInput.placeholder = '输入数字或番号名称，如：74、三十一师、第十军...';
  }
}

// === 番号联想 ===
async function searchUnits(query) {
  const dropdown = document.getElementById('unitDropdown');
  try {
    const suggestions = await api('/api/units/suggest?q=' + encodeURIComponent(query));
    if (suggestions.length === 0) {
      // 如果联想没结果，尝试全量搜索
      const allUnits = await api('/api/units');
      const filtered = allUnits.filter(u =>
        u.name.includes(query) ||
        (u.shortName && u.shortName.includes(query)) ||
        (u.aliases && u.aliases.some(a => a.includes(query)))
      );
      if (filtered.length === 0) {
        dropdown.innerHTML = '<div class="dd-item" style="color:var(--c-text-muted);">未找到匹配的部队番号</div>';
        dropdown.style.display = 'block';
        return;
      }
      renderUnitDropdown(filtered, false);
    } else {
      renderUnitDropdown(suggestions, true);
    }
  } catch (e) {
    dropdown.style.display = 'none';
  }
}

function renderUnitDropdown(units, isSuggest) {
  const dropdown = document.getElementById('unitDropdown');
  let html = '';
  units.forEach(u => {
    const children = u.children || [];
    html += '<div class="dd-item" onclick="selectUnit(\'' + u.id + '\', \'' + escapeHtml(u.name) + '\', \'' + escapeHtml(u.honor || '') + '\')">';
    html += '<div class="dd-name">' + escapeHtml(u.name) + (u.shortName ? '（' + escapeHtml(u.shortName) + '）' : '') + '</div>';
    if (u.honor) html += '<div class="dd-honor">' + escapeHtml(u.honor) + '</div>';
    html += '<div class="dd-level">' + getUnitLevelLabel(u.level) + (isSuggest && children.length ? ' · 含' + children.length + '个下属单位' : '') + '</div>';
    html += '</div>';
    // 联想模式下也展示子单位
    if (isSuggest && children.length) {
      children.forEach(c => {
        html += '<div class="dd-item" onclick="selectUnit(\'' + c.id + '\', \'' + escapeHtml(c.name) + '\', \'' + escapeHtml(c.honor || '') + '\')" style="padding-left:28px;">';
        html += '<div class="dd-name">├ ' + escapeHtml(c.name) + '</div>';
        if (c.honor) html += '<div class="dd-honor">' + escapeHtml(c.honor) + '</div>';
        html += '<div class="dd-level">' + getUnitLevelLabel(c.level) + '</div>';
        html += '</div>';
      });
    }
  });
  dropdown.innerHTML = html;
  dropdown.style.display = 'block';
}

function getUnitLevelLabel(level) {
  const map = { army_group: '集团军级', army: '军级', division: '师级', brigade: '旅级', regiment: '团级', battalion: '营级', company: '连级' };
  return map[level] || level || '';
}

function selectUnit(id, name, honor) {
  selectedUnitId = id;
  document.getElementById('selectedUnitName').textContent = name;
  document.getElementById('selectedUnitHonor').textContent = honor;
  document.getElementById('selectedUnit').style.display = 'block';
  document.getElementById('vUnitSearch').value = '';
  document.getElementById('unitDropdown').style.display = 'none';
}

function clearUnitSelection() {
  selectedUnitId = '';
  document.getElementById('selectedUnit').style.display = 'none';
  document.getElementById('selectedUnitName').textContent = '';
  document.getElementById('selectedUnitHonor').textContent = '';
}

// === 战役搜索与选择 ===
async function searchBattles(query) {
  const dropdown = document.getElementById('battleDropdown');
  try {
    // 过滤已有战役（排除已选中的）
    const filtered = allBattles.filter(b =>
      !selectedBattles.includes(b.id) &&
      (b.name.includes(query) ||
       (b.startDate && b.startDate.includes(query)) ||
       (b.description && b.description.includes(query)))
    );
    if (filtered.length === 0) {
      dropdown.innerHTML = '<div class="dd-item" style="color:var(--c-text-muted);">未找到匹配的战役，可使用下方自定义输入</div>';
      dropdown.style.display = 'block';
      return;
    }
    let html = '';
    filtered.forEach(b => {
      html += '<div class="dd-item" onclick="selectBattle(\'' + b.id + '\', \'' + escapeHtml(b.name) + '\')">';
      html += '<div class="dd-name">' + escapeHtml(b.name) + '</div>';
      if (b.startDate || b.endDate) {
        html += '<div class="dd-date">' + escapeHtml(b.startDate || '') + ' ~ ' + escapeHtml(b.endDate || '') + '</div>';
      }
      html += '</div>';
    });
    dropdown.innerHTML = html;
    dropdown.style.display = 'block';
  } catch (e) {
    dropdown.style.display = 'none';
  }
}

function selectBattle(id, name) {
  if (selectedBattles.includes(id)) return;
  selectedBattles.push(id);
  document.getElementById('vBattleSearch').value = '';
  document.getElementById('battleDropdown').style.display = 'none';
  renderSelectedBattles();
}

function removeBattle(id) {
  const idx = selectedBattles.indexOf(id);
  if (idx > -1) selectedBattles.splice(idx, 1);
  renderSelectedBattles();
}

function renderSelectedBattles() {
  const container = document.getElementById('selectedBattles');
  if (selectedBattles.length === 0 && customBattles.length === 0) {
    container.innerHTML = '<span style="color:var(--c-text-muted);font-size:14px;">尚未选择任何战役</span>';
    return;
  }
  let html = '';
  // 已选战役（来自数据库）
  selectedBattles.forEach(id => {
    const b = allBattles.find(b => b.id === id);
    if (b) {
      html += '<div class="selected-battle-tag">' + escapeHtml(b.name) +
        ' <span class="tag-remove" onclick="removeBattle(\'' + id + '\')">×</span></div>';
    }
  });
  // 自定义战役
  customBattles.forEach((name, i) => {
    html += '<div class="selected-battle-tag custom">' + escapeHtml(name) +
      ' <span class="tag-remove" onclick="removeCustomBattle(' + i + ')">×</span></div>';
  });
  container.innerHTML = html;
}

// === 自定义战役 ===
function addCustomBattle() {
  const input = document.getElementById('customBattleInput');
  const name = input.value.trim();
  if (!name) { alert('请输入战役名称'); return; }
  // 去重：检查自定义列表和已有战役
  if (customBattles.includes(name)) { alert('已添加过该战役'); return; }
  if (allBattles.some(b => b.name === name)) {
    // 如果战役在数据库中存在，直接选中
    const existing = allBattles.find(b => b.name === name);
    if (!selectedBattles.includes(existing.id)) {
      selectedBattles.push(existing.id);
    }
    input.value = '';
    renderSelectedBattles();
    return;
  }
  customBattles.push(name);
  input.value = '';
  renderSelectedBattles();
}

function removeCustomBattle(idx) {
  customBattles.splice(idx, 1);
  renderSelectedBattles();
}

// === 时间线编辑 ===
function addTimelineEntry(data) {
  const entry = data || { year: '', month: '', event: '', type: 'milestone' };
  timelineEntries.push(entry);
  renderTimeline();
}

function removeTimelineEntry(idx) {
  timelineEntries.splice(idx, 1);
  renderTimeline();
}

function renderTimeline() {
  const container = document.getElementById('timelineEditor');
  if (timelineEntries.length === 0) {
    container.innerHTML = '<div style="color:var(--c-text-muted);font-size:14px;padding:8px 0;">暂无时间节点，点击下方按钮添加</div>';
    return;
  }
  container.innerHTML = timelineEntries.map((e, i) => {
    const typeOpts = TIMELINE_TYPES.map(t =>
      '<option value="' + t.value + '"' + (e.type === t.value ? ' selected' : '') + '>' + t.label + '</option>'
    ).join('');
    return '<div class="timeline-entry">' +
      '<div class="tl-row1">' +
      '<select onchange="updateTimeline(' + i + ',\'type\',this.value)">' + typeOpts + '</select>' +
      '<input type="number" placeholder="年份" value="' + (e.year || '') + '" min="1890" max="2026" onchange="updateTimeline(' + i + ',\'year\',this.value)">' +
      '<input type="number" placeholder="月" value="' + (e.month || '') + '" min="1" max="12" style="width:70px;" onchange="updateTimeline(' + i + ',\'month\',this.value)">' +
      '</div>' +
      '<div class="tl-row2">' +
      '<textarea placeholder="事件描述" onchange="updateTimeline(' + i + ',\'event\',this.value)">' + escapeHtml(e.event || '') + '</textarea>' +
      '<button class="tl-remove" onclick="removeTimelineEntry(' + i + ')" title="删除">×</button>' +
      '</div>' +
      '</div>';
  }).join('');
}

function updateTimeline(idx, field, value) {
  if (field === 'year' || field === 'month') {
    timelineEntries[idx][field] = value ? parseInt(value) : '';
  } else {
    timelineEntries[idx][field] = value;
  }
}

// === 提交 ===
async function submitVeteran() {
  const name = document.getElementById('vName').value.trim();
  const birthYearUnknown = document.getElementById('vBirthYearUnknown').checked;
  const birthYear = birthYearUnknown ? null : document.getElementById('vBirthYear').value;
  const deathYear = document.getElementById('vDeathYear').value;
  const hometownUnknown = document.getElementById('vHometownUnknown').checked;
  const hometown = hometownUnknown ? '不详' : document.getElementById('vHometown').value.trim();
  const rank = document.getElementById('vRank').value.trim();
  const bio = document.getElementById('vBio').value.trim();
  const unitUnknown = document.getElementById('vUnitUnknown').checked;

  // 校验必填
  if (!name) { alert('请填写姓名'); return; }
  if (!birthYearUnknown && !birthYear) { alert('请填写出生年份或勾选"不详"'); return; }
  if (!birthYearUnknown && birthYear) {
    const y = parseInt(birthYear);
    if (y > 1945 || y < 1880) { alert('出生年份有误，请核实'); return; }
  }
  if (!hometownUnknown && !hometown) { alert('请填写籍贯或勾选"不详"'); return; }
  if (!unitUnknown && !selectedUnitId) { alert('请选择部队番号或勾选"不详"'); return; }

  // 组装数据
  const veteranData = {
    name: name,
    birthYear: birthYearUnknown ? null : parseInt(birthYear),
    deathYear: deathYear ? parseInt(deathYear) : null,
    hometown: hometown,
    rank: rank,
    bio: bio,
    unitId: unitUnknown ? '' : selectedUnitId,
    battleIds: selectedBattles,
    customBattles: customBattles,
    timeline: timelineEntries.filter(e => e.event && e.event.trim()),
    birthPlace: null,
    photo: '',
    recordingCount: 0
  };

  // 补充部队名称
  if (unitUnknown) {
    veteranData.militaryUnit = '不详';
  } else {
    const unitName = document.getElementById('selectedUnitName').textContent;
    if (unitName) veteranData.militaryUnit = unitName;
  }

  // 提交
  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.textContent = '提交中...';

  try {
    const result = await api('/api/veterans', {
      method: 'POST',
      body: veteranData
    });

    // 显示成功弹窗
    document.getElementById('successModal').style.display = 'flex';
  } catch (e) {
    alert('提交失败：' + e.message);
    btn.disabled = false;
    btn.textContent = '提交录入';
  }
}

function closeSuccessModal() {
  document.getElementById('successModal').style.display = 'none';
}

function resetForm() {
  document.getElementById('vName').value = '';
  document.getElementById('vBirthYear').value = '';
  document.getElementById('vBirthYear').disabled = false;
  document.getElementById('vBirthYear').style.opacity = '1';
  document.getElementById('vBirthYear').placeholder = '如：1918';
  document.getElementById('vBirthYearUnknown').checked = false;
  document.getElementById('vDeathYear').value = '';
  document.getElementById('vHometown').value = '';
  document.getElementById('vHometown').disabled = false;
  document.getElementById('vHometown').style.opacity = '1';
  document.getElementById('vHometown').placeholder = '如：山东枣庄';
  document.getElementById('vHometownUnknown').checked = false;
  document.getElementById('vRank').value = '';
  document.getElementById('vBio').value = '';
  document.getElementById('vUnitSearch').value = '';
  document.getElementById('vUnitSearch').disabled = false;
  document.getElementById('vUnitSearch').style.opacity = '1';
  document.getElementById('vUnitSearch').placeholder = '输入数字或番号名称，如：74、三十一师、第十军...';
  document.getElementById('vUnitUnknown').checked = false;
  document.getElementById('vBattleSearch').value = '';
  document.getElementById('customBattleInput').value = '';
  clearUnitSelection();
  selectedBattles = [];
  customBattles = [];
  renderSelectedBattles();
  timelineEntries = [];
  renderTimeline();
  addTimelineEntry();
}
