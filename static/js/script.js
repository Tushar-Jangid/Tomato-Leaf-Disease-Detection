/**
 * TomatoDoc AI - Smart Crop Health & Disease Diagnostic System
 * Client Logic & Analytics Engine
 */

// Global State
let currentSelectedFile = null;
let diseaseChartInstance = null;
let severityChartInstance = null;
let encyclopediaData = [];
let cameraStream = null;
let currentHistoryFilter = 'all';

// LocalStorage Key
const STORAGE_KEY_SCANS = 'tomatodoc_history_v1';

// DOM Ready initialization
document.addEventListener('DOMContentLoaded', () => {
    initNavigationTabs();
    initDropzone();
    initDetailSubTabs();
    loadEncyclopedia();
    loadScanHistory();
    updateDashboard();
});

/* =========================================================
   NAVIGATION TABS
   ========================================================= */
function initNavigationTabs() {
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetId = tab.getAttribute('data-tab');
            switchTab(targetId);
        });
    });
}

function switchTab(targetId) {
    document.querySelectorAll('.nav-tab').forEach(t => {
        t.classList.toggle('active', t.getAttribute('data-tab') === targetId);
    });
    document.querySelectorAll('.tab-view').forEach(view => {
        view.classList.toggle('active', view.id === targetId);
    });

    if (targetId === 'dashboard-view') {
        updateDashboard();
    }
}

function switchToDashboard() {
    switchTab('dashboard-view');
}

/* =========================================================
   DROPZONE & FILE SELECTION
   ========================================================= */
function initDropzone() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');

    // Drag & Drop events
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add('dragover');
        });
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('dragover');
        });
    });

    dropZone.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            handleSelectedFile(files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handleSelectedFile(e.target.files[0]);
        }
    });
}

function handleSelectedFile(file) {
    hideErrorAlert();
    
    // Validate type
    if (!file.type.startsWith('image/')) {
        showErrorAlert('Please upload a valid image file (JPG, PNG, WEBP).');
        return;
    }

    // Validate size (16MB)
    if (file.size > 16 * 1024 * 1024) {
        showErrorAlert('File size exceeds the 16MB limit.');
        return;
    }

    currentSelectedFile = file;

    // Display Preview
    const reader = new FileReader();
    reader.onload = (e) => {
        const previewImage = document.getElementById('previewImage');
        const previewFileName = document.getElementById('previewFileName');
        const previewFileSize = document.getElementById('previewFileSize');
        
        previewImage.src = e.target.result;
        previewFileName.textContent = file.name;
        previewFileSize.textContent = formatBytes(file.size);

        document.getElementById('dropzoneDefault').style.display = 'none';
        document.getElementById('dropzonePreview').style.display = 'block';
        
        // Enable Analyze Button
        const analyzeBtn = document.getElementById('analyzeBtn');
        analyzeBtn.disabled = false;
    };
    reader.readAsDataURL(file);
}

function clearSelectedImage() {
    currentSelectedFile = null;
    document.getElementById('fileInput').value = '';
    document.getElementById('dropzoneDefault').style.display = 'block';
    document.getElementById('dropzonePreview').style.display = 'none';
    document.getElementById('analyzeBtn').disabled = true;
    hideErrorAlert();
}

/* =========================================================
   QUICK SAMPLE TESTER
   ========================================================= */
async function loadSampleImage(sampleType) {
    hideErrorAlert();
    const sampleFiles = {
        'healthy': { path: '/static/samples/healthy.jpg', name: 'healthy_leaf_sample.jpg' },
        'early_blight': { path: '/static/samples/early_blight.jpg', name: 'early_blight_sample.jpg' },
        'late_blight': { path: '/static/samples/late_blight.jpg', name: 'late_blight_sample.jpg' },
        'yellow_leaf_curl': { path: '/static/samples/yellow_leaf_curl.jpg', name: 'yellow_curl_sample.jpg' }
    };

    const target = sampleFiles[sampleType];
    if (!target) return;

    try {
        const res = await fetch(target.path);
        if (!res.ok) throw new Error('Sample not available');
        const blob = await res.blob();
        const file = new File([blob], target.name, { type: 'image/jpeg' });
        handleSelectedFile(file);
    } catch (err) {
        console.warn('Sample image load error:', err);
        showErrorAlert('Could not load sample image: ' + target.name);
    }
}

