FROM node:22 AS builder

WORKDIR /workdir

RUN npm install -g pnpm typescript turbo

COPY package.json pnpm-*.yaml .npmrc ./
COPY packages/eslint-config/package.json packages/eslint-config/
COPY packages/typescript-config/package.json packages/typescript-config/
COPY packages/fonts/package.json packages/fonts/
COPY packages/ui2/package.json packages/ui2/
COPY packages/db/package.json packages/db/
COPY packages/conversions/package.json packages/conversions/
COPY packages/services/package.json packages/services/
COPY packages/test-utils/package.json packages/test-utils/
COPY apps/comps/package.json apps/comps/

RUN pnpm install --frozen-lockfile

COPY . .

# Build arguments for Next.js public environment variables
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

# Build the application
RUN pnpm --filter=@recallnet/fonts build && \
    pnpm --filter=@recallnet/db build && \
    pnpm --filter=@recallnet/conversions build && \
    pnpm --filter=@recallnet/services build && \
    pnpm --filter=@recallnet/test-utils build && \
    pnpm --filter=comps build

FROM node:22-alpine

COPY --from=builder /workdir /workdir

WORKDIR /workdir/apps/comps

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

# Expose port
EXPOSE $PORT

# Start the application using shell form to allow environment variable expansion
CMD node_modules/next/dist/bin/next start -p $PORT -H $HOSTNAME
