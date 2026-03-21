import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
from tensorflow.keras.preprocessing.image import ImageDataGenerator
import numpy as np
import matplotlib.pyplot as plt
import os

# Configuration
IMG_SIZE = 128
BATCH_SIZE = 32
EPOCHS = 25
LEARNING_RATE = 0.001

# Dataset paths (modify these according to your dataset location)
TRAIN_DIR = r'D:\My project\TOMATO DISEASE DETECTION\PlantVillage'
VAL_DIR = r'D:\My project\TOMATO DISEASE DETECTION\PlantVillage'
TEST_DIR = r'D:\My project\TOMATO DISEASE DETECTION\PlantVillage'

# Disease classes (matching actual folder names in PlantVillage)
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

def create_data_generators():
    """Create data generators with augmentation for training"""
    
    # Training data augmentation
    train_datagen = ImageDataGenerator(
        rescale=1./255,
        rotation_range=20,
        width_shift_range=0.2,
        height_shift_range=0.2,
        shear_range=0.2,
        zoom_range=0.2,
        horizontal_flip=True,
        fill_mode='nearest'
    )
    
    # Validation and test data (only rescaling)
    val_test_datagen = ImageDataGenerator(rescale=1./255)
    
    # Create generators
    train_generator = train_datagen.flow_from_directory(
        TRAIN_DIR,
        target_size=(IMG_SIZE, IMG_SIZE),
        batch_size=BATCH_SIZE,
        class_mode='categorical',
        classes=DISEASE_CLASSES
    )
    
    val_generator = val_test_datagen.flow_from_directory(
        VAL_DIR,
        target_size=(IMG_SIZE, IMG_SIZE),
        batch_size=BATCH_SIZE,
        class_mode='categorical',
        classes=DISEASE_CLASSES
    )
    
    test_generator = val_test_datagen.flow_from_directory(
        TEST_DIR,
        target_size=(IMG_SIZE, IMG_SIZE),
        batch_size=BATCH_SIZE,
        class_mode='categorical',
        classes=DISEASE_CLASSES,
        shuffle=False
    )
    
    return train_generator, val_generator, test_generator

def create_cnn_model(num_classes=10):
    """Create CNN model architecture"""
    
    model = keras.Sequential([
        # First Convolutional Block
        layers.Conv2D(32, (3, 3), activation='relu', input_shape=(IMG_SIZE, IMG_SIZE, 3)),
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
    
    return model

def plot_training_history(history):
    """Plot training and validation accuracy/loss"""
    
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(15, 5))
    
    # Plot accuracy
    ax1.plot(history.history['accuracy'], label='Training Accuracy')
    ax1.plot(history.history['val_accuracy'], label='Validation Accuracy')
    ax1.set_title('Model Accuracy')
    ax1.set_xlabel('Epoch')
    ax1.set_ylabel('Accuracy')
    ax1.legend()
    ax1.grid(True)
    
    # Plot loss
    ax2.plot(history.history['loss'], label='Training Loss')
    ax2.plot(history.history['val_loss'], label='Validation Loss')
    ax2.set_title('Model Loss')
    ax2.set_xlabel('Epoch')
    ax2.set_ylabel('Loss')
    ax2.legend()
    ax2.grid(True)
    
    plt.tight_layout()
    plt.savefig('training_history.png')
    print("Training history plot saved as 'training_history.png'")

def train_model():
    """Main training function"""
    
    print("=" * 60)
    print("Tomato Disease Detection - Model Training")
    print("=" * 60)
    
    # Check if dataset exists
    if not os.path.exists(TRAIN_DIR):
        print("\n⚠️  ERROR: Dataset not found!")
        print(f"Please download the PlantVillage dataset and organize it as:")
        print(f"  {TRAIN_DIR}/")
        print(f"    - Bacterial_Spot/")
        print(f"    - Early_Blight/")
        print(f"    - ...")
        print(f"\nOr modify TRAIN_DIR, VAL_DIR, TEST_DIR in this script.")
        return
    
    # Create data generators
    print("\n1. Creating data generators...")
    train_gen, val_gen, test_gen = create_data_generators()
    
    print(f"   Training samples: {train_gen.samples}")
    print(f"   Validation samples: {val_gen.samples}")
    print(f"   Test samples: {test_gen.samples}")
    
    # Create model
    print("\n2. Creating CNN model...")
    model = create_cnn_model(len(DISEASE_CLASSES))
    
    # Compile model
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=LEARNING_RATE),
        loss='categorical_crossentropy',
        metrics=['accuracy']
    )
    
    print("\nModel Summary:")
    model.summary()
    
    # Callbacks
    callbacks = [
        keras.callbacks.ModelCheckpoint(
            'best_model.h5',
            monitor='val_accuracy',
            save_best_only=True,
            verbose=1
        ),
        keras.callbacks.ReduceLROnPlateau(
            monitor='val_loss',
            factor=0.5,
            patience=3,
            min_lr=1e-7,
            verbose=1
        ),
        keras.callbacks.EarlyStopping(
            monitor='val_loss',
            patience=5,
            restore_best_weights=True,
            verbose=1
        )
    ]
    
    # Train model
    print(f"\n3. Training model for {EPOCHS} epochs...")
    history = model.fit(
        train_gen,
        epochs=EPOCHS,
        validation_data=val_gen,
        callbacks=callbacks,
        verbose=1
    )
    
    # Evaluate on test set
    print("\n4. Evaluating on test set...")
    test_loss, test_accuracy = model.evaluate(test_gen)
    print(f"   Test Accuracy: {test_accuracy*100:.2f}%")
    print(f"   Test Loss: {test_loss:.4f}")
    
    # Save final model
    print("\n5. Saving model...")
    model.save('tomato_disease_model.h5')
    print("   Model saved as 'tomato_disease_model.h5'")
    
    # Plot training history
    print("\n6. Generating training plots...")
    plot_training_history(history)
    
    print("\n" + "=" * 60)
    print("Training Complete! ✓")
    print("=" * 60)
    print("\nNext steps:")
    print("1. Copy 'tomato_disease_model.h5' to your Flask app directory")
    print("2. Run 'python app.py' to start the web application")
    print("=" * 60)

if __name__ == '__main__':
    # Set random seeds for reproducibility
    np.random.seed(42)
    tf.random.set_seed(42)
    
    train_model()