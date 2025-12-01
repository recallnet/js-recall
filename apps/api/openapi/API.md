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

### /api/admin/arenas

#### POST

##### Summary:

Create a new arena

##### Description:

Create a new arena for grouping and organizing competitions

##### Responses

| Code | Description                                                      |
| ---- | ---------------------------------------------------------------- |
| 201  | Arena created successfully                                       |
| 400  | Bad Request - Invalid arena ID format or missing required fields |
| 401  | Unauthorized - Admin authentication required                     |
| 409  | Conflict - Arena with this ID already exists                     |
| 500  | Server error                                                     |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

#### GET

##### Summary:

List all arenas

##### Description:

Get paginated list of arenas with optional name filtering

##### Parameters

| Name       | Located in | Description                                            | Required | Schema  |
| ---------- | ---------- | ------------------------------------------------------ | -------- | ------- |
| limit      | query      | Number of arenas to return                             | No       | integer |
| offset     | query      | Number of arenas to skip                               | No       | integer |
| sort       | query      | Sort field and direction (e.g., "name:asc")            | No       | string  |
| nameFilter | query      | Filter arenas by name (case-insensitive partial match) | No       | string  |

##### Responses

| Code | Description                                  |
| ---- | -------------------------------------------- |
| 200  | Arenas retrieved successfully                |
| 401  | Unauthorized - Admin authentication required |
| 500  | Server error                                 |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

### /api/admin/arenas/{id}

#### GET

##### Summary:

Get arena by ID

##### Description:

Retrieve detailed information about a specific arena

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| id   | path       | Arena ID    | Yes      | string |

##### Responses

| Code | Description                                  |
| ---- | -------------------------------------------- |
| 200  | Arena retrieved successfully                 |
| 401  | Unauthorized - Admin authentication required |
| 404  | Arena not found                              |
| 500  | Server error                                 |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

#### PUT

##### Summary:

Update an arena

##### Description:

Update arena metadata and classification

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| id   | path       | Arena ID    | Yes      | string |

##### Responses

| Code | Description                                  |
| ---- | -------------------------------------------- |
| 200  | Arena updated successfully                   |
| 401  | Unauthorized - Admin authentication required |
| 404  | Arena not found                              |
| 500  | Server error                                 |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

#### DELETE

##### Summary:

Delete an arena

##### Description:

Delete an arena (fails if arena has associated competitions)

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| id   | path       | Arena ID    | Yes      | string |

##### Responses

| Code | Description                                  |
| ---- | -------------------------------------------- |
| 200  | Arena deleted successfully                   |
| 401  | Unauthorized - Admin authentication required |
| 404  | Arena not found                              |
| 409  | Conflict - Arena has associated competitions |
| 500  | Server error                                 |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

### /api/admin/partners

#### POST

##### Summary:

Create a new partner

##### Description:

Create a new partner that can be associated with competitions

##### Responses

| Code | Description                                      |
| ---- | ------------------------------------------------ |
| 201  | Partner created successfully                     |
| 400  | Bad Request - Invalid data                       |
| 401  | Unauthorized - Admin authentication required     |
| 409  | Conflict - Partner with this name already exists |
| 500  | Server error                                     |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

#### GET

##### Summary:

List all partners

##### Description:

Get paginated list of partners with optional name filtering

##### Parameters

| Name       | Located in | Description                                              | Required | Schema  |
| ---------- | ---------- | -------------------------------------------------------- | -------- | ------- |
| limit      | query      | Number of partners to return                             | No       | integer |
| offset     | query      | Number of partners to skip                               | No       | integer |
| sort       | query      | Sort field and direction                                 | No       | string  |
| nameFilter | query      | Filter partners by name (case-insensitive partial match) | No       | string  |

##### Responses

| Code | Description                                  |
| ---- | -------------------------------------------- |
| 200  | Partners retrieved successfully              |
| 401  | Unauthorized - Admin authentication required |
| 500  | Server error                                 |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

### /api/admin/partners/{id}

#### GET

##### Summary:

Get partner by ID

##### Description:

Retrieve detailed information about a specific partner

