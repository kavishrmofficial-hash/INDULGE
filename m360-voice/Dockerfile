# The m360 voice box as a container, for any machine with an NVIDIA GPU (E2E Networks, a rented VM,
# a box in the office). docker compose up -d, then put the address and the key into Admin.
FROM pytorch/pytorch:2.4.0-cuda12.4-cudnn9-runtime
RUN apt-get update && apt-get install -y --no-install-recommends git ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY server.py .
ENV VOICES_DIR=/data/voices HF_HOME=/data/hf
VOLUME ["/data"]
EXPOSE 8000
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
