import { ResponseContext, RequestContext, HttpFile, HttpInfo } from '../http/http';
import { Configuration, ConfigurationOptions } from '../configuration'
import type { Middleware } from '../middleware';

import { ApiAccountBalancesGet200Response } from '../models/ApiAccountBalancesGet200Response';
import { ApiAccountBalancesGet200ResponseBalancesInner } from '../models/ApiAccountBalancesGet200ResponseBalancesInner';
import { ApiAccountPortfolioGet200Response } from '../models/ApiAccountPortfolioGet200Response';
import { ApiAccountPortfolioGet200ResponseTokensInner } from '../models/ApiAccountPortfolioGet200ResponseTokensInner';
import { ApiAccountProfileGet200Response } from '../models/ApiAccountProfileGet200Response';
import { ApiAccountProfileGet200ResponseTeam } from '../models/ApiAccountProfileGet200ResponseTeam';
import { ApiAccountProfileGet200ResponseTeamMetadata } from '../models/ApiAccountProfileGet200ResponseTeamMetadata';
import { ApiAccountProfileGet200ResponseTeamMetadataRef } from '../models/ApiAccountProfileGet200ResponseTeamMetadataRef';
import { ApiAccountProfileGet200ResponseTeamMetadataSocial } from '../models/ApiAccountProfileGet200ResponseTeamMetadataSocial';
import { ApiAccountProfilePut200Response } from '../models/ApiAccountProfilePut200Response';
import { ApiAccountProfilePut200ResponseTeam } from '../models/ApiAccountProfilePut200ResponseTeam';
import { ApiAccountProfilePutRequest } from '../models/ApiAccountProfilePutRequest';
import { ApiAccountProfilePutRequestMetadata } from '../models/ApiAccountProfilePutRequestMetadata';
import { ApiAccountResetApiKeyPost200Response } from '../models/ApiAccountResetApiKeyPost200Response';
import { ApiAccountTradesGet200Response } from '../models/ApiAccountTradesGet200Response';
import { ApiAccountTradesGet200ResponseTradesInner } from '../models/ApiAccountTradesGet200ResponseTradesInner';
import { ApiAdminCompetitionCompetitionIdSnapshotsGet200Response } from '../models/ApiAdminCompetitionCompetitionIdSnapshotsGet200Response';
import { ApiAdminCompetitionCompetitionIdSnapshotsGet200ResponseSnapshotsInner } from '../models/ApiAdminCompetitionCompetitionIdSnapshotsGet200ResponseSnapshotsInner';
import { ApiAdminCompetitionCreatePost201Response } from '../models/ApiAdminCompetitionCreatePost201Response';
import { ApiAdminCompetitionCreatePost201ResponseCompetition } from '../models/ApiAdminCompetitionCreatePost201ResponseCompetition';
import { ApiAdminCompetitionCreatePostRequest } from '../models/ApiAdminCompetitionCreatePostRequest';
import { ApiAdminCompetitionEndPost200Response } from '../models/ApiAdminCompetitionEndPost200Response';
import { ApiAdminCompetitionEndPost200ResponseCompetition } from '../models/ApiAdminCompetitionEndPost200ResponseCompetition';
import { ApiAdminCompetitionEndPost200ResponseLeaderboardInner } from '../models/ApiAdminCompetitionEndPost200ResponseLeaderboardInner';
import { ApiAdminCompetitionEndPostRequest } from '../models/ApiAdminCompetitionEndPostRequest';
import { ApiAdminCompetitionStartPost200Response } from '../models/ApiAdminCompetitionStartPost200Response';
import { ApiAdminCompetitionStartPost200ResponseCompetition } from '../models/ApiAdminCompetitionStartPost200ResponseCompetition';
import { ApiAdminCompetitionStartPostRequest } from '../models/ApiAdminCompetitionStartPostRequest';
import { ApiAdminReportsPerformanceGet200Response } from '../models/ApiAdminReportsPerformanceGet200Response';
import { ApiAdminReportsPerformanceGet200ResponseCompetition } from '../models/ApiAdminReportsPerformanceGet200ResponseCompetition';
import { ApiAdminReportsPerformanceGet200ResponseLeaderboardInner } from '../models/ApiAdminReportsPerformanceGet200ResponseLeaderboardInner';
import { ApiAdminSetupPost201Response } from '../models/ApiAdminSetupPost201Response';
import { ApiAdminSetupPost201ResponseAdmin } from '../models/ApiAdminSetupPost201ResponseAdmin';
import { ApiAdminSetupPostRequest } from '../models/ApiAdminSetupPostRequest';
import { ApiAdminTeamsGet200Response } from '../models/ApiAdminTeamsGet200Response';
import { ApiAdminTeamsGet200ResponseTeamsInner } from '../models/ApiAdminTeamsGet200ResponseTeamsInner';
import { ApiAdminTeamsRegisterPost201Response } from '../models/ApiAdminTeamsRegisterPost201Response';
import { ApiAdminTeamsRegisterPost201ResponseTeam } from '../models/ApiAdminTeamsRegisterPost201ResponseTeam';
import { ApiAdminTeamsRegisterPostRequest } from '../models/ApiAdminTeamsRegisterPostRequest';
import { ApiAdminTeamsTeamIdDeactivatePost200Response } from '../models/ApiAdminTeamsTeamIdDeactivatePost200Response';
import { ApiAdminTeamsTeamIdDeactivatePost200ResponseTeam } from '../models/ApiAdminTeamsTeamIdDeactivatePost200ResponseTeam';
import { ApiAdminTeamsTeamIdDeactivatePostRequest } from '../models/ApiAdminTeamsTeamIdDeactivatePostRequest';
import { ApiAdminTeamsTeamIdDelete200Response } from '../models/ApiAdminTeamsTeamIdDelete200Response';
import { ApiAdminTeamsTeamIdKeyGet200Response } from '../models/ApiAdminTeamsTeamIdKeyGet200Response';
import { ApiAdminTeamsTeamIdKeyGet200ResponseTeam } from '../models/ApiAdminTeamsTeamIdKeyGet200ResponseTeam';
import { ApiAdminTeamsTeamIdReactivatePost200Response } from '../models/ApiAdminTeamsTeamIdReactivatePost200Response';
import { ApiAdminTeamsTeamIdReactivatePost200ResponseTeam } from '../models/ApiAdminTeamsTeamIdReactivatePost200ResponseTeam';
import { ApiCompetitionLeaderboardGet200Response } from '../models/ApiCompetitionLeaderboardGet200Response';
import { ApiCompetitionLeaderboardGet200ResponseCompetition } from '../models/ApiCompetitionLeaderboardGet200ResponseCompetition';
import { ApiCompetitionLeaderboardGet200ResponseLeaderboardInner } from '../models/ApiCompetitionLeaderboardGet200ResponseLeaderboardInner';
import { ApiCompetitionRulesGet200Response } from '../models/ApiCompetitionRulesGet200Response';
import { ApiCompetitionRulesGet200ResponseRules } from '../models/ApiCompetitionRulesGet200ResponseRules';
import { ApiCompetitionRulesGet200ResponseRulesAvailableChains } from '../models/ApiCompetitionRulesGet200ResponseRulesAvailableChains';
import { ApiCompetitionRulesGet200ResponseRulesPortfolioSnapshots } from '../models/ApiCompetitionRulesGet200ResponseRulesPortfolioSnapshots';
import { ApiCompetitionStatusGet200Response } from '../models/ApiCompetitionStatusGet200Response';
import { ApiCompetitionStatusGet200ResponseCompetition } from '../models/ApiCompetitionStatusGet200ResponseCompetition';
import { ApiCompetitionUpcomingGet200Response } from '../models/ApiCompetitionUpcomingGet200Response';
import { ApiCompetitionUpcomingGet200ResponseCompetitionsInner } from '../models/ApiCompetitionUpcomingGet200ResponseCompetitionsInner';
import { ApiHealthDetailedGet200Response } from '../models/ApiHealthDetailedGet200Response';
import { ApiHealthDetailedGet200ResponseServices } from '../models/ApiHealthDetailedGet200ResponseServices';
import { ApiHealthGet200Response } from '../models/ApiHealthGet200Response';
import { ApiPriceGet200Response } from '../models/ApiPriceGet200Response';
import { ApiPriceTokenInfoGet200Response } from '../models/ApiPriceTokenInfoGet200Response';
import { ApiPublicTeamsRegisterPost201Response } from '../models/ApiPublicTeamsRegisterPost201Response';
import { ApiPublicTeamsRegisterPost201ResponseTeam } from '../models/ApiPublicTeamsRegisterPost201ResponseTeam';
import { ApiPublicTeamsRegisterPostRequest } from '../models/ApiPublicTeamsRegisterPostRequest';
import { ApiTradeExecutePost200Response } from '../models/ApiTradeExecutePost200Response';
import { ApiTradeExecutePostRequest } from '../models/ApiTradeExecutePostRequest';
import { ApiTradeQuoteGet200Response } from '../models/ApiTradeQuoteGet200Response';
import { ApiTradeQuoteGet200ResponseChains } from '../models/ApiTradeQuoteGet200ResponseChains';
import { ApiTradeQuoteGet200ResponsePrices } from '../models/ApiTradeQuoteGet200ResponsePrices';
import { ModelError } from '../models/ModelError';
import { TokenBalance } from '../models/TokenBalance';
import { Trade } from '../models/Trade';