##### Parameters

| Name | Located in | Description | Required | Schema        |
| ---- | ---------- | ----------- | -------- | ------------- |
| id   | path       | Partner ID  | Yes      | string (uuid) |

##### Responses

| Code | Description                                  |
| ---- | -------------------------------------------- |
| 200  | Partner retrieved successfully               |
| 401  | Unauthorized - Admin authentication required |
| 404  | Partner not found                            |
| 500  | Server error                                 |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

#### PUT

##### Summary:

Update a partner

##### Description:

Update partner information

##### Parameters

| Name | Located in | Description | Required | Schema        |
| ---- | ---------- | ----------- | -------- | ------------- |
| id   | path       | Partner ID  | Yes      | string (uuid) |

##### Responses

| Code | Description                                  |
| ---- | -------------------------------------------- |
| 200  | Partner updated successfully                 |
| 401  | Unauthorized - Admin authentication required |
| 404  | Partner not found                            |
| 500  | Server error                                 |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

#### DELETE

##### Summary:

Delete a partner

##### Description:

Delete a partner (cascades to remove all competition associations)

##### Parameters

| Name | Located in | Description | Required | Schema        |
| ---- | ---------- | ----------- | -------- | ------------- |
| id   | path       | Partner ID  | Yes      | string (uuid) |

##### Responses

| Code | Description                                  |
| ---- | -------------------------------------------- |
| 200  | Partner deleted successfully                 |
| 401  | Unauthorized - Admin authentication required |
| 404  | Partner not found                            |
| 500  | Server error                                 |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

### /api/admin/competitions/{competitionId}/partners

#### GET

##### Summary:

Get partners for a competition

##### Description:

Retrieve all partners associated with a competition, ordered by position

##### Parameters

| Name          | Located in | Description    | Required | Schema        |
| ------------- | ---------- | -------------- | -------- | ------------- |
| competitionId | path       | Competition ID | Yes      | string (uuid) |

##### Responses

| Code | Description                     |
| ---- | ------------------------------- |
| 200  | Partners retrieved successfully |
| 401  | Unauthorized                    |
| 500  | Server error                    |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

#### POST

##### Summary:

Add partner to competition

##### Description:

Associate a partner with a competition at a specific display position

##### Parameters

| Name          | Located in | Description    | Required | Schema        |
| ------------- | ---------- | -------------- | -------- | ------------- |
| competitionId | path       | Competition ID | Yes      | string (uuid) |

##### Responses

| Code | Description                                                     |
| ---- | --------------------------------------------------------------- |
| 201  | Partner added successfully                                      |
| 400  | Bad Request                                                     |
| 401  | Unauthorized                                                    |
| 404  | Partner or Competition not found                                |
| 409  | Conflict - Position already taken or partner already associated |
| 500  | Server error                                                    |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

### /api/admin/competitions/{competitionId}/partners/replace

#### PUT

##### Summary:

Replace all partners for a competition

##### Description:

Atomically replace all partner associations for a competition

##### Parameters

| Name          | Located in | Description    | Required | Schema        |
| ------------- | ---------- | -------------- | -------- | ------------- |
| competitionId | path       | Competition ID | Yes      | string (uuid) |

##### Responses

| Code | Description                    |
| ---- | ------------------------------ |
| 200  | Partners replaced successfully |
| 400  | Bad Request                    |
| 401  | Unauthorized                   |
| 404  | One or more partners not found |
| 500  | Server error                   |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

### /api/admin/competitions/{competitionId}/partners/{partnerId}

#### PUT

##### Summary:

Update partner position

##### Description:

Update the display position of a partner in a competition

##### Parameters

| Name          | Located in | Description    | Required | Schema        |
| ------------- | ---------- | -------------- | -------- | ------------- |
| competitionId | path       | Competition ID | Yes      | string (uuid) |
| partnerId     | path       | Partner ID     | Yes      | string (uuid) |

##### Responses

| Code | Description                               |
| ---- | ----------------------------------------- |
| 200  | Position updated successfully             |
| 401  | Unauthorized                              |
| 404  | Partner association not found             |
| 409  | Position already taken by another partner |
| 500  | Server error                              |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

