# syntax=docker/dockerfile:1

FROM node:20-alpine AS builder
WORKDIR /app

# Native build deps for better-sqlite3
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json* ./
COPY client/package.json client/package-lock.json* ./client/

RUN npm ci
RUN npm ci --prefix client

COPY . .
RUN npm run build
RUN npm prune --production

FROM node:20-alpine AS runner
WORKDIR /app

# better-sqlite3 needs the same native ABI; copy from builder
RUN apk add --no-cache libstdc++

ENV NODE_ENV=production
ENV PORT=8080
ENV DATABASE_URL=/data/prints.db

RUN mkdir -p /data

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/src ./src
COPY --from=builder /app/prompts ./prompts
COPY --from=builder /app/content ./content
COPY --from=builder /app/client/dist ./client/dist

EXPOSE 8080
# Run as root so the GCS volume mount at /data is writable (Cloud Run
# cloud-storage volumes are not chowned to a non-root UID).
CMD ["node", "src/index.js"]
