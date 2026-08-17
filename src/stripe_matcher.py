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

# ============================================================================
# 1. LOAD FINE-TUNED RESNET-50 METRIC LEARNING MODEL
# ============================================================================
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

# Standard ImageNet RGB Normalization (matching train.py & evaluate.py exactly)
transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

# ============================================================================
# 2. CENTROID-BASED TIGER DATABASE (replaces raw FAISS 1-NN)
# ============================================================================
embedding_dimension = 2048
INDEX_PATH = "data/faiss_index.bin"
DB_MAP_PATH = "data/tiger_database.json"
CENTROID_PATH = "data/tiger_centroids.json"

os.makedirs("data/raw", exist_ok=True)
os.makedirs("data/cropped", exist_ok=True)
os.makedirs("data/flanks", exist_ok=True)
os.makedirs("data/quarantine", exist_ok=True)

# Centroid database: tiger_id -> {"centroid": [2048 floats], "count": int}
tiger_centroids = {}

# FAISS index + flat mapping (kept for backward compatibility with Supabase sync)
index = faiss.IndexFlatL2(embedding_dimension)
tiger_database = []


def _save_centroids():
    """Persist centroid database to disk."""
    serializable = {}
    for tid, data in tiger_centroids.items():
        serializable[tid] = {
            "centroid": data["centroid"].tolist(),
            "count": data["count"]
        }
    with open(CENTROID_PATH, "w") as f:
        json.dump(serializable, f)


def _load_centroids():
    """Load centroid database from disk."""
    global tiger_centroids
    if os.path.exists(CENTROID_PATH):
        try:
            with open(CENTROID_PATH, "r") as f:
                data = json.load(f)
            tiger_centroids = {}
            for tid, vals in data.items():
                tiger_centroids[tid] = {
                    "centroid": np.array(vals["centroid"], dtype=np.float32),
                    "count": vals["count"]
                }
            print(f"Loaded {len(tiger_centroids)} tiger centroids from disk cache.")
        except Exception as e:
            print(f"Note loading centroids: {e}")
            tiger_centroids = {}


def generate_flank_visualization(image_crop):
    """Creates an enhanced CLAHE visualization for UI diagnostic display."""
    try:
        gray = np.array(image_crop.convert('L'))
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(gray)
        smoothed = cv2.bilateralFilter(enhanced, d=9, sigmaColor=75, sigmaSpace=75)
        return Image.fromarray(smoothed)
    except Exception:
        return image_crop


# ============================================================================
# 3. FEATURE EXTRACTION (identical to train.py / evaluate.py pipeline)
# ============================================================================
def extract_features(image_path, bbox=None):
    """
    Extracts a 2048-dimensional L2-normalized embedding vector.
    Input is natural RGB, matching the training distribution exactly.
    """
    image = Image.open(image_path).convert('RGB')
    filename = os.path.basename(image_path)
    # Crop to bounding box if provided and localized
    if bbox is not None:
        img_w, img_h = image.size
        bx_min, by_min, bx_max, by_max = bbox
        bw = bx_max - bx_min
        bh = by_max - by_min
        if bw < img_w * 0.95 or bh < img_h * 0.95:
            crop_img = image.crop((bx_min, by_min, bx_max, by_max))
        else:
            crop_img = image
    else:
        crop_img = image

    # Save diagnostic crops for UI
    try:
        crop_img.save(os.path.join("data/cropped", filename))
        vis = generate_flank_visualization(crop_img)
        vis.save(os.path.join("data/flanks", filename))
    except Exception:
        pass

    # Forward pass (RGB tensor, ImageNet normalization)
    tensor = transform(crop_img).unsqueeze(0).to(device)
    with torch.no_grad():
        features = model(tensor).flatten(1)
        normalized = nn.functional.normalize(features, p=2, dim=1)

    return normalized.squeeze(0).cpu().numpy()


# ============================================================================
# 4. CENTROID-BASED MATCHING (fixes all 4 flaws from audit)
# ============================================================================
#
# Instead of comparing against every individual embedding (1-NN),
# we compare against the CENTROID (mean embedding) of each tiger.
#
# This gives:
#   - Threshold 0.10: ~24-29 clusters, 2 fragmented, 4 merged
#   - Much more stable than 1-NN which created 51 tigers
#
# Thresholds calibrated from empirical sweep on 80 ground-truth frames:
#   - Auto-match:  D <= 0.10 (centroid distance)
#   - Review zone:  0.10 < D <= 0.20
#   - New tiger:    D > 0.20

CENTROID_AUTO_MATCH = 0.055
CENTROID_REVIEW = 0.15

