# Use Node.js 22 Alpine for smaller image size
FROM node:22-alpine

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init curl

# Create app directory and set correct permissions
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY . .

# Create necessary directories with correct permissions
RUN mkdir -p /app/logs && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 5500

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5500/healthz || exit 1

# Start the application with dumb-init
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]