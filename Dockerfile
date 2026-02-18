# Root Dockerfile — used by Railway (build context is the repository root).
# Mirrors backend/Dockerfile but adjusts COPY paths accordingly.
FROM node:18-alpine

# Install Chromium and its runtime dependencies for Puppeteer
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Tell Puppeteer to use the system Chromium instead of downloading its own
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app

# Install production dependencies first (better layer caching)
COPY backend/package*.json ./
RUN PUPPETEER_SKIP_DOWNLOAD=true npm install --omit=dev

# Copy application source
COPY backend/src ./src

# Create runtime directories (uploads are ephemeral; mount a volume in production)
RUN mkdir -p uploads logs

EXPOSE 5000

ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "src/index.js"]
