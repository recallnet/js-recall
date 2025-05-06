// TODO: better import syntax?
import {BaseAPIRequestFactory, RequiredError, COLLECTION_FORMATS} from './baseapi';
import {Configuration} from '../configuration';
import {RequestContext, HttpMethod, ResponseContext, HttpFile, HttpInfo} from '../http/http';
import {ObjectSerializer} from '../models/ObjectSerializer';
import {ApiException} from './exception';
import {canConsumeForm, isCodeInRange} from '../util';
import {SecurityAuthentication} from '../auth/auth';


import { ApiAdminCompetitionCompetitionIdSnapshotsGet200Response } from '../models/ApiAdminCompetitionCompetitionIdSnapshotsGet200Response';
import { ApiAdminCompetitionCreatePost201Response } from '../models/ApiAdminCompetitionCreatePost201Response';
import { ApiAdminCompetitionCreatePostRequest } from '../models/ApiAdminCompetitionCreatePostRequest';
import { ApiAdminCompetitionEndPost200Response } from '../models/ApiAdminCompetitionEndPost200Response';
import { ApiAdminCompetitionEndPostRequest } from '../models/ApiAdminCompetitionEndPostRequest';
import { ApiAdminCompetitionStartPost200Response } from '../models/ApiAdminCompetitionStartPost200Response';
import { ApiAdminCompetitionStartPostRequest } from '../models/ApiAdminCompetitionStartPostRequest';
import { ApiAdminReportsPerformanceGet200Response } from '../models/ApiAdminReportsPerformanceGet200Response';
import { ApiAdminSetupPost201Response } from '../models/ApiAdminSetupPost201Response';
import { ApiAdminSetupPostRequest } from '../models/ApiAdminSetupPostRequest';
import { ApiAdminTeamsGet200Response } from '../models/ApiAdminTeamsGet200Response';
import { ApiAdminTeamsRegisterPost201Response } from '../models/ApiAdminTeamsRegisterPost201Response';
import { ApiAdminTeamsRegisterPostRequest } from '../models/ApiAdminTeamsRegisterPostRequest';
import { ApiAdminTeamsTeamIdDeactivatePost200Response } from '../models/ApiAdminTeamsTeamIdDeactivatePost200Response';
import { ApiAdminTeamsTeamIdDeactivatePostRequest } from '../models/ApiAdminTeamsTeamIdDeactivatePostRequest';
import { ApiAdminTeamsTeamIdDelete200Response } from '../models/ApiAdminTeamsTeamIdDelete200Response';
import { ApiAdminTeamsTeamIdKeyGet200Response } from '../models/ApiAdminTeamsTeamIdKeyGet200Response';
import { ApiAdminTeamsTeamIdReactivatePost200Response } from '../models/ApiAdminTeamsTeamIdReactivatePost200Response';

/**
 * no description
 */
export class AdminApiRequestFactory extends BaseAPIRequestFactory {

