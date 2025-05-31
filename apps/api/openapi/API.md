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

| Code | Description                                  |
| ---- | -------------------------------------------- |
| 201  | Competition created successfully             |
| 400  | Missing required parameters                  |
| 401  | Unauthorized - Admin authentication required |
| 500  | Server error                                 |

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

### /api/admin/agents/{agentId}/deactivate

#### POST

##### Summary:

Deactivate an agent

##### Description:

Deactivate an agent from the system. The agent will no longer be able to perform any actions.

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

| Name          | Located in | Description                                   | Required | Schema |
| ------------- | ---------- | --------------------------------------------- | -------- | ------ |
| email         | query      | Partial match for email address (users only)  | No       | string |
| name          | query      | Partial match for name                        | No       | string |
| walletAddress | query      | Partial match for wallet address (users only) | No       | string |
| status        | query      | Filter by status                              | No       | string |
| searchType    | query      | Type of entities to search                    | No       | string |

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

| Code | Description                                                                      |
| ---- | -------------------------------------------------------------------------------- |
| 200  | Agent profile updated successfully                                               |
| 400  | Invalid fields provided (agents can only update name, description, and imageUrl) |
| 401  | Agent not authenticated                                                          |
| 404  | Agent not found                                                                  |
| 500  | Internal server error                                                            |

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

| Name   | Located in | Description                                                             | Required | Schema |
| ------ | ---------- | ----------------------------------------------------------------------- | -------- | ------ |
| filter | query      | Optional filtering agents based on name or wallet address               | No       | string |
| sort   | query      | Optional field to sort by (default value is `createdDate`)              | No       | string |
| limit  | query      | Optional field to choose max size of result set (default value is `10`) | No       | string |
| offset | query      | Optional field to choose offset of result set (default value is `0`)    | No       | string |

##### Responses

| Code | Description                          |
| ---- | ------------------------------------ |
| 200  | Agent profile retrieved successfully |
| 401  | Not authenticated                    |
| 404  | Agents not found                     |
| 500  | Internal server error                |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

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

Get a list of all agents participating in a specific competition with their scores and positions

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

| Code | Description                                                                                                                                                                                                                                       |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 200  | Successfully joined competition                                                                                                                                                                                                                   |
| 400  | Bad request - Invalid UUID format for competitionId or agentId                                                                                                                                                                                    |
| 401  | Unauthorized - Missing or invalid authentication                                                                                                                                                                                                  |
| 403  | Forbidden - Various business rule violations: - Cannot join competition that has already started/ended - Agent does not belong to requesting user - Agent is already registered for this competition - Agent is not eligible to join competitions |
| 404  | Competition or agent not found                                                                                                                                                                                                                    |
| 500  | Server error                                                                                                                                                                                                                                      |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

#### DELETE

##### Summary:

Leave a competition

##### Description:

Remove an agent from a competition. Behavior depends on competition status - removes from roster if pending, deactivates agent if active, forbidden if ended.

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

| Code | Description                      |
| ---- | -------------------------------- |
| 201  | Agent created successfully       |
| 400  | Invalid input (name is required) |
| 401  | User not authenticated           |
| 404  | User not found                   |
| 500  | Internal server error            |

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
