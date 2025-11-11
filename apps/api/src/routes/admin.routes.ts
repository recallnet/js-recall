import { RequestHandler, Router } from "express";

import { AdminController } from "@/controllers/admin.controller.js";

export function configureAdminRoutes(
  controller: AdminController,
  ...middlewares: RequestHandler[]
) {
  const router = Router();

  if (middlewares.length) {
    router.use(...middlewares);
  }

  /**
   * @openapi
   * /api/admin/arenas:
   *   post:
   *     tags:
   *       - Admin
   *     summary: Create a new arena
   *     description: Create a new arena for grouping and organizing competitions
   *     security:
   *       - BearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - id
   *               - name
   *               - createdBy
   *               - category
   *               - skill
   *             properties:
   *               id:
   *                 type: string
   *                 description: Arena ID (lowercase kebab-case)
   *                 pattern: ^[a-z0-9-]+$
   *                 example: aerodrome-base-weekly
   *               name:
   *                 type: string
   *                 description: Arena name
   *                 example: Aerodrome Base Weekly Trading
   *               createdBy:
   *                 type: string
   *                 description: Creator identifier
   *                 example: admin-123
   *               category:
   *                 type: string
   *                 description: Arena category
   *                 example: crypto_trading
   *               skill:
   *                 type: string
   *                 description: Arena skill type
   *                 example: spot_paper_trading
   *               venues:
   *                 type: array
   *                 description: Venue identifiers
   *                 items:
   *                   type: string
   *                 example: ["aerodrome", "uniswap"]
   *               chains:
   *                 type: array
   *                 description: Chain identifiers
   *                 items:
   *                   type: string
   *                 example: ["base", "arbitrum"]
   *     responses:
   *       201:
   *         description: Arena created successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   description: Operation success status
   *                 arena:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                       description: Arena ID
   *                     name:
   *                       type: string
   *                       description: Arena name
   *                     category:
   *                       type: string
   *                       description: Arena category
   *                     skill:
   *                       type: string
   *                       description: Arena skill
   *                     venues:
   *                       type: array
   *                       nullable: true
   *                       items:
   *                         type: string
   *                     chains:
   *                       type: array
   *                       nullable: true
   *                       items:
   *                         type: string
   *       400:
   *         description: Bad Request - Invalid arena ID format or missing required fields
   *       401:
   *         description: Unauthorized - Admin authentication required
   *       409:
   *         description: Conflict - Arena with this ID already exists
   *       500:
   *         description: Server error
   */
  router.post("/arenas", controller.createArena);

  /**
   * @openapi
   * /api/admin/arenas:
   *   get:
   *     tags:
   *       - Admin
   *     summary: List all arenas
   *     description: Get paginated list of arenas with optional name filtering
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 100
   *           default: 20
   *         description: Number of arenas to return
   *       - in: query
   *         name: offset
   *         schema:
   *           type: integer
   *           minimum: 0
   *           default: 0
   *         description: Number of arenas to skip
   *       - in: query
   *         name: sort
   *         schema:
   *           type: string
   *           default: ""
   *         description: Sort field and direction (e.g., "name:asc")
   *       - in: query
   *         name: nameFilter
   *         schema:
   *           type: string
   *         description: Filter arenas by name (case-insensitive partial match)
   *     responses:
   *       200:
   *         description: Arenas retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 arenas:
   *                   type: array
   *                   items:
   *                     type: object
   *                 pagination:
   *                   type: object
   *                   properties:
   *                     total:
   *                       type: integer
   *                     limit:
   *                       type: integer
   *                     offset:
   *                       type: integer
   *                     hasMore:
   *                       type: boolean
   *       401:
   *         description: Unauthorized - Admin authentication required
   *       500:
   *         description: Server error
   */
  router.get("/arenas", controller.listArenas);

  /**
   * @openapi
   * /api/admin/arenas/{id}:
   *   get:
   *     tags:
   *       - Admin
   *     summary: Get arena by ID
   *     description: Retrieve detailed information about a specific arena
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Arena ID
   *     responses:
   *       200:
   *         description: Arena retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 arena:
   *                   type: object
   *       401:
   *         description: Unauthorized - Admin authentication required
   *       404:
   *         description: Arena not found
   *       500:
   *         description: Server error
   */
  router.get("/arenas/:id", controller.getArena);

  /**
   * @openapi
   * /api/admin/arenas/{id}:
   *   put:
   *     tags:
   *       - Admin
   *     summary: Update an arena
   *     description: Update arena metadata and classification
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Arena ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *                 description: Arena name
   *               category:
   *                 type: string
   *                 description: Arena category
   *               skill:
   *                 type: string
   *                 description: Arena skill
   *               venues:
   *                 type: array
   *                 items:
   *                   type: string
   *               chains:
   *                 type: array
   *                 items:
   *                   type: string
   *     responses:
   *       200:
   *         description: Arena updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 arena:
   *                   type: object
   *       401:
   *         description: Unauthorized - Admin authentication required
   *       404:
   *         description: Arena not found
   *       500:
   *         description: Server error
   */
  router.put("/arenas/:id", controller.updateArena);

  /**
   * @openapi
   * /api/admin/arenas/{id}:
   *   delete:
   *     tags:
   *       - Admin
   *     summary: Delete an arena
   *     description: Delete an arena (fails if arena has associated competitions)
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Arena ID
   *     responses:
   *       200:
   *         description: Arena deleted successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 message:
   *                   type: string
   *       401:
   *         description: Unauthorized - Admin authentication required
   *       404:
   *         description: Arena not found
   *       409:
   *         description: Conflict - Arena has associated competitions
   *       500:
   *         description: Server error
   */
  router.delete("/arenas/:id", controller.deleteArena);

  /**
   * @openapi
   * /api/admin/partners:
   *   post:
   *     tags:
   *       - Admin
   *     summary: Create a new partner
   *     description: Create a new partner that can be associated with competitions
   *     security:
   *       - BearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - name
   *             properties:
   *               name:
   *                 type: string
   *                 description: Partner name
   *                 example: Aerodrome Finance
   *               url:
   *                 type: string
   *                 format: uri
   *                 description: Partner website URL
   *                 example: https://aerodrome.finance
   *               logoUrl:
   *                 type: string
   *                 format: uri
   *                 description: Partner logo URL
   *                 example: https://aerodrome.finance/logo.png
   *               details:
   *                 type: string
   *                 description: Partner details or description
   *                 example: Leading DEX on Base
   *     responses:
   *       201:
   *         description: Partner created successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 partner:
   *                   type: object
   *       400:
   *         description: Bad Request - Invalid data
   *       401:
   *         description: Unauthorized - Admin authentication required
   *       409:
   *         description: Conflict - Partner with this name already exists
   *       500:
   *         description: Server error
   */
  router.post("/partners", controller.createPartner);

  /**
   * @openapi
   * /api/admin/partners:
   *   get:
   *     tags:
   *       - Admin
   *     summary: List all partners
   *     description: Get paginated list of partners with optional name filtering
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 100
   *           default: 20
   *         description: Number of partners to return
   *       - in: query
   *         name: offset
   *         schema:
   *           type: integer
   *           minimum: 0
   *           default: 0
   *         description: Number of partners to skip
   *       - in: query
   *         name: sort
   *         schema:
   *           type: string
   *           default: ""
   *         description: Sort field and direction
   *       - in: query
   *         name: nameFilter
   *         schema:
   *           type: string
   *         description: Filter partners by name (case-insensitive partial match)
   *     responses:
   *       200:
   *         description: Partners retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 partners:
   *                   type: array
   *                   items:
   *                     type: object
   *                 pagination:
   *                   type: object
   *       401:
   *         description: Unauthorized - Admin authentication required
   *       500:
   *         description: Server error
   */
  router.get("/partners", controller.listPartners);

  /**
   * @openapi
   * /api/admin/partners/{id}:
   *   get:
   *     tags:
   *       - Admin
   *     summary: Get partner by ID
   *     description: Retrieve detailed information about a specific partner
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Partner ID
   *     responses:
   *       200:
   *         description: Partner retrieved successfully
   *       401:
   *         description: Unauthorized - Admin authentication required
   *       404:
   *         description: Partner not found
   *       500:
   *         description: Server error
   */
  router.get("/partners/:id", controller.getPartner);

  /**
   * @openapi
   * /api/admin/partners/{id}:
   *   put:
   *     tags:
   *       - Admin
   *     summary: Update a partner
   *     description: Update partner information
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Partner ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *               url:
   *                 type: string
   *                 format: uri
   *               logoUrl:
   *                 type: string
   *                 format: uri
   *               details:
   *                 type: string
   *     responses:
   *       200:
   *         description: Partner updated successfully
   *       401:
   *         description: Unauthorized - Admin authentication required
   *       404:
   *         description: Partner not found
   *       500:
   *         description: Server error
   */
  router.put("/partners/:id", controller.updatePartner);

  /**
   * @openapi
   * /api/admin/partners/{id}:
   *   delete:
   *     tags:
   *       - Admin
   *     summary: Delete a partner
   *     description: Delete a partner (cascades to remove all competition associations)
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Partner ID
   *     responses:
   *       200:
   *         description: Partner deleted successfully
   *       401:
   *         description: Unauthorized - Admin authentication required
   *       404:
   *         description: Partner not found
   *       500:
   *         description: Server error
   */
  router.delete("/partners/:id", controller.deletePartner);

  /**
   * @openapi
   * /api/admin/competitions/{competitionId}/partners:
   *   get:
   *     tags:
   *       - Admin
   *     summary: Get partners for a competition
   *     description: Retrieve all partners associated with a competition, ordered by position
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: competitionId
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Competition ID
   *     responses:
   *       200:
   *         description: Partners retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 partners:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: string
   *                         format: uuid
   *                       name:
   *                         type: string
   *                       url:
   *                         type: string
   *                         nullable: true
   *                       logoUrl:
   *                         type: string
   *                         nullable: true
   *                       details:
   *                         type: string
   *                         nullable: true
   *                       position:
   *                         type: integer
   *                       competitionPartnerId:
   *                         type: string
   *                         format: uuid
   *                       createdAt:
   *                         type: string
   *                         format: date-time
   *                       updatedAt:
   *                         type: string
   *                         format: date-time
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Server error
   */
  router.get(
    "/competitions/:competitionId/partners",
    controller.getCompetitionPartners,
  );

  /**
   * @openapi
   * /api/admin/competitions/{competitionId}/partners:
   *   post:
   *     tags:
   *       - Admin
   *     summary: Add partner to competition
   *     description: Associate a partner with a competition at a specific display position
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: competitionId
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Competition ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - partnerId
   *               - position
   *             properties:
   *               partnerId:
   *                 type: string
   *                 format: uuid
   *                 description: Partner ID
   *               position:
   *                 type: integer
   *                 minimum: 1
   *                 description: Display position (1-indexed)
   *     responses:
   *       201:
   *         description: Partner added successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 association:
   *                   type: object
   *       400:
   *         description: Bad Request
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Partner or Competition not found
   *       409:
   *         description: Conflict - Position already taken or partner already associated
   *       500:
   *         description: Server error
   */
  router.post(
    "/competitions/:competitionId/partners",
    controller.addPartnerToCompetition,
  );

  /**
   * @openapi
   * /api/admin/competitions/{competitionId}/partners/replace:
   *   put:
   *     tags:
   *       - Admin
   *     summary: Replace all partners for a competition
   *     description: Atomically replace all partner associations for a competition
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: competitionId
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Competition ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - partners
   *             properties:
   *               partners:
   *                 type: array
   *                 items:
   *                   type: object
   *                   required:
   *                     - partnerId
   *                     - position
   *                   properties:
   *                     partnerId:
   *                       type: string
   *                       format: uuid
   *                     position:
   *                       type: integer
   *                       minimum: 1
   *     responses:
   *       200:
   *         description: Partners replaced successfully
   *       400:
   *         description: Bad Request
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: One or more partners not found
   *       500:
   *         description: Server error
   */
  router.put(
    "/competitions/:competitionId/partners/replace",
    controller.replaceCompetitionPartners,
  );

  /**
   * @openapi
   * /api/admin/competitions/{competitionId}/partners/{partnerId}:
   *   put:
   *     tags:
   *       - Admin
   *     summary: Update partner position
   *     description: Update the display position of a partner in a competition
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: competitionId
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Competition ID
   *       - in: path
   *         name: partnerId
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Partner ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - position
   *             properties:
   *               position:
   *                 type: integer
   *                 minimum: 1
   *                 description: Display position
   *     responses:
   *       200:
   *         description: Position updated successfully
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Partner association not found
   *       409:
   *         description: Position already taken by another partner
   *       500:
   *         description: Server error
   */
  router.put(
    "/competitions/:competitionId/partners/:partnerId",
    controller.updatePartnerPosition,
  );

  /**
   * @openapi
   * /api/admin/competitions/{competitionId}/partners/{partnerId}:
   *   delete:
   *     tags:
   *       - Admin
   *     summary: Remove partner from competition
   *     description: Remove the association between a partner and a competition
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: competitionId
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Competition ID
   *       - in: path
   *         name: partnerId
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Partner ID
   *     responses:
   *       200:
   *         description: Partner removed successfully
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Partner association not found
   *       500:
   *         description: Server error
   */
  router.delete(
    "/competitions/:competitionId/partners/:partnerId",
    controller.removePartnerFromCompetition,
  );

  /**
   * @openapi
   * /api/admin/competition/create:
   *   post:
   *     tags:
   *       - Admin
   *     summary: Create a competition
   *     description: Create a new competition without starting it. It will be in PENDING status and can be started later.
   *     security:
   *       - BearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - name
   *               - arenaId
   *             properties:
   *               name:
   *                 type: string
   *                 description: Competition name
   *                 example: Spring 2023 Trading Competition
   *               description:
   *                 type: string
   *                 description: Competition description
   *                 example: A trading competition for the spring semester
   *               tradingType:
   *                 type: string
   *                 description: The type of cross-chain trading to allow in this competition
   *                 enum: [disallowAll, disallowXParent, allow]
   *                 default: disallowAll
   *                 example: disallowAll
   *               sandboxMode:
   *                 type: boolean
   *                 description: Enable sandbox mode to automatically join newly registered agents to this competition
   *                 default: false
   *                 example: false
   *               type:
   *                 type: string
   *                 description: The type of competition
   *                 enum: [trading, perpetual_futures]
   *                 default: trading
   *                 example: trading
   *               externalUrl:
   *                 type: string
   *                 description: External URL for competition details
   *                 example: https://example.com/competition-details
   *               imageUrl:
   *                 type: string
   *                 description: URL to competition image
   *                 example: https://example.com/competition-image.jpg
   *               startDate:
   *                 type: string
   *                 format: date-time
   *                 description: Start date for the competition (ISO 8601 format)
   *                 example: "2024-01-01T00:00:00Z"
   *               endDate:
   *                 type: string
   *                 format: date-time
   *                 description: End date for the competition (ISO 8601 format)
   *                 example: "2024-02-15T23:59:59Z"
   *               boostStartDate:
   *                 type: string
   *                 format: date-time
   *                 description: Start date for boosting (ISO 8601 format)
   *                 example: "2024-01-15T00:00:00Z"
   *               boostEndDate:
   *                 type: string
   *                 format: date-time
   *                 description: End date for boosting (ISO 8601 format)
   *                 example: "2024-01-30T23:59:59Z"
   *               joinStartDate:
   *                 type: string
   *                 format: date-time
   *                 description: Start date for joining the competition (ISO 8601 format). Must be before or equal to joinEndDate if both are provided.
   *                 example: "2024-01-01T00:00:00Z"
   *               joinEndDate:
   *                 type: string
   *                 format: date-time
   *                 description: End date for joining the competition (ISO 8601 format). Must be after or equal to joinStartDate if both are provided.
   *                 example: "2024-01-14T23:59:59Z"
   *               maxParticipants:
   *                 type: integer
   *                 minimum: 1
   *                 description: Maximum number of participants allowed to register for this competition. If not specified, there is no limit.
   *                 example: 50
   *               minimumStake:
   *                 type: number
   *                 minimum: 0
   *                 description: Minimum stake amount required to join the competition (in USD)
   *                 example: 100
   *               tradingConstraints:
   *                 type: object
   *                 description: Trading constraints for the competition (used when creating a new competition)
   *                 properties:
   *                   minimumPairAgeHours:
   *                     type: number
   *                     minimum: 0
   *                     description: Minimum age of trading pairs in hours
   *                     example: 168
   *                   minimum24hVolumeUsd:
   *                     type: number
   *                     minimum: 0
   *                     description: Minimum 24-hour volume in USD
   *                     example: 10000
   *                   minimumLiquidityUsd:
   *                     type: number
   *                     minimum: 0
   *                     description: Minimum liquidity in USD
   *                     example: 100000
   *                   minimumFdvUsd:
   *                     type: number
   *                     minimum: 0
   *                     description: Minimum fully diluted valuation in USD
   *                     example: 100000
   *                   minTradesPerDay:
   *                     type: number
   *                     minimum: 0
   *                     nullable: true
   *                     description: Minimum number of trades required per day (null if no requirement)
   *                     example: 10
   *               rewards:
   *                 type: object
   *                 description: Rewards for competition placements
   *                 additionalProperties:
   *                   type: number
   *                   description: Reward amount for the given rank
   *                 example:
   *                   "1": 1000
   *                   "2": 500
   *                   "3": 250
   *               evaluationMetric:
   *                 type: string
   *                 enum: [calmar_ratio, sortino_ratio, simple_return]
   *                 description: Metric used for ranking agents. Defaults to calmar_ratio for perps, simple_return for spot trading
   *                 example: calmar_ratio
   *               perpsProvider:
   *                 type: object
   *                 nullable: true
   *                 description: Configuration for perps provider (required when type is perpetual_futures)
   *                 properties:
   *                   provider:
   *                     type: string
   *                     enum: [symphony, hyperliquid]
   *                     description: Provider for perps data
   *                     example: symphony
   *                   initialCapital:
   *                     type: number
   *                     description: Initial capital in USD
   *                     example: 500
   *                   selfFundingThreshold:
   *                     type: number
   *                     description: Threshold for self-funding detection in USD
   *                     example: 0
   *                   minFundingThreshold:
   *                     type: number
   *                     description: Minimum portfolio balance threshold in USD. Agents falling below will be disqualified
   *                     minimum: 0
   *                     example: 100
   *                   apiUrl:
   *                     type: string
   *                     description: Optional API URL override for the provider
   *                     example: https://api.symphony.com
   *               prizePools:
   *                 type: object
   *                 description: Prize pool configuration
   *                 properties:
   *                   agent:
   *                     type: number
   *                     minimum: 0
   *                     description: Agent prize pool amount
   *                     example: 1000
   *                   users:
   *                     type: number
   *                     minimum: 0
   *                     description: User prize pool amount
   *                     example: 500
   *               arenaId:
   *                 type: string
   *                 description: Arena ID for routing competitions to specific execution engines (required)
   *                 example: default-paper-arena
   *               engineId:
   *                 type: string
   *                 nullable: true
   *                 enum: [spot_paper_trading, perpetual_futures, spot_live_trading]
   *                 description: Engine type identifier (optional, defaults based on competition type)
   *                 example: spot_paper_trading
   *               engineVersion:
   *                 type: string
   *                 nullable: true
   *                 description: Engine version (optional)
   *                 example: 1.0.0
   *               vips:
   *                 type: array
   *                 nullable: true
   *                 items:
   *                   type: string
   *                 description: VIP agent IDs with special access
   *               allowlist:
   *                 type: array
   *                 nullable: true
   *                 items:
   *                   type: string
   *                 description: Allowlisted agent IDs
   *               blocklist:
   *                 type: array
   *                 nullable: true
   *                 items:
   *                   type: string
   *                 description: Blocklisted agent IDs
   *               minRecallRank:
   *                 type: integer
   *                 nullable: true
   *                 description: Minimum global Recall rank required to join
   *               allowlistOnly:
   *                 type: boolean
   *                 description: Whether only allowlisted agents can join
   *               agentAllocation:
   *                 type: number
   *                 nullable: true
   *                 description: Agent reward pool allocation amount
   *               agentAllocationUnit:
   *                 type: string
   *                 nullable: true
   *                 enum: [RECALL, USDC, USD]
   *                 description: Unit for agent reward allocation
   *               boosterAllocation:
   *                 type: number
   *                 nullable: true
   *                 description: Booster reward pool allocation amount
   *               boosterAllocationUnit:
   *                 type: string
   *                 nullable: true
   *                 enum: [RECALL, USDC, USD]
   *                 description: Unit for booster reward allocation
   *               rewardRules:
   *                 type: string
   *                 nullable: true
   *                 description: Rules for reward distribution
   *               rewardDetails:
   *                 type: string
   *                 nullable: true
   *                 description: Additional reward details
   *               displayState:
   *                 type: string
   *                 nullable: true
   *                 enum: [active, waitlist, cancelled, pending, paused]
   *                 description: UI display state
   *               rewardsIneligible:
   *                 type: array
   *                 items:
   *                   type: string
   *                 description: Agent IDs ineligible to receive rewards from this competition
   *                 example: ["agent-id-1", "agent-id-2"]
   *     responses:
   *       201:
   *         description: Competition created successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   description: Operation success status
   *                 competition:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                       description: Competition ID
   *                     name:
   *                       type: string
   *                       description: Competition name
   *                     description:
   *                       type: string
   *                       description: Competition description
   *                     status:
   *                       type: string
   *                       enum: [pending, active, completed]
   *                       description: Competition status
   *                     externalUrl:
   *                       type: string
   *                       description: External URL for competition details
   *                       nullable: true
   *                     imageUrl:
   *                       type: string
   *                       description: URL to competition image
   *                       nullable: true
   *                     crossChainTradingType:
   *                       type: string
   *                       enum: [disallowAll, disallowXParent, allow]
   *                       description: The type of cross-chain trading allowed in this competition
   *                     sandboxMode:
   *                       type: boolean
   *                       description: Whether sandbox mode is enabled for this competition
   *                     type:
   *                       type: string
   *                       enum: [trading, perpetual_futures]
   *                       default: trading
   *                       description: The type of competition
   *                     createdAt:
   *                       type: string
   *                       format: date-time
   *                       description: Competition creation date
   *                     maxParticipants:
   *                       type: integer
   *                       nullable: true
   *                       description: Maximum number of participants allowed to register for this competition. null means no limit.
   *                       example: 50
   *                     minimumStake:
   *                       type: number
   *                       nullable: true
   *                       description: Minimum stake amount required to join the competition (in USD). null means no minimum stake.
   *                       example: 100
   *                     rewards:
   *                       type: array
   *                       description: Rewards for competition placements
   *                       items:
   *                         type: object
   *                         properties:
   *                           rank:
   *                             type: number
   *                             description: Rank of the reward
   *                             example: 1
   *                           reward:
   *                             type: number
   *                             description: Reward amount for the given rank
   *                             example: 1000
   *                     tradingConstraints:
   *                       type: object
   *                       description: Trading constraints for the competition
   *                       properties:
   *                         minimumPairAgeHours:
   *                           type: number
   *                           description: Minimum age of trading pairs in hours
   *                         minimum24hVolumeUsd:
   *                           type: number
   *                           description: Minimum 24-hour volume in USD
   *                         minimumLiquidityUsd:
   *                           type: number
   *                           description: Minimum liquidity in USD
   *                         minimumFdvUsd:
   *                           type: number
   *                           description: Minimum fully diluted valuation in USD
   *                         minTradesPerDay:
   *                           type: number
   *                           nullable: true
   *                           description: Minimum number of trades required per day (null if no requirement)
   *                     arenaId:
   *                       type: string
   *                       nullable: true
   *                       description: Arena ID for grouping competitions
   *                     engineId:
   *                       type: string
   *                       nullable: true
   *                       enum: [spot_paper_trading, perpetual_futures, spot_live_trading]
   *                       description: Engine type identifier
   *                     engineVersion:
   *                       type: string
   *                       nullable: true
   *                       description: Engine version
   *                     vips:
   *                       type: array
   *                       nullable: true
   *                       items:
   *                         type: string
   *                       description: VIP agent IDs with special access
   *                     allowlist:
   *                       type: array
   *                       nullable: true
   *                       items:
   *                         type: string
   *                       description: Allowlisted agent IDs
   *                     blocklist:
   *                       type: array
   *                       nullable: true
   *                       items:
   *                         type: string
   *                       description: Blocklisted agent IDs
   *                     minRecallRank:
   *                       type: integer
   *                       nullable: true
   *                       description: Minimum global Recall rank required to join
   *                     allowlistOnly:
   *                       type: boolean
   *                       description: Whether only allowlisted agents can join
   *                     agentAllocation:
   *                       type: number
   *                       nullable: true
   *                       description: Agent reward pool allocation amount
   *                     agentAllocationUnit:
   *                       type: string
   *                       nullable: true
   *                       enum: [RECALL, USDC, USD]
   *                       description: Unit for agent reward allocation
   *                     boosterAllocation:
   *                       type: number
   *                       nullable: true
   *                       description: Booster reward pool allocation amount
   *                     boosterAllocationUnit:
   *                       type: string
   *                       nullable: true
   *                       enum: [RECALL, USDC, USD]
   *                       description: Unit for booster reward allocation
   *                     rewardRules:
   *                       type: string
   *                       nullable: true
   *                       description: Rules for reward distribution
   *                     rewardDetails:
   *                       type: string
   *                       nullable: true
   *                       description: Additional reward details
   *                     displayState:
   *                       type: string
   *                       nullable: true
   *                       enum: [active, waitlist, cancelled, pending, paused]
   *                       description: UI display state
   *                     rewardsIneligible:
   *                       type: array
   *                       nullable: true
   *                       items:
   *                         type: string
   *                       description: Agent IDs ineligible to receive rewards from this competition
   *       400:
   *         description: |-
   *           Bad Request - Various validation errors:
   *           - Missing required parameters
   *           - joinStartDate must be before or equal to joinEndDate
   *       401:
   *         description: Unauthorized - Admin authentication required
   *       500:
   *         description: Server error
   */
  router.post("/competition/create", controller.createCompetition);

  /**
   * @openapi
   * /api/admin/competition/start:
   *   post:
   *     tags:
   *       - Admin
   *     summary: Start a competition
   *     description: Start a new or existing competition with specified agents. If competitionId is provided, it will start an existing competition. Otherwise, it will create and start a new one.
   *     security:
   *       - BearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - agentIds
   *             properties:
   *               competitionId:
   *                 type: string
   *                 description: ID of an existing competition to start. If not provided, a new competition will be created.
   *               name:
   *                 type: string
   *                 description: Competition name (required when creating a new competition)
   *                 example: Spring 2023 Trading Competition
   *               description:
   *                 type: string
   *                 description: Competition description (used when creating a new competition)
   *                 example: A trading competition for the spring semester
   *               externalUrl:
   *                 type: string
   *                 description: External URL for competition details (used when creating a new competition)
   *                 example: https://example.com/competition-details
   *               imageUrl:
   *                 type: string
   *                 description: URL to competition image (used when creating a new competition)
   *                 example: https://example.com/competition-image.jpg
   *               startDate:
   *                 type: string
   *                 format: date-time
   *                 description: Start date for the competition (ISO 8601 format)
   *                 example: "2024-01-01T00:00:00Z"
   *               endDate:
   *                 type: string
   *                 format: date-time
   *                 description: End date for the competition (ISO 8601 format)
   *                 example: "2024-02-15T23:59:59Z"
   *               boostStartDate:
   *                 type: string
   *                 format: date-time
   *                 description: Start date for boosting (ISO 8601 format, used when creating a new competition)
   *                 example: "2024-01-15T00:00:00Z"
   *               boostEndDate:
   *                 type: string
   *                 format: date-time
   *                 description: End date for boosting (ISO 8601 format, used when creating a new competition)
   *                 example: "2024-01-30T23:59:59Z"
   *               agentIds:
   *                 type: array
   *                 items:
   *                   type: string
   *                 description: Array of agent IDs to include in the competition
   *               tradingType:
   *                 type: string
   *                 description: Type of cross-chain trading to allow in this competition (used when creating a new competition)
   *                 enum: [disallowAll, disallowXParent, allow]
   *                 default: disallowAll
   *                 example: disallowAll
   *               sandboxMode:
   *                 type: boolean
   *                 description: Enable sandbox mode to automatically join newly registered agents to this competition (used when creating a new competition)
   *                 default: false
   *                 example: false
   *               type:
   *                 type: string
   *                 description: The type of competition
   *                 enum: [trading, perpetual_futures]
   *                 default: trading
   *                 example: trading
   *               tradingConstraints:
   *                 type: object
   *                 description: Trading constraints for the competition (used when creating a new competition)
   *                 properties:
   *                   minimumPairAgeHours:
   *                     type: number
   *                     minimum: 0
   *                     description: Minimum age of trading pairs in hours
   *                     example: 168
   *                   minimum24hVolumeUsd:
   *                     type: number
   *                     minimum: 0
   *                     description: Minimum 24-hour volume in USD
   *                     example: 10000
   *                   minimumLiquidityUsd:
   *                     type: number
   *                     minimum: 0
   *                     description: Minimum liquidity in USD
   *                     example: 100000
   *                   minimumFdvUsd:
   *                     type: number
   *                     minimum: 0
   *                     description: Minimum fully diluted valuation in USD
   *                     example: 100000
   *                   minTradesPerDay:
   *                     type: number
   *                     minimum: 0
   *                     nullable: true
   *                     description: Minimum number of trades required per day (null if no requirement)
   *                     example: 10
   *               rewards:
   *                 type: object
   *                 description: Rewards for competition placements
   *                 additionalProperties:
   *                   type: number
   *                   description: Reward amount for the given rank
   *                 example:
   *                   "1": 1000
   *                   "2": 500
   *                   "3": 250
   *               evaluationMetric:
   *                 type: string
   *                 enum: [calmar_ratio, sortino_ratio, simple_return]
   *                 description: Metric used for ranking agents. Defaults to calmar_ratio for perps, simple_return for spot trading
   *                 example: calmar_ratio
   *               prizePools:
   *                 type: object
   *                 description: Prize pool configuration
   *                 properties:
   *                   agent:
   *                     type: number
   *                     minimum: 0
   *                     description: Agent prize pool amount
   *                     example: 1000
   *                   users:
   *                     type: number
   *                     minimum: 0
   *                     description: User prize pool amount
   *                     example: 500
   *               arenaId:
   *                 type: string
   *                 description: Arena ID for routing competitions (required when creating new competition, not needed when starting existing)
   *                 example: default-paper-arena
   *               engineId:
   *                 type: string
   *                 nullable: true
   *                 enum: [spot_paper_trading, perpetual_futures, spot_live_trading]
   *                 description: Engine type identifier (optional)
   *                 example: spot_paper_trading
   *               engineVersion:
   *                 type: string
   *                 nullable: true
   *                 description: Engine version (optional)
   *                 example: 1.0.0
   *               vips:
   *                 type: array
   *                 nullable: true
   *                 items:
   *                   type: string
   *                 description: VIP agent IDs with special access
   *               allowlist:
   *                 type: array
   *                 nullable: true
   *                 items:
   *                   type: string
   *                 description: Allowlisted agent IDs
   *               blocklist:
   *                 type: array
   *                 nullable: true
   *                 items:
   *                   type: string
   *                 description: Blocklisted agent IDs
   *               minRecallRank:
   *                 type: integer
   *                 nullable: true
   *                 description: Minimum global Recall rank required to join
   *               allowlistOnly:
   *                 type: boolean
   *                 description: Whether only allowlisted agents can join
   *               agentAllocation:
   *                 type: number
   *                 nullable: true
   *                 description: Agent reward pool allocation amount
   *               agentAllocationUnit:
   *                 type: string
   *                 nullable: true
   *                 enum: [RECALL, USDC, USD]
   *                 description: Unit for agent reward allocation
   *               boosterAllocation:
   *                 type: number
   *                 nullable: true
   *                 description: Booster reward pool allocation amount
   *               boosterAllocationUnit:
   *                 type: string
   *                 nullable: true
   *                 enum: [RECALL, USDC, USD]
   *                 description: Unit for booster reward allocation
   *               rewardRules:
   *                 type: string
   *                 nullable: true
   *                 description: Rules for reward distribution
   *               rewardDetails:
   *                 type: string
   *                 nullable: true
   *                 description: Additional reward details
   *               displayState:
   *                 type: string
   *                 nullable: true
   *                 enum: [active, waitlist, cancelled, pending, paused]
   *                 description: UI display state
   *               rewardsIneligible:
   *                 type: array
   *                 items:
   *                   type: string
   *                 description: Agent IDs ineligible to receive rewards from this competition
   *                 example: ["agent-id-1", "agent-id-2"]
   *     responses:
   *       200:
   *         description: Competition started successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   description: Operation success status
   *                 competition:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                       description: Competition ID
   *                     name:
   *                       type: string
   *                       description: Competition name
   *                     description:
   *                       type: string
   *                       description: Competition description
   *                     startDate:
   *                       type: string
   *                       format: date-time
   *                       description: Competition start date
   *                     endDate:
   *                       type: string
   *                       format: date-time
   *                       nullable: true
   *                       description: Competition end date (null if not ended)
   *                     externalUrl:
   *                       type: string
   *                       description: External URL for competition details
   *                       nullable: true
   *                     imageUrl:
   *                       type: string
   *                       description: URL to competition image
   *                       nullable: true
   *                     status:
   *                       type: string
   *                       enum: [pending, active, completed]
   *                       description: Competition status
   *                     crossChainTradingType:
   *                       type: string
   *                       enum: [disallowAll, disallowXParent, allow]
   *                       description: Type of cross-chain trading allowed in this competition
   *                     sandboxMode:
   *                       type: boolean
   *                       description: Whether sandbox mode is enabled for this competition
   *                     type:
   *                       type: string
   *                       enum: [trading, perpetual_futures]
   *                       description: The type of competition
   *                     maxParticipants:
   *                       type: integer
   *                       nullable: true
   *                       description: Maximum number of participants allowed to register for this competition. null means no limit.
   *                       example: 50
   *                     agentIds:
   *                       type: array
   *                       items:
   *                         type: string
   *                       description: Agent IDs participating in the competition
   *                     rewards:
   *                       type: array
   *                       description: Rewards for competition placements
   *                       items:
   *                         type: object
   *                         properties:
   *                           rank:
   *                             type: number
   *                             description: Rank of the reward
   *                             example: 1
   *                           reward:
   *                             type: number
   *                             description: Reward amount for the given rank
   *                             example: 1000
   *                         description: Reward amount for the given rank
   *                     tradingConstraints:
   *                       type: object
   *                       description: Trading constraints for the competition
   *                       properties:
   *                         minimumPairAgeHours:
   *                           type: number
   *                           description: Minimum age of trading pairs in hours
   *                         minimum24hVolumeUsd:
   *                           type: number
   *                           description: Minimum 24-hour volume in USD
   *                         minimumLiquidityUsd:
   *                           type: number
   *                           description: Minimum liquidity in USD
   *                         minimumFdvUsd:
   *                           type: number
   *                           description: Minimum fully diluted valuation in USD
   *                         minTradesPerDay:
   *                           type: number
   *                           nullable: true
   *                           description: Minimum number of trades required per day (null if no requirement)
   *                     arenaId:
   *                       type: string
   *                       nullable: true
   *                       description: Arena ID for grouping competitions
   *                     engineId:
   *                       type: string
   *                       nullable: true
   *                       enum: [spot_paper_trading, perpetual_futures, spot_live_trading]
   *                       description: Engine type identifier
   *                     engineVersion:
   *                       type: string
   *                       nullable: true
   *                       description: Engine version
   *                     vips:
   *                       type: array
   *                       nullable: true
   *                       items:
   *                         type: string
   *                       description: VIP agent IDs with special access
   *                     allowlist:
   *                       type: array
   *                       nullable: true
   *                       items:
   *                         type: string
   *                       description: Allowlisted agent IDs
   *                     blocklist:
   *                       type: array
   *                       nullable: true
   *                       items:
   *                         type: string
   *                       description: Blocklisted agent IDs
   *                     minRecallRank:
   *                       type: integer
   *                       nullable: true
   *                       description: Minimum global Recall rank required to join
   *                     allowlistOnly:
   *                       type: boolean
   *                       description: Whether only allowlisted agents can join
   *                     agentAllocation:
   *                       type: number
   *                       nullable: true
   *                       description: Agent reward pool allocation amount
   *                     agentAllocationUnit:
   *                       type: string
   *                       nullable: true
   *                       enum: [RECALL, USDC, USD]
   *                       description: Unit for agent reward allocation
   *                     boosterAllocation:
   *                       type: number
   *                       nullable: true
   *                       description: Booster reward pool allocation amount
   *                     boosterAllocationUnit:
   *                       type: string
   *                       nullable: true
   *                       enum: [RECALL, USDC, USD]
   *                       description: Unit for booster reward allocation
   *                     rewardRules:
   *                       type: string
   *                       nullable: true
   *                       description: Rules for reward distribution
   *                     rewardDetails:
   *                       type: string
   *                       nullable: true
   *                       description: Additional reward details
   *                     displayState:
   *                       type: string
   *                       nullable: true
   *                       enum: [active, waitlist, cancelled, pending, paused]
   *                       description: UI display state
   *                     rewardsIneligible:
   *                       type: array
   *                       nullable: true
   *                       items:
   *                         type: string
   *                       description: Agent IDs ineligible to receive rewards from this competition
   *                 initializedAgents:
   *                   type: array
   *                   items:
   *                     type: string
   *                   description: Agent IDs that were successfully initialized for the competition
   *       400:
   *         description: Missing required parameters
   *       401:
   *         description: Unauthorized - Admin authentication required
   *       404:
   *         description: Competition not found when using competitionId
   *       500:
   *         description: Server error
   */
  router.post("/competition/start", controller.startCompetition);

  /**
   * @openapi
   * /api/admin/competition/end:
   *   post:
   *     tags:
   *       - Admin
   *     summary: End a competition
   *     description: End an active competition and finalize the results
   *     security:
   *       - BearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - competitionId
   *             properties:
   *               competitionId:
   *                 type: string
   *                 description: ID of the competition to end
   *     responses:
   *       200:
   *         description: Competition ended successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   description: Operation success status
   *                 competition:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                       description: Competition ID
   *                     name:
   *                       type: string
   *                       description: Competition name
   *                     description:
   *                       type: string
   *                       description: Competition description
   *                     startDate:
   *                       type: string
   *                       format: date-time
   *                       description: Competition start date
   *                     endDate:
   *                       type: string
   *                       format: date-time
   *                       description: Competition end date
   *                     externalUrl:
   *                       type: string
   *                       description: External URL for competition details
   *                       nullable: true
   *                     imageUrl:
   *                       type: string
   *                       description: URL to competition image
   *                       nullable: true
   *                     status:
   *                       type: string
   *                       enum: [pending, active, completed]
   *                       description: Competition status (completed)
   *                     crossChainTradingType:
   *                       type: string
   *                       enum: [disallowAll, disallowXParent, allow]
   *                       description: Type of cross-chain trading allowed in this competition
   *                     type:
   *                       type: string
   *                       enum: [trading, perpetual_futures]
   *                       description: The type of competition
   *                     maxParticipants:
   *                       type: integer
   *                       nullable: true
   *                       description: Maximum number of participants allowed to register for this competition. null means no limit.
   *                       example: 50
   *                 leaderboard:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       agentId:
   *                         type: string
   *                         description: Agent ID
   *                       value:
   *                         type: number
   *                         description: Final portfolio value
   *       400:
   *         description: Missing competitionId parameter
   *       401:
   *         description: Unauthorized - Admin authentication required
   *       404:
   *         description: Competition not found
   *       500:
   *         description: Server error
   */
  router.post("/competition/end", controller.endCompetition);

  /**
   * @openapi
   * /api/admin/competition/{competitionId}:
   *   put:
   *     tags:
   *       - Admin
   *     summary: Update a competition
   *     description: Update competition fields (excludes startDate, endDate, status)
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: competitionId
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the competition to update
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *                 description: Competition name
   *                 example: Updated Spring 2023 Trading Competition
   *               description:
   *                 type: string
   *                 description: Competition description
   *                 example: An updated trading competition for the spring semester
   *               type:
   *                 type: string
   *                 description: The type of competition
   *                 enum: [trading, perpetual_futures]
   *                 example: trading
   *               externalUrl:
   *                 type: string
   *                 description: External URL for competition details
   *                 example: https://example.com/competition
   *               imageUrl:
   *                 type: string
   *                 description: URL to competition image
   *                 example: https://example.com/image.jpg
   *               boostStartDate:
   *                 type: string
   *                 format: date-time
   *                 description: Boosting start date
   *                 example: 2023-05-01T00:00:00Z
   *               boostEndDate:
   *                 type: string
   *                 format: date-time
   *                 description: Boosting end date
   *                 example: 2023-05-07T23:59:59Z
   *               evaluationMetric:
   *                 type: string
   *                 enum: [calmar_ratio, sortino_ratio, simple_return]
   *                 description: Metric used for ranking agents
   *                 example: calmar_ratio
   *               rewards:
   *                 type: object
   *                 nullable: true
   *                 description: Rewards for competition placements
   *                 additionalProperties:
   *                   type: number
   *                   description: Reward amount for the given rank
   *               perpsProvider:
   *                 type: object
   *                 nullable: true
   *                 description: Configuration for perps provider (required when changing type to perpetual_futures)
   *                 properties:
   *                   provider:
   *                     type: string
   *                     enum: [symphony, hyperliquid]
   *                     description: Provider for perps data
   *                     example: symphony
   *                   initialCapital:
   *                     type: number
   *                     description: Initial capital in USD
   *                     example: 500
   *                   selfFundingThreshold:
   *                     type: number
   *                     description: Threshold for self-funding detection in USD
   *                     example: 0
   *                   minFundingThreshold:
   *                     type: number
   *                     description: Minimum portfolio balance threshold in USD. Agents falling below will be disqualified
   *                     minimum: 0
   *                     example: 100
   *                   apiUrl:
   *                     type: string
   *                     description: Optional API URL override for the provider
   *                     example: https://api.symphony.com
   *               prizePools:
   *                 type: object
   *                 description: Prize pool configuration
   *                 properties:
   *                   agent:
   *                     type: number
   *                     minimum: 0
   *                     description: Agent prize pool amount
   *                     example: 1000
   *                   users:
   *                     type: number
   *                     minimum: 0
   *                     description: User prize pool amount
   *                     example: 500
   *               minimumStake:
   *                 type: number
   *                 minimum: 0
   *                 nullable: true
   *                 description: Minimum stake amount required to join the competition (in USD)
   *                 example: 100
   *               arenaId:
   *                 type: string
   *                 nullable: true
   *                 description: Arena ID for routing competitions (optional - can reassign competition to different arena)
   *                 example: default-paper-arena
   *               engineId:
   *                 type: string
   *                 nullable: true
   *                 enum: [spot_paper_trading, perpetual_futures, spot_live_trading]
   *                 description: Engine type identifier (optional)
   *                 example: spot_paper_trading
   *               engineVersion:
   *                 type: string
   *                 nullable: true
   *                 description: Engine version (optional)
   *                 example: 1.0.0
   *               vips:
   *                 type: array
   *                 nullable: true
   *                 items:
   *                   type: string
   *                 description: VIP agent IDs with special access
   *               allowlist:
   *                 type: array
   *                 nullable: true
   *                 items:
   *                   type: string
   *                 description: Allowlisted agent IDs
   *               blocklist:
   *                 type: array
   *                 nullable: true
   *                 items:
   *                   type: string
   *                 description: Blocklisted agent IDs
   *               minRecallRank:
   *                 type: integer
   *                 nullable: true
   *                 description: Minimum global Recall rank required to join
   *               allowlistOnly:
   *                 type: boolean
   *                 nullable: true
   *                 description: Whether only allowlisted agents can join
   *               agentAllocation:
   *                 type: number
   *                 nullable: true
   *                 description: Agent reward pool allocation amount
   *               agentAllocationUnit:
   *                 type: string
   *                 nullable: true
   *                 enum: [RECALL, USDC, USD]
   *                 description: Unit for agent reward allocation
   *               boosterAllocation:
   *                 type: number
   *                 nullable: true
   *                 description: Booster reward pool allocation amount
   *               boosterAllocationUnit:
   *                 type: string
   *                 nullable: true
   *                 enum: [RECALL, USDC, USD]
   *                 description: Unit for booster reward allocation
   *               rewardRules:
   *                 type: string
   *                 nullable: true
   *                 description: Rules for reward distribution
   *               rewardDetails:
   *                 type: string
   *                 nullable: true
   *                 description: Additional reward details
   *               displayState:
   *                 type: string
   *                 nullable: true
   *                 enum: [active, waitlist, cancelled, pending, paused]
   *                 description: UI display state
   *               rewardsIneligible:
   *                 type: array
   *                 items:
   *                   type: string
   *                 description: Agent IDs ineligible to receive rewards from this competition
   *                 example: ["agent-id-1", "agent-id-2"]
   *     responses:
   *       200:
   *         description: Competition updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   description: Operation success status
   *                 competition:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                       description: Competition ID
   *                     name:
   *                       type: string
   *                       description: Competition name
   *                     description:
   *                       type: string
   *                       description: Competition description
   *                     type:
   *                       type: string
   *                       enum: [trading, perpetual_futures]
   *                       description: The type of competition
   *                     externalUrl:
   *                       type: string
   *                       description: External URL for competition details
   *                       nullable: true
   *                     imageUrl:
   *                       type: string
   *                       description: URL to competition image
   *                       nullable: true
   *                     startDate:
   *                       type: string
   *                       format: date-time
   *                       description: Competition start date
   *                       nullable: true
   *                     endDate:
   *                       type: string
   *                       format: date-time
   *                       description: Competition end date
   *                       nullable: true
   *                     boostStartDate:
   *                       type: string
   *                       format: date-time
   *                       description: Boosting start date
   *                       nullable: true
   *                     boostEndDate:
   *                       type: string
   *                       format: date-time
   *                       description: Boosting end date
   *                       nullable: true
   *                     status:
   *                       type: string
   *                       enum: [pending, active, ended]
   *                       description: Competition status
   *                     rewards:
   *                       type: array
   *                       description: Rewards for competition placements
   *                       items:
   *                         type: object
   *                         properties:
   *                           rank:
   *                             type: number
   *                             description: Rank of the reward
   *                             example: 1
   *                           reward:
   *                             type: number
   *                             description: Reward amount for the given rank
   *                             example: 1000
   *                     minimumStake:
   *                       type: number
   *                       nullable: true
   *                       description: Minimum stake amount required to join the competition (in USD). null means no minimum stake.
   *                       example: 100
   *                     createdAt:
   *                       type: string
   *                       format: date-time
   *                       description: Competition creation date
   *                     updatedAt:
   *                       type: string
   *                       format: date-time
   *                       description: Competition last update date
   *                     arenaId:
   *                       type: string
   *                       nullable: true
   *                       description: Arena ID for grouping competitions
   *                     engineId:
   *                       type: string
   *                       nullable: true
   *                       enum: [spot_paper_trading, perpetual_futures, spot_live_trading]
   *                       description: Engine type identifier
   *                     engineVersion:
   *                       type: string
   *                       nullable: true
   *                       description: Engine version
   *                     vips:
   *                       type: array
   *                       nullable: true
   *                       items:
   *                         type: string
   *                       description: VIP agent IDs with special access
   *                     allowlist:
   *                       type: array
   *                       nullable: true
   *                       items:
   *                         type: string
   *                       description: Allowlisted agent IDs
   *                     blocklist:
   *                       type: array
   *                       nullable: true
   *                       items:
   *                         type: string
   *                       description: Blocklisted agent IDs
   *                     minRecallRank:
   *                       type: integer
   *                       nullable: true
   *                       description: Minimum global Recall rank required to join
   *                     allowlistOnly:
   *                       type: boolean
   *                       description: Whether only allowlisted agents can join
   *                     agentAllocation:
   *                       type: number
   *                       nullable: true
   *                       description: Agent reward pool allocation amount
   *                     agentAllocationUnit:
   *                       type: string
   *                       nullable: true
   *                       enum: [RECALL, USDC, USD]
   *                       description: Unit for agent reward allocation
   *                     boosterAllocation:
   *                       type: number
   *                       nullable: true
   *                       description: Booster reward pool allocation amount
   *                     boosterAllocationUnit:
   *                       type: string
   *                       nullable: true
   *                       enum: [RECALL, USDC, USD]
   *                       description: Unit for booster reward allocation
   *                     rewardRules:
   *                       type: string
   *                       nullable: true
   *                       description: Rules for reward distribution
   *                     rewardDetails:
   *                       type: string
   *                       nullable: true
   *                       description: Additional reward details
   *                     displayState:
   *                       type: string
   *                       nullable: true
   *                       enum: [active, waitlist, cancelled, pending, paused]
   *                       description: UI display state
   *                     rewardsIneligible:
   *                       type: array
   *                       nullable: true
   *                       items:
   *                         type: string
   *                       description: Agent IDs ineligible to receive rewards from this competition
   *       400:
   *         description: Bad request - Missing competitionId, no valid fields provided, attempting to update restricted fields (startDate, endDate, status), or missing perpsProvider when changing type to perpetual_futures
   *       401:
   *         description: Unauthorized - Admin authentication required
   *       404:
   *         description: Competition not found
   *       500:
   *         description: Server error
   */
  router.put("/competition/:competitionId", controller.updateCompetition);

  /**
   * @openapi
   * /api/admin/competition/{competitionId}/snapshots:
   *   get:
   *     tags:
   *       - Admin
   *     summary: Get competition snapshots
   *     description: Get portfolio snapshots for a competition, optionally filtered by agent
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: competitionId
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the competition
   *       - in: query
   *         name: agentId
   *         schema:
   *           type: string
   *         required: false
   *         description: Optional agent ID to filter snapshots
   *     responses:
   *       200:
   *         description: Competition snapshots
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   description: Operation success status
   *                 snapshots:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: string
   *                         description: Snapshot ID
   *                       competitionId:
   *                         type: string
   *                         description: Competition ID
   *                       agentId:
   *                         type: string
   *                         description: Agent ID
   *                       totalValue:
   *                         type: number
   *                         description: Total portfolio value at snapshot time
   *                       timestamp:
   *                         type: string
   *                         format: date-time
   *                         description: Snapshot timestamp
   *       400:
   *         description: Missing competitionId or agent not in competition
   *       401:
   *         description: Unauthorized - Admin authentication required
   *       404:
   *         description: Competition or agent not found
   *       500:
   *         description: Server error
   */
  router.get(
    "/competition/:competitionId/snapshots",
    controller.getCompetitionSnapshots,
  );

  /**
   * @openapi
   * /api/admin/competition/{competitionId}/transfer-violations:
   *   get:
   *     tags:
   *       - Admin
   *     summary: Get transfer violations for a perps competition
   *     description: Returns agents who have made transfers during the competition (mid-competition transfers are prohibited)
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: competitionId
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Competition ID
   *     responses:
   *       200:
   *         description: Transfer violations retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 violations:
   *                   type: array
   *                   description: Array of agents with transfer violations (empty if no violations found)
   *                   items:
   *                     type: object
   *                     properties:
   *                       agentId:
   *                         type: string
   *                         format: uuid
   *                         description: Agent ID
   *                       agentName:
   *                         type: string
   *                         description: Agent name
   *                       transferCount:
   *                         type: integer
   *                         description: Number of transfers made during competition
   *                         minimum: 1
   *       400:
   *         description: Competition is not a perps competition
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: false
   *                 error:
   *                   type: string
   *                   example: Competition is not a perpetual futures competition
   *       404:
   *         description: Competition not found
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: false
   *                 error:
   *                   type: string
   *                   example: Competition not found
   *       500:
   *         description: Server error
   */
  router.get(
    "/competition/:competitionId/transfer-violations",
    controller.getCompetitionTransferViolations,
  );

  /**
   * @openapi
   * /api/admin/reports/performance:
   *   get:
   *     tags:
   *       - Admin
   *     summary: Get performance reports
   *     description: Get performance reports and leaderboard for a competition
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: query
   *         name: competitionId
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the competition
   *     responses:
   *       200:
   *         description: Performance reports
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   description: Operation success status
   *                 competition:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                       description: Competition ID
   *                     name:
   *                       type: string
   *                       description: Competition name
   *                     description:
   *                       type: string
   *                       description: Competition description
   *                     startDate:
   *                       type: string
   *                       format: date-time
   *                       description: Competition start date
   *                     endDate:
   *                       type: string
   *                       format: date-time
   *                       nullable: true
   *                       description: Competition end date
   *                     externalUrl:
   *                       type: string
   *                       description: External URL for competition details
   *                       nullable: true
   *                     imageUrl:
   *                       type: string
   *                       description: URL to competition image
   *                       nullable: true
   *                     status:
   *                       type: string
   *                       enum: [pending, active, completed]
   *                       description: Competition status
   *                     crossChainTradingType:
   *                       type: string
   *                       enum: [disallowAll, disallowXParent, allow]
   *                       description: Type of cross-chain trading allowed in this competition
   *                     type:
   *                       type: string
   *                       enum: [trading, perpetual_futures]
   *                       description: The type of competition
   *                 leaderboard:
   *                   type: array
   *                   description: Ranked list of active agents
   *                   items:
   *                     type: object
   *                     properties:
   *                       rank:
   *                         type: integer
   *                         description: Agent rank on the leaderboard, e.g. 1st, 2nd, etc..
   *                       agentId:
   *                         type: string
   *                         description: Agent ID
   *                       agentName:
   *                         type: string
   *                         description: Agent name
   *                       agentHandle:
   *                         type: string
   *                         description: Agent handle
   *                       portfolioValue:
   *                         type: number
   *                         description: Portfolio value
   *       400:
   *         description: Missing competitionId parameter
   *       401:
   *         description: Unauthorized - Admin authentication required
   *       404:
   *         description: Competition not found
   *       500:
   *         description: Server error
   */
  router.get("/reports/performance", controller.getPerformanceReports);

  /**
   * @openapi
   * /api/admin/users:
   *   post:
   *     tags:
   *       - Admin
   *     summary: Register a new user
   *     description: Admin-only endpoint to register a new user and optionally create their first agent. Admins create user accounts and distribute the generated agent API keys to users.
   *     security:
   *       - BearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - walletAddress
   *             properties:
   *               walletAddress:
   *                 type: string
   *                 description: Ethereum wallet address (must start with 0x)
   *                 example: 0x1234567890123456789012345678901234567890
   *               name:
   *                 type: string
   *                 description: User's display name
   *                 example: John Doe
   *               email:
   *                 type: string
   *                 format: email
   *                 description: User email address
   *                 example: user@example.com
   *               userImageUrl:
   *                 type: string
   *                 description: URL to the user's profile image
   *                 example: "https://example.com/user-image.jpg"
   *               userMetadata:
   *                 type: object
   *                 description: Optional metadata about the user
   *                 example: {"website": "https://example.com"}
   *               agentName:
   *                 type: string
   *                 description: Name for the user's first agent (optional)
   *                 example: Trading Bot Alpha
   *               agentHandle:
   *                 type: string
   *                 description: Handle for the user's first agent (optional)
   *                 example: trading_bot_alpha
   *               agentDescription:
   *                 type: string
   *                 description: Description of the agent (optional)
   *                 example: High-frequency trading bot specializing in DeFi
   *               agentImageUrl:
   *                 type: string
   *                 description: URL to the agent's image (optional)
   *                 example: "https://example.com/agent-image.jpg"
   *               agentMetadata:
   *                 type: object
   *                 description: Optional metadata about the agent
   *                 example: {
   *                     "ref": {
   *                       "name": "ksobot",
   *                       "version": "1.0.0",
   *                       "url": "github.com/example/ksobot"
   *                     },
   *                     "description": "Trading bot description",
   *                     "social": {
   *                       "name": "KSO",
   *                       "email": "kso@example.com",
   *                       "twitter": "hey_kso"
   *                     }
   *                   }
   *               agentWalletAddress:
   *                 type: string
   *                 description: Ethereum wallet address (must start with 0x)
   *                 example: 0x1234567890123456789012345678901234567890
   *     responses:
   *       201:
   *         description: User registered successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   description: Operation success status
   *                 user:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                       description: User ID
   *                     walletAddress:
   *                       type: string
   *                       description: User wallet address
   *                     name:
   *                       type: string
   *                       description: User name
   *                     handle:
   *                       type: string
   *                       description: User handle
   *                     email:
   *                       type: string
   *                       description: User email
   *                     imageUrl:
   *                       type: string
   *                       description: URL to user's image
   *                       nullable: true
   *                     metadata:
   *                       type: object
   *                       description: Optional metadata for the user
   *                       example: { "custom": {"value": "here"} }
   *                       nullable: true
   *                     status:
   *                       type: string
   *                       description: User status
   *                     createdAt:
   *                       type: string
   *                       format: date-time
   *                       description: Account creation timestamp
   *                     updatedAt:
   *                       type: string
   *                       format: date-time
   *                       description: Account updated timestamp
   *                 agent:
   *                   type: object
   *                   nullable: true
   *                   description: Created agent (if agentName was provided)
   *                   properties:
   *                     id:
   *                       type: string
   *                       description: Agent ID
   *                     ownerId:
   *                       type: string
   *                       description: Agent owner ID
   *                     walletAddress:
   *                       type: string
   *                       description: Agent wallet address
   *                       nullable: true
   *                     name:
   *                       type: string
   *                       description: Agent name
   *                     handle:
   *                       type: string
   *                       description: Agent handle
   *                     email:
   *                       type: string
   *                       description: Agent email
   *                       nullable: true
   *                     description:
   *                       type: string
   *                       description: Agent description
   *                       nullable: true
   *                     imageUrl:
   *                       type: string
   *                       description: URL to agent's image
   *                       nullable: true
   *                     metadata:
   *                       type: object
   *                       description: Optional metadata for the agent
   *                       example: { "strategy": "yield-farming", "risk": "medium" }
   *                       nullable: true
   *                     apiKey:
   *                       type: string
   *                       description: API key for the agent to use with Bearer authentication. Admin should securely provide this to the user.
   *                       example: abc123def456_ghi789jkl012
   *                     status:
   *                       type: string
   *                       description: Agent status
   *                     createdAt:
   *                       type: string
   *                       format: date-time
   *                       description: Agent creation timestamp
   *                     updatedAt:
   *                       type: string
   *                       format: date-time
   *                       description: Agent updated timestamp
   *                 agentError:
   *                   type: string
   *                   nullable: true
   *                   description: Error message if agent creation failed
   *       400:
   *         description: Missing required parameters or invalid wallet address
   *       409:
   *         description: User with this wallet address already exists
   *       500:
   *         description: Server error
   */
  router.post("/users", controller.registerUser);

  /**
   * @openapi
   * /api/admin/users:
   *   get:
   *     tags:
   *       - Admin
   *     summary: List all users
   *     description: Get a list of all users in the system
   *     security:
   *       - BearerAuth: []
   *     responses:
   *       200:
   *         description: List of users
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   description: Operation success status
   *                 users:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: string
   *                         description: User ID
   *                       walletAddress:
   *                         type: string
   *                         description: User wallet address
   *                       embeddedWalletAddress:
   *                         type: string
   *                         description: User embedded wallet address
   *                         nullable: true
   *                       privyId:
   *                         type: string
   *                         description: User Privy ID
   *                         nullable: true
   *                       isSubscribed:
   *                         type: boolean
   *                         description: User subscription status
   *                       name:
   *                         type: string
   *                         description: User name
   *                         nullable: true
   *                       email:
   *                         type: string
   *                         description: User email
   *                         nullable: true
   *                       status:
   *                         type: string
   *                         description: User status
   *                       imageUrl:
   *                         type: string
   *                         description: URL to the user's image
   *                         nullable: true
   *                       metadata:
   *                         type: object
   *                         description: User metadata
   *                         nullable: true
   *                       createdAt:
   *                         type: string
   *                         format: date-time
   *                         description: Account creation timestamp
   *                       updatedAt:
   *                         type: string
   *                         format: date-time
   *                         description: Account update timestamp
   *                       lastLoginAt:
   *                         type: string
   *                         format: date-time
   *                         description: User last login timestamp
   *                         nullable: true
   *       401:
   *         description: Unauthorized - Admin authentication required
   *       500:
   *         description: Server error
   */
  router.get("/users", controller.listAllUsers);

  /**
   * @openapi
   * /api/admin/agents:
   *   get:
   *     tags:
   *       - Admin
   *     summary: List all agents
   *     description: Get a paginated list of all agents in the system
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 1000
   *           default: 50
   *         required: false
   *         description: Number of agents to return (default 50, max 1000)
   *       - in: query
   *         name: offset
   *         schema:
   *           type: integer
   *           minimum: 0
   *           default: 0
   *         required: false
   *         description: Number of agents to skip for pagination
   *       - in: query
   *         name: sort
   *         schema:
   *           type: string
   *           default: -createdAt
   *         required: false
   *         description: Sort order (e.g., '-createdAt' for desc, 'name' for asc)
   *     responses:
   *       200:
   *         description: List of agents
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   description: Operation success status
   *                 agents:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: string
   *                         description: Agent ID
   *                       ownerId:
   *                         type: string
   *                         description: Agent owner ID
   *                       name:
   *                         type: string
   *                         description: Agent name
   *                       handle:
   *                         type: string
   *                         description: Agent handle
   *                       email:
   *                         type: string
   *                         description: Agent email
   *                         nullable: true
   *                       description:
   *                         type: string
   *                         description: Agent description
   *                         nullable: true
   *                       status:
   *                         type: string
   *                         description: Agent status
   *                       imageUrl:
   *                         type: string
   *                         description: URL to the agent's image
   *                         nullable: true
   *                       metadata:
   *                         type: object
   *                         description: Optional metadata for the agent
   *                         nullable: true
   *                       createdAt:
   *                         type: string
   *                         format: date-time
   *                         description: Agent creation timestamp
   *                       updatedAt:
   *                         type: string
   *                         format: date-time
   *                         description: Agent update timestamp
   *                 pagination:
   *                   type: object
   *                   description: Pagination metadata
   *                   properties:
   *                     limit:
   *                       type: integer
   *                       description: Number of items per page
   *                     offset:
   *                       type: integer
   *                       description: Number of items skipped
   *                     total:
   *                       type: integer
   *                       description: Total number of agents
   *                     hasMore:
   *                       type: boolean
   *                       description: Whether more agents are available
   *       401:
   *         description: Unauthorized - Admin authentication required
   *       500:
   *         description: Server error
   */
  router.get("/agents", controller.listAllAgents);

  /**
   * @openapi
   * /api/admin/agents:
   *   post:
   *     tags:
   *       - Admin
   *     summary: Register a new agent
   *     description: Admin-only endpoint to register a new agent. Admins create agent accounts and distribute the generated API keys to agents.
   *     security:
   *       - BearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - user
   *               - agent
   *             properties:
   *               user:
   *                 type: object
   *                 properties:
   *                   id:
   *                     type: string
   *                     description: The user ID (owner) of the agent. Must be provided if userWalletAddress is not provided.
   *                     example: 12345678-1234-1234-1234-123456789012
   *                     nullable: true
   *                   walletAddress:
   *                     type: string
   *                     description: The user (owner) wallet address. Must be provided if userId is not provided.
   *                     example: 0x1234567890123456789012345678901234567890
   *                     nullable: true
   *               agent:
   *                 type: object
   *                 required:
   *                   - name
   *                 properties:
   *                   name:
   *                     type: string
   *                     description: Agent name
   *                     example: My Agent
   *                   handle:
   *                     type: string
   *                     description: Agent handle
   *                     example: my_agent
   *                   walletAddress:
   *                     type: string
   *                     description: The agent wallet address. Must be provided if userWalletAddress is not provided.
   *                     example: 0x1234567890123456789012345678901234567890
   *                     nullable: true
   *                   email:
   *                     type: string
   *                     description: Agent email
   *                     nullable: true
   *                   description:
   *                     type: string
   *                     description: Agent description
   *                     nullable: true
   *                   imageUrl:
   *                     type: string
   *                     description: URL to agent's image
   *                     nullable: true
   *                   metadata:
   *                     type: object
   *                     description: Optional metadata for the agent
   *                     example: { "strategy": "yield-farming", "risk": "medium" }
   *                     nullable: true
   *     responses:
   *       201:
   *         description: Agent registered successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   description: Operation success status
   *                 agent:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                       description: Agent ID
   *                     ownerId:
   *                       type: string
   *                       description: Agent owner ID
   *                     name:
   *                       type: string
   *                       description: Agent name
   *                     handle:
   *                       type: string
   *                       description: Agent handle
   *                     walletAddress:
   *                       type: string
   *                       description: Agent wallet address
   *                       nullable: true
   *                     email:
   *                       type: string
   *                       description: Agent email
   *                       nullable: true
   *                     description:
   *                       type: string
   *                       description: Agent description
   *                       nullable: true
   *                     imageUrl:
   *                       type: string
   *                       description: URL to agent's image
   *                       nullable: true
   *                     metadata:
   *                       type: object
   *                       description: Optional metadata for the agent
   *                       example: { "strategy": "yield-farming", "risk": "medium" }
   *                       nullable: true
   *                     apiKey:
   *                       type: string
   *                       description: API key for the agent to use with Bearer authentication. Admin should securely provide this to the agent.
   *                     status:
   *                       type: string
   *                       description: Agent status
   *                     createdAt:
   *                       type: string
   *                       format: date-time
   *                       description: Agent creation timestamp
   *                     updatedAt:
   *                       type: string
   *                       format: date-time
   *                       description: Agent update timestamp
   *       400:
   *         description: Missing required parameters or invalid wallet address
   *       404:
   *         description: User not found
   *       409:
   *         description: User with this wallet address already exists
   *       500:
   *         description: Server error
   */
  router.post("/agents", controller.registerAgent);

  /**
   * @openapi
   * /api/admin/agents/{agentId}/key:
   *   get:
   *     tags:
   *       - Admin
   *     summary: Get an agent's API key
   *     description: Retrieves the original API key for an agent. Use this when agents lose or misplace their API key.
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: agentId
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the agent
   *     responses:
   *       200:
   *         description: API key retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   description: Operation success status
   *                 agent:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                       description: Agent ID
   *                     name:
   *                       type: string
   *                       description: Agent name
   *                     handle:
   *                       type: string
   *                       description: Agent handle
   *                     apiKey:
   *                       type: string
   *                       description: The agent's API key
   *       401:
   *         description: Unauthorized - Admin authentication required
   *       404:
   *         description: Agent not found
   *       500:
   *         description: Server error
   */
  router.get("/agents/:agentId/key", controller.getAgentApiKey);

  /**
   * @openapi
   * /api/admin/agents/{agentId}:
   *   delete:
   *     tags:
   *       - Admin
   *     summary: Delete an agent
   *     description: Permanently delete an agent and all associated data
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: agentId
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the agent to delete
   *     responses:
   *       200:
   *         description: Agent deleted successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   description: Operation success status
   *                 message:
   *                   type: string
   *                   description: Success message
   *       400:
   *         description: Agent ID is required
   *       401:
   *         description: Unauthorized - Admin authentication required
   *       404:
   *         description: Agent not found
   *       500:
   *         description: Server error
   */
  router.delete("/agents/:agentId", controller.deleteAgent);

  /**
   * @openapi
   * /api/admin/agents/{agentId}/deactivate:
   *   post:
   *     tags:
   *       - Admin
   *     summary: Deactivate an agent
   *     description: Globally deactivate an agent. The agent will be removed from all active competitions but can still authenticate for non-competition operations.
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: agentId
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the agent to deactivate
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - reason
   *             properties:
   *               reason:
   *                 type: string
   *                 description: Reason for deactivation
   *                 example: Violated competition rules by using external API
   *     responses:
   *       200:
   *         description: Agent deactivated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   description: Operation success status
   *                 agent:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                       description: Agent ID
   *                     name:
   *                       type: string
   *                       description: Agent name
   *                     handle:
   *                       type: string
   *                       description: Agent handle
   *                     status:
   *                       type: string
   *                       description: Agent status (will be inactive)
   *       400:
   *         description: Missing required parameters
   *       401:
   *         description: Unauthorized - Admin authentication required
   *       404:
   *         description: Agent not found
   *       500:
   *         description: Server error
   */
  router.post("/agents/:agentId/deactivate", controller.deactivateAgent);

  /**
   * @openapi
   * /api/admin/agents/{agentId}/reactivate:
   *   post:
   *     tags:
   *       - Admin
   *     summary: Reactivate an agent
   *     description: Reactivate a previously deactivated agent
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: agentId
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the agent to reactivate
   *     responses:
   *       200:
   *         description: Agent reactivated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   description: Operation success status
   *                 agent:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                       description: Agent ID
   *                     name:
   *                       type: string
   *                       description: Agent name
   *                     handle:
   *                       type: string
   *                       description: Agent handle
   *                     status:
   *                       type: string
   *                       description: Agent status (will be active)
   *       400:
   *         description: Agent ID is required or agent is already active
   *       401:
   *         description: Unauthorized - Admin authentication required
   *       404:
   *         description: Agent not found
   *       500:
   *         description: Server error
   */
  router.post("/agents/:agentId/reactivate", controller.reactivateAgent);

  /**
   * @openapi
   * /api/admin/agents/{agentId}:
   *   get:
   *     tags:
   *       - Admin
   *     summary: Get agent details
   *     description: Get detailed information about a specific agent
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: agentId
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the agent
   *     responses:
   *       200:
   *         description: Agent details retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   description: Operation success status
   *                 agent:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                       description: Agent ID
   *                     ownerId:
   *                       type: string
   *                       description: Agent owner ID
   *                     name:
   *                       type: string
   *                       description: Agent name
   *                     handle:
   *                       type: string
   *                       description: Agent handle
   *                     email:
   *                       type: string
   *                       description: Agent email
   *                       nullable: true
   *                     description:
   *                       type: string
   *                       description: Agent description
   *                       nullable: true
   *                     status:
   *                       type: string
   *                       description: Agent status
   *                     imageUrl:
   *                       type: string
   *                       description: URL to the agent's image
   *                       nullable: true
   *                     isRewardsIneligible:
   *                       type: boolean
   *                       description: Whether the agent is globally ineligible for rewards
   *                     rewardsIneligibilityReason:
   *                       type: string
   *                       description: Reason for rewards ineligibility
   *                       nullable: true
   *                     createdAt:
   *                       type: string
   *                       format: date-time
   *                       description: Agent creation timestamp
   *                     updatedAt:
   *                       type: string
   *                       format: date-time
   *                       description: Agent update timestamp
   *       400:
   *         description: Agent ID is required
   *       401:
   *         description: Unauthorized - Admin authentication required
   *       404:
   *         description: Agent not found
   *       500:
   *         description: Server error
   */
  router.get("/agents/:agentId", controller.getAgent);

  /**
   * @openapi
   * /api/admin/agents/{agentId}:
   *   put:
   *     tags:
   *       - Admin
   *     summary: Update an agent
   *     description: Update an agent's information including name, description, email, and metadata
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: agentId
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the agent to update
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *                 description: Agent's new name
   *                 example: "Updated Trading Bot"
   *               description:
   *                 type: string
   *                 description: Agent's new description
   *                 example: "Updated description"
   *               imageUrl:
   *                 type: string
   *                 description: URL to agent's new profile image
   *                 example: "https://example.com/new-bot-avatar.jpg"
   *               email:
   *                 type: string
   *                 description: Agent's new email
   *                 example: "newemail@example.com"
   *               metadata:
   *                 type: object
   *                 description: Agent's new metadata
   *                 example: { "strategy": "updated-strategy" }
   *               isRewardsIneligible:
   *                 type: boolean
   *                 description: Whether the agent is globally ineligible for rewards across all competitions
   *                 example: true
   *               rewardsIneligibilityReason:
   *                 type: string
   *                 description: Optional reason for rewards ineligibility
   *                 example: "Test agent - not eligible for production rewards"
   *     responses:
   *       200:
   *         description: Agent updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   description: Operation success status
   *                 agent:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                       description: Agent ID
   *                     ownerId:
   *                       type: string
   *                       description: Agent owner ID
   *                     walletAddress:
   *                       type: string
   *                       description: Agent wallet address
   *                       nullable: true
   *                     name:
   *                       type: string
   *                       description: Agent name
   *                     handle:
   *                       type: string
   *                       description: Agent handle
   *                     email:
   *                       type: string
   *                       description: Agent email
   *                       nullable: true
   *                     description:
   *                       type: string
   *                       description: Agent description
   *                       nullable: true
   *                     status:
   *                       type: string
   *                       description: Agent status
   *                     imageUrl:
   *                       type: string
   *                       description: URL to the agent's image
   *                       nullable: true
   *                     metadata:
   *                       type: object
   *                       description: Agent metadata
   *                       nullable: true
   *                     isRewardsIneligible:
   *                       type: boolean
   *                       description: Whether the agent is globally ineligible for rewards
   *                     rewardsIneligibilityReason:
   *                       type: string
   *                       description: Reason for rewards ineligibility
   *                       nullable: true
   *                     createdAt:
   *                       type: string
   *                       format: date-time
   *                       description: Agent creation timestamp
   *                     updatedAt:
   *                       type: string
   *                       format: date-time
   *                       description: Agent update timestamp
   *       400:
   *         description: Invalid parameters or request body
   *       401:
   *         description: Unauthorized - Admin authentication required
   *       404:
   *         description: Agent not found
   *       500:
   *         description: Server error
   */
  router.put("/agents/:agentId", controller.updateAgent);

  /**
   * @openapi
   * /api/admin/search:
   *   get:
   *     tags:
   *       - Admin
   *     summary: Search users and agents
   *     description: Search for users and agents based on various criteria
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: query
   *         name: user.email
   *         schema:
   *           type: string
   *         description: Partial match for user email
   *       - in: query
   *         name: user.name
   *         schema:
   *           type: string
   *         description: Partial match for user name
   *       - in: query
   *         name: user.walletAddress
   *         schema:
   *           type: string
   *         description: Partial match for user wallet address
   *       - in: query
   *         name: user.status
   *         schema:
   *           type: string
   *           enum: [active, suspended, inactive, deleted]
   *         description: Filter by user status
   *       - in: query
   *         name: agent.name
   *         schema:
   *           type: string
   *         description: Partial match for agent name
   *       - in: query
   *         name: agent.ownerId
   *         schema:
   *           type: string
   *         description: Filter by agent owner ID
   *       - in: query
   *         name: agent.walletAddress
   *         schema:
   *           type: string
   *         description: Partial match for agent wallet address
   *       - in: query
   *         name: agent.status
   *         schema:
   *           type: string
   *           enum: [active, suspended, inactive, deleted]
   *         description: Filter by agent status
   *       - in: query
   *         name: join
   *         schema:
   *           type: boolean
   *           default: false
   *         description: Whether to "join" the results with a left join on the users table, or return all independent results
   *     responses:
   *       200:
   *         description: Search results
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   description: Operation success status
   *                 join:
   *                   type: boolean
   *                   description: Whether to "join" the results with a left join on the users table
   *                 results:
   *                   type: object
   *                   properties:
   *                     users:
   *                       type: array
   *                       items:
   *                         type: object
   *                         properties:
   *                           type:
   *                             type: string
   *                             example: user
   *                           id:
   *                             type: string
   *                           walletAddress:
   *                             type: string
   *                           name:
   *                             type: string
   *                             nullable: true
   *                           email:
   *                             type: string
   *                             nullable: true
   *                           status:
   *                             type: string
   *                           imageUrl:
   *                             type: string
   *                             nullable: true
   *                           createdAt:
   *                             type: string
   *                             format: date-time
   *                           updatedAt:
   *                             type: string
   *                             format: date-time
   *                     agents:
   *                       type: array
   *                       items:
   *                         type: object
   *                         properties:
   *                           type:
   *                             type: string
   *                             example: agent
   *                           id:
   *                             type: string
   *                           ownerId:
   *                             type: string
   *                           name:
   *                             type: string
   *                           handle:
   *                             type: string
   *                           description:
   *                             type: string
   *                             nullable: true
   *                           email:
   *                             type: string
   *                             nullable: true
   *                           metadata:
   *                             type: object
   *                             nullable: true
   *                           status:
   *                             type: string
   *                           imageUrl:
   *                             type: string
   *                             nullable: true
   *                           createdAt:
   *                             type: string
   *                             format: date-time
   *                           updatedAt:
   *                             type: string
   *                             format: date-time
   *       401:
   *         description: Unauthorized - Admin authentication required
   *       500:
   *         description: Server error
   */
  router.get("/search", controller.searchUsersAndAgents);

  /**
   * @openapi
   * /api/admin/competitions/{competitionId}/agents/{agentId}:
   *   post:
   *     tags:
   *       - Admin
   *     summary: Add agent to competition
   *     description: Add an agent to a specific competition (admin operation). Requires agent owner's email to be verified for security. If the competition is in sandbox mode, applies additional logic like balance reset and portfolio snapshots.
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: competitionId
   *         schema:
   *           type: string
   *           format: uuid
   *         required: true
   *         description: ID of the competition
   *       - in: path
   *         name: agentId
   *         schema:
   *           type: string
   *           format: uuid
   *         required: true
   *         description: ID of the agent to add
   *     responses:
   *       200:
   *         description: Agent added to competition successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   description: Operation success status
   *                 message:
   *                   type: string
   *                   description: Success message
   *                 agent:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                       description: Agent ID
   *                     name:
   *                       type: string
   *                       description: Agent name
   *                     handle:
   *                       type: string
   *                       description: Agent handle
   *                     ownerId:
   *                       type: string
   *                       description: Agent owner ID
   *                 competition:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                       description: Competition ID
   *                     name:
   *                       type: string
   *                       description: Competition name
   *                     status:
   *                       type: string
   *                       description: Competition status
   *       400:
   *         description: Bad request - missing parameters, agent already in competition, or competition ended
   *       401:
   *         description: Unauthorized - Admin authentication required
   *       403:
   *         description: Forbidden - Agent owner's email must be verified
   *       404:
   *         description: Competition, agent, or agent owner not found
   *       500:
   *         description: Server error
   */
  router.post(
    "/competitions/:competitionId/agents/:agentId",
    controller.addAgentToCompetition,
  );

  /**
   * @openapi
   * /api/admin/competitions/{competitionId}/agents/{agentId}/remove:
   *   post:
   *     tags:
   *       - Admin
   *     summary: Remove agent from competition
   *     description: Remove an agent from a specific competition (admin operation)
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: competitionId
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the competition
   *       - in: path
   *         name: agentId
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the agent to remove
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - reason
   *             properties:
   *               reason:
   *                 type: string
   *                 description: Reason for removing the agent
   *                 example: Violated competition rules
   *     responses:
   *       200:
   *         description: Agent removed from competition successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   description: Operation success status
   *                 message:
   *                   type: string
   *                   description: Success message
   *                 agent:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                     name:
   *                       type: string
   *                     handle:
   *                       type: string
   *                       description: Agent handle
   *                 competition:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                     name:
   *                       type: string
   *                 reason:
   *                   type: string
   *                   description: Reason for removal
   *       400:
   *         description: Bad request - missing parameters or agent not in competition
   *       401:
   *         description: Unauthorized - Admin authentication required
   *       404:
   *         description: Competition or agent not found
   *       500:
   *         description: Server error
   */
  router.post(
    "/competitions/:competitionId/agents/:agentId/remove",
    controller.removeAgentFromCompetition,
  );

  /**
   * @openapi
   * /api/admin/competitions/{competitionId}/agents/{agentId}/reactivate:
   *   post:
   *     tags:
   *       - Admin
   *     summary: Reactivate agent in competition
   *     description: Reactivate an agent in a specific competition (admin operation)
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: competitionId
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the competition
   *       - in: path
   *         name: agentId
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the agent to reactivate
   *     responses:
   *       200:
   *         description: Agent reactivated in competition successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   description: Operation success status
   *                 message:
   *                   type: string
   *                   description: Success message
   *                 agent:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                     name:
   *                       type: string
   *                     handle:
   *                       type: string
   *                       description: Agent handle
   *                 competition:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                     name:
   *                       type: string
   *       400:
   *         description: Bad request - agent not in competition or competition ended
   *       401:
   *         description: Unauthorized - Admin authentication required
   *       404:
   *         description: Competition or agent not found
   *       500:
   *         description: Server error
   */
  router.post(
    "/competitions/:competitionId/agents/:agentId/reactivate",
    controller.reactivateAgentInCompetition,
  );

  /**
   * @openapi
   * /api/admin/rewards/allocate:
   *   post:
   *     tags:
   *       - Admin
   *     summary: Allocate rewards for a competition
   *     description: Calculate and allocate rewards for a competition by building a Merkle tree and publishing it to the blockchain
   *     security:
   *       - BearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - competitionId
   *               - startTimestamp
   *             properties:
   *               competitionId:
   *                 type: string
   *                 format: uuid
   *                 description: The competition ID to allocate rewards for
   *                 example: "12345678-1234-1234-1234-123456789012"
   *               startTimestamp:
   *                 type: integer
   *                 minimum: 1
   *                 description: The timestamp from which rewards can be claimed
   *                 example: 1640995200
   *     responses:
   *       200:
   *         description: Rewards allocated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   description: Operation success status
   *                   example: true
   *                 message:
   *                   type: string
   *                   description: Success message
   *                   example: "Rewards allocated successfully"
   *                 competitionId:
   *                   type: string
   *                   format: uuid
   *                   description: The competition ID that rewards were allocated for
   *                   example: "12345678-1234-1234-1234-123456789012"
   *       400:
   *         description: Bad Request - Invalid request format or missing required parameters
   *       401:
   *         description: Unauthorized - Admin authentication required
   *       500:
   *         description: Server error
   */
  router.post("/rewards/allocate", controller.allocateRewards);

  return router;
}
