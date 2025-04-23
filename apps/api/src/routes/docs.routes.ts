import { Router } from 'express';
import { DocsController } from '../controllers/docs.controller';

const router = Router();

// GET /api/docs - Serve Swagger UI
router.use('/', DocsController.serveAssets);
router.get('/', DocsController.getApiDocs);

// GET /api/docs/spec - Get raw OpenAPI specification
router.get('/spec', DocsController.getApiSpec);

export default router;
