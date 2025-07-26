FROM node:22 AS deps

WORKDIR /workdir

RUN npm install -g pnpm

COPY package.json pnpm-*.yaml .npmrc ./
COPY packages/eslint-config/package.json packages/eslint-config/
COPY packages/typescript-config/package.json packages/typescript-config/
COPY packages/api-sdk/package.json packages/api-sdk/
COPY apps/api/package.json apps/api/

RUN pnpm install --frozen-lockfile

FROM node:22 AS builder

WORKDIR /workdir

RUN npm install -g pnpm typescript turbo bun

COPY --from=deps /workdir/node_modules ./node_modules
COPY --from=deps /workdir/packages/api-sdk/node_modules ./packages/api-sdk/node_modules
COPY --from=deps /workdir/apps/api/node_modules ./apps/api/node_modules

COPY . .

# Build the application
RUN pnpm --filter=@recallnet/api-sdk build && \
    pnpm --filter=api build

FROM node:22-alpine

# Install postgresql-client for database checks and pnpm for migrations
RUN apk add --no-cache postgresql-client
RUN npm install -g pnpm

COPY --from=builder /workdir /workdir

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV METRICS_PORT=3003

# Expose both application and metrics ports
EXPOSE $PORT $METRICS_PORT

WORKDIR /workdir/apps/api

# Create startup script
COPY apps/api/trade-simulator-docker/startup.sh ./startup.sh
RUN chmod +x ./startup.sh

# Start the application
CMD ["./startup.sh"]
