# Multi-stage Dockerfile for workshopsAI CMS
# Production-ready containerization with security and optimization

# Stage 1: Base image with dependencies
FROM node:18-alpine AS base
LABEL maintainer="workshopsAI <dev@workshopsai.com>"
LABEL version="1.0.0"
LABEL description="workshopsAI CMS - Production Docker Image"

# Install security updates and system dependencies
RUN apk update && apk upgrade && \
    apk add --no-cache \
    dumb-init \
    curl \
    postgresql-client \
    && rm -rf /var/cache/apk/*

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production && npm cache clean --force

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Stage 2: Development stage
FROM base AS development
RUN npm ci
COPY . .
USER nodejs
EXPOSE 3001
CMD ["npm", "run", "dev"]

# Stage 3: Build stage
FROM base AS builder
RUN npm ci
COPY . .

# Build the application
RUN npm run build

# Security scanning with npm audit
RUN npm audit --audit-level=high

# Stage 4: Production stage
FROM base AS production

# Copy optimized node_modules from builder
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy built application and assets
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/public ./public
COPY --from=builder --chown=nodejs:nodejs /app/templates ./templates
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./

# Create necessary directories with proper permissions
RUN mkdir -p uploads logs backups temp && \
    chown -R nodejs:nodejs /app

# Copy migration scripts and database setup
COPY --from=builder --chown=nodejs:nodejs /app/migrations ./migrations

# Health check with curl
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT:-3001}/health || exit 1

# Environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3001

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/index.js"]

# Stage 5: Security scanning stage (for CI/CD)
FROM base AS security
RUN npm ci
COPY . .
RUN npm audit --audit-level=moderate && \
    npm run security:scan

# Stage 6: Testing stage
FROM base AS test
RUN npm ci
COPY . .
RUN npm run typecheck && \
    npm run lint && \
    npm run test:coverage