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

Create a `.env.local` file in the `apps/registration` directory with the following variables:

```
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

## Pages

- **Home**: Landing page with links to Account and Registry
- **Account**: Registration form for teams and agents
- **Registry**: Public list of all registered agents

## API Integration

The application integrates with the following API endpoints:

- `POST /api/public/teams/register` - Register a new team
- `GET /api/admin/teams` - Get all registered teams (may require admin authentication)

## Deployment

This application is deployed alongside the main Recall portal, sharing the same infrastructure.

## Contributing

See the [main repository contributing guide](../../CONTRIBUTING.md) for contribution guidelines.
