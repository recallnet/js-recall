import { ResponseContext, RequestContext, HttpFile, HttpInfo } from '../http/http';
import { Configuration, ConfigurationOptions, mergeConfiguration } from '../configuration'
import type { Middleware } from '../middleware';
import { Observable, of, from } from '../rxjsStub';
import {mergeMap, map} from  '../rxjsStub';
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

import { AccountApiRequestFactory, AccountApiResponseProcessor} from "../apis/AccountApi";
export class ObservableAccountApi {
    private requestFactory: AccountApiRequestFactory;
    private responseProcessor: AccountApiResponseProcessor;
    private configuration: Configuration;

    public constructor(
        configuration: Configuration,
        requestFactory?: AccountApiRequestFactory,
        responseProcessor?: AccountApiResponseProcessor
    ) {
        this.configuration = configuration;
        this.requestFactory = requestFactory || new AccountApiRequestFactory(configuration);
        this.responseProcessor = responseProcessor || new AccountApiResponseProcessor();
    }

    /**
     * Get all token balances for the authenticated team
     * Get token balances
     */
    public apiAccountBalancesGetWithHttpInfo(_options?: ConfigurationOptions): Observable<HttpInfo<ApiAccountBalancesGet200Response>> {
        const _config = mergeConfiguration(this.configuration, _options);

        const requestContextPromise = this.requestFactory.apiAccountBalancesGet(_config);
        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (const middleware of _config.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => _config.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (const middleware of _config.middleware.reverse()) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.apiAccountBalancesGetWithHttpInfo(rsp)));
            }));
    }

    /**
     * Get all token balances for the authenticated team
     * Get token balances
     */
    public apiAccountBalancesGet(_options?: ConfigurationOptions): Observable<ApiAccountBalancesGet200Response> {
        return this.apiAccountBalancesGetWithHttpInfo(_options).pipe(map((apiResponse: HttpInfo<ApiAccountBalancesGet200Response>) => apiResponse.data));
    }

    /**
     * Get portfolio valuation and token details for the authenticated team
     * Get portfolio information
     */
    public apiAccountPortfolioGetWithHttpInfo(_options?: ConfigurationOptions): Observable<HttpInfo<ApiAccountPortfolioGet200Response>> {
        const _config = mergeConfiguration(this.configuration, _options);

        const requestContextPromise = this.requestFactory.apiAccountPortfolioGet(_config);
        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (const middleware of _config.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => _config.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (const middleware of _config.middleware.reverse()) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.apiAccountPortfolioGetWithHttpInfo(rsp)));
            }));
    }

    /**
     * Get portfolio valuation and token details for the authenticated team
     * Get portfolio information
     */
    public apiAccountPortfolioGet(_options?: ConfigurationOptions): Observable<ApiAccountPortfolioGet200Response> {
        return this.apiAccountPortfolioGetWithHttpInfo(_options).pipe(map((apiResponse: HttpInfo<ApiAccountPortfolioGet200Response>) => apiResponse.data));
    }

    /**
     * Get profile information for the authenticated team
     * Get team profile
     */
    public apiAccountProfileGetWithHttpInfo(_options?: ConfigurationOptions): Observable<HttpInfo<ApiAccountProfileGet200Response>> {
        const _config = mergeConfiguration(this.configuration, _options);

        const requestContextPromise = this.requestFactory.apiAccountProfileGet(_config);
        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (const middleware of _config.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => _config.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (const middleware of _config.middleware.reverse()) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.apiAccountProfileGetWithHttpInfo(rsp)));
            }));
    }

    /**
     * Get profile information for the authenticated team
     * Get team profile
     */
    public apiAccountProfileGet(_options?: ConfigurationOptions): Observable<ApiAccountProfileGet200Response> {
        return this.apiAccountProfileGetWithHttpInfo(_options).pipe(map((apiResponse: HttpInfo<ApiAccountProfileGet200Response>) => apiResponse.data));
    }

    /**
     * Update profile information for the authenticated team
     * Update team profile
     * @param apiAccountProfilePutRequest
     */
    public apiAccountProfilePutWithHttpInfo(apiAccountProfilePutRequest: ApiAccountProfilePutRequest, _options?: ConfigurationOptions): Observable<HttpInfo<ApiAccountProfilePut200Response>> {
        const _config = mergeConfiguration(this.configuration, _options);

        const requestContextPromise = this.requestFactory.apiAccountProfilePut(apiAccountProfilePutRequest, _config);
        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (const middleware of _config.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => _config.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (const middleware of _config.middleware.reverse()) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.apiAccountProfilePutWithHttpInfo(rsp)));
            }));
    }

    /**
     * Update profile information for the authenticated team
     * Update team profile
     * @param apiAccountProfilePutRequest
     */
    public apiAccountProfilePut(apiAccountProfilePutRequest: ApiAccountProfilePutRequest, _options?: ConfigurationOptions): Observable<ApiAccountProfilePut200Response> {
        return this.apiAccountProfilePutWithHttpInfo(apiAccountProfilePutRequest, _options).pipe(map((apiResponse: HttpInfo<ApiAccountProfilePut200Response>) => apiResponse.data));
    }

    /**
     * Reset the API key for the authenticated team. This will invalidate the current API key and generate a new one.
     * Reset team API key
     */
    public apiAccountResetApiKeyPostWithHttpInfo(_options?: ConfigurationOptions): Observable<HttpInfo<ApiAccountResetApiKeyPost200Response>> {
        const _config = mergeConfiguration(this.configuration, _options);

        const requestContextPromise = this.requestFactory.apiAccountResetApiKeyPost(_config);
        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (const middleware of _config.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => _config.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (const middleware of _config.middleware.reverse()) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.apiAccountResetApiKeyPostWithHttpInfo(rsp)));
            }));
    }

    /**
     * Reset the API key for the authenticated team. This will invalidate the current API key and generate a new one.
     * Reset team API key
     */
    public apiAccountResetApiKeyPost(_options?: ConfigurationOptions): Observable<ApiAccountResetApiKeyPost200Response> {
        return this.apiAccountResetApiKeyPostWithHttpInfo(_options).pipe(map((apiResponse: HttpInfo<ApiAccountResetApiKeyPost200Response>) => apiResponse.data));
    }

    /**
     * Get trade history for the authenticated team
     * Get trade history
     */
    public apiAccountTradesGetWithHttpInfo(_options?: ConfigurationOptions): Observable<HttpInfo<ApiAccountTradesGet200Response>> {
        const _config = mergeConfiguration(this.configuration, _options);

        const requestContextPromise = this.requestFactory.apiAccountTradesGet(_config);
        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (const middleware of _config.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => _config.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (const middleware of _config.middleware.reverse()) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.apiAccountTradesGetWithHttpInfo(rsp)));
            }));
    }

    /**
     * Get trade history for the authenticated team
     * Get trade history
     */
    public apiAccountTradesGet(_options?: ConfigurationOptions): Observable<ApiAccountTradesGet200Response> {
        return this.apiAccountTradesGetWithHttpInfo(_options).pipe(map((apiResponse: HttpInfo<ApiAccountTradesGet200Response>) => apiResponse.data));
    }

}