/* =========================================================
   CAMERA SNAPSHOT
   ========================================================= */
async function openCameraModal() {
    const modal = document.getElementById('cameraModal');
    const video = document.getElementById('cameraVideo');
    modal.style.display = 'flex';

    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        video.srcObject = cameraStream;
    } catch (err) {
        alert('Camera access denied or unavailable: ' + err.message);
        closeCameraModal();
    }
}

function closeCameraModal() {
    const modal = document.getElementById('cameraModal');
    const video = document.getElementById('cameraVideo');
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    video.srcObject = null;
    modal.style.display = 'none';
}

function capturePhoto() {
    const video = document.getElementById('cameraVideo');
    const canvas = document.getElementById('cameraCanvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    canvas.toBlob((blob) => {
        if (blob) {
            const snapFile = new File([blob], `leaf_snap_${Date.now()}.jpg`, { type: 'image/jpeg' });
            closeCameraModal();
            handleSelectedFile(snapFile);
        }
    }, 'image/jpeg', 0.92);
}

/* =========================================================
   ANALYSIS INFERENCE
   ========================================================= */
async function startAnalysis() {
    if (!currentSelectedFile) {
        showErrorAlert('Please select or capture an image first.');
        return;
    }

    const analyzeBtn = document.getElementById('analyzeBtn');
    const spinner = document.getElementById('analyzeSpinner');
    const btnText = document.getElementById('analyzeBtnText');

    analyzeBtn.disabled = true;
    spinner.style.display = 'inline-block';
    btnText.style.display = 'none';
    hideErrorAlert();

    const formData = new FormData();
    formData.append('file', currentSelectedFile);

    try {
        const response = await fetch('/predict', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (response.ok && data.success) {
            renderResults(data);
            saveScanToHistory(data);
        } else {
            showErrorAlert(data.error || 'Failed to analyze image. Please try a different leaf photo.');
        }
    } catch (error) {
        console.error('Inference error:', error);
        showErrorAlert('Failed to communicate with diagnostic server. Please try again.');
    } finally {
        analyzeBtn.disabled = false;
        spinner.style.display = 'none';
        btnText.style.display = 'inline-flex';
    }
}

/* =========================================================
   RENDER DIAGNOSIS RESULTS
   ========================================================= */
function renderResults(data) {
    document.getElementById('resultsEmptyState').style.display = 'none';
    document.getElementById('resultsActiveState').style.display = 'block';

    // Title & Badges
    document.getElementById('resDiseaseName').textContent = data.display_name;

    // Severity Badge styling
    const sevBadge = document.getElementById('resSeverityBadge');
    sevBadge.textContent = `Severity: ${data.severity}`;
    sevBadge.className = 'badge-pill';
    const sevLower = (data.severity || '').toLowerCase();
    if (sevLower === 'critical') sevBadge.classList.add('badge-severity-critical');
    else if (sevLower === 'high') sevBadge.classList.add('badge-severity-high');
    else if (sevLower === 'moderate') sevBadge.classList.add('badge-severity-moderate');
    else sevBadge.classList.add('badge-severity-none');

    document.getElementById('resCategoryBadge').textContent = data.category;
    document.getElementById('resPathogenBadge').textContent = data.pathogen || 'N/A';

    // Gauge Circle
    const confVal = Math.round(data.confidence);
    document.getElementById('resGaugeValue').textContent = `${confVal}%`;
    const gaugeFill = document.getElementById('resGaugeFill');
    const maxOffset = 264;
    const strokeOffset = maxOffset - (confVal / 100) * maxOffset;
    gaugeFill.style.strokeDashoffset = strokeOffset;
    gaugeFill.style.stroke = data.is_healthy ? '#10b981' : (sevLower === 'critical' ? '#f43f5e' : '#f59e0b');

    // Description Banner
    document.getElementById('resDescriptionText').textContent = data.description;

    // Top 3 Predictions
    const predContainer = document.getElementById('resTopPredictionsList');
    predContainer.innerHTML = '';
    (data.top_predictions || []).forEach(pred => {
        const item = document.createElement('div');
        item.className = 'prediction-bar-item';
        item.innerHTML = `
            <span class="pred-bar-label" title="${pred.display_name}">${pred.display_name}</span>
            <div class="pred-bar-track">
                <div class="pred-bar-fill" style="width: ${pred.confidence}%;"></div>
            </div>
            <span class="pred-bar-value">${pred.confidence.toFixed(1)}%</span>
        `;
        predContainer.appendChild(item);
    });

    // Symptoms List
    const symList = document.getElementById('resSymptomsList');
    symList.innerHTML = '';
    (data.symptoms || []).forEach(sym => {
        const li = document.createElement('li');
        li.textContent = sym;
        symList.appendChild(li);
    });

    // Treatments
    document.getElementById('resOrganicText').textContent = data.organic_treatment || 'No specific organic treatment required.';
    document.getElementById('resChemicalText').textContent = data.chemical_treatment || 'No chemical treatment necessary.';
    document.getElementById('resPreventionText').textContent = data.prevention || 'Maintain standard good agronomic practices.';

    // Scroll slightly if mobile
    if (window.innerWidth < 1024) {
        document.getElementById('resultsCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

/* =========================================================
   DIAGNOSTIC DETAIL SUB-TABS
   ========================================================= */
function initDetailSubTabs() {
    const detailTabs = document.querySelectorAll('.detail-tab-btn');
    detailTabs.forEach(btn => {
        btn.addEventListener('click', () => {
            detailTabs.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const targetId = btn.getAttribute('data-target');
            document.querySelectorAll('.detail-panel').forEach(panel => {
                panel.classList.toggle('active', panel.id === targetId);
            });
        });
    });
}

/* =========================================================
   ERROR ALERTS
   ========================================================= */
function showErrorAlert(msg) {
    const box = document.getElementById('errorAlert');
    const text = document.getElementById('errorAlertText');
    text.textContent = msg;
    box.style.display = 'flex';
}

function hideErrorAlert() {
    const box = document.getElementById('errorAlert');
    if (box) box.style.display = 'none';
}

/* =========================================================
   STORAGE & SCAN HISTORY
   ========================================================= */
function saveScanToHistory(data) {
    try {
        let history = JSON.parse(localStorage.getItem(STORAGE_KEY_SCANS) || '[]');
        
        let thumbUrl = '';
        const previewImg = document.getElementById('previewImage');
        if (previewImg && previewImg.src) {
            thumbUrl = previewImg.src;
        }

        const record = {
            id: Date.now(),
            disease: data.prediction,
            display_name: data.display_name,
            is_healthy: data.is_healthy,
            confidence: data.confidence,
            severity: data.severity,
            engine: data.engine || 'CNN',
            date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
            thumb: thumbUrl
        };

        history.unshift(record); // Prepend newest
        if (history.length > 60) history = history.slice(0, 60);

        localStorage.setItem(STORAGE_KEY_SCANS, JSON.stringify(history));
        updateDashboard();
    } catch (e) {
        console.warn('Could not save to localStorage:', e);
    }
}

function loadScanHistory() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY_SCANS) || '[]');
    } catch (e) {
        return [];
    }
}