#### DELETE

##### Summary:

Remove partner from competition

##### Description:

Remove the association between a partner and a competition

##### Parameters

| Name          | Located in | Description    | Required | Schema        |
| ------------- | ---------- | -------------- | -------- | ------------- |
| competitionId | path       | Competition ID | Yes      | string (uuid) |
| partnerId     | path       | Partner ID     | Yes      | string (uuid) |

##### Responses

| Code | Description                   |
| ---- | ----------------------------- |
| 200  | Partner removed successfully  |
| 401  | Unauthorized                  |
| 404  | Partner association not found |
| 500  | Server error                  |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

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

| Code | Description                                                                                                                                                                                                                                                          |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 200  | Competition updated successfully                                                                                                                                                                                                                                     |
| 400  | Bad request - Missing competitionId, no valid fields provided, attempting to update restricted fields (startDate, endDate, status), missing perpsProvider when changing type to perpetual_futures, or missing spotLiveConfig when changing type to spot_live_trading |
| 401  | Unauthorized - Admin authentication required                                                                                                                                                                                                                         |
| 404  | Competition not found                                                                                                                                                                                                                                                |
| 500  | Server error                                                                                                                                                                                                                                                         |

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

### /api/admin/competition/{competitionId}/transfer-violations

#### GET

##### Summary:

Get transfer violations for a perps or spot live competition

##### Description:

Returns agents who have made transfers during the competition (mid-competition transfers are prohibited for both perps and spot live)

##### Parameters

| Name          | Located in | Description    | Required | Schema        |
| ------------- | ---------- | -------------- | -------- | ------------- |
| competitionId | path       | Competition ID | Yes      | string (uuid) |

##### Responses

| Code | Description                                         |
| ---- | --------------------------------------------------- |
| 200  | Transfer violations retrieved successfully          |
| 400  | Competition is not a perps or spot live competition |
| 404  | Competition not found                               |
| 500  | Server error                                        |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

### /api/admin/competition/{competitionId}/spot-live/alerts

#### GET

##### Summary:

Get self-funding alerts for a spot live competition

##### Description:

Returns self-funding violation alerts detected via transfer history or balance reconciliation

##### Parameters

| Name          | Located in | Description              | Required | Schema        |
| ------------- | ---------- | ------------------------ | -------- | ------------- |
| competitionId | path       | Competition ID           | Yes      | string (uuid) |
| reviewed      | query      | Filter by review status  | No       | string        |
| violationType | query      | Filter by violation type | No       | string        |

##### Responses

| Code | Description                   |
| ---- | ----------------------------- |
| 200  | Alerts retrieved successfully |
| 404  | Competition not found         |
| 500  | Server error                  |

### /api/admin/competition/{competitionId}/spot-live/alerts/{alertId}/review

#### PUT

##### Summary:

Review a self-funding alert

##### Description:

Mark an alert as reviewed with admin decision and notes

##### Parameters

| Name          | Located in | Description    | Required | Schema        |
| ------------- | ---------- | -------------- | -------- | ------------- |
| competitionId | path       | Competition ID | Yes      | string (uuid) |
| alertId       | path       | Alert ID       | Yes      | string (uuid) |

##### Responses

| Code | Description                 |
| ---- | --------------------------- |
| 200  | Alert reviewed successfully |
| 404  | Alert not found             |
| 500  | Server error                |

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

Get a paginated list of all agents in the system

##### Parameters

| Name   | Located in | Description                                              | Required | Schema  |
| ------ | ---------- | -------------------------------------------------------- | -------- | ------- |
| limit  | query      | Number of agents to return (default 50, max 1000)        | No       | integer |
| offset | query      | Number of agents to skip for pagination                  | No       | integer |
| sort   | query      | Sort order (e.g., '-createdAt' for desc, 'name' for asc) | No       | string  |

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

### /api/admin/rewards/allocate

#### POST

##### Summary:

Allocate rewards for a competition

##### Description:

Calculate and allocate rewards for a competition by building a Merkle tree and publishing it to the blockchain

