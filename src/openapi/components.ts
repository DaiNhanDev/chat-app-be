import { ROLE } from 'src/constants';
import { ref } from 'src/openapi/helpers';

const userSummary = {
  type: 'object',
  properties: {
    _id: { type: 'string' },
    name: { type: 'string' },
    email: { type: 'string', format: 'email' },
    role: { type: 'string', enum: Object.values(ROLE) },
  },
};

export const components = {
  securitySchemes: {
    bearerAuth: {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'JWT cho /auth/me',
    },
    firebaseIdToken: {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'Firebase ID token',
      description: 'Firebase Auth ID token cho Chat và Push; giữ nguyên Firebase UID của frontend',
    },
  },
  schemas: {
    ErrorResponse: {
      type: 'object',
      required: ['success', 'statusCode', 'errorCode', 'message'],
      properties: {
        success: { type: 'boolean', example: false },
        statusCode: { type: 'integer', example: 400 },
        errorCode: { type: 'string', example: 'BAD_REQUEST' },
        message: { type: 'string' },
      },
    },
    SystemErrorResponse: {
      allOf: [
        ref('ErrorResponse'),
        {
          properties: {
            statusCode: { type: 'integer', example: 500 },
            errorCode: { type: 'string', example: 'INTERNAL_SERVER_ERROR' },
            message: { type: 'string', example: 'Internal Server Error' },
          },
        },
      ],
    },
    RegisterInput: {
      type: 'object',
      additionalProperties: false,
      required: ['email', 'password', 'name', 'code'],
      properties: {
        email: { type: 'string', format: 'email' },
        password: { type: 'string', format: 'password', minLength: 8, maxLength: 128 },
        name: { type: 'string', maxLength: 150 },
        code: { type: 'string', maxLength: 50 },
      },
    },
    UserSummary: userSummary,
    User: {
      ...userSummary,
      properties: {
        ...userSummary.properties,
        code: { type: 'string' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
        deletedAt: { type: 'string', format: 'date-time', nullable: true },
      },
    },
    TokenPair: {
      type: 'object',
      properties: {
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' },
      },
    },
  },
};
