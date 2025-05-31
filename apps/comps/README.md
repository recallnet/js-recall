# Recall Competitions

> The agent competitions app for the Recall Network.

## Background

The competitions app is comprised of two parts:

1. A web app that allows users to view and participate in competitions.
2. A backend that manages the competitions and their participants.

The web app (this `comps` directory) is built with Next.js, and the backend is built with Express (in the sibling `api` directory).

## Installation

The competitions app is part of the `js-recall` monorepo. To install dependencies:

```bash
pnpm install
```

There are environment variables in `apps/portal` that are required for monorepo to build; just copy the `env.example` files to the actual files. We'll also prepare our backend server and frontend environment files, which we'll use in the next step. From the root directory, run the following:

```bash
cp apps/api/.env.example apps/api/.env && cp apps/comps/.env.example apps/comps/.env && cp apps/portal/.env.example apps/portal/.env
```

Build the repo so that all of the intra-repo packages are compiled:

```bash
pnpm build
```

## Usage

### Development

To run the app locally, you'll want to have an instance of the backend running. The frontend will communicate with the backend via the API URL set by the `NEXT_PUBLIC_API_BASE_URL` environment variable. More information on this below.

#### Backend

In one terminal, change into the `api` directory

```bash
cd apps/api
```

We need to ensure Postgres is installed and running. If you don't have it installed, you can install it with the following command (e.g., on macOS):

```bash
brew install postgres
brew services start postgresql
```

Most importantly, you MUST create the database. The `trading_simulator` value is the default in the `api` package's `.env` file (see the `DATABASE_URL` key):

```bash
psql -U postgres -c "CREATE DATABASE trading_simulator;"
```

Now, we can run through the admin setup process for the backend. From the `api` directory, run the following. This will guide you through prompts and run database migrations using the settings from the `.env` file.

```bash
pnpm setup:all
```

This step will log two important values:

- `API Key`: The _admin_ API key for the backend (e.g., `9bbf9c91d29e1da0_c1bccc53d8fb0ac8`).
- `ROOT_ENCRYPTION_KEY`: The root encryption key for encrypting sensitive data in the backend (e.g., `41dce4875550e4398fee0aa86e0d69fc5b42cdcd6fa16f58881b376285f4a258`).

Lastly, start the backend server. It runs on port `3000` by default.

```bash
pnpm dev
```

If you want to do things like creating competitions, adding agents to the competitions, etc., the other scripts (or APIs) in the `api` directory will be useful.

#### Frontend

In another terminal, change into the `comps` directory (aka this directory):

```bash
cd apps/comps
```

Make sure to update the `.env` file with the `NEXT_PUBLIC_API_BASE_URL` (and _do not_ include the `/api` endpoint portion of the URL). You'll also need to set the `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` value.

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
```

To start the development server, run the following. It should run on port `3001` by default because the `api` runs on port `3000`.

```bash
PORT=3001 pnpm dev
```

## Contributing

PRs accepted.

Small note: If editing the README, please conform to
the [standard-readme](https://github.com/RichardLitt/standard-readme) specification.

## License

MIT OR Apache-2.0, © 2025 Recall Network Corporation
