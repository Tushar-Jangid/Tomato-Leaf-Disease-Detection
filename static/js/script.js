/**
 * LeafScan AI — Client Logic
 */

'use strict';

// ─── State ───────────────────────────────────────────────────────────────────
let currentFile = null;
let cameraStream = null;

// ─── DOM Ready ────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  updateAnalyzeBtn();
});

// ─── File Input ───────────────────────────────────────────────────────────────
function triggerFileInput() {
  document.getElementById('fileInput').click();
}

function onFileSelected(e) {
  const file = e.target.files[0];
  if (file) setFile(file);
}

function setFile(file) {
  // Only accept images
  if (!file.type.startsWith('image/')) {
    showError('Please upload an image file (JPG, PNG, or WEBP).');
    return;
  }
  currentFile = file;
  hideError();
  showPreview(file);
  updateAnalyzeBtn();
  resetResults();
}

function showPreview(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('previewImg').src = e.target.result;
    document.getElementById('previewName').textContent = truncate(file.name, 28);
    document.getElementById('previewSize').textContent = formatBytes(file.size);
    document.getElementById('dzEmpty').style.display = 'none';
    document.getElementById('dzPreview').style.display = 'block';
  };
  reader.readAsDataURL(file);
}

function clearImage() {
  currentFile = null;
  document.getElementById('fileInput').value = '';
  document.getElementById('previewImg').src = '';
  document.getElementById('dzEmpty').style.display = 'block';
  document.getElementById('dzPreview').style.display = 'none';
  hideError();
  updateAnalyzeBtn();
  resetResults();
}

// ─── Drag & Drop ──────────────────────────────────────────────────────────────
function onDragOver(e) {
  e.preventDefault();
  document.getElementById('dropZone').classList.add('drag-over');
}
function onDragLeave(e) {
  document.getElementById('dropZone').classList.remove('drag-over');
}
function onDrop(e) {
  e.preventDefault();
  document.getElementById('dropZone').classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) setFile(file);
}

// ─── Quick Sample Loader ──────────────────────────────────────────────────────
async function loadSample(name) {
  const url = `/static/samples/${name}.jpg`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Not found');
    const blob = await res.blob();
    const file = new File([blob], `${name}.jpg`, { type: 'image/jpeg' });
    setFile(file);
    // Auto-scroll to scanner
    document.querySelector('.scanner-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch {
    showError('Sample image could not be loaded. Please upload your own image.');
  }
}

// ─── Camera ───────────────────────────────────────────────────────────────────
async function openCamera() {
  const modal = document.getElementById('cameraModal');
  modal.style.display = 'flex';
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    document.getElementById('cameraVideo').srcObject = cameraStream;
  } catch (err) {
    closeCamera();
    showError('Camera access denied. Please allow camera permission or upload an image instead.');
  }
}

function closeCamera() {
  document.getElementById('cameraModal').style.display = 'none';
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }
}

function capturePhoto() {
  const video  = document.getElementById('cameraVideo');
  const canvas = document.getElementById('cameraCanvas');
  canvas.width  = video.videoWidth  || 640;
  canvas.height = video.videoHeight || 480;
  canvas.getContext('2d').drawImage(video, 0, 0);
  canvas.toBlob(blob => {
    const file = new File([blob], 'camera_capture.jpg', { type: 'image/jpeg' });
    closeCamera();
    setFile(file);
  }, 'image/jpeg', 0.92);
}

// ─── Analyze ──────────────────────────────────────────────────────────────────
async function analyze() {
  if (!currentFile) return;

  setLoading(true);
  hideError();

  // Animate loading steps
  const steps = ['step1', 'step2', 'step3', 'step4'];
  let stepIdx = 0;
  const stepTimer = setInterval(() => {
    if (stepIdx > 0) {
      const prevEl = document.getElementById(steps[stepIdx - 1]);
      prevEl.classList.remove('active');
      prevEl.classList.add('done');
      prevEl.textContent = '✓ ' + prevEl.textContent.replace(/^[^\s]+ /, '');
    }
    if (stepIdx < steps.length) {
      document.getElementById(steps[stepIdx]).classList.add('active');
      stepIdx++;
    } else {
      clearInterval(stepTimer);
    }
  }, 500);

  const formData = new FormData();
  formData.append('file', currentFile, currentFile.name);

  try {
    const res  = await fetch('/predict', { method: 'POST', body: formData });
    const data = await res.json();
    clearInterval(stepTimer);

    if (!res.ok || !data.success) {
      setLoading(false);
      showError(data.error || 'Analysis failed. Please try a different image.');
      resetResults();
      return;
    }

    setLoading(false);
    showResults(data);
  } catch (err) {
    clearInterval(stepTimer);
    setLoading(false);
    showError('Network error. Check your connection and try again.');
    resetResults();
  }
}

