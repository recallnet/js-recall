import { ResponseContext, RequestContext, HttpFile, HttpInfo } from '../http/http';
import { Configuration, PromiseConfigurationOptions, wrapOptions } from '../configuration'
import { PromiseMiddleware, Middleware, PromiseMiddlewareWrapper } from '../middleware';

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
import { ObservableAccountApi } from './ObservableAPI';

import { AccountApiRequestFactory, AccountApiResponseProcessor} from "../apis/AccountApi";
export class PromiseAccountApi {
    private api: ObservableAccountApi

    public constructor(
        configuration: Configuration,
        requestFactory?: AccountApiRequestFactory,
        responseProcessor?: AccountApiResponseProcessor
    ) {
        this.api = new ObservableAccountApi(configuration, requestFactory, responseProcessor);
    }

    /**
     * Get all token balances for the authenticated team
     * Get token balances
     */
    public apiAccountBalancesGetWithHttpInfo(_options?: PromiseConfigurationOptions): Promise<HttpInfo<ApiAccountBalancesGet200Response>> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.apiAccountBalancesGetWithHttpInfo(observableOptions);
        return result.toPromise();
    }

    /**
     * Get all token balances for the authenticated team
     * Get token balances
     */
    public apiAccountBalancesGet(_options?: PromiseConfigurationOptions): Promise<ApiAccountBalancesGet200Response> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.apiAccountBalancesGet(observableOptions);
        return result.toPromise();
    }

    /**
     * Get portfolio valuation and token details for the authenticated team
     * Get portfolio information
     */
    public apiAccountPortfolioGetWithHttpInfo(_options?: PromiseConfigurationOptions): Promise<HttpInfo<ApiAccountPortfolioGet200Response>> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.apiAccountPortfolioGetWithHttpInfo(observableOptions);
        return result.toPromise();
    }

    /**
     * Get portfolio valuation and token details for the authenticated team
     * Get portfolio information
     */
    public apiAccountPortfolioGet(_options?: PromiseConfigurationOptions): Promise<ApiAccountPortfolioGet200Response> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.apiAccountPortfolioGet(observableOptions);
        return result.toPromise();
    }

    /**
     * Get profile information for the authenticated team
     * Get team profile
     */
    public apiAccountProfileGetWithHttpInfo(_options?: PromiseConfigurationOptions): Promise<HttpInfo<ApiAccountProfileGet200Response>> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.apiAccountProfileGetWithHttpInfo(observableOptions);
        return result.toPromise();
    }

    /**
     * Get profile information for the authenticated team
     * Get team profile
     */
    public apiAccountProfileGet(_options?: PromiseConfigurationOptions): Promise<ApiAccountProfileGet200Response> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.apiAccountProfileGet(observableOptions);
        return result.toPromise();
    }

    /**
     * Update profile information for the authenticated team
     * Update team profile
     * @param apiAccountProfilePutRequest
     */
    public apiAccountProfilePutWithHttpInfo(apiAccountProfilePutRequest: ApiAccountProfilePutRequest, _options?: PromiseConfigurationOptions): Promise<HttpInfo<ApiAccountProfilePut200Response>> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.apiAccountProfilePutWithHttpInfo(apiAccountProfilePutRequest, observableOptions);
        return result.toPromise();
    }

    /**
     * Update profile information for the authenticated team
     * Update team profile
     * @param apiAccountProfilePutRequest
     */
    public apiAccountProfilePut(apiAccountProfilePutRequest: ApiAccountProfilePutRequest, _options?: PromiseConfigurationOptions): Promise<ApiAccountProfilePut200Response> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.apiAccountProfilePut(apiAccountProfilePutRequest, observableOptions);
        return result.toPromise();
    }

    /**
     * Reset the API key for the authenticated team. This will invalidate the current API key and generate a new one.
     * Reset team API key
     */
    public apiAccountResetApiKeyPostWithHttpInfo(_options?: PromiseConfigurationOptions): Promise<HttpInfo<ApiAccountResetApiKeyPost200Response>> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.apiAccountResetApiKeyPostWithHttpInfo(observableOptions);
        return result.toPromise();
    }

    /**
     * Reset the API key for the authenticated team. This will invalidate the current API key and generate a new one.
     * Reset team API key
     */
    public apiAccountResetApiKeyPost(_options?: PromiseConfigurationOptions): Promise<ApiAccountResetApiKeyPost200Response> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.apiAccountResetApiKeyPost(observableOptions);
        return result.toPromise();
    }

    /**
     * Get trade history for the authenticated team
     * Get trade history
     */
    public apiAccountTradesGetWithHttpInfo(_options?: PromiseConfigurationOptions): Promise<HttpInfo<ApiAccountTradesGet200Response>> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.apiAccountTradesGetWithHttpInfo(observableOptions);
        return result.toPromise();
    }

    /**
     * Get trade history for the authenticated team
     * Get trade history
     */
    public apiAccountTradesGet(_options?: PromiseConfigurationOptions): Promise<ApiAccountTradesGet200Response> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.apiAccountTradesGet(observableOptions);
        return result.toPromise();
    }


}



