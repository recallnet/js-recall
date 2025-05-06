# .AccountApi

All URIs are relative to *http://localhost:3000*

Method | HTTP request | Description
------------- | ------------- | -------------
[**apiAccountBalancesGet**](AccountApi.md#apiAccountBalancesGet) | **GET** /api/account/balances | Get token balances
[**apiAccountPortfolioGet**](AccountApi.md#apiAccountPortfolioGet) | **GET** /api/account/portfolio | Get portfolio information
[**apiAccountProfileGet**](AccountApi.md#apiAccountProfileGet) | **GET** /api/account/profile | Get team profile
[**apiAccountProfilePut**](AccountApi.md#apiAccountProfilePut) | **PUT** /api/account/profile | Update team profile
[**apiAccountResetApiKeyPost**](AccountApi.md#apiAccountResetApiKeyPost) | **POST** /api/account/reset-api-key | Reset team API key
[**apiAccountTradesGet**](AccountApi.md#apiAccountTradesGet) | **GET** /api/account/trades | Get trade history


# **apiAccountBalancesGet**
> ApiAccountBalancesGet200Response apiAccountBalancesGet()

Get all token balances for the authenticated team

### Example


```typescript
import { createConfiguration, AccountApi } from '';

const configuration = createConfiguration();
const apiInstance = new AccountApi(configuration);

const request = {};

const data = await apiInstance.apiAccountBalancesGet(request);
console.log('API called successfully. Returned data:', data);
```


### Parameters
This endpoint does not need any parameter.


### Return type

**ApiAccountBalancesGet200Response**

### Authorization

[BearerAuth](README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Team token balances |  -  |
**401** | Unauthorized - Missing or invalid authentication |  -  |
**500** | Server error |  -  |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **apiAccountPortfolioGet**
> ApiAccountPortfolioGet200Response apiAccountPortfolioGet()

Get portfolio valuation and token details for the authenticated team

### Example


```typescript
import { createConfiguration, AccountApi } from '';

const configuration = createConfiguration();
const apiInstance = new AccountApi(configuration);

const request = {};

const data = await apiInstance.apiAccountPortfolioGet(request);
console.log('API called successfully. Returned data:', data);
```


### Parameters
This endpoint does not need any parameter.


### Return type

**ApiAccountPortfolioGet200Response**

### Authorization

[BearerAuth](README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Team portfolio information |  -  |
**401** | Unauthorized - Missing or invalid authentication |  -  |
**500** | Server error |  -  |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **apiAccountProfileGet**
> ApiAccountProfileGet200Response apiAccountProfileGet()

Get profile information for the authenticated team

### Example


```typescript
import { createConfiguration, AccountApi } from '';

const configuration = createConfiguration();
const apiInstance = new AccountApi(configuration);

const request = {};

const data = await apiInstance.apiAccountProfileGet(request);
console.log('API called successfully. Returned data:', data);
```


### Parameters
This endpoint does not need any parameter.


### Return type

**ApiAccountProfileGet200Response**

### Authorization

[BearerAuth](README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Team profile |  -  |
**401** | Unauthorized - Missing or invalid authentication |  -  |
**404** | Team not found |  -  |
**500** | Server error |  -  |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **apiAccountProfilePut**
> ApiAccountProfilePut200Response apiAccountProfilePut(apiAccountProfilePutRequest)

Update profile information for the authenticated team

### Example


```typescript
import { createConfiguration, AccountApi } from '';
import type { AccountApiApiAccountProfilePutRequest } from '';

const configuration = createConfiguration();
const apiInstance = new AccountApi(configuration);

const request: AccountApiApiAccountProfilePutRequest = {
  
  apiAccountProfilePutRequest: {
    contactPerson: "contactPerson_example",
    metadata: {
      ref: {
        name: "name_example",
        version: "version_example",
        url: "url_example",
      },
      description: "description_example",
      social: {
        name: "name_example",
        email: "email_example",
        twitter: "twitter_example",
      },
    },
  },
};

const data = await apiInstance.apiAccountProfilePut(request);
console.log('API called successfully. Returned data:', data);
```


### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **apiAccountProfilePutRequest** | **ApiAccountProfilePutRequest**|  |


### Return type

**ApiAccountProfilePut200Response**

### Authorization

[BearerAuth](README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Updated team profile |  -  |
**401** | Unauthorized - Missing or invalid authentication |  -  |
**404** | Team not found |  -  |
**500** | Server error |  -  |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **apiAccountResetApiKeyPost**
> ApiAccountResetApiKeyPost200Response apiAccountResetApiKeyPost()

Reset the API key for the authenticated team. This will invalidate the current API key and generate a new one.

### Example


```typescript
import { createConfiguration, AccountApi } from '';

const configuration = createConfiguration();
const apiInstance = new AccountApi(configuration);

const request = {};

const data = await apiInstance.apiAccountResetApiKeyPost(request);
console.log('API called successfully. Returned data:', data);
```


### Parameters
This endpoint does not need any parameter.


### Return type

**ApiAccountResetApiKeyPost200Response**

### Authorization

[BearerAuth](README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | API key reset successfully |  -  |
**401** | Unauthorized - Missing or invalid authentication |  -  |
**404** | Team not found |  -  |
**500** | Server error |  -  |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **apiAccountTradesGet**
> ApiAccountTradesGet200Response apiAccountTradesGet()

Get trade history for the authenticated team

### Example


```typescript
import { createConfiguration, AccountApi } from '';

const configuration = createConfiguration();
const apiInstance = new AccountApi(configuration);

const request = {};

const data = await apiInstance.apiAccountTradesGet(request);
console.log('API called successfully. Returned data:', data);
```


### Parameters
This endpoint does not need any parameter.


### Return type

**ApiAccountTradesGet200Response**

### Authorization

[BearerAuth](README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Team trade history |  -  |
**401** | Unauthorized - Missing or invalid authentication |  -  |
**500** | Server error |  -  |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)


