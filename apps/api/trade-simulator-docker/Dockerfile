FROM node:22 AS builder

WORKDIR /workdir

RUN npm install -g pnpm typescript turbo bun

COPY package.json pnpm-*.yaml .npmrc ./
COPY packages/eslint-config/package.json packages/eslint-config/
COPY packages/typescript-config/package.json packages/typescript-config/
COPY packages/db/package.json packages/db/
COPY packages/staking-contracts/package.json packages/staking-contracts/
COPY packages/services/package.json packages/services/
COPY packages/conversions/package.json packages/conversions/
COPY packages/rewards/package.json packages/rewards/
COPY packages/test-utils/package.json packages/test-utils/
COPY apps/api/package.json apps/api/

RUN pnpm install --frozen-lockfile

COPY . .

# Build the application
RUN pnpm --filter=@recallnet/db build && \
    pnpm --filter=@recallnet/staking-contracts build && \
    pnpm --filter=@recallnet/rewards build && \
    pnpm --filter=@recallnet/conversions build && \
    pnpm --filter=@recallnet/services build && \
    pnpm --filter=@recallnet/test-utils build && \
    pnpm --filter=api build

FROM node:22-slim

# Install postgresql-client for database checks and pnpm for migrations
RUN apt-get update && apt-get install -y --no-install-recommends postgresql-client && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm

COPY --from=builder /workdir /workdir

# Copy entrypoint script
COPY apps/api/trade-simulator-docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV METRICS_PORT=3003

# Expose both application and metrics ports
EXPOSE $PORT $METRICS_PORT

WORKDIR /workdir/apps/api

# Use entrypoint script that runs migrations before starting
ENTRYPOINT ["/entrypoint.sh"]
