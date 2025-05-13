# Registration Mini-Application Instructions

## Overview

This document outlines the requirements and implementation guidelines for building a mini-application that serves as a frontend for the public registration route in the API. The application will allow developers to easily register themselves and their agent metadata.

## Application Structure

The application will consist of:

1. **Account Page** - A main dashboard where users can:

   - View their registration information
   - See information about the agents they've registered
   - Create or update their information

2. **Agent Registry Page** - A public page displaying all registered agents (using admin API endpoint)

## Technical Requirements

### General Guidelines

- Follow TypeScript best practices as outlined in the organization's standards
- Maintain comprehensive TSDoc documentation for all components and functions
- Ensure the application is accessible and responsive
- Implement proper error handling and loading states
- Follow the existing coding patterns and component structure from the portal workspace

### Stack and Libraries

Use the following technologies and libraries (already in use in the portal workspace):

- **Framework**: Next.js with App Router
- **UI Components**: `@recallnet/ui` library
- **Form Handling**: `react-hook-form` with `zod` validation
- **Styling**: Tailwind CSS (via `@recallnet/ui/globals.css`)
- **API Requests**: `@tanstack/react-query`
- **Wallet Connection**: `wagmi` and `@rainbow-me/rainbowkit` (if wallet integration is needed)

## Project Setup

1. Initialize the registration app with a structure similar to the portal app:

   - Create a `package.json` with necessary dependencies
   - Set up Next.js configuration files
   - Set up proper TypeScript configuration

2. Directory structure should follow Next.js App Router conventions:
   - `app/` - Main application code
   - `app/page.tsx` - Main landing page
   - `app/layout.tsx` - Root layout with providers
   - `app/account/page.tsx` - Account management page
   - `app/registry/page.tsx` - Agent registry page
   - `components/` - Reusable components
   - `lib/` - Utility functions and API clients
   - `types/` - TypeScript type definitions

## Implementation Details

### 1. API Integration

Create API client functions to interact with the following endpoints:

1. **Public Registration Endpoint**:

   - `POST /api/public/teams/register` - Register a new team
   - Parameters: `teamName`, `email`, `contactPerson`, `walletAddress` (optional), `metadata` (optional)

2. **Admin Endpoint** (for registry display):
   - `GET /api/admin/teams` - Get all registered teams
   - Note: This may require auth handling or proxy setup

### 2. Account Page

Implement a form with the following fields based on the API schema:

- Team Name (required)
- Email (required, with validation)
- Contact Person (required)
- Wallet Address (optional, with 0x validation)
- Agent Metadata section with nested fields:
  - Agent Name
  - Version
  - URL
  - Description
  - Social links (Twitter, email, etc.)

Include validation using zod schemas and react-hook-form.

### 3. Agent Registry Page

Create a page that:

- Fetches the list of all registered agents
- Displays them in a table or card layout
- Shows key information: Team Name, Agent Name, Description
- Provides filtering or search functionality
- Implements proper loading and error states

### 4. UI Components

Build the following components leveraging `@recallnet/ui`:

1. **Registration Form**:

   - Input fields with validation
   - Submit button with loading state
   - Success/error messaging

2. **Agent Card/List Item**:

   - Display agent information in a consistent format
   - Show metadata when available

3. **Page Layout**:
   - Consistent with portal app
   - Responsive design for various screen sizes

### 5. Authentication (if needed)

If the application requires authentication:

- Implement a simple authentication system
- Store API keys securely (client-side only during session)
- Add protected routes as needed

## User Flow

1. User visits the registration app
2. User can navigate to:
   - Account page to register/update their information
   - Registry page to view all registered agents
3. On the account page:
   - New users complete the registration form and submit
   - Existing users (identified by email or wallet) can update their information
4. On successful registration:
   - Show success message with API key
   - Prompt user to save API key securely
5. On the registry page:
   - Users can browse all registered agents
   - Search or filter by various criteria

## Development Process

1. Set up project structure and configuration
2. Implement the layout and basic navigation
3. Create API client functions for the required endpoints
4. Build the registration form with validation
5. Implement the agent registry display
6. Add proper error handling and loading states
7. Test all functionality
8. Optimize for performance and accessibility

## Deployment

The application will be deployed alongside the existing portal app, sharing the same infrastructure.

## Additional Considerations

- Ensure proper error messaging for API failures
- Implement form persistence to avoid data loss
- Add confirmation dialogs for important actions
- Consider adding analytics to track usage (using `@vercel/analytics`)
- Ensure the application is fully responsive for mobile devices

## Resources

- API Documentation: See OpenAPI docs in `apps/api/src/routes/public.routes.ts`
- UI Components: Available in `@recallnet/ui` package
- Existing Portal App: Reference the structure in `apps/portal`
