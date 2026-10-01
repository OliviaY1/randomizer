import os
import tempfile

# Keep tests off any real database: main.py reads this when it's imported
os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mkdtemp()}/import.db"
os.environ.pop("MSAL_CLIENT_ID", None)