import { ObservableAccountApi } from "./ObservableAPI";
import { AccountApiRequestFactory, AccountApiResponseProcessor} from "../apis/AccountApi";

export interface AccountApiApiAccountBalancesGetRequest {
}

export interface AccountApiApiAccountPortfolioGetRequest {
}

export interface AccountApiApiAccountProfileGetRequest {
}

export interface AccountApiApiAccountProfilePutRequest {
    /**
     * 
     * @type ApiAccountProfilePutRequest
     * @memberof AccountApiapiAccountProfilePut
     */
    apiAccountProfilePutRequest: ApiAccountProfilePutRequest
}

export interface AccountApiApiAccountResetApiKeyPostRequest {
}

export interface AccountApiApiAccountTradesGetRequest {
}

export class ObjectAccountApi {
    private api: ObservableAccountApi

    public constructor(configuration: Configuration, requestFactory?: AccountApiRequestFactory, responseProcessor?: AccountApiResponseProcessor) {
        this.api = new ObservableAccountApi(configuration, requestFactory, responseProcessor);
    }

    /**
     * Get all token balances for the authenticated team
     * Get token balances
     * @param param the request object
     */
    public apiAccountBalancesGetWithHttpInfo(param: AccountApiApiAccountBalancesGetRequest = {}, options?: ConfigurationOptions): Promise<HttpInfo<ApiAccountBalancesGet200Response>> {
        return this.api.apiAccountBalancesGetWithHttpInfo( options).toPromise();
    }

    /**
     * Get all token balances for the authenticated team
     * Get token balances
     * @param param the request object
     */
    public apiAccountBalancesGet(param: AccountApiApiAccountBalancesGetRequest = {}, options?: ConfigurationOptions): Promise<ApiAccountBalancesGet200Response> {
        return this.api.apiAccountBalancesGet( options).toPromise();
    }

    /**
     * Get portfolio valuation and token details for the authenticated team
     * Get portfolio information
     * @param param the request object
     */
    public apiAccountPortfolioGetWithHttpInfo(param: AccountApiApiAccountPortfolioGetRequest = {}, options?: ConfigurationOptions): Promise<HttpInfo<ApiAccountPortfolioGet200Response>> {
        return this.api.apiAccountPortfolioGetWithHttpInfo( options).toPromise();
    }

    /**
     * Get portfolio valuation and token details for the authenticated team
     * Get portfolio information
     * @param param the request object
     */
    public apiAccountPortfolioGet(param: AccountApiApiAccountPortfolioGetRequest = {}, options?: ConfigurationOptions): Promise<ApiAccountPortfolioGet200Response> {
        return this.api.apiAccountPortfolioGet( options).toPromise();
    }

