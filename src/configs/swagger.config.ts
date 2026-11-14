import { SwaggerOptions } from 'swagger-ui-express';
import { env } from 'src/configs/env.config';
import { createSwaggerDocument } from 'src/openapi/swagger.document';
import { logger } from 'src/utils/logger';

const baseUrl = env.swaggerServer || env.publicUrl;

logger.debug('Swagger configured', { baseUrl: baseUrl || 'current origin' });

const swaggerOption: SwaggerOptions = {
  definition: createSwaggerDocument(baseUrl),
  apis: [],
};

export { swaggerOption };