import { AdminApiRequestFactory, AdminApiResponseProcessor} from "../apis/AdminApi";
export class ObservableAdminApi {
    private requestFactory: AdminApiRequestFactory;
    private responseProcessor: AdminApiResponseProcessor;
    private configuration: Configuration;

    public constructor(
        configuration: Configuration,
        requestFactory?: AdminApiRequestFactory,
        responseProcessor?: AdminApiResponseProcessor
    ) {
        this.configuration = configuration;
        this.requestFactory = requestFactory || new AdminApiRequestFactory(configuration);
        this.responseProcessor = responseProcessor || new AdminApiResponseProcessor();
    }

    /**
     * Get portfolio snapshots for a competition, optionally filtered by team
     * Get competition snapshots
     * @param competitionId ID of the competition
     * @param [teamId] Optional team ID to filter snapshots
     */
    public apiAdminCompetitionCompetitionIdSnapshotsGetWithHttpInfo(competitionId: string, teamId?: string, _options?: ConfigurationOptions): Observable<HttpInfo<ApiAdminCompetitionCompetitionIdSnapshotsGet200Response>> {
        const _config = mergeConfiguration(this.configuration, _options);

        const requestContextPromise = this.requestFactory.apiAdminCompetitionCompetitionIdSnapshotsGet(competitionId, teamId, _config);
        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (const middleware of _config.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => _config.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (const middleware of _config.middleware.reverse()) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.apiAdminCompetitionCompetitionIdSnapshotsGetWithHttpInfo(rsp)));
            }));
    }

    /**
     * Get portfolio snapshots for a competition, optionally filtered by team
     * Get competition snapshots
     * @param competitionId ID of the competition
     * @param [teamId] Optional team ID to filter snapshots
     */
    public apiAdminCompetitionCompetitionIdSnapshotsGet(competitionId: string, teamId?: string, _options?: ConfigurationOptions): Observable<ApiAdminCompetitionCompetitionIdSnapshotsGet200Response> {
        return this.apiAdminCompetitionCompetitionIdSnapshotsGetWithHttpInfo(competitionId, teamId, _options).pipe(map((apiResponse: HttpInfo<ApiAdminCompetitionCompetitionIdSnapshotsGet200Response>) => apiResponse.data));
    }

    /**
     * Create a new competition without starting it. It will be in PENDING status and can be started later.
     * Create a competition
     * @param apiAdminCompetitionCreatePostRequest
     */
    public apiAdminCompetitionCreatePostWithHttpInfo(apiAdminCompetitionCreatePostRequest: ApiAdminCompetitionCreatePostRequest, _options?: ConfigurationOptions): Observable<HttpInfo<ApiAdminCompetitionCreatePost201Response>> {
        const _config = mergeConfiguration(this.configuration, _options);

        const requestContextPromise = this.requestFactory.apiAdminCompetitionCreatePost(apiAdminCompetitionCreatePostRequest, _config);
        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (const middleware of _config.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => _config.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (const middleware of _config.middleware.reverse()) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.apiAdminCompetitionCreatePostWithHttpInfo(rsp)));
            }));
    }

    /**
     * Create a new competition without starting it. It will be in PENDING status and can be started later.
     * Create a competition
     * @param apiAdminCompetitionCreatePostRequest
     */
    public apiAdminCompetitionCreatePost(apiAdminCompetitionCreatePostRequest: ApiAdminCompetitionCreatePostRequest, _options?: ConfigurationOptions): Observable<ApiAdminCompetitionCreatePost201Response> {
        return this.apiAdminCompetitionCreatePostWithHttpInfo(apiAdminCompetitionCreatePostRequest, _options).pipe(map((apiResponse: HttpInfo<ApiAdminCompetitionCreatePost201Response>) => apiResponse.data));
    }

    /**
     * End an active competition and finalize the results
     * End a competition
     * @param apiAdminCompetitionEndPostRequest
     */
    public apiAdminCompetitionEndPostWithHttpInfo(apiAdminCompetitionEndPostRequest: ApiAdminCompetitionEndPostRequest, _options?: ConfigurationOptions): Observable<HttpInfo<ApiAdminCompetitionEndPost200Response>> {
        const _config = mergeConfiguration(this.configuration, _options);

        const requestContextPromise = this.requestFactory.apiAdminCompetitionEndPost(apiAdminCompetitionEndPostRequest, _config);
        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (const middleware of _config.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => _config.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (const middleware of _config.middleware.reverse()) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.apiAdminCompetitionEndPostWithHttpInfo(rsp)));
            }));
    }

    /**
     * End an active competition and finalize the results
     * End a competition
     * @param apiAdminCompetitionEndPostRequest
     */
    public apiAdminCompetitionEndPost(apiAdminCompetitionEndPostRequest: ApiAdminCompetitionEndPostRequest, _options?: ConfigurationOptions): Observable<ApiAdminCompetitionEndPost200Response> {
        return this.apiAdminCompetitionEndPostWithHttpInfo(apiAdminCompetitionEndPostRequest, _options).pipe(map((apiResponse: HttpInfo<ApiAdminCompetitionEndPost200Response>) => apiResponse.data));
    }

    /**
     * Start a new or existing competition with specified teams. If competitionId is provided, it will start an existing competition. Otherwise, it will create and start a new one.
     * Start a competition
     * @param apiAdminCompetitionStartPostRequest
     */
    public apiAdminCompetitionStartPostWithHttpInfo(apiAdminCompetitionStartPostRequest: ApiAdminCompetitionStartPostRequest, _options?: ConfigurationOptions): Observable<HttpInfo<ApiAdminCompetitionStartPost200Response>> {
        const _config = mergeConfiguration(this.configuration, _options);

        const requestContextPromise = this.requestFactory.apiAdminCompetitionStartPost(apiAdminCompetitionStartPostRequest, _config);
        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (const middleware of _config.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => _config.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (const middleware of _config.middleware.reverse()) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.apiAdminCompetitionStartPostWithHttpInfo(rsp)));
            }));
    }

    /**
     * Start a new or existing competition with specified teams. If competitionId is provided, it will start an existing competition. Otherwise, it will create and start a new one.
     * Start a competition
     * @param apiAdminCompetitionStartPostRequest
     */
    public apiAdminCompetitionStartPost(apiAdminCompetitionStartPostRequest: ApiAdminCompetitionStartPostRequest, _options?: ConfigurationOptions): Observable<ApiAdminCompetitionStartPost200Response> {
        return this.apiAdminCompetitionStartPostWithHttpInfo(apiAdminCompetitionStartPostRequest, _options).pipe(map((apiResponse: HttpInfo<ApiAdminCompetitionStartPost200Response>) => apiResponse.data));
    }

    /**
     * Get performance reports and leaderboard for a competition
     * Get performance reports
     * @param competitionId ID of the competition
     */
    public apiAdminReportsPerformanceGetWithHttpInfo(competitionId: string, _options?: ConfigurationOptions): Observable<HttpInfo<ApiAdminReportsPerformanceGet200Response>> {
        const _config = mergeConfiguration(this.configuration, _options);

        const requestContextPromise = this.requestFactory.apiAdminReportsPerformanceGet(competitionId, _config);
        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (const middleware of _config.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => _config.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (const middleware of _config.middleware.reverse()) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.apiAdminReportsPerformanceGetWithHttpInfo(rsp)));
            }));
    }

    /**
     * Get performance reports and leaderboard for a competition
     * Get performance reports
     * @param competitionId ID of the competition
     */
    public apiAdminReportsPerformanceGet(competitionId: string, _options?: ConfigurationOptions): Observable<ApiAdminReportsPerformanceGet200Response> {
        return this.apiAdminReportsPerformanceGetWithHttpInfo(competitionId, _options).pipe(map((apiResponse: HttpInfo<ApiAdminReportsPerformanceGet200Response>) => apiResponse.data));
    }

    /**
     * Creates the first admin account. This endpoint is only available when no admin exists in the system.
     * Set up initial admin account
     * @param apiAdminSetupPostRequest
     */
    public apiAdminSetupPostWithHttpInfo(apiAdminSetupPostRequest: ApiAdminSetupPostRequest, _options?: ConfigurationOptions): Observable<HttpInfo<ApiAdminSetupPost201Response>> {
        const _config = mergeConfiguration(this.configuration, _options);

        const requestContextPromise = this.requestFactory.apiAdminSetupPost(apiAdminSetupPostRequest, _config);
        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (const middleware of _config.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => _config.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (const middleware of _config.middleware.reverse()) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.apiAdminSetupPostWithHttpInfo(rsp)));
            }));
    }

    /**
     * Creates the first admin account. This endpoint is only available when no admin exists in the system.
     * Set up initial admin account
     * @param apiAdminSetupPostRequest
     */
    public apiAdminSetupPost(apiAdminSetupPostRequest: ApiAdminSetupPostRequest, _options?: ConfigurationOptions): Observable<ApiAdminSetupPost201Response> {
        return this.apiAdminSetupPostWithHttpInfo(apiAdminSetupPostRequest, _options).pipe(map((apiResponse: HttpInfo<ApiAdminSetupPost201Response>) => apiResponse.data));
    }

    /**
     * Get a list of all non-admin teams
     * List all teams
     */
    public apiAdminTeamsGetWithHttpInfo(_options?: ConfigurationOptions): Observable<HttpInfo<ApiAdminTeamsGet200Response>> {
        const _config = mergeConfiguration(this.configuration, _options);

        const requestContextPromise = this.requestFactory.apiAdminTeamsGet(_config);
        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (const middleware of _config.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => _config.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (const middleware of _config.middleware.reverse()) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.apiAdminTeamsGetWithHttpInfo(rsp)));
            }));
    }

    /**
     * Get a list of all non-admin teams
     * List all teams
     */
    public apiAdminTeamsGet(_options?: ConfigurationOptions): Observable<ApiAdminTeamsGet200Response> {
        return this.apiAdminTeamsGetWithHttpInfo(_options).pipe(map((apiResponse: HttpInfo<ApiAdminTeamsGet200Response>) => apiResponse.data));
    }

    /**
     * Admin-only endpoint to register a new team. Admins create team accounts and distribute the generated API keys to team members. Teams cannot register themselves.
     * Register a new team
     * @param apiAdminTeamsRegisterPostRequest
     */
    public apiAdminTeamsRegisterPostWithHttpInfo(apiAdminTeamsRegisterPostRequest: ApiAdminTeamsRegisterPostRequest, _options?: ConfigurationOptions): Observable<HttpInfo<ApiAdminTeamsRegisterPost201Response>> {
        const _config = mergeConfiguration(this.configuration, _options);

        const requestContextPromise = this.requestFactory.apiAdminTeamsRegisterPost(apiAdminTeamsRegisterPostRequest, _config);
        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (const middleware of _config.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => _config.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (const middleware of _config.middleware.reverse()) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.apiAdminTeamsRegisterPostWithHttpInfo(rsp)));
            }));
    }

    /**
     * Admin-only endpoint to register a new team. Admins create team accounts and distribute the generated API keys to team members. Teams cannot register themselves.
     * Register a new team
     * @param apiAdminTeamsRegisterPostRequest
     */
    public apiAdminTeamsRegisterPost(apiAdminTeamsRegisterPostRequest: ApiAdminTeamsRegisterPostRequest, _options?: ConfigurationOptions): Observable<ApiAdminTeamsRegisterPost201Response> {
        return this.apiAdminTeamsRegisterPostWithHttpInfo(apiAdminTeamsRegisterPostRequest, _options).pipe(map((apiResponse: HttpInfo<ApiAdminTeamsRegisterPost201Response>) => apiResponse.data));
    }

    /**
     * Deactivate a team from the competition. The team will no longer be able to perform any actions.
     * Deactivate a team
     * @param teamId ID of the team to deactivate
     * @param apiAdminTeamsTeamIdDeactivatePostRequest
     */
    public apiAdminTeamsTeamIdDeactivatePostWithHttpInfo(teamId: string, apiAdminTeamsTeamIdDeactivatePostRequest: ApiAdminTeamsTeamIdDeactivatePostRequest, _options?: ConfigurationOptions): Observable<HttpInfo<ApiAdminTeamsTeamIdDeactivatePost200Response>> {
        const _config = mergeConfiguration(this.configuration, _options);

        const requestContextPromise = this.requestFactory.apiAdminTeamsTeamIdDeactivatePost(teamId, apiAdminTeamsTeamIdDeactivatePostRequest, _config);
        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (const middleware of _config.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => _config.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (const middleware of _config.middleware.reverse()) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.apiAdminTeamsTeamIdDeactivatePostWithHttpInfo(rsp)));
            }));
    }

    /**
     * Deactivate a team from the competition. The team will no longer be able to perform any actions.
     * Deactivate a team
     * @param teamId ID of the team to deactivate
     * @param apiAdminTeamsTeamIdDeactivatePostRequest
     */
    public apiAdminTeamsTeamIdDeactivatePost(teamId: string, apiAdminTeamsTeamIdDeactivatePostRequest: ApiAdminTeamsTeamIdDeactivatePostRequest, _options?: ConfigurationOptions): Observable<ApiAdminTeamsTeamIdDeactivatePost200Response> {
        return this.apiAdminTeamsTeamIdDeactivatePostWithHttpInfo(teamId, apiAdminTeamsTeamIdDeactivatePostRequest, _options).pipe(map((apiResponse: HttpInfo<ApiAdminTeamsTeamIdDeactivatePost200Response>) => apiResponse.data));
    }

    /**
     * Permanently delete a team and all associated data
     * Delete a team
     * @param teamId ID of the team to delete
     */
    public apiAdminTeamsTeamIdDeleteWithHttpInfo(teamId: string, _options?: ConfigurationOptions): Observable<HttpInfo<ApiAdminTeamsTeamIdDelete200Response>> {
        const _config = mergeConfiguration(this.configuration, _options);

        const requestContextPromise = this.requestFactory.apiAdminTeamsTeamIdDelete(teamId, _config);
        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (const middleware of _config.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => _config.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (const middleware of _config.middleware.reverse()) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.apiAdminTeamsTeamIdDeleteWithHttpInfo(rsp)));
            }));
    }

    /**
     * Permanently delete a team and all associated data
     * Delete a team
     * @param teamId ID of the team to delete
     */
    public apiAdminTeamsTeamIdDelete(teamId: string, _options?: ConfigurationOptions): Observable<ApiAdminTeamsTeamIdDelete200Response> {
        return this.apiAdminTeamsTeamIdDeleteWithHttpInfo(teamId, _options).pipe(map((apiResponse: HttpInfo<ApiAdminTeamsTeamIdDelete200Response>) => apiResponse.data));
    }

    /**
     * Retrieves the original API key for a team. Use this when teams lose or misplace their API key.
     * Get a team\'s API key
     * @param teamId ID of the team
     */
    public apiAdminTeamsTeamIdKeyGetWithHttpInfo(teamId: string, _options?: ConfigurationOptions): Observable<HttpInfo<ApiAdminTeamsTeamIdKeyGet200Response>> {
        const _config = mergeConfiguration(this.configuration, _options);

        const requestContextPromise = this.requestFactory.apiAdminTeamsTeamIdKeyGet(teamId, _config);
        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (const middleware of _config.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => _config.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (const middleware of _config.middleware.reverse()) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.apiAdminTeamsTeamIdKeyGetWithHttpInfo(rsp)));
            }));
    }

    /**
     * Retrieves the original API key for a team. Use this when teams lose or misplace their API key.
     * Get a team\'s API key
     * @param teamId ID of the team
     */
    public apiAdminTeamsTeamIdKeyGet(teamId: string, _options?: ConfigurationOptions): Observable<ApiAdminTeamsTeamIdKeyGet200Response> {
        return this.apiAdminTeamsTeamIdKeyGetWithHttpInfo(teamId, _options).pipe(map((apiResponse: HttpInfo<ApiAdminTeamsTeamIdKeyGet200Response>) => apiResponse.data));
    }

    /**
     * Reactivate a previously deactivated team, allowing them to participate in the competition again.
     * Reactivate a team
     * @param teamId ID of the team to reactivate
     */
    public apiAdminTeamsTeamIdReactivatePostWithHttpInfo(teamId: string, _options?: ConfigurationOptions): Observable<HttpInfo<ApiAdminTeamsTeamIdReactivatePost200Response>> {
        const _config = mergeConfiguration(this.configuration, _options);

        const requestContextPromise = this.requestFactory.apiAdminTeamsTeamIdReactivatePost(teamId, _config);
        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (const middleware of _config.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => _config.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (const middleware of _config.middleware.reverse()) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.apiAdminTeamsTeamIdReactivatePostWithHttpInfo(rsp)));
            }));
    }

    /**
     * Reactivate a previously deactivated team, allowing them to participate in the competition again.
     * Reactivate a team
     * @param teamId ID of the team to reactivate
     */
    public apiAdminTeamsTeamIdReactivatePost(teamId: string, _options?: ConfigurationOptions): Observable<ApiAdminTeamsTeamIdReactivatePost200Response> {
        return this.apiAdminTeamsTeamIdReactivatePostWithHttpInfo(teamId, _options).pipe(map((apiResponse: HttpInfo<ApiAdminTeamsTeamIdReactivatePost200Response>) => apiResponse.data));
    }

}

