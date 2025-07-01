import { RequestHandler, Router } from "express";

import { AdminController } from "@/controllers/admin.controller.js";

export function configureAdminSetupRoutes(
  controller: AdminController,
  ...middlewares: RequestHandler[]
) {
  const router = Router();

  if (middlewares.length) {
    router.use(...middlewares);
  }

  /**
   * @openapi
   * /api/admin/setup:
   *   post:
   *     tags:
   *       - Admin
   *     summary: Set up initial admin account
   *     description: Creates the first admin account. This endpoint is only available when no admin exists in the system.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [username, password, email]
   *             properties:
   *               username:
   *                 type: string
   *                 description: Admin username
   *                 example: admin
   *               password:
   *                 type: string
   *                 minLength: 8
   *                 description: Admin password (minimum 8 characters)
   *                 format: password
   *                 example: password123
   *               email:
   *                 type: string
   *                 format: email
   *                 description: Admin email address
   *                 example: admin@example.com
   *     responses:
   *       201:
   *         description: Admin account created successfully
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/SuccessResponse'
   *                 - type: object
   *                   required: [message, admin]
   *                   properties:
   *                     message:
   *                       type: string
   *                       description: Success message
   *                     admin:
   *                       type: object
   *                       required: [id, username, email, createdAt]
   *                       properties:
   *                         id:
   *                           type: string
   *                           format: uuid
   *                           description: Admin ID
   *                         username:
   *                           type: string
   *                           description: Admin username
   *                         email:
   *                           type: string
   *                           format: email
   *                           description: Admin email
   *                         createdAt:
   *                           type: string
   *                           format: date-time
   *                           description: Account creation timestamp
   *       400:
   *         description: Missing required parameters or password too short
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       403:
   *         description: Admin setup not allowed - an admin account already exists
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.post("/", controller.setupAdmin);

  return router;
}
