/**
 * store.js - 数据存储与智能搜索引擎模块
 * 支持：汉字数字转换、番号树状联想、地名别名关联、模糊搜索、多条件组合检索
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
ensureDir(DATA_DIR);
ensureDir(UPLOADS_DIR);

function readJSON(filename) {
  const filepath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filepath)) return [];
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
  } catch (e) {
    console.error(`读取 ${filename} 失败:`, e.message);
    return [];
  }
}

function writeJSON(filename, data) {
  fs.writeFileSync(path.join(DATA_DIR, filename), JSON.stringify(data, null, 2), 'utf-8');
}

function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
}

// ======================== 汉字数字转换 ========================

const chineseNumMap = {
  '零': 0, '〇': 0, '一': 1, '二': 2, '两': 2, '三': 3, '四': 4,
  '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
  '百': 100, '千': 1000, '万': 10000
};

// 将汉字数字转为阿拉伯数字（如 "七十四" → 74, "三十一" → 31, "一百二十九" → 129）
function chineseToNumber(str) {
  if (!str) return null;
  // 纯数字直接返回
  const pureNum = parseInt(str);
  if (!isNaN(pureNum)) return pureNum;

  let result = 0;
  let current = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (chineseNumMap[ch] !== undefined) {
      const val = chineseNumMap[ch];
      if (val >= 10) {
        if (current === 0) current = 1;
        result += current * val;
        current = 0;
      } else {
        current = val;
      }
    } else {
      // 非数字字符，返回已解析的部分
      break;
    }
  }
  result += current;
  return result > 0 ? result : null;
}

// 从查询中提取番号数字（支持"74"、"七十四"、"74军"等）
function extractUnitNumber(query) {
  if (!query) return null;
  const trimmed = query.trim();

  // 尝试提取纯数字
  const numMatch = trimmed.match(/(\d+)/);
  if (numMatch) return parseInt(numMatch[1]);

  // 尝试汉字数字（匹配连续的汉字数字字符）
  const cnMatch = trimmed.match(/[\u96f6\u3007\u4e00\u4e8c\u4e24\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341\u767e\u5343\u4e07]+/);
  if (cnMatch) {
    const num = chineseToNumber(cnMatch[0]);
    if (num) return num;
  }

  return null;
}

// ======================== 模糊匹配工具 ========================

// 编辑距离（用于错别字容错）
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : Math.min(dp[i-1][j-1], dp[i][j-1], dp[i-1][j]) + 1;
    }
  }
  return dp[m][n];
}

// 模糊包含匹配（容错1-2个字的错别字）
function fuzzyIncludes(text, query, threshold = 1) {
  if (!text || !query) return false;
  if (text.includes(query)) return true;
  if (query.length <= 2) return false; // 短词不做模糊
  // 滑动窗口检查
  for (let i = 0; i <= text.length - query.length; i++) {
    const segment = text.substring(i, i + query.length);
    if (levenshtein(segment, query) <= threshold) return true;
  }
  return false;
}

// ======================== 老兵操作 ========================

function getVeterans() { return readJSON('veterans.json'); }
function getVeteranById(id) { return getVeterans().find(v => v.id === id); }

function addVeteran(veteran) {
  const veterans = getVeterans();
  const newVeteran = {
    id: veteran.id || generateId('vet'),
    name: veteran.name || '',
    birthYear: veteran.birthYear || null,
    deathYear: veteran.deathYear || null,
    hometown: veteran.hometown || '',
    militaryUnit: veteran.militaryUnit || '',
    unitId: veteran.unitId || '',
    rank: veteran.rank || '',
    bio: veteran.bio || '',
    battleIds: veteran.battleIds || [],
    customBattles: veteran.customBattles || [],
    timeline: veteran.timeline || [],
    birthPlace: veteran.birthPlace || null,
    photo: veteran.photo || '',
    createdAt: new Date().toISOString()
  };
  veterans.push(newVeteran);
  writeJSON('veterans.json', veterans);
  return newVeteran;
}

// ======================== 战役操作 ========================

function getBattles() { return readJSON('battles.json'); }
function getBattleById(id) { return getBattles().find(b => b.id === id); }

function addBattle(battle) {
  const battles = getBattles();
  const newBattle = {
    id: battle.id || generateId('btl'),
    name: battle.name || '',
    startDate: battle.startDate || '',
    endDate: battle.endDate || '',
    location: battle.location || '',
    description: battle.description || '',
    significance: battle.significance || '',
    veteranIds: battle.veteranIds || [],
    unitIds: battle.unitIds || [],
    mapData: battle.mapData || null,
    createdAt: new Date().toISOString()
  };
  battles.push(newBattle);
  writeJSON('battles.json', battles);
  return newBattle;
}

// 将老兵ID关联到部队和战役
function linkVeteranToRelations(veteranId, unitId, battleIds) {
  // 关联到部队
  if (unitId) {
    const units = getUnits();
    const unit = units.find(u => u.id === unitId);
    if (unit) {
      if (!unit.veteranIds) unit.veteranIds = [];
      if (!unit.veteranIds.includes(veteranId)) unit.veteranIds.push(veteranId);
      writeJSON('units.json', units);
    }
  }
  // 关联到战役
  if (battleIds && battleIds.length > 0) {
    const battles = getBattles();
    battleIds.forEach(bid => {
      const battle = battles.find(b => b.id === bid);
      if (battle) {
        if (!battle.veteranIds) battle.veteranIds = [];
        if (!battle.veteranIds.includes(veteranId)) battle.veteranIds.push(veteranId);
      }
    });
    writeJSON('battles.json', battles);
  }
}

// ======================== 番号操作 ========================

function getUnits() { return readJSON('units.json'); }
function getUnitById(id) { return getUnits().find(u => u.id === id); }

function getUnitsByNumber(number) {
  const num = typeof number === 'string' ? extractUnitNumber(number) : number;
  if (!num) return [];
  return getUnits().filter(u => u.number === num);
}

// 番号树状联想：输入数字，返回该番号的所有军/师级单位
function unitSuggest(query) {
  const num = extractUnitNumber(query);
  if (!num) return [];

  const allUnits = getUnits();
  // 找到匹配的顶级单位（军级）
  const topUnits = allUnits.filter(u => u.number === num && !u.parentId);
  const results = [];

  topUnits.forEach(army => {
    results.push({
      id: army.id,
      name: army.name,
      shortName: army.shortName,
      level: army.level,
      honor: army.honor || '',
      isParent: true
    });
    // 找到下属师级单位
    const divisions = allUnits.filter(u => u.parentId === army.id);
    divisions.forEach(div => {
      results.push({
        id: div.id,
        name: div.name,
        shortName: div.shortName,
        level: div.level,
        honor: div.honor || '',
        parentName: army.shortName,
        isParent: false
      });
    });
  });

  // 也匹配独立的师级单位
  const standaloneDivs = allUnits.filter(u => u.number === num && u.parentId && !topUnits.some(t => t.id === u.parentId));
  standaloneDivs.forEach(div => {
    if (!results.find(r => r.id === div.id)) {
      results.push({
        id: div.id,
        name: div.name,
        shortName: div.shortName,
        level: div.level,
        honor: div.honor || '',
        isParent: false
      });
    }
  });

  return results;
}

// 获取番号的编制树（含下属单位和长官编年史）
function getUnitTree(unitId) {
  const unit = getUnitById(unitId);
  if (!unit) return null;

  const children = getUnits().filter(u => u.parentId === unitId);
  const parent = unit.parentId ? getUnitById(unit.parentId) : null;

  // 聚合该番号下所有老兵
  const veterans = getVeterans().filter(v => v.unitId === unitId || (v.militaryUnit && v.militaryUnit.includes(unit.shortName)));

  // 关联战役
  const battles = (unit.battles || []).map(id => getBattleById(id)).filter(Boolean);

  return {
    unit,
    parent,
    children,
    veterans,
    battles,
    veteranCount: veterans.length
  };
}

// ======================== 地名操作 ========================

function getPlaces() { return readJSON('places.json'); }
function getPlaceById(id) { return getPlaces().find(p => p.id === id); }

// 模糊地名检索
function searchPlaces(query) {
  if (!query || !query.trim()) return [];
  const q = query.trim();
  const places = getPlaces();

  return places.filter(p => {
    // 精确匹配
    if (p.name.includes(q)) return true;
    // 别名匹配
    if (p.aliases && p.aliases.some(a => a.includes(q))) return true;
    // 模糊匹配（容错错别字）
    if (fuzzyIncludes(p.name, q)) return true;
    if (p.aliases && p.aliases.some(a => fuzzyIncludes(a, q))) return true;
    return false;
  });
}

// ======================== 物证操作 ========================

function getEvidence() { return readJSON('evidence.json'); }
function getEvidenceByVeteran(veteranId) {
  return getEvidence().filter(e => e.veteranId === veteranId);
}

function addEvidence(evidence) {
  const all = getEvidence();
  const newEvidence = {
    id: evidence.id || generateId('evd'),
    veteranId: evidence.veteranId || '',
    type: evidence.type || 'photo',
    title: evidence.title || '',
    description: evidence.description || '',
    imageUrl: evidence.imageUrl || '',
    recordedBy: evidence.recordedBy || '',
    recordedAt: evidence.recordedAt || new Date().toISOString(),
    location: evidence.location || ''
  };
  all.push(newEvidence);
  writeJSON('evidence.json', all);
  return newEvidence;
}

// ======================== 人物关系操作 ========================

function getRelationships() { return readJSON('relationships.json'); }
function getRelationshipsByVeteran(veteranId) {
  return getRelationships().filter(r => r.veteranId === veteranId);
}

function addRelationship(rel) {
  const all = getRelationships();
  const newRel = {
    id: rel.id || generateId('rel'),
    veteranId: rel.veteranId || '',
    relatedName: rel.relatedName || '',
    relatedType: rel.relatedType || 'comrade',
    relation: rel.relation || '',
    description: rel.description || '',
    isHistoricalFigure: rel.isHistoricalFigure || false
  };
  all.push(newRel);
  writeJSON('relationships.json', all);
  return newRel;
}

// ======================== 录音操作 ========================

function getRecordings() { return readJSON('recordings.json'); }
function getRecordingById(id) { return getRecordings().find(r => r.id === id); }
function getRecordingsByVeteran(veteranId) {
  return getRecordings().filter(r => r.veteranIds && r.veteranIds.includes(veteranId));
}
function getRecordingsByBattle(battleId) {
  return getRecordings().filter(r => r.battleIds && r.battleIds.includes(battleId));
}

function addRecording(recording) {
  const recordings = getRecordings();
  const newRecording = {
    id: recording.id || generateId('rec'),
    veteranIds: recording.veteranIds || [],
    battleIds: recording.battleIds || [],
    volunteerName: recording.volunteerName || '匿名志愿者',
    volunteerLocation: recording.volunteerLocation || '',
    audioFileName: recording.audioFileName || '',
    audioDuration: recording.audioDuration || 0,
    audioFormat: recording.audioFormat || 'webm',
    transcript: recording.transcript || '',
    transcriptSegments: recording.transcriptSegments || [],
    tags: recording.tags || [],
    autoTags: recording.autoTags || [],
    recordedAt: recording.recordedAt || new Date().toISOString(),
    submittedAt: new Date().toISOString(),
    status: recording.status || 'published',
    notes: recording.notes || ''
  };
  recordings.push(newRecording);
  writeJSON('recordings.json', recordings);
  updateCounts();
  return newRecording;
}

// ======================== 纠错操作 ========================

function getCorrections() { return readJSON('corrections.json'); }

function addCorrection(correction) {
  const all = getCorrections();
  const newCorr = {
    id: correction.id || generateId('cor'),
    targetType: correction.targetType || 'veteran',
    targetId: correction.targetId || '',
    submitterName: correction.submitterName || '匿名',
    submitterContact: correction.submitterContact || '',
    type: correction.type || 'correction',
    content: correction.content || '',
    status: 'pending',
    submittedAt: new Date().toISOString()
  };
  all.push(newCorr);
  writeJSON('corrections.json', all);
  return newCorr;
}

// ======================== 祭奠操作 ========================

function getMemorials() { return readJSON('memorials.json'); }
function getMemorialsByVeteran(veteranId) {
  return getMemorials().filter(m => m.veteranId === veteranId);
}

function addMemorial(memorial) {
  const all = getMemorials();
  const newMem = {
    id: memorial.id || generateId('mem'),
    veteranId: memorial.veteranId || '',
    visitorName: memorial.visitorName || '匿名访客',
    message: memorial.message || '',
    type: memorial.type || 'flower',
    createdAt: new Date().toISOString()
  };
  all.push(newMem);
  writeJSON('memorials.json', all);
  return newMem;
}

// ======================== 统计 ========================

function updateCounts() {
  const veterans = getVeterans();
  const battles = getBattles();
  const recordings = getRecordings();
  veterans.forEach(v => { v.recordingCount = recordings.filter(r => r.veteranIds.includes(v.id)).length; });
  writeJSON('veterans.json', veterans);
  battles.forEach(b => { b.recordingCount = recordings.filter(r => r.battleIds.includes(b.id)).length; });
  writeJSON('battles.json', battles);
}

function getStats() {
  const veterans = getVeterans();
  const battles = getBattles();
  const recordings = getRecordings();
  const units = getUnits();
  const places = getPlaces();
  const evidence = getEvidence();
  const volunteers = new Set(recordings.map(r => r.volunteerName));
  const corrections = getCorrections();

  return {
    veteranCount: veterans.length,
    battleCount: battles.length,
    recordingCount: recordings.length,
    volunteerCount: volunteers.size,
    totalDuration: recordings.reduce((sum, r) => sum + (r.audioDuration || 0), 0),
    unitCount: units.length,
    placeCount: places.length,
    evidenceCount: evidence.length,
    pendingCorrections: corrections.filter(c => c.status === 'pending').length
  };
}

// ======================== 智能搜索引擎 ========================

function search(query) {
  if (!query || !query.trim()) return { veterans: [], battles: [], recordings: [], units: [], places: [] };

  const q = query.trim();
  const qLower = q.toLowerCase();
  const veterans = getVeterans();
  const battles = getBattles();
  const recordings = getRecordings();
  const units = getUnits();
  const places = getPlaces();

  // 番号联想
  const unitNum = extractUnitNumber(q);
  const matchedUnits = unitNum ? units.filter(u =>
    u.number === unitNum ||
    u.aliases.some(a => a.includes(q)) ||
    fuzzyIncludes(u.name, q, 1)
  ) : units.filter(u =>
    u.aliases.some(a => a.includes(q)) ||
    fuzzyIncludes(u.name, q, 1)
  );

  // 老兵匹配
  const matchedVeterans = veterans.filter(v =>
    v.name.includes(q) ||
    fuzzyIncludes(v.name, q) ||
    (v.militaryUnit && v.militaryUnit.includes(q)) ||
    (v.militaryUnit && fuzzyIncludes(v.militaryUnit, q)) ||
    (v.hometown && v.hometown.includes(q)) ||
    (v.bio && v.bio.includes(q)) ||
    (v.bio && fuzzyIncludes(v.bio, q)) ||
    (v.unitId && matchedUnits.some(u => u.id === v.unitId))
  );

  // 战役匹配
  const matchedBattles = battles.filter(b =>
    b.name.includes(q) ||
    fuzzyIncludes(b.name, q) ||
    (b.location && b.location.includes(q)) ||
    (b.description && b.description.includes(q))
  );

  // 地名匹配
  const matchedPlaces = places.filter(p =>
    p.name.includes(q) ||
    (p.aliases && p.aliases.some(a => a.includes(q))) ||
    fuzzyIncludes(p.name, q) ||
    (p.province && p.province.includes(q))
  );

  // 录音匹配
  const matchedRecordings = recordings.filter(r =>
    (r.transcript && r.transcript.includes(q)) ||
    (r.transcript && fuzzyIncludes(r.transcript, q)) ||
    (r.volunteerName && r.volunteerName.includes(q)) ||
    r.tags.some(t => t.includes(q))
  );

  return {
    veterans: matchedVeterans,
    battles: matchedBattles,
    recordings: matchedRecordings,
    units: matchedUnits,
    places: matchedPlaces
  };
}

// 多条件组合搜索
function advancedSearch(params) {
  const { year, region, unit, warzone, keyword } = params;
  let results = { veterans: [], battles: [], recordings: [], units: [], places: [] };

  const veterans = getVeterans();
  const battles = getBattles();
  const recordings = getRecordings();
  const units = getUnits();
  const places = getPlaces();

  // 筛选老兵
  results.veterans = veterans.filter(v => {
    if (year) {
      const y = parseInt(year);
      const inTimeline = v.timeline && v.timeline.some(t => t.year === y);
      const inBirthYear = v.birthYear === y;
      if (!inTimeline && !inBirthYear) return false;
    }
    if (region && !v.hometown.includes(region) && !(v.birthPlace && v.birthPlace.name && v.birthPlace.name.includes(region))) return false;
    if (unit) {
      const unitNum = extractUnitNumber(unit);
      const matchUnit = !unitNum || v.unitId === units.find(u => u.number === unitNum)?.id ||
        (v.militaryUnit && v.militaryUnit.includes(unit));
      if (!matchUnit) return false;
    }
    if (keyword && !(v.name.includes(keyword) || (v.bio && v.bio.includes(keyword)))) return false;
    return true;
  });

  // 筛选战役
  results.battles = battles.filter(b => {
    if (year) {
      const y = parseInt(year);
      if (!b.startDate || !b.startDate.startsWith(String(y))) return false;
    }
    if (region && !(b.location && b.location.includes(region))) return false;
    if (unit) {
      const unitNum = extractUnitNumber(unit);
      if (unitNum && !units.find(u => u.number === unitNum && b.unitIds && b.unitIds.includes(u.id))) return false;
    }
    if (keyword && !(b.name.includes(keyword) || (b.description && b.description.includes(keyword)))) return false;
    return true;
  });

  return results;
}

// ======================== 自动归类（增强版） ========================

function autoCategorize(transcript) {
  if (!transcript) return { veteranIds: [], battleIds: [], unitIds: [], tags: [] };

  const text = transcript;
  const veterans = getVeterans();
  const battles = getBattles();
  const units = getUnits();

  const veteranIds = [];
  const tags = [];

  // 匹配老兵
  veterans.forEach(v => {
    if (v.name && text.includes(v.name)) {
      veteranIds.push(v.id);
      tags.push(v.name);
    }
    if (v.militaryUnit && text.includes(v.militaryUnit)) {
      if (!veteranIds.includes(v.id)) veteranIds.push(v.id);
    }
  });

  // 匹配番号
  const unitIds = [];
  units.forEach(u => {
    if (text.includes(u.name) || (u.aliases && u.aliases.some(a => text.includes(a)))) {
      unitIds.push(u.id);
      tags.push(u.shortName);
    }
  });

  // 匹配战役（支持去掉后缀的部分匹配 + 地名拆分匹配）
  const battleIds = [];
  const battleSuffixes = ['战役', '会战', '大战', '战斗', '阻击战', '保卫战', '破袭战'];
  battles.forEach(b => {
    let matched = false;
    // 1. 完整名称匹配
    if (b.name && text.includes(b.name)) {
      battleIds.push(b.id);
      tags.push(b.name);
      matched = true;
    }
    // 2. 去掉后缀后的部分匹配（"台儿庄战役" → "台儿庄"）
    if (!matched && b.name) {
      let shortName = b.name;
      battleSuffixes.forEach(sfx => {
        if (shortName.endsWith(sfx)) shortName = shortName.slice(0, -sfx.length);
      });
      if (shortName !== b.name && shortName.length >= 2 && text.includes(shortName)) {
        battleIds.push(b.id);
        tags.push(b.name);
        matched = true;
      }
    }
    // 3. 地名匹配（支持拆分： "山东台儿庄" → "台儿庄"）
    if (!matched && b.location) {
      if (text.includes(b.location)) {
        battleIds.push(b.id);
        matched = true;
      } else {
        // 尝试去掉省份前缀后的地名
        const locParts = b.location.replace(/^(山东|山西|湖南|湖北|河南|河北|江苏|浙江|安徽|江西|广东|广西|四川|云南|贵州|上海|北平|北京|天津|重庆|陕西|甘肃|绥远|察哈尔|热河)/, '');
        if (locParts && locParts.length >= 2 && locParts !== b.location && text.includes(locParts)) {
          battleIds.push(b.id);
          matched = true;
        }
      }
    }
  });

  // 关键词标签
  const keywords = [
    '冲锋', '撤退', '负伤', '牺牲', '战友', '日军', '鬼子', '轰炸',
    '碉堡', '战壕', '缴获', '突围', '增援', '俘虏', '军旗', '奖章',
    '步枪', '机枪', '手榴弹', '炮弹', '刺刀', '防空', '夜袭', '伏击',
    '坦克', '毒气', '地雷', '狙击', '行军', '休整', '晋升', '退伍'
  ];
  keywords.forEach(kw => {
    if (text.includes(kw)) tags.push(kw);
  });

  return {
    veteranIds: [...new Set(veteranIds)],
    battleIds: [...new Set(battleIds)],
    unitIds: [...new Set(unitIds)],
    tags: [...new Set(tags)]
  };
}

// ======================== 导出 ========================

module.exports = {
  // 老兵
  getVeterans, getVeteranById, addVeteran, linkVeteranToRelations,
  // 战役
  getBattles, getBattleById, addBattle,
  // 番号
  getUnits, getUnitById, getUnitsByNumber, unitSuggest, getUnitTree,
  // 地名
  getPlaces, getPlaceById, searchPlaces,
  // 物证
  getEvidence, getEvidenceByVeteran, addEvidence,
  // 关系
  getRelationships, getRelationshipsByVeteran, addRelationship,
  // 录音
  getRecordings, getRecordingById, getRecordingsByVeteran, getRecordingsByBattle, addRecording,
  // 纠错
  getCorrections, addCorrection,
  // 祭奠
  getMemorials, getMemorialsByVeteran, addMemorial,
  // 统计与搜索
  getStats, search, advancedSearch, autoCategorize,
  // 工具
  generateId, extractUnitNumber, chineseToNumber, fuzzyIncludes
};