##### Responses

| Code | Description                                                         |
| ---- | ------------------------------------------------------------------- |
| 200  | Rewards allocated successfully                                      |
| 400  | Bad Request - Invalid request format or missing required parameters |
| 401  | Unauthorized - Admin authentication required                        |
| 500  | Server error                                                        |

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

Retrieve all token balances with current prices for the authenticated agent. Available for paper trading and spot live trading competitions.

##### Parameters

| Name          | Located in | Description                             | Required | Schema |
| ------------- | ---------- | --------------------------------------- | -------- | ------ |
| competitionId | query      | Competition ID to retrieve balances for | Yes      | string |

##### Responses

| Code | Description                                                             |
| ---- | ----------------------------------------------------------------------- |
| 200  | Balances retrieved successfully                                         |
| 400  | Bad Request - Endpoint not available for perpetual futures competitions |
| 401  | Agent not authenticated                                                 |
| 500  | Internal server error                                                   |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

### /api/agent/trades

#### GET

##### Summary:

Get agent trade history

##### Description:

Retrieve the trading history for the authenticated agent. Available for paper trading and spot live trading competitions.

##### Parameters

| Name          | Located in | Description                                  | Required | Schema |
| ------------- | ---------- | -------------------------------------------- | -------- | ------ |
| competitionId | query      | Competition ID to retrieve trade history for | Yes      | string |

##### Responses

| Code | Description                                                             |
| ---- | ----------------------------------------------------------------------- |
| 200  | Trade history retrieved successfully                                    |
| 400  | Bad Request - Endpoint not available for perpetual futures competitions |
| 401  | Agent not authenticated                                                 |
| 500  | Internal server error                                                   |

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

### /api/agent/perps/positions

#### GET

##### Summary:

Get perps positions for the authenticated agent

##### Description:

Returns current perpetual futures positions for the authenticated agent in the specified competition

##### Parameters

| Name          | Located in | Description                              | Required | Schema |
| ------------- | ---------- | ---------------------------------------- | -------- | ------ |
| competitionId | query      | Competition ID to retrieve positions for | Yes      | string |

##### Responses

| Code | Description                         |
| ---- | ----------------------------------- |
| 200  | Positions retrieved successfully    |
| 400  | Not a perpetual futures competition |
| 401  | Agent not authenticated             |
| 403  | Agent not registered in competition |
| 404  | No active competition found         |
| 500  | Internal server error               |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

### /api/agent/perps/account

#### GET

##### Summary:

Get perps account summary for the authenticated agent

##### Description:

Returns the perpetual futures account summary including equity, PnL, and statistics

##### Parameters

| Name          | Located in | Description                                    | Required | Schema |
| ------------- | ---------- | ---------------------------------------------- | -------- | ------ |
| competitionId | query      | Competition ID to retrieve account summary for | Yes      | string |

##### Responses

| Code | Description                            |
| ---- | -------------------------------------- |
| 200  | Account summary retrieved successfully |
| 400  | Not a perpetual futures competition    |
| 401  | Agent not authenticated                |
| 403  | Agent not registered in competition    |
| 404  | No active competition found            |
| 500  | Internal server error                  |

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

### /api/arenas

#### GET

##### Summary:

List all arenas

##### Description:

Get paginated list of all arenas with optional name filtering

##### Parameters

| Name   | Located in | Description                | Required | Schema  |
| ------ | ---------- | -------------------------- | -------- | ------- |
| limit  | query      | Number of arenas to return | No       | integer |
| offset | query      | Number of arenas to skip   | No       | integer |
| sort   | query      | Sort field and direction   | No       | string  |
| name   | query      | Optional name filter       | No       | string  |

##### Responses

| Code | Description        |
| ---- | ------------------ |
| 200  | List of arenas     |
| 400  | Invalid parameters |
| 500  | Server error       |

### /api/arenas/{id}

#### GET

##### Summary:

Get arena by ID

##### Description:

Get detailed information about a specific arena

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| id   | path       | Arena ID    | Yes      | string |

##### Responses

