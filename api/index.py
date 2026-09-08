import os
import sys

# Add parent directory to path so app.py and assets can be imported
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import app

# Vercel looks for the 'app' or handler object