import { ObservableAdminApi } from './ObservableAPI';

import { AdminApiRequestFactory, AdminApiResponseProcessor} from "../apis/AdminApi";
export class PromiseAdminApi {
    private api: ObservableAdminApi

    public constructor(
        configuration: Configuration,
        requestFactory?: AdminApiRequestFactory,
        responseProcessor?: AdminApiResponseProcessor
    ) {
        this.api = new ObservableAdminApi(configuration, requestFactory, responseProcessor);
    }

    /**
     * Get portfolio snapshots for a competition, optionally filtered by team
     * Get competition snapshots
     * @param competitionId ID of the competition
     * @param [teamId] Optional team ID to filter snapshots
     */
    public apiAdminCompetitionCompetitionIdSnapshotsGetWithHttpInfo(competitionId: string, teamId?: string, _options?: PromiseConfigurationOptions): Promise<HttpInfo<ApiAdminCompetitionCompetitionIdSnapshotsGet200Response>> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.apiAdminCompetitionCompetitionIdSnapshotsGetWithHttpInfo(competitionId, teamId, observableOptions);
        return result.toPromise();
    }

    /**
     * Get portfolio snapshots for a competition, optionally filtered by team
     * Get competition snapshots
     * @param competitionId ID of the competition
     * @param [teamId] Optional team ID to filter snapshots
     */
    public apiAdminCompetitionCompetitionIdSnapshotsGet(competitionId: string, teamId?: string, _options?: PromiseConfigurationOptions): Promise<ApiAdminCompetitionCompetitionIdSnapshotsGet200Response> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.apiAdminCompetitionCompetitionIdSnapshotsGet(competitionId, teamId, observableOptions);
        return result.toPromise();
    }

    /**
     * Create a new competition without starting it. It will be in PENDING status and can be started later.
     * Create a competition
     * @param apiAdminCompetitionCreatePostRequest
     */
    public apiAdminCompetitionCreatePostWithHttpInfo(apiAdminCompetitionCreatePostRequest: ApiAdminCompetitionCreatePostRequest, _options?: PromiseConfigurationOptions): Promise<HttpInfo<ApiAdminCompetitionCreatePost201Response>> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.apiAdminCompetitionCreatePostWithHttpInfo(apiAdminCompetitionCreatePostRequest, observableOptions);
        return result.toPromise();
    }

    /**
     * Create a new competition without starting it. It will be in PENDING status and can be started later.
     * Create a competition
     * @param apiAdminCompetitionCreatePostRequest
     */
    public apiAdminCompetitionCreatePost(apiAdminCompetitionCreatePostRequest: ApiAdminCompetitionCreatePostRequest, _options?: PromiseConfigurationOptions): Promise<ApiAdminCompetitionCreatePost201Response> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.apiAdminCompetitionCreatePost(apiAdminCompetitionCreatePostRequest, observableOptions);
        return result.toPromise();
    }

    /**
     * End an active competition and finalize the results
     * End a competition
     * @param apiAdminCompetitionEndPostRequest
     */
    public apiAdminCompetitionEndPostWithHttpInfo(apiAdminCompetitionEndPostRequest: ApiAdminCompetitionEndPostRequest, _options?: PromiseConfigurationOptions): Promise<HttpInfo<ApiAdminCompetitionEndPost200Response>> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.apiAdminCompetitionEndPostWithHttpInfo(apiAdminCompetitionEndPostRequest, observableOptions);
        return result.toPromise();
    }

    /**
     * End an active competition and finalize the results
     * End a competition
     * @param apiAdminCompetitionEndPostRequest
     */
    public apiAdminCompetitionEndPost(apiAdminCompetitionEndPostRequest: ApiAdminCompetitionEndPostRequest, _options?: PromiseConfigurationOptions): Promise<ApiAdminCompetitionEndPost200Response> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.apiAdminCompetitionEndPost(apiAdminCompetitionEndPostRequest, observableOptions);
        return result.toPromise();
    }

    /**
     * Start a new or existing competition with specified teams. If competitionId is provided, it will start an existing competition. Otherwise, it will create and start a new one.
     * Start a competition
     * @param apiAdminCompetitionStartPostRequest
     */
    public apiAdminCompetitionStartPostWithHttpInfo(apiAdminCompetitionStartPostRequest: ApiAdminCompetitionStartPostRequest, _options?: PromiseConfigurationOptions): Promise<HttpInfo<ApiAdminCompetitionStartPost200Response>> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.apiAdminCompetitionStartPostWithHttpInfo(apiAdminCompetitionStartPostRequest, observableOptions);
        return result.toPromise();
    }

    /**
     * Start a new or existing competition with specified teams. If competitionId is provided, it will start an existing competition. Otherwise, it will create and start a new one.
     * Start a competition
     * @param apiAdminCompetitionStartPostRequest
     */
    public apiAdminCompetitionStartPost(apiAdminCompetitionStartPostRequest: ApiAdminCompetitionStartPostRequest, _options?: PromiseConfigurationOptions): Promise<ApiAdminCompetitionStartPost200Response> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.apiAdminCompetitionStartPost(apiAdminCompetitionStartPostRequest, observableOptions);
        return result.toPromise();
    }

    /**
     * Get performance reports and leaderboard for a competition
     * Get performance reports
     * @param competitionId ID of the competition
     */
    public apiAdminReportsPerformanceGetWithHttpInfo(competitionId: string, _options?: PromiseConfigurationOptions): Promise<HttpInfo<ApiAdminReportsPerformanceGet200Response>> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.apiAdminReportsPerformanceGetWithHttpInfo(competitionId, observableOptions);
        return result.toPromise();
    }

    /**
     * Get performance reports and leaderboard for a competition
     * Get performance reports
     * @param competitionId ID of the competition
     */
    public apiAdminReportsPerformanceGet(competitionId: string, _options?: PromiseConfigurationOptions): Promise<ApiAdminReportsPerformanceGet200Response> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.apiAdminReportsPerformanceGet(competitionId, observableOptions);
        return result.toPromise();
    }

    /**
     * Creates the first admin account. This endpoint is only available when no admin exists in the system.
     * Set up initial admin account
     * @param apiAdminSetupPostRequest
     */
    public apiAdminSetupPostWithHttpInfo(apiAdminSetupPostRequest: ApiAdminSetupPostRequest, _options?: PromiseConfigurationOptions): Promise<HttpInfo<ApiAdminSetupPost201Response>> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.apiAdminSetupPostWithHttpInfo(apiAdminSetupPostRequest, observableOptions);
        return result.toPromise();
    }

    /**
     * Creates the first admin account. This endpoint is only available when no admin exists in the system.
     * Set up initial admin account
     * @param apiAdminSetupPostRequest
     */
    public apiAdminSetupPost(apiAdminSetupPostRequest: ApiAdminSetupPostRequest, _options?: PromiseConfigurationOptions): Promise<ApiAdminSetupPost201Response> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.apiAdminSetupPost(apiAdminSetupPostRequest, observableOptions);
        return result.toPromise();
    }

    /**
     * Get a list of all non-admin teams
     * List all teams
     */
    public apiAdminTeamsGetWithHttpInfo(_options?: PromiseConfigurationOptions): Promise<HttpInfo<ApiAdminTeamsGet200Response>> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.apiAdminTeamsGetWithHttpInfo(observableOptions);
        return result.toPromise();
    }

    /**
     * Get a list of all non-admin teams
     * List all teams
     */
    public apiAdminTeamsGet(_options?: PromiseConfigurationOptions): Promise<ApiAdminTeamsGet200Response> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.apiAdminTeamsGet(observableOptions);
        return result.toPromise();
    }

    /**
     * Admin-only endpoint to register a new team. Admins create team accounts and distribute the generated API keys to team members. Teams cannot register themselves.
     * Register a new team
     * @param apiAdminTeamsRegisterPostRequest
     */
    public apiAdminTeamsRegisterPostWithHttpInfo(apiAdminTeamsRegisterPostRequest: ApiAdminTeamsRegisterPostRequest, _options?: PromiseConfigurationOptions): Promise<HttpInfo<ApiAdminTeamsRegisterPost201Response>> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.apiAdminTeamsRegisterPostWithHttpInfo(apiAdminTeamsRegisterPostRequest, observableOptions);
        return result.toPromise();
    }

    /**
     * Admin-only endpoint to register a new team. Admins create team accounts and distribute the generated API keys to team members. Teams cannot register themselves.
     * Register a new team
     * @param apiAdminTeamsRegisterPostRequest
     */
    public apiAdminTeamsRegisterPost(apiAdminTeamsRegisterPostRequest: ApiAdminTeamsRegisterPostRequest, _options?: PromiseConfigurationOptions): Promise<ApiAdminTeamsRegisterPost201Response> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.apiAdminTeamsRegisterPost(apiAdminTeamsRegisterPostRequest, observableOptions);
        return result.toPromise();
    }

    /**
     * Deactivate a team from the competition. The team will no longer be able to perform any actions.
     * Deactivate a team
     * @param teamId ID of the team to deactivate
     * @param apiAdminTeamsTeamIdDeactivatePostRequest
     */
    public apiAdminTeamsTeamIdDeactivatePostWithHttpInfo(teamId: string, apiAdminTeamsTeamIdDeactivatePostRequest: ApiAdminTeamsTeamIdDeactivatePostRequest, _options?: PromiseConfigurationOptions): Promise<HttpInfo<ApiAdminTeamsTeamIdDeactivatePost200Response>> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.apiAdminTeamsTeamIdDeactivatePostWithHttpInfo(teamId, apiAdminTeamsTeamIdDeactivatePostRequest, observableOptions);
        return result.toPromise();
    }

    /**
     * Deactivate a team from the competition. The team will no longer be able to perform any actions.
     * Deactivate a team
     * @param teamId ID of the team to deactivate
     * @param apiAdminTeamsTeamIdDeactivatePostRequest
     */
    public apiAdminTeamsTeamIdDeactivatePost(teamId: string, apiAdminTeamsTeamIdDeactivatePostRequest: ApiAdminTeamsTeamIdDeactivatePostRequest, _options?: PromiseConfigurationOptions): Promise<ApiAdminTeamsTeamIdDeactivatePost200Response> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.apiAdminTeamsTeamIdDeactivatePost(teamId, apiAdminTeamsTeamIdDeactivatePostRequest, observableOptions);
        return result.toPromise();
    }

    /**
     * Permanently delete a team and all associated data
     * Delete a team
     * @param teamId ID of the team to delete
     */
    public apiAdminTeamsTeamIdDeleteWithHttpInfo(teamId: string, _options?: PromiseConfigurationOptions): Promise<HttpInfo<ApiAdminTeamsTeamIdDelete200Response>> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.apiAdminTeamsTeamIdDeleteWithHttpInfo(teamId, observableOptions);
        return result.toPromise();
    }

    /**
     * Permanently delete a team and all associated data
     * Delete a team
     * @param teamId ID of the team to delete
     */
    public apiAdminTeamsTeamIdDelete(teamId: string, _options?: PromiseConfigurationOptions): Promise<ApiAdminTeamsTeamIdDelete200Response> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.apiAdminTeamsTeamIdDelete(teamId, observableOptions);
        return result.toPromise();
    }

    /**
     * Retrieves the original API key for a team. Use this when teams lose or misplace their API key.
     * Get a team\'s API key
     * @param teamId ID of the team
     */
    public apiAdminTeamsTeamIdKeyGetWithHttpInfo(teamId: string, _options?: PromiseConfigurationOptions): Promise<HttpInfo<ApiAdminTeamsTeamIdKeyGet200Response>> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.apiAdminTeamsTeamIdKeyGetWithHttpInfo(teamId, observableOptions);
        return result.toPromise();
    }

    /**
     * Retrieves the original API key for a team. Use this when teams lose or misplace their API key.
     * Get a team\'s API key
     * @param teamId ID of the team
     */
    public apiAdminTeamsTeamIdKeyGet(teamId: string, _options?: PromiseConfigurationOptions): Promise<ApiAdminTeamsTeamIdKeyGet200Response> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.apiAdminTeamsTeamIdKeyGet(teamId, observableOptions);
        return result.toPromise();
    }

    /**
     * Reactivate a previously deactivated team, allowing them to participate in the competition again.
     * Reactivate a team
     * @param teamId ID of the team to reactivate
     */
    public apiAdminTeamsTeamIdReactivatePostWithHttpInfo(teamId: string, _options?: PromiseConfigurationOptions): Promise<HttpInfo<ApiAdminTeamsTeamIdReactivatePost200Response>> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.apiAdminTeamsTeamIdReactivatePostWithHttpInfo(teamId, observableOptions);
        return result.toPromise();
    }

    /**
     * Reactivate a previously deactivated team, allowing them to participate in the competition again.
     * Reactivate a team
     * @param teamId ID of the team to reactivate
     */
    public apiAdminTeamsTeamIdReactivatePost(teamId: string, _options?: PromiseConfigurationOptions): Promise<ApiAdminTeamsTeamIdReactivatePost200Response> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.apiAdminTeamsTeamIdReactivatePost(teamId, observableOptions);
        return result.toPromise();
    }


}