function clearScanHistory() {
    if (confirm('Are you sure you want to clear all scan history records?')) {
        localStorage.removeItem(STORAGE_KEY_SCANS);
        updateDashboard();
    }
}

function exportHistoryCSV() {
    const history = loadScanHistory();
    if (!history.length) {
        alert('No scan history records available to export.');
        return;
    }

    let csvContent = 'data:text/csv;charset=utf-8,ID,Date,Condition,Confidence,Severity,Healthy,Engine\n';
    history.forEach(item => {
        csvContent += `"${item.id}","${item.date}","${item.display_name}","${item.confidence}%","${item.severity}","${item.is_healthy}","${item.engine}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `tomatodoc_history_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/* =========================================================
   DASHBOARD UPDATE & DUAL CHARTS
   ========================================================= */
function updateDashboard() {
    const history = loadScanHistory();
    const count = history.length;

    // Update Pill on Navbar
    const pill = document.getElementById('scanCountPill');
    if (pill) pill.textContent = count;

    // Update KPI metrics
    const totalScansEl = document.getElementById('kpiTotalScans');
    const healthyRatioEl = document.getElementById('kpiHealthyRatio');
    const healthyCountEl = document.getElementById('kpiHealthyCount');
    const diseasedCountEl = document.getElementById('kpiDiseasedCount');
    const avgConfidenceEl = document.getElementById('kpiAvgConfidence');

    // Biosecurity Banner elements
    const healthScoreValEl = document.getElementById('bannerHealthScore');
    const healthPathEl = document.getElementById('bannerHealthPath');
    const healthTitleEl = document.getElementById('bannerHealthTitle');
    const healthDescEl = document.getElementById('bannerHealthDesc');
    const riskStatusEl = document.getElementById('bannerRiskStatus');

    if (count === 0) {
        if (totalScansEl) totalScansEl.textContent = '0';
        if (healthyRatioEl) healthyRatioEl.textContent = '0%';
        if (healthyCountEl) healthyCountEl.textContent = '0 healthy plants';
        if (diseasedCountEl) diseasedCountEl.textContent = '0';
        if (avgConfidenceEl) avgConfidenceEl.textContent = '0%';

        if (healthScoreValEl) healthScoreValEl.textContent = '100%';
        if (healthPathEl) healthPathEl.setAttribute('stroke-dasharray', '100, 100');
        if (healthTitleEl) healthTitleEl.textContent = 'Crop Biosecurity: Optimal Condition';
        if (healthDescEl) healthDescEl.textContent = 'No diseased leaves scanned yet. Upload leaf samples to generate live biosecurity analytics.';
        if (riskStatusEl) {
            riskStatusEl.textContent = 'Baseline';
            riskStatusEl.className = 'stat-pill-val text-success';
        }
    } else {
        const healthyItems = history.filter(h => h.is_healthy);
        const healthyCount = healthyItems.length;
        const diseasedCount = count - healthyCount;
        const healthyRatio = Math.round((healthyCount / count) * 100);

        const totalConf = history.reduce((sum, h) => sum + (h.confidence || 0), 0);
        const avgConf = Math.round(totalConf / count);

        if (totalScansEl) totalScansEl.textContent = count;
        if (healthyRatioEl) healthyRatioEl.textContent = `${healthyRatio}%`;
        if (healthyCountEl) healthyCountEl.textContent = `${healthyCount} of ${count} healthy`;
        if (diseasedCountEl) diseasedCountEl.textContent = diseasedCount;
        if (avgConfidenceEl) avgConfidenceEl.textContent = `${avgConf}%`;

        // Calculate Biosecurity Score: Penalty for critical/high diseases
        const criticalCount = history.filter(h => h.severity === 'Critical').length;
        const highCount = history.filter(h => h.severity === 'High').length;
        let biosecurityScore = Math.max(10, Math.round(100 - (criticalCount * 25 + highCount * 12 + (diseasedCount - criticalCount - highCount) * 5)));
        if (healthyRatio === 100) biosecurityScore = 100;

        if (healthScoreValEl) healthScoreValEl.textContent = `${biosecurityScore}%`;
        if (healthPathEl) {
            healthPathEl.setAttribute('stroke-dasharray', `${biosecurityScore}, 100`);
            healthPathEl.style.stroke = biosecurityScore > 75 ? '#10b981' : (biosecurityScore > 50 ? '#f59e0b' : '#f43f5e');
        }

        if (healthTitleEl && healthDescEl && riskStatusEl) {
            if (biosecurityScore >= 80) {
                healthTitleEl.textContent = 'Crop Biosecurity: Optimal Health Index';
                healthDescEl.textContent = 'Disease prevalence is minimal. Tomato crops demonstrate strong cellular vigor and optimal chlorophyll retention.';
                riskStatusEl.textContent = 'Low Risk';
                riskStatusEl.className = 'stat-pill-val text-success';
            } else if (biosecurityScore >= 50) {
                healthTitleEl.textContent = 'Crop Biosecurity: Moderate Disease Warning';
                healthDescEl.textContent = 'Early or moderate fungal lesions detected. Apply preventive copper or neem treatments to arrest spread.';
                riskStatusEl.textContent = 'Elevated Risk';
                riskStatusEl.className = 'stat-pill-val text-warning';
            } else {
                healthTitleEl.textContent = 'Crop Biosecurity: Critical Outbreak Alert';
                healthDescEl.textContent = 'High or Critical pathogens (Late Blight / TYLCV) detected. Immediate quarantine and systemic interventions required.';
                riskStatusEl.textContent = 'Critical Alert';
                riskStatusEl.className = 'stat-pill-val text-danger';
            }
        }
    }

    // Render Recent Scans Table
    renderHistoryTable(history);

    // Render Both Charts
    renderDiseaseChart(history);
    renderSeverityChart(history);
}

function filterHistoryTable(filterType) {
    currentHistoryFilter = filterType;
    document.querySelectorAll('.history-filter-chips .filter-pill').forEach(btn => {
        btn.classList.toggle('active', btn.textContent.toLowerCase() === filterType);
    });
    renderHistoryTable(loadScanHistory());
}

function renderHistoryTable(history) {
    const tbody = document.getElementById('historyTableBody');
    if (!tbody) return;

    let filtered = history;
    if (currentHistoryFilter === 'healthy') {
        filtered = history.filter(h => h.is_healthy);
    } else if (currentHistoryFilter === 'diseased') {
        filtered = history.filter(h => !h.is_healthy);
    }

    if (!filtered.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="table-empty-td">No scans matching filter "${currentHistoryFilter}".</td></tr>`;
        return;
    }

    tbody.innerHTML = '';
    filtered.slice(0, 15).forEach((record) => {
        const tr = document.createElement('tr');
        
        const sevClass = record.severity === 'Critical' ? 'badge-severity-critical' :
                         record.severity === 'High' ? 'badge-severity-high' :
                         record.severity === 'Moderate' ? 'badge-severity-moderate' : 'badge-severity-none';

        tr.innerHTML = `
            <td>
                <img src="${record.thumb || '/static/samples/healthy.jpg'}" alt="Leaf" class="table-thumb">
            </td>
            <td>
                <strong>${record.display_name}</strong>
            </td>
            <td>
                <span class="badge-pill ${sevClass}">${record.severity}</span>
            </td>
            <td>
                <strong>${record.confidence.toFixed(1)}%</strong>
            </td>
            <td>${record.date}</td>
            <td>
                <span class="badge-accent">${record.engine || 'CNN'}</span>
            </td>
            <td>
                <button type="button" class="btn btn-ghost btn-sm text-danger" onclick="deleteHistoryRecord(${record.id})">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function deleteHistoryRecord(id) {
    let history = loadScanHistory();
    history = history.filter(item => item.id !== id);
    localStorage.setItem(STORAGE_KEY_SCANS, JSON.stringify(history));
    updateDashboard();
}

/* =========================================================
   CHART 1: DISEASE DISTRIBUTION (DONUT)
   ========================================================= */
function renderDiseaseChart(history) {
    const canvas = document.getElementById('diseaseChart');
    const emptyMsg = document.getElementById('chartEmptyMsg');
    if (!canvas) return;

    if (!history.length) {
        canvas.style.display = 'none';
        if (emptyMsg) emptyMsg.style.display = 'block';
        return;
    }

    canvas.style.display = 'block';
    if (emptyMsg) emptyMsg.style.display = 'none';

    // Count distributions
    const counts = {};
    history.forEach(item => {
        const name = item.display_name;
        counts[name] = (counts[name] || 0) + 1;
    });

    const labels = Object.keys(counts);
    const dataValues = Object.values(counts);

    const colors = [
        '#10b981', '#3b82f6', '#f59e0b', '#f43f5e', 
        '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6', 
        '#fb923c', '#e11d48'
    ];

    if (diseaseChartInstance) {
        diseaseChartInstance.destroy();
    }

    const ctx = canvas.getContext('2d');
    diseaseChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: dataValues,
                backgroundColor: colors.slice(0, labels.length),
                borderWidth: 2,
                borderColor: '#111a2e'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: '#cbd5e1',
                        font: { family: 'Plus Jakarta Sans', size: 11 },
                        padding: 10,
                        boxWidth: 10,
                        boxHeight: 10
                    }
                }
            },
            cutout: '68%'
        }
    });
}

