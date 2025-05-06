// TODO: better import syntax?
import {BaseAPIRequestFactory, RequiredError, COLLECTION_FORMATS} from './baseapi';
import {Configuration} from '../configuration';
import {RequestContext, HttpMethod, ResponseContext, HttpFile, HttpInfo} from '../http/http';
import {ObjectSerializer} from '../models/ObjectSerializer';
import {ApiException} from './exception';
import {canConsumeForm, isCodeInRange} from '../util';
import {SecurityAuthentication} from '../auth/auth';


import { ApiTradeExecutePost200Response } from '../models/ApiTradeExecutePost200Response';
import { ApiTradeExecutePostRequest } from '../models/ApiTradeExecutePostRequest';
import { ApiTradeQuoteGet200Response } from '../models/ApiTradeQuoteGet200Response';

/**
 * no description
 */
export class TradeApiRequestFactory extends BaseAPIRequestFactory {

    /**
     * Execute a trade between two tokens
     * Execute a trade
     * @param apiTradeExecutePostRequest 
     */
    public async apiTradeExecutePost(apiTradeExecutePostRequest: ApiTradeExecutePostRequest, _options?: Configuration): Promise<RequestContext> {
        let _config = _options || this.configuration;

        // verify required parameter 'apiTradeExecutePostRequest' is not null or undefined
        if (apiTradeExecutePostRequest === null || apiTradeExecutePostRequest === undefined) {
            throw new RequiredError("TradeApi", "apiTradeExecutePost", "apiTradeExecutePostRequest");
        }


        // Path Params
        const localVarPath = '/api/trade/execute';

        // Make Request Context
        const requestContext = _config.baseServer.makeRequestContext(localVarPath, HttpMethod.POST);
        requestContext.setHeaderParam("Accept", "application/json, */*;q=0.8")


        // Body Params
        const contentType = ObjectSerializer.getPreferredMediaType([
            "application/json"
        ]);
        requestContext.setHeaderParam("Content-Type", contentType);
        const serializedBody = ObjectSerializer.stringify(
            ObjectSerializer.serialize(apiTradeExecutePostRequest, "ApiTradeExecutePostRequest", ""),
            contentType
        );
        requestContext.setBody(serializedBody);

        let authMethod: SecurityAuthentication | undefined;
        // Apply auth methods
        authMethod = _config.authMethods["BearerAuth"]
        if (authMethod?.applySecurityAuthentication) {
            await authMethod?.applySecurityAuthentication(requestContext);
        }
        
        const defaultAuth: SecurityAuthentication | undefined = _config?.authMethods?.default
        if (defaultAuth?.applySecurityAuthentication) {
            await defaultAuth?.applySecurityAuthentication(requestContext);
        }

        return requestContext;
    }

    /**
     * Get a quote for a potential trade between two tokens
     * Get a quote for a trade
     * @param fromToken Token address to sell
     * @param toToken Token address to buy
     * @param amount Amount of fromToken to get quote for
     * @param fromChain Optional blockchain type for fromToken
     * @param fromSpecificChain Optional specific chain for fromToken
     * @param toChain Optional blockchain type for toToken
     * @param toSpecificChain Optional specific chain for toToken
     */
    public async apiTradeQuoteGet(fromToken: string, toToken: string, amount: string, fromChain?: string, fromSpecificChain?: string, toChain?: string, toSpecificChain?: string, _options?: Configuration): Promise<RequestContext> {
        let _config = _options || this.configuration;

        // verify required parameter 'fromToken' is not null or undefined
        if (fromToken === null || fromToken === undefined) {
            throw new RequiredError("TradeApi", "apiTradeQuoteGet", "fromToken");
        }


        // verify required parameter 'toToken' is not null or undefined
        if (toToken === null || toToken === undefined) {
            throw new RequiredError("TradeApi", "apiTradeQuoteGet", "toToken");
        }


        // verify required parameter 'amount' is not null or undefined
        if (amount === null || amount === undefined) {
            throw new RequiredError("TradeApi", "apiTradeQuoteGet", "amount");
        }






        // Path Params
        const localVarPath = '/api/trade/quote';

        // Make Request Context
        const requestContext = _config.baseServer.makeRequestContext(localVarPath, HttpMethod.GET);
        requestContext.setHeaderParam("Accept", "application/json, */*;q=0.8")

        // Query Params
        if (fromToken !== undefined) {
            requestContext.setQueryParam("fromToken", ObjectSerializer.serialize(fromToken, "string", ""));
        }

        // Query Params
        if (toToken !== undefined) {
            requestContext.setQueryParam("toToken", ObjectSerializer.serialize(toToken, "string", ""));
        }

        // Query Params
        if (amount !== undefined) {
            requestContext.setQueryParam("amount", ObjectSerializer.serialize(amount, "string", ""));
        }

        // Query Params
        if (fromChain !== undefined) {
            requestContext.setQueryParam("fromChain", ObjectSerializer.serialize(fromChain, "string", ""));
        }

        // Query Params
        if (fromSpecificChain !== undefined) {
            requestContext.setQueryParam("fromSpecificChain", ObjectSerializer.serialize(fromSpecificChain, "string", ""));
        }

        // Query Params
        if (toChain !== undefined) {
            requestContext.setQueryParam("toChain", ObjectSerializer.serialize(toChain, "string", ""));
        }

        // Query Params
        if (toSpecificChain !== undefined) {
            requestContext.setQueryParam("toSpecificChain", ObjectSerializer.serialize(toSpecificChain, "string", ""));
        }


        let authMethod: SecurityAuthentication | undefined;
        // Apply auth methods
        authMethod = _config.authMethods["BearerAuth"]
        if (authMethod?.applySecurityAuthentication) {
            await authMethod?.applySecurityAuthentication(requestContext);
        }
        
        const defaultAuth: SecurityAuthentication | undefined = _config?.authMethods?.default
        if (defaultAuth?.applySecurityAuthentication) {
            await defaultAuth?.applySecurityAuthentication(requestContext);
        }

        return requestContext;
    }

}

