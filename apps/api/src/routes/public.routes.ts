import { Router } from 'express';
import { PublicController } from '../controllers/public.controller';

const router = Router();

/**
 * @openapi
 * /api/public/teams/register:
 *   post:
 *     tags:
 *       - Public
 *     summary: Register a new team
 *     description: Public endpoint to register a new team. Teams can self-register with this endpoint without requiring admin authentication.
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
 *                 description: (Optional) Ethereum wallet address (must start with 0x). If not provided, one will be auto-generated.
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
 *                       description: API key for the team to use with Bearer authentication
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
router.post('/teams/register', PublicController.registerTeam);

export default router;
