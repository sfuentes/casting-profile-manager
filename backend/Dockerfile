# Backend Dockerfile
# Node 22 (LTS) — Node 18 reached end-of-life in April 2025.
FROM node:22-alpine

# Install Chromium and dependencies for Puppeteer
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Alpine has shipped the Chromium binary under different names across releases
# (/usr/bin/chromium vs /usr/bin/chromium-browser). Normalise on
# chromium-browser so PUPPETEER_EXECUTABLE_PATH stays stable, and fail the
# build early if neither exists rather than at sync time in production.
RUN set -eux; \
    if [ ! -e /usr/bin/chromium-browser ] && [ -e /usr/bin/chromium ]; then \
      ln -s /usr/bin/chromium /usr/bin/chromium-browser; \
    fi; \
    test -e /usr/bin/chromium-browser

# Tell Puppeteer to use the installed Chromium instead of downloading its own
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies - skip Puppeteer's bundled Chromium download
RUN PUPPETEER_SKIP_DOWNLOAD=true npm install --omit=dev

# Copy application source
COPY . .

# Create uploads and logs directories
RUN mkdir -p uploads logs

# Expose port
EXPOSE 5000

# Set environment to production by default
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["node", "src/index.js"]
