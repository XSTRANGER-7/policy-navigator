# Use official Python image to avoid Nix/nixpacks complexity
FROM python:3.11-slim

# Create app directory
WORKDIR /app

# Avoid creating cache in image layers
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install system deps for common wheels (if needed)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy entire project so local editable packages are available to pip
COPY . /app/

# Install Python deps
RUN python3 -m pip install --upgrade pip setuptools wheel \
    && python3 -m pip install --no-cache-dir -r requirements.txt

# Default port (Railway will set $PORT env)
ENV PORT=5000

# Healthcheck omitted: agents use internal IPC/ports and may not serve HTTP.
# If you want a container-level healthcheck, add a simple HTTP endpoint in the
# orchestrator and enable a HEALTHCHECK that queries it.

# Start supervisor (uses $PORT for orchestrator)
CMD ["python3", "agents/main.py"]
