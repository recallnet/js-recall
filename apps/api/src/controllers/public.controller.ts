import { Request, Response, NextFunction } from 'express';
import { services } from '../services';
import { repositories } from '../database';
import { v4 as uuidv4 } from 'uuid';

/**
 * Public Controller
 * Handles public endpoints that don't require authentication
 */
export class PublicController {
  /**
   * Register a new team
   * @param req Express request
   * @param res Express response
   * @param next Express next function
   */
  static async registerTeam(req: Request, res: Response, next: NextFunction) {
    try {
      const { teamName, email, contactPerson, walletAddress, metadata } = req.body;

      // Validate required parameters
      if (!teamName || !email || !contactPerson || !walletAddress) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters: teamName, email, contactPerson, walletAddress',
        });
      }

      // First check if a team with this email already exists
      const existingTeam = await repositories.teamRepository.findByEmail(email);

      if (existingTeam) {
        const errorMessage = `A team with email ${email} already exists`;
        console.log('[PublicController] Duplicate email error:', errorMessage);
        return res.status(409).json({
          success: false,
          error: errorMessage,
        });
      }

      try {
        // Register the team with optional metadata
        const team = await services.teamManager.registerTeam(
          teamName,
          email,
          contactPerson,
          walletAddress,
          metadata,
        );

        // Format the response to include api key and metadata for the client
        return res.status(201).json({
          success: true,
          team: {
            id: team.id,
            name: team.name,
            email: team.email,
            contactPerson: team.contactPerson,
            walletAddress: team.walletAddress,
            apiKey: team.apiKey,
            metadata: team.metadata,
            createdAt: team.createdAt,
          },
        });
      } catch (error) {
        console.error('[PublicController] Error registering team:', error);

        // Check if this is a duplicate email error that somehow got here
        if (error instanceof Error && error.message.includes('email already exists')) {
          return res.status(409).json({
            success: false,
            error: error.message,
          });
        }

        // Check if this is an invalid wallet address error
        if (
          error instanceof Error &&
          (error.message.includes('Wallet address is required') ||
            error.message.includes('Invalid Ethereum address'))
        ) {
          return res.status(400).json({
            success: false,
            error: error.message,
          });
        }

        // Check if this is a duplicate wallet address error (UNIQUE constraint)
        if (
          error instanceof Error &&
          error.message.includes('duplicate key value violates unique constraint')
        ) {
          return res.status(409).json({
            success: false,
            error: 'A team with this wallet address already exists',
          });
        }

        // Handle other errors
        return res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error registering team',
        });
      }
    } catch (error) {
      console.error('[PublicController] Uncaught error in registerTeam:', error);
      next(error);
    }
  }
}
