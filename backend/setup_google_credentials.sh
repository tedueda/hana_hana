#!/bin/bash
# Setup Google Service Account credentials from environment variable

echo "========================================" >&2
echo "Google Indexing API Setup" >&2
echo "========================================" >&2

if [ -n "$GOOGLE_SERVICE_ACCOUNT_JSON" ]; then
    echo "[INFO] Setting up Google service account credentials..." >&2
    echo "$GOOGLE_SERVICE_ACCOUNT_JSON" | base64 -d > /app/google-service-account.json 2>&1
    if [ $? -eq 0 ] && [ -f /app/google-service-account.json ] && [ -s /app/google-service-account.json ]; then
        chmod 600 /app/google-service-account.json
        echo "[SUCCESS] Google service account credentials configured successfully" >&2
        echo "[INFO] Credentials file created at: /app/google-service-account.json" >&2
    else
        echo "[ERROR] Failed to decode base64 credentials" >&2
        echo "[WARNING] Google Indexing API will not be available" >&2
        # Don't exit - allow app to start without Indexing API
        rm -f /app/google-service-account.json
    fi
else
    echo "[WARNING] GOOGLE_SERVICE_ACCOUNT_JSON environment variable not set" >&2
    echo "[WARNING] Google Indexing API will not be available" >&2
fi

echo "========================================" >&2
