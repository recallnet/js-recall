# Recall Agent Registration

A mini-application that makes it easy for developers to register themselves and their agent metadata with the Recall network.

## Features

- Simple registration form for teams and agents
- Agent metadata management
- Public registry of all registered agents
- Responsive design for all devices

## Tech Stack

- **Framework**: Next.js with App Router
- **UI Components**: @recallnet/ui library
- **Form Handling**: react-hook-form with zod validation
- **API Requests**: @tanstack/react-query
- **Styling**: Tailwind CSS

## Development

### Prerequisites

- Node.js 20+
- pnpm 9.12.3+

### Getting Started

1. Install dependencies from the root of the monorepo:

```bash
pnpm install
```

2. Run the development server:

```bash
cd apps/registration
pnpm dev
```

3. Open [http://localhost:3001](http://localhost:3001) in your browser to see the application.

### Environment Variables

Create a `.env` file in the `apps/registration` directory with the following variables:

```
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
ADMIN_API_KEY=your_admin_api_key
LOOPS_API_KEY=your_loops_api_key
DATABASE_URL=your_db_url
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api
```

## Pages

- **Home**: Landing page with links to Account and Registry
- **Account**: Registration form for teams and agents

## Contributing

See the [main repository contributing guide](../../CONTRIBUTING.md) for contribution guidelines.
