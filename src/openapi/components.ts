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
      description:
        'JWT server cho mọi REST API cần đăng nhập; Firebase ID token chỉ dùng cho SDK đọc RTDB',
    },
  },
  schemas: {
    Conversation: {
      type: 'object',
      required: [
        'unreadCount',
        'unreadRecipients',
        'unreadRevision',
        'id',
        'title',
        'memberIds',
        'members',
        'createdBy',
        'createdAt',
        'updatedAt',
        'lastMessage',
        'lastMessageId',
        'lastSenderId',
      ],
      properties: {
        unreadCount: { type: 'integer', minimum: 0, description: 'Số tin chưa đọc của người gọi.' },
        unreadRecipients: {
          type: 'integer',
          minimum: 0,
          description: 'Số thành viên khác trong phòng còn tin chưa đọc.',
        },
        unreadRevision: { type: 'integer', minimum: 0, description: 'Phiên bản bộ đếm của phòng.' },
        id: { type: 'string' },
        title: { type: 'string' },
        memberIds: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 10 },
        members: { type: 'object', additionalProperties: { type: 'string' } },
        createdBy: { type: 'string' },
        createdAt: { type: 'integer' },
        updatedAt: { type: 'integer' },
        lastMessage: { type: 'string' },
        lastMessageId: { type: 'string' },
        lastSenderId: { type: 'string' },
      },
    },
    DirectConversation: {
      allOf: [
        ref('Conversation'),
        {
          type: 'object',
          properties: {
            memberIds: {
              type: 'array',
              items: { type: 'string' },
              minItems: 2,
              maxItems: 2,
              uniqueItems: true,
              description: 'Hai UID chat của ADMIN và USER trong phòng.',
            },
          },
        },
      ],
    },
    UserWithRoom: {
      title: 'Tạo USER',
      type: 'object',
      required: ['user', 'conversation'],
      properties: { user: ref('User'), conversation: ref('DirectConversation') },
    },
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
