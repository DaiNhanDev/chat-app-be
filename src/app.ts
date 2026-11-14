import express, { Express, urlencoded } from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cors, { CorsOptions } from 'cors';

import Database from 'src/db/init';
import appRouter from 'src/routes';
import docsRouter from 'src/routes/swagger';
import { errorHandler, notFoundErrorHandler } from 'src/middlewares/error';
import { requestLogger } from 'src/middlewares/requestLogger';
import { logger } from 'src/utils/logger';
import { env } from 'src/configs/env.config';

const app: Express = express();
app.set('port', env.port);
app.set('trust proxy', env.trustProxy);
logger.info('Application configuration loaded', { environment: env.nodeEnv, port: env.port });

// Configure allowed origins.
const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    const allowed = !origin || env.corsOrigins.includes('*') || env.corsOrigins.includes(origin);
    callback(allowed ? null : new Error('Origin is not allowed by CORS'), allowed);
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Accept',
    'Origin',
    'X-Requested-With',
    'x-client-id',
    'x-api-key',
    'x-rtoken-id',
    'refreshToken',
    'Range',
  ],
  exposedHeaders: ['Content-Range', 'X-Content-Range', 'Authorization'],
  maxAge: env.corsMaxAge,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(requestLogger);

app.use(compression());
app.use(express.json({ limit: env.bodyLimit }));
app.use(
  urlencoded({
    extended: true,
    limit: env.bodyLimit,
  }),
);
// connect Database
Database.getInstance();

// Swagger Documentation UI
app.use('/swagger-ui', docsRouter);
app.use('/api-docs', docsRouter);
app.use('/docs', docsRouter);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);
app.use('/api/v1', appRouter);

// handle error
app.use(notFoundErrorHandler);
app.use(errorHandler);

export { app };