    /**
     * Get profile information for the authenticated team
     * Get team profile
     * @param param the request object
     */
    public apiAccountProfileGetWithHttpInfo(param: AccountApiApiAccountProfileGetRequest = {}, options?: ConfigurationOptions): Promise<HttpInfo<ApiAccountProfileGet200Response>> {
        return this.api.apiAccountProfileGetWithHttpInfo( options).toPromise();
    }

    /**
     * Get profile information for the authenticated team
     * Get team profile
     * @param param the request object
     */
    public apiAccountProfileGet(param: AccountApiApiAccountProfileGetRequest = {}, options?: ConfigurationOptions): Promise<ApiAccountProfileGet200Response> {
        return this.api.apiAccountProfileGet( options).toPromise();
    }

    /**
     * Update profile information for the authenticated team
     * Update team profile
     * @param param the request object
     */
    public apiAccountProfilePutWithHttpInfo(param: AccountApiApiAccountProfilePutRequest, options?: ConfigurationOptions): Promise<HttpInfo<ApiAccountProfilePut200Response>> {
        return this.api.apiAccountProfilePutWithHttpInfo(param.apiAccountProfilePutRequest,  options).toPromise();
    }

    /**
     * Update profile information for the authenticated team
     * Update team profile
     * @param param the request object
     */
    public apiAccountProfilePut(param: AccountApiApiAccountProfilePutRequest, options?: ConfigurationOptions): Promise<ApiAccountProfilePut200Response> {
        return this.api.apiAccountProfilePut(param.apiAccountProfilePutRequest,  options).toPromise();
    }

    /**
     * Reset the API key for the authenticated team. This will invalidate the current API key and generate a new one.
     * Reset team API key
     * @param param the request object
     */
    public apiAccountResetApiKeyPostWithHttpInfo(param: AccountApiApiAccountResetApiKeyPostRequest = {}, options?: ConfigurationOptions): Promise<HttpInfo<ApiAccountResetApiKeyPost200Response>> {
        return this.api.apiAccountResetApiKeyPostWithHttpInfo( options).toPromise();
    }

    /**
     * Reset the API key for the authenticated team. This will invalidate the current API key and generate a new one.
     * Reset team API key
     * @param param the request object
     */
    public apiAccountResetApiKeyPost(param: AccountApiApiAccountResetApiKeyPostRequest = {}, options?: ConfigurationOptions): Promise<ApiAccountResetApiKeyPost200Response> {
        return this.api.apiAccountResetApiKeyPost( options).toPromise();
    }

    /**
     * Get trade history for the authenticated team
     * Get trade history
     * @param param the request object
     */
    public apiAccountTradesGetWithHttpInfo(param: AccountApiApiAccountTradesGetRequest = {}, options?: ConfigurationOptions): Promise<HttpInfo<ApiAccountTradesGet200Response>> {
        return this.api.apiAccountTradesGetWithHttpInfo( options).toPromise();
    }

    /**
     * Get trade history for the authenticated team
     * Get trade history
     * @param param the request object
     */
    public apiAccountTradesGet(param: AccountApiApiAccountTradesGetRequest = {}, options?: ConfigurationOptions): Promise<ApiAccountTradesGet200Response> {
        return this.api.apiAccountTradesGet( options).toPromise();
    }

}

import { ObservableAdminApi } from "./ObservableAPI";
import { AdminApiRequestFactory, AdminApiResponseProcessor} from "../apis/AdminApi";

export interface AdminApiApiAdminCompetitionCompetitionIdSnapshotsGetRequest {
    /**
     * ID of the competition
     * Defaults to: undefined
     * @type string
     * @memberof AdminApiapiAdminCompetitionCompetitionIdSnapshotsGet
     */
    competitionId: string
    /**
     * Optional team ID to filter snapshots
     * Defaults to: undefined
     * @type string
     * @memberof AdminApiapiAdminCompetitionCompetitionIdSnapshotsGet
     */
    teamId?: string
}

export interface AdminApiApiAdminCompetitionCreatePostRequest {
    /**
     * 
     * @type ApiAdminCompetitionCreatePostRequest
     * @memberof AdminApiapiAdminCompetitionCreatePost
     */
    apiAdminCompetitionCreatePostRequest: ApiAdminCompetitionCreatePostRequest
}

export interface AdminApiApiAdminCompetitionEndPostRequest {
    /**
     * 
     * @type ApiAdminCompetitionEndPostRequest
     * @memberof AdminApiapiAdminCompetitionEndPost
     */
    apiAdminCompetitionEndPostRequest: ApiAdminCompetitionEndPostRequest
}

export interface AdminApiApiAdminCompetitionStartPostRequest {
    /**
     * 
     * @type ApiAdminCompetitionStartPostRequest
     * @memberof AdminApiapiAdminCompetitionStartPost
     */
    apiAdminCompetitionStartPostRequest: ApiAdminCompetitionStartPostRequest
}

export interface AdminApiApiAdminReportsPerformanceGetRequest {
    /**
     * ID of the competition
     * Defaults to: undefined
     * @type string
     * @memberof AdminApiapiAdminReportsPerformanceGet
     */
    competitionId: string
}

export interface AdminApiApiAdminSetupPostRequest {
    /**
     * 
     * @type ApiAdminSetupPostRequest
     * @memberof AdminApiapiAdminSetupPost
     */
    apiAdminSetupPostRequest: ApiAdminSetupPostRequest
}

export interface AdminApiApiAdminTeamsGetRequest {
}

export interface AdminApiApiAdminTeamsRegisterPostRequest {
    /**
     * 
     * @type ApiAdminTeamsRegisterPostRequest
     * @memberof AdminApiapiAdminTeamsRegisterPost
     */
    apiAdminTeamsRegisterPostRequest: ApiAdminTeamsRegisterPostRequest
}

export interface AdminApiApiAdminTeamsTeamIdDeactivatePostRequest {
    /**
     * ID of the team to deactivate
     * Defaults to: undefined
     * @type string
     * @memberof AdminApiapiAdminTeamsTeamIdDeactivatePost
     */
    teamId: string
    /**
     * 
     * @type ApiAdminTeamsTeamIdDeactivatePostRequest
     * @memberof AdminApiapiAdminTeamsTeamIdDeactivatePost
     */
    apiAdminTeamsTeamIdDeactivatePostRequest: ApiAdminTeamsTeamIdDeactivatePostRequest
}