import { CompetitionApiRequestFactory, CompetitionApiResponseProcessor} from "../apis/CompetitionApi";
export class ObservableCompetitionApi {
    private requestFactory: CompetitionApiRequestFactory;
    private responseProcessor: CompetitionApiResponseProcessor;
    private configuration: Configuration;

    public constructor(
        configuration: Configuration,
        requestFactory?: CompetitionApiRequestFactory,
        responseProcessor?: CompetitionApiResponseProcessor
    ) {
        this.configuration = configuration;
        this.requestFactory = requestFactory || new CompetitionApiRequestFactory(configuration);
        this.responseProcessor = responseProcessor || new CompetitionApiResponseProcessor();
    }

    /**
     * Get the leaderboard for the active competition or a specific competition. Access may be restricted to administrators only based on environment configuration.
     * Get competition leaderboard
     * @param [competitionId] Optional competition ID (if not provided, the active competition is used)
     */
    public apiCompetitionLeaderboardGetWithHttpInfo(competitionId?: string, _options?: ConfigurationOptions): Observable<HttpInfo<ApiCompetitionLeaderboardGet200Response>> {
        const _config = mergeConfiguration(this.configuration, _options);

        const requestContextPromise = this.requestFactory.apiCompetitionLeaderboardGet(competitionId, _config);
        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (const middleware of _config.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => _config.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (const middleware of _config.middleware.reverse()) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.apiCompetitionLeaderboardGetWithHttpInfo(rsp)));
            }));
    }

    /**
     * Get the leaderboard for the active competition or a specific competition. Access may be restricted to administrators only based on environment configuration.
     * Get competition leaderboard
     * @param [competitionId] Optional competition ID (if not provided, the active competition is used)
     */
    public apiCompetitionLeaderboardGet(competitionId?: string, _options?: ConfigurationOptions): Observable<ApiCompetitionLeaderboardGet200Response> {
        return this.apiCompetitionLeaderboardGetWithHttpInfo(competitionId, _options).pipe(map((apiResponse: HttpInfo<ApiCompetitionLeaderboardGet200Response>) => apiResponse.data));
    }

    /**
     * Get the rules, rate limits, and other configuration details for the competition
     * Get competition rules
     */
    public apiCompetitionRulesGetWithHttpInfo(_options?: ConfigurationOptions): Observable<HttpInfo<ApiCompetitionRulesGet200Response>> {
        const _config = mergeConfiguration(this.configuration, _options);

        const requestContextPromise = this.requestFactory.apiCompetitionRulesGet(_config);
        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (const middleware of _config.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => _config.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (const middleware of _config.middleware.reverse()) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.apiCompetitionRulesGetWithHttpInfo(rsp)));
            }));
    }

    /**
     * Get the rules, rate limits, and other configuration details for the competition
     * Get competition rules
     */
    public apiCompetitionRulesGet(_options?: ConfigurationOptions): Observable<ApiCompetitionRulesGet200Response> {
        return this.apiCompetitionRulesGetWithHttpInfo(_options).pipe(map((apiResponse: HttpInfo<ApiCompetitionRulesGet200Response>) => apiResponse.data));
    }

    /**
     * Get the status of the active competition
     * Get competition status
     */
    public apiCompetitionStatusGetWithHttpInfo(_options?: ConfigurationOptions): Observable<HttpInfo<ApiCompetitionStatusGet200Response>> {
        const _config = mergeConfiguration(this.configuration, _options);

        const requestContextPromise = this.requestFactory.apiCompetitionStatusGet(_config);
        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (const middleware of _config.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => _config.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (const middleware of _config.middleware.reverse()) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.apiCompetitionStatusGetWithHttpInfo(rsp)));
            }));
    }

    /**
     * Get the status of the active competition
     * Get competition status
     */
    public apiCompetitionStatusGet(_options?: ConfigurationOptions): Observable<ApiCompetitionStatusGet200Response> {
        return this.apiCompetitionStatusGetWithHttpInfo(_options).pipe(map((apiResponse: HttpInfo<ApiCompetitionStatusGet200Response>) => apiResponse.data));
    }

    /**
     * Get all competitions that have not started yet (status=PENDING)
     * Get upcoming competitions
     */
    public apiCompetitionUpcomingGetWithHttpInfo(_options?: ConfigurationOptions): Observable<HttpInfo<ApiCompetitionUpcomingGet200Response>> {
        const _config = mergeConfiguration(this.configuration, _options);

        const requestContextPromise = this.requestFactory.apiCompetitionUpcomingGet(_config);
        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (const middleware of _config.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => _config.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (const middleware of _config.middleware.reverse()) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.apiCompetitionUpcomingGetWithHttpInfo(rsp)));
            }));
    }

    /**
     * Get all competitions that have not started yet (status=PENDING)
     * Get upcoming competitions
     */
    public apiCompetitionUpcomingGet(_options?: ConfigurationOptions): Observable<ApiCompetitionUpcomingGet200Response> {
        return this.apiCompetitionUpcomingGetWithHttpInfo(_options).pipe(map((apiResponse: HttpInfo<ApiCompetitionUpcomingGet200Response>) => apiResponse.data));
    }

}