    /**
     * Get portfolio snapshots for a competition, optionally filtered by team
     * Get competition snapshots
     * @param competitionId ID of the competition
     * @param teamId Optional team ID to filter snapshots
     */
    public async apiAdminCompetitionCompetitionIdSnapshotsGet(competitionId: string, teamId?: string, _options?: Configuration): Promise<RequestContext> {
        let _config = _options || this.configuration;

        // verify required parameter 'competitionId' is not null or undefined
        if (competitionId === null || competitionId === undefined) {
            throw new RequiredError("AdminApi", "apiAdminCompetitionCompetitionIdSnapshotsGet", "competitionId");
        }



        // Path Params
        const localVarPath = '/api/admin/competition/{competitionId}/snapshots'
            .replace('{' + 'competitionId' + '}', encodeURIComponent(String(competitionId)));

        // Make Request Context
        const requestContext = _config.baseServer.makeRequestContext(localVarPath, HttpMethod.GET);
        requestContext.setHeaderParam("Accept", "application/json, */*;q=0.8")

        // Query Params
        if (teamId !== undefined) {
            requestContext.setQueryParam("teamId", ObjectSerializer.serialize(teamId, "string", ""));
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
     * Create a new competition without starting it. It will be in PENDING status and can be started later.
     * Create a competition
     * @param apiAdminCompetitionCreatePostRequest 
     */
    public async apiAdminCompetitionCreatePost(apiAdminCompetitionCreatePostRequest: ApiAdminCompetitionCreatePostRequest, _options?: Configuration): Promise<RequestContext> {
        let _config = _options || this.configuration;

        // verify required parameter 'apiAdminCompetitionCreatePostRequest' is not null or undefined
        if (apiAdminCompetitionCreatePostRequest === null || apiAdminCompetitionCreatePostRequest === undefined) {
            throw new RequiredError("AdminApi", "apiAdminCompetitionCreatePost", "apiAdminCompetitionCreatePostRequest");
        }


        // Path Params
        const localVarPath = '/api/admin/competition/create';

        // Make Request Context
        const requestContext = _config.baseServer.makeRequestContext(localVarPath, HttpMethod.POST);
        requestContext.setHeaderParam("Accept", "application/json, */*;q=0.8")


        // Body Params
        const contentType = ObjectSerializer.getPreferredMediaType([
            "application/json"
        ]);
        requestContext.setHeaderParam("Content-Type", contentType);
        const serializedBody = ObjectSerializer.stringify(
            ObjectSerializer.serialize(apiAdminCompetitionCreatePostRequest, "ApiAdminCompetitionCreatePostRequest", ""),
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
     * End an active competition and finalize the results
     * End a competition
     * @param apiAdminCompetitionEndPostRequest 
     */
    public async apiAdminCompetitionEndPost(apiAdminCompetitionEndPostRequest: ApiAdminCompetitionEndPostRequest, _options?: Configuration): Promise<RequestContext> {
        let _config = _options || this.configuration;

        // verify required parameter 'apiAdminCompetitionEndPostRequest' is not null or undefined
        if (apiAdminCompetitionEndPostRequest === null || apiAdminCompetitionEndPostRequest === undefined) {
            throw new RequiredError("AdminApi", "apiAdminCompetitionEndPost", "apiAdminCompetitionEndPostRequest");
        }


        // Path Params
        const localVarPath = '/api/admin/competition/end';

        // Make Request Context
        const requestContext = _config.baseServer.makeRequestContext(localVarPath, HttpMethod.POST);
        requestContext.setHeaderParam("Accept", "application/json, */*;q=0.8")


        // Body Params
        const contentType = ObjectSerializer.getPreferredMediaType([
            "application/json"
        ]);
        requestContext.setHeaderParam("Content-Type", contentType);
        const serializedBody = ObjectSerializer.stringify(
            ObjectSerializer.serialize(apiAdminCompetitionEndPostRequest, "ApiAdminCompetitionEndPostRequest", ""),
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
     * Start a new or existing competition with specified teams. If competitionId is provided, it will start an existing competition. Otherwise, it will create and start a new one.
     * Start a competition
     * @param apiAdminCompetitionStartPostRequest 
     */
    public async apiAdminCompetitionStartPost(apiAdminCompetitionStartPostRequest: ApiAdminCompetitionStartPostRequest, _options?: Configuration): Promise<RequestContext> {
        let _config = _options || this.configuration;

        // verify required parameter 'apiAdminCompetitionStartPostRequest' is not null or undefined
        if (apiAdminCompetitionStartPostRequest === null || apiAdminCompetitionStartPostRequest === undefined) {
            throw new RequiredError("AdminApi", "apiAdminCompetitionStartPost", "apiAdminCompetitionStartPostRequest");
        }


        // Path Params
        const localVarPath = '/api/admin/competition/start';

        // Make Request Context
        const requestContext = _config.baseServer.makeRequestContext(localVarPath, HttpMethod.POST);
        requestContext.setHeaderParam("Accept", "application/json, */*;q=0.8")


        // Body Params
        const contentType = ObjectSerializer.getPreferredMediaType([
            "application/json"
        ]);
        requestContext.setHeaderParam("Content-Type", contentType);
        const serializedBody = ObjectSerializer.stringify(
            ObjectSerializer.serialize(apiAdminCompetitionStartPostRequest, "ApiAdminCompetitionStartPostRequest", ""),
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
     * Get performance reports and leaderboard for a competition
     * Get performance reports
     * @param competitionId ID of the competition
     */
    public async apiAdminReportsPerformanceGet(competitionId: string, _options?: Configuration): Promise<RequestContext> {
        let _config = _options || this.configuration;

        // verify required parameter 'competitionId' is not null or undefined
        if (competitionId === null || competitionId === undefined) {
            throw new RequiredError("AdminApi", "apiAdminReportsPerformanceGet", "competitionId");
        }


        // Path Params
        const localVarPath = '/api/admin/reports/performance';

        // Make Request Context
        const requestContext = _config.baseServer.makeRequestContext(localVarPath, HttpMethod.GET);
        requestContext.setHeaderParam("Accept", "application/json, */*;q=0.8")

        // Query Params
        if (competitionId !== undefined) {
            requestContext.setQueryParam("competitionId", ObjectSerializer.serialize(competitionId, "string", ""));
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
     * Creates the first admin account. This endpoint is only available when no admin exists in the system.
     * Set up initial admin account
     * @param apiAdminSetupPostRequest 
     */
    public async apiAdminSetupPost(apiAdminSetupPostRequest: ApiAdminSetupPostRequest, _options?: Configuration): Promise<RequestContext> {
        let _config = _options || this.configuration;

        // verify required parameter 'apiAdminSetupPostRequest' is not null or undefined
        if (apiAdminSetupPostRequest === null || apiAdminSetupPostRequest === undefined) {
            throw new RequiredError("AdminApi", "apiAdminSetupPost", "apiAdminSetupPostRequest");
        }


        // Path Params
        const localVarPath = '/api/admin/setup';

        // Make Request Context
        const requestContext = _config.baseServer.makeRequestContext(localVarPath, HttpMethod.POST);
        requestContext.setHeaderParam("Accept", "application/json, */*;q=0.8")


        // Body Params
        const contentType = ObjectSerializer.getPreferredMediaType([
            "application/json"
        ]);
        requestContext.setHeaderParam("Content-Type", contentType);
        const serializedBody = ObjectSerializer.stringify(
            ObjectSerializer.serialize(apiAdminSetupPostRequest, "ApiAdminSetupPostRequest", ""),
            contentType
        );
        requestContext.setBody(serializedBody);

        
        const defaultAuth: SecurityAuthentication | undefined = _config?.authMethods?.default
        if (defaultAuth?.applySecurityAuthentication) {
            await defaultAuth?.applySecurityAuthentication(requestContext);
        }

        return requestContext;
    }

    /**
     * Get a list of all non-admin teams
     * List all teams
     */
    public async apiAdminTeamsGet(_options?: Configuration): Promise<RequestContext> {
        let _config = _options || this.configuration;

        // Path Params
        const localVarPath = '/api/admin/teams';

        // Make Request Context
        const requestContext = _config.baseServer.makeRequestContext(localVarPath, HttpMethod.GET);
        requestContext.setHeaderParam("Accept", "application/json, */*;q=0.8")


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
     * Admin-only endpoint to register a new team. Admins create team accounts and distribute the generated API keys to team members. Teams cannot register themselves.
     * Register a new team
     * @param apiAdminTeamsRegisterPostRequest 
     */
    public async apiAdminTeamsRegisterPost(apiAdminTeamsRegisterPostRequest: ApiAdminTeamsRegisterPostRequest, _options?: Configuration): Promise<RequestContext> {
        let _config = _options || this.configuration;

        // verify required parameter 'apiAdminTeamsRegisterPostRequest' is not null or undefined
        if (apiAdminTeamsRegisterPostRequest === null || apiAdminTeamsRegisterPostRequest === undefined) {
            throw new RequiredError("AdminApi", "apiAdminTeamsRegisterPost", "apiAdminTeamsRegisterPostRequest");
        }


        // Path Params
        const localVarPath = '/api/admin/teams/register';

        // Make Request Context
        const requestContext = _config.baseServer.makeRequestContext(localVarPath, HttpMethod.POST);
        requestContext.setHeaderParam("Accept", "application/json, */*;q=0.8")


        // Body Params
        const contentType = ObjectSerializer.getPreferredMediaType([
            "application/json"
        ]);
        requestContext.setHeaderParam("Content-Type", contentType);
        const serializedBody = ObjectSerializer.stringify(
            ObjectSerializer.serialize(apiAdminTeamsRegisterPostRequest, "ApiAdminTeamsRegisterPostRequest", ""),
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
     * Deactivate a team from the competition. The team will no longer be able to perform any actions.
     * Deactivate a team
     * @param teamId ID of the team to deactivate
     * @param apiAdminTeamsTeamIdDeactivatePostRequest 
     */
    public async apiAdminTeamsTeamIdDeactivatePost(teamId: string, apiAdminTeamsTeamIdDeactivatePostRequest: ApiAdminTeamsTeamIdDeactivatePostRequest, _options?: Configuration): Promise<RequestContext> {
        let _config = _options || this.configuration;

        // verify required parameter 'teamId' is not null or undefined
        if (teamId === null || teamId === undefined) {
            throw new RequiredError("AdminApi", "apiAdminTeamsTeamIdDeactivatePost", "teamId");
        }


        // verify required parameter 'apiAdminTeamsTeamIdDeactivatePostRequest' is not null or undefined
        if (apiAdminTeamsTeamIdDeactivatePostRequest === null || apiAdminTeamsTeamIdDeactivatePostRequest === undefined) {
            throw new RequiredError("AdminApi", "apiAdminTeamsTeamIdDeactivatePost", "apiAdminTeamsTeamIdDeactivatePostRequest");
        }


        // Path Params
        const localVarPath = '/api/admin/teams/{teamId}/deactivate'
            .replace('{' + 'teamId' + '}', encodeURIComponent(String(teamId)));

        // Make Request Context
        const requestContext = _config.baseServer.makeRequestContext(localVarPath, HttpMethod.POST);
        requestContext.setHeaderParam("Accept", "application/json, */*;q=0.8")


        // Body Params
        const contentType = ObjectSerializer.getPreferredMediaType([
            "application/json"
        ]);
        requestContext.setHeaderParam("Content-Type", contentType);
        const serializedBody = ObjectSerializer.stringify(
            ObjectSerializer.serialize(apiAdminTeamsTeamIdDeactivatePostRequest, "ApiAdminTeamsTeamIdDeactivatePostRequest", ""),
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
     * Permanently delete a team and all associated data
     * Delete a team
     * @param teamId ID of the team to delete
     */
    public async apiAdminTeamsTeamIdDelete(teamId: string, _options?: Configuration): Promise<RequestContext> {
        let _config = _options || this.configuration;

        // verify required parameter 'teamId' is not null or undefined
        if (teamId === null || teamId === undefined) {
            throw new RequiredError("AdminApi", "apiAdminTeamsTeamIdDelete", "teamId");
        }


        // Path Params
        const localVarPath = '/api/admin/teams/{teamId}'
            .replace('{' + 'teamId' + '}', encodeURIComponent(String(teamId)));

        // Make Request Context
        const requestContext = _config.baseServer.makeRequestContext(localVarPath, HttpMethod.DELETE);
        requestContext.setHeaderParam("Accept", "application/json, */*;q=0.8")


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
     * Retrieves the original API key for a team. Use this when teams lose or misplace their API key.
     * Get a team\'s API key
     * @param teamId ID of the team
     */
    public async apiAdminTeamsTeamIdKeyGet(teamId: string, _options?: Configuration): Promise<RequestContext> {
        let _config = _options || this.configuration;

        // verify required parameter 'teamId' is not null or undefined
        if (teamId === null || teamId === undefined) {
            throw new RequiredError("AdminApi", "apiAdminTeamsTeamIdKeyGet", "teamId");
        }


        // Path Params
        const localVarPath = '/api/admin/teams/{teamId}/key'
            .replace('{' + 'teamId' + '}', encodeURIComponent(String(teamId)));

        // Make Request Context
        const requestContext = _config.baseServer.makeRequestContext(localVarPath, HttpMethod.GET);
        requestContext.setHeaderParam("Accept", "application/json, */*;q=0.8")


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
     * Reactivate a previously deactivated team, allowing them to participate in the competition again.
     * Reactivate a team
     * @param teamId ID of the team to reactivate
     */
    public async apiAdminTeamsTeamIdReactivatePost(teamId: string, _options?: Configuration): Promise<RequestContext> {
        let _config = _options || this.configuration;

        // verify required parameter 'teamId' is not null or undefined
        if (teamId === null || teamId === undefined) {
            throw new RequiredError("AdminApi", "apiAdminTeamsTeamIdReactivatePost", "teamId");
        }


        // Path Params
        const localVarPath = '/api/admin/teams/{teamId}/reactivate'
            .replace('{' + 'teamId' + '}', encodeURIComponent(String(teamId)));

        // Make Request Context
        const requestContext = _config.baseServer.makeRequestContext(localVarPath, HttpMethod.POST);
        requestContext.setHeaderParam("Accept", "application/json, */*;q=0.8")


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

export class AdminApiResponseProcessor {

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to apiAdminCompetitionCompetitionIdSnapshotsGet
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async apiAdminCompetitionCompetitionIdSnapshotsGetWithHttpInfo(response: ResponseContext): Promise<HttpInfo<ApiAdminCompetitionCompetitionIdSnapshotsGet200Response >> {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: ApiAdminCompetitionCompetitionIdSnapshotsGet200Response = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "ApiAdminCompetitionCompetitionIdSnapshotsGet200Response", ""
            ) as ApiAdminCompetitionCompetitionIdSnapshotsGet200Response;
            return new HttpInfo(response.httpStatusCode, response.headers, response.body, body);
        }
        if (isCodeInRange("400", response.httpStatusCode)) {
            throw new ApiException<undefined>(response.httpStatusCode, "Missing competitionId or team not in competition", undefined, response.headers);
        }
        if (isCodeInRange("401", response.httpStatusCode)) {
            throw new ApiException<undefined>(response.httpStatusCode, "Unauthorized - Admin authentication required", undefined, response.headers);
        }
        if (isCodeInRange("404", response.httpStatusCode)) {
            throw new ApiException<undefined>(response.httpStatusCode, "Competition or team not found", undefined, response.headers);
        }
        if (isCodeInRange("500", response.httpStatusCode)) {
            throw new ApiException<undefined>(response.httpStatusCode, "Server error", undefined, response.headers);
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: ApiAdminCompetitionCompetitionIdSnapshotsGet200Response = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "ApiAdminCompetitionCompetitionIdSnapshotsGet200Response", ""
            ) as ApiAdminCompetitionCompetitionIdSnapshotsGet200Response;
            return new HttpInfo(response.httpStatusCode, response.headers, response.body, body);
        }

        throw new ApiException<string | Blob | undefined>(response.httpStatusCode, "Unknown API Status Code!", await response.getBodyAsAny(), response.headers);
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to apiAdminCompetitionCreatePost
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async apiAdminCompetitionCreatePostWithHttpInfo(response: ResponseContext): Promise<HttpInfo<ApiAdminCompetitionCreatePost201Response >> {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("201", response.httpStatusCode)) {
            const body: ApiAdminCompetitionCreatePost201Response = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "ApiAdminCompetitionCreatePost201Response", ""
            ) as ApiAdminCompetitionCreatePost201Response;
            return new HttpInfo(response.httpStatusCode, response.headers, response.body, body);
        }
        if (isCodeInRange("400", response.httpStatusCode)) {
            throw new ApiException<undefined>(response.httpStatusCode, "Missing required parameters", undefined, response.headers);
        }
        if (isCodeInRange("401", response.httpStatusCode)) {
            throw new ApiException<undefined>(response.httpStatusCode, "Unauthorized - Admin authentication required", undefined, response.headers);
        }
        if (isCodeInRange("500", response.httpStatusCode)) {
            throw new ApiException<undefined>(response.httpStatusCode, "Server error", undefined, response.headers);
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: ApiAdminCompetitionCreatePost201Response = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "ApiAdminCompetitionCreatePost201Response", ""
            ) as ApiAdminCompetitionCreatePost201Response;
            return new HttpInfo(response.httpStatusCode, response.headers, response.body, body);
        }

        throw new ApiException<string | Blob | undefined>(response.httpStatusCode, "Unknown API Status Code!", await response.getBodyAsAny(), response.headers);
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to apiAdminCompetitionEndPost
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async apiAdminCompetitionEndPostWithHttpInfo(response: ResponseContext): Promise<HttpInfo<ApiAdminCompetitionEndPost200Response >> {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: ApiAdminCompetitionEndPost200Response = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "ApiAdminCompetitionEndPost200Response", ""
            ) as ApiAdminCompetitionEndPost200Response;
            return new HttpInfo(response.httpStatusCode, response.headers, response.body, body);
        }
        if (isCodeInRange("400", response.httpStatusCode)) {
            throw new ApiException<undefined>(response.httpStatusCode, "Missing competitionId parameter", undefined, response.headers);
        }
        if (isCodeInRange("401", response.httpStatusCode)) {
            throw new ApiException<undefined>(response.httpStatusCode, "Unauthorized - Admin authentication required", undefined, response.headers);
        }
        if (isCodeInRange("404", response.httpStatusCode)) {
            throw new ApiException<undefined>(response.httpStatusCode, "Competition not found", undefined, response.headers);
        }
        if (isCodeInRange("500", response.httpStatusCode)) {
            throw new ApiException<undefined>(response.httpStatusCode, "Server error", undefined, response.headers);
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: ApiAdminCompetitionEndPost200Response = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "ApiAdminCompetitionEndPost200Response", ""
            ) as ApiAdminCompetitionEndPost200Response;
            return new HttpInfo(response.httpStatusCode, response.headers, response.body, body);
        }

        throw new ApiException<string | Blob | undefined>(response.httpStatusCode, "Unknown API Status Code!", await response.getBodyAsAny(), response.headers);
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to apiAdminCompetitionStartPost
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async apiAdminCompetitionStartPostWithHttpInfo(response: ResponseContext): Promise<HttpInfo<ApiAdminCompetitionStartPost200Response >> {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: ApiAdminCompetitionStartPost200Response = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "ApiAdminCompetitionStartPost200Response", ""
            ) as ApiAdminCompetitionStartPost200Response;
            return new HttpInfo(response.httpStatusCode, response.headers, response.body, body);
        }
        if (isCodeInRange("400", response.httpStatusCode)) {
            throw new ApiException<undefined>(response.httpStatusCode, "Missing required parameters", undefined, response.headers);
        }
        if (isCodeInRange("401", response.httpStatusCode)) {
            throw new ApiException<undefined>(response.httpStatusCode, "Unauthorized - Admin authentication required", undefined, response.headers);
        }
        if (isCodeInRange("404", response.httpStatusCode)) {
            throw new ApiException<undefined>(response.httpStatusCode, "Competition not found when using competitionId", undefined, response.headers);
        }
        if (isCodeInRange("500", response.httpStatusCode)) {
            throw new ApiException<undefined>(response.httpStatusCode, "Server error", undefined, response.headers);
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: ApiAdminCompetitionStartPost200Response = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "ApiAdminCompetitionStartPost200Response", ""
            ) as ApiAdminCompetitionStartPost200Response;
            return new HttpInfo(response.httpStatusCode, response.headers, response.body, body);
        }

        throw new ApiException<string | Blob | undefined>(response.httpStatusCode, "Unknown API Status Code!", await response.getBodyAsAny(), response.headers);
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to apiAdminReportsPerformanceGet
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async apiAdminReportsPerformanceGetWithHttpInfo(response: ResponseContext): Promise<HttpInfo<ApiAdminReportsPerformanceGet200Response >> {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: ApiAdminReportsPerformanceGet200Response = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "ApiAdminReportsPerformanceGet200Response", ""
            ) as ApiAdminReportsPerformanceGet200Response;
            return new HttpInfo(response.httpStatusCode, response.headers, response.body, body);
        }
        if (isCodeInRange("400", response.httpStatusCode)) {
            throw new ApiException<undefined>(response.httpStatusCode, "Missing competitionId parameter", undefined, response.headers);
        }
        if (isCodeInRange("401", response.httpStatusCode)) {
            throw new ApiException<undefined>(response.httpStatusCode, "Unauthorized - Admin authentication required", undefined, response.headers);
        }
        if (isCodeInRange("404", response.httpStatusCode)) {
            throw new ApiException<undefined>(response.httpStatusCode, "Competition not found", undefined, response.headers);
        }
        if (isCodeInRange("500", response.httpStatusCode)) {
            throw new ApiException<undefined>(response.httpStatusCode, "Server error", undefined, response.headers);
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: ApiAdminReportsPerformanceGet200Response = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "ApiAdminReportsPerformanceGet200Response", ""
            ) as ApiAdminReportsPerformanceGet200Response;
            return new HttpInfo(response.httpStatusCode, response.headers, response.body, body);
        }

        throw new ApiException<string | Blob | undefined>(response.httpStatusCode, "Unknown API Status Code!", await response.getBodyAsAny(), response.headers);
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to apiAdminSetupPost
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async apiAdminSetupPostWithHttpInfo(response: ResponseContext): Promise<HttpInfo<ApiAdminSetupPost201Response >> {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("201", response.httpStatusCode)) {
            const body: ApiAdminSetupPost201Response = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "ApiAdminSetupPost201Response", ""
            ) as ApiAdminSetupPost201Response;
            return new HttpInfo(response.httpStatusCode, response.headers, response.body, body);
        }
        if (isCodeInRange("400", response.httpStatusCode)) {
            throw new ApiException<undefined>(response.httpStatusCode, "Missing required parameters or password too short", undefined, response.headers);
        }
        if (isCodeInRange("403", response.httpStatusCode)) {
            throw new ApiException<undefined>(response.httpStatusCode, "Admin setup not allowed - an admin account already exists", undefined, response.headers);
        }
        if (isCodeInRange("500", response.httpStatusCode)) {
            throw new ApiException<undefined>(response.httpStatusCode, "Server error", undefined, response.headers);
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: ApiAdminSetupPost201Response = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "ApiAdminSetupPost201Response", ""
            ) as ApiAdminSetupPost201Response;
            return new HttpInfo(response.httpStatusCode, response.headers, response.body, body);
        }

        throw new ApiException<string | Blob | undefined>(response.httpStatusCode, "Unknown API Status Code!", await response.getBodyAsAny(), response.headers);
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to apiAdminTeamsGet
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async apiAdminTeamsGetWithHttpInfo(response: ResponseContext): Promise<HttpInfo<ApiAdminTeamsGet200Response >> {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: ApiAdminTeamsGet200Response = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "ApiAdminTeamsGet200Response", ""
            ) as ApiAdminTeamsGet200Response;
            return new HttpInfo(response.httpStatusCode, response.headers, response.body, body);
        }
        if (isCodeInRange("401", response.httpStatusCode)) {
            throw new ApiException<undefined>(response.httpStatusCode, "Unauthorized - Admin authentication required", undefined, response.headers);
        }
        if (isCodeInRange("500", response.httpStatusCode)) {
            throw new ApiException<undefined>(response.httpStatusCode, "Server error", undefined, response.headers);
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: ApiAdminTeamsGet200Response = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "ApiAdminTeamsGet200Response", ""
            ) as ApiAdminTeamsGet200Response;
            return new HttpInfo(response.httpStatusCode, response.headers, response.body, body);
        }

        throw new ApiException<string | Blob | undefined>(response.httpStatusCode, "Unknown API Status Code!", await response.getBodyAsAny(), response.headers);
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to apiAdminTeamsRegisterPost
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async apiAdminTeamsRegisterPostWithHttpInfo(response: ResponseContext): Promise<HttpInfo<ApiAdminTeamsRegisterPost201Response >> {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("201", response.httpStatusCode)) {
            const body: ApiAdminTeamsRegisterPost201Response = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "ApiAdminTeamsRegisterPost201Response", ""
            ) as ApiAdminTeamsRegisterPost201Response;
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
            const body: ApiAdminTeamsRegisterPost201Response = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "ApiAdminTeamsRegisterPost201Response", ""
            ) as ApiAdminTeamsRegisterPost201Response;
            return new HttpInfo(response.httpStatusCode, response.headers, response.body, body);
        }

        throw new ApiException<string | Blob | undefined>(response.httpStatusCode, "Unknown API Status Code!", await response.getBodyAsAny(), response.headers);
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to apiAdminTeamsTeamIdDeactivatePost
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async apiAdminTeamsTeamIdDeactivatePostWithHttpInfo(response: ResponseContext): Promise<HttpInfo<ApiAdminTeamsTeamIdDeactivatePost200Response >> {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: ApiAdminTeamsTeamIdDeactivatePost200Response = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "ApiAdminTeamsTeamIdDeactivatePost200Response", ""
            ) as ApiAdminTeamsTeamIdDeactivatePost200Response;
            return new HttpInfo(response.httpStatusCode, response.headers, response.body, body);
        }
        if (isCodeInRange("400", response.httpStatusCode)) {
            throw new ApiException<undefined>(response.httpStatusCode, "Missing required parameters", undefined, response.headers);
        }
        if (isCodeInRange("401", response.httpStatusCode)) {
            throw new ApiException<undefined>(response.httpStatusCode, "Unauthorized - Admin authentication required", undefined, response.headers);
        }
        if (isCodeInRange("403", response.httpStatusCode)) {
            throw new ApiException<undefined>(response.httpStatusCode, "Cannot deactivate admin accounts", undefined, response.headers);
        }
        if (isCodeInRange("404", response.httpStatusCode)) {
            throw new ApiException<undefined>(response.httpStatusCode, "Team not found", undefined, response.headers);
        }
        if (isCodeInRange("500", response.httpStatusCode)) {
            throw new ApiException<undefined>(response.httpStatusCode, "Server error", undefined, response.headers);
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: ApiAdminTeamsTeamIdDeactivatePost200Response = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "ApiAdminTeamsTeamIdDeactivatePost200Response", ""
            ) as ApiAdminTeamsTeamIdDeactivatePost200Response;
            return new HttpInfo(response.httpStatusCode, response.headers, response.body, body);
        }

        throw new ApiException<string | Blob | undefined>(response.httpStatusCode, "Unknown API Status Code!", await response.getBodyAsAny(), response.headers);
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to apiAdminTeamsTeamIdDelete
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async apiAdminTeamsTeamIdDeleteWithHttpInfo(response: ResponseContext): Promise<HttpInfo<ApiAdminTeamsTeamIdDelete200Response >> {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: ApiAdminTeamsTeamIdDelete200Response = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "ApiAdminTeamsTeamIdDelete200Response", ""
            ) as ApiAdminTeamsTeamIdDelete200Response;
            return new HttpInfo(response.httpStatusCode, response.headers, response.body, body);
        }
        if (isCodeInRange("400", response.httpStatusCode)) {
            throw new ApiException<undefined>(response.httpStatusCode, "Team ID is required", undefined, response.headers);
        }
        if (isCodeInRange("401", response.httpStatusCode)) {
            throw new ApiException<undefined>(response.httpStatusCode, "Unauthorized - Admin authentication required", undefined, response.headers);
        }
        if (isCodeInRange("403", response.httpStatusCode)) {
            throw new ApiException<undefined>(response.httpStatusCode, "Cannot delete admin accounts", undefined, response.headers);
        }
        if (isCodeInRange("404", response.httpStatusCode)) {
            throw new ApiException<undefined>(response.httpStatusCode, "Team not found", undefined, response.headers);
        }
        if (isCodeInRange("500", response.httpStatusCode)) {
            throw new ApiException<undefined>(response.httpStatusCode, "Server error", undefined, response.headers);
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: ApiAdminTeamsTeamIdDelete200Response = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "ApiAdminTeamsTeamIdDelete200Response", ""
            ) as ApiAdminTeamsTeamIdDelete200Response;
            return new HttpInfo(response.httpStatusCode, response.headers, response.body, body);
        }

        throw new ApiException<string | Blob | undefined>(response.httpStatusCode, "Unknown API Status Code!", await response.getBodyAsAny(), response.headers);
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to apiAdminTeamsTeamIdKeyGet
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async apiAdminTeamsTeamIdKeyGetWithHttpInfo(response: ResponseContext): Promise<HttpInfo<ApiAdminTeamsTeamIdKeyGet200Response >> {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: ApiAdminTeamsTeamIdKeyGet200Response = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "ApiAdminTeamsTeamIdKeyGet200Response", ""
            ) as ApiAdminTeamsTeamIdKeyGet200Response;
            return new HttpInfo(response.httpStatusCode, response.headers, response.body, body);
        }
        if (isCodeInRange("401", response.httpStatusCode)) {
            throw new ApiException<undefined>(response.httpStatusCode, "Unauthorized - Admin authentication required", undefined, response.headers);
        }
        if (isCodeInRange("403", response.httpStatusCode)) {
            throw new ApiException<undefined>(response.httpStatusCode, "Cannot retrieve API key for admin accounts", undefined, response.headers);
        }
        if (isCodeInRange("404", response.httpStatusCode)) {
            throw new ApiException<undefined>(response.httpStatusCode, "Team not found", undefined, response.headers);
        }
        if (isCodeInRange("500", response.httpStatusCode)) {
            throw new ApiException<undefined>(response.httpStatusCode, "Server error", undefined, response.headers);
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: ApiAdminTeamsTeamIdKeyGet200Response = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "ApiAdminTeamsTeamIdKeyGet200Response", ""
            ) as ApiAdminTeamsTeamIdKeyGet200Response;
            return new HttpInfo(response.httpStatusCode, response.headers, response.body, body);
        }

        throw new ApiException<string | Blob | undefined>(response.httpStatusCode, "Unknown API Status Code!", await response.getBodyAsAny(), response.headers);
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to apiAdminTeamsTeamIdReactivatePost
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async apiAdminTeamsTeamIdReactivatePostWithHttpInfo(response: ResponseContext): Promise<HttpInfo<ApiAdminTeamsTeamIdReactivatePost200Response >> {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: ApiAdminTeamsTeamIdReactivatePost200Response = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "ApiAdminTeamsTeamIdReactivatePost200Response", ""
            ) as ApiAdminTeamsTeamIdReactivatePost200Response;
            return new HttpInfo(response.httpStatusCode, response.headers, response.body, body);
        }
        if (isCodeInRange("400", response.httpStatusCode)) {
            throw new ApiException<undefined>(response.httpStatusCode, "Team is already active", undefined, response.headers);
        }
        if (isCodeInRange("401", response.httpStatusCode)) {
            throw new ApiException<undefined>(response.httpStatusCode, "Unauthorized - Admin authentication required", undefined, response.headers);
        }
        if (isCodeInRange("404", response.httpStatusCode)) {
            throw new ApiException<undefined>(response.httpStatusCode, "Team not found", undefined, response.headers);
        }
        if (isCodeInRange("500", response.httpStatusCode)) {
            throw new ApiException<undefined>(response.httpStatusCode, "Server error", undefined, response.headers);
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: ApiAdminTeamsTeamIdReactivatePost200Response = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "ApiAdminTeamsTeamIdReactivatePost200Response", ""
            ) as ApiAdminTeamsTeamIdReactivatePost200Response;
            return new HttpInfo(response.httpStatusCode, response.headers, response.body, body);
        }

        throw new ApiException<string | Blob | undefined>(response.httpStatusCode, "Unknown API Status Code!", await response.getBodyAsAny(), response.headers);
    }

}
