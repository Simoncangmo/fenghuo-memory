/**
 * record.js - 志愿者语音录入页面逻辑
 * 功能：浏览器录音、实时语音转文字、音频上传、自动归类、提交
 */

initPage('record');

// ======================== 状态管理 ========================

let mediaRecorder = null;
let audioChunks = [];
let audioBlob = null;
let audioFile = null;
let recordingStartTime = 0;
let recordingTimer = null;
let audioContext = null;
let analyser = null;
let audioLevelBars = [];
let animationId = null;
let isRecording = false;

let recognition = null;
let finalTranscript = '';
let interimTranscript = '';

let selectedVeterans = new Set();
let selectedBattles = new Set();

let allVeterans = [];
let allBattles = [];

let currentMode = 'record';

// ======================== 模式切换 ========================

function switchMode(mode) {
  currentMode = mode;
  document.querySelectorAll('.mode-tab').forEach(tab => tab.classList.remove('active'));
  event.target.classList.add('active');

  document.getElementById('recordMode').style.display = mode === 'record' ? 'block' : 'none';
  document.getElementById('uploadMode').style.display = mode === 'upload' ? 'block' : 'none';
}

// ======================== 音量指示器 ========================

function initAudioLevel() {
  const container = document.getElementById('audioLevel');
  container.innerHTML = '';
  for (let i = 0; i < 20; i++) {
    const bar = document.createElement('div');
    bar.className = 'audio-level-bar';
    bar.style.height = '4px';
    container.appendChild(bar);
    audioLevelBars.push(bar);
  }
}

function updateAudioLevel() {
  if (!analyser) return;
  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(dataArray);

  const barCount = audioLevelBars.length;
  const step = Math.floor(dataArray.length / barCount);

  for (let i = 0; i < barCount; i++) {
    let sum = 0;
    for (let j = 0; j < step; j++) {
      sum += dataArray[i * step + j];
    }
    const avg = sum / step;
    const height = Math.max(4, (avg / 255) * 40);
    audioLevelBars[i].style.height = height + 'px';
  }

  animationId = requestAnimationFrame(updateAudioLevel);
}

// ======================== 录音功能 ========================

async function toggleRecording() {
  if (isRecording) {
    stopRecording();
  } else {
    await startRecording();
  }
}

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // 设置 MediaRecorder
    audioChunks = [];
    const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
    mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data);
    };
    mediaRecorder.onstop = () => {
      audioBlob = new Blob(audioChunks, { type: mimeType || 'audio/webm' });
      stream.getTracks().forEach(track => track.stop());
    };
    mediaRecorder.start();

    // 设置音频分析（音量指示器）
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 64;
    source.connect(analyser);
    updateAudioLevel();

    // 设置 Web Speech API（实时转写）
    initSpeechRecognition();

    // 更新 UI
    isRecording = true;
    recordingStartTime = Date.now();
    finalTranscript = '';
    interimTranscript = '';

    const btn = document.getElementById('recordButton');
    btn.classList.add('recording');
    document.getElementById('recordIcon').textContent = '■';
    document.getElementById('recordText').textContent = '停止录音';
    document.getElementById('recordingStatus').textContent = '正在录音... 实时转写中';
    document.getElementById('transcriptLiveBox').classList.add('active');

    // 计时器
    recordingTimer = setInterval(updateTimer, 1000);

    if (recognition) {
      try {
        recognition.start();
      } catch (e) {
        console.warn('语音识别启动失败:', e);
      }
    }

  } catch (err) {
    showToast('无法访问麦克风: ' + err.message, 'error');
    // 如果无法录音，提示用户使用上传模式
    showToast('请尝试使用"上传音频"模式', 'error');
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  if (recognition) {
    try { recognition.stop(); } catch (e) {}
  }
  if (animationId) {
    cancelAnimationFrame(animationId);
  }
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }

  clearInterval(recordingTimer);
  isRecording = false;

  const btn = document.getElementById('recordButton');
  btn.classList.remove('recording');
  document.getElementById('recordIcon').textContent = '●';
  document.getElementById('recordText').textContent = '重新录音';
  document.getElementById('recordingStatus').textContent =
    `录音完成，时长 ${formatDuration(Math.floor((Date.now() - recordingStartTime) / 1000))}。可在下方编辑转写文字。`;

  // 将最终转写文字填入编辑框
  const fullTranscript = (finalTranscript + ' ' + interimTranscript).trim();
  if (fullTranscript) {
    document.getElementById('transcriptInput').value = fullTranscript;
    triggerAutoCategorize();
  }

  // 重置音量指示器
  audioLevelBars.forEach(bar => bar.style.height = '4px');
}