export interface AdminApiApiAdminTeamsTeamIdDeleteRequest {
    /**
     * ID of the team to delete
     * Defaults to: undefined
     * @type string
     * @memberof AdminApiapiAdminTeamsTeamIdDelete
     */
    teamId: string
}

export interface AdminApiApiAdminTeamsTeamIdKeyGetRequest {
    /**
     * ID of the team
     * Defaults to: undefined
     * @type string
     * @memberof AdminApiapiAdminTeamsTeamIdKeyGet
     */
    teamId: string
}

export interface AdminApiApiAdminTeamsTeamIdReactivatePostRequest {
    /**
     * ID of the team to reactivate
     * Defaults to: undefined
     * @type string
     * @memberof AdminApiapiAdminTeamsTeamIdReactivatePost
     */
    teamId: string
}

export class ObjectAdminApi {
    private api: ObservableAdminApi

    public constructor(configuration: Configuration, requestFactory?: AdminApiRequestFactory, responseProcessor?: AdminApiResponseProcessor) {
        this.api = new ObservableAdminApi(configuration, requestFactory, responseProcessor);
    }

    /**
     * Get portfolio snapshots for a competition, optionally filtered by team
     * Get competition snapshots
     * @param param the request object
     */
    public apiAdminCompetitionCompetitionIdSnapshotsGetWithHttpInfo(param: AdminApiApiAdminCompetitionCompetitionIdSnapshotsGetRequest, options?: ConfigurationOptions): Promise<HttpInfo<ApiAdminCompetitionCompetitionIdSnapshotsGet200Response>> {
        return this.api.apiAdminCompetitionCompetitionIdSnapshotsGetWithHttpInfo(param.competitionId, param.teamId,  options).toPromise();
    }

    /**
     * Get portfolio snapshots for a competition, optionally filtered by team
     * Get competition snapshots
     * @param param the request object
     */
    public apiAdminCompetitionCompetitionIdSnapshotsGet(param: AdminApiApiAdminCompetitionCompetitionIdSnapshotsGetRequest, options?: ConfigurationOptions): Promise<ApiAdminCompetitionCompetitionIdSnapshotsGet200Response> {
        return this.api.apiAdminCompetitionCompetitionIdSnapshotsGet(param.competitionId, param.teamId,  options).toPromise();
    }

    /**
     * Create a new competition without starting it. It will be in PENDING status and can be started later.
     * Create a competition
     * @param param the request object
     */
    public apiAdminCompetitionCreatePostWithHttpInfo(param: AdminApiApiAdminCompetitionCreatePostRequest, options?: ConfigurationOptions): Promise<HttpInfo<ApiAdminCompetitionCreatePost201Response>> {
        return this.api.apiAdminCompetitionCreatePostWithHttpInfo(param.apiAdminCompetitionCreatePostRequest,  options).toPromise();
    }

    /**
     * Create a new competition without starting it. It will be in PENDING status and can be started later.
     * Create a competition
     * @param param the request object
     */
    public apiAdminCompetitionCreatePost(param: AdminApiApiAdminCompetitionCreatePostRequest, options?: ConfigurationOptions): Promise<ApiAdminCompetitionCreatePost201Response> {
        return this.api.apiAdminCompetitionCreatePost(param.apiAdminCompetitionCreatePostRequest,  options).toPromise();
    }

    /**
     * End an active competition and finalize the results
     * End a competition
     * @param param the request object
     */
    public apiAdminCompetitionEndPostWithHttpInfo(param: AdminApiApiAdminCompetitionEndPostRequest, options?: ConfigurationOptions): Promise<HttpInfo<ApiAdminCompetitionEndPost200Response>> {
        return this.api.apiAdminCompetitionEndPostWithHttpInfo(param.apiAdminCompetitionEndPostRequest,  options).toPromise();
    }

    /**
     * End an active competition and finalize the results
     * End a competition
     * @param param the request object
     */
    public apiAdminCompetitionEndPost(param: AdminApiApiAdminCompetitionEndPostRequest, options?: ConfigurationOptions): Promise<ApiAdminCompetitionEndPost200Response> {
        return this.api.apiAdminCompetitionEndPost(param.apiAdminCompetitionEndPostRequest,  options).toPromise();
    }

    /**
     * Start a new or existing competition with specified teams. If competitionId is provided, it will start an existing competition. Otherwise, it will create and start a new one.
     * Start a competition
     * @param param the request object
     */
    public apiAdminCompetitionStartPostWithHttpInfo(param: AdminApiApiAdminCompetitionStartPostRequest, options?: ConfigurationOptions): Promise<HttpInfo<ApiAdminCompetitionStartPost200Response>> {
        return this.api.apiAdminCompetitionStartPostWithHttpInfo(param.apiAdminCompetitionStartPostRequest,  options).toPromise();
    }

    /**
     * Start a new or existing competition with specified teams. If competitionId is provided, it will start an existing competition. Otherwise, it will create and start a new one.
     * Start a competition
     * @param param the request object
     */
    public apiAdminCompetitionStartPost(param: AdminApiApiAdminCompetitionStartPostRequest, options?: ConfigurationOptions): Promise<ApiAdminCompetitionStartPost200Response> {
        return this.api.apiAdminCompetitionStartPost(param.apiAdminCompetitionStartPostRequest,  options).toPromise();
    }

    /**
     * Get performance reports and leaderboard for a competition
     * Get performance reports
     * @param param the request object
     */
    public apiAdminReportsPerformanceGetWithHttpInfo(param: AdminApiApiAdminReportsPerformanceGetRequest, options?: ConfigurationOptions): Promise<HttpInfo<ApiAdminReportsPerformanceGet200Response>> {
        return this.api.apiAdminReportsPerformanceGetWithHttpInfo(param.competitionId,  options).toPromise();
    }

