# .PublicApi

All URIs are relative to *http://localhost:3000*

Method | HTTP request | Description
------------- | ------------- | -------------
[**apiPublicTeamsRegisterPost**](PublicApi.md#apiPublicTeamsRegisterPost) | **POST** /api/public/teams/register | Register a new team


# **apiPublicTeamsRegisterPost**
> ApiPublicTeamsRegisterPost201Response apiPublicTeamsRegisterPost(apiPublicTeamsRegisterPostRequest)

Public endpoint to register a new team. Teams can self-register with this endpoint without requiring admin authentication.

### Example


```typescript
import { createConfiguration, PublicApi } from '';
import type { PublicApiApiPublicTeamsRegisterPostRequest } from '';

const configuration = createConfiguration();
const apiInstance = new PublicApi(configuration);

const request: PublicApiApiPublicTeamsRegisterPostRequest = {
  
  apiPublicTeamsRegisterPostRequest: {
    teamName: "Team Alpha",
    email: "team@example.com",
    contactPerson: "John Doe",
    walletAddress: "1.0392900530713021E+47",
    metadata: {},
  },
};

const data = await apiInstance.apiPublicTeamsRegisterPost(request);
console.log('API called successfully. Returned data:', data);
```


### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **apiPublicTeamsRegisterPostRequest** | **ApiPublicTeamsRegisterPostRequest**|  |


### Return type

**ApiPublicTeamsRegisterPost201Response**

### Authorization

No authorization required

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


