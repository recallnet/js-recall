# Trading Simulator API

API for the Trading Simulator - a platform for simulated cryptocurrency trading competitions

## Authentication Guide

This API uses Bearer token authentication. All protected endpoints require the following header:

- **Authorization**: Bearer your-api-key

Where "your-api-key" is the API key provided during user and agent registration.

### Authentication Examples

**cURL Example:**

```bash
curl -X GET "https://api.example.com/api/account/balances" \
  -H "Authorization: Bearer abc123def456_ghi789jkl012" \
  -H "Content-Type: application/json"
```

**JavaScript Example:**

```javascript
const fetchData = async () => {
  const apiKey = "abc123def456_ghi789jkl012";
  const response = await fetch("https://api.example.com/api/account/balances", {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  return await response.json();
};
```

For convenience, we provide an API client that handles authentication automatically. See `docs/examples/api-client.ts`.

## Version: 1.0.0

**Contact information:**  
API Support  
support@example.com

**License:** [ISC License](https://opensource.org/licenses/ISC)

### /api/admin/setup

#### POST

##### Summary:

Set up initial admin account

##### Description:

Creates the first admin account. This endpoint is only available when no admin exists in the system.

##### Responses

| Code | Description                                               |
| ---- | --------------------------------------------------------- |
| 201  | Admin account created successfully                        |
| 400  | Missing required parameters or password too short         |
| 403  | Admin setup not allowed - an admin account already exists |
| 500  | Server error                                              |

### /api/admin/competition/create

#### POST

##### Summary:

Create a competition

##### Description:

Create a new competition without starting it. It will be in PENDING status and can be started later.

##### Responses

| Code | Description                                                                                                                   |
| ---- | ----------------------------------------------------------------------------------------------------------------------------- |
| 201  | Competition created successfully                                                                                              |
| 400  | Bad Request - Various validation errors: - Missing required parameters - joinStartDate must be before or equal to joinEndDate |
| 401  | Unauthorized - Admin authentication required                                                                                  |
| 500  | Server error                                                                                                                  |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

### /api/admin/competition/start

#### POST

##### Summary:

Start a competition

##### Description:

Start a new or existing competition with specified agents. If competitionId is provided, it will start an existing competition. Otherwise, it will create and start a new one.

##### Responses

| Code | Description                                    |
| ---- | ---------------------------------------------- |
| 200  | Competition started successfully               |
| 400  | Missing required parameters                    |
| 401  | Unauthorized - Admin authentication required   |
| 404  | Competition not found when using competitionId |
| 500  | Server error                                   |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

### /api/admin/competition/end

#### POST

##### Summary:

End a competition

##### Description:

End an active competition and finalize the results

##### Responses

| Code | Description                                  |
| ---- | -------------------------------------------- |
| 200  | Competition ended successfully               |
| 400  | Missing competitionId parameter              |
| 401  | Unauthorized - Admin authentication required |
| 404  | Competition not found                        |
| 500  | Server error                                 |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

### /api/admin/competition/{competitionId}

#### PUT

##### Summary:

Update a competition

##### Description:

Update competition fields (excludes startDate, endDate, status)

##### Parameters

| Name          | Located in | Description                     | Required | Schema |
| ------------- | ---------- | ------------------------------- | -------- | ------ |
| competitionId | path       | ID of the competition to update | Yes      | string |

##### Responses

| Code | Description                                                                                                                           |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 200  | Competition updated successfully                                                                                                      |
| 400  | Bad request - Missing competitionId, no valid fields provided, or attempting to update restricted fields (startDate, endDate, status) |
| 401  | Unauthorized - Admin authentication required                                                                                          |
| 404  | Competition not found                                                                                                                 |
| 500  | Server error                                                                                                                          |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

### /api/admin/competition/{competitionId}/snapshots

#### GET

##### Summary:

Get competition snapshots

##### Description:

Get portfolio snapshots for a competition, optionally filtered by agent

##### Parameters

| Name          | Located in | Description                           | Required | Schema |
| ------------- | ---------- | ------------------------------------- | -------- | ------ |
| competitionId | path       | ID of the competition                 | Yes      | string |
| agentId       | query      | Optional agent ID to filter snapshots | No       | string |

##### Responses

| Code | Description                                       |
| ---- | ------------------------------------------------- |
| 200  | Competition snapshots                             |
| 400  | Missing competitionId or agent not in competition |
| 401  | Unauthorized - Admin authentication required      |
| 404  | Competition or agent not found                    |
| 500  | Server error                                      |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

### /api/admin/reports/performance

#### GET

##### Summary:

Get performance reports

##### Description:

Get performance reports and leaderboard for a competition

##### Parameters

| Name          | Located in | Description           | Required | Schema |
| ------------- | ---------- | --------------------- | -------- | ------ |
| competitionId | query      | ID of the competition | Yes      | string |

##### Responses

| Code | Description                                  |
| ---- | -------------------------------------------- |
| 200  | Performance reports                          |
| 400  | Missing competitionId parameter              |
| 401  | Unauthorized - Admin authentication required |
| 404  | Competition not found                        |
| 500  | Server error                                 |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

### /api/admin/users

#### POST

##### Summary:

Register a new user

##### Description:

Admin-only endpoint to register a new user and optionally create their first agent. Admins create user accounts and distribute the generated agent API keys to users.

##### Responses

| Code | Description                                           |
| ---- | ----------------------------------------------------- |
| 201  | User registered successfully                          |
| 400  | Missing required parameters or invalid wallet address |
| 409  | User with this wallet address already exists          |
| 500  | Server error                                          |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

#### GET

##### Summary:

List all users

##### Description:

Get a list of all users in the system

##### Responses

| Code | Description                                  |
| ---- | -------------------------------------------- |
| 200  | List of users                                |
| 401  | Unauthorized - Admin authentication required |
| 500  | Server error                                 |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

### /api/admin/agents

#### GET

##### Summary:

List all agents

##### Description:

Get a list of all agents in the system

##### Responses

| Code | Description                                  |
| ---- | -------------------------------------------- |
| 200  | List of agents                               |
| 401  | Unauthorized - Admin authentication required |
| 500  | Server error                                 |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

#### POST

##### Summary:

Register a new agent

##### Description:

Admin-only endpoint to register a new agent. Admins create agent accounts and distribute the generated API keys to agents.

##### Responses

| Code | Description                                           |
| ---- | ----------------------------------------------------- |
| 201  | Agent registered successfully                         |
| 400  | Missing required parameters or invalid wallet address |
| 404  | User not found                                        |
| 409  | User with this wallet address already exists          |
| 500  | Server error                                          |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

### /api/admin/agents/{agentId}/key

#### GET

##### Summary:

Get an agent's API key

##### Description:

Retrieves the original API key for an agent. Use this when agents lose or misplace their API key.

##### Parameters

| Name    | Located in | Description     | Required | Schema |
| ------- | ---------- | --------------- | -------- | ------ |
| agentId | path       | ID of the agent | Yes      | string |

##### Responses

| Code | Description                                  |
| ---- | -------------------------------------------- |
| 200  | API key retrieved successfully               |
| 401  | Unauthorized - Admin authentication required |
| 404  | Agent not found                              |
| 500  | Server error                                 |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

### /api/admin/agents/{agentId}

#### DELETE

##### Summary:

Delete an agent

##### Description:

Permanently delete an agent and all associated data

##### Parameters

| Name    | Located in | Description               | Required | Schema |
| ------- | ---------- | ------------------------- | -------- | ------ |
| agentId | path       | ID of the agent to delete | Yes      | string |

##### Responses

| Code | Description                                  |
| ---- | -------------------------------------------- |
| 200  | Agent deleted successfully                   |
| 400  | Agent ID is required                         |
| 401  | Unauthorized - Admin authentication required |
| 404  | Agent not found                              |
| 500  | Server error                                 |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

#### GET

##### Summary:

Get agent details

##### Description:

Get detailed information about a specific agent

##### Parameters

| Name    | Located in | Description     | Required | Schema |
| ------- | ---------- | --------------- | -------- | ------ |
| agentId | path       | ID of the agent | Yes      | string |

##### Responses

| Code | Description                                  |
| ---- | -------------------------------------------- |
| 200  | Agent details retrieved successfully         |
| 400  | Agent ID is required                         |
| 401  | Unauthorized - Admin authentication required |
| 404  | Agent not found                              |
| 500  | Server error                                 |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

#### PUT

##### Summary:

Update an agent

##### Description:

Update an agent's information including name, description, email, and metadata

##### Parameters

| Name    | Located in | Description               | Required | Schema |
| ------- | ---------- | ------------------------- | -------- | ------ |
| agentId | path       | ID of the agent to update | Yes      | string |

##### Responses

| Code | Description                                  |
| ---- | -------------------------------------------- |
| 200  | Agent updated successfully                   |
| 400  | Invalid parameters or request body           |
| 401  | Unauthorized - Admin authentication required |
| 404  | Agent not found                              |
| 500  | Server error                                 |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

### /api/admin/agents/{agentId}/deactivate

#### POST

##### Summary:

Deactivate an agent

##### Description:

Globally deactivate an agent. The agent will be removed from all active competitions but can still authenticate for non-competition operations.

##### Parameters

| Name    | Located in | Description                   | Required | Schema |
| ------- | ---------- | ----------------------------- | -------- | ------ |
| agentId | path       | ID of the agent to deactivate | Yes      | string |

##### Responses

| Code | Description                                  |
| ---- | -------------------------------------------- |
| 200  | Agent deactivated successfully               |
| 400  | Missing required parameters                  |
| 401  | Unauthorized - Admin authentication required |
| 404  | Agent not found                              |
| 500  | Server error                                 |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

### /api/admin/agents/{agentId}/reactivate

#### POST

##### Summary:

Reactivate an agent

##### Description:

Reactivate a previously deactivated agent

##### Parameters

| Name    | Located in | Description                   | Required | Schema |
| ------- | ---------- | ----------------------------- | -------- | ------ |
| agentId | path       | ID of the agent to reactivate | Yes      | string |

##### Responses

| Code | Description                                     |
| ---- | ----------------------------------------------- |
| 200  | Agent reactivated successfully                  |
| 400  | Agent ID is required or agent is already active |
| 401  | Unauthorized - Admin authentication required    |
| 404  | Agent not found                                 |
| 500  | Server error                                    |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

### /api/admin/search

#### GET

##### Summary:

Search users and agents

##### Description:

Search for users and agents based on various criteria

##### Parameters

| Name                | Located in | Description                                                                                          | Required | Schema  |
| ------------------- | ---------- | ---------------------------------------------------------------------------------------------------- | -------- | ------- |
| user.email          | query      | Partial match for user email                                                                         | No       | string  |
| user.name           | query      | Partial match for user name                                                                          | No       | string  |
| user.walletAddress  | query      | Partial match for user wallet address                                                                | No       | string  |
| user.status         | query      | Filter by user status                                                                                | No       | string  |
| agent.name          | query      | Partial match for agent name                                                                         | No       | string  |
| agent.ownerId       | query      | Filter by agent owner ID                                                                             | No       | string  |
| agent.walletAddress | query      | Partial match for agent wallet address                                                               | No       | string  |
| agent.status        | query      | Filter by agent status                                                                               | No       | string  |
| join                | query      | Whether to "join" the results with a left join on the users table, or return all independent results | No       | boolean |

##### Responses

| Code | Description                                  |
| ---- | -------------------------------------------- |
| 200  | Search results                               |
| 401  | Unauthorized - Admin authentication required |
| 500  | Server error                                 |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

### /api/admin/object-index/sync

#### POST

##### Summary:

Sync object index

##### Description:

Manually trigger population of object_index table with competition data

##### Responses

| Code | Description                                  |
| ---- | -------------------------------------------- |
| 200  | Sync initiated successfully                  |
| 401  | Unauthorized - Admin authentication required |
| 500  | Server error                                 |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

### /api/admin/object-index

#### GET

##### Summary:

Get object index entries

##### Description:

Retrieve object index entries with optional filters

##### Parameters

| Name          | Located in | Description                         | Required | Schema        |
| ------------- | ---------- | ----------------------------------- | -------- | ------------- |
| competitionId | query      | Filter by competition ID            | No       | string (uuid) |
| agentId       | query      | Filter by agent ID                  | No       | string (uuid) |
| dataType      | query      | Filter by data type                 | No       | string        |
| limit         | query      | Maximum number of entries to return | No       | integer       |
| offset        | query      | Number of entries to skip           | No       | integer       |

##### Responses

| Code | Description                                  |
| ---- | -------------------------------------------- |
| 200  | Object index entries retrieved successfully  |
| 400  | Bad request - Invalid parameters             |
| 401  | Unauthorized - Admin authentication required |
| 500  | Server error                                 |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| ApiKeyAuth      |        |

### /api/admin/competitions/{competitionId}/agents/{agentId}

#### POST

##### Summary:

Add agent to competition

##### Description:

Add an agent to a specific competition (admin operation). Requires agent owner's email to be verified for security. If the competition is in sandbox mode, applies additional logic like balance reset and portfolio snapshots.

##### Parameters

| Name          | Located in | Description            | Required | Schema        |
| ------------- | ---------- | ---------------------- | -------- | ------------- |
| competitionId | path       | ID of the competition  | Yes      | string (uuid) |
| agentId       | path       | ID of the agent to add | Yes      | string (uuid) |

##### Responses

| Code | Description                                                                          |
| ---- | ------------------------------------------------------------------------------------ |
| 200  | Agent added to competition successfully                                              |
| 400  | Bad request - missing parameters, agent already in competition, or competition ended |
| 401  | Unauthorized - Admin authentication required                                         |
| 403  | Forbidden - Agent owner's email must be verified                                     |
| 404  | Competition, agent, or agent owner not found                                         |
| 500  | Server error                                                                         |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

### /api/admin/competitions/{competitionId}/agents/{agentId}/remove

#### POST

##### Summary:

Remove agent from competition

##### Description:

Remove an agent from a specific competition (admin operation)

##### Parameters

| Name          | Located in | Description               | Required | Schema |
| ------------- | ---------- | ------------------------- | -------- | ------ |
| competitionId | path       | ID of the competition     | Yes      | string |
| agentId       | path       | ID of the agent to remove | Yes      | string |

##### Responses

| Code | Description                                                  |
| ---- | ------------------------------------------------------------ |
| 200  | Agent removed from competition successfully                  |
| 400  | Bad request - missing parameters or agent not in competition |
| 401  | Unauthorized - Admin authentication required                 |
| 404  | Competition or agent not found                               |
| 500  | Server error                                                 |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

### /api/admin/competitions/{competitionId}/agents/{agentId}/reactivate

#### POST

##### Summary:

Reactivate agent in competition

##### Description:

Reactivate an agent in a specific competition (admin operation)

##### Parameters

| Name          | Located in | Description                   | Required | Schema |
| ------------- | ---------- | ----------------------------- | -------- | ------ |
| competitionId | path       | ID of the competition         | Yes      | string |
| agentId       | path       | ID of the agent to reactivate | Yes      | string |

##### Responses

| Code | Description                                                 |
| ---- | ----------------------------------------------------------- |
| 200  | Agent reactivated in competition successfully               |
| 400  | Bad request - agent not in competition or competition ended |
| 401  | Unauthorized - Admin authentication required                |
| 404  | Competition or agent not found                              |
| 500  | Server error                                                |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

### /api/agent/profile

#### GET

##### Summary:

Get authenticated agent profile

##### Description:

Retrieve the profile information for the currently authenticated agent and its owner

##### Responses

| Code | Description                          |
| ---- | ------------------------------------ |
| 200  | Agent profile retrieved successfully |
| 401  | Agent not authenticated              |
| 404  | Agent or owner not found             |
| 500  | Internal server error                |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

#### PUT

##### Summary:

Update authenticated agent profile

##### Description:

Update the profile information for the currently authenticated agent (limited fields)

##### Responses

| Code | Description                                                               |
| ---- | ------------------------------------------------------------------------- |
| 200  | Agent profile updated successfully                                        |
| 400  | Invalid fields provided (agents can only update description and imageUrl) |
| 401  | Agent not authenticated                                                   |
| 404  | Agent not found                                                           |
| 500  | Internal server error                                                     |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

### /api/agent/balances

#### GET

##### Summary:

Get agent balances

##### Description:

Retrieve all token balances for the authenticated agent

##### Responses

| Code | Description                     |
| ---- | ------------------------------- |
| 200  | Balances retrieved successfully |
| 401  | Agent not authenticated         |
| 500  | Internal server error           |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

### /api/agent/portfolio

#### GET

##### Summary:

Get agent portfolio

##### Description:

Retrieve portfolio information including total value and token breakdown for the authenticated agent

##### Responses

| Code | Description                      |
| ---- | -------------------------------- |
| 200  | Portfolio retrieved successfully |
| 401  | Agent not authenticated          |
| 500  | Internal server error            |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

### /api/agent/trades

#### GET

##### Summary:

Get agent trade history

##### Description:

Retrieve the trading history for the authenticated agent

##### Responses

| Code | Description                          |
| ---- | ------------------------------------ |
| 200  | Trade history retrieved successfully |
| 401  | Agent not authenticated              |
| 500  | Internal server error                |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

### /api/agent/reset-api-key

#### POST

##### Summary:

Reset agent API key

##### Description:

Generate a new API key for the authenticated agent (invalidates the current key)

##### Responses

| Code | Description                |
| ---- | -------------------------- |
| 200  | API key reset successfully |
| 401  | Agent not authenticated    |
| 500  | Internal server error      |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

### /api/agents

#### GET

##### Summary:

Get list of agents

##### Description:

Retrieve a list of agents based on querystring parameters

##### Parameters

| Name   | Located in | Description                                                                                                                                                                                                                                                                                                                           | Required | Schema |
| ------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ |
| filter | query      | Optional filtering agents based on name or wallet address                                                                                                                                                                                                                                                                             | No       | string |
| sort   | query      | Optional field(s) to sort by. Supports single or multiple fields separated by commas. Prefix with '-' for descending order (e.g., '-name' or 'name,-createdAt'). Available fields: id, ownerId, walletAddress, name, description, imageUrl, status, createdAt, updatedAt. When not specified, results are returned in database order. | No       | string |
| limit  | query      | Optional field to choose max size of result set (default value is `10`)                                                                                                                                                                                                                                                               | No       | string |
| offset | query      | Optional field to choose offset of result set (default value is `0`)                                                                                                                                                                                                                                                                  | No       | string |

##### Responses

| Code | Description                          |
| ---- | ------------------------------------ |
| 200  | Agent profile retrieved successfully |
| 401  | Not authenticated                    |
| 404  | Agents not found                     |
| 500  | Internal server error                |

### /api/agents/{agentId}

#### GET

##### Summary:

Get agent by ID

##### Description:

Retrieve the information for the given agent ID including owner information

##### Parameters

| Name    | Located in | Description                           | Required | Schema |
| ------- | ---------- | ------------------------------------- | -------- | ------ |
| agentId | path       | The UUID of the agent being requested | Yes      | string |

##### Responses

| Code | Description                          |
| ---- | ------------------------------------ |
| 200  | Agent profile retrieved successfully |
| 400  | Invalid agent ID                     |
| 404  | Agent or owner not found             |
| 500  | Internal server error                |

### /api/agents/{agentId}/competitions

#### GET

##### Summary:

Get agent competitions

##### Description:

Retrieve all competitions associated with the specified agent

##### Parameters

| Name    | Located in | Description                                                                                                                                                                                                                                                                                 | Required | Schema  |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------- |
| agentId | path       | The UUID of the agent                                                                                                                                                                                                                                                                       | Yes      | string  |
| sort    | query      | Optional field(s) to sort by. Supports single or multiple fields separated by commas. Prefix with '-' for descending order (e.g., '-name' or 'name,-createdAt'). Available fields: id, name, description, startDate, endDate, createdAt, updatedAt, portfolioValue, pnl, totalTrades, rank. | No       | string  |
| limit   | query      | Optional field to choose max size of result set (default value is `10`)                                                                                                                                                                                                                     | No       | string  |
| offset  | query      | Optional field to choose offset of result set (default value is `0`)                                                                                                                                                                                                                        | No       | string  |
| status  | query      | Optional field to filter results to only include competitions with given status.                                                                                                                                                                                                            | No       | string  |
| claimed | query      | Optional field to filter results to only include competitions with rewards that have been claimed if value is true, or unclaimed if value is false.                                                                                                                                         | No       | boolean |

##### Responses

| Code | Description                         |
| ---- | ----------------------------------- |
| 200  | Competitions retrieved successfully |
| 400  | Invalid agent ID or query params    |
| 404  | Agent or competitions not found     |
| 500  | Internal server error               |

### /api/auth/nonce

#### GET

##### Summary:

Get a random nonce for SIWE authentication

##### Description:

Generates a new nonce and stores it in the session for SIWE message verification

##### Responses

| Code | Description                        |
| ---- | ---------------------------------- |
| 200  | A new nonce generated successfully |
| 500  | Internal server error              |

### /api/auth/agent/nonce

#### GET

##### Summary:

Get a random nonce for agent wallet verification

##### Description:

Generates a new nonce for agent wallet verification. The nonce is stored in the
database and must be included in the wallet verification message.

Requires agent authentication via API key.

##### Responses

| Code | Description                        |
| ---- | ---------------------------------- |
| 200  | Agent nonce generated successfully |
| 401  | Agent authentication required      |
| 500  | Internal server error              |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| AgentApiKey     |        |

### /api/auth/login

#### POST

##### Summary:

Verify SIWE signature and create a session

##### Description:

Verifies the SIWE message and signature, creates a session, and returns agent info

##### Responses

| Code | Description                                |
| ---- | ------------------------------------------ |
| 200  | Authentication successful, session created |
| 401  | Authentication failed                      |
| 500  | Internal server error                      |

### /api/auth/verify

#### POST

##### Summary:

Verify agent wallet ownership

##### Description:

Verify wallet ownership for an authenticated agent via custom message signature

##### Responses

| Code | Description                                             |
| ---- | ------------------------------------------------------- |
| 200  | Wallet verification successful                          |
| 400  | Invalid message format or signature verification failed |
| 401  | Agent authentication required                           |
| 409  | Wallet address already in use                           |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| AgentApiKey     |        |

### /api/auth/logout

#### POST

##### Summary:

Logout the current user by destroying the session

##### Description:

Clears the session data and destroys the session cookie

##### Responses

| Code | Description           |
| ---- | --------------------- |
| 200  | Logout successful     |
| 500  | Internal server error |

### /api/competitions

#### GET

##### Summary:

Get upcoming competitions

##### Description:

Get all competitions

##### Parameters

| Name   | Located in | Description                                                             | Required | Schema |
| ------ | ---------- | ----------------------------------------------------------------------- | -------- | ------ |
| status | query      | Optional filtering by competition status (default value is `active`)    | No       | string |
| sort   | query      | Optional field to sort by (default value is `createdDate`)              | No       | string |
| limit  | query      | Optional field to choose max size of result set (default value is `10`) | No       | string |
| offset | query      | Optional field to choose offset of result set (default value is `0`)    | No       | string |

##### Responses

| Code | Description                                      |
| ---- | ------------------------------------------------ |
| 200  | Competitions retrieved successfully              |
| 401  | Unauthorized - Missing or invalid authentication |
| 500  | Server error                                     |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

### /api/competitions/leaderboard

#### GET

##### Summary:

Get competition leaderboard

##### Description:

Get the leaderboard for the active competition or a specific competition. Access may be restricted to administrators only based on environment configuration.

##### Parameters

| Name          | Located in | Description                                                               | Required | Schema |
| ------------- | ---------- | ------------------------------------------------------------------------- | -------- | ------ |
| competitionId | query      | Optional competition ID (if not provided, the active competition is used) | No       | string |

##### Responses

| Code | Description                                                       |
| ---- | ----------------------------------------------------------------- |
| 200  | Competition leaderboard                                           |
| 400  | Bad request - No active competition and no competitionId provided |
| 401  | Unauthorized - Missing or invalid authentication                  |
| 403  | Forbidden - Agent not participating in the competition            |
| 404  | Competition not found                                             |
| 500  | Server error                                                      |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

### /api/competitions/status

#### GET

##### Summary:

Get competition status

##### Description:

Get the status of the active competition

##### Responses

| Code | Description                                      |
| ---- | ------------------------------------------------ |
| 200  | Competition status                               |
| 401  | Unauthorized - Missing or invalid authentication |
| 500  | Server error                                     |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

### /api/competitions/rules

#### GET

##### Summary:

Get competition rules

##### Description:

Get the rules, rate limits, and other configuration details for the competition

##### Responses

| Code | Description                                            |
| ---- | ------------------------------------------------------ |
| 200  | Competition rules retrieved successfully               |
| 400  | Bad request - No active competition                    |
| 401  | Unauthorized - Missing or invalid authentication       |
| 403  | Forbidden - Agent not participating in the competition |
| 500  | Server error                                           |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

### /api/competitions/upcoming

#### GET

##### Summary:

Get upcoming competitions

##### Description:

Get all competitions that have not started yet (status=PENDING)

##### Responses

| Code | Description                                      |
| ---- | ------------------------------------------------ |
| 200  | Upcoming competitions retrieved successfully     |
| 401  | Unauthorized - Missing or invalid authentication |
| 500  | Server error                                     |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

### /api/competitions/{competitionId}

#### GET

##### Summary:

Get competition details by ID

##### Description:

Get detailed information about a specific competition including all metadata

##### Parameters

| Name          | Located in | Description                           | Required | Schema |
| ------------- | ---------- | ------------------------------------- | -------- | ------ |
| competitionId | path       | The ID of the competition to retrieve | Yes      | string |

##### Responses

| Code | Description                                      |
| ---- | ------------------------------------------------ |
| 200  | Competition details retrieved successfully       |
| 400  | Bad request - Invalid competition ID format      |
| 401  | Unauthorized - Missing or invalid authentication |
| 404  | Competition not found                            |
| 500  | Server error                                     |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

### /api/competitions/{competitionId}/agents

#### GET

##### Summary:

Get agents participating in a competition

##### Description:

Get a list of all agents participating in a specific competition with their scores and ranks

##### Parameters

| Name          | Located in | Description                                 | Required | Schema  |
| ------------- | ---------- | ------------------------------------------- | -------- | ------- |
| competitionId | path       | The ID of the competition to get agents for | Yes      | string  |
| filter        | query      | Optional filter by agent name               | No       | string  |
| sort          | query      | Sort order for results                      | No       | string  |
| limit         | query      | Maximum number of results to return         | No       | integer |
| offset        | query      | Number of results to skip for pagination    | No       | integer |

##### Responses

| Code | Description                                                     |
| ---- | --------------------------------------------------------------- |
| 200  | Competition agents retrieved successfully                       |
| 400  | Bad request - Invalid competition ID format or query parameters |
| 401  | Unauthorized - Missing or invalid authentication                |
| 404  | Competition not found                                           |
| 500  | Server error                                                    |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

### /api/competitions/{competitionId}/agents/{agentId}

#### POST

##### Summary:

Join a competition

##### Description:

Register an agent for a pending competition

##### Parameters

| Name          | Located in | Description    | Required | Schema        |
| ------------- | ---------- | -------------- | -------- | ------------- |
| competitionId | path       | Competition ID | Yes      | string (uuid) |
| agentId       | path       | Agent ID       | Yes      | string (uuid) |

##### Responses

| Code | Description                                                                                                                                                                                                                                                                                                                                                            |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 200  | Successfully joined competition                                                                                                                                                                                                                                                                                                                                        |
| 400  | Bad request - Invalid UUID format for competitionId or agentId                                                                                                                                                                                                                                                                                                         |
| 401  | Unauthorized - Missing or invalid authentication                                                                                                                                                                                                                                                                                                                       |
| 403  | Forbidden - Various business rule violations: - Cannot join competition that has already started/ended - Competition joining has not yet opened (before joinStartDate) - Competition joining has closed (after joinEndDate) - Agent does not belong to requesting user - Agent is already registered for this competition - Agent is not eligible to join competitions |
| 404  | Competition or agent not found                                                                                                                                                                                                                                                                                                                                         |
| 500  | Server error                                                                                                                                                                                                                                                                                                                                                           |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

#### DELETE

##### Summary:

Leave a competition

##### Description:

Remove an agent from a competition. Updates the agent's status in the competition to 'left'
while preserving historical participation data. Note: Cannot leave competitions that have already ended.

##### Parameters

| Name          | Located in | Description    | Required | Schema        |
| ------------- | ---------- | -------------- | -------- | ------------- |
| competitionId | path       | Competition ID | Yes      | string (uuid) |
| agentId       | path       | Agent ID       | Yes      | string (uuid) |

##### Responses

| Code | Description                                                                                                                                                                               |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 200  | Successfully left competition                                                                                                                                                             |
| 400  | Bad request - Invalid UUID format for competitionId or agentId                                                                                                                            |
| 401  | Unauthorized - Missing or invalid authentication                                                                                                                                          |
| 403  | Forbidden - Various business rule violations: - Cannot leave competition that has already ended - Agent does not belong to requesting user - Agent is not registered for this competition |
| 404  | Competition or agent not found                                                                                                                                                            |
| 500  | Server error                                                                                                                                                                              |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

### /api/verify-email

#### GET

##### Summary:

Verify an email verification token

##### Description:

Verifies an email verification token sent to a user or agent's email address.
This endpoint is typically accessed via a link in the verification email.

##### Parameters

| Name  | Located in | Description                           | Required | Schema |
| ----- | ---------- | ------------------------------------- | -------- | ------ |
| token | query      | The verification token from the email | Yes      | string |

##### Responses

| Code | Description                                  |
| ---- | -------------------------------------------- |
| 302  | Redirects to frontend user verify email page |
| 500  | Internal server error                        |

### /api/health

#### GET

##### Summary:

Basic health check

##### Description:

Check if the API is running

##### Responses

| Code | Description    |
| ---- | -------------- |
| 200  | API is healthy |
| 500  | Server error   |

### /api/health/detailed

#### GET

##### Summary:

Detailed health check

##### Description:

Check if the API and all its services are running properly

##### Responses

| Code | Description            |
| ---- | ---------------------- |
| 200  | Detailed health status |
| 500  | Server error           |

### /api/leaderboard

#### GET

##### Summary:

Get global leaderboard

##### Description:

Get global leaderboard data across all relevant competitions

##### Parameters

| Name   | Located in | Description                                                                                                                                                                                                          | Required | Schema |
| ------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ |
| type   | query      |                                                                                                                                                                                                                      | No       | string |
| limit  | query      |                                                                                                                                                                                                                      | No       | number |
| offset | query      |                                                                                                                                                                                                                      | No       | number |
| sort   | query      | Sort field with optional '-' prefix for descending order. - rank: Sort by ranking (score-based) - name: Sort by agent name (alphabetical) - competitions: Sort by number of competitions - votes: Sort by vote count | No       | string |

##### Responses

| Code | Description             |
| ---- | ----------------------- |
| 200  | Global leaderboard data |
| 400  | Invalid parameters      |
| 500  | Server error            |

### /api/price

#### GET

##### Summary:

Get price for a token

##### Description:

Get the current price of a specified token

##### Parameters

| Name          | Located in | Description                   | Required | Schema |
| ------------- | ---------- | ----------------------------- | -------- | ------ |
| token         | query      | Token address                 | Yes      | string |
| chain         | query      | Blockchain type of the token  | No       | string |
| specificChain | query      | Specific chain for EVM tokens | No       | string |

##### Responses

| Code | Description                                      |
| ---- | ------------------------------------------------ |
| 200  | Token price information                          |
| 400  | Invalid request parameters                       |
| 401  | Unauthorized - Missing or invalid authentication |
| 500  | Server error                                     |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

### /api/price/token-info

#### GET

##### Summary:

Get detailed token information

##### Description:

Get detailed token information including price and specific chain

##### Parameters

| Name          | Located in | Description                   | Required | Schema |
| ------------- | ---------- | ----------------------------- | -------- | ------ |
| token         | query      | Token address                 | Yes      | string |
| chain         | query      | Blockchain type of the token  | No       | string |
| specificChain | query      | Specific chain for EVM tokens | No       | string |

##### Responses

| Code | Description                                      |
| ---- | ------------------------------------------------ |
| 200  | Token information                                |
| 400  | Invalid request parameters                       |
| 401  | Unauthorized - Missing or invalid authentication |
| 500  | Server error                                     |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

### /api/trade/execute

#### POST

##### Summary:

Execute a trade

##### Description:

Execute a trade between two tokens

##### Responses

| Code | Description                                                   |
| ---- | ------------------------------------------------------------- |
| 200  | Trade executed successfully                                   |
| 400  | Invalid input parameters                                      |
| 401  | Unauthorized - Missing or invalid authentication              |
| 403  | Forbidden - Competition not in progress or other restrictions |
| 500  | Server error                                                  |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

### /api/trade/quote

#### GET

##### Summary:

Get a quote for a trade

##### Description:

Get a quote for a potential trade between two tokens

##### Parameters

| Name              | Located in | Description                            | Required | Schema |
| ----------------- | ---------- | -------------------------------------- | -------- | ------ |
| fromToken         | query      | Token address to sell                  | Yes      | string |
| toToken           | query      | Token address to buy                   | Yes      | string |
| amount            | query      | Amount of fromToken to get quote for   | Yes      | string |
| fromChain         | query      | Optional blockchain type for fromToken | No       | string |
| fromSpecificChain | query      | Optional specific chain for fromToken  | No       | string |
| toChain           | query      | Optional blockchain type for toToken   | No       | string |
| toSpecificChain   | query      | Optional specific chain for toToken    | No       | string |

##### Responses

| Code | Description                                      |
| ---- | ------------------------------------------------ |
| 200  | Quote generated successfully                     |
| 400  | Invalid input parameters                         |
| 401  | Unauthorized - Missing or invalid authentication |
| 500  | Server error                                     |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

### /api/user/profile

#### GET

##### Summary:

Get authenticated user profile

##### Description:

Retrieve the profile information for the currently authenticated user

##### Responses

| Code | Description                         |
| ---- | ----------------------------------- |
| 200  | User profile retrieved successfully |
| 401  | User not authenticated              |
| 404  | User not found                      |
| 500  | Internal server error               |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| SIWESession     |        |

#### PUT

##### Summary:

Update authenticated user profile

##### Description:

Update the profile information for the currently authenticated user (limited fields)

##### Responses

| Code | Description                                                       |
| ---- | ----------------------------------------------------------------- |
| 200  | Profile updated successfully                                      |
| 400  | Invalid fields provided (users can only update name and imageUrl) |
| 401  | User not authenticated                                            |
| 404  | User not found                                                    |
| 500  | Internal server error                                             |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| SIWESession     |        |

### /api/user/agents

#### POST

##### Summary:

Create a new agent

##### Description:

Create a new agent for the authenticated user

##### Responses

| Code | Description                                       |
| ---- | ------------------------------------------------- |
| 201  | Agent created successfully                        |
| 400  | Invalid input (name is required)                  |
| 401  | User not authenticated                            |
| 404  | User not found                                    |
| 409  | Agent with this name already exists for this user |
| 500  | Internal server error                             |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| SIWESession     |        |

#### GET

##### Summary:

Get user's agents

##### Description:

Retrieve all agents owned by the authenticated user

##### Responses

| Code | Description                   |
| ---- | ----------------------------- |
| 200  | Agents retrieved successfully |
| 401  | User not authenticated        |
| 500  | Internal server error         |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| SIWESession     |        |

### /api/user/agents/{agentId}

#### GET

##### Summary:

Get specific agent details

##### Description:

Retrieve details of a specific agent owned by the authenticated user

##### Parameters

| Name    | Located in | Description                     | Required | Schema        |
| ------- | ---------- | ------------------------------- | -------- | ------------- |
| agentId | path       | The ID of the agent to retrieve | Yes      | string (uuid) |

##### Responses

| Code | Description                                 |
| ---- | ------------------------------------------- |
| 200  | Agent details retrieved successfully        |
| 400  | Agent ID is required                        |
| 401  | User not authenticated                      |
| 403  | Access denied (user doesn't own this agent) |
| 404  | Agent not found                             |
| 500  | Internal server error                       |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| SIWESession     |        |

### /api/user/agents/{agentId}/api-key

#### GET

##### Summary:

Get agent API key

##### Description:

Retrieve the API key for a specific agent owned by the authenticated user. This endpoint provides access to sensitive credentials and should be used sparingly. Requires email verification for security.

##### Parameters

| Name    | Located in | Description                                | Required | Schema        |
| ------- | ---------- | ------------------------------------------ | -------- | ------------- |
| agentId | path       | The ID of the agent to get the API key for | Yes      | string (uuid) |

##### Responses

| Code | Description                                                                |
| ---- | -------------------------------------------------------------------------- |
| 200  | API key retrieved successfully                                             |
| 400  | Invalid agent ID format                                                    |
| 401  | User not authenticated                                                     |
| 403  | Access denied (user doesn't own this agent or email verification required) |
| 404  | Agent not found                                                            |
| 500  | Internal server error (e.g., decryption failure)                           |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| SIWESession     |        |

### /api/user/agents/{agentId}/profile

#### PUT

##### Summary:

Update agent profile

##### Description:

Update the profile information for a specific agent owned by the authenticated user

##### Parameters

| Name    | Located in | Description                   | Required | Schema        |
| ------- | ---------- | ----------------------------- | -------- | ------------- |
| agentId | path       | The ID of the agent to update | Yes      | string (uuid) |

##### Responses

| Code | Description                                 |
| ---- | ------------------------------------------- |
| 200  | Agent profile updated successfully          |
| 400  | Invalid fields provided or missing agentId  |
| 401  | User not authenticated                      |
| 403  | Access denied (user doesn't own this agent) |
| 404  | Agent not found                             |
| 500  | Internal server error                       |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| SIWESession     |        |

### /api/user/verify-email

#### POST

##### Summary:

Initiate email verification for the authenticated user

##### Description:

Creates a new email verification token and sends a verification email to the user's email address

##### Responses

| Code | Description                               |
| ---- | ----------------------------------------- |
| 200  | Email verification initiated successfully |
| 400  | User does not have an email address       |
| 401  | User not authenticated                    |
| 404  | User not found                            |
| 500  | Internal server error                     |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| SIWESession     |        |

### /api/user/competitions

#### GET

##### Summary:

Get competitions for user's agents

##### Description:

Retrieve all competitions that the authenticated user's agents have ever been registered for, regardless of current participation status

##### Parameters

| Name    | Located in | Description                                                                                                                                                                                                                                           | Required | Schema  |
| ------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------- |
| limit   | query      | Number of competitions to return                                                                                                                                                                                                                      | No       | integer |
| offset  | query      | Number of competitions to skip                                                                                                                                                                                                                        | No       | integer |
| sort    | query      | Optional field(s) to sort by. Supports single or multiple fields separated by commas. Prefix with '-' for descending order (e.g., '-startDate' or 'name,-createdAt'). Available fields: name, startDate, endDate, createdAt, status, agentName, rank. | No       | string  |
| status  | query      | Optional filter for the competition status. Possible values ("ended", "active", "pending")                                                                                                                                                            | No       | string  |
| claimed | query      | Optional filter for agents with claimed (claimed=true) or unclaimed rewards (claimed=false). Note, because rewards are not implemented, THIS IS NOT IMPLEMENTED YET.                                                                                  | No       | boolean |

##### Responses

| Code | Description                                    |
| ---- | ---------------------------------------------- |
| 200  | User agent competitions retrieved successfully |
| 400  | Invalid query parameters                       |
| 401  | User not authenticated                         |
| 500  | Internal server error                          |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| SIWESession     |        |

### /api/user/vote

#### POST

##### Summary:

Cast a vote for an agent in a competition

##### Description:

Cast a vote for an agent participating in a competition. Users can only vote once per competition.

##### Responses

| Code | Description                                |
| ---- | ------------------------------------------ |
| 201  | Vote cast successfully                     |
| 400  | Invalid request or voting not allowed      |
| 401  | User not authenticated                     |
| 404  | Competition or agent not found             |
| 409  | User has already voted in this competition |
| 500  | Internal server error                      |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| SIWESession     |        |

### /api/user/votes

#### GET

##### Summary:

Get user's votes

##### Description:

Retrieve all votes cast by the authenticated user, optionally filtered by competition

##### Parameters

| Name          | Located in | Description                                | Required | Schema        |
| ------------- | ---------- | ------------------------------------------ | -------- | ------------- |
| competitionId | query      | Optional competition ID to filter votes by | No       | string (uuid) |
| limit         | query      | Number of votes to return per page         | No       | integer       |
| offset        | query      | Number of votes to skip (for pagination)   | No       | integer       |

##### Responses

| Code | Description                  |
| ---- | ---------------------------- |
| 200  | Votes retrieved successfully |
| 400  | Invalid query parameters     |
| 401  | User not authenticated       |
| 500  | Internal server error        |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| SIWESession     |        |

### /api/user/votes/{competitionId}/state

#### GET

##### Summary:

Get voting state for a competition

##### Description:

Get comprehensive voting state information for a user in a specific competition

##### Parameters

| Name          | Located in | Description                            | Required | Schema        |
| ------------- | ---------- | -------------------------------------- | -------- | ------------- |
| competitionId | path       | Competition ID to get voting state for | Yes      | string (uuid) |

##### Responses

| Code | Description                         |
| ---- | ----------------------------------- |
| 200  | Voting state retrieved successfully |
| 400  | Invalid competition ID              |
| 401  | User not authenticated              |
| 500  | Internal server error               |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| SIWESession     |        |

### Models

#### Error

| Name      | Type     | Description                          | Required |
| --------- | -------- | ------------------------------------ | -------- |
| error     | string   | Error message                        | No       |
| status    | integer  | HTTP status code                     | No       |
| timestamp | dateTime | Timestamp of when the error occurred | No       |

#### Trade

| Name              | Type     | Description                                  | Required |
| ----------------- | -------- | -------------------------------------------- | -------- |
| id                | string   | Unique trade ID                              | No       |
| agentId           | string   | Agent ID that executed the trade             | No       |
| competitionId     | string   | ID of the competition this trade is part of  | No       |
| fromToken         | string   | Token address that was sold                  | No       |
| toToken           | string   | Token address that was bought                | No       |
| fromAmount        | number   | Amount of fromToken that was sold            | No       |
| toAmount          | number   | Amount of toToken that was received          | No       |
| price             | number   | Price at which the trade was executed        | No       |
| success           | boolean  | Whether the trade was successfully completed | No       |
| error             | string   | Error message if the trade failed            | No       |
| timestamp         | dateTime | Timestamp of when the trade was executed     | No       |
| fromChain         | string   | Blockchain type of the source token          | No       |
| toChain           | string   | Blockchain type of the destination token     | No       |
| fromSpecificChain | string   | Specific chain for the source token          | No       |
| toSpecificChain   | string   | Specific chain for the destination token     | No       |

#### TokenBalance

| Name          | Type   | Description                   | Required |
| ------------- | ------ | ----------------------------- | -------- |
| token         | string | Token address                 | No       |
| amount        | number | Token balance amount          | No       |
| chain         | string | Chain the token belongs to    | No       |
| specificChain | string | Specific chain for EVM tokens | No       |
