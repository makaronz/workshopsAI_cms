# Multi-stage Dockerfile for workshopsAI CMS - OPTIMIZED FOR RAILWAY
# Focus: Minimal image size (target < 500MB)

# --- Stage 1: Build Stage ---
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies (needed for node-gyp/native modules)
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies for building)
# Skip Chromium download during build to save bandwidth/time
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
RUN npm ci

# Copy source code
COPY . .

# Build the application (Frontend + Backend)
RUN npm run build

# --- Stage 2: Production Dependencies Stage ---
# This stage installs ONLY production dependencies to keep the final image small
FROM node:20-alpine AS deps

WORKDIR /app

# Install build tools again (needed if any prod dep requires compilation)
RUN apk add --no-cache python3 make g++

COPY package*.json ./

# Install ONLY production dependencies
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
RUN npm ci --omit=dev && npm cache clean --force

# --- Stage 3: Final Production Image ---
FROM node:20-alpine AS runner

LABEL maintainer="workshopsAI <dev@workshopsai.com>"

# Install system dependencies
# - dumb-init: for proper signal handling
# - chromium: system version for puppeteer (much smaller than bundled)
# - nss, freetype, harfbuzz...: dependencies for chromium
RUN apk add --no-cache \
    dumb-init \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Create app directory
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy production node_modules from deps stage
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy built application from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/public ./public
COPY --from=builder --chown=nodejs:nodejs /app/src/templates ./src/templates
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./
COPY --from=builder --chown=nodejs:nodejs /app/migrations ./migrations

# Create necessary directories
RUN mkdir -p uploads logs backups temp && \
    chown -R nodejs:nodejs /app

# Configure Puppeteer to use system Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Environment variables
ENV NODE_ENV=production
ENV PORT=3010

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3010

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:${PORT:-3010}/health || exit 1

# Use dumb-init
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/index.js"]