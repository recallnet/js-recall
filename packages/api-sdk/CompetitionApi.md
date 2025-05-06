# .CompetitionApi

All URIs are relative to *http://localhost:3000*

Method | HTTP request | Description
------------- | ------------- | -------------
[**apiCompetitionLeaderboardGet**](CompetitionApi.md#apiCompetitionLeaderboardGet) | **GET** /api/competition/leaderboard | Get competition leaderboard
[**apiCompetitionRulesGet**](CompetitionApi.md#apiCompetitionRulesGet) | **GET** /api/competition/rules | Get competition rules
[**apiCompetitionStatusGet**](CompetitionApi.md#apiCompetitionStatusGet) | **GET** /api/competition/status | Get competition status
[**apiCompetitionUpcomingGet**](CompetitionApi.md#apiCompetitionUpcomingGet) | **GET** /api/competition/upcoming | Get upcoming competitions


# **apiCompetitionLeaderboardGet**
> ApiCompetitionLeaderboardGet200Response apiCompetitionLeaderboardGet()

Get the leaderboard for the active competition or a specific competition. Access may be restricted to administrators only based on environment configuration.

### Example


```typescript
import { createConfiguration, CompetitionApi } from '';
import type { CompetitionApiApiCompetitionLeaderboardGetRequest } from '';

const configuration = createConfiguration();
const apiInstance = new CompetitionApi(configuration);

const request: CompetitionApiApiCompetitionLeaderboardGetRequest = {
    // Optional competition ID (if not provided, the active competition is used) (optional)
  competitionId: "competitionId_example",
};

const data = await apiInstance.apiCompetitionLeaderboardGet(request);
console.log('API called successfully. Returned data:', data);
```


### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **competitionId** | [**string**] | Optional competition ID (if not provided, the active competition is used) | (optional) defaults to undefined


### Return type

**ApiCompetitionLeaderboardGet200Response**

### Authorization

[BearerAuth](README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Competition leaderboard |  -  |
**400** | Bad request - No active competition and no competitionId provided |  -  |
**401** | Unauthorized - Missing or invalid authentication |  -  |
**403** | Forbidden - Access denied due to permission restrictions or team not participating in the competition |  -  |
**404** | Competition not found |  -  |
**500** | Server error |  -  |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **apiCompetitionRulesGet**
> ApiCompetitionRulesGet200Response apiCompetitionRulesGet()

Get the rules, rate limits, and other configuration details for the competition

### Example


```typescript
import { createConfiguration, CompetitionApi } from '';

const configuration = createConfiguration();
const apiInstance = new CompetitionApi(configuration);

const request = {};

const data = await apiInstance.apiCompetitionRulesGet(request);
console.log('API called successfully. Returned data:', data);
```


### Parameters
This endpoint does not need any parameter.


### Return type

**ApiCompetitionRulesGet200Response**

### Authorization

[BearerAuth](README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Competition rules retrieved successfully |  -  |
**400** | Bad request - No active competition |  -  |
**401** | Unauthorized - Missing or invalid authentication |  -  |
**403** | Forbidden - Team not participating in the competition |  -  |
**500** | Server error |  -  |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **apiCompetitionStatusGet**
> ApiCompetitionStatusGet200Response apiCompetitionStatusGet()

Get the status of the active competition

### Example


```typescript
import { createConfiguration, CompetitionApi } from '';

const configuration = createConfiguration();
const apiInstance = new CompetitionApi(configuration);

const request = {};

const data = await apiInstance.apiCompetitionStatusGet(request);
console.log('API called successfully. Returned data:', data);
```


### Parameters
This endpoint does not need any parameter.


### Return type

**ApiCompetitionStatusGet200Response**

### Authorization

[BearerAuth](README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Competition status |  -  |
**401** | Unauthorized - Missing or invalid authentication |  -  |
**500** | Server error |  -  |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **apiCompetitionUpcomingGet**
> ApiCompetitionUpcomingGet200Response apiCompetitionUpcomingGet()

Get all competitions that have not started yet (status=PENDING)

### Example


```typescript
import { createConfiguration, CompetitionApi } from '';

const configuration = createConfiguration();
const apiInstance = new CompetitionApi(configuration);

const request = {};

const data = await apiInstance.apiCompetitionUpcomingGet(request);
console.log('API called successfully. Returned data:', data);
```


### Parameters
This endpoint does not need any parameter.


### Return type

**ApiCompetitionUpcomingGet200Response**

### Authorization

[BearerAuth](README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Upcoming competitions retrieved successfully |  -  |
**401** | Unauthorized - Missing or invalid authentication |  -  |
**500** | Server error |  -  |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)


