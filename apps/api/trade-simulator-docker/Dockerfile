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

COPY --from=builder /workdir /workdir

# Set environment variables
ENV NODE_ENV=production

# Expose the application port
EXPOSE 3000

# Start the application
WORKDIR /workdir/apps/api
CMD ["node", "dist/src/index.js"]
