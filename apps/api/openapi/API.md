# Trading Simulator API

API for the Trading Simulator - a platform for simulated cryptocurrency trading competitions

## Authentication Guide

This API uses Bearer token authentication. All protected endpoints require the following header:

- **Authorization**: Bearer your-api-key

Where "your-api-key" is the API key provided during team registration.

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

### /api/account/profile

#### GET

##### Summary:

Get team profile

##### Description:

Get profile information for the authenticated team

##### Responses

| Code | Description                                      |
| ---- | ------------------------------------------------ |
| 200  | Team profile                                     |
| 401  | Unauthorized - Missing or invalid authentication |
| 404  | Team not found                                   |
| 500  | Server error                                     |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

#### PUT

##### Summary:

Update team profile

##### Description:

Update profile information for the authenticated team

##### Responses

| Code | Description                                      |
| ---- | ------------------------------------------------ |
| 200  | Updated team profile                             |
| 401  | Unauthorized - Missing or invalid authentication |
| 404  | Team not found                                   |
| 500  | Server error                                     |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

### /api/account/reset-api-key

#### POST

##### Summary:

Reset team API key

##### Description:

Reset the API key for the authenticated team. This will invalidate the current API key and generate a new one.

##### Responses

| Code | Description                                      |
| ---- | ------------------------------------------------ |
| 200  | API key reset successfully                       |
| 401  | Unauthorized - Missing or invalid authentication |
| 404  | Team not found                                   |
| 500  | Server error                                     |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

### /api/account/balances

#### GET

##### Summary:

Get token balances

##### Description:

Get all token balances for the authenticated team

##### Responses

| Code | Description                                      |
| ---- | ------------------------------------------------ |
| 200  | Team token balances                              |
| 401  | Unauthorized - Missing or invalid authentication |
| 500  | Server error                                     |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

### /api/account/trades

#### GET

##### Summary:

Get trade history

##### Description:

Get trade history for the authenticated team

##### Responses

| Code | Description                                      |
| ---- | ------------------------------------------------ |
| 200  | Team trade history                               |
| 401  | Unauthorized - Missing or invalid authentication |
| 500  | Server error                                     |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

### /api/account/portfolio

#### GET

##### Summary:

Get portfolio information

##### Description:

Get portfolio valuation and token details for the authenticated team

##### Responses

| Code | Description                                      |
| ---- | ------------------------------------------------ |
| 200  | Team portfolio information                       |
| 401  | Unauthorized - Missing or invalid authentication |
| 500  | Server error                                     |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

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

### /api/admin/teams/register

#### POST

##### Summary:

Register a new team

##### Description:

Admin-only endpoint to register a new team. Admins create team accounts and distribute the generated API keys to team members. Teams cannot register themselves.

##### Responses

| Code | Description                                           |
| ---- | ----------------------------------------------------- |
| 201  | Team registered successfully                          |
| 400  | Missing required parameters or invalid wallet address |
| 409  | Team with this email or wallet address already exists |
| 500  | Server error                                          |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

### /api/admin/teams

#### GET

##### Summary:

List all teams

##### Description:

Get a list of all non-admin teams

##### Responses

| Code | Description                                  |
| ---- | -------------------------------------------- |
| 200  | List of teams                                |
| 401  | Unauthorized - Admin authentication required |
| 500  | Server error                                 |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

### /api/admin/teams/{teamId}/key

#### GET

##### Summary:

Get a team's API key

##### Description:

Retrieves the original API key for a team. Use this when teams lose or misplace their API key.

##### Parameters

| Name   | Located in | Description    | Required | Schema |
| ------ | ---------- | -------------- | -------- | ------ |
| teamId | path       | ID of the team | Yes      | string |

##### Responses

| Code | Description                                  |
| ---- | -------------------------------------------- |
| 200  | API key retrieved successfully               |
| 401  | Unauthorized - Admin authentication required |
| 403  | Cannot retrieve API key for admin accounts   |
| 404  | Team not found                               |
| 500  | Server error                                 |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

### /api/admin/teams/{teamId}

#### DELETE

##### Summary:

Delete a team

##### Description:

Permanently delete a team and all associated data

##### Parameters

| Name   | Located in | Description              | Required | Schema |
| ------ | ---------- | ------------------------ | -------- | ------ |
| teamId | path       | ID of the team to delete | Yes      | string |

##### Responses

