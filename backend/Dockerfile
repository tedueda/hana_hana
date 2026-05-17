FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Poetry
RUN pip install poetry

# Copy poetry files
COPY pyproject.toml poetry.lock ./

# Configure poetry and install dependencies
RUN poetry config virtualenvs.create false \
    && poetry lock \
    && poetry install --no-root -vvv

# Copy application code
COPY . .
# Ensure media directory exists (for runtime mounting/serving)
RUN mkdir -p media && chmod +x start.sh setup_google_credentials.sh || true

# Expose port
EXPOSE 8000

# Start command via script (runs migrations if configured)
CMD ["/bin/bash", "-lc", "./start.sh"]