export class TradeApiResponseProcessor {

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to apiTradeExecutePost
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async apiTradeExecutePostWithHttpInfo(response: ResponseContext): Promise<HttpInfo<ApiTradeExecutePost200Response >> {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: ApiTradeExecutePost200Response = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "ApiTradeExecutePost200Response", ""
            ) as ApiTradeExecutePost200Response;
            return new HttpInfo(response.httpStatusCode, response.headers, response.body, body);
        }
        if (isCodeInRange("400", response.httpStatusCode)) {
            throw new ApiException<undefined>(response.httpStatusCode, "Invalid input parameters", undefined, response.headers);
        }
        if (isCodeInRange("401", response.httpStatusCode)) {
            throw new ApiException<undefined>(response.httpStatusCode, "Unauthorized - Missing or invalid authentication", undefined, response.headers);
        }
        if (isCodeInRange("403", response.httpStatusCode)) {
            throw new ApiException<undefined>(response.httpStatusCode, "Forbidden - Competition not in progress or other restrictions", undefined, response.headers);
        }
        if (isCodeInRange("500", response.httpStatusCode)) {
            throw new ApiException<undefined>(response.httpStatusCode, "Server error", undefined, response.headers);
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: ApiTradeExecutePost200Response = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "ApiTradeExecutePost200Response", ""
            ) as ApiTradeExecutePost200Response;
            return new HttpInfo(response.httpStatusCode, response.headers, response.body, body);
        }

        throw new ApiException<string | Blob | undefined>(response.httpStatusCode, "Unknown API Status Code!", await response.getBodyAsAny(), response.headers);
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to apiTradeQuoteGet
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async apiTradeQuoteGetWithHttpInfo(response: ResponseContext): Promise<HttpInfo<ApiTradeQuoteGet200Response >> {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: ApiTradeQuoteGet200Response = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "ApiTradeQuoteGet200Response", ""
            ) as ApiTradeQuoteGet200Response;
            return new HttpInfo(response.httpStatusCode, response.headers, response.body, body);
        }
        if (isCodeInRange("400", response.httpStatusCode)) {
            throw new ApiException<undefined>(response.httpStatusCode, "Invalid input parameters", undefined, response.headers);
        }
        if (isCodeInRange("401", response.httpStatusCode)) {
            throw new ApiException<undefined>(response.httpStatusCode, "Unauthorized - Missing or invalid authentication", undefined, response.headers);
        }
        if (isCodeInRange("500", response.httpStatusCode)) {
            throw new ApiException<undefined>(response.httpStatusCode, "Server error", undefined, response.headers);
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: ApiTradeQuoteGet200Response = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "ApiTradeQuoteGet200Response", ""
            ) as ApiTradeQuoteGet200Response;
            return new HttpInfo(response.httpStatusCode, response.headers, response.body, body);
        }

        throw new ApiException<string | Blob | undefined>(response.httpStatusCode, "Unknown API Status Code!", await response.getBodyAsAny(), response.headers);
    }

}
