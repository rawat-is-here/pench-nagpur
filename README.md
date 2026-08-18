# TerraStripe: Pench Tiger Intelligence & Spatial Tracking System
## Full Technical Documentation & Project Overview

Welcome to the comprehensive technical documentation for **TerraStripe**, a state-of-the-art wildlife monitoring, identification, and spatial analysis platform developed for the **Pench Tiger Reserve**. 

This system integrates real-time computer vision (animal detection and stripe-based Re-ID), spatial ecological calculations, and automated conflict warnings into a unified Web Console.

---

## 1. Project Team Credits
The development and design of TerraStripe were executed by the following core team members:

*   **Kushal Thakare**  
    *Role:* Artificial Intelligence and Machine Learning (Team Lead)  
    *Contributions:* Trained the metric learning models, designed the triplet loss training pipeline, implemented the ResNet-50 stripe Re-ID feature extraction, and designed the centroid-based matching FAISS clustering logic.
    
*   **Akash Rawat**  
    *Role:* Python Backend Developer  
    *Contributions:* Developed the FastAPI REST API server, configured the database connections using Supabase (PostgreSQL), built the Geopandas-based UTM home-range and convex hull geometry calculators, and designed the real-time alerts evaluation engine.
    
*   **Manthan Powar, Aditya Wagh, and Kaushik Desale**  
    *Role:* React Frontend Developers  
    *Contributions:* Engineered the responsive React Single Page Application (SPA) using TailwindCSS (v4), integrated the Leaflet and React-Leaflet interactive maps, designed the Human-in-the-Loop review portal, and built the quarantine management grids.

---

## 2. Executive Summary & Problem Solved
Wildlife tracking via camera traps traditionally suffers from manual labor overhead and delays in processing:
1.  **Blank Frame Storms:** Up to 90% of camera trap photos are triggered by wind, leaves, or domestic cattle. TerraStripe automates this filtering using **MegaDetector V6 (MDV6-yolov10-e)**, immediately archiving blank frames in a quarantine stage, saving over 99% of manual review time.
2.  **Stripe Re-ID Contaminations:** A tiger's stripe patterns are unique but asymmetric (left and right flanks differ). The AI Team engineered a fine-tuned ResNet-50 model trained with triplet margin loss to extract 2048-dimensional embeddings. The matching engine compares queries against individual **centroids** rather than a naive 1-Nearest Neighbor search, resolving database fragmentation.
3.  **Real-Time Spatial Alerts:** Core rangers lack GIS tools on the ground. TerraStripe projects GPS points into metric UTM grids (`EPSG:32644` for Pench) to calculate Minimum Convex Polygons (MCP) and detect home range deviations ($\ge 4\text{ km}$ or $\ge 5\text{ km}$), first-time station arrivals, and village border crossings.

---

## 3. Technology Stack & Wiring

### 3.1 Backend Architecture
*   **Web Framework:** FastAPI (Asynchronous REST API Gateway)
*   **Deep Learning Framework:** PyTorch & Torchvision (used for MegaDetector and custom feature extraction)
*   **Computer Vision Libraries:** PyTorchWildlife (MegaDetector V6 wrapper) & OpenCV (CLAHE / bilateral filtering)
*   **Vector Database:** FAISS CPU (FlatL2 index for high-dimensional vector search)
*   **Spatial Calculations:** Geopandas, Shapely, and Pandas
*   **Database Client:** Supabase Python Client (PostgreSQL connector)

### 3.2 Frontend Architecture
*   **Framework & Build:** React.js (v19) & Vite
*   **Styling:** TailwindCSS (v4) for responsive layouts and custom component styles
*   **Mapping:** Leaflet (v1.9.4) & React-Leaflet (v5)
*   **Icons:** Lucide-React
*   **Http Client:** Axios

---

## 4. Architectural Modules: Deep Dive

### 4.1 AI Triage & Bounding Box Logic (`src/triage.py`)
When a camera trap image is ingested:
1.  It is sent to the **MegaDetector V6** object detection model.
2.  The model returns classifications: `0` (animal), `1` (person), `2` (vehicle).
3.  If an animal is detected with a confidence score $\ge 0.40$, its bounding box (`[x_min, y_min, x_max, y_max]`) is used to crop the image.
4.  If no animal is detected, the image is quarantined.

```python
def process_triage(file_path, confidence_threshold=0.40):
    results = model.single_image_detection(file_path)
    # Checks class_id == 0 (animal) and confidence >= threshold
    # Returns (True, bounding_box) or (False, None)
```

---

### 4.2 Stripe Feature Extraction & Centroid Matching (`src/stripe_matcher.py`)
1.  **Feature Extraction:** The cropped image is transformed (resized to $224 \times 224$ and normalized) and run through the metric learning model. This generates a 2048-dimensional embedding vector, which is L2-normalized:
    $$\mathbf{v} = \frac{\mathbf{f}}{\|\mathbf{f}\|_2}$$
