import os
import random
import pandas as pd
import numpy as np
import torch
import torch.nn as nn
import torchvision.models as models
import torchvision.transforms as transforms
from PIL import Image

def load_model(weights_path="tiger_stripe_resnet50.pth", device="cuda"):
    """Loads the fine-tuned ResNet-50 feature extractor."""
    resnet = models.resnet50(weights=None)
    model = nn.Sequential(*list(resnet.children())[:-1])
    
    if os.path.exists(weights_path):
        print(f"[OK] Loading custom weights from '{weights_path}' onto {device}...")
        state_dict = torch.load(weights_path, map_location=device)
        model.load_state_dict(state_dict)
    else:
        print(f"[WARN] '{weights_path}' not found, loading baseline ImageNet weights for comparison...")
        weights = models.ResNet50_Weights.IMAGENET1K_V2
        resnet = models.resnet50(weights=weights)
        model = nn.Sequential(*list(resnet.children())[:-1])
        
    model.to(device)
    model.eval()
    return model

def get_image_embedding(model, img_path, transform, device):
    """Extracts a normalized 2048-d embedding vector for a single image."""
    img = Image.open(img_path).convert("RGB")
    tensor = transform(img).unsqueeze(0).to(device)
    with torch.no_grad():
        feat = model(tensor).flatten(1)
        feat = nn.functional.normalize(feat, p=2, dim=1)
    return feat.squeeze(0).cpu().numpy()