function updateTimer() {
  const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
  document.getElementById('recordingTimer').textContent = formatDuration(elapsed);
}

// ======================== 语音识别（Web Speech API） ========================

function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    document.getElementById('recordingStatus').innerHTML +=
      '<br><span style="color: var(--c-red); font-size: 12px;">提示：当前浏览器不支持实时语音识别，可录音后手动输入文字。建议使用 Chrome 浏览器。</span>';
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'zh-CN';
  recognition.maxAlternatives = 1;

  recognition.onresult = (event) => {
    interimTranscript = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += transcript;
      } else {
        interimTranscript += transcript;
      }
    }

    const displayText = document.getElementById('transcriptLiveText');
    displayText.innerHTML =
      `<span>${escapeHtml(finalTranscript)}</span>` +
      (interimTranscript ? `<span class="interim">${escapeHtml(interimTranscript)}</span>` : '');

    // 自动滚动到底部
    displayText.scrollTop = displayText.scrollHeight;

    // 实时更新编辑框
    const fullText = (finalTranscript + ' ' + interimTranscript).trim();
    document.getElementById('transcriptInput').value = fullText;

    // 实时触发自动归类（节流）
    clearTimeout(window._autoCategorizeTimer);
    window._autoCategorizeTimer = setTimeout(triggerAutoCategorize, 1000);
  };

  recognition.onerror = (event) => {
    console.warn('语音识别错误:', event.error);
    if (event.error === 'no-speech') {
      // 无语音输入，忽略
    } else if (event.error === 'not-allowed') {
      showToast('请允许麦克风权限以使用语音识别', 'error');
    }
  };

  recognition.onend = () => {
    // 如果仍在录音中，重新启动识别
    if (isRecording) {
      try { recognition.start(); } catch (e) {}
    }
  };
}

// ======================== 文件上传 ========================

function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  audioFile = file;
  audioBlob = null; // 清除录音 blob

  const infoDiv = document.getElementById('uploadedFileInfo');
  const sizeMB = (file.size / 1024 / 1024).toFixed(2);
  infoDiv.style.display = 'block';
  infoDiv.innerHTML = `
    <div style="background: var(--c-bg-alt); padding: 16px; border-radius: 8px; display: flex; align-items: center; gap: 12px;">
      <span style="font-size: 32px;">♪</span>
      <div style="flex: 1; text-align: left;">
        <div style="font-weight: 500;">${escapeHtml(file.name)}</div>
        <div style="font-size: 12px; color: var(--c-text-3);">
          ${sizeMB} MB · ${file.type || '未知格式'}
        </div>
      </div>
      <button onclick="removeFile()" style="background: none; border: none; cursor: pointer; color: var(--c-red); font-size: 20px;">×</button>
    </div>
    <p style="margin-top: 12px; font-size: 13px; color: var(--c-text-2);">
      请在下方"口述文字内容"区域输入或粘贴该音频的转写文字。系统将自动分析文字内容进行智能归类。
    </p>
  `;

  // 尝试获取音频时长
  const audio = new Audio();
  audio.preload = 'metadata';
  audio.onloadedmetadata = () => {
    window._uploadedDuration = audio.duration;
  };
  audio.src = URL.createObjectURL(file);
}

function removeFile() {
  audioFile = null;
  document.getElementById('fileInput').value = '';
  document.getElementById('uploadedFileInfo').style.display = 'none';
  window._uploadedDuration = 0;
}

