// TODO: better import syntax?
import {BaseAPIRequestFactory, RequiredError, COLLECTION_FORMATS} from './baseapi';
import {Configuration} from '../configuration';
import {RequestContext, HttpMethod, ResponseContext, HttpFile, HttpInfo} from '../http/http';
import {ObjectSerializer} from '../models/ObjectSerializer';
import {ApiException} from './exception';
import {canConsumeForm, isCodeInRange} from '../util';
import {SecurityAuthentication} from '../auth/auth';


import { ApiPriceGet200Response } from '../models/ApiPriceGet200Response';
import { ApiPriceTokenInfoGet200Response } from '../models/ApiPriceTokenInfoGet200Response';

/**
 * no description
 */
export class PriceApiRequestFactory extends BaseAPIRequestFactory {

    /**
     * Get the current price of a specified token
     * Get price for a token
     * @param token Token address
     * @param chain Blockchain type of the token
     * @param specificChain Specific chain for EVM tokens
     */
    public async apiPriceGet(token: string, chain?: 'evm' | 'svm', specificChain?: 'eth' | 'polygon' | 'bsc' | 'arbitrum' | 'optimism' | 'avalanche' | 'base' | 'linea' | 'zksync' | 'scroll' | 'mantle' | 'svm', _options?: Configuration): Promise<RequestContext> {
        let _config = _options || this.configuration;

        // verify required parameter 'token' is not null or undefined
        if (token === null || token === undefined) {
            throw new RequiredError("PriceApi", "apiPriceGet", "token");
        }




        // Path Params
        const localVarPath = '/api/price';

        // Make Request Context
        const requestContext = _config.baseServer.makeRequestContext(localVarPath, HttpMethod.GET);
        requestContext.setHeaderParam("Accept", "application/json, */*;q=0.8")

        // Query Params
        if (token !== undefined) {
            requestContext.setQueryParam("token", ObjectSerializer.serialize(token, "string", ""));
        }

        // Query Params
        if (chain !== undefined) {
            requestContext.setQueryParam("chain", ObjectSerializer.serialize(chain, "'evm' | 'svm'", ""));
        }

        // Query Params
        if (specificChain !== undefined) {
            requestContext.setQueryParam("specificChain", ObjectSerializer.serialize(specificChain, "'eth' | 'polygon' | 'bsc' | 'arbitrum' | 'optimism' | 'avalanche' | 'base' | 'linea' | 'zksync' | 'scroll' | 'mantle' | 'svm'", ""));
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

    /**
     * Get detailed token information including price and specific chain
     * Get detailed token information
     * @param token Token address
     * @param chain Blockchain type of the token
     * @param specificChain Specific chain for EVM tokens
     */
    public async apiPriceTokenInfoGet(token: string, chain?: 'evm' | 'svm', specificChain?: 'eth' | 'polygon' | 'bsc' | 'arbitrum' | 'optimism' | 'avalanche' | 'base' | 'linea' | 'zksync' | 'scroll' | 'mantle' | 'svm', _options?: Configuration): Promise<RequestContext> {
        let _config = _options || this.configuration;

        // verify required parameter 'token' is not null or undefined
        if (token === null || token === undefined) {
            throw new RequiredError("PriceApi", "apiPriceTokenInfoGet", "token");
        }




        // Path Params
        const localVarPath = '/api/price/token-info';

        // Make Request Context
        const requestContext = _config.baseServer.makeRequestContext(localVarPath, HttpMethod.GET);
        requestContext.setHeaderParam("Accept", "application/json, */*;q=0.8")

        // Query Params
        if (token !== undefined) {
            requestContext.setQueryParam("token", ObjectSerializer.serialize(token, "string", ""));
        }

        // Query Params
        if (chain !== undefined) {
            requestContext.setQueryParam("chain", ObjectSerializer.serialize(chain, "'evm' | 'svm'", ""));
        }

        // Query Params
        if (specificChain !== undefined) {
            requestContext.setQueryParam("specificChain", ObjectSerializer.serialize(specificChain, "'eth' | 'polygon' | 'bsc' | 'arbitrum' | 'optimism' | 'avalanche' | 'base' | 'linea' | 'zksync' | 'scroll' | 'mantle' | 'svm'", ""));
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

export class PriceApiResponseProcessor {

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to apiPriceGet
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async apiPriceGetWithHttpInfo(response: ResponseContext): Promise<HttpInfo<ApiPriceGet200Response >> {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: ApiPriceGet200Response = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "ApiPriceGet200Response", ""
            ) as ApiPriceGet200Response;
            return new HttpInfo(response.httpStatusCode, response.headers, response.body, body);
        }
        if (isCodeInRange("400", response.httpStatusCode)) {
            const body: Error = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "Error", ""
            ) as Error;
            throw new ApiException<Error>(response.httpStatusCode, "Invalid request parameters", body, response.headers);
        }
        if (isCodeInRange("401", response.httpStatusCode)) {
            throw new ApiException<undefined>(response.httpStatusCode, "Unauthorized - Missing or invalid authentication", undefined, response.headers);
        }
        if (isCodeInRange("500", response.httpStatusCode)) {
            throw new ApiException<undefined>(response.httpStatusCode, "Server error", undefined, response.headers);
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: ApiPriceGet200Response = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "ApiPriceGet200Response", ""
            ) as ApiPriceGet200Response;
            return new HttpInfo(response.httpStatusCode, response.headers, response.body, body);
        }

        throw new ApiException<string | Blob | undefined>(response.httpStatusCode, "Unknown API Status Code!", await response.getBodyAsAny(), response.headers);
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to apiPriceTokenInfoGet
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async apiPriceTokenInfoGetWithHttpInfo(response: ResponseContext): Promise<HttpInfo<ApiPriceTokenInfoGet200Response >> {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: ApiPriceTokenInfoGet200Response = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "ApiPriceTokenInfoGet200Response", ""
            ) as ApiPriceTokenInfoGet200Response;
            return new HttpInfo(response.httpStatusCode, response.headers, response.body, body);
        }
        if (isCodeInRange("400", response.httpStatusCode)) {
            const body: Error = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "Error", ""
            ) as Error;
            throw new ApiException<Error>(response.httpStatusCode, "Invalid request parameters", body, response.headers);
        }
        if (isCodeInRange("401", response.httpStatusCode)) {
            throw new ApiException<undefined>(response.httpStatusCode, "Unauthorized - Missing or invalid authentication", undefined, response.headers);
        }
        if (isCodeInRange("500", response.httpStatusCode)) {
            throw new ApiException<undefined>(response.httpStatusCode, "Server error", undefined, response.headers);
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: ApiPriceTokenInfoGet200Response = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "ApiPriceTokenInfoGet200Response", ""
            ) as ApiPriceTokenInfoGet200Response;
            return new HttpInfo(response.httpStatusCode, response.headers, response.body, body);
        }

        throw new ApiException<string | Blob | undefined>(response.httpStatusCode, "Unknown API Status Code!", await response.getBodyAsAny(), response.headers);
    }

}