import { HealthApiRequestFactory, HealthApiResponseProcessor} from "../apis/HealthApi";
export class ObservableHealthApi {
    private requestFactory: HealthApiRequestFactory;
    private responseProcessor: HealthApiResponseProcessor;
    private configuration: Configuration;

    public constructor(
        configuration: Configuration,
        requestFactory?: HealthApiRequestFactory,
        responseProcessor?: HealthApiResponseProcessor
    ) {
        this.configuration = configuration;
        this.requestFactory = requestFactory || new HealthApiRequestFactory(configuration);
        this.responseProcessor = responseProcessor || new HealthApiResponseProcessor();
    }

    /**
     * Check if the API and all its services are running properly
     * Detailed health check
     */
    public apiHealthDetailedGetWithHttpInfo(_options?: ConfigurationOptions): Observable<HttpInfo<ApiHealthDetailedGet200Response>> {
        const _config = mergeConfiguration(this.configuration, _options);

        const requestContextPromise = this.requestFactory.apiHealthDetailedGet(_config);
        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (const middleware of _config.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => _config.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (const middleware of _config.middleware.reverse()) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.apiHealthDetailedGetWithHttpInfo(rsp)));
            }));
    }

    /**
     * Check if the API and all its services are running properly
     * Detailed health check
     */
    public apiHealthDetailedGet(_options?: ConfigurationOptions): Observable<ApiHealthDetailedGet200Response> {
        return this.apiHealthDetailedGetWithHttpInfo(_options).pipe(map((apiResponse: HttpInfo<ApiHealthDetailedGet200Response>) => apiResponse.data));
    }

    /**
     * Check if the API is running
     * Basic health check
     */
    public apiHealthGetWithHttpInfo(_options?: ConfigurationOptions): Observable<HttpInfo<ApiHealthGet200Response>> {
        const _config = mergeConfiguration(this.configuration, _options);

        const requestContextPromise = this.requestFactory.apiHealthGet(_config);
        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (const middleware of _config.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => _config.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (const middleware of _config.middleware.reverse()) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.apiHealthGetWithHttpInfo(rsp)));
            }));
    }

    /**
     * Check if the API is running
     * Basic health check
     */
    public apiHealthGet(_options?: ConfigurationOptions): Observable<ApiHealthGet200Response> {
        return this.apiHealthGetWithHttpInfo(_options).pipe(map((apiResponse: HttpInfo<ApiHealthGet200Response>) => apiResponse.data));
    }

}