// ─── Show Results ─────────────────────────────────────────────────────────────
function showResults(data) {
  const isHealthy = data.is_healthy;

  // Header
  document.getElementById('resultIcon').textContent   = isHealthy ? '🌿' : '🔴';
  document.getElementById('resultLabel').textContent   = isHealthy ? 'No Disease Found' : 'Disease Detected';
  document.getElementById('resultName').textContent    = data.display_name;
  document.getElementById('resultPathogen').textContent= data.pathogen || '';

  const header = document.getElementById('resultHeader');
  header.className = 'result-header ' + (isHealthy ? 'healthy-header' : 'disease-header');

  // Severity badge
  const sev = (data.severity || '').toLowerCase().replace(/\s+/g, '-');
  const sevEl = document.getElementById('severityBadge');
  sevEl.textContent = data.severity || '—';
  sevEl.className = 'severity-badge sev-' + (
    sev.includes('none')     ? 'none'     :
    sev.includes('critical') ? 'critical' :
    sev.includes('high')     ? 'high'     : 'moderate'
  );

  document.getElementById('categoryBadge').textContent = data.category || '—';

  // Confidence bar
  const conf = Math.round(data.confidence);
  document.getElementById('confValue').textContent = conf + '%';
  setTimeout(() => {
    document.getElementById('confBar').style.width = conf + '%';
  }, 80);
  document.getElementById('engineTag').textContent = 'Engine: ' + (data.engine || 'AI Model');

  // Top predictions
  const list = document.getElementById('predsList');
  list.innerHTML = '';
  (data.top_predictions || []).forEach((p, i) => {
    const c = Math.round(p.confidence);
    list.innerHTML += `
      <div class="pred-item ${i === 0 ? 'top-pred' : ''}">
        <span class="pred-rank">#${i + 1}</span>
        <span class="pred-name">${p.display_name}</span>
        <div class="pred-bar-wrap"><div class="pred-bar" style="width:${c}%"></div></div>
        <span class="pred-conf">${c}%</span>
      </div>`;
  });

  // Description
  document.getElementById('descText').textContent = data.description || '';

  // Symptoms
  const slist = document.getElementById('symptomsList');
  slist.innerHTML = (data.symptoms || []).map(s => `<li>${s}</li>`).join('');

  // Treatments
  document.getElementById('organicText').textContent    = data.organic_treatment  || '—';
  document.getElementById('chemicalText').textContent   = data.chemical_treatment || '—';
  document.getElementById('preventionText').textContent = data.prevention         || '—';

  // Show results pane with animation
  showResultsPane('content');
}

// ─── UI State Helpers ─────────────────────────────────────────────────────────
function setLoading(on) {
  document.getElementById('analyzeBtn').disabled = on || !currentFile;
  document.getElementById('spinner').style.display = on ? 'inline-block' : 'none';
  document.getElementById('btnLabel').style.display = on ? 'none' : 'inline-flex';

  if (on) {
    showResultsPane('loading');
    resetSteps();
  }
}

function resetSteps() {
  ['step1', 'step2', 'step3', 'step4'].forEach((id, i) => {
    const el = document.getElementById(id);
    const labels = ['📡 Loading image', '🧬 Extracting features', '🤖 Running CNN model', '📋 Generating report'];
    el.className = 'step';
    el.textContent = labels[i];
  });
}

function showResultsPane(which) {
  document.getElementById('resultsIdle').style.display    = which === 'idle'    ? 'block' : 'none';
  document.getElementById('resultsLoading').style.display = which === 'loading' ? 'flex'  : 'none';
  document.getElementById('resultsContent').style.display = which === 'content' ? 'flex'  : 'none';
}

function resetResults() {
  showResultsPane('idle');
}

function updateAnalyzeBtn() {
  document.getElementById('analyzeBtn').disabled = !currentFile;
}

function showError(msg) {
  document.getElementById('errorBox').style.display = 'flex';
  document.getElementById('errorText').textContent  = msg;
}
function hideError() {
  document.getElementById('errorBox').style.display = 'none';
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
function truncate(str, max) {
  return str.length > max ? str.slice(0, max - 3) + '...' : str;
}