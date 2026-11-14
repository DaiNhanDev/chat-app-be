import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import swaggerJSDocs from 'swagger-jsdoc';
import { swaggerOption } from 'src/configs/swagger.config';

const swaggerSpec = swaggerJSDocs(swaggerOption);
const docsRouter = Router();

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

docsRouter.get('/swagger.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

docsRouter.use(
  '/',
  ...(swaggerUi.serve as any[]),
  swaggerUi.setup(swaggerSpec, swaggerUiOptions) as any,
);

export default docsRouter;
