import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import swaggerJSDocs from 'swagger-jsdoc';
import { swaggerOption } from 'src/configs/swagger.config';
import { createChatContractDocument } from 'src/openapi/chat-contract.document';

const swaggerSpec = swaggerJSDocs(swaggerOption);

const swaggerUiOptions: swaggerUi.SwaggerUiOptions = {
  explorer: true,
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    docExpansion: 'none',
    filter: true,
    tryItOutEnabled: true,
    showCommonExtensions: true,
  },
  customSiteTitle: 'Chat API Documentation',
};

const createDocsRouter = (spec: swaggerUi.JsonObject, options: swaggerUi.SwaggerUiOptions) => {
  const router = Router();
  router.get('/swagger.json', (_req, res) => res.json(spec));
  router.use(swaggerUi.serveFiles(spec, options), swaggerUi.setup(spec, options));
  return router;
};

const docsRouter = Router();
docsRouter.use(
  '/chat-contract',
  createDocsRouter(createChatContractDocument(swaggerOption.definition.servers), {
    customSiteTitle: 'Chat và phiên đọc Firebase',
    swaggerOptions: { docExpansion: 'list', filter: true, supportedSubmitMethods: [] },
  }),
);
docsRouter.use(createDocsRouter(swaggerSpec, swaggerUiOptions));

export default docsRouter;
