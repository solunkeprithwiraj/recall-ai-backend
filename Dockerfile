# Backend Dockerfile for Railway Deployment
# Multi-stage build for optimal image size

# Stage 1: Dependencies
FROM node:18-alpine AS deps

# Install necessary build tools for native modules
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (including dev dependencies for building)
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Stage 2: Build
FROM node:18-alpine AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package*.json ./
COPY --from=deps /app/prisma ./prisma

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Stage 3: Production
FROM node:18-alpine AS runner

# Install curl for health checks
RUN apk add --no-cache curl

WORKDIR /app

# Set NODE_ENV to production
ENV NODE_ENV=production

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy necessary files from builder
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma

# Switch to non-root user
USER nodejs

# Expose port (Railway will dynamically assign a port and set PORT env var)
# The application code reads PORT from environment variable
EXPOSE 8080

# Health check (uses PORT env var that Railway provides at runtime)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get(process.env.PORT ? 'http://localhost:' + process.env.PORT + '/health' : 'http://localhost:8080/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start server
CMD ["npm", "start"]