import { PriceApiRequestFactory, PriceApiResponseProcessor} from "../apis/PriceApi";
export class ObservablePriceApi {
    private requestFactory: PriceApiRequestFactory;
    private responseProcessor: PriceApiResponseProcessor;
    private configuration: Configuration;

    public constructor(
        configuration: Configuration,
        requestFactory?: PriceApiRequestFactory,
        responseProcessor?: PriceApiResponseProcessor
    ) {
        this.configuration = configuration;
        this.requestFactory = requestFactory || new PriceApiRequestFactory(configuration);
        this.responseProcessor = responseProcessor || new PriceApiResponseProcessor();
    }

    /**
     * Get the current price of a specified token
     * Get price for a token
     * @param token Token address
     * @param [chain] Blockchain type of the token
     * @param [specificChain] Specific chain for EVM tokens
     */
    public apiPriceGetWithHttpInfo(token: string, chain?: 'evm' | 'svm', specificChain?: 'eth' | 'polygon' | 'bsc' | 'arbitrum' | 'optimism' | 'avalanche' | 'base' | 'linea' | 'zksync' | 'scroll' | 'mantle' | 'svm', _options?: ConfigurationOptions): Observable<HttpInfo<ApiPriceGet200Response>> {
        const _config = mergeConfiguration(this.configuration, _options);

        const requestContextPromise = this.requestFactory.apiPriceGet(token, chain, specificChain, _config);
        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (const middleware of _config.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => _config.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (const middleware of _config.middleware.reverse()) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.apiPriceGetWithHttpInfo(rsp)));
            }));
    }

    /**
     * Get the current price of a specified token
     * Get price for a token
     * @param token Token address
     * @param [chain] Blockchain type of the token
     * @param [specificChain] Specific chain for EVM tokens
     */
    public apiPriceGet(token: string, chain?: 'evm' | 'svm', specificChain?: 'eth' | 'polygon' | 'bsc' | 'arbitrum' | 'optimism' | 'avalanche' | 'base' | 'linea' | 'zksync' | 'scroll' | 'mantle' | 'svm', _options?: ConfigurationOptions): Observable<ApiPriceGet200Response> {
        return this.apiPriceGetWithHttpInfo(token, chain, specificChain, _options).pipe(map((apiResponse: HttpInfo<ApiPriceGet200Response>) => apiResponse.data));
    }

    /**
     * Get detailed token information including price and specific chain
     * Get detailed token information
     * @param token Token address
     * @param [chain] Blockchain type of the token
     * @param [specificChain] Specific chain for EVM tokens
     */
    public apiPriceTokenInfoGetWithHttpInfo(token: string, chain?: 'evm' | 'svm', specificChain?: 'eth' | 'polygon' | 'bsc' | 'arbitrum' | 'optimism' | 'avalanche' | 'base' | 'linea' | 'zksync' | 'scroll' | 'mantle' | 'svm', _options?: ConfigurationOptions): Observable<HttpInfo<ApiPriceTokenInfoGet200Response>> {
        const _config = mergeConfiguration(this.configuration, _options);

        const requestContextPromise = this.requestFactory.apiPriceTokenInfoGet(token, chain, specificChain, _config);
        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (const middleware of _config.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => _config.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (const middleware of _config.middleware.reverse()) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.apiPriceTokenInfoGetWithHttpInfo(rsp)));
            }));
    }

    /**
     * Get detailed token information including price and specific chain
     * Get detailed token information
     * @param token Token address
     * @param [chain] Blockchain type of the token
     * @param [specificChain] Specific chain for EVM tokens
     */
    public apiPriceTokenInfoGet(token: string, chain?: 'evm' | 'svm', specificChain?: 'eth' | 'polygon' | 'bsc' | 'arbitrum' | 'optimism' | 'avalanche' | 'base' | 'linea' | 'zksync' | 'scroll' | 'mantle' | 'svm', _options?: ConfigurationOptions): Observable<ApiPriceTokenInfoGet200Response> {
        return this.apiPriceTokenInfoGetWithHttpInfo(token, chain, specificChain, _options).pipe(map((apiResponse: HttpInfo<ApiPriceTokenInfoGet200Response>) => apiResponse.data));
    }

}

