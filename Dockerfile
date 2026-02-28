# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy all sources needed for build
COPY shared/ ./shared/
COPY server/package.json ./server/package.json
COPY server/tsconfig.json ./server/tsconfig.json
COPY server/src/ ./server/src/

# Install all deps (including devDeps for build)
WORKDIR /app/server
RUN npm install

# Build: tsup bundles everything; words.txt copied into dist/
RUN npm run build

# ── Stage 2: Production ───────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

COPY --from=builder /app/server/dist ./dist
COPY server/package.json ./

# Install only production deps
RUN npm install --omit=dev

ENV PORT=3001
EXPOSE 3001

CMD ["node", "dist/server.js"]