// 拖拽上传
document.getElementById('uploadArea').addEventListener('dragover', (e) => {
  e.preventDefault();
  e.currentTarget.classList.add('dragover');
});

document.getElementById('uploadArea').addEventListener('dragleave', (e) => {
  e.currentTarget.classList.remove('dragover');
});

document.getElementById('uploadArea').addEventListener('drop', (e) => {
  e.preventDefault();
  e.currentTarget.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('audio/')) {
    document.getElementById('fileInput').files = e.dataTransfer.files;
    handleFileSelect({ target: { files: [file] } });
  }
});

// ======================== 自动归类 ========================

async function triggerAutoCategorize() {
  const text = document.getElementById('transcriptInput').value.trim();
  if (text.length < 5) {
    document.getElementById('autoCategorizeBox').style.display = 'none';
    return;
  }

  try {
    const result = await api('/api/autocategorize', {
      method: 'POST',
      body: { transcript: text }
    });

    const box = document.getElementById('autoCategorizeBox');
    box.style.display = 'block';

    // 渲染老兵匹配
    const veteranResult = document.getElementById('autoVeteranResult');
    if (result.veteranIds.length > 0) {
      veteranResult.innerHTML = result.veteranIds.map(vid => {
        const v = allVeterans.find(x => x.id === vid);
        return `<span class="auto-tag veteran">${escapeHtml(v ? v.name : vid)}</span>`;
      }).join('');
    } else {
      veteranResult.innerHTML = '<span style="color: var(--c-text-3); font-size: 12px;">未匹配到已登记老兵</span>';
    }

    // 渲染战役匹配
    const battleResult = document.getElementById('autoBattleResult');
    if (result.battleIds.length > 0) {
      battleResult.innerHTML = result.battleIds.map(bid => {
        const b = allBattles.find(x => x.id === bid);
        return `<span class="auto-tag battle">${escapeHtml(b ? b.name : bid)}</span>`;
      }).join('');
    } else {
      battleResult.innerHTML = '<span style="color: var(--c-text-3); font-size: 12px;">未匹配到已登记战役</span>';
    }

    // 渲染关键词标签
    const tagResult = document.getElementById('autoTagResult');
    if (result.tags.length > 0) {
      tagResult.innerHTML = result.tags.map(t => `<span class="auto-tag">${escapeHtml(t)}</span>`).join('');
    } else {
      tagResult.innerHTML = '<span style="color: var(--c-text-3); font-size: 12px;">无关键词标签</span>';
    }

    // 自动选中匹配的老兵和战役
    result.veteranIds.forEach(vid => selectedVeterans.add(vid));
    result.battleIds.forEach(bid => selectedBattles.add(bid));
    renderSelectors();

  } catch (e) {
    console.error('自动归类失败:', e);
  }
}

// 转写文字编辑时触发自动归类
let editTimer = null;
document.getElementById('transcriptInput').addEventListener('input', () => {
  clearTimeout(editTimer);
  editTimer = setTimeout(triggerAutoCategorize, 800);
});

// ======================== 标签选择器 ========================

async function loadSelectors() {
  try {
    allVeterans = await api('/api/veterans');
    allBattles = await api('/api/battles');
    renderSelectors();
  } catch (e) {
    console.error('加载选择器失败:', e);
  }
}

function renderSelectors() {
  // 老兵选择器
  const veteranSelector = document.getElementById('veteranSelector');
  veteranSelector.innerHTML = allVeterans.map(v => `
    <span class="tag-option ${selectedVeterans.has(v.id) ? 'selected' : ''}"
          onclick="toggleVeteran('${v.id}')">
      ${escapeHtml(v.name)}
    </span>
  `).join('') || '<span style="color: var(--c-text-3); font-size: 13px;">暂无老兵档案</span>';

  // 战役选择器
  const battleSelector = document.getElementById('battleSelector');
  battleSelector.innerHTML = allBattles.map(b => `
    <span class="tag-option ${selectedBattles.has(b.id) ? 'selected' : ''}"
          onclick="toggleBattle('${b.id}')">
      ${escapeHtml(b.name)}
    </span>
  `).join('') || '<span style="color: var(--c-text-3); font-size: 13px;">暂无战役记录</span>';
}

