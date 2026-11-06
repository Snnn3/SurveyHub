# -------------------------------------------------------------
# Stage 1: Build the React client frontend
# -------------------------------------------------------------
FROM node:20-alpine AS client-builder
WORKDIR /app

COPY package*.json ./
COPY client/package*.json ./client/
RUN npm ci --workspace=surveyhub-client

COPY client/ ./client/
RUN npm run build --workspace=surveyhub-client

# -------------------------------------------------------------
# Stage 2: Build the Express / TypeScript backend
# -------------------------------------------------------------
FROM node:20-alpine AS server-builder
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app

COPY package*.json ./
COPY server/package*.json ./server/
RUN npm ci --workspace=surveyhub-server

COPY server/prisma ./server/prisma
COPY server/tsconfig.json ./server/tsconfig.json
RUN npx prisma generate --schema=server/prisma/schema.prisma

COPY server/ ./server/
RUN npm run build --workspace=surveyhub-server

# -------------------------------------------------------------
# Stage 3: Production runner (serves API & Client on same origin)
# -------------------------------------------------------------
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app

COPY package*.json ./
COPY server/package*.json ./server/
RUN npm ci --include=dev --workspace=surveyhub-server

COPY server/prisma ./server/prisma
COPY server/tsconfig.json ./server/tsconfig.json
RUN npx prisma generate --schema=server/prisma/schema.prisma

# Copy compiled backend and frontend bundles
COPY --from=server-builder /app/server/dist ./dist
COPY --from=client-builder /app/client/dist ./client/dist

ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

CMD ["node", "dist/server.js"]