/* =========================================================
   CHART 2: SEVERITY BREAKDOWN (BAR CHART)
   ========================================================= */
function renderSeverityChart(history) {
    const canvas = document.getElementById('severityChart');
    const emptyMsg = document.getElementById('severityEmptyMsg');
    if (!canvas) return;

    if (!history.length) {
        canvas.style.display = 'none';
        if (emptyMsg) emptyMsg.style.display = 'block';
        return;
    }

    canvas.style.display = 'block';
    if (emptyMsg) emptyMsg.style.display = 'none';

    // Count severity occurrences
    let noneCount = 0;
    let moderateCount = 0;
    let highCount = 0;
    let criticalCount = 0;

    history.forEach(item => {
        const sev = (item.severity || '').toLowerCase();
        if (sev === 'critical') criticalCount++;
        else if (sev === 'high') highCount++;
        else if (sev === 'moderate') moderateCount++;
        else noneCount++;
    });

    if (severityChartInstance) {
        severityChartInstance.destroy();
    }

    const ctx = canvas.getContext('2d');
    severityChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Healthy (None)', 'Moderate', 'High', 'Critical'],
            datasets: [{
                label: 'Plant Count',
                data: [noneCount, moderateCount, highCount, criticalCount],
                backgroundColor: ['#10b981', '#f59e0b', '#fb923c', '#f43f5e'],
                borderRadius: 6,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans', size: 11 } }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8', stepSize: 1 }
                }
            }
        }
    });
}

/* =========================================================
   DISEASE ENCYCLOPEDIA
   ========================================================= */
async function loadEncyclopedia() {
    const grid = document.getElementById('encyclopediaGrid');
    if (!grid) return;

    try {
        const res = await fetch('/api/diseases');
        const data = await res.json();
        if (data.success && data.diseases) {
            encyclopediaData = data.diseases;
            renderEncyclopediaGrid(encyclopediaData);
        }
    } catch (e) {
        console.warn('Failed to load diseases list from API:', e);
    }
}

function renderEncyclopediaGrid(diseases) {
    const grid = document.getElementById('encyclopediaGrid');
    if (!grid) return;

    grid.innerHTML = '';
    if (!diseases.length) {
        grid.innerHTML = '<p class="text-muted" style="grid-column: 1/-1; text-align: center;">No matching conditions found.</p>';
        return;
    }

    diseases.forEach(d => {
        const card = document.createElement('div');
        card.className = 'encyclo-card';

        const sevClass = d.severity === 'Critical' ? 'badge-severity-critical' :
                         d.severity === 'High' ? 'badge-severity-high' :
                         d.severity === 'Moderate' ? 'badge-severity-moderate' : 'badge-severity-none';

        const symptomsListHtml = (d.symptoms || []).map(s => `<li>${s}</li>`).join('');

        card.innerHTML = `
            <div class="encyclo-card-top">
                <div class="encyclo-badges">
                    <span class="badge-pill badge-neutral">${d.category}</span>
                    <span class="badge-pill ${sevClass}">Severity: ${d.severity}</span>
                </div>
                <h3 class="encyclo-title">${d.display_name}</h3>
                <div class="encyclo-pathogen">${d.pathogen || 'N/A'}</div>
                <p class="encyclo-desc">${d.description}</p>
                <div class="encyclo-symptoms-box">
                    <h5>Key Symptoms</h5>
                    <ul>${symptomsListHtml}</ul>
                </div>
            </div>
            <div class="encyclo-treatment-footer">
                <p><strong>Treatment:</strong> ${d.organic_treatment || d.treatment}</p>
            </div>
        `;
        grid.appendChild(card);
    });
}

