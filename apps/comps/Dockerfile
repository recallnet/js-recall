FROM node:22 AS deps

WORKDIR /workdir

RUN npm install -g pnpm

COPY package.json pnpm-*.yaml .npmrc ./
COPY packages/eslint-config/package.json packages/eslint-config/
COPY packages/typescript-config/package.json packages/typescript-config/
COPY packages/address-utils/package.json packages/address-utils/
COPY packages/fonts/package.json packages/fonts/
COPY packages/ui2/package.json packages/ui2/
COPY apps/comps/package.json apps/comps/

RUN pnpm install --frozen-lockfile

FROM node:22 AS builder

WORKDIR /workdir

RUN npm install -g pnpm typescript turbo

COPY --from=deps /workdir/node_modules ./node_modules
COPY --from=deps /workdir/packages/address-utils/node_modules ./packages/address-utils/node_modules
COPY --from=deps /workdir/packages/fonts/node_modules ./packages/fonts/node_modules
COPY --from=deps /workdir/packages/ui2/node_modules ./packages/ui2/node_modules
COPY --from=deps /workdir/apps/comps/node_modules ./apps/comps/node_modules

COPY . .

# Build arguments for Next.js public environment variables
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

# Build the application
RUN pnpm --filter=@recallnet/address-utils build && \
    pnpm --filter=@recallnet/fonts build && \
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