2.  **Centroid Database:** A centroid $\mathbf{c}_k$ is maintained for each tiger, representing the mean embedding of all its confirmed sightings:
    $$\mathbf{c}_k = \frac{1}{N_k}\sum_{i=1}^{N_k} \mathbf{v}_i$$
3.  **FAISS Matching:** The query vector $\mathbf{v}$ is compared against all centroids using L2 distance:
    $$D_k = \|\mathbf{v} - \frac{\mathbf{c}_k}{\|\mathbf{c}_k\|_2}\|_2^2$$
4.  **Matching Thresholds:**
    *   **Auto-Match ($D \le 0.055$):** Confirms identity and updates the centroid using a running average.
    *   **Ambiguous ($0.055 < D \le 0.15$):** Enrolls under a temporary ID and flags the capture for manual review.
    *   **New Tiger ($D > 0.15$):** Registers a new individual in the database.

---

### 4.3 Spatial Geometry Engine (`src/spatial_mapping.py`)
To map home ranges, the spatial engine uses the standard ecological method **Minimum Convex Polygon (MCP)**:
1.  **UTM Projection:** Coordinates are converted from GPS WGS 84 (`EPSG:4326`) to UTM Zone 44N (`EPSG:32644`) to calculate accurate metric distances in Central India.
2.  **Polygon Calculation:**
    *   If a tiger has $\ge 3$ sightings, it computes the convex hull of those points:
        $$\text{MCP}(T_k) = \text{ConvexHull}(\{p_{1}, p_{2}, \dots, p_{n}\})$$
    *   If a tiger has $< 3$ sightings, it buffers the points by $1.2\text{ km}$:
        $$\text{MCP}_{buffered} = \text{Buffer}(\text{MultiPoint}(\{p_i\}), 1200\text{ meters})$$
3.  **Overlap Calculation:** The intersection area of two tigers' polygons is computed:
    $$\text{Overlap}(T_a, T_b) = \text{MCP}(T_a) \cap \text{MCP}(T_b)$$
    Intersection areas exceeding $100\text{ m}^2$ are converted to square kilometers and the boundary coordinates are reprojected back to WGS 84 for mapping.

---

### 4.4 Alerts Engine (`src/alerts_engine.py`)
Every capture triggers an automated spatial alerts check:
1.  **Range Shift Check:** Compares the capture coordinate against the tiger's historical centroid. If the distance $d \ge 4.0\text{ km}$ (inside core sanctuary) or $d \ge 5.0\text{ km}$ (in buffer zones), a `RANGE_SHIFT` alert is raised.
2.  **First-Time Capture Check:** Compares the current camera station ID against the list of historical station IDs for that tiger. If it's a new station, a `NEW_STATION_CAPTURE` alert is raised.
3.  **Core to Buffer Transition:** Evaluates whether a tiger has moved from the core zone ($[21.61, 21.71]^\circ\text{ N} \times [79.19, 79.29]^\circ\text{ E}$) to the buffer zone. If so, a `BUFFER_PROXIMITY` alert is raised.
4.  **Village Border Proximity:** Raises a `VILLAGE_PROXIMITY` alert if the capture occurs near village borders (South boundary $\text{Latitude} < 21.57^\circ\text{ N}$ or East boundary $\text{Longitude} > 79.33^\circ\text{ E}$).
5.  **Prolonged Absence Check:** Scans the database for tigers that have not been detected for $\ge 14\text{ days}$. It also checks the activity of the camera station where the tiger was last seen to distinguish between true absence and a broken camera.

---

## 5. Database Schema & Tables

TerraStripe uses PostgreSQL to store persistent data:

### 5.1 Tigers Table
```sql
CREATE TABLE public.tigers (
  id text NOT NULL,
  name text,
  enrolled_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT tigers_pkey PRIMARY KEY (id)
);
```

### 5.2 Captures Table
```sql
CREATE TABLE public.captures (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  tiger_id text,
  image_path text,
  station text,
  timestamp timestamp with time zone DEFAULT timezone('utc'::text, now()),
  latitude double precision,
  longitude double precision,
  status text, -- 'processed', 'pending_review', 'quarantined', 'rejected'
  confidence double precision,
  embedding double precision[], -- 2048-D normalized embedding vector
  CONSTRAINT captures_pkey PRIMARY KEY (id),
  CONSTRAINT captures_tiger_id_fkey FOREIGN KEY (tiger_id) REFERENCES public.tigers(id) ON DELETE SET NULL
);
```

