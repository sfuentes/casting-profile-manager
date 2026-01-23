# Backend Dockerfile
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (use npm install since package-lock.json is excluded)
RUN npm install --omit=dev

# Copy application source
COPY . .

# Create uploads directory
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
