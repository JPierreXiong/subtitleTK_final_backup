# Media Worker

Media processing worker for subtitle extraction and video processing.

## Features

- ✅ Video download with retry mechanism
- ✅ Audio extraction using ffmpeg
- ✅ Subtitle processing (RapidAPI priority)
- ✅ Content extraction and summarization
- ✅ Integration with QStash queue
- ✅ Full error handling and cleanup

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql://...

# Worker URL (for QStash callbacks)
WORKER_URL=https://your-worker.railway.app

# Temporary directory
TEMP_DIR=/tmp

# Port
PORT=3000
```

## Running Locally

```bash
# Install dependencies
pnpm install

# Run worker
pnpm start
```

## Docker

```bash
# Build image
docker build -t media-worker -f worker/Dockerfile .

# Run container
docker run -p 3000:3000 \
  -e DATABASE_URL=... \
  -e WORKER_URL=... \
  media-worker
```

## Deployment

### Railway

1. Connect your GitHub repository
2. Set root directory to project root
3. Set build command: `docker build -t media-worker -f worker/Dockerfile .`
4. Set start command: `docker run media-worker`
5. Add environment variables

### Fly.io

```bash
fly launch --dockerfile worker/Dockerfile
fly secrets set DATABASE_URL=...
fly secrets set WORKER_URL=...
```

## Health Check

```bash
curl http://localhost:3000/health
```

## Architecture

```
QStash Queue → Worker HTTP Endpoint → Process Task → Update Database
```

