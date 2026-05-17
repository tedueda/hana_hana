#!/bin/bash
# Setup Google Service Account credentials from environment variable

if [ -n "$GOOGLE_SERVICE_ACCOUNT_JSON" ]; then
    echo "Setting up Google service account credentials..."
    echo "$GOOGLE_SERVICE_ACCOUNT_JSON" | base64 -d > /app/google-service-account.json
    chmod 600 /app/google-service-account.json
    echo "Google service account credentials configured successfully"
else
    echo "WARNING: GOOGLE_SERVICE_ACCOUNT_JSON environment variable not set"
    echo "Google Indexing API will not be available"
fi