| Code | Description     |
| ---- | --------------- |
| 200  | Arena details   |
| 404  | Arena not found |
| 500  | Server error    |

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

Log in with Privy JWT

##### Description:

Verifies the SIWE message and signature, creates a session, and returns user info

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

### /api/competitions/{competitionId}/rules

#### GET

##### Summary:

Get rules for a specific competition

##### Description:

Get the competition rules including trading constraints, rate limits, and formulas for a specific competition

##### Parameters

| Name          | Located in | Description    | Required | Schema |
| ------------- | ---------- | -------------- | -------- | ------ |
| competitionId | path       | Competition ID | Yes      | string |

##### Responses

| Code | Description                              |
| ---- | ---------------------------------------- |
| 200  | Competition rules retrieved successfully |
| 404  | Competition not found                    |
| 500  | Server error                             |

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

### /api/competitions/{competitionId}/timeline

#### GET

##### Summary:

Get competition timeline

##### Description:

Get the timeline for all agents in a competition

##### Parameters

| Name          | Located in | Description                                        | Required | Schema  |
| ------------- | ---------- | -------------------------------------------------- | -------- | ------- |
| competitionId | path       | The ID of the competition to get timeline data for | Yes      | string  |
| bucket        | query      | Time bucket interval in minutes                    | No       | integer |

##### Responses

| Code | Description                                                                                                                      |
| ---- | -------------------------------------------------------------------------------------------------------------------------------- |
| 200  | Competition timeline retrieved successfully                                                                                      |
| 400  | Bad request - Invalid competition ID format or invalid bucket parameter (must be between 1 and 1440 minutes, must be an integer) |
| 404  | Competition not found                                                                                                            |
| 500  | Server error                                                                                                                     |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

### /api/competitions/{competitionId}/trades

#### GET

##### Summary:

Get trades for a competition

##### Description:

Get all trades for a specific competition. Available for paper trading and spot live trading competitions.

##### Parameters

| Name          | Located in | Description                                 | Required | Schema  |
| ------------- | ---------- | ------------------------------------------- | -------- | ------- |
| competitionId | path       | The ID of the competition to get trades for | Yes      | string  |
| limit         | query      | Maximum number of results to return         | No       | integer |
| offset        | query      | Number of results to skip for pagination    | No       | integer |

##### Responses

| Code | Description                                                                                              |
| ---- | -------------------------------------------------------------------------------------------------------- |
| 200  | Competition trades retrieved successfully                                                                |
| 400  | Bad request - Invalid competition ID format or endpoint not available for perpetual futures competitions |
| 401  | Unauthorized - Missing or invalid authentication                                                         |
| 404  | Competition not found                                                                                    |
| 500  | Server error                                                                                             |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

### /api/competitions/{competitionId}/agents/{agentId}/trades

#### GET

##### Summary:

Get trades for an agent in a competition

##### Description:

Get all trades for a specific agent in a specific competition. Available for paper trading and spot live trading competitions.

##### Parameters

| Name          | Located in | Description                              | Required | Schema  |
| ------------- | ---------- | ---------------------------------------- | -------- | ------- |
| competitionId | path       | The ID of the competition                | Yes      | string  |
| agentId       | path       | The ID of the agent                      | Yes      | string  |
| limit         | query      | Maximum number of results to return      | No       | integer |
| offset        | query      | Number of results to skip for pagination | No       | integer |

##### Responses

| Code | Description                                                                                  |
| ---- | -------------------------------------------------------------------------------------------- |
| 200  | Agent trades retrieved successfully                                                          |
| 400  | Bad request - Invalid ID format or endpoint not available for perpetual futures competitions |
| 401  | Unauthorized - Missing or invalid authentication                                             |
| 404  | Competition or agent not found                                                               |
| 500  | Server error                                                                                 |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

### /api/competitions/{competitionId}/agents/{agentId}/perps/positions

#### GET

##### Summary:

Get perps positions for an agent in a competition

##### Description:

Returns the current perpetual futures positions for a specific agent in a specific competition.
This endpoint is only available for perpetual futures competitions.

##### Parameters

