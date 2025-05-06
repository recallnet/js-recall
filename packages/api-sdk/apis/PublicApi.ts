// TODO: better import syntax?
import {BaseAPIRequestFactory, RequiredError, COLLECTION_FORMATS} from './baseapi';
import {Configuration} from '../configuration';
import {RequestContext, HttpMethod, ResponseContext, HttpFile, HttpInfo} from '../http/http';
import {ObjectSerializer} from '../models/ObjectSerializer';
import {ApiException} from './exception';
import {canConsumeForm, isCodeInRange} from '../util';
import {SecurityAuthentication} from '../auth/auth';


import { ApiPublicTeamsRegisterPost201Response } from '../models/ApiPublicTeamsRegisterPost201Response';
import { ApiPublicTeamsRegisterPostRequest } from '../models/ApiPublicTeamsRegisterPostRequest';

/**
 * no description
 */
export class PublicApiRequestFactory extends BaseAPIRequestFactory {

    /**
     * Public endpoint to register a new team. Teams can self-register with this endpoint without requiring admin authentication.
     * Register a new team
     * @param apiPublicTeamsRegisterPostRequest 
     */
    public async apiPublicTeamsRegisterPost(apiPublicTeamsRegisterPostRequest: ApiPublicTeamsRegisterPostRequest, _options?: Configuration): Promise<RequestContext> {
        let _config = _options || this.configuration;

        // verify required parameter 'apiPublicTeamsRegisterPostRequest' is not null or undefined
        if (apiPublicTeamsRegisterPostRequest === null || apiPublicTeamsRegisterPostRequest === undefined) {
            throw new RequiredError("PublicApi", "apiPublicTeamsRegisterPost", "apiPublicTeamsRegisterPostRequest");
        }


        // Path Params
        const localVarPath = '/api/public/teams/register';

        // Make Request Context
        const requestContext = _config.baseServer.makeRequestContext(localVarPath, HttpMethod.POST);
        requestContext.setHeaderParam("Accept", "application/json, */*;q=0.8")


        // Body Params
        const contentType = ObjectSerializer.getPreferredMediaType([
            "application/json"
        ]);
        requestContext.setHeaderParam("Content-Type", contentType);
        const serializedBody = ObjectSerializer.stringify(
            ObjectSerializer.serialize(apiPublicTeamsRegisterPostRequest, "ApiPublicTeamsRegisterPostRequest", ""),
            contentType
        );
        requestContext.setBody(serializedBody);

        
        const defaultAuth: SecurityAuthentication | undefined = _config?.authMethods?.default
        if (defaultAuth?.applySecurityAuthentication) {
            await defaultAuth?.applySecurityAuthentication(requestContext);
        }

        return requestContext;
    }

}

export class PublicApiResponseProcessor {

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to apiPublicTeamsRegisterPost
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async apiPublicTeamsRegisterPostWithHttpInfo(response: ResponseContext): Promise<HttpInfo<ApiPublicTeamsRegisterPost201Response >> {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("201", response.httpStatusCode)) {
            const body: ApiPublicTeamsRegisterPost201Response = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "ApiPublicTeamsRegisterPost201Response", ""
            ) as ApiPublicTeamsRegisterPost201Response;
            return new HttpInfo(response.httpStatusCode, response.headers, response.body, body);
        }
        if (isCodeInRange("400", response.httpStatusCode)) {
            throw new ApiException<undefined>(response.httpStatusCode, "Missing required parameters or invalid wallet address", undefined, response.headers);
        }
        if (isCodeInRange("409", response.httpStatusCode)) {
            throw new ApiException<undefined>(response.httpStatusCode, "Team with this email or wallet address already exists", undefined, response.headers);
        }
        if (isCodeInRange("500", response.httpStatusCode)) {
            throw new ApiException<undefined>(response.httpStatusCode, "Server error", undefined, response.headers);
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: ApiPublicTeamsRegisterPost201Response = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "ApiPublicTeamsRegisterPost201Response", ""
            ) as ApiPublicTeamsRegisterPost201Response;
            return new HttpInfo(response.httpStatusCode, response.headers, response.body, body);
        }

        throw new ApiException<string | Blob | undefined>(response.httpStatusCode, "Unknown API Status Code!", await response.getBodyAsAny(), response.headers);
    }

}
