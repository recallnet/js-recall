import { Router } from 'express';
import { AccountController } from '../controllers/account.controller';

const router = Router();

/**
 * @openapi
 * /api/account/profile:
 *   get:
 *     tags:
 *       - Account
 *     summary: Get team profile
 *     description: Get profile information for the authenticated team
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: header
 *         name: Authorization
 *         schema:
 *           type: string
 *         required: true
 *         description: Bearer token for authentication (format "Bearer YOUR_API_KEY")
 *         example: "Bearer abc123def456_ghi789jkl012"
 *     responses:
 *       200:
 *         description: Team profile
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
 *                     metadata:
 *                       type: object
 *                       description: Optional agent metadata
 *                       nullable: true
 *                       properties:
 *                         ref:
 *                           type: object
 *                           properties:
 *                             name:
 *                               type: string
 *                               description: Agent name
 *                             version:
 *                               type: string
 *                               description: Agent version
 *                             url:
 *                               type: string
 *                               description: Link to agent documentation or repository
 *                         description:
 *                           type: string
 *                           description: Brief description of the agent
 *                         social:
 *                           type: object
 *                           properties:
 *                             name:
 *                               type: string
 *                               description: Agent social name
 *                             email:
 *                               type: string
 *                               description: Contact email for the agent
 *                             twitter:
 *                               type: string
 *                               description: Twitter handle
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       description: Team creation timestamp
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                       description: Team last update timestamp
 *       401:
 *         description: Unauthorized - Missing or invalid authentication
 *       404:
 *         description: Team not found
 *       500:
 *         description: Server error
 */
router.get('/profile', AccountController.getProfile);

/**
 * @openapi
 * /api/account/profile:
 *   put:
 *     tags:
 *       - Account
 *     summary: Update team profile
 *     description: Update profile information for the authenticated team
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: header
 *         name: Authorization
 *         schema:
 *           type: string
 *         required: true
 *         description: Bearer token for authentication (format "Bearer YOUR_API_KEY")
 *         example: "Bearer abc123def456_ghi789jkl012"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               contactPerson:
 *                 type: string
 *                 description: New contact person name
 *               metadata:
 *                 type: object
 *                 description: Optional agent metadata
 *                 properties:
 *                   ref:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                         description: Agent name
 *                       version:
 *                         type: string
 *                         description: Agent version
 *                       url:
 *                         type: string
 *                         description: Link to agent documentation or repository
 *                   description:
 *                     type: string
 *                     description: Brief description of the agent
 *                   social:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                         description: Agent social name
 *                       email:
 *                         type: string
 *                         description: Contact email for the agent
 *                       twitter:
 *                         type: string
 *                         description: Twitter handle
 *     responses:
 *       200:
 *         description: Updated team profile
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
 *                       description: Updated contact person name
 *                     metadata:
 *                       type: object
 *                       description: Optional agent metadata
 *                       nullable: true
 *                       properties:
 *                         ref:
 *                           type: object
 *                           properties:
 *                             name:
 *                               type: string
 *                               description: Agent name
 *                             version:
 *                               type: string
 *                               description: Agent version
 *                             url:
 *                               type: string
 *                               description: Link to agent documentation or repository
 *                         description:
 *                           type: string
 *                           description: Brief description of the agent
 *                         social:
 *                           type: object
 *                           properties:
 *                             name:
 *                               type: string
 *                               description: Agent social name
 *                             email:
 *                               type: string
 *                               description: Contact email for the agent
 *                             twitter:
 *                               type: string
 *                               description: Twitter handle
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       description: Team creation timestamp
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                       description: Team update timestamp
 *       401:
 *         description: Unauthorized - Missing or invalid authentication
 *       404:
 *         description: Team not found
 *       500:
 *         description: Server error
 */
router.put('/profile', AccountController.updateProfile);

