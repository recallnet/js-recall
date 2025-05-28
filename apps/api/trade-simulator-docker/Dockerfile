FROM node:22 AS builder

WORKDIR /workdir

COPY apps/api apps/api
COPY packages/api-sdk packages/api-sdk
COPY packages/eslint-config packages/eslint-config
COPY packages/typescript-config packages/typescript-config
COPY .npmrc .prettie* *.js *.json *.yaml ./

# # Build the application
RUN npm -g install pnpm typescript turbo
RUN cd apps/api; pnpm install
RUN cd packages/api-sdk; pnpm build
RUN cd apps/api; pnpm build

FROM node:22-alpine

# Install postgresql-client for database checks and pnpm for migrations
RUN apk add --no-cache postgresql-client
RUN npm install -g pnpm

COPY --from=builder /workdir /workdir

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose the application port (will be overridden by docker-compose)
EXPOSE $PORT

# Create startup script
COPY apps/api/trade-simulator-docker/startup.sh /workdir/apps/api/startup.sh
RUN chmod +x /workdir/apps/api/startup.sh

# Start the application
WORKDIR /workdir/apps/api
CMD ["./startup.sh"]