    /**
     * Get performance reports and leaderboard for a competition
     * Get performance reports
     * @param param the request object
     */
    public apiAdminReportsPerformanceGet(param: AdminApiApiAdminReportsPerformanceGetRequest, options?: ConfigurationOptions): Promise<ApiAdminReportsPerformanceGet200Response> {
        return this.api.apiAdminReportsPerformanceGet(param.competitionId,  options).toPromise();
    }

    /**
     * Creates the first admin account. This endpoint is only available when no admin exists in the system.
     * Set up initial admin account
     * @param param the request object
     */
    public apiAdminSetupPostWithHttpInfo(param: AdminApiApiAdminSetupPostRequest, options?: ConfigurationOptions): Promise<HttpInfo<ApiAdminSetupPost201Response>> {
        return this.api.apiAdminSetupPostWithHttpInfo(param.apiAdminSetupPostRequest,  options).toPromise();
    }

    /**
     * Creates the first admin account. This endpoint is only available when no admin exists in the system.
     * Set up initial admin account
     * @param param the request object
     */
    public apiAdminSetupPost(param: AdminApiApiAdminSetupPostRequest, options?: ConfigurationOptions): Promise<ApiAdminSetupPost201Response> {
        return this.api.apiAdminSetupPost(param.apiAdminSetupPostRequest,  options).toPromise();
    }

    /**
     * Get a list of all non-admin teams
     * List all teams
     * @param param the request object
     */
    public apiAdminTeamsGetWithHttpInfo(param: AdminApiApiAdminTeamsGetRequest = {}, options?: ConfigurationOptions): Promise<HttpInfo<ApiAdminTeamsGet200Response>> {
        return this.api.apiAdminTeamsGetWithHttpInfo( options).toPromise();
    }

    /**
     * Get a list of all non-admin teams
     * List all teams
     * @param param the request object
     */
    public apiAdminTeamsGet(param: AdminApiApiAdminTeamsGetRequest = {}, options?: ConfigurationOptions): Promise<ApiAdminTeamsGet200Response> {
        return this.api.apiAdminTeamsGet( options).toPromise();
    }

    /**
     * Admin-only endpoint to register a new team. Admins create team accounts and distribute the generated API keys to team members. Teams cannot register themselves.
     * Register a new team
     * @param param the request object
     */
    public apiAdminTeamsRegisterPostWithHttpInfo(param: AdminApiApiAdminTeamsRegisterPostRequest, options?: ConfigurationOptions): Promise<HttpInfo<ApiAdminTeamsRegisterPost201Response>> {
        return this.api.apiAdminTeamsRegisterPostWithHttpInfo(param.apiAdminTeamsRegisterPostRequest,  options).toPromise();
    }

    /**
     * Admin-only endpoint to register a new team. Admins create team accounts and distribute the generated API keys to team members. Teams cannot register themselves.
     * Register a new team
     * @param param the request object
     */
    public apiAdminTeamsRegisterPost(param: AdminApiApiAdminTeamsRegisterPostRequest, options?: ConfigurationOptions): Promise<ApiAdminTeamsRegisterPost201Response> {
        return this.api.apiAdminTeamsRegisterPost(param.apiAdminTeamsRegisterPostRequest,  options).toPromise();
    }

    /**
     * Deactivate a team from the competition. The team will no longer be able to perform any actions.
     * Deactivate a team
     * @param param the request object
     */
    public apiAdminTeamsTeamIdDeactivatePostWithHttpInfo(param: AdminApiApiAdminTeamsTeamIdDeactivatePostRequest, options?: ConfigurationOptions): Promise<HttpInfo<ApiAdminTeamsTeamIdDeactivatePost200Response>> {
        return this.api.apiAdminTeamsTeamIdDeactivatePostWithHttpInfo(param.teamId, param.apiAdminTeamsTeamIdDeactivatePostRequest,  options).toPromise();
    }

    /**
     * Deactivate a team from the competition. The team will no longer be able to perform any actions.
     * Deactivate a team
     * @param param the request object
     */
    public apiAdminTeamsTeamIdDeactivatePost(param: AdminApiApiAdminTeamsTeamIdDeactivatePostRequest, options?: ConfigurationOptions): Promise<ApiAdminTeamsTeamIdDeactivatePost200Response> {
        return this.api.apiAdminTeamsTeamIdDeactivatePost(param.teamId, param.apiAdminTeamsTeamIdDeactivatePostRequest,  options).toPromise();
    }

    /**
     * Permanently delete a team and all associated data
     * Delete a team
     * @param param the request object
     */
    public apiAdminTeamsTeamIdDeleteWithHttpInfo(param: AdminApiApiAdminTeamsTeamIdDeleteRequest, options?: ConfigurationOptions): Promise<HttpInfo<ApiAdminTeamsTeamIdDelete200Response>> {
        return this.api.apiAdminTeamsTeamIdDeleteWithHttpInfo(param.teamId,  options).toPromise();
    }

    /**
     * Permanently delete a team and all associated data
     * Delete a team
     * @param param the request object
     */
    public apiAdminTeamsTeamIdDelete(param: AdminApiApiAdminTeamsTeamIdDeleteRequest, options?: ConfigurationOptions): Promise<ApiAdminTeamsTeamIdDelete200Response> {
        return this.api.apiAdminTeamsTeamIdDelete(param.teamId,  options).toPromise();
    }

    /**
     * Retrieves the original API key for a team. Use this when teams lose or misplace their API key.
     * Get a team\'s API key
     * @param param the request object
     */
    public apiAdminTeamsTeamIdKeyGetWithHttpInfo(param: AdminApiApiAdminTeamsTeamIdKeyGetRequest, options?: ConfigurationOptions): Promise<HttpInfo<ApiAdminTeamsTeamIdKeyGet200Response>> {
        return this.api.apiAdminTeamsTeamIdKeyGetWithHttpInfo(param.teamId,  options).toPromise();
    }

