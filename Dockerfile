# Multi-stage Dockerfile for EchoSenseiX
# Optimized for production deployment on any platform
# Build: docker build -t echosensei .
# Run: docker run -p 5000:5000 --env-file .env echosensei

# ==============================================================================
# Stage 1: Install dependencies
# ==============================================================================
FROM node:20-alpine AS deps

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++ libc6-compat

WORKDIR /app

# Copy package files for layer caching
COPY package*.json ./

# Install all dependencies (including dev for build)
RUN npm ci --legacy-peer-deps

# ==============================================================================
# Stage 2: Build application
# ==============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the application
RUN npm run build

# ==============================================================================
# Stage 3: Production runtime
# ==============================================================================
FROM node:20-alpine AS runner

# Add labels for container management
LABEL org.opencontainers.image.title="EchoSenseiX"
LABEL org.opencontainers.image.description="Voice AI SaaS Platform"
LABEL org.opencontainers.image.vendor="EchoSenseiX"

# Install runtime dependencies and security updates
RUN apk add --no-cache \
    curl \
    ca-certificates \
    tini \
    && apk upgrade --no-cache \
    && addgroup -g 1001 -S nodejs \
    && adduser -S nodejs -u 1001

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only with clean cache
RUN npm ci --omit=dev --legacy-peer-deps \
    && npm cache clean --force \
    && rm -rf /tmp/* /var/cache/apk/*

# Copy built application from builder
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/shared ./shared

# Create necessary directories with correct permissions
RUN mkdir -p /app/uploads /app/audio-storage /app/logs \
    && chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 5000

# Health check - checks both liveness and basic readiness
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:5000/health/live || exit 1

# Set production environment variables
ENV NODE_ENV=production \
    PORT=5000 \
    HOST=0.0.0.0 \
    # Node.js optimizations for production
    NODE_OPTIONS="--max-old-space-size=512 --enable-source-maps"

# Use tini as init system for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start the application
CMD ["node", "dist/index.js"]
