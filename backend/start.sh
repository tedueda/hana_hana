#!/usr/bin/env bash
set -euo pipefail

# Ensure /data exists for persistence if mounted
mkdir -p /data /data/media || true

# Export MEDIA_DIR default if not set
export MEDIA_DIR="${MEDIA_DIR:-/data/media}"

# Ensure Python can import the application package
export PYTHONPATH="${PYTHONPATH:-/app}:/app"

# Setup Google Service Account credentials
if [ -f "./setup_google_credentials.sh" ]; then
  ./setup_google_credentials.sh
fi

# Run Alembic migrations only if RUN_MIGRATIONS is explicitly set to true
RUN_MIGRATIONS="${RUN_MIGRATIONS:-false}"
if [ "$RUN_MIGRATIONS" = "true" ]; then
  if [ -f "alembic.ini" ] && [ -d "alembic" ]; then
    echo "▶ Running Alembic migrations..."
    alembic upgrade head || {
      echo "⚠ Alembic migration failed on first attempt, retrying in 5 seconds..." >&2
      sleep 5
      alembic upgrade head || {
        echo "❌ Alembic migration failed after retry" >&2
        exit 1
      }
    }
    echo "✅ Alembic migrations completed successfully"
  else
    echo "ℹ Alembic configuration not found. Skipping migrations."
  fi
else
  echo "ℹ RUN_MIGRATIONS not set to true. Skipping migrations."
fi

# Launch the app
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