    /**
     * Retrieves the original API key for a team. Use this when teams lose or misplace their API key.
     * Get a team\'s API key
     * @param param the request object
     */
    public apiAdminTeamsTeamIdKeyGet(param: AdminApiApiAdminTeamsTeamIdKeyGetRequest, options?: ConfigurationOptions): Promise<ApiAdminTeamsTeamIdKeyGet200Response> {
        return this.api.apiAdminTeamsTeamIdKeyGet(param.teamId,  options).toPromise();
    }

    /**
     * Reactivate a previously deactivated team, allowing them to participate in the competition again.
     * Reactivate a team
     * @param param the request object
     */
    public apiAdminTeamsTeamIdReactivatePostWithHttpInfo(param: AdminApiApiAdminTeamsTeamIdReactivatePostRequest, options?: ConfigurationOptions): Promise<HttpInfo<ApiAdminTeamsTeamIdReactivatePost200Response>> {
        return this.api.apiAdminTeamsTeamIdReactivatePostWithHttpInfo(param.teamId,  options).toPromise();
    }

    /**
     * Reactivate a previously deactivated team, allowing them to participate in the competition again.
     * Reactivate a team
     * @param param the request object
     */
    public apiAdminTeamsTeamIdReactivatePost(param: AdminApiApiAdminTeamsTeamIdReactivatePostRequest, options?: ConfigurationOptions): Promise<ApiAdminTeamsTeamIdReactivatePost200Response> {
        return this.api.apiAdminTeamsTeamIdReactivatePost(param.teamId,  options).toPromise();
    }

}

import { ObservableCompetitionApi } from "./ObservableAPI";
import { CompetitionApiRequestFactory, CompetitionApiResponseProcessor} from "../apis/CompetitionApi";

export interface CompetitionApiApiCompetitionLeaderboardGetRequest {
    /**
     * Optional competition ID (if not provided, the active competition is used)
     * Defaults to: undefined
     * @type string
     * @memberof CompetitionApiapiCompetitionLeaderboardGet
     */
    competitionId?: string
}

export interface CompetitionApiApiCompetitionRulesGetRequest {
}

export interface CompetitionApiApiCompetitionStatusGetRequest {
}

export interface CompetitionApiApiCompetitionUpcomingGetRequest {
}

export class ObjectCompetitionApi {
    private api: ObservableCompetitionApi

    public constructor(configuration: Configuration, requestFactory?: CompetitionApiRequestFactory, responseProcessor?: CompetitionApiResponseProcessor) {
        this.api = new ObservableCompetitionApi(configuration, requestFactory, responseProcessor);
    }

    /**
     * Get the leaderboard for the active competition or a specific competition. Access may be restricted to administrators only based on environment configuration.
     * Get competition leaderboard
     * @param param the request object
     */
    public apiCompetitionLeaderboardGetWithHttpInfo(param: CompetitionApiApiCompetitionLeaderboardGetRequest = {}, options?: ConfigurationOptions): Promise<HttpInfo<ApiCompetitionLeaderboardGet200Response>> {
        return this.api.apiCompetitionLeaderboardGetWithHttpInfo(param.competitionId,  options).toPromise();
    }

    /**
     * Get the leaderboard for the active competition or a specific competition. Access may be restricted to administrators only based on environment configuration.
     * Get competition leaderboard
     * @param param the request object
     */
    public apiCompetitionLeaderboardGet(param: CompetitionApiApiCompetitionLeaderboardGetRequest = {}, options?: ConfigurationOptions): Promise<ApiCompetitionLeaderboardGet200Response> {
        return this.api.apiCompetitionLeaderboardGet(param.competitionId,  options).toPromise();
    }

    /**
     * Get the rules, rate limits, and other configuration details for the competition
     * Get competition rules
     * @param param the request object
     */
    public apiCompetitionRulesGetWithHttpInfo(param: CompetitionApiApiCompetitionRulesGetRequest = {}, options?: ConfigurationOptions): Promise<HttpInfo<ApiCompetitionRulesGet200Response>> {
        return this.api.apiCompetitionRulesGetWithHttpInfo( options).toPromise();
    }

    /**
     * Get the rules, rate limits, and other configuration details for the competition
     * Get competition rules
     * @param param the request object
     */
    public apiCompetitionRulesGet(param: CompetitionApiApiCompetitionRulesGetRequest = {}, options?: ConfigurationOptions): Promise<ApiCompetitionRulesGet200Response> {
        return this.api.apiCompetitionRulesGet( options).toPromise();
    }

    /**
     * Get the status of the active competition
     * Get competition status
     * @param param the request object
     */
    public apiCompetitionStatusGetWithHttpInfo(param: CompetitionApiApiCompetitionStatusGetRequest = {}, options?: ConfigurationOptions): Promise<HttpInfo<ApiCompetitionStatusGet200Response>> {
        return this.api.apiCompetitionStatusGetWithHttpInfo( options).toPromise();
    }

    /**
     * Get the status of the active competition
     * Get competition status
     * @param param the request object
     */
    public apiCompetitionStatusGet(param: CompetitionApiApiCompetitionStatusGetRequest = {}, options?: ConfigurationOptions): Promise<ApiCompetitionStatusGet200Response> {
        return this.api.apiCompetitionStatusGet( options).toPromise();
    }

    /**
     * Get all competitions that have not started yet (status=PENDING)
     * Get upcoming competitions
     * @param param the request object
     */
    public apiCompetitionUpcomingGetWithHttpInfo(param: CompetitionApiApiCompetitionUpcomingGetRequest = {}, options?: ConfigurationOptions): Promise<HttpInfo<ApiCompetitionUpcomingGet200Response>> {
        return this.api.apiCompetitionUpcomingGetWithHttpInfo( options).toPromise();
    }

    /**
     * Get all competitions that have not started yet (status=PENDING)
     * Get upcoming competitions
     * @param param the request object
     */
    public apiCompetitionUpcomingGet(param: CompetitionApiApiCompetitionUpcomingGetRequest = {}, options?: ConfigurationOptions): Promise<ApiCompetitionUpcomingGet200Response> {
        return this.api.apiCompetitionUpcomingGet( options).toPromise();
    }

}

import { ObservableHealthApi } from "./ObservableAPI";
import { HealthApiRequestFactory, HealthApiResponseProcessor} from "../apis/HealthApi";

