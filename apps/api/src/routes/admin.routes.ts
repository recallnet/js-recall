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
   * /api/admin/teams/register:
   *   post:
   *     tags:
   *       - Admin
   *     summary: Register a new team
   *     description: Admin-only endpoint to register a new team. Admins create team accounts and distribute the generated API keys to team members. Teams cannot register themselves.
   *     security:
   *       - BearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - teamName
   *               - email
   *               - contactPerson
   *               - walletAddress
   *             properties:
   *               teamName:
   *                 type: string
   *                 description: Name of the team
   *                 example: Team Alpha
   *               email:
   *                 type: string
   *                 format: email
   *                 description: Team email address
   *                 example: team@example.com
   *               contactPerson:
   *                 type: string
   *                 description: Name of the contact person
   *                 example: John Doe
   *               walletAddress:
   *                 type: string
   *                 description: Ethereum wallet address (must start with 0x)
   *                 example: 0x1234567890123456789012345678901234567890
   *               metadata:
   *                 type: object
   *                 description: Optional metadata about the team's agent
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
   *     responses:
   *       201:
   *         description: Team registered successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   description: Operation success status
   *                 team:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                       description: Team ID
   *                     name:
   *                       type: string
   *                       description: Team name
   *                     email:
   *                       type: string
   *                       description: Team email
   *                     contactPerson:
   *                       type: string
   *                       description: Contact person name
   *                     walletAddress:
   *                       type: string
   *                       description: Ethereum wallet address
   *                     apiKey:
   *                       type: string
   *                       description: API key for the team to use with Bearer authentication. Admin should securely provide this to the team.
   *                       example: abc123def456_ghi789jkl012
   *                     metadata:
   *                       type: object
   *                       description: Optional agent metadata if provided
   *                     createdAt:
   *                       type: string
   *                       format: date-time
   *                       description: Account creation timestamp
   *       400:
   *         description: Missing required parameters or invalid wallet address
   *       409:
   *         description: Team with this email or wallet address already exists
   *       500:
   *         description: Server error
   */
  router.post("/teams/register", controller.registerTeam);

  /**
   * @openapi
   * /api/admin/teams:
   *   get:
   *     tags:
   *       - Admin
   *     summary: List all teams
   *     description: Get a list of all non-admin teams
   *     security:
   *       - BearerAuth: []
   *     responses:
   *       200:
   *         description: List of teams
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   description: Operation success status
   *                 teams:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: string
   *                         description: Team ID
   *                       name:
   *                         type: string
   *                         description: Team name
   *                       email:
   *                         type: string
   *                         description: Team email
   *                       contactPerson:
   *                         type: string
   *                         description: Contact person name
   *                       createdAt:
   *                         type: string
   *                         format: date-time
   *                         description: Account creation timestamp
   *                       updatedAt:
   *                         type: string
   *                         format: date-time
   *                         description: Account update timestamp
   *       401:
   *         description: Unauthorized - Admin authentication required
   *       500:
   *         description: Server error
   */
  router.get("/teams", controller.listAllTeams);

  /**
   * @openapi
   * /api/admin/teams/{teamId}/key:
   *   get:
   *     tags:
   *       - Admin
   *     summary: Get a team's API key
   *     description: Retrieves the original API key for a team. Use this when teams lose or misplace their API key.
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: teamId
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the team
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
   *                 team:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                       description: Team ID
   *                     name:
   *                       type: string
   *                       description: Team name
   *                     apiKey:
   *                       type: string
   *                       description: The team's API key
   *       401:
   *         description: Unauthorized - Admin authentication required
   *       403:
   *         description: Cannot retrieve API key for admin accounts
   *       404:
   *         description: Team not found
   *       500:
   *         description: Server error
   */
  router.get("/teams/:teamId/key", controller.getTeamApiKey);

  /**
   * @openapi
   * /api/admin/teams/{teamId}:
   *   delete:
   *     tags:
   *       - Admin
   *     summary: Delete a team
   *     description: Permanently delete a team and all associated data
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: teamId
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the team to delete
   *     responses:
   *       200:
   *         description: Team deleted successfully
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
   *         description: Team ID is required
   *       401:
   *         description: Unauthorized - Admin authentication required
   *       403:
   *         description: Cannot delete admin accounts
   *       404:
   *         description: Team not found
   *       500:
   *         description: Server error
   */
  router.delete("/teams/:teamId", controller.deleteTeam);

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
   *                       enum: [PENDING, ACTIVE, COMPLETED]
   *                       description: Competition status
   *                     crossChainTradingType:
   *                       type: string
   *                       enum: [disallowAll, disallowXParent, allow]
   *                       description: The type of cross-chain trading allowed in this competition
   *                     createdAt:
   *                       type: string
   *                       format: date-time
   *                       description: Competition creation date
   *       400:
   *         description: Missing required parameters
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
   *     description: Start a new or existing competition with specified teams. If competitionId is provided, it will start an existing competition. Otherwise, it will create and start a new one.
   *     security:
   *       - BearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - teamIds
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
   *               teamIds:
   *                 type: array
   *                 items:
   *                   type: string
   *                 description: Array of team IDs to include in the competition
   *               tradingType:
   *                 type: string
   *                 description: Type of cross-chain trading to allow in this competition (used when creating a new competition)
   *                 enum: [disallowAll, disallowXParent, allow]
   *                 default: disallowAll
   *                 example: disallowAll
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
   *                     status:
   *                       type: string
   *                       enum: [PENDING, ACTIVE, COMPLETED]
   *                       description: Competition status
   *                     crossChainTradingType:
   *                       type: string
   *                       enum: [disallowAll, disallowXParent, allow]
   *                       description: Type of cross-chain trading allowed in this competition
   *                     teamIds:
   *                       type: array
   *                       items:
   *                         type: string
   *                       description: Team IDs participating in the competition
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
   *                     status:
   *                       type: string
   *                       enum: [PENDING, ACTIVE, COMPLETED]
   *                       description: Competition status (completed)
   *                     crossChainTradingType:
   *                       type: string
   *                       enum: [disallowAll, disallowXParent, allow]
   *                       description: Type of cross-chain trading allowed in this competition
   *                 leaderboard:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       teamId:
   *                         type: string
   *                         description: Team ID
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
   * /api/admin/competition/{competitionId}/snapshots:
   *   get:
   *     tags:
   *       - Admin
   *     summary: Get competition snapshots
   *     description: Get portfolio snapshots for a competition, optionally filtered by team
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
   *         name: teamId
   *         schema:
   *           type: string
   *         required: false
   *         description: Optional team ID to filter snapshots
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
   *                       teamId:
   *                         type: string
   *                         description: Team ID
   *                       totalValue:
   *                         type: number
   *                         description: Total portfolio value at snapshot time
   *                       timestamp:
   *                         type: string
   *                         format: date-time
   *                         description: Snapshot timestamp
   *       400:
   *         description: Missing competitionId or team not in competition
   *       401:
   *         description: Unauthorized - Admin authentication required
   *       404:
   *         description: Competition or team not found
   *       500:
   *         description: Server error
   */
  router.get(
    "/competition/:competitionId/snapshots",
    controller.getCompetitionSnapshots,
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
   *                     status:
   *                       type: string
   *                       enum: [PENDING, ACTIVE, COMPLETED]
   *                       description: Competition status
   *                     crossChainTradingType:
   *                       type: string
   *                       enum: [disallowAll, disallowXParent, allow]
   *                       description: Type of cross-chain trading allowed in this competition
   *                 leaderboard:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       rank:
   *                         type: integer
   *                         description: Team rank on the leaderboard
   *                       teamId:
   *                         type: string
   *                         description: Team ID
   *                       teamName:
   *                         type: string
   *                         description: Team name
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
   * /api/admin/teams/{teamId}/deactivate:
   *   post:
   *     tags:
   *       - Admin
   *     summary: Deactivate a team
   *     description: Deactivate a team from the competition. The team will no longer be able to perform any actions.
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: teamId
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the team to deactivate
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
   *         description: Team deactivated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   description: Operation success status
   *                 team:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                       description: Team ID
   *                     name:
   *                       type: string
   *                       description: Team name
   *                     active:
   *                       type: boolean
   *                       description: Active status (will be false)
   *                     deactivationReason:
   *                       type: string
   *                       description: Reason for deactivation
   *                     deactivationDate:
   *                       type: string
   *                       format: date-time
   *                       description: Date of deactivation
   *       400:
   *         description: Missing required parameters
   *       401:
   *         description: Unauthorized - Admin authentication required
   *       403:
   *         description: Cannot deactivate admin accounts
   *       404:
   *         description: Team not found
   *       500:
   *         description: Server error
   */
  router.post("/teams/:teamId/deactivate", controller.deactivateTeam);

  /**
   * @openapi
   * /api/admin/teams/{teamId}/reactivate:
   *   post:
   *     tags:
   *       - Admin
   *     summary: Reactivate a team
   *     description: Reactivate a previously deactivated team, allowing them to participate in the competition again.
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: teamId
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the team to reactivate
   *     responses:
   *       200:
   *         description: Team reactivated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   description: Operation success status
   *                 team:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                       description: Team ID
   *                     name:
   *                       type: string
   *                       description: Team name
   *                     active:
   *                       type: boolean
   *                       description: Active status (will be true)
   *       400:
   *         description: Team is already active
   *       401:
   *         description: Unauthorized - Admin authentication required
   *       404:
   *         description: Team not found
   *       500:
   *         description: Server error
   */
  router.post("/teams/:teamId/reactivate", controller.reactivateTeam);

  /**
   * @openapi
   * /api/admin/teams/search:
   *   get:
   *     tags:
   *       - Admin
   *     summary: Search for teams
   *     description: Search for teams based on various criteria like email, name, wallet address, etc.
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: query
   *         name: email
   *         schema:
   *           type: string
   *         description: Partial match for team email
   *       - in: query
   *         name: name
   *         schema:
   *           type: string
   *         description: Partial match for team name
   *       - in: query
   *         name: walletAddress
   *         schema:
   *           type: string
   *         description: Partial match for wallet address
   *       - in: query
   *         name: contactPerson
   *         schema:
   *           type: string
   *         description: Partial match for contact person name
   *       - in: query
   *         name: active
   *         schema:
   *           type: boolean
   *         description: Filter by active status (true/false)
   *       - in: query
   *         name: includeAdmins
   *         schema:
   *           type: boolean
   *         description: Whether to include admin accounts in results (default is false)
   *     responses:
   *       200:
   *         description: List of teams matching search criteria
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   description: Operation success status
   *                 teams:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: string
   *                         description: Team ID
   *                       name:
   *                         type: string
   *                         description: Team name
   *                       email:
   *                         type: string
   *                         description: Team email
   *                       contactPerson:
   *                         type: string
   *                         description: Contact person name
   *                       walletAddress:
   *                         type: string
   *                         description: Ethereum wallet address
   *                       active:
   *                         type: boolean
   *                         description: Whether the team is active
   *                       deactivationReason:
   *                         type: string
   *                         nullable: true
   *                         description: Reason for deactivation if inactive
   *                       deactivationDate:
   *                         type: string
   *                         format: date-time
   *                         nullable: true
   *                         description: Date of deactivation if inactive
   *                       isAdmin:
   *                         type: boolean
   *                         description: Whether the team has admin privileges
   *                       metadata:
   *                         type: object
   *                         nullable: true
   *                         description: Optional agent metadata
   *                       createdAt:
   *                         type: string
   *                         format: date-time
   *                         description: Account creation timestamp
   *                       updatedAt:
   *                         type: string
   *                         format: date-time
   *                         description: Account update timestamp
   *       401:
   *         description: Unauthorized - Admin authentication required
   *       500:
   *         description: Server error
   */
  router.get("/teams/search", controller.searchTeams);

  return router;
}