import { ObservableCompetitionApi } from './ObservableAPI';

import { CompetitionApiRequestFactory, CompetitionApiResponseProcessor} from "../apis/CompetitionApi";
export class PromiseCompetitionApi {
    private api: ObservableCompetitionApi

    public constructor(
        configuration: Configuration,
        requestFactory?: CompetitionApiRequestFactory,
        responseProcessor?: CompetitionApiResponseProcessor
    ) {
        this.api = new ObservableCompetitionApi(configuration, requestFactory, responseProcessor);
    }

    /**
     * Get the leaderboard for the active competition or a specific competition. Access may be restricted to administrators only based on environment configuration.
     * Get competition leaderboard
     * @param [competitionId] Optional competition ID (if not provided, the active competition is used)
     */
    public apiCompetitionLeaderboardGetWithHttpInfo(competitionId?: string, _options?: PromiseConfigurationOptions): Promise<HttpInfo<ApiCompetitionLeaderboardGet200Response>> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.apiCompetitionLeaderboardGetWithHttpInfo(competitionId, observableOptions);
        return result.toPromise();
    }

    /**
     * Get the leaderboard for the active competition or a specific competition. Access may be restricted to administrators only based on environment configuration.
     * Get competition leaderboard
     * @param [competitionId] Optional competition ID (if not provided, the active competition is used)
     */
    public apiCompetitionLeaderboardGet(competitionId?: string, _options?: PromiseConfigurationOptions): Promise<ApiCompetitionLeaderboardGet200Response> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.apiCompetitionLeaderboardGet(competitionId, observableOptions);
        return result.toPromise();
    }

    /**
     * Get the rules, rate limits, and other configuration details for the competition
     * Get competition rules
     */
    public apiCompetitionRulesGetWithHttpInfo(_options?: PromiseConfigurationOptions): Promise<HttpInfo<ApiCompetitionRulesGet200Response>> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.apiCompetitionRulesGetWithHttpInfo(observableOptions);
        return result.toPromise();
    }

    /**
     * Get the rules, rate limits, and other configuration details for the competition
     * Get competition rules
     */
    public apiCompetitionRulesGet(_options?: PromiseConfigurationOptions): Promise<ApiCompetitionRulesGet200Response> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.apiCompetitionRulesGet(observableOptions);
        return result.toPromise();
    }

    /**
     * Get the status of the active competition
     * Get competition status
     */
    public apiCompetitionStatusGetWithHttpInfo(_options?: PromiseConfigurationOptions): Promise<HttpInfo<ApiCompetitionStatusGet200Response>> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.apiCompetitionStatusGetWithHttpInfo(observableOptions);
        return result.toPromise();
    }

    /**
     * Get the status of the active competition
     * Get competition status
     */
    public apiCompetitionStatusGet(_options?: PromiseConfigurationOptions): Promise<ApiCompetitionStatusGet200Response> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.apiCompetitionStatusGet(observableOptions);
        return result.toPromise();
    }

    /**
     * Get all competitions that have not started yet (status=PENDING)
     * Get upcoming competitions
     */
    public apiCompetitionUpcomingGetWithHttpInfo(_options?: PromiseConfigurationOptions): Promise<HttpInfo<ApiCompetitionUpcomingGet200Response>> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.apiCompetitionUpcomingGetWithHttpInfo(observableOptions);
        return result.toPromise();
    }

    /**
     * Get all competitions that have not started yet (status=PENDING)
     * Get upcoming competitions
     */
    public apiCompetitionUpcomingGet(_options?: PromiseConfigurationOptions): Promise<ApiCompetitionUpcomingGet200Response> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.apiCompetitionUpcomingGet(observableOptions);
        return result.toPromise();
    }


}



import { ObservableHealthApi } from './ObservableAPI';

import { HealthApiRequestFactory, HealthApiResponseProcessor} from "../apis/HealthApi";
export class PromiseHealthApi {
    private api: ObservableHealthApi

    public constructor(
        configuration: Configuration,
        requestFactory?: HealthApiRequestFactory,
        responseProcessor?: HealthApiResponseProcessor
    ) {
        this.api = new ObservableHealthApi(configuration, requestFactory, responseProcessor);
    }

    /**
     * Check if the API and all its services are running properly
     * Detailed health check
     */
    public apiHealthDetailedGetWithHttpInfo(_options?: PromiseConfigurationOptions): Promise<HttpInfo<ApiHealthDetailedGet200Response>> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.apiHealthDetailedGetWithHttpInfo(observableOptions);
        return result.toPromise();
    }

    /**
     * Check if the API and all its services are running properly
     * Detailed health check
     */
    public apiHealthDetailedGet(_options?: PromiseConfigurationOptions): Promise<ApiHealthDetailedGet200Response> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.apiHealthDetailedGet(observableOptions);
        return result.toPromise();
    }

    /**
     * Check if the API is running
     * Basic health check
     */
    public apiHealthGetWithHttpInfo(_options?: PromiseConfigurationOptions): Promise<HttpInfo<ApiHealthGet200Response>> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.apiHealthGetWithHttpInfo(observableOptions);
        return result.toPromise();
    }

    /**
     * Check if the API is running
     * Basic health check
     */
    public apiHealthGet(_options?: PromiseConfigurationOptions): Promise<ApiHealthGet200Response> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.apiHealthGet(observableOptions);
        return result.toPromise();
    }


}



