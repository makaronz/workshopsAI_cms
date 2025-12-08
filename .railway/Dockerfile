# Railway-specific Dockerfile - Simplified for success
# This file will be used automatically by Railway

FROM node:20-alpine

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3010

# Install dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Expose port
EXPOSE 3010

# Start the application
CMD ["npm", "start"]