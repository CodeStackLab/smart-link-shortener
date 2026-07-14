# Multi-stage Dockerfile for Coolify deployment
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

# Production runner stage
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Create data directory for JSON persistence
RUN mkdir -p /app/data

COPY --from=builder /app ./

EXPOSE 3000

CMD ["node", "server.js"]
