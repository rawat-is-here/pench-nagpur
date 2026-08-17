import os
import random
import pandas as pd
import torch
import torch.nn as nn
import torch.optim as optim
import torchvision.models as models
import torchvision.transforms as transforms
from torch.utils.data import Dataset, DataLoader
from PIL import Image

# ==========================================
# 1. TRIPLET DATASET DEFINITION
# ==========================================
class CSVTripletDataset(Dataset):
    """
    Triplet Dataset for Tiger Re-Identification using Metric Learning.
    Reads mappings of Tiger ID -> Filename from labels.txt and generates
    (Anchor, Positive, Negative) triplets on the fly.
    """
    def __init__(self, csv_file="labels.txt", img_dir="images", transform=None):
        self.img_dir = img_dir
        self.transform = transform
        
        if not os.path.exists(csv_file):
            raise FileNotFoundError(f"Labels file not found at: {csv_file}")
            
        # Read the mapping file (handles commas, spaces, or tabs)
        self.df = pd.read_csv(csv_file, header=None, names=["tiger_id", "filename"], sep=r'[,\s]+', engine='python')
        
        # Verify images exist and build dictionary
        self.images_by_tiger = {}
        for _, row in self.df.iterrows():
            t_id = str(row["tiger_id"]).strip()
            fname = str(row["filename"]).strip()
            full_path = os.path.join(self.img_dir, fname)
            
            # If img_dir exists, verify file existence; otherwise trust dataframe
            if os.path.exists(self.img_dir):
                if not os.path.exists(full_path):
                    continue
                    
            if t_id not in self.images_by_tiger:
                self.images_by_tiger[t_id] = []
            self.images_by_tiger[t_id].append(fname)
            
        # Filter out tigers with fewer than 2 images (triplets need >= 2 positive examples)
        self.valid_tiger_ids = [
            t_id for t_id, imgs in self.images_by_tiger.items() if len(imgs) >= 2
        ]
        
        print(f"Dataset Loaded: {len(self.valid_tiger_ids)} unique tigers with >= 2 images for triplet generation.")
        if len(self.valid_tiger_ids) < 2:
            raise ValueError("Need at least 2 distinct tiger identities with multiple images to form triplets.")

    def __len__(self):
        # Epoch length proportional to number of available images
        return max(len(self.df), 100)

    def __getitem__(self, idx):
        # 1. Select Anchor & Positive from the same tiger
        anchor_id = random.choice(self.valid_tiger_ids)
        anchor_img, positive_img = random.sample(self.images_by_tiger[anchor_id], 2)
        
        # 2. Select Negative from a different tiger
        negative_id = random.choice([t for t in self.valid_tiger_ids if t != anchor_id])
        negative_img = random.choice(self.images_by_tiger[negative_id])
        
        # Load PIL Images
        img_a = Image.open(os.path.join(self.img_dir, anchor_img)).convert("RGB")
        img_p = Image.open(os.path.join(self.img_dir, positive_img)).convert("RGB")
        img_n = Image.open(os.path.join(self.img_dir, negative_img)).convert("RGB")
        
        # Apply transforms
        if self.transform:
            img_a = self.transform(img_a)
            img_p = self.transform(img_p)
            img_n = self.transform(img_n)
            
        return img_a, img_p, img_n

# ==========================================
# 2. METRIC LEARNING MODEL DEFINITION
# ==========================================
def get_metric_learning_model():
    """
    Constructs a 2048-dimensional feature extractor from ResNet50.
    Unfreezes layer4 and layer3 for specialized stripe ridge recognition.
    """
    print("Loading pre-trained ResNet50 backbone...")
    weights = models.ResNet50_Weights.IMAGENET1K_V2
    resnet = models.resnet50(weights=weights)
    
    # Freeze early layers on the resnet instance directly
    for name, param in resnet.named_parameters():
        if "layer4" in name or "layer3" in name:
            param.requires_grad = True
        else:
            param.requires_grad = False
            
    # Strip the 1000-class classification head to get the 2048d embedding vector
    model = nn.Sequential(*list(resnet.children())[:-1])
    
    trainable_count = sum(p.numel() for p in model.parameters() if p.requires_grad)
    total_count = sum(p.numel() for p in model.parameters())
    print(f"Model configured: {trainable_count:,} trainable parameters out of {total_count:,} total parameters.")
            
    return model

