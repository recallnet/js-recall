import { RequestHandler, Router } from "express";

import { DocsController } from "@/controllers/docs.controller.js";

export function configureDocsRoutes(
  controller: DocsController,
  ...middlewares: RequestHandler[]
) {
  const router = Router();

  if (middlewares.length) {
    router.use(...middlewares);
  }

  // GET /api/docs - Serve Swagger UI
  router.use("/", controller.serveAssets);
  router.get("/", controller.getApiDocs);

  // GET /api/docs/spec - Get raw OpenAPI specification
  router.get("/spec", controller.getApiSpec);

  return router;
}
