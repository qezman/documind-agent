# Multi-stage build: same as documind-backend.
FROM node:24-slim AS builder
WORKDIR /app
ENV CI=true

RUN corepack enable && corepack prepare pnpm@10 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod=false

COPY . .
RUN pnpm run build

# Final stage: adds kubectl
FROM node:24-slim
WORKDIR /app
ENV CI=true

RUN corepack enable && corepack prepare pnpm@10 --activate

RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates curl && \
    curl -fsSL --http1.1 --retry 3 --retry-delay 2 \
      "https://dl.k8s.io/release/v1.31.0/bin/linux/amd64/kubectl" \
      -o /usr/local/bin/kubectl && \
    chmod +x /usr/local/bin/kubectl && \
    apt-get purge -y curl && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json pnpm-lock.yaml ./

EXPOSE 3003
CMD ["node", "dist/server.js"]