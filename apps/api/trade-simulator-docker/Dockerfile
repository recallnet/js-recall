FROM node:22

WORKDIR /workdir
COPY . .

# # Build the application
RUN npm -g install pnpm typescript turbo
RUN cd apps/api; pnpm install
RUN cd packages/api-sdk; pnpm build
RUN cd apps/api; pnpm build

RUN groupadd app && useradd -g app app && chown -R app:app /workdir

# Set environment variables
ENV NODE_ENV=production

# Expose the application port
EXPOSE 3000

USER app

# Start the application
WORKDIR /workdir/apps/api
CMD ["node", "dist/src/index.js"]
