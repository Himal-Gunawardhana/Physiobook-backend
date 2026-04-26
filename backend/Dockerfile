# ============================================================
#  Physiobook Backend — Multi-stage Dockerfile
#  Build:  docker build -t physiobook-backend .
#  Run:    docker run -p 4000:4000 --env-file .env physiobook-backend
# ============================================================

# ── Stage 1: dependencies ────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

# ── Stage 2: production image ────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app

# Security: run as non-root user
RUN addgroup -S physiobook && adduser -S physiobook -G physiobook

# Copy production node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY . .

# Create log directory with correct permissions
RUN mkdir -p logs uploads && chown -R physiobook:physiobook /app

USER physiobook

# Expose API port
EXPOSE 4000

# Health check — AWS ECS/EKS will use this
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

# Start application
CMD ["node", "server.js"]
