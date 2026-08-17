import torch
import torch.nn as nn
import torchvision.models as models
import torchvision.transforms as transforms
from PIL import Image
import numpy as np
import faiss
import os
import json
import cv2

# 1. Initialize Deep Learning Model (Fine-tuned Metric Learning or Pre-trained Fallback)
WEIGHTS_PATH = "tiger_stripe_resnet50.pth"
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

if os.path.exists(WEIGHTS_PATH):
    print(f"Loading custom fine-tuned Tiger Stripe Model from '{WEIGHTS_PATH}' on {device}...")
    resnet = models.resnet50(weights=None)
    model = nn.Sequential(*list(resnet.children())[:-1])
    state_dict = torch.load(WEIGHTS_PATH, map_location=device)
    model.load_state_dict(state_dict)
else:
    print(f"Loading ImageNet pre-trained ResNet50 (Fine-tuned '{WEIGHTS_PATH}' not found, using baseline)...")
    weights = models.ResNet50_Weights.IMAGENET1K_V2
    resnet = models.resnet50(weights=weights)
    model = nn.Sequential(*list(resnet.children())[:-1])

model.to(device)
model.eval()

transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

# 2. Initialize FAISS Database Globally with local persistence
embedding_dimension = 2048
INDEX_PATH = "data/faiss_index.bin"
DB_MAP_PATH = "data/tiger_database.json"

# Ensure data dir exists
os.makedirs("data", exist_ok=True)

if os.path.exists(INDEX_PATH) and os.path.exists(DB_MAP_PATH):
    print("Loading existing FAISS index and tiger database mapping...")
    try:
        index = faiss.read_index(INDEX_PATH)
        with open(DB_MAP_PATH, "r") as f:
            tiger_database = json.load(f)
    except Exception as e:
        print(f"Error loading index, reinitializing: {e}")
        index = faiss.IndexFlatL2(embedding_dimension)
        tiger_database = []
else:
    print("Creating new FAISS index and tiger database mapping...")
    index = faiss.IndexFlatL2(embedding_dimension)
    tiger_database = [] # Maps FAISS index rows to string IDs (e.g., "T-001")

def isolate_flank(image, bbox):
    """
    Crops the tiger's flank region out of the bounding box using aspect-ratio heuristics.
    - bbox: [x_min, y_min, x_max, y_max] in pixels
    """
    left, upper, right, lower = bbox
    w = right - left
    h = lower - upper
    
    # Aspect-ratio-aware cropping to target the side torso (flank)
    if w >= h:
        # Horizontal profile: Tiger is stretched horizontally. Target the middle torso.
        crop_left = left + int(w * 0.25)
        crop_right = left + int(w * 0.75)
        crop_upper = upper + int(h * 0.20)
        crop_lower = upper + int(h * 0.80)
    else:
        # Vertical profile: Tiger is vertical/walking towards camera. Torso is upper-middle.
        crop_left = left + int(w * 0.20)
        crop_right = left + int(w * 0.80)
        crop_upper = upper + int(h * 0.30)
        crop_lower = upper + int(h * 0.70)
        
    # Boundary checks to prevent cropping outside the image
    crop_left = max(0, min(crop_left, image.width - 1))
    crop_right = max(crop_left + 1, min(crop_right, image.width))
    crop_upper = max(0, min(crop_upper, image.height - 1))
    crop_lower = max(crop_upper + 1, min(crop_lower, image.height))
    
    return image.crop((crop_left, crop_upper, crop_right, crop_lower))

def preprocess_stripes(flank_image):
    """
    Applies grayscale, CLAHE contrast enhancement, bilateral noise filtering, 
    and adaptive binarization to isolate high-frequency stripe patterns.
    Returns a stacked 3-channel PIL image containing optimized stripe information.
    """
    # Convert PIL Image to a single-channel grayscale numpy array
    gray = np.array(flank_image.convert('L'))
    
    # 1. CLAHE (Contrast Limited Adaptive Histogram Equalization)
    # Enhances localized stripe contrast (dark stripes vs. orange/light fur)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)
    
    # 2. Bilateral Filter
    # Smooths out fine textures (fur/background noise) but preserves strong stripe edges
    smoothed = cv2.bilateralFilter(enhanced, d=9, sigmaColor=75, sigmaSpace=75)
    
    # 3. Adaptive Thresholding
    # Isolates stripe line patterns under varying lighting conditions
    binary = cv2.adaptiveThreshold(
        smoothed, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
        cv2.THRESH_BINARY_INV, 11, 2
    )
    
    # Stack: Ch1: Grayscale, Ch2: CLAHE-Enhanced, Ch3: Binarized Stripe Mask
    stacked = np.stack([gray, smoothed, binary], axis=-1)
    
    # Convert back to PIL Image (which torchvision expects as a 3-channel RGB image)
    return Image.fromarray(stacked)