import { ObservablePriceApi } from './ObservableAPI';

import { PriceApiRequestFactory, PriceApiResponseProcessor} from "../apis/PriceApi";
export class PromisePriceApi {
    private api: ObservablePriceApi

    public constructor(
        configuration: Configuration,
        requestFactory?: PriceApiRequestFactory,
        responseProcessor?: PriceApiResponseProcessor
    ) {
        this.api = new ObservablePriceApi(configuration, requestFactory, responseProcessor);
    }

    /**
     * Get the current price of a specified token
     * Get price for a token
     * @param token Token address
     * @param [chain] Blockchain type of the token
     * @param [specificChain] Specific chain for EVM tokens
     */
    public apiPriceGetWithHttpInfo(token: string, chain?: 'evm' | 'svm', specificChain?: 'eth' | 'polygon' | 'bsc' | 'arbitrum' | 'optimism' | 'avalanche' | 'base' | 'linea' | 'zksync' | 'scroll' | 'mantle' | 'svm', _options?: PromiseConfigurationOptions): Promise<HttpInfo<ApiPriceGet200Response>> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.apiPriceGetWithHttpInfo(token, chain, specificChain, observableOptions);
        return result.toPromise();
    }

    /**
     * Get the current price of a specified token
     * Get price for a token
     * @param token Token address
     * @param [chain] Blockchain type of the token
     * @param [specificChain] Specific chain for EVM tokens
     */
    public apiPriceGet(token: string, chain?: 'evm' | 'svm', specificChain?: 'eth' | 'polygon' | 'bsc' | 'arbitrum' | 'optimism' | 'avalanche' | 'base' | 'linea' | 'zksync' | 'scroll' | 'mantle' | 'svm', _options?: PromiseConfigurationOptions): Promise<ApiPriceGet200Response> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.apiPriceGet(token, chain, specificChain, observableOptions);
        return result.toPromise();
    }

    /**
     * Get detailed token information including price and specific chain
     * Get detailed token information
     * @param token Token address
     * @param [chain] Blockchain type of the token
     * @param [specificChain] Specific chain for EVM tokens
     */
    public apiPriceTokenInfoGetWithHttpInfo(token: string, chain?: 'evm' | 'svm', specificChain?: 'eth' | 'polygon' | 'bsc' | 'arbitrum' | 'optimism' | 'avalanche' | 'base' | 'linea' | 'zksync' | 'scroll' | 'mantle' | 'svm', _options?: PromiseConfigurationOptions): Promise<HttpInfo<ApiPriceTokenInfoGet200Response>> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.apiPriceTokenInfoGetWithHttpInfo(token, chain, specificChain, observableOptions);
        return result.toPromise();
    }

    /**
     * Get detailed token information including price and specific chain
     * Get detailed token information
     * @param token Token address
     * @param [chain] Blockchain type of the token
     * @param [specificChain] Specific chain for EVM tokens
     */
    public apiPriceTokenInfoGet(token: string, chain?: 'evm' | 'svm', specificChain?: 'eth' | 'polygon' | 'bsc' | 'arbitrum' | 'optimism' | 'avalanche' | 'base' | 'linea' | 'zksync' | 'scroll' | 'mantle' | 'svm', _options?: PromiseConfigurationOptions): Promise<ApiPriceTokenInfoGet200Response> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.apiPriceTokenInfoGet(token, chain, specificChain, observableOptions);
        return result.toPromise();
    }


}



