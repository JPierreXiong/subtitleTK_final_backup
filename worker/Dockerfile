# Worker Dockerfile
# Builds a Docker image for the media processing worker

FROM node:18-slim

# Install ffmpeg and Python (for potential future ASR tools)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY pnpm-lock.yaml ./

# Install pnpm if not available
RUN npm install -g pnpm@latest

# Install dependencies
RUN pnpm install --frozen-lockfile --prod

# Copy worker code
COPY worker/ ./worker/
COPY src/ ./src/
COPY tsconfig.json ./

# Install TypeScript and build tools for compilation
RUN pnpm add -D typescript tsx @types/node

# Build TypeScript (if needed)
# Note: You may want to pre-build or use tsx to run directly
# RUN pnpm build

# Create temp directory
RUN mkdir -p /tmp

# Set environment variables
ENV NODE_ENV=production
ENV TEMP_DIR=/tmp
ENV PORT=3000

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start worker
CMD ["node", "-r", "tsx/register", "worker/index.ts"]