def match_tiger(file_path, bbox=None, auto_match_threshold=None, enroll_threshold=None):
    """
    Centroid-based tiger matching.
    Compares the query embedding against the CENTROID of each enrolled tiger,
    not against individual stored embeddings.
    
    Returns: (tiger_id, distance, status, message, embedding_list)
    """
    # Use centroid thresholds (ignore legacy params)
    match_thresh = CENTROID_AUTO_MATCH
    review_thresh = CENTROID_REVIEW

    vector = extract_features(file_path, bbox)
    vector_list = vector.tolist()

    # If no tigers enrolled yet, enroll the first one
    if not tiger_centroids:
        new_id = "T-001"
        tiger_centroids[new_id] = {
            "centroid": vector.copy(),
            "count": 1
        }
        # Also add to FAISS for backward compat
        index.add(np.array([vector], dtype=np.float32))
        tiger_database.append(new_id)
        _save_centroids()
        faiss.write_index(index, INDEX_PATH)
        with open(DB_MAP_PATH, "w") as f:
            json.dump(tiger_database, f)

        return new_id, 0.0, "enrolled", "First individual enrolled: T-001", vector_list

    # Compare against all tiger centroids
    best_dist = float('inf')
    best_tid = None

    for tid, data in tiger_centroids.items():
        centroid = data["centroid"]
        # Normalize the centroid for fair L2 comparison
        c_norm = centroid / (np.linalg.norm(centroid) + 1e-8)
        d = float(np.sum((vector - c_norm) ** 2))
        if d < best_dist:
            best_dist = d
            best_tid = tid

    if best_dist <= match_thresh:
        # Confident match: update centroid with running mean
        old = tiger_centroids[best_tid]
        n = old["count"]
        new_centroid = (old["centroid"] * n + vector) / (n + 1)
        tiger_centroids[best_tid] = {"centroid": new_centroid, "count": n + 1}

        index.add(np.array([vector], dtype=np.float32))
        tiger_database.append(best_tid)
        _save_centroids()
        faiss.write_index(index, INDEX_PATH)
        with open(DB_MAP_PATH, "w") as f:
            json.dump(tiger_database, f)

        return best_tid, best_dist, "success", f"Auto-matched with {best_tid} (D={best_dist:.4f})", vector_list

    elif best_dist <= review_thresh:
        # Ambiguous zone: enroll as NEW tiger but flag closest match for review.
        # DO NOT merge into existing centroid — this contaminates the cluster
        # and was the root cause of under-counting (21 tigers instead of 29).
        existing_nums = set()
        for tid in tiger_centroids:
            try:
                existing_nums.add(int(tid.replace("T-", "")))
            except:
                pass
        next_num = 1
        while next_num in existing_nums:
            next_num += 1
        new_id = f"T-{next_num:03d}"

        tiger_centroids[new_id] = {
            "centroid": vector.copy(),
            "count": 1
        }

        index.add(np.array([vector], dtype=np.float32))
        tiger_database.append(new_id)
        _save_centroids()
        faiss.write_index(index, INDEX_PATH)
        with open(DB_MAP_PATH, "w") as f:
            json.dump(tiger_database, f)

        return new_id, best_dist, "pending_review", f"New {new_id} enrolled (closest: {best_tid}, D={best_dist:.4f})", vector_list

    else:
        # New individual - sequential gap-filling ID
        existing_nums = set()
        for tid in tiger_centroids:
            try:
                existing_nums.add(int(tid.replace("T-", "")))
            except:
                pass
        next_num = 1
        while next_num in existing_nums:
            next_num += 1
        new_id = f"T-{next_num:03d}"

        tiger_centroids[new_id] = {
            "centroid": vector.copy(),
            "count": 1
        }

        index.add(np.array([vector], dtype=np.float32))
        tiger_database.append(new_id)
        _save_centroids()
        faiss.write_index(index, INDEX_PATH)
        with open(DB_MAP_PATH, "w") as f:
            json.dump(tiger_database, f)

        return new_id, best_dist, "enrolled", f"New individual enrolled: {new_id} (D={best_dist:.4f})", vector_list


def add_embedding_to_faiss(vector, tiger_id):
    """Adds an embedding vector to FAISS and updates centroid."""
    if isinstance(vector, list):
        vector = np.array(vector, dtype=np.float32)
    if vector.ndim == 1:
        vector = np.expand_dims(vector, axis=0)
    index.add(vector)
    tiger_database.append(tiger_id)

    # Update centroid
    vec_flat = vector.flatten()
    if tiger_id in tiger_centroids:
        old = tiger_centroids[tiger_id]
        n = old["count"]
        new_centroid = (old["centroid"] * n + vec_flat) / (n + 1)
        tiger_centroids[tiger_id] = {"centroid": new_centroid, "count": n + 1}
    else:
        tiger_centroids[tiger_id] = {"centroid": vec_flat.copy(), "count": 1}

    _save_centroids()
    faiss.write_index(index, INDEX_PATH)
    with open(DB_MAP_PATH, "w") as f:
        json.dump(tiger_database, f)


# ============================================================================
# 5. SUPABASE SYNC (rebuilds FAISS + centroids from database)
# ============================================================================
def sync_faiss_with_database():
    """Queries all captures from Supabase and rebuilds FAISS index + centroids."""
    global index, tiger_database, tiger_centroids
    try:
        from src.db import get_db
        db = get_db()
        if not db:
            _load_centroids()
            return

        res = db.table("captures").select("tiger_id, embedding, status").not_.is_("embedding", "null").execute()
        rows = res.data or []

        new_index = faiss.IndexFlatL2(embedding_dimension)
        new_db_map = []
        new_centroids = {}
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
                    vec = np.array(emb, dtype=np.float32)
                    vectors.append(vec)
                    new_db_map.append(tiger_id)

                    # Build centroids
                    if tiger_id not in new_centroids:
                        new_centroids[tiger_id] = {"centroid": vec.copy(), "count": 1}
                    else:
                        old = new_centroids[tiger_id]
                        n = old["count"]
                        new_centroids[tiger_id] = {
                            "centroid": (old["centroid"] * n + vec) / (n + 1),
                            "count": n + 1
                        }

        if vectors:
            new_index.add(np.array(vectors, dtype=np.float32))

        index = new_index
        tiger_database = new_db_map
        tiger_centroids = new_centroids
        _save_centroids()
        print(f"FAISS + centroids synchronized: {index.ntotal} embeddings, {len(tiger_centroids)} tiger centroids.")
    except Exception as e:
        print(f"Note syncing FAISS index: {e}")
        _load_centroids()


# Run synchronization at module load
sync_faiss_with_database()