# .HealthApi

All URIs are relative to *http://localhost:3000*

Method | HTTP request | Description
------------- | ------------- | -------------
[**apiHealthDetailedGet**](HealthApi.md#apiHealthDetailedGet) | **GET** /api/health/detailed | Detailed health check
[**apiHealthGet**](HealthApi.md#apiHealthGet) | **GET** /api/health | Basic health check


# **apiHealthDetailedGet**
> ApiHealthDetailedGet200Response apiHealthDetailedGet()

Check if the API and all its services are running properly

### Example


```typescript
import { createConfiguration, HealthApi } from '';

const configuration = createConfiguration();
const apiInstance = new HealthApi(configuration);

const request = {};

const data = await apiInstance.apiHealthDetailedGet(request);
console.log('API called successfully. Returned data:', data);
```


### Parameters
This endpoint does not need any parameter.


### Return type

**ApiHealthDetailedGet200Response**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Detailed health status |  -  |
**500** | Server error |  -  |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **apiHealthGet**
> ApiHealthGet200Response apiHealthGet()

Check if the API is running

### Example


```typescript
import { createConfiguration, HealthApi } from '';

const configuration = createConfiguration();
const apiInstance = new HealthApi(configuration);

const request = {};

const data = await apiInstance.apiHealthGet(request);
console.log('API called successfully. Returned data:', data);
```


### Parameters
This endpoint does not need any parameter.


### Return type

**ApiHealthGet200Response**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | API is healthy |  -  |
**500** | Server error |  -  |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)