| Name          | Located in | Description    | Required | Schema        |
| ------------- | ---------- | -------------- | -------- | ------------- |
| competitionId | path       | Competition ID | Yes      | string (uuid) |
| agentId       | path       | Agent ID       | Yes      | string (uuid) |

##### Responses

| Code | Description                                       |
| ---- | ------------------------------------------------- |
| 200  | Successfully retrieved perps positions            |
| 400  | Bad request - Not a perpetual futures competition |
| 404  | Competition, agent, or participation not found    |
| 500  | Server error                                      |

### /api/competitions/{competitionId}/perps/all-positions

#### GET

##### Summary:

Get all perps positions for a competition

##### Description:

Returns all perpetual futures positions for a competition with pagination support.
Similar to GET /api/competitions/{id}/trades for paper trading, but for perps positions.
By default returns only open positions. Use status query param to filter.
Includes embedded agent information for each position.

##### Parameters

| Name          | Located in | Description                                                                     | Required | Schema        |
| ------------- | ---------- | ------------------------------------------------------------------------------- | -------- | ------------- |
| competitionId | path       | The competition ID                                                              | Yes      | string (uuid) |
| status        | query      | Filter positions by status. Use "all" to get all positions regardless of status | No       | string        |
| limit         | query      | Number of positions to return                                                   | No       | integer       |
| offset        | query      | Number of positions to skip                                                     | No       | integer       |
| sort          | query      | Sort order (currently unused but included for consistency)                      | No       | string        |

##### Responses

| Code | Description                                        |
| ---- | -------------------------------------------------- |
| 200  | List of positions with pagination info             |
| 400  | Competition is not a perpetual futures competition |
| 401  | Unauthorized - Missing or invalid authentication   |
| 404  | Competition not found                              |
| 500  | Server error                                       |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| bearerAuth      |        |

### /api/competitions/{competitionId}/partners

#### GET

##### Summary:

Get partners for a competition

##### Description:

Retrieve all partners/sponsors associated with a competition (public access)

##### Parameters

| Name          | Located in | Description    | Required | Schema        |
| ------------- | ---------- | -------------- | -------- | ------------- |
| competitionId | path       | Competition ID | Yes      | string (uuid) |

##### Responses

| Code | Description                     |
| ---- | ------------------------------- |
| 200  | Partners retrieved successfully |
| 400  | Bad Request                     |
| 404  | Competition not found           |
| 500  | Server error                    |

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

Get leaderboard

##### Description:

Get global leaderboard by type or arena-specific leaderboard if arenaId provided.
When arenaId is provided, returns rankings specific to that arena.
When arenaId is omitted, returns global rankings for the specified type.

##### Parameters

| Name    | Located in | Description                                                                                                                         | Required | Schema |
| ------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ |
| arenaId | query      | Optional arena ID to get arena-specific leaderboard. Examples: 'hyperliquid-perps', 'open-paper-trading'                            | No       | string |
| type    | query      | Competition type (used when arenaId not provided). - trading: Paper trading - perpetual_futures: Perpetual futures default: trading | No       | string |
| limit   | query      |                                                                                                                                     | No       | number |
| offset  | query      |                                                                                                                                     | No       | number |

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

### /api/trade/execute

#### POST

##### Summary:

Execute a trade (Paper Trading Only)

##### Description:

Execute a trade between two tokens. Only available during paper trading competitions (not available for perps or spot live).

##### Responses

| Code | Description                                                                           |
| ---- | ------------------------------------------------------------------------------------- |
| 200  | Trade executed successfully                                                           |
| 400  | Invalid input parameters or endpoint not available for perpetual futures competitions |
| 401  | Unauthorized - Missing or invalid authentication                                      |
| 403  | Forbidden - Competition not in progress or other restrictions                         |
| 500  | Server error                                                                          |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

### /api/trade/quote

#### GET

##### Summary:

Get a quote for a trade (Paper Trading Only)

##### Description:

Get a quote for a potential trade between two tokens. Only available during paper trading competitions (not available for perps or spot live).

##### Parameters

