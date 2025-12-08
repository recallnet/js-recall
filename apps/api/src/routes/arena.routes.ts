import { RequestHandler, Router } from "express";

import { ArenaController } from "@/controllers/arena.controller.js";

export function configureArenaRoutes(
  controller: ArenaController,
  ...middlewares: RequestHandler[]
) {
  const router = Router();

  if (middlewares.length) {
    router.use(...middlewares);
  }

  /**
   * @openapi
   * /api/arenas:
   *   get:
   *     tags:
   *       - Arenas
   *     summary: List all arenas
   *     description: Get paginated list of all arenas with optional name filtering
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
   *         description: Sort field and direction
   *       - in: query
   *         name: name
   *         schema:
   *           type: string
   *         description: Optional name filter
   *     responses:
   *       200:
   *         description: List of arenas
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
   *                       type: number
   *                     limit:
   *                       type: number
   *                     offset:
   *                       type: number
   *                     hasMore:
   *                       type: boolean
   *       400:
   *         description: Invalid parameters
   *       500:
   *         description: Server error
   */
  router.get("/", controller.listArenas);

  /**
   * @openapi
   * /api/arenas/{id}:
   *   get:
   *     tags:
   *       - Arenas
   *     summary: Get arena by ID
   *     description: Get detailed information about a specific arena
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Arena ID
   *     responses:
   *       200:
   *         description: Arena details
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 arena:
   *                   type: object
   *       404:
   *         description: Arena not found
   *       500:
   *         description: Server error
   */
  router.get("/:id", controller.getArena);

  return router;
}
