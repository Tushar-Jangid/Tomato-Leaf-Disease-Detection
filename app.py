from flask import Flask, render_template, request, jsonify
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
import numpy as np
from PIL import Image
import io
import os
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
app.config['UPLOAD_FOLDER'] = 'uploads'

# Create uploads folder if it doesn't exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Disease classes based on PlantVillage dataset (matching folder names)
DISEASE_CLASSES = [
    'Tomato_Bacterial_spot',
    'Tomato_Early_blight',
    'Tomato_healthy',
    'Tomato_Late_blight',
    'Tomato_Leaf_Mold',
    'Tomato_Septoria_leaf_spot',
    'Tomato_Spider_mites_Two_spotted_spider_mite',
    'Tomato__Target_Spot',
    'Tomato__Tomato_mosaic_virus',
    'Tomato__Tomato_YellowLeaf__Curl_Virus'
]

# Display names for UI
DISPLAY_NAMES = {
    'Tomato_Bacterial_spot': 'Bacterial Spot',
    'Tomato_Early_blight': 'Early Blight',
    'Tomato_healthy': 'Healthy',
    'Tomato_Late_blight': 'Late Blight',
    'Tomato_Leaf_Mold': 'Leaf Mold',
    'Tomato_Septoria_leaf_spot': 'Septoria Leaf Spot',
    'Tomato_Spider_mites_Two_spotted_spider_mite': 'Spider Mites',
    'Tomato__Target_Spot': 'Target Spot',
    'Tomato__Tomato_mosaic_virus': 'Tomato Mosaic Virus',
    'Tomato__Tomato_YellowLeaf__Curl_Virus': 'Tomato Yellow Leaf Curl Virus'
}

# Disease descriptions and treatments (matching DISEASE_CLASSES keys)
DISEASE_INFO = {
    'Tomato_Bacterial_spot': {
        'description': 'Bacterial spot is caused by Xanthomonas bacteria. It causes dark, greasy-looking spots on leaves and fruits.',
        'treatment': 'Use copper-based fungicides, remove infected plants, practice crop rotation, and avoid overhead watering.'
    },
    'Tomato_Early_blight': {
        'description': 'Early blight is a fungal disease causing brown spots with concentric rings on older leaves.',
        'treatment': 'Apply fungicides containing chlorothalonil or mancozeb, remove affected leaves, ensure good air circulation.'
    },
    'Tomato_Late_blight': {
        'description': 'Late blight is a serious fungal disease that can destroy entire crops quickly.',
        'treatment': 'Use fungicides immediately, remove infected plants, avoid watering late in the day, ensure proper spacing.'
    },
    'Tomato_Leaf_Mold': {
        'description': 'Leaf mold is a fungal disease that thrives in humid conditions, causing yellow spots on upper leaf surfaces.',
        'treatment': 'Improve air circulation, reduce humidity, apply fungicides, remove infected leaves promptly.'
    },
    'Tomato_Septoria_leaf_spot': {
        'description': 'Septoria leaf spot causes small, circular spots with gray centers and dark borders on leaves.',
        'treatment': 'Remove infected leaves, apply fungicides, mulch around plants, practice crop rotation.'
    },
    'Tomato_Spider_mites_Two_spotted_spider_mite': {
        'description': 'Spider mites are tiny pests that cause stippling and yellowing of leaves, with fine webbing.',
        'treatment': 'Use insecticidal soap or neem oil, spray with water to dislodge mites, introduce predatory mites.'
    },
    'Tomato__Target_Spot': {
        'description': 'Target spot creates concentric ring patterns on leaves, stems, and fruits.',
        'treatment': 'Apply appropriate fungicides, remove debris, ensure good drainage and air circulation.'
    },
    'Tomato__Tomato_YellowLeaf__Curl_Virus': {
        'description': 'This viral disease causes yellowing and upward curling of leaves, stunted growth.',
        'treatment': 'Control whitefly vectors, remove infected plants immediately, use resistant varieties.'
    },
    'Tomato__Tomato_mosaic_virus': {
        'description': 'Tomato mosaic virus causes mottled light and dark green patterns on leaves.',
        'treatment': 'Remove infected plants, disinfect tools, control aphid vectors, use virus-free seeds.'
    },
    'Tomato_healthy': {
        'description': 'Your tomato plant appears healthy with no signs of disease!',
        'treatment': 'Continue regular care: proper watering, fertilization, and monitoring for early signs of issues.'
    }
}