function filterEncyclopedia() {
    const query = (document.getElementById('encyclopediaSearch').value || '').toLowerCase();
    const activeChip = document.querySelector('.category-filter-chips .filter-chip.active');
    const cat = activeChip ? activeChip.getAttribute('data-cat') : 'all';

    const filtered = encyclopediaData.filter(d => {
        const matchCat = (cat === 'all' || d.category.toLowerCase() === cat.toLowerCase());
        const matchQuery = !query || 
            d.display_name.toLowerCase().includes(query) ||
            (d.pathogen && d.pathogen.toLowerCase().includes(query)) ||
            (d.description && d.description.toLowerCase().includes(query)) ||
            ((d.symptoms || []).some(s => s.toLowerCase().includes(query)));
        return matchCat && matchQuery;
    });

    renderEncyclopediaGrid(filtered);
}

function filterCategory(cat) {
    document.querySelectorAll('.category-filter-chips .filter-chip').forEach(c => {
        c.classList.toggle('active', c.getAttribute('data-cat') === cat);
    });
    filterEncyclopedia();
}

/* =========================================================
   REPORT PRINTING
   ========================================================= */
function printReport() {
    window.print();
}

/* =========================================================
   HELPERS
   ========================================================= */
function formatBytes(bytes, decimals = 1) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}