function toggleVeteran(id) {
  if (selectedVeterans.has(id)) {
    selectedVeterans.delete(id);
  } else {
    selectedVeterans.add(id);
  }
  renderSelectors();
}

function toggleBattle(id) {
  if (selectedBattles.has(id)) {
    selectedBattles.delete(id);
  } else {
    selectedBattles.add(id);
  }
  renderSelectors();
}

// ======================== 提交 ========================

async function submitRecording() {
  const transcript = document.getElementById('transcriptInput').value.trim();
  const volunteerName = document.getElementById('volunteerName').value.trim();
  const volunteerLocation = document.getElementById('volunteerLocation').value.trim();
  const notes = document.getElementById('notes').value.trim();
  const customTagsStr = document.getElementById('customTags').value.trim();

  // 验证
  if (!volunteerName) {
    showToast('请填写志愿者姓名', 'error');
    document.getElementById('volunteerName').focus();
    return;
  }
  if (!transcript) {
    showToast('请输入口述文字内容', 'error');
    document.getElementById('transcriptInput').focus();
    return;
  }
  if (!audioBlob && !audioFile && currentMode === 'record') {
    if (!confirm('您还没有录音或上传音频文件。是否仅提交文字记录？')) {
      return;
    }
  }

  // 解析自定义标签
  const customTags = customTagsStr ? customTagsStr.split(/[,，、\s]+/).filter(Boolean) : [];

  // 计算音频时长
  let audioDuration = 0;
  if (isRecording) {
    stopRecording();
  }
  if (recordingStartTime) {
    audioDuration = Math.floor((Date.now() - recordingStartTime) / 1000);
  }
  if (window._uploadedDuration) {
    audioDuration = Math.floor(window._uploadedDuration);
  }

  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.textContent = '提交中...';

  try {
    let response;

    if (audioBlob || audioFile) {
      // 有音频文件，使用 multipart 上传
      const formData = new FormData();
      if (audioBlob) {
        formData.append('audio', audioBlob, `recording_${Date.now()}.webm`);
      } else if (audioFile) {
        formData.append('audio', audioFile);
      }
      formData.append('transcript', transcript);
      formData.append('volunteerName', volunteerName);
      formData.append('volunteerLocation', volunteerLocation);
      formData.append('notes', notes);
      formData.append('audioDuration', audioDuration);
      formData.append('veteranIds', JSON.stringify([...selectedVeterans]));
      formData.append('battleIds', JSON.stringify([...selectedBattles]));
      formData.append('tags', JSON.stringify(customTags));

      const res = await fetch('/api/recordings', { method: 'POST', body: formData });
      response = await res.json();
    } else {
      // 仅文字提交
      response = await api('/api/recordings/text', {
        method: 'POST',
        body: {
          transcript,
          volunteerName,
          volunteerLocation,
          notes,
          audioDuration,
          veteranIds: [...selectedVeterans],
          battleIds: [...selectedBattles],
          tags: customTags
        }
      });
    }

    if (response.success) {
      document.getElementById('successModal').style.display = 'flex';
    } else {
      throw new Error(response.error || '提交失败');
    }
  } catch (err) {
    showToast('提交失败: ' + err.message, 'error');
    btn.disabled = false;
    btn.textContent = '提交口述记录';
  }
}

function closeSuccessModal() {
  document.getElementById('successModal').style.display = 'none';
}

// ======================== 初始化 ========================

initAudioLevel();
loadSelectors();

// 检查浏览器支持
if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
  document.getElementById('recordingStatus').innerHTML =
    '<span style="color: var(--c-red);">当前浏览器不支持录音功能，请使用"上传音频"模式，或切换到 Chrome/Edge 浏览器。</span>';
}