export interface HealthApiApiHealthDetailedGetRequest {
}

export interface HealthApiApiHealthGetRequest {
}

export class ObjectHealthApi {
    private api: ObservableHealthApi

    public constructor(configuration: Configuration, requestFactory?: HealthApiRequestFactory, responseProcessor?: HealthApiResponseProcessor) {
        this.api = new ObservableHealthApi(configuration, requestFactory, responseProcessor);
    }

    /**
     * Check if the API and all its services are running properly
     * Detailed health check
     * @param param the request object
     */
    public apiHealthDetailedGetWithHttpInfo(param: HealthApiApiHealthDetailedGetRequest = {}, options?: ConfigurationOptions): Promise<HttpInfo<ApiHealthDetailedGet200Response>> {
        return this.api.apiHealthDetailedGetWithHttpInfo( options).toPromise();
    }

    /**
     * Check if the API and all its services are running properly
     * Detailed health check
     * @param param the request object
     */
    public apiHealthDetailedGet(param: HealthApiApiHealthDetailedGetRequest = {}, options?: ConfigurationOptions): Promise<ApiHealthDetailedGet200Response> {
        return this.api.apiHealthDetailedGet( options).toPromise();
    }

    /**
     * Check if the API is running
     * Basic health check
     * @param param the request object
     */
    public apiHealthGetWithHttpInfo(param: HealthApiApiHealthGetRequest = {}, options?: ConfigurationOptions): Promise<HttpInfo<ApiHealthGet200Response>> {
        return this.api.apiHealthGetWithHttpInfo( options).toPromise();
    }

    /**
     * Check if the API is running
     * Basic health check
     * @param param the request object
     */
    public apiHealthGet(param: HealthApiApiHealthGetRequest = {}, options?: ConfigurationOptions): Promise<ApiHealthGet200Response> {
        return this.api.apiHealthGet( options).toPromise();
    }

}

import { ObservablePriceApi } from "./ObservableAPI";
import { PriceApiRequestFactory, PriceApiResponseProcessor} from "../apis/PriceApi";

export interface PriceApiApiPriceGetRequest {
    /**
     * Token address
     * Defaults to: undefined
     * @type string
     * @memberof PriceApiapiPriceGet
     */
    token: string
    /**
     * Blockchain type of the token
     * Defaults to: undefined
     * @type &#39;evm&#39; | &#39;svm&#39;
     * @memberof PriceApiapiPriceGet
     */
    chain?: 'evm' | 'svm'
    /**
     * Specific chain for EVM tokens
     * Defaults to: undefined
     * @type &#39;eth&#39; | &#39;polygon&#39; | &#39;bsc&#39; | &#39;arbitrum&#39; | &#39;optimism&#39; | &#39;avalanche&#39; | &#39;base&#39; | &#39;linea&#39; | &#39;zksync&#39; | &#39;scroll&#39; | &#39;mantle&#39; | &#39;svm&#39;
     * @memberof PriceApiapiPriceGet
     */
    specificChain?: 'eth' | 'polygon' | 'bsc' | 'arbitrum' | 'optimism' | 'avalanche' | 'base' | 'linea' | 'zksync' | 'scroll' | 'mantle' | 'svm'
}

export interface PriceApiApiPriceTokenInfoGetRequest {
    /**
     * Token address
     * Defaults to: undefined
     * @type string
     * @memberof PriceApiapiPriceTokenInfoGet
     */
    token: string
    /**
     * Blockchain type of the token
     * Defaults to: undefined
     * @type &#39;evm&#39; | &#39;svm&#39;
     * @memberof PriceApiapiPriceTokenInfoGet
     */
    chain?: 'evm' | 'svm'
    /**
     * Specific chain for EVM tokens
     * Defaults to: undefined
     * @type &#39;eth&#39; | &#39;polygon&#39; | &#39;bsc&#39; | &#39;arbitrum&#39; | &#39;optimism&#39; | &#39;avalanche&#39; | &#39;base&#39; | &#39;linea&#39; | &#39;zksync&#39; | &#39;scroll&#39; | &#39;mantle&#39; | &#39;svm&#39;
     * @memberof PriceApiapiPriceTokenInfoGet
     */
    specificChain?: 'eth' | 'polygon' | 'bsc' | 'arbitrum' | 'optimism' | 'avalanche' | 'base' | 'linea' | 'zksync' | 'scroll' | 'mantle' | 'svm'
}

export class ObjectPriceApi {
    private api: ObservablePriceApi

    public constructor(configuration: Configuration, requestFactory?: PriceApiRequestFactory, responseProcessor?: PriceApiResponseProcessor) {
        this.api = new ObservablePriceApi(configuration, requestFactory, responseProcessor);
    }

    /**
     * Get the current price of a specified token
     * Get price for a token
     * @param param the request object
     */
    public apiPriceGetWithHttpInfo(param: PriceApiApiPriceGetRequest, options?: ConfigurationOptions): Promise<HttpInfo<ApiPriceGet200Response>> {
        return this.api.apiPriceGetWithHttpInfo(param.token, param.chain, param.specificChain,  options).toPromise();
    }

    /**
     * Get the current price of a specified token
     * Get price for a token
     * @param param the request object
     */
    public apiPriceGet(param: PriceApiApiPriceGetRequest, options?: ConfigurationOptions): Promise<ApiPriceGet200Response> {
        return this.api.apiPriceGet(param.token, param.chain, param.specificChain,  options).toPromise();
    }

    /**
     * Get detailed token information including price and specific chain
     * Get detailed token information
     * @param param the request object
     */
    public apiPriceTokenInfoGetWithHttpInfo(param: PriceApiApiPriceTokenInfoGetRequest, options?: ConfigurationOptions): Promise<HttpInfo<ApiPriceTokenInfoGet200Response>> {
        return this.api.apiPriceTokenInfoGetWithHttpInfo(param.token, param.chain, param.specificChain,  options).toPromise();
    }

