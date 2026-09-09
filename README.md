# 🍅 Tomato Leaf Disease Detection System

[![Python 3.11](https://img.shields.io/badge/Python-3.11.9-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-3.1-black?style=for-the-badge&logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![TensorFlow](https://img.shields.io/badge/TensorFlow-2.x-FF6F00?style=for-the-badge&logo=tensorflow&logoColor=white)](https://www.tensorflow.org/)
[![Render](https://img.shields.io/badge/Deploy%20on-Render-46E3B7?style=for-the-badge&logo=render&logoColor=white)](https://render.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

An intelligent, deep-learning-powered web application built to identify, diagnose, and prescribe treatments for **10 different tomato leaf conditions and diseases** from leaf photographs in real-time.

---

## 🌟 Key Features

- **🧠 Deep Learning Engine:** Custom Convolutional Neural Network (CNN) trained on the **PlantVillage** dataset, achieving high diagnostic accuracy.
- **⚡ Real-Time Predictions:** Instant identification with confidence metrics and Top-3 differential diagnoses.
- **🛡️ Comprehensive Treatment Guides:** Every diagnosis delivers:
  - Scientific Pathogen details & Disease Severity
  - Organic / Bio-treatment remedies
  - Recommended chemical interventions
  - Preventative cultural practices
- **📸 Flexible Input Modes:** Drag-and-drop file upload, file explorer selection, sample image presets, or direct device camera capture.
- **🛡️ Smart Image Validation:** Pre-inference heuristic validation checks for lighting, blur, and verifies whether the uploaded image is actually a plant leaf.
- **🎨 Premium Dark Theme UI:** Modern, responsive single-page application (SPA) with glassmorphism aesthetics and zero clutter.
- **🚀 Production Ready:** Configured for cloud deployment on **Render**, **Hugging Face**, or Docker containers using Gunicorn.

---

## 🦠 Detectable Diseases (10 Classes)

| # | Disease Name | Category | Severity | Pathogen |
|---|-------------|----------|----------|----------|
| 1 | **Bacterial Spot** | Bacterial | High | *Xanthomonas campestris pv. vesicatoria* |
| 2 | **Early Blight** | Fungal | Moderate | *Alternaria solani* |
| 3 | **Late Blight** | Oomycete / Fungal | Critical | *Phytophthora infestans* |
| 4 | **Leaf Mold** | Fungal | Moderate | *Passalora fulva* |
| 5 | **Septoria Leaf Spot** | Fungal | Moderate | *Septoria lycopersici* |
| 6 | **Target Spot** | Fungal | Moderate | *Corynespora casiicola* |
| 7 | **Two-Spotted Spider Mite** | Pest / Arachnid | High | *Tetranychus urticae* |
| 8 | **Tomato Mosaic Virus (ToMV)** | Viral | High | *Tomato mosaic virus* |
| 9 | **Yellow Leaf Curl Virus (TYLCV)** | Viral | Critical | *Tomato yellow leaf curl virus* |
| 10 | **Healthy Leaf** | Optimal | None | *N/A (Clean Foliage)* |

---

## 🛠️ Technology Stack

- **Deep Learning / ML:** TensorFlow / Keras, NumPy, Pillow
- **Backend API:** Python 3.11, Flask, Werkzeug, Gunicorn
- **Frontend:** Vanilla HTML5, Modern CSS (Glassmorphism, Dark Mode, CSS Grid/Flexbox), Vanilla JavaScript (Fetch API, Canvas)
- **Deployment Platform:** Render (Linux Container) with dynamic `$PORT` support

---

## 📂 Project Structure

```text
TOMATO-LEAF-DISEASE-DETECTION/
│
├── .python-version          # Specifies Python 3.11.9 runtime for Render
├── render.yaml              # Render blueprint deployment specification
├── requirements.txt         # Production dependencies
├── app.py                   # Flask entrypoint with dynamic PORT binding
├── best_model.h5            # Pre-trained CNN model weights (~60MB)
├── train_model.py           # Model training script for PlantVillage dataset
│
├── api/
│   ├── index.py             # Core Flask application, ML inference & knowledge base
│   ├── templates/
│   │   └── index.html       # Web application UI
│   └── static/
│       ├── css/style.css    # Modern styles & responsive layout
│       ├── js/script.js     # Client-side scanner logic & API handlers
│       └── samples/         # Sample tomato leaf images for instant testing
│
├── static/                  # Root static assets fallback
├── templates/               # Root templates fallback
└── README.md                # Project documentation
```

---

## 💻 Local Setup & Installation

### 1. Prerequisites
- [Python 3.11](https://www.python.org/downloads/)
- [Git](https://git-scm.com/)

### 2. Clone the Repository
```bash
git clone https://github.com/Tushar-Jangid/Tomato-Leaf-Disease-Detection.git
cd Tomato-Leaf-Disease-Detection
```

### 3. Create a Virtual Environment
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS / Linux
python3 -m venv venv
source venv/bin/activate
```

### 4. Install Dependencies
```bash
pip install -r requirements.txt
```

### 5. Run the Application
```bash
python app.py
```
Open your browser and navigate to: **`http://localhost:5000`**

---

## ☁️ Deployment on Render

This repository is pre-configured for one-click deployment on **[Render](https://render.com)**.

1. Create a free account on [Render](https://render.com).
2. Click **New +** → **Web Service**.
3. Connect your GitHub repository: `Tomato-Leaf-Disease-Detection`.
4. Configure the service settings:
   - **Environment:** `Python`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn app:app --workers 1 --threads 4 --timeout 120`
5. Click **Deploy Web Service**.

> **Note:** Render will automatically read [.python-version](file:///.python-version) and build using **Python 3.11.9**.

---

## 🔌 API Endpoints

### 1. Predict Leaf Disease
- **Endpoint:** `POST /predict`
- **Body:** `multipart/form-data` with `file: <image_file>`
- **Response:**
```json
{
  "success": true,
  "prediction": "Tomato_Early_blight",
  "display_name": "Early Blight",
  "confidence": 96.45,
  "is_healthy": false,
  "severity": "Moderate",
  "category": "Fungal",
  "pathogen": "Alternaria solani",
  "description": "Early blight is a very common fungal disease...",
  "organic_treatment": "Prune lower foliage. Spray neem oil...",
  "chemical_treatment": "Apply fungicides containing Chlorothalonil...",
  "prevention": "Apply organic mulch around stems, water at soil level...",
  "top_predictions": [
    { "disease": "Tomato_Early_blight", "display_name": "Early Blight", "confidence": 96.45 },
    { "disease": "Tomato_Septoria_leaf_spot", "display_name": "Septoria Leaf Spot", "confidence": 2.81 },
    { "disease": "Tomato_healthy", "display_name": "Healthy Leaf", "confidence": 0.74 }
  ],
  "engine": "TensorFlow CNN"
}
```

### 2. Disease Encyclopedia
- **Endpoint:** `GET /api/diseases`
- Returns full symptoms, prevention, and treatment guides for all 10 diseases.

### 3. Service Health
- **Endpoint:** `GET /api/health`
- Returns server status, model loading state, and active engine.

---

## 👨‍💻 Author

Developed by **[Tushar Jangid](https://github.com/Tushar-Jangid)**

Contributions, bug reports, and feature requests are welcome! If you find this project useful, feel free to give it a ⭐️ on GitHub!
