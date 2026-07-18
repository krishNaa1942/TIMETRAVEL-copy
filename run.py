"""
Time Travel – AI Smart Tourism Assistant
=========================================
Entry point for the Flask application.

Usage:
    python run.py              # Development server (debug mode)
    python run.py --prod       # Production-like mode (debug off)
"""

import sys
import atexit
from dotenv import load_dotenv

load_dotenv()  # Load .env before creating the app

from app.main import create_app  # noqa: E402

app = create_app()


def _cleanup_loky_executor():
    """Best-effort cleanup for joblib/loky worker resources at shutdown."""
    try:
        from joblib.externals.loky import get_reusable_executor

        executor = get_reusable_executor()
        executor.shutdown(wait=False, kill_workers=True)
    except Exception:
        # loky may not be installed/initialised in some runs.
        pass


atexit.register(_cleanup_loky_executor)

if __name__ == "__main__":
    debug = "--prod" not in sys.argv
    # Disable Flask reloader process to reduce multiprocessing resource leaks
    # from third-party libs (e.g. joblib/loky via sklearn).
    app.run(host="0.0.0.0", port=5001, debug=debug, use_reloader=False)
