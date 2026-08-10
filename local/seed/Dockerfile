FROM node:22-alpine

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy root package files for workspace setup
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy seed service files
COPY local/package.json ./local/
COPY local/tsconfig.json ./local/

# Copy shared packages that seed depends on
COPY packages/db ./packages/db
COPY packages/typescript-config ./packages/typescript-config

# Copy migrations
COPY apps/api/drizzle ./apps/api/drizzle

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build @recallnet/db package
RUN pnpm --filter @recallnet/db build

# Copy seed source code and data
COPY local/seed/src ./local/seed/src
COPY local/seed/data ./local/seed/data

# Set working directory to seed service
WORKDIR /app/local

# Run the seed script
CMD ["pnpm", "seed"]