def extract_features(image_path, bbox=None):
    """
    Isolates the flank and extracts a normalized 2048-dimensional ResNet-50 embedding.
    """
    image = Image.open(image_path).convert('RGB')
    filename = os.path.basename(image_path)
    
    # Task 2: Flank Isolation
    if bbox is not None:
        # 1. Save cropped body image
        body = image.crop((bbox[0], bbox[1], bbox[2], bbox[3]))
        cropped_dir = "data/cropped"
        os.makedirs(cropped_dir, exist_ok=True)
        body.save(os.path.join(cropped_dir, filename))
        
        # 2. Save isolated flank image
        flank = isolate_flank(image, bbox)
        flanks_dir = "data/flanks"
        os.makedirs(flanks_dir, exist_ok=True)
        flank.save(os.path.join(flanks_dir, filename))
    else:
        flank = image
        
    tensor = transform(flank).unsqueeze(0).to(device)
    
    with torch.no_grad():
        features = model(tensor)
        
    vector = features.squeeze().cpu().numpy()
    
    # Normalize features for cosine similarity (L2 distance on normalized vectors = Cosine)
    norm = np.linalg.norm(vector)
    if norm > 0:
        vector = vector / norm
    return vector

def match_tiger(file_path, bbox=None, auto_match_threshold=0.20, enroll_threshold=0.45):
    """
    Compares image to database. 
    Returns: (tiger_id, distance_score, status, message, embedding_list)
    - status: 'success' (auto matched), 'pending_review' (ambiguous), 'enrolled' (new tiger)
    """
    vector = extract_features(file_path, bbox)
    vector_list = vector.tolist()
    
    # If the database is completely empty, enroll the first tiger
    if index.ntotal == 0:
        new_id = "T-001"
        index.add(np.array([vector]))
        tiger_database.append(new_id)
        
        # Persist locally as cache
        faiss.write_index(index, INDEX_PATH)
        with open(DB_MAP_PATH, "w") as f:
            json.dump(tiger_database, f)
            
        return new_id, 0.0, "enrolled", "First individual enrolled", vector_list
        
    # Search the existing database
    distances, indices = index.search(np.array([vector]), 1)
    best_distance = float(distances[0][0])
    best_match_idx = int(indices[0][0])
    matched_id = tiger_database[best_match_idx]
    
    if best_distance <= auto_match_threshold:
        # Confident match - update FAISS database cache
        index.add(np.array([vector]))
        tiger_database.append(matched_id)
        faiss.write_index(index, INDEX_PATH)
        with open(DB_MAP_PATH, "w") as f:
            json.dump(tiger_database, f)
        return matched_id, best_distance, "success", f"Auto-matched with {matched_id}", vector_list
        
    elif best_distance <= enroll_threshold:
        # Ambiguous match - surface for human review
        return matched_id, best_distance, "pending_review", f"Ambiguous match. Close to {matched_id}", vector_list
        
    else:
        # Distance is too high; enroll as a new individual
        unique_tigers = set(tiger_database)
        new_id = f"T-{len(unique_tigers) + 1:03d}"
        
        index.add(np.array([vector]))
        tiger_database.append(new_id)
        
        # Persist index and mapping locally
        faiss.write_index(index, INDEX_PATH)
        with open(DB_MAP_PATH, "w") as f:
            json.dump(tiger_database, f)
            
        return new_id, best_distance, "enrolled", f"New individual enrolled: {new_id}", vector_list

def enroll_manually(file_path, bbox, custom_id):
    """Enrolls a tiger with a specific custom ID (used when resolving reviews or manual enrolment)."""
    vector = extract_features(file_path, bbox)
    index.add(np.array([vector]))
    tiger_database.append(custom_id)
    
    # Persist index and mapping
    faiss.write_index(index, INDEX_PATH)
    with open(DB_MAP_PATH, "w") as f:
        json.dump(tiger_database, f)
    return vector.tolist()

def add_embedding_to_faiss(vector, tiger_id):
    """Adds a pre-extracted embedding vector to FAISS and updates the local cache."""
    if isinstance(vector, list):
        vector = np.array(vector, dtype=np.float32)
    if vector.ndim == 1:
        vector = np.expand_dims(vector, axis=0)
    index.add(vector)
    tiger_database.append(tiger_id)
    faiss.write_index(index, INDEX_PATH)
    with open(DB_MAP_PATH, "w") as f:
        json.dump(tiger_database, f)

def sync_faiss_with_database():
    """Queries all captures from Supabase and rebuilds the FAISS index."""
    global index, tiger_database
    print("Synchronizing FAISS index with Supabase captures...")
    try:
        from src.db import get_db
        db = get_db()
        # Fetch all processed captures that have non-null embeddings
        res = db.table("captures").select("tiger_id, embedding, status").not_.is_("embedding", "null").execute()
        rows = res.data
        
        if rows:
            new_index = faiss.IndexFlatL2(embedding_dimension)
            new_db_map = []
            vectors = []
            
            for row in rows:
                emb = row.get("embedding")
                tiger_id = row.get("tiger_id")
                if emb and tiger_id:
                    if isinstance(emb, str):
                        try:
                            emb = json.loads(emb)
                        except:
                            continue
                    if isinstance(emb, list) and len(emb) == embedding_dimension:
                        vectors.append(emb)
                        new_db_map.append(tiger_id)
                        
            if vectors:
                new_index.add(np.array(vectors, dtype=np.float32))
                index = new_index
                tiger_database = new_db_map
                print(f"FAISS index successfully rebuilt from Supabase. Total entries: {index.ntotal}")
                
                # Save locally as cache/backup
                faiss.write_index(index, INDEX_PATH)
                with open(DB_MAP_PATH, "w") as f:
                    json.dump(tiger_database, f)
                return
                
        print("No embeddings found in Supabase. Using local cache.")
    except Exception as e:
        print(f"Failed to sync FAISS with Supabase: {e}. Using local cache.")

# Run synchronization at module load time
sync_faiss_with_database()