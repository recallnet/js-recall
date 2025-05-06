# .PriceApi

All URIs are relative to *http://localhost:3000*

Method | HTTP request | Description
------------- | ------------- | -------------
[**apiPriceGet**](PriceApi.md#apiPriceGet) | **GET** /api/price | Get price for a token
[**apiPriceTokenInfoGet**](PriceApi.md#apiPriceTokenInfoGet) | **GET** /api/price/token-info | Get detailed token information


# **apiPriceGet**
> ApiPriceGet200Response apiPriceGet()

Get the current price of a specified token

### Example


```typescript
import { createConfiguration, PriceApi } from '';
import type { PriceApiApiPriceGetRequest } from '';

const configuration = createConfiguration();
const apiInstance = new PriceApi(configuration);

const request: PriceApiApiPriceGetRequest = {
    // Token address
  token: "So11111111111111111111111111111111111111112",
    // Blockchain type of the token (optional)
  chain: "svm",
    // Specific chain for EVM tokens (optional)
  specificChain: "eth",
};

const data = await apiInstance.apiPriceGet(request);
console.log('API called successfully. Returned data:', data);
```


### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **token** | [**string**] | Token address | defaults to undefined
 **chain** | [**&#39;evm&#39; | &#39;svm&#39;**]**Array<&#39;evm&#39; &#124; &#39;svm&#39;>** | Blockchain type of the token | (optional) defaults to undefined
 **specificChain** | [**&#39;eth&#39; | &#39;polygon&#39; | &#39;bsc&#39; | &#39;arbitrum&#39; | &#39;optimism&#39; | &#39;avalanche&#39; | &#39;base&#39; | &#39;linea&#39; | &#39;zksync&#39; | &#39;scroll&#39; | &#39;mantle&#39; | &#39;svm&#39;**]**Array<&#39;eth&#39; &#124; &#39;polygon&#39; &#124; &#39;bsc&#39; &#124; &#39;arbitrum&#39; &#124; &#39;optimism&#39; &#124; &#39;avalanche&#39; &#124; &#39;base&#39; &#124; &#39;linea&#39; &#124; &#39;zksync&#39; &#124; &#39;scroll&#39; &#124; &#39;mantle&#39; &#124; &#39;svm&#39;>** | Specific chain for EVM tokens | (optional) defaults to undefined


### Return type

**ApiPriceGet200Response**

### Authorization

[BearerAuth](README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Token price information |  -  |
**400** | Invalid request parameters |  -  |
**401** | Unauthorized - Missing or invalid authentication |  -  |
**500** | Server error |  -  |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **apiPriceTokenInfoGet**
> ApiPriceTokenInfoGet200Response apiPriceTokenInfoGet()

Get detailed token information including price and specific chain

### Example


```typescript
import { createConfiguration, PriceApi } from '';
import type { PriceApiApiPriceTokenInfoGetRequest } from '';

const configuration = createConfiguration();
const apiInstance = new PriceApi(configuration);

const request: PriceApiApiPriceTokenInfoGetRequest = {
    // Token address
  token: "So11111111111111111111111111111111111111112",
    // Blockchain type of the token (optional)
  chain: "svm",
    // Specific chain for EVM tokens (optional)
  specificChain: "eth",
};

const data = await apiInstance.apiPriceTokenInfoGet(request);
console.log('API called successfully. Returned data:', data);
```


### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **token** | [**string**] | Token address | defaults to undefined
 **chain** | [**&#39;evm&#39; | &#39;svm&#39;**]**Array<&#39;evm&#39; &#124; &#39;svm&#39;>** | Blockchain type of the token | (optional) defaults to undefined
 **specificChain** | [**&#39;eth&#39; | &#39;polygon&#39; | &#39;bsc&#39; | &#39;arbitrum&#39; | &#39;optimism&#39; | &#39;avalanche&#39; | &#39;base&#39; | &#39;linea&#39; | &#39;zksync&#39; | &#39;scroll&#39; | &#39;mantle&#39; | &#39;svm&#39;**]**Array<&#39;eth&#39; &#124; &#39;polygon&#39; &#124; &#39;bsc&#39; &#124; &#39;arbitrum&#39; &#124; &#39;optimism&#39; &#124; &#39;avalanche&#39; &#124; &#39;base&#39; &#124; &#39;linea&#39; &#124; &#39;zksync&#39; &#124; &#39;scroll&#39; &#124; &#39;mantle&#39; &#124; &#39;svm&#39;>** | Specific chain for EVM tokens | (optional) defaults to undefined


### Return type

**ApiPriceTokenInfoGet200Response**

### Authorization

[BearerAuth](README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Token information |  -  |
**400** | Invalid request parameters |  -  |
**401** | Unauthorized - Missing or invalid authentication |  -  |
**500** | Server error |  -  |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)


