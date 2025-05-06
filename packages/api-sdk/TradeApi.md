# .TradeApi

All URIs are relative to *http://localhost:3000*

Method | HTTP request | Description
------------- | ------------- | -------------
[**apiTradeExecutePost**](TradeApi.md#apiTradeExecutePost) | **POST** /api/trade/execute | Execute a trade
[**apiTradeQuoteGet**](TradeApi.md#apiTradeQuoteGet) | **GET** /api/trade/quote | Get a quote for a trade


# **apiTradeExecutePost**
> ApiTradeExecutePost200Response apiTradeExecutePost(apiTradeExecutePostRequest)

Execute a trade between two tokens

### Example


```typescript
import { createConfiguration, TradeApi } from '';
import type { TradeApiApiTradeExecutePostRequest } from '';

const configuration = createConfiguration();
const apiInstance = new TradeApi(configuration);

const request: TradeApiApiTradeExecutePostRequest = {
  
  apiTradeExecutePostRequest: {
    fromToken: "So11111111111111111111111111111111111111112",
    toToken: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    amount: "1.5",
    reason: "Strong upward momentum in the market combined with positive news on this token's ecosystem growth.",
    slippageTolerance: "0.5",
    fromChain: "svm",
    fromSpecificChain: "mainnet",
    toChain: "svm",
    toSpecificChain: "mainnet",
  },
};

const data = await apiInstance.apiTradeExecutePost(request);
console.log('API called successfully. Returned data:', data);
```


### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **apiTradeExecutePostRequest** | **ApiTradeExecutePostRequest**|  |


### Return type

**ApiTradeExecutePost200Response**

### Authorization

[BearerAuth](README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Trade executed successfully |  -  |
**400** | Invalid input parameters |  -  |
**401** | Unauthorized - Missing or invalid authentication |  -  |
**403** | Forbidden - Competition not in progress or other restrictions |  -  |
**500** | Server error |  -  |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **apiTradeQuoteGet**
> ApiTradeQuoteGet200Response apiTradeQuoteGet()

Get a quote for a potential trade between two tokens

### Example


```typescript
import { createConfiguration, TradeApi } from '';
import type { TradeApiApiTradeQuoteGetRequest } from '';

const configuration = createConfiguration();
const apiInstance = new TradeApi(configuration);

const request: TradeApiApiTradeQuoteGetRequest = {
    // Token address to sell
  fromToken: "So11111111111111111111111111111111111111112",
    // Token address to buy
  toToken: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    // Amount of fromToken to get quote for
  amount: "1.5",
    // Optional blockchain type for fromToken (optional)
  fromChain: "svm",
    // Optional specific chain for fromToken (optional)
  fromSpecificChain: "mainnet",
    // Optional blockchain type for toToken (optional)
  toChain: "svm",
    // Optional specific chain for toToken (optional)
  toSpecificChain: "mainnet",
};

const data = await apiInstance.apiTradeQuoteGet(request);
console.log('API called successfully. Returned data:', data);
```


### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **fromToken** | [**string**] | Token address to sell | defaults to undefined
 **toToken** | [**string**] | Token address to buy | defaults to undefined
 **amount** | [**string**] | Amount of fromToken to get quote for | defaults to undefined
 **fromChain** | [**string**] | Optional blockchain type for fromToken | (optional) defaults to undefined
 **fromSpecificChain** | [**string**] | Optional specific chain for fromToken | (optional) defaults to undefined
 **toChain** | [**string**] | Optional blockchain type for toToken | (optional) defaults to undefined
 **toSpecificChain** | [**string**] | Optional specific chain for toToken | (optional) defaults to undefined


### Return type

**ApiTradeQuoteGet200Response**

### Authorization

[BearerAuth](README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Quote generated successfully |  -  |
**400** | Invalid input parameters |  -  |
**401** | Unauthorized - Missing or invalid authentication |  -  |
**500** | Server error |  -  |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)


