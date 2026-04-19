# --- Stage 1: Install dependencies ---
FROM node:20-alpine AS deps

WORKDIR /app

# Copy only package files first to leverage Docker layer caching.
# Dependencies are only re-installed when package.json changes.
COPY package.json package-lock.json* ./

RUN npm ci --omit=dev

# --- Stage 2: Production image ---
FROM node:20-alpine

# Run as non-root for security (12-Factor best practice)
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy installed node_modules from the deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY server.js db-sync.js package.json ./
COPY public ./public

# Switch to non-root user
USER appuser

# Document the port the app listens on (overridable via PORT env var)
EXPOSE 3000

# Health check for ECS / Docker Compose
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "server.js"]
