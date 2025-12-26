FROM node:22-alpine

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy root package files for workspace setup
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy seed service files
COPY docker/seed/package.json ./docker/seed/
COPY docker/seed/tsconfig.json ./docker/seed/

# Copy shared packages that seed depends on
COPY packages/db ./packages/db
COPY packages/typescript-config ./packages/typescript-config

# Install dependencies
RUN pnpm install --frozen-lockfile --filter @recallnet/seed...

# Build @recallnet/db package
RUN pnpm --filter @recallnet/db build

# Copy seed source code and data
COPY docker/seed/src ./docker/seed/src
COPY docker/seed/data ./docker/seed/data

# Set working directory to seed service
WORKDIR /app/docker/seed

# Run the seed script
CMD ["pnpm", "seed"]