    /**
     * Get detailed token information including price and specific chain
     * Get detailed token information
     * @param param the request object
     */
    public apiPriceTokenInfoGet(param: PriceApiApiPriceTokenInfoGetRequest, options?: ConfigurationOptions): Promise<ApiPriceTokenInfoGet200Response> {
        return this.api.apiPriceTokenInfoGet(param.token, param.chain, param.specificChain,  options).toPromise();
    }

}

import { ObservablePublicApi } from "./ObservableAPI";
import { PublicApiRequestFactory, PublicApiResponseProcessor} from "../apis/PublicApi";

export interface PublicApiApiPublicTeamsRegisterPostRequest {
    /**
     * 
     * @type ApiPublicTeamsRegisterPostRequest
     * @memberof PublicApiapiPublicTeamsRegisterPost
     */
    apiPublicTeamsRegisterPostRequest: ApiPublicTeamsRegisterPostRequest
}

export class ObjectPublicApi {
    private api: ObservablePublicApi

    public constructor(configuration: Configuration, requestFactory?: PublicApiRequestFactory, responseProcessor?: PublicApiResponseProcessor) {
        this.api = new ObservablePublicApi(configuration, requestFactory, responseProcessor);
    }

    /**
     * Public endpoint to register a new team. Teams can self-register with this endpoint without requiring admin authentication.
     * Register a new team
     * @param param the request object
     */
    public apiPublicTeamsRegisterPostWithHttpInfo(param: PublicApiApiPublicTeamsRegisterPostRequest, options?: ConfigurationOptions): Promise<HttpInfo<ApiPublicTeamsRegisterPost201Response>> {
        return this.api.apiPublicTeamsRegisterPostWithHttpInfo(param.apiPublicTeamsRegisterPostRequest,  options).toPromise();
    }

    /**
     * Public endpoint to register a new team. Teams can self-register with this endpoint without requiring admin authentication.
     * Register a new team
     * @param param the request object
     */
    public apiPublicTeamsRegisterPost(param: PublicApiApiPublicTeamsRegisterPostRequest, options?: ConfigurationOptions): Promise<ApiPublicTeamsRegisterPost201Response> {
        return this.api.apiPublicTeamsRegisterPost(param.apiPublicTeamsRegisterPostRequest,  options).toPromise();
    }

}

import { ObservableTradeApi } from "./ObservableAPI";
import { TradeApiRequestFactory, TradeApiResponseProcessor} from "../apis/TradeApi";

export interface TradeApiApiTradeExecutePostRequest {
    /**
     * 
     * @type ApiTradeExecutePostRequest
     * @memberof TradeApiapiTradeExecutePost
     */
    apiTradeExecutePostRequest: ApiTradeExecutePostRequest
}

export interface TradeApiApiTradeQuoteGetRequest {
    /**
     * Token address to sell
     * Defaults to: undefined
     * @type string
     * @memberof TradeApiapiTradeQuoteGet
     */
    fromToken: string
    /**
     * Token address to buy
     * Defaults to: undefined
     * @type string
     * @memberof TradeApiapiTradeQuoteGet
     */
    toToken: string
    /**
     * Amount of fromToken to get quote for
     * Defaults to: undefined
     * @type string
     * @memberof TradeApiapiTradeQuoteGet
     */
    amount: string
    /**
     * Optional blockchain type for fromToken
     * Defaults to: undefined
     * @type string
     * @memberof TradeApiapiTradeQuoteGet
     */
    fromChain?: string
    /**
     * Optional specific chain for fromToken
     * Defaults to: undefined
     * @type string
     * @memberof TradeApiapiTradeQuoteGet
     */
    fromSpecificChain?: string
    /**
     * Optional blockchain type for toToken
     * Defaults to: undefined
     * @type string
     * @memberof TradeApiapiTradeQuoteGet
     */
    toChain?: string
    /**
     * Optional specific chain for toToken
     * Defaults to: undefined
     * @type string
     * @memberof TradeApiapiTradeQuoteGet
     */
    toSpecificChain?: string
}

export class ObjectTradeApi {
    private api: ObservableTradeApi

    public constructor(configuration: Configuration, requestFactory?: TradeApiRequestFactory, responseProcessor?: TradeApiResponseProcessor) {
        this.api = new ObservableTradeApi(configuration, requestFactory, responseProcessor);
    }

    /**
     * Execute a trade between two tokens
     * Execute a trade
     * @param param the request object
     */
    public apiTradeExecutePostWithHttpInfo(param: TradeApiApiTradeExecutePostRequest, options?: ConfigurationOptions): Promise<HttpInfo<ApiTradeExecutePost200Response>> {
        return this.api.apiTradeExecutePostWithHttpInfo(param.apiTradeExecutePostRequest,  options).toPromise();
    }

    /**
     * Execute a trade between two tokens
     * Execute a trade
     * @param param the request object
     */
    public apiTradeExecutePost(param: TradeApiApiTradeExecutePostRequest, options?: ConfigurationOptions): Promise<ApiTradeExecutePost200Response> {
        return this.api.apiTradeExecutePost(param.apiTradeExecutePostRequest,  options).toPromise();
    }

    /**
     * Get a quote for a potential trade between two tokens
     * Get a quote for a trade
     * @param param the request object
     */
    public apiTradeQuoteGetWithHttpInfo(param: TradeApiApiTradeQuoteGetRequest, options?: ConfigurationOptions): Promise<HttpInfo<ApiTradeQuoteGet200Response>> {
        return this.api.apiTradeQuoteGetWithHttpInfo(param.fromToken, param.toToken, param.amount, param.fromChain, param.fromSpecificChain, param.toChain, param.toSpecificChain,  options).toPromise();
    }

    /**
     * Get a quote for a potential trade between two tokens
     * Get a quote for a trade
     * @param param the request object
     */
    public apiTradeQuoteGet(param: TradeApiApiTradeQuoteGetRequest, options?: ConfigurationOptions): Promise<ApiTradeQuoteGet200Response> {
        return this.api.apiTradeQuoteGet(param.fromToken, param.toToken, param.amount, param.fromChain, param.fromSpecificChain, param.toChain, param.toSpecificChain,  options).toPromise();
    }

}