def is_valid_leaf_image(image, min_green_ratio=0.08, max_green_ratio=0.85):

    try:
        # Resize for faster processing
        img = image.resize((100, 100))
        img_array = np.array(img)
        
        # Convert to RGB if needed
        if len(img_array.shape) == 2:
            img_array = np.stack([img_array]*3, axis=-1)
        elif img_array.shape[2] == 4:
            img_array = img_array[:,:,:3]
        
        # Calculate color ratios
        r, g, b = img_array[:,:,0], img_array[:,:,1], img_array[:,:,2]
        
        # Green pixel detection: G > R and G > B
        green_mask = (g > r) & (g > b)
        green_ratio = np.sum(green_mask) / green_mask.size
        
        # Check if too much green (could be grass/lawn)
        very_green = (g > 150) & (r < 100) & (b < 100)
        very_green_ratio = np.sum(very_green) / very_green.size
        
        # Check for brown/yellow dominant (dead leaf or non-plant)
        brown_yellow = (r > g) & (r > b) & (r > 100)
        brown_ratio = np.sum(brown_yellow) / brown_yellow.size
        
        # Check brightness (not too dark or too bright)
        brightness = (r.astype(float) + g.astype(float) + b.astype(float)) / 3
        avg_brightness = np.mean(brightness)
        
        # Validation logic
        if green_ratio < min_green_ratio:
            return False, "This doesn't appear to be a plant leaf. Please upload a tomato leaf image."
        
        if green_ratio > max_green_ratio:
            return False, "This appears to be grass or lawn. Please upload a tomato leaf image."
        
        if very_green_ratio > 0.7:
            return False, "This appears to be grass. Please upload a tomato leaf image."
        
        if brown_ratio > 0.6:
            return False, "This appears to be a dead/dry leaf. Please upload a fresh tomato leaf image."
        
        if avg_brightness < 30:
            return False, "Image is too dark. Please upload a clearer tomato leaf image."
        
        if avg_brightness > 240:
            return False, "Image is too bright. Please upload a clearer tomato leaf image."
        
        return True, "Valid leaf image"
        
    except Exception as e:
        # If analysis fails, allow the image to pass (fail-safe)
        return True, "Could not analyze, allowing prediction"

# Load or create model
MODEL_PATH = r'D:\My project\TOMATO DISEASE DETECTION\best_model.h5'

def create_cnn_model(num_classes=10):
    model = keras.Sequential([
        # First Convolutional Block
        layers.Conv2D(32, (3, 3), activation='relu', input_shape=(128, 128, 3)),
        layers.BatchNormalization(),
        layers.MaxPooling2D((2, 2)),
        
        # Second Convolutional Block
        layers.Conv2D(64, (3, 3), activation='relu'),
        layers.BatchNormalization(),
        layers.MaxPooling2D((2, 2)),
        
        # Third Convolutional Block
        layers.Conv2D(128, (3, 3), activation='relu'),
        layers.BatchNormalization(),
        layers.MaxPooling2D((2, 2)),
        
        # Fourth Convolutional Block
        layers.Conv2D(256, (3, 3), activation='relu'),
        layers.BatchNormalization(),
        layers.MaxPooling2D((2, 2)),
        
        # Flatten and Dense Layers
        layers.Flatten(),
        layers.Dense(512, activation='relu'),
        layers.Dropout(0.5),
        layers.Dense(256, activation='relu'),
        layers.Dropout(0.3),
        layers.Dense(num_classes, activation='softmax')
    ])
    
    model.compile(
        optimizer='adam',
        loss='categorical_crossentropy',
        metrics=['accuracy']
    )
    
    return model

# Initialize model
try:
    model = keras.models.load_model(MODEL_PATH)
    print("Model loaded successfully!")
except:
    print("Creating new model...")
    model = create_cnn_model(len(DISEASE_CLASSES))
    print("New model created. Train the model using train_model.py before making predictions.")

def preprocess_image(image):
    """Preprocess image for model prediction"""
    # Resize image to 128x128
    image = image.resize((128, 128))
    # Convert to array
    img_array = np.array(image)
    # Normalize pixel values
    img_array = img_array / 255.0
    # Add batch dimension
    img_array = np.expand_dims(img_array, axis=0)
    return img_array

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/predict', methods=['POST'])
def predict():
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if file:
        try:
            # Read and preprocess image
            image = Image.open(io.BytesIO(file.read()))
            
            # Convert to RGB if necessary
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            # Validate if it's a leaf image before processing
            is_valid, validation_message = is_valid_leaf_image(image)
            if not is_valid:
                return jsonify({
                    'success': False,
                    'error': validation_message,
                    'is_leaf': False
                }), 400
            
            # Preprocess for model
            processed_image = preprocess_image(image)
            
            # Make prediction
            predictions = model.predict(processed_image)
            predicted_class_idx = np.argmax(predictions[0])
            confidence = float(predictions[0][predicted_class_idx])
            
            predicted_disease = DISEASE_CLASSES[predicted_class_idx]
            disease_info = DISEASE_INFO[predicted_disease]
            
            # Get top 3 predictions
            top_3_idx = np.argsort(predictions[0])[-3:][::-1]
            top_predictions = [
                {
                    'disease': DISEASE_CLASSES[idx],
                    'confidence': float(predictions[0][idx]) * 100
                }
                for idx in top_3_idx
            ]
            
            return jsonify({
                'success': True,
                'prediction': predicted_disease,
                'confidence': confidence * 100,
                'description': disease_info['description'],
                'treatment': disease_info['treatment'],
                'top_predictions': top_predictions
            })
            
        except Exception as e:
            return jsonify({'error': f'Error processing image: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)