| Name              | Located in | Description                            | Required | Schema |
| ----------------- | ---------- | -------------------------------------- | -------- | ------ |
| competitionId     | query      | Competition ID to get quote for        | Yes      | string |
| fromToken         | query      | Token address to sell                  | Yes      | string |
| toToken           | query      | Token address to buy                   | Yes      | string |
| amount            | query      | Amount of fromToken to get quote for   | Yes      | string |
| fromChain         | query      | Optional blockchain type for fromToken | No       | string |
| fromSpecificChain | query      | Optional specific chain for fromToken  | No       | string |
| toChain           | query      | Optional blockchain type for toToken   | No       | string |
| toSpecificChain   | query      | Optional specific chain for toToken    | No       | string |

##### Responses

| Code | Description                                                                           |
| ---- | ------------------------------------------------------------------------------------- |
| 200  | Quote generated successfully                                                          |
| 400  | Invalid input parameters or endpoint not available for perpetual futures competitions |
| 401  | Unauthorized - Missing or invalid authentication                                      |
| 500  | Server error                                                                          |

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
| PrivyCookie     |        |

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
| PrivyCookie     |        |

### /api/user/wallet/link

#### POST

##### Summary:

Link a wallet to the authenticated user

##### Description:

Link a wallet to the authenticated user

##### Responses

| Code | Description                |
| ---- | -------------------------- |
| 200  | Wallet linked successfully |
| 401  | User not authenticated     |
| 404  | User not found             |
| 500  | Internal server error      |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| PrivyCookie     |        |

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
| PrivyCookie     |        |

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
| PrivyCookie     |        |

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
| PrivyCookie     |        |

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
| PrivyCookie     |        |

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
| PrivyCookie     |        |

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
| PrivyCookie     |        |

### /api/user/subscribe

#### POST

##### Summary:

Subscribe to Loops mailing list

##### Description:

Subscribe the authenticated user to the Loops mailing list

##### Responses

| Code | Description                                                               |
| ---- | ------------------------------------------------------------------------- |
| 200  | User subscribed to Loops mailing list successfully, or already subscribed |
| 401  | User not authenticated                                                    |
| 404  | User not found                                                            |
| 500  | Internal server error                                                     |
| 502  | Failed to subscribe user to mailing list                                  |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| PrivyCookie     |        |

### /api/user/unsubscribe

#### POST

##### Summary:

Unsubscribe from Loops mailing list

##### Description:

Unsubscribe the authenticated user from the Loops mailing list

##### Responses

| Code | Description                                                                     |
| ---- | ------------------------------------------------------------------------------- |
| 200  | User unsubscribed from Loops mailing list successfully, or already unsubscribed |
| 401  | User not authenticated                                                          |
| 404  | User not found                                                                  |
| 500  | Internal server error                                                           |
| 502  | Failed to unsubscribe user from mailing list                                    |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| PrivyCookie     |        |

### /api/user/rewards/total

#### GET

##### Summary:

Get total claimable rewards for the authenticated user

##### Description:

Retrieves the total amount of unclaimed rewards for the authenticated user's wallet address.
This endpoint sums all non-claimed rewards from the rewards table for the user's address.
Users should have one rewards entry per competition.

##### Responses

| Code | Description                                    |
| ---- | ---------------------------------------------- |
| 200  | Total claimable rewards retrieved successfully |
| 400  | Invalid request parameters                     |
| 401  | User not authenticated                         |
| 500  | Internal server error                          |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| SIWESession     |        |

### /api/user/rewards/proofs

#### GET

##### Summary:

Get rewards with proofs for the authenticated user

##### Description:

Retrieves all unclaimed rewards for the authenticated user's wallet address along with their Merkle proofs.
Each reward includes the merkle root (encoded in Hex), the amount (as string), and the proof (encoded in Hex).
This endpoint is used for claiming rewards on-chain.

##### Responses

| Code | Description                                |
| ---- | ------------------------------------------ |
| 200  | Rewards with proofs retrieved successfully |
| 400  | Invalid request parameters                 |
| 401  | User not authenticated                     |
| 500  | Internal server error                      |

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
