// Global variables
let selectedFile = null;

// Image input change handler
document.getElementById('imageInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        handleImageUpload(file);
    }
});

// Handle image upload
function handleImageUpload(file) {
    // Validate file type
    if (!file.type.startsWith('image/')) {
        showError('Please select a valid image file');
        return;
    }
    
    // Validate file size (max 16MB)
    if (file.size > 16 * 1024 * 1024) {
        showError('File size must be less than 16MB');
        return;
    }
    
    selectedFile = file;
    
    // Preview image
    const reader = new FileReader();
    reader.onload = function(e) {
        const preview = document.getElementById('imagePreview');
        const previewImg = document.getElementById('previewImg');
        previewImg.src = e.target.result;
        preview.style.display = 'block';
        
        // Show analyze button
        document.getElementById('analyzeBtn').style.display = 'block';
        
        // Hide results and errors
        document.getElementById('resultsSection').style.display = 'none';
        document.getElementById('errorMessage').style.display = 'none';
    };
    reader.readAsDataURL(file);
}

// Remove image
function removeImage() {
    selectedFile = null;
    document.getElementById('imageInput').value = '';
    document.getElementById('imagePreview').style.display = 'none';
    document.getElementById('analyzeBtn').style.display = 'none';
    document.getElementById('resultsSection').style.display = 'none';
}

// Analyze image
async function analyzeImage() {
    if (!selectedFile) {
        showError('Please select an image first');
        return;
    }
    
    const analyzeBtn = document.getElementById('analyzeBtn');
    const btnText = analyzeBtn.querySelector('.btn-text');
    const loader = analyzeBtn.querySelector('.loader');
    
    // Show loading state
    analyzeBtn.disabled = true;
    btnText.textContent = 'Analyzing...';
    loader.style.display = 'inline-block';
    
    // Hide previous results and errors
    document.getElementById('resultsSection').style.display = 'none';
    document.getElementById('errorMessage').style.display = 'none';
    
    // Create form data
    const formData = new FormData();
    formData.append('file', selectedFile);
    
    try {
        const response = await fetch('/predict', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            displayResults(data);
        } else if (data.is_leaf === false) {
            // Custom error for invalid leaf images
            showError(data.error || 'Invalid image');
        } else {
            showError(data.error || 'An error occurred during analysis');
        }
    } catch (error) {
        showError('Failed to connect to the server. Please try again.');
        console.error('Error:', error);
    } finally {
        // Reset button state
        analyzeBtn.disabled = false;
        btnText.textContent = 'Analyze Image';
        loader.style.display = 'none';
    }
}

// Display results
function displayResults(data) {
    // Show results section
    document.getElementById('resultsSection').style.display = 'block';
    
    // Set health status
    const healthStatus = document.getElementById('healthStatus');
    const isHealthy = data.prediction.includes('healthy');
    healthStatus.textContent = isHealthy ? '✓ Healthy' : '⚠ Disease Detected';
    healthStatus.className = 'health-status ' + (isHealthy ? 'status-healthy' : 'status-diseased');
    
    // Set disease name
    const diseaseName = data.prediction.replace(/_/g, ' ');
    document.getElementById('diseaseName').textContent = diseaseName;
    
    // Set confidence
    const confidence = data.confidence.toFixed(2);
    document.getElementById('confidence').textContent = `Confidence: ${confidence}%`;
    
    // Update progress circle
    updateProgressCircle(data.confidence);
    
    // Set description and treatment
    document.getElementById('diseaseDescription').textContent = data.description;
    document.getElementById('diseaseTreatment').textContent = data.treatment;
    
    // Display top predictions
    displayTopPredictions(data.top_predictions);
    
    // Scroll to results
    setTimeout(() => {
        document.getElementById('resultsSection').scrollIntoView({ 
            behavior: 'smooth', 
            block: 'nearest' 
        });
    }, 100);
}

// Update progress circle
function updateProgressCircle(percentage) {
    const circle = document.getElementById('progressRingFill');
    const text = document.getElementById('progressText');
    
    const radius = 52;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;
    
    // Animate the circle
    setTimeout(() => {
        circle.style.strokeDashoffset = offset;
        
        // Change color based on confidence
        if (percentage >= 80) {
            circle.style.stroke = '#51cf66';
        } else if (percentage >= 60) {
            circle.style.stroke = '#ffd43b';
        } else {
            circle.style.stroke = '#ff6b6b';
        }
    }, 100);
    
    // Animate the percentage text
    animateValue(text, 0, percentage, 1000);
}

// Animate number value
function animateValue(element, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const value = Math.floor(progress * (end - start) + start);
        element.textContent = value + '%';
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

// Display top predictions
function displayTopPredictions(predictions) {
    const container = document.getElementById('topPredictions');
    container.innerHTML = '';
    
    predictions.forEach((pred, index) => {
        const item = document.createElement('div');
        item.className = 'prediction-item';
        item.style.animationDelay = `${index * 0.1}s`;
        
        const name = document.createElement('span');
        name.className = 'prediction-name';
        name.textContent = `${index + 1}. ${pred.disease.replace(/_/g, ' ')}`;
        
        const confidence = document.createElement('span');
        confidence.className = 'prediction-confidence';
        confidence.textContent = `${pred.confidence.toFixed(2)}%`;
        
        item.appendChild(name);
        item.appendChild(confidence);
        container.appendChild(item);
    });
}

// Show error message
function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');
    
    errorText.textContent = message;
    errorDiv.style.display = 'block';
    
    // Scroll to error
    setTimeout(() => {
        errorDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

// Reset analysis
function resetAnalysis() {
    removeImage();
    document.getElementById('resultsSection').style.display = 'none';
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Drag and drop functionality
const uploadCard = document.querySelector('.upload-card');

uploadCard.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadCard.style.background = '#f8f9fa';
    uploadCard.style.borderColor = '#667eea';
});

uploadCard.addEventListener('dragleave', (e) => {
    e.preventDefault();
    uploadCard.style.background = 'white';
});

uploadCard.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadCard.style.background = 'white';
    
    const file = e.dataTransfer.files[0];
    if (file) {
        handleImageUpload(file);
    }
});