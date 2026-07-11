/**
 * server.js - 烽火记忆 · 抗战实录Wiki 后端服务
 * Express 服务器，提供 REST API 和静态文件服务
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const store = require('./store');

const app = express();
const PORT = process.env.PORT || 3000;

// ======================== 中间件 ========================

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// 音频文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.webm';
    cb(null, `audio_${Date.now()}_${Math.random().toString(36).substr(2, 8)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /webm|mp3|wav|ogg|m4a|aac|mp4|jpg|jpeg|png/;
    if (allowed.test(path.extname(file.originalname).toLowerCase()) || allowed.test(file.mimetype.split('/')[1])) {
      return cb(null, true);
    }
    cb(new Error('不支持的文件格式'));
  }
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ======================== 统计 ========================

app.get('/api/stats', (req, res) => {
  res.json(store.getStats());
});

// ======================== 老兵 ========================

app.get('/api/veterans', (req, res) => {
  const veterans = store.getVeterans();
  veterans.sort((a, b) => (b.recordingCount || 0) - (a.recordingCount || 0));
  res.json(veterans);
});

app.get('/api/veterans/:id', (req, res) => {
  const veteran = store.getVeteranById(req.params.id);
  if (!veteran) return res.status(404).json({ error: '老兵信息未找到' });
  const recordings = store.getRecordingsByVeteran(req.params.id);
  const battles = (veteran.battleIds || []).map(id => store.getBattleById(id)).filter(Boolean);
  const evidence = store.getEvidenceByVeteran(req.params.id);
  const relationships = store.getRelationshipsByVeteran(req.params.id);
  const memorials = store.getMemorialsByVeteran(req.params.id);
  const unit = veteran.unitId ? store.getUnitById(veteran.unitId) : null;
  res.json({ veteran, recordings, battles, evidence, relationships, memorials, unit });
});

app.post('/api/veterans', (req, res) => {
  const newVeteran = store.addVeteran(req.body);
  // 自动关联到部队和战役
  store.linkVeteranToRelations(newVeteran.id, newVeteran.unitId, newVeteran.battleIds);
  res.status(201).json(newVeteran);
});

// ======================== 战役 ========================

app.get('/api/battles', (req, res) => {
  const battles = store.getBattles();
  battles.sort((a, b) => (b.recordingCount || 0) - (a.recordingCount || 0));
  res.json(battles);
});

app.get('/api/battles/:id', (req, res) => {
  const battle = store.getBattleById(req.params.id);
  if (!battle) return res.status(404).json({ error: '战役信息未找到' });
  const recordings = store.getRecordingsByBattle(req.params.id);
  const veterans = (battle.veteranIds || []).map(id => store.getVeteranById(id)).filter(Boolean);
  const units = (battle.unitIds || []).map(id => store.getUnitById(id)).filter(Boolean);
  res.json({ battle, recordings, veterans, units });
});

app.post('/api/battles', (req, res) => {
  res.status(201).json(store.addBattle(req.body));
});

// ======================== 番号百科 ========================

app.get('/api/units', (req, res) => {
  res.json(store.getUnits());
});

app.get('/api/units/suggest', (req, res) => {
  const q = req.query.q || '';
  res.json(store.unitSuggest(q));
});

app.get('/api/units/:id', (req, res) => {
  const tree = store.getUnitTree(req.params.id);
  if (!tree) return res.status(404).json({ error: '番号未找到' });
  res.json(tree);
});

// ======================== 地名 ========================

app.get('/api/places', (req, res) => {
  res.json(store.getPlaces());
});

app.get('/api/places/search', (req, res) => {
  const q = req.query.q || '';
  res.json(store.searchPlaces(q));
});

app.get('/api/places/:id', (req, res) => {
  const place = store.getPlaceById(req.params.id);
  if (!place) return res.status(404).json({ error: '地名未找到' });
  const relatedBattles = (place.relatedBattles || []).map(id => store.getBattleById(id)).filter(Boolean);
  const relatedVeterans = (place.relatedVeterans || []).map(id => store.getVeteranById(id)).filter(Boolean);
  const relatedUnits = (place.relatedUnits || []).map(id => store.getUnitById(id)).filter(Boolean);
  res.json({ place, relatedBattles, relatedVeterans, relatedUnits });
});

// ======================== 物证 ========================

app.get('/api/evidence', (req, res) => {
  const { veteranId } = req.query;
  if (veteranId) {
    return res.json(store.getEvidenceByVeteran(veteranId));
  }
  res.json(store.getEvidence());
});

app.post('/api/evidence', upload.single('image'), (req, res) => {
  const body = req.body;
  const evidence = store.addEvidence({
    ...body,
    imageUrl: req.file ? `/uploads/${req.file.filename}` : ''
  });
  res.status(201).json(evidence);
});

// ======================== 人物关系 ========================

app.get('/api/relationships', (req, res) => {
  const { veteranId } = req.query;
  if (veteranId) {
    return res.json(store.getRelationshipsByVeteran(veteranId));
  }
  res.json(store.getRelationships());
});

app.post('/api/relationships', (req, res) => {
  res.status(201).json(store.addRelationship(req.body));
});

// ======================== 录音 ========================

app.get('/api/recordings', (req, res) => {
  const { veteranId, battleId, status } = req.query;
  let recordings = store.getRecordings();
  if (veteranId) recordings = recordings.filter(r => r.veteranIds && r.veteranIds.includes(veteranId));
  if (battleId) recordings = recordings.filter(r => r.battleIds && r.battleIds.includes(battleId));
  if (status) recordings = recordings.filter(r => r.status === status);
  recordings.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  res.json(recordings);
});

app.get('/api/recordings/:id', (req, res) => {
  const recording = store.getRecordingById(req.params.id);
  if (!recording) return res.status(404).json({ error: '录音未找到' });
  const veterans = (recording.veteranIds || []).map(id => store.getVeteranById(id)).filter(Boolean);
  const battles = (recording.battleIds || []).map(id => store.getBattleById(id)).filter(Boolean);
  res.json({ recording, veterans, battles });
});

app.post('/api/recordings', upload.single('audio'), (req, res) => {
  try {
    const body = req.body;
    const transcript = body.transcript || '';
    const autoResult = store.autoCategorize(transcript);

    const veteranIds = [...new Set([
      ...(body.veteranIds ? JSON.parse(body.veteranIds) : []),
      ...autoResult.veteranIds
    ])];
    const battleIds = [...new Set([
      ...(body.battleIds ? JSON.parse(body.battleIds) : []),
      ...autoResult.battleIds
    ])];
    const manualTags = body.tags ? JSON.parse(body.tags) : [];
    const tags = [...new Set([...manualTags, ...autoResult.tags])];

    const recording = store.addRecording({
      veteranIds, battleIds,
      volunteerName: body.volunteerName || '匿名志愿者',
      volunteerLocation: body.volunteerLocation || '',
      audioFileName: req.file ? req.file.filename : '',
      audioFormat: req.file ? path.extname(req.file.filename).slice(1) : 'webm',
      audioDuration: parseFloat(body.audioDuration) || 0,
      transcript,
      transcriptSegments: body.transcriptSegments ? JSON.parse(body.transcriptSegments) : [],
      tags, autoTags: autoResult.tags,
      recordedAt: body.recordedAt || new Date().toISOString(),
      status: 'published',
      notes: body.notes || ''
    });

    res.status(201).json({ success: true, recording, autoCategorization: autoResult });
  } catch (err) {
    console.error('提交录音失败:', err);
    res.status(500).json({ error: '提交失败: ' + err.message });
  }
});

app.post('/api/recordings/text', (req, res) => {
  try {
    const body = req.body;
    const transcript = body.transcript || '';
    const autoResult = store.autoCategorize(transcript);

    const veteranIds = [...new Set([...(body.veteranIds || []), ...autoResult.veteranIds])];
    const battleIds = [...new Set([...(body.battleIds || []), ...autoResult.battleIds])];
    const tags = [...new Set([...(body.tags || []), ...autoResult.tags])];

    const recording = store.addRecording({
      veteranIds, battleIds,
      volunteerName: body.volunteerName || '匿名志愿者',
      volunteerLocation: body.volunteerLocation || '',
      audioFileName: '', audioFormat: '',
      audioDuration: parseFloat(body.audioDuration) || 0,
      transcript,
      transcriptSegments: body.transcriptSegments || [],
      tags, autoTags: autoResult.tags,
      recordedAt: body.recordedAt || new Date().toISOString(),
      status: 'published', notes: body.notes || ''
    });

    res.status(201).json({ success: true, recording, autoCategorization: autoResult });
  } catch (err) {
    res.status(500).json({ error: '提交失败: ' + err.message });
  }
});

// ======================== 自动归类预览 ========================

app.post('/api/autocategorize', (req, res) => {
  res.json(store.autoCategorize(req.body.transcript || ''));
});

// ======================== 搜索引擎 ========================

app.get('/api/search', (req, res) => {
  res.json(store.search(req.query.q || ''));
});

app.post('/api/advancedSearch', (req, res) => {
  res.json(store.advancedSearch(req.body));
});

// ======================== 纠错 ========================

app.get('/api/corrections', (req, res) => {
  res.json(store.getCorrections());
});

app.post('/api/corrections', (req, res) => {
  res.status(201).json(store.addCorrection(req.body));
});

// ======================== 祭奠 ========================

app.get('/api/memorials', (req, res) => {
  const { veteranId } = req.query;
  if (veteranId) return res.json(store.getMemorialsByVeteran(veteranId));
  res.json(store.getMemorials());
});

app.post('/api/memorials', (req, res) => {
  res.status(201).json(store.addMemorial(req.body));
});

// ======================== 标签 ========================

app.get('/api/tags', (req, res) => {
  const recordings = store.getRecordings();
  const tagMap = {};
  recordings.forEach(r => {
    (r.tags || []).forEach(tag => { tagMap[tag] = (tagMap[tag] || 0) + 1; });
  });
  const tags = Object.entries(tagMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
  res.json(tags);
});

// ======================== 启动 ========================

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  烽火记忆 · 抗战实录Wiki`);
  console.log(`  服务已启动: http://localhost:${PORT}`);
  console.log(`========================================\n`);
});
