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

# Copy dependency manifests first for caching
COPY requirements.txt ./

# Install Python deps
RUN python3 -m pip install --upgrade pip setuptools wheel \
    && python3 -m pip install --no-cache-dir -r requirements.txt

# Copy project
COPY . /app/

# Default port (Railway will set $PORT env)
ENV PORT=5000

# Healthcheck (optional)
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD python3 -c "import os,sys,socket; s=socket.socket(); p=int(os.getenv('PORT',5000));
  try: s.bind(('0.0.0.0',p)); s.close(); sys.exit(0)
  except Exception: sys.exit(1)"

# Start supervisor (uses $PORT for orchestrator)
CMD ["python3", "agents/main.py"]