import { ObservablePublicApi } from './ObservableAPI';

import { PublicApiRequestFactory, PublicApiResponseProcessor} from "../apis/PublicApi";
export class PromisePublicApi {
    private api: ObservablePublicApi

    public constructor(
        configuration: Configuration,
        requestFactory?: PublicApiRequestFactory,
        responseProcessor?: PublicApiResponseProcessor
    ) {
        this.api = new ObservablePublicApi(configuration, requestFactory, responseProcessor);
    }

    /**
     * Public endpoint to register a new team. Teams can self-register with this endpoint without requiring admin authentication.
     * Register a new team
     * @param apiPublicTeamsRegisterPostRequest
     */
    public apiPublicTeamsRegisterPostWithHttpInfo(apiPublicTeamsRegisterPostRequest: ApiPublicTeamsRegisterPostRequest, _options?: PromiseConfigurationOptions): Promise<HttpInfo<ApiPublicTeamsRegisterPost201Response>> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.apiPublicTeamsRegisterPostWithHttpInfo(apiPublicTeamsRegisterPostRequest, observableOptions);
        return result.toPromise();
    }

    /**
     * Public endpoint to register a new team. Teams can self-register with this endpoint without requiring admin authentication.
     * Register a new team
     * @param apiPublicTeamsRegisterPostRequest
     */
    public apiPublicTeamsRegisterPost(apiPublicTeamsRegisterPostRequest: ApiPublicTeamsRegisterPostRequest, _options?: PromiseConfigurationOptions): Promise<ApiPublicTeamsRegisterPost201Response> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.apiPublicTeamsRegisterPost(apiPublicTeamsRegisterPostRequest, observableOptions);
        return result.toPromise();
    }


}