import { PublicApiRequestFactory, PublicApiResponseProcessor} from "../apis/PublicApi";
export class ObservablePublicApi {
    private requestFactory: PublicApiRequestFactory;
    private responseProcessor: PublicApiResponseProcessor;
    private configuration: Configuration;

    public constructor(
        configuration: Configuration,
        requestFactory?: PublicApiRequestFactory,
        responseProcessor?: PublicApiResponseProcessor
    ) {
        this.configuration = configuration;
        this.requestFactory = requestFactory || new PublicApiRequestFactory(configuration);
        this.responseProcessor = responseProcessor || new PublicApiResponseProcessor();
    }

    /**
     * Public endpoint to register a new team. Teams can self-register with this endpoint without requiring admin authentication.
     * Register a new team
     * @param apiPublicTeamsRegisterPostRequest
     */
    public apiPublicTeamsRegisterPostWithHttpInfo(apiPublicTeamsRegisterPostRequest: ApiPublicTeamsRegisterPostRequest, _options?: ConfigurationOptions): Observable<HttpInfo<ApiPublicTeamsRegisterPost201Response>> {
        const _config = mergeConfiguration(this.configuration, _options);

        const requestContextPromise = this.requestFactory.apiPublicTeamsRegisterPost(apiPublicTeamsRegisterPostRequest, _config);
        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (const middleware of _config.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => _config.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (const middleware of _config.middleware.reverse()) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.apiPublicTeamsRegisterPostWithHttpInfo(rsp)));
            }));
    }

    /**
     * Public endpoint to register a new team. Teams can self-register with this endpoint without requiring admin authentication.
     * Register a new team
     * @param apiPublicTeamsRegisterPostRequest
     */
    public apiPublicTeamsRegisterPost(apiPublicTeamsRegisterPostRequest: ApiPublicTeamsRegisterPostRequest, _options?: ConfigurationOptions): Observable<ApiPublicTeamsRegisterPost201Response> {
        return this.apiPublicTeamsRegisterPostWithHttpInfo(apiPublicTeamsRegisterPostRequest, _options).pipe(map((apiResponse: HttpInfo<ApiPublicTeamsRegisterPost201Response>) => apiResponse.data));
    }

}