| Code | Description                                  |
| ---- | -------------------------------------------- |
| 200  | Team deleted successfully                    |
| 400  | Team ID is required                          |
| 401  | Unauthorized - Admin authentication required |
| 403  | Cannot delete admin accounts                 |
| 404  | Team not found                               |
| 500  | Server error                                 |

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

Start a new or existing competition with specified teams. If competitionId is provided, it will start an existing competition. Otherwise, it will create and start a new one.

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

Get portfolio snapshots for a competition, optionally filtered by team

##### Parameters

| Name          | Located in | Description                          | Required | Schema |
| ------------- | ---------- | ------------------------------------ | -------- | ------ |
| competitionId | path       | ID of the competition                | Yes      | string |
| teamId        | query      | Optional team ID to filter snapshots | No       | string |

##### Responses

| Code | Description                                      |
| ---- | ------------------------------------------------ |
| 200  | Competition snapshots                            |
| 400  | Missing competitionId or team not in competition |
| 401  | Unauthorized - Admin authentication required     |
| 404  | Competition or team not found                    |
| 500  | Server error                                     |

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

### /api/admin/teams/{teamId}/deactivate

#### POST

##### Summary:

Deactivate a team

##### Description:

Deactivate a team from the competition. The team will no longer be able to perform any actions.

##### Parameters

| Name   | Located in | Description                  | Required | Schema |
| ------ | ---------- | ---------------------------- | -------- | ------ |
| teamId | path       | ID of the team to deactivate | Yes      | string |

##### Responses

| Code | Description                                  |
| ---- | -------------------------------------------- |
| 200  | Team deactivated successfully                |
| 400  | Missing required parameters                  |
| 401  | Unauthorized - Admin authentication required |
| 403  | Cannot deactivate admin accounts             |
| 404  | Team not found                               |
| 500  | Server error                                 |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

### /api/admin/teams/{teamId}/reactivate

#### POST

##### Summary:

Reactivate a team

##### Description:

Reactivate a previously deactivated team, allowing them to participate in the competition again.

##### Parameters

| Name   | Located in | Description                  | Required | Schema |
| ------ | ---------- | ---------------------------- | -------- | ------ |
| teamId | path       | ID of the team to reactivate | Yes      | string |

##### Responses

| Code | Description                                  |
| ---- | -------------------------------------------- |
| 200  | Team reactivated successfully                |
| 400  | Team is already active                       |
| 401  | Unauthorized - Admin authentication required |
| 404  | Team not found                               |
| 500  | Server error                                 |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| BearerAuth      |        |

### /api/admin/teams/search

#### GET

##### Summary:

Search for teams

##### Description:

Search for teams based on various criteria like email, name, wallet address, etc.

##### Parameters

| Name          | Located in | Description                                                     | Required | Schema  |
| ------------- | ---------- | --------------------------------------------------------------- | -------- | ------- |
| email         | query      | Partial match for team email                                    | No       | string  |
| name          | query      | Partial match for team name                                     | No       | string  |
| walletAddress | query      | Partial match for wallet address                                | No       | string  |
| contactPerson | query      | Partial match for contact person name                           | No       | string  |
| active        | query      | Filter by active status (true/false)                            | No       | boolean |
| includeAdmins | query      | Whether to include admin accounts in results (default is false) | No       | boolean |

##### Responses

| Code | Description                                  |
| ---- | -------------------------------------------- |
| 200  | List of teams matching search criteria       |
| 401  | Unauthorized - Admin authentication required |
| 500  | Server error                                 |

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

Verifies the SIWE message and signature, creates a session, and returns team info

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

| Code | Description                                                                                           |
| ---- | ----------------------------------------------------------------------------------------------------- |
| 200  | Competition leaderboard                                                                               |
| 400  | Bad request - No active competition and no competitionId provided                                     |
| 401  | Unauthorized - Missing or invalid authentication                                                      |
| 403  | Forbidden - Access denied due to permission restrictions or team not participating in the competition |
| 404  | Competition not found                                                                                 |
| 500  | Server error                                                                                          |

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

| Code | Description                                           |
| ---- | ----------------------------------------------------- |
| 200  | Competition rules retrieved successfully              |
| 400  | Bad request - No active competition                   |
| 401  | Unauthorized - Missing or invalid authentication      |
| 403  | Forbidden - Team not participating in the competition |
| 500  | Server error                                          |

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
| teamId            | string   | Team ID that executed the trade              | No       |
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
