# .AdminApi

All URIs are relative to *http://localhost:3000*

Method | HTTP request | Description
------------- | ------------- | -------------
[**apiAdminCompetitionCompetitionIdSnapshotsGet**](AdminApi.md#apiAdminCompetitionCompetitionIdSnapshotsGet) | **GET** /api/admin/competition/{competitionId}/snapshots | Get competition snapshots
[**apiAdminCompetitionCreatePost**](AdminApi.md#apiAdminCompetitionCreatePost) | **POST** /api/admin/competition/create | Create a competition
[**apiAdminCompetitionEndPost**](AdminApi.md#apiAdminCompetitionEndPost) | **POST** /api/admin/competition/end | End a competition
[**apiAdminCompetitionStartPost**](AdminApi.md#apiAdminCompetitionStartPost) | **POST** /api/admin/competition/start | Start a competition
[**apiAdminReportsPerformanceGet**](AdminApi.md#apiAdminReportsPerformanceGet) | **GET** /api/admin/reports/performance | Get performance reports
[**apiAdminSetupPost**](AdminApi.md#apiAdminSetupPost) | **POST** /api/admin/setup | Set up initial admin account
[**apiAdminTeamsGet**](AdminApi.md#apiAdminTeamsGet) | **GET** /api/admin/teams | List all teams
[**apiAdminTeamsRegisterPost**](AdminApi.md#apiAdminTeamsRegisterPost) | **POST** /api/admin/teams/register | Register a new team
[**apiAdminTeamsTeamIdDeactivatePost**](AdminApi.md#apiAdminTeamsTeamIdDeactivatePost) | **POST** /api/admin/teams/{teamId}/deactivate | Deactivate a team
[**apiAdminTeamsTeamIdDelete**](AdminApi.md#apiAdminTeamsTeamIdDelete) | **DELETE** /api/admin/teams/{teamId} | Delete a team
[**apiAdminTeamsTeamIdKeyGet**](AdminApi.md#apiAdminTeamsTeamIdKeyGet) | **GET** /api/admin/teams/{teamId}/key | Get a team\&#39;s API key
[**apiAdminTeamsTeamIdReactivatePost**](AdminApi.md#apiAdminTeamsTeamIdReactivatePost) | **POST** /api/admin/teams/{teamId}/reactivate | Reactivate a team


# **apiAdminCompetitionCompetitionIdSnapshotsGet**
> ApiAdminCompetitionCompetitionIdSnapshotsGet200Response apiAdminCompetitionCompetitionIdSnapshotsGet()

Get portfolio snapshots for a competition, optionally filtered by team

### Example


```typescript
import { createConfiguration, AdminApi } from '';
import type { AdminApiApiAdminCompetitionCompetitionIdSnapshotsGetRequest } from '';

const configuration = createConfiguration();
const apiInstance = new AdminApi(configuration);

const request: AdminApiApiAdminCompetitionCompetitionIdSnapshotsGetRequest = {
    // ID of the competition
  competitionId: "competitionId_example",
    // Optional team ID to filter snapshots (optional)
  teamId: "teamId_example",
};

const data = await apiInstance.apiAdminCompetitionCompetitionIdSnapshotsGet(request);
console.log('API called successfully. Returned data:', data);
```


### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **competitionId** | [**string**] | ID of the competition | defaults to undefined
 **teamId** | [**string**] | Optional team ID to filter snapshots | (optional) defaults to undefined


### Return type

**ApiAdminCompetitionCompetitionIdSnapshotsGet200Response**

### Authorization

[BearerAuth](README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Competition snapshots |  -  |
**400** | Missing competitionId or team not in competition |  -  |
**401** | Unauthorized - Admin authentication required |  -  |
**404** | Competition or team not found |  -  |
**500** | Server error |  -  |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **apiAdminCompetitionCreatePost**
> ApiAdminCompetitionCreatePost201Response apiAdminCompetitionCreatePost(apiAdminCompetitionCreatePostRequest)

Create a new competition without starting it. It will be in PENDING status and can be started later.

### Example


```typescript
import { createConfiguration, AdminApi } from '';
import type { AdminApiApiAdminCompetitionCreatePostRequest } from '';

const configuration = createConfiguration();
const apiInstance = new AdminApi(configuration);

const request: AdminApiApiAdminCompetitionCreatePostRequest = {
  
  apiAdminCompetitionCreatePostRequest: {
    name: "Spring 2023 Trading Competition",
    description: "A trading competition for the spring semester",
    allowCrossChainTrading: false,
  },
};

const data = await apiInstance.apiAdminCompetitionCreatePost(request);
console.log('API called successfully. Returned data:', data);
```


### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **apiAdminCompetitionCreatePostRequest** | **ApiAdminCompetitionCreatePostRequest**|  |


### Return type

**ApiAdminCompetitionCreatePost201Response**

### Authorization

[BearerAuth](README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
**201** | Competition created successfully |  -  |
**400** | Missing required parameters |  -  |
**401** | Unauthorized - Admin authentication required |  -  |
**500** | Server error |  -  |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **apiAdminCompetitionEndPost**
> ApiAdminCompetitionEndPost200Response apiAdminCompetitionEndPost(apiAdminCompetitionEndPostRequest)

End an active competition and finalize the results

### Example


```typescript
import { createConfiguration, AdminApi } from '';
import type { AdminApiApiAdminCompetitionEndPostRequest } from '';

const configuration = createConfiguration();
const apiInstance = new AdminApi(configuration);

const request: AdminApiApiAdminCompetitionEndPostRequest = {
  
  apiAdminCompetitionEndPostRequest: {
    competitionId: "competitionId_example",
  },
};

const data = await apiInstance.apiAdminCompetitionEndPost(request);
console.log('API called successfully. Returned data:', data);
```


### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **apiAdminCompetitionEndPostRequest** | **ApiAdminCompetitionEndPostRequest**|  |


### Return type

**ApiAdminCompetitionEndPost200Response**

### Authorization

[BearerAuth](README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Competition ended successfully |  -  |
**400** | Missing competitionId parameter |  -  |
**401** | Unauthorized - Admin authentication required |  -  |
**404** | Competition not found |  -  |
**500** | Server error |  -  |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **apiAdminCompetitionStartPost**
> ApiAdminCompetitionStartPost200Response apiAdminCompetitionStartPost(apiAdminCompetitionStartPostRequest)

Start a new or existing competition with specified teams. If competitionId is provided, it will start an existing competition. Otherwise, it will create and start a new one.

### Example


```typescript
import { createConfiguration, AdminApi } from '';
import type { AdminApiApiAdminCompetitionStartPostRequest } from '';

const configuration = createConfiguration();
const apiInstance = new AdminApi(configuration);

const request: AdminApiApiAdminCompetitionStartPostRequest = {
  
  apiAdminCompetitionStartPostRequest: {
    competitionId: "competitionId_example",
    name: "Spring 2023 Trading Competition",
    description: "A trading competition for the spring semester",
    teamIds: [
      "teamIds_example",
    ],
    allowCrossChainTrading: false,
  },
};

const data = await apiInstance.apiAdminCompetitionStartPost(request);
console.log('API called successfully. Returned data:', data);
```


### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **apiAdminCompetitionStartPostRequest** | **ApiAdminCompetitionStartPostRequest**|  |


### Return type

**ApiAdminCompetitionStartPost200Response**

### Authorization

[BearerAuth](README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Competition started successfully |  -  |
**400** | Missing required parameters |  -  |
**401** | Unauthorized - Admin authentication required |  -  |
**404** | Competition not found when using competitionId |  -  |
**500** | Server error |  -  |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **apiAdminReportsPerformanceGet**
> ApiAdminReportsPerformanceGet200Response apiAdminReportsPerformanceGet()

Get performance reports and leaderboard for a competition

### Example


```typescript
import { createConfiguration, AdminApi } from '';
import type { AdminApiApiAdminReportsPerformanceGetRequest } from '';

const configuration = createConfiguration();
const apiInstance = new AdminApi(configuration);

const request: AdminApiApiAdminReportsPerformanceGetRequest = {
    // ID of the competition
  competitionId: "competitionId_example",
};

const data = await apiInstance.apiAdminReportsPerformanceGet(request);
console.log('API called successfully. Returned data:', data);
```


### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **competitionId** | [**string**] | ID of the competition | defaults to undefined


### Return type

**ApiAdminReportsPerformanceGet200Response**

### Authorization

[BearerAuth](README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Performance reports |  -  |
**400** | Missing competitionId parameter |  -  |
**401** | Unauthorized - Admin authentication required |  -  |
**404** | Competition not found |  -  |
**500** | Server error |  -  |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **apiAdminSetupPost**
> ApiAdminSetupPost201Response apiAdminSetupPost(apiAdminSetupPostRequest)

Creates the first admin account. This endpoint is only available when no admin exists in the system.

### Example


```typescript
import { createConfiguration, AdminApi } from '';
import type { AdminApiApiAdminSetupPostRequest } from '';

const configuration = createConfiguration();
const apiInstance = new AdminApi(configuration);

const request: AdminApiApiAdminSetupPostRequest = {
  
  apiAdminSetupPostRequest: {
    username: "admin",
    password: "password123",
    email: "admin@example.com",
  },
};

const data = await apiInstance.apiAdminSetupPost(request);
console.log('API called successfully. Returned data:', data);
```


### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **apiAdminSetupPostRequest** | **ApiAdminSetupPostRequest**|  |


### Return type

**ApiAdminSetupPost201Response**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
**201** | Admin account created successfully |  -  |
**400** | Missing required parameters or password too short |  -  |
**403** | Admin setup not allowed - an admin account already exists |  -  |
**500** | Server error |  -  |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **apiAdminTeamsGet**
> ApiAdminTeamsGet200Response apiAdminTeamsGet()

Get a list of all non-admin teams

### Example


```typescript
import { createConfiguration, AdminApi } from '';

const configuration = createConfiguration();
const apiInstance = new AdminApi(configuration);

const request = {};

const data = await apiInstance.apiAdminTeamsGet(request);
console.log('API called successfully. Returned data:', data);
```


### Parameters
This endpoint does not need any parameter.


### Return type

**ApiAdminTeamsGet200Response**

### Authorization

[BearerAuth](README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | List of teams |  -  |
**401** | Unauthorized - Admin authentication required |  -  |
**500** | Server error |  -  |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **apiAdminTeamsRegisterPost**
> ApiAdminTeamsRegisterPost201Response apiAdminTeamsRegisterPost(apiAdminTeamsRegisterPostRequest)

Admin-only endpoint to register a new team. Admins create team accounts and distribute the generated API keys to team members. Teams cannot register themselves.

### Example


```typescript
import { createConfiguration, AdminApi } from '';
import type { AdminApiApiAdminTeamsRegisterPostRequest } from '';

const configuration = createConfiguration();
const apiInstance = new AdminApi(configuration);

const request: AdminApiApiAdminTeamsRegisterPostRequest = {
  
  apiAdminTeamsRegisterPostRequest: {
    teamName: "Team Alpha",
    email: "team@example.com",
    contactPerson: "John Doe",
    walletAddress: "1.0392900530713021E+47",
    metadata: {},
  },
};

const data = await apiInstance.apiAdminTeamsRegisterPost(request);
console.log('API called successfully. Returned data:', data);
```


### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **apiAdminTeamsRegisterPostRequest** | **ApiAdminTeamsRegisterPostRequest**|  |


### Return type

**ApiAdminTeamsRegisterPost201Response**

### Authorization

[BearerAuth](README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
**201** | Team registered successfully |  -  |
**400** | Missing required parameters or invalid wallet address |  -  |
**409** | Team with this email or wallet address already exists |  -  |
**500** | Server error |  -  |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **apiAdminTeamsTeamIdDeactivatePost**
> ApiAdminTeamsTeamIdDeactivatePost200Response apiAdminTeamsTeamIdDeactivatePost(apiAdminTeamsTeamIdDeactivatePostRequest)

Deactivate a team from the competition. The team will no longer be able to perform any actions.

### Example


```typescript
import { createConfiguration, AdminApi } from '';
import type { AdminApiApiAdminTeamsTeamIdDeactivatePostRequest } from '';

const configuration = createConfiguration();
const apiInstance = new AdminApi(configuration);

const request: AdminApiApiAdminTeamsTeamIdDeactivatePostRequest = {
    // ID of the team to deactivate
  teamId: "teamId_example",
  
  apiAdminTeamsTeamIdDeactivatePostRequest: {
    reason: "Violated competition rules by using external API",
  },
};

const data = await apiInstance.apiAdminTeamsTeamIdDeactivatePost(request);
console.log('API called successfully. Returned data:', data);
```


### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **apiAdminTeamsTeamIdDeactivatePostRequest** | **ApiAdminTeamsTeamIdDeactivatePostRequest**|  |
 **teamId** | [**string**] | ID of the team to deactivate | defaults to undefined


### Return type

**ApiAdminTeamsTeamIdDeactivatePost200Response**

### Authorization

[BearerAuth](README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Team deactivated successfully |  -  |
**400** | Missing required parameters |  -  |
**401** | Unauthorized - Admin authentication required |  -  |
**403** | Cannot deactivate admin accounts |  -  |
**404** | Team not found |  -  |
**500** | Server error |  -  |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **apiAdminTeamsTeamIdDelete**
> ApiAdminTeamsTeamIdDelete200Response apiAdminTeamsTeamIdDelete()

Permanently delete a team and all associated data

### Example


```typescript
import { createConfiguration, AdminApi } from '';
import type { AdminApiApiAdminTeamsTeamIdDeleteRequest } from '';

const configuration = createConfiguration();
const apiInstance = new AdminApi(configuration);

const request: AdminApiApiAdminTeamsTeamIdDeleteRequest = {
    // ID of the team to delete
  teamId: "teamId_example",
};

const data = await apiInstance.apiAdminTeamsTeamIdDelete(request);
console.log('API called successfully. Returned data:', data);
```


### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **teamId** | [**string**] | ID of the team to delete | defaults to undefined


### Return type

**ApiAdminTeamsTeamIdDelete200Response**

### Authorization

[BearerAuth](README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Team deleted successfully |  -  |
**400** | Team ID is required |  -  |
**401** | Unauthorized - Admin authentication required |  -  |
**403** | Cannot delete admin accounts |  -  |
**404** | Team not found |  -  |
**500** | Server error |  -  |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **apiAdminTeamsTeamIdKeyGet**
> ApiAdminTeamsTeamIdKeyGet200Response apiAdminTeamsTeamIdKeyGet()

Retrieves the original API key for a team. Use this when teams lose or misplace their API key.

### Example


```typescript
import { createConfiguration, AdminApi } from '';
import type { AdminApiApiAdminTeamsTeamIdKeyGetRequest } from '';

const configuration = createConfiguration();
const apiInstance = new AdminApi(configuration);

const request: AdminApiApiAdminTeamsTeamIdKeyGetRequest = {
    // ID of the team
  teamId: "teamId_example",
};

const data = await apiInstance.apiAdminTeamsTeamIdKeyGet(request);
console.log('API called successfully. Returned data:', data);
```


### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **teamId** | [**string**] | ID of the team | defaults to undefined


### Return type

**ApiAdminTeamsTeamIdKeyGet200Response**

### Authorization

[BearerAuth](README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | API key retrieved successfully |  -  |
**401** | Unauthorized - Admin authentication required |  -  |
**403** | Cannot retrieve API key for admin accounts |  -  |
**404** | Team not found |  -  |
**500** | Server error |  -  |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **apiAdminTeamsTeamIdReactivatePost**
> ApiAdminTeamsTeamIdReactivatePost200Response apiAdminTeamsTeamIdReactivatePost()

Reactivate a previously deactivated team, allowing them to participate in the competition again.

### Example


```typescript
import { createConfiguration, AdminApi } from '';
import type { AdminApiApiAdminTeamsTeamIdReactivatePostRequest } from '';

const configuration = createConfiguration();
const apiInstance = new AdminApi(configuration);

const request: AdminApiApiAdminTeamsTeamIdReactivatePostRequest = {
    // ID of the team to reactivate
  teamId: "teamId_example",
};

const data = await apiInstance.apiAdminTeamsTeamIdReactivatePost(request);
console.log('API called successfully. Returned data:', data);
```


### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **teamId** | [**string**] | ID of the team to reactivate | defaults to undefined


### Return type

**ApiAdminTeamsTeamIdReactivatePost200Response**

### Authorization

[BearerAuth](README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Team reactivated successfully |  -  |
**400** | Team is already active |  -  |
**401** | Unauthorized - Admin authentication required |  -  |
**404** | Team not found |  -  |
**500** | Server error |  -  |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)