# ==========================================
# 3. TRAINING PIPELINE
# ==========================================
def main(
    csv_file="labels.txt",
    img_dir="images",
    epochs=15,
    batch_size=16,
    learning_rate=1e-4,
    margin=1.0,
    output_model="tiger_stripe_resnet50.pth"
):
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"==================================================")
    print(f"🐅 Tiger Re-ID Metric Learning Training")
    print(f"⚡ Device: {device} | Epochs: {epochs} | Batch Size: {batch_size}")
    print(f"==================================================")

    # Biologically sound augmentations: strictly NO horizontal flipping (tiger stripe patterns are asymmetric)
    train_transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.RandomRotation(degrees=8),                                      # Camera mount tilt / slope
        transforms.ColorJitter(brightness=0.25, contrast=0.25, saturation=0.15),   # Day/night flash & shadows
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])

    print("Initializing dataset & dataloader...")
    dataset = CSVTripletDataset(csv_file=csv_file, img_dir=img_dir, transform=train_transform)
    
    # Use num_workers=0 on Windows to avoid multi-processing pickling overhead
    num_workers = 2 if (os.name != 'nt' and torch.cuda.is_available()) else 0
    dataloader = DataLoader(dataset, batch_size=batch_size, shuffle=True, num_workers=num_workers)

    model = get_metric_learning_model().to(device)
    
    # Triplet Margin Loss: penalizes if ||a - p||_2 - ||a - n||_2 + margin > 0
    criterion = nn.TripletMarginLoss(margin=margin, p=2)
    optimizer = optim.Adam(filter(lambda p: p.requires_grad, model.parameters()), lr=learning_rate)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)

    print("Starting Triplet Metric Learning training loop...")
    for epoch in range(epochs):
        model.train()
        total_loss = 0.0
        
        for batch_idx, (anchor, positive, negative) in enumerate(dataloader):
            anchor = anchor.to(device)
            positive = positive.to(device)
            negative = negative.to(device)
            
            optimizer.zero_grad()
            
            # Forward pass: extract (batch, 2048) embeddings
            vec_a = model(anchor).flatten(start_dim=1)
            vec_p = model(positive).flatten(start_dim=1)
            vec_n = model(negative).flatten(start_dim=1)
            
            # Normalize embeddings before computing loss
            vec_a = nn.functional.normalize(vec_a, p=2, dim=1)
            vec_p = nn.functional.normalize(vec_p, p=2, dim=1)
            vec_n = nn.functional.normalize(vec_n, p=2, dim=1)
            
            loss = criterion(vec_a, vec_p, vec_n)
            loss.backward()
            optimizer.step()
            
            total_loss += loss.item()
            
            if (batch_idx + 1) % 5 == 0 or (batch_idx + 1) == len(dataloader):
                print(f"Epoch [{epoch+1:02d}/{epochs:02d}] | Batch [{batch_idx+1:02d}/{len(dataloader):02d}] | Loss: {loss.item():.4f}")
                
        scheduler.step()
        avg_loss = total_loss / max(len(dataloader), 1)
        print(f"--> [Epoch {epoch+1:02d}] Completed. Average Triplet Loss: {avg_loss:.4f}\n")
        
    # Save the trained weights
    torch.save(model.state_dict(), output_model)
    print(f"🎉 Training complete! Model weights saved to '{output_model}'")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Train ResNet-50 Metric Learning for Tiger Stripe Re-ID")
    parser.add_argument("--labels", default="labels.txt", help="Path to labels.txt mapping")
    parser.add_argument("--images", default="images", help="Path to images directory")
    parser.add_argument("--epochs", type=int, default=15, help="Number of epochs")
    parser.add_argument("--batch_size", type=int, default=16, help="Batch size")
    parser.add_argument("--lr", type=float, default=1e-4, help="Learning rate")
    parser.add_argument("--output", default="tiger_stripe_resnet50.pth", help="Output model filename")
    
    args = parser.parse_args()
    
    if os.path.exists(args.labels) and os.path.exists(args.images):
        main(
            csv_file=args.labels,
            img_dir=args.images,
            epochs=args.epochs,
            batch_size=args.batch_size,
            learning_rate=args.lr,
            output_model=args.output
        )
    else:
        print(f"ℹ️ Ready to train! Please ensure '{args.labels}' and '{args.images}/' folder are present.")
        print(f"Run: python train.py --labels labels.txt --images images")
