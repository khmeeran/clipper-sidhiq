import os
from pathlib import Path
from pydantic import BaseModel

# Base project paths
BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / "data"
JOBS_DIR = DATA_DIR / "jobs"
DB_PATH = DATA_DIR / "clipper.db"

# Ensure essential directories exist
DATA_DIR.mkdir(parents=True, exist_ok=True)
JOBS_DIR.mkdir(parents=True, exist_ok=True)

class Settings(BaseModel):
    # App info
    app_name: str = "Clipper Sidhiq"
    host: str = "127.0.0.1"
    port: int = 8080
    
    # Storage and retention
    data_dir: Path = DATA_DIR
    jobs_dir: Path = JOBS_DIR
    retention_hours: float = 6.0
    max_upload_size_mb: int = 5000  # 5 GB max upload
    
    # AI & Pipeline defaults
    ollama_base_url: str = "http://127.0.0.1:11434"
    default_ollama_model: str = "llama3.2:3b"
    whisper_model: str = "base"  # tiny, base, small, medium
    whisper_device: str = "cuda"  # cuda or cpu
    whisper_compute_type: str = "float16"  # float16 for cuda, int8 for cpu
    
    # Video production defaults
    target_width: int = 1080
    target_height: int = 1920
    default_reframing: str = "blur_background"  # blur_background or center_crop
    subtitle_style: str = "violet_glow"  # violet_glow, radiant_gold, clean_white
    subtitle_margin_v: int = 400  # Safe vertical distance from bottom for shorts/reels UI
    
    # Adaptive selection
    min_clip_score: float = 6.5
    min_clip_duration: float = 15.0
    max_clip_duration: float = 90.0

settings = Settings()