import { ObservableTradeApi } from './ObservableAPI';

import { TradeApiRequestFactory, TradeApiResponseProcessor} from "../apis/TradeApi";
export class PromiseTradeApi {
    private api: ObservableTradeApi

    public constructor(
        configuration: Configuration,
        requestFactory?: TradeApiRequestFactory,
        responseProcessor?: TradeApiResponseProcessor
    ) {
        this.api = new ObservableTradeApi(configuration, requestFactory, responseProcessor);
    }

    /**
     * Execute a trade between two tokens
     * Execute a trade
     * @param apiTradeExecutePostRequest
     */
    public apiTradeExecutePostWithHttpInfo(apiTradeExecutePostRequest: ApiTradeExecutePostRequest, _options?: PromiseConfigurationOptions): Promise<HttpInfo<ApiTradeExecutePost200Response>> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.apiTradeExecutePostWithHttpInfo(apiTradeExecutePostRequest, observableOptions);
        return result.toPromise();
    }

    /**
     * Execute a trade between two tokens
     * Execute a trade
     * @param apiTradeExecutePostRequest
     */
    public apiTradeExecutePost(apiTradeExecutePostRequest: ApiTradeExecutePostRequest, _options?: PromiseConfigurationOptions): Promise<ApiTradeExecutePost200Response> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.apiTradeExecutePost(apiTradeExecutePostRequest, observableOptions);
        return result.toPromise();
    }

    /**
     * Get a quote for a potential trade between two tokens
     * Get a quote for a trade
     * @param fromToken Token address to sell
     * @param toToken Token address to buy
     * @param amount Amount of fromToken to get quote for
     * @param [fromChain] Optional blockchain type for fromToken
     * @param [fromSpecificChain] Optional specific chain for fromToken
     * @param [toChain] Optional blockchain type for toToken
     * @param [toSpecificChain] Optional specific chain for toToken
     */
    public apiTradeQuoteGetWithHttpInfo(fromToken: string, toToken: string, amount: string, fromChain?: string, fromSpecificChain?: string, toChain?: string, toSpecificChain?: string, _options?: PromiseConfigurationOptions): Promise<HttpInfo<ApiTradeQuoteGet200Response>> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.apiTradeQuoteGetWithHttpInfo(fromToken, toToken, amount, fromChain, fromSpecificChain, toChain, toSpecificChain, observableOptions);
        return result.toPromise();
    }

    /**
     * Get a quote for a potential trade between two tokens
     * Get a quote for a trade
     * @param fromToken Token address to sell
     * @param toToken Token address to buy
     * @param amount Amount of fromToken to get quote for
     * @param [fromChain] Optional blockchain type for fromToken
     * @param [fromSpecificChain] Optional specific chain for fromToken
     * @param [toChain] Optional blockchain type for toToken
     * @param [toSpecificChain] Optional specific chain for toToken
     */
    public apiTradeQuoteGet(fromToken: string, toToken: string, amount: string, fromChain?: string, fromSpecificChain?: string, toChain?: string, toSpecificChain?: string, _options?: PromiseConfigurationOptions): Promise<ApiTradeQuoteGet200Response> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.apiTradeQuoteGet(fromToken, toToken, amount, fromChain, fromSpecificChain, toChain, toSpecificChain, observableOptions);
        return result.toPromise();
    }


}



