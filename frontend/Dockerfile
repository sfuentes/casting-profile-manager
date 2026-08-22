# Stage 1: Build the React app with Vite
# Node 22 is required: Vite 7 declares engines ^20.19.0 || >=22.12.0 and will
# not run on Node 18.
FROM node:22-alpine AS build

WORKDIR /app

# Accept the API URL at build time (required by Vite — baked into the bundle)
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Stage 2: Serve the built files with Nginx
FROM nginx:1.25-alpine

# Copy built assets from Stage 1
COPY --from=build /app/dist /usr/share/nginx/html

# Copy Nginx config for SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

# 127.0.0.1 rather than localhost: nginx binds IPv4 only here (see nginx.conf),
# so a localhost lookup that returns ::1 first would fail the check.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