import { TradeApiRequestFactory, TradeApiResponseProcessor} from "../apis/TradeApi";
export class ObservableTradeApi {
    private requestFactory: TradeApiRequestFactory;
    private responseProcessor: TradeApiResponseProcessor;
    private configuration: Configuration;

    public constructor(
        configuration: Configuration,
        requestFactory?: TradeApiRequestFactory,
        responseProcessor?: TradeApiResponseProcessor
    ) {
        this.configuration = configuration;
        this.requestFactory = requestFactory || new TradeApiRequestFactory(configuration);
        this.responseProcessor = responseProcessor || new TradeApiResponseProcessor();
    }

    /**
     * Execute a trade between two tokens
     * Execute a trade
     * @param apiTradeExecutePostRequest
     */
    public apiTradeExecutePostWithHttpInfo(apiTradeExecutePostRequest: ApiTradeExecutePostRequest, _options?: ConfigurationOptions): Observable<HttpInfo<ApiTradeExecutePost200Response>> {
        const _config = mergeConfiguration(this.configuration, _options);

        const requestContextPromise = this.requestFactory.apiTradeExecutePost(apiTradeExecutePostRequest, _config);
        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (const middleware of _config.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => _config.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (const middleware of _config.middleware.reverse()) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.apiTradeExecutePostWithHttpInfo(rsp)));
            }));
    }

    /**
     * Execute a trade between two tokens
     * Execute a trade
     * @param apiTradeExecutePostRequest
     */
    public apiTradeExecutePost(apiTradeExecutePostRequest: ApiTradeExecutePostRequest, _options?: ConfigurationOptions): Observable<ApiTradeExecutePost200Response> {
        return this.apiTradeExecutePostWithHttpInfo(apiTradeExecutePostRequest, _options).pipe(map((apiResponse: HttpInfo<ApiTradeExecutePost200Response>) => apiResponse.data));
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
    public apiTradeQuoteGetWithHttpInfo(fromToken: string, toToken: string, amount: string, fromChain?: string, fromSpecificChain?: string, toChain?: string, toSpecificChain?: string, _options?: ConfigurationOptions): Observable<HttpInfo<ApiTradeQuoteGet200Response>> {
        const _config = mergeConfiguration(this.configuration, _options);

        const requestContextPromise = this.requestFactory.apiTradeQuoteGet(fromToken, toToken, amount, fromChain, fromSpecificChain, toChain, toSpecificChain, _config);
        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (const middleware of _config.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => _config.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (const middleware of _config.middleware.reverse()) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.apiTradeQuoteGetWithHttpInfo(rsp)));
            }));
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
    public apiTradeQuoteGet(fromToken: string, toToken: string, amount: string, fromChain?: string, fromSpecificChain?: string, toChain?: string, toSpecificChain?: string, _options?: ConfigurationOptions): Observable<ApiTradeQuoteGet200Response> {
        return this.apiTradeQuoteGetWithHttpInfo(fromToken, toToken, amount, fromChain, fromSpecificChain, toChain, toSpecificChain, _options).pipe(map((apiResponse: HttpInfo<ApiTradeQuoteGet200Response>) => apiResponse.data));
    }

}