### 5.3 Alerts Table
```sql
CREATE TABLE public.alerts (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  tiger_id text,
  alert_type text, -- 'RANGE_SHIFT', 'NEW_STATION_CAPTURE', 'BUFFER_PROXIMITY', 'VILLAGE_PROXIMITY', 'PROLONGED_ABSENCE'
  severity text, -- 'INFO', 'WARNING', 'CRITICAL'
  message text,
  timestamp timestamp with time zone DEFAULT timezone('utc'::text, now()),
  resolved boolean DEFAULT false,
  evidence jsonb, -- High-performance JSON metadata (distance, station details, absence duration)
  CONSTRAINT alerts_pkey PRIMARY KEY (id),
  CONSTRAINT alerts_tiger_id_fkey FOREIGN KEY (tiger_id) REFERENCES public.tigers(id) ON DELETE CASCADE
);
```

---

## 6. API Endpoint Specification

The FastAPI backend exposes the following REST API endpoints:

### 6.1 System Stats
*   `GET /system_stats`
    *   *Description:* Returns real-time metrics including active cameras, identified tigers, storage saved (MB), quarantined images count, and manual review hours saved.

### 6.2 Image Ingestions
*   `POST /upload_camera_trap`
    *   *Description:* Uploads and processes a single image through the EXIF parser, MegaDetector triage, and ResNet-50 stripe Re-ID pipeline.
*   `POST /upload_camera_traps_bulk`
    *   *Description:* Uploads and processes a batch of images asynchronously.
*   `POST /bulk_triage`
    *   *Description:* Processes a batch of images from a local directory path.

### 6.3 Spatial Analytics
*   `GET /territory/{tiger_id}`
    *   *Description:* Computes and returns the convex hull coordinates, centroid, core area size, sector, and zone for a specific tiger.
*   `GET /all_territories`
    *   *Description:* Computes and returns home range data for all enrolled tigers.
*   `GET /territory_overlaps`
    *   *Description:* Calculates and returns territorial overlaps between all tigers.

### 6.4 Threat Alerts
*   `GET /alerts/active`
    *   *Description:* Returns active alerts. Uses a thread-safe in-memory cache with a 3-second TTL.
*   `GET /alerts/history`
    *   *Description:* Returns historical resolved and active alerts.
*   `POST /resolve_alert/{alert_id}`
    *   *Description:* Marks an alert as resolved.
*   `POST /check_prolonged_absences`
    *   *Description:* Scans the database for tigers that have not been detected for $\ge 14\text{ days}$.

### 6.5 Human-in-the-Loop Reviews
*   `GET /pending_reviews`
    *   *Description:* Returns captures flagged as ambiguous alongside reference images of candidate matches.
*   `POST /resolve_review`
    *   *Description:* Submits a decision for a pending review capture (confirm, reassign, enroll as new tiger, or reject).

### 6.6 Quarantine Management
*   `GET /quarantined_images`
    *   *Description:* Returns a list of quarantined images.
*   `POST /restore_quarantine/{filename}`
    *   *Description:* Moves a quarantined image back to the raw directory and re-runs it through the pipeline.
*   `DELETE /quarantined_images/{filename}`
    *   *Description:* Permanently deletes a quarantined image.
*   `POST /manually_enter_quarantine/{filename}`
    *   *Description:* Manually moves a quarantined image to the review queue.

---

## 7. Interactive UI/UX Pages

The React frontend client includes the following dashboards and views:

### 7.1 Map Dashboard (`frontend/src/pages/LiveMap.jsx`)
An interactive map built with Leaflet. It displays:
*   Camera trap nodes.
*   Core zone boundaries.
*   Sighting coordinates.
*   Centroid markers.
*   Home range polygons.
*   Features toggleable layers for MCP Polygons, Centroid Patrol Radii, and Sighting Points, with focus filtering options for specific tiger IDs.

### 7.2 Manual Review Hub (`frontend/src/pages/ManualReview.jsx`)
Allows users to resolve ambiguous matches:
*   Displays the query crop alongside reference photos of the closest candidate matches.
*   Provides buttons to confirm the match, reassign the capture, enroll it as a new tiger, or reject the image.

### 7.3 Quarantined Data Manager (`frontend/src/pages/QuarantinedData.jsx`)
Provides a grid view of all quarantined blank frames:
*   Displays image filenames, file sizes, and ingest timestamps.
*   Allows users to bulk delete empty frames or force-review images that may have been incorrectly filtered by the triage model.

---

## 8. Setup & Installation Guide

To run TerraStripe locally, follow these steps:

### 8.1 Backend Setup
1.  Ensure Python 3.10+ and PyTorch are installed.
2.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
3.  Set up your environment variables in a `.env` file in the root directory:
    ```env
    SUPABASE_URL=https://your-project.supabase.co
    SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
    ```
4.  Seed the database:
    ```bash
    python seed_db.py
    ```
5.  Start the FastAPI backend server:
    ```bash
    python src/main.py
    ```
    The backend will start on `http://127.0.0.1:8000`.

### 8.2 Frontend Setup
1.  Navigate to the `frontend/` directory.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the Vite development server:
    ```bash
    npm run dev
    ```
    The frontend will be available at `http://localhost:5173`.