def evaluate_reid_performance(
    csv_file="data/dataset1/Amur Tigers/reid_list_train.csv",
    img_dir="data/dataset1/Amur Tigers/train",
    model_path="tiger_stripe_resnet50.pth",
    device=None
):
    if device is None:
        device = "cuda" if torch.cuda.is_available() else "cpu"
        
    print("=" * 65)
    print("TIGER RE-IDENTIFICATION BENCHMARK EVALUATION")
    print(f"Device: {device} | Model: {model_path}")
    print("=" * 65)
    
    transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])
    
    model = load_model(model_path, device=device)
    
    # 1. Load dataset mapping
    df = pd.read_csv(csv_file, header=None, names=["tiger_id", "filename"], sep=r'[,\s]+', engine='python')
    
    # Group images by tiger
    tiger_to_imgs = {}
    valid_entries = 0
    for _, row in df.iterrows():
        t_id = str(row["tiger_id"]).strip()
        fname = str(row["filename"]).strip()
        fpath = os.path.join(img_dir, fname)
        if os.path.exists(fpath):
            tiger_to_imgs.setdefault(t_id, []).append((fname, fpath))
            valid_entries += 1
            
    # Filter tigers with at least 2 images for Query-Gallery matching
    eval_tigers = {t: imgs for t, imgs in tiger_to_imgs.items() if len(imgs) >= 2}
    print(f"Dataset Stats: {valid_entries} valid images across {len(eval_tigers)} multi-sighting tigers.")
    
    # 2. Extract embeddings for all evaluation images
    print("Extracting 2048-d metric learning embeddings across test pool...")
    all_features = []
    all_labels = []
    all_paths = []
    
    for t_id, imgs in eval_tigers.items():
        for fname, fpath in imgs:
            emb = get_image_embedding(model, fpath, transform, device)
            all_features.append(emb)
            all_labels.append(t_id)
            all_paths.append(fname)
            
    all_features = np.array(all_features)
    all_labels = np.array(all_labels)
    N = len(all_labels)
    
    print(f"Extracted feature matrix shape: {all_features.shape}")
    print("\nComputing pairwise distances and Re-ID rank metrics (Leave-One-Out Evaluation)...")
    
    # 3. Compute Top-1, Top-5, Top-10 Accuracy and Distance Distributions
    top1_correct = 0
    top5_correct = 0
    top10_correct = 0
    
    intra_tiger_distances = []
    inter_tiger_distances = []
    
    # Compute Cosine Distance Matrix: D = 1 - (A . B^T)
    similarity_matrix = np.dot(all_features, all_features.T)
    distance_matrix = 1.0 - similarity_matrix
    
    for i in range(N):
        query_label = all_labels[i]
        
        # Distances to all other images (excluding the query image itself)
        dists = distance_matrix[i].copy()
        dists[i] = np.inf # Exclude self
        
        # Sort indices by smallest distance
        sorted_indices = np.argsort(dists)
        
        # Check Top-K matches
        top_k_labels = all_labels[sorted_indices[:10]]
        
        if top_k_labels[0] == query_label:
            top1_correct += 1
        if query_label in top_k_labels[:5]:
            top5_correct += 1
        if query_label in top_k_labels[:10]:
            top10_correct += 1
            
        # Collect intra-class vs inter-class distances for statistics
        for j in range(i + 1, N):
            d = distance_matrix[i, j]
            if all_labels[i] == all_labels[j]:
                intra_tiger_distances.append(d)
            else:
                inter_tiger_distances.append(d)
                
    top1_acc = (top1_correct / N) * 100.0
    top5_acc = (top5_correct / N) * 100.0
    top10_acc = (top10_correct / N) * 100.0
    
    avg_intra_dist = np.mean(intra_tiger_distances) if intra_tiger_distances else 0.0
    avg_inter_dist = np.mean(inter_tiger_distances) if inter_tiger_distances else 0.0
    separation_ratio = avg_inter_dist / (avg_intra_dist + 1e-6)
    
    print("\n" + "=" * 65)
    print("TIGER STRIPE RE-IDENTIFICATION TEST RESULTS")
    print("=" * 65)
    print(f"Rank-1 (Top-1) Accuracy : {top1_acc:.2f}%  ({top1_correct}/{N})")
    print(f"Rank-5 (Top-5) Accuracy : {top5_acc:.2f}%  ({top5_correct}/{N})")
    print(f"Rank-10 (Top-10) Accuracy: {top10_acc:.2f}%  ({top10_correct}/{N})")
    print("-" * 65)
    print(f"Avg Distance (Same Tiger)       : {avg_intra_dist:.4f}  (Lower is better)")
    print(f"Avg Distance (Different Tigers)  : {avg_inter_dist:.4f}  (Higher is better)")
    print(f"Inter/Intra Separation Ratio     : {separation_ratio:.2f}x cluster separation")
    print("=" * 65)
    
    # 4. Show Top 5 Sample Match Test Queries
    print("\nSample Real-World Re-ID Queries:")
    sample_queries = random.sample(range(N), min(5, N))
    for idx in sample_queries:
        q_img = all_paths[idx]
        q_label = all_labels[idx]
        
        dists = distance_matrix[idx].copy()
        dists[idx] = np.inf
        best_match_idx = np.argmin(dists)
        best_img = all_paths[best_match_idx]
        best_label = all_labels[best_match_idx]
        best_dist = dists[best_match_idx]
        
        is_match = (q_label == best_label)
        tag = "[MATCH]" if is_match else "[MISMATCH]"
        print(f"  {tag} | Query: {q_img} (Tiger {q_label}) --> Best Hit: {best_img} (Tiger {best_label}) | Dist: {best_dist:.4f}")
        
    print("\n" + "=" * 65)
    return {
        "top1_acc": top1_acc,
        "top5_acc": top5_acc,
        "top10_acc": top10_acc,
        "avg_intra_dist": avg_intra_dist,
        "avg_inter_dist": avg_inter_dist,
        "separation_ratio": separation_ratio
    }
        
    print("\n" + "=" * 65)
    return {
        "top1_acc": top1_acc,
        "top5_acc": top5_acc,
        "top10_acc": top10_acc,
        "avg_intra_dist": avg_intra_dist,
        "avg_inter_dist": avg_inter_dist,
        "separation_ratio": separation_ratio
    }

if __name__ == "__main__":
    evaluate_reid_performance()
