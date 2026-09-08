import os
import sys

# Ensure root project directory is in python path
root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from app import app

# Vercel serverless function expects 'app' or 'handler'
handler = app
