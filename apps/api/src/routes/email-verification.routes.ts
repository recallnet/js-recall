import { Router } from "express";

import { EmailVerificationController } from "@/controllers/email-verification.controller.js";

export function configureEmailVerificationRoutes(
  controller: EmailVerificationController,
) {
  const router = Router();

  /**
   * @openapi
   * /api/verify-email:
   *   get:
   *     summary: Verify an email verification token
   *     description: |
   *       Verifies an email verification token sent to a user or agent's email address.
   *       This endpoint is typically accessed via a link in the verification email.
   *     tags: [Email Verification]
   *     parameters:
   *       - in: query
   *         name: token
   *         required: true
   *         schema:
   *           type: string
   *         description: The verification token from the email
   *     responses:
   *       302:
   *         description: Redirects to frontend user profile page
   *         headers:
   *           Location:
   *             schema:
   *               type: string
   *             description: URL to the frontend user profile page with query parameters
   *             example: "http://localhost:3001/profile?success=true&message=Email%20verified%20successfully%20for%20user"
   *         content:
   *           text/html:
   *             schema:
   *               type: string
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.get("/", controller.verifyEmail);

  return router;
}