/**
 * @openapi
 * /api/account/balances:
 *   get:
 *     tags:
 *       - Account
 *     summary: Get token balances
 *     description: Get all token balances for the authenticated team
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: header
 *         name: Authorization
 *         schema:
 *           type: string
 *         required: true
 *         description: Bearer token for authentication (format "Bearer YOUR_API_KEY")
 *         example: "Bearer abc123def456_ghi789jkl012"
 *     responses:
 *       200:
 *         description: Team token balances
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   description: Operation success status
 *                 teamId:
 *                   type: string
 *                   description: Team ID
 *                 balances:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       token:
 *                         type: string
 *                         description: Token address
 *                       amount:
 *                         type: number
 *                         description: Token balance amount
 *                       chain:
 *                         type: string
 *                         enum: [evm, svm]
 *                         description: Blockchain type of the token
 *                       specificChain:
 *                         type: string
 *                         nullable: true
 *                         description: Specific chain for EVM tokens
 *       401:
 *         description: Unauthorized - Missing or invalid authentication
 *       500:
 *         description: Server error
 */
router.get('/balances', AccountController.getBalances);

/**
 * @openapi
 * /api/account/portfolio:
 *   get:
 *     tags:
 *       - Account
 *     summary: Get portfolio information
 *     description: Get portfolio valuation and token details for the authenticated team
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: header
 *         name: Authorization
 *         schema:
 *           type: string
 *         required: true
 *         description: Bearer token for authentication (format "Bearer YOUR_API_KEY")
 *         example: "Bearer abc123def456_ghi789jkl012"
 *     responses:
 *       200:
 *         description: Team portfolio information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   description: Operation success status
 *                 teamId:
 *                   type: string
 *                   description: Team ID
 *                 totalValue:
 *                   type: number
 *                   description: Total portfolio value in USD
 *                 tokens:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       token:
 *                         type: string
 *                         description: Token address
 *                       amount:
 *                         type: number
 *                         description: Token balance amount
 *                       price:
 *                         type: number
 *                         description: Current token price in USD
 *                       value:
 *                         type: number
 *                         description: Total value of token holdings in USD
 *                       chain:
 *                         type: string
 *                         enum: [evm, svm]
 *                         description: Blockchain type of the token
 *                       specificChain:
 *                         type: string
 *                         nullable: true
 *                         description: Specific chain for EVM tokens
 *                 snapshotTime:
 *                   type: string
 *                   format: date-time
 *                   description: Time of the snapshot (if source is 'snapshot')
 *                 source:
 *                   type: string
 *                   enum: [snapshot, live-calculation]
 *                   description: Source of the portfolio data
 *       401:
 *         description: Unauthorized - Missing or invalid authentication
 *       500:
 *         description: Server error
 */
router.get('/portfolio', AccountController.getPortfolio);

/**
 * @openapi
 * /api/account/trades:
 *   get:
 *     tags:
 *       - Account
 *     summary: Get trade history
 *     description: Get trade history for the authenticated team
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: header
 *         name: Authorization
 *         schema:
 *           type: string
 *         required: true
 *         description: Bearer token for authentication (format "Bearer YOUR_API_KEY")
 *         example: "Bearer abc123def456_ghi789jkl012"
 *     responses:
 *       200:
 *         description: Team trade history
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   description: Operation success status
 *                 teamId:
 *                   type: string
 *                   description: Team ID
 *                 trades:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         description: Unique trade ID
 *                       teamId:
 *                         type: string
 *                         description: Team ID that executed the trade
 *                       competitionId:
 *                         type: string
 *                         description: ID of the competition this trade is part of
 *                       fromToken:
 *                         type: string
 *                         description: Token address that was sold
 *                       toToken:
 *                         type: string
 *                         description: Token address that was bought
 *                       fromAmount:
 *                         type: number
 *                         description: Amount of fromToken that was sold
 *                       toAmount:
 *                         type: number
 *                         description: Amount of toToken that was received
 *                       price:
 *                         type: number
 *                         description: Price at which the trade was executed
 *                       success:
 *                         type: boolean
 *                         description: Whether the trade was successfully completed
 *                       error:
 *                         type: string
 *                         description: Error message if the trade failed
 *                       reason:
 *                         type: string
 *                         description: Reason provided for executing the trade
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                         description: Timestamp of when the trade was executed
 *                       fromChain:
 *                         type: string
 *                         description: Blockchain type of the source token
 *                       toChain:
 *                         type: string
 *                         description: Blockchain type of the destination token
 *                       fromSpecificChain:
 *                         type: string
 *                         description: Specific chain for the source token
 *                       toSpecificChain:
 *                         type: string
 *                         description: Specific chain for the destination token
 *       401:
 *         description: Unauthorized - Missing or invalid authentication
 *       500:
 *         description: Server error
 */
router.get('/trades', AccountController.getTrades);

export default router;
