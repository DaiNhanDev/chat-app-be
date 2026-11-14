import { id, operation } from 'src/openapi/helpers';

const firebaseAuth = { auth: true, securityScheme: 'firebaseIdToken' };
const message = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    senderId: { type: 'string', description: 'Firebase Auth UID' },
    text: { type: 'string' },
    createdAt: { type: 'integer', description: 'RTDB server timestamp (milliseconds)' },
  },
};
const savedMessage = {
  type: 'object',
  properties: { message, duplicate: { type: 'boolean' } },
};

export const chatPaths = {
  '/conversations/{conversationId}/messages': {
    post: {
      ...operation('Chat', 'Gửi tin nhắn', {
        ...firebaseAuth,
        params: [id('conversationId')],
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['text', 'clientMessageId'],
          properties: {
            text: { type: 'string', minLength: 1, maxLength: 4000 },
            clientMessageId: { type: 'string', maxLength: 128 },
          },
        },
        result: savedMessage,
        statusCode: 201,
        description:
          'Firebase ID token, không dùng JWT của /auth/login. clientId là alias của clientMessageId. Retry cùng ID và nội dung trả 200, không gửi push lại. Cùng ID nhưng khác nội dung/người gửi trả 409.',
      }),
      responses: {
        ...operation('Chat', '', { ...firebaseAuth, result: savedMessage, statusCode: 201 })
          .responses,
        '200': {
          description:
            'Tin nhắn đã tồn tại; trả cùng bản ghi và duplicate=true, không gửi push lại',
        },
        '404': { description: 'Không tìm thấy cuộc trò chuyện' },
        '409': { description: 'clientMessageId đã được dùng cho tin nhắn khác' },
      },
    },
  },
  '/push/devices/{deviceId}': {
    put: operation('Push', 'Đăng ký hoặc cập nhật thiết bị', {
      ...firebaseAuth,
      params: [id('deviceId')],
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['token'],
        properties: { token: { type: 'string', maxLength: 4096 } },
      },
      result: {
        type: 'object',
        properties: { deviceId: { type: 'string' }, registered: { type: 'boolean' } },
      },
      description:
        'Token thuộc duy nhất một tài khoản tại một thời điểm; response không trả token.',
    }),
    delete: operation('Push', 'Gỡ thiết bị của tài khoản hiện tại', {
      ...firebaseAuth,
      params: [id('deviceId')],
      result: {
        type: 'object',
        properties: { deviceId: { type: 'string' }, registered: { type: 'boolean' } },
      },
      description:
        'Idempotent. Không sửa thiết bị của người khác, kể cả khi biết deviceId; trả cùng response để không tiết lộ quyền sở hữu.',
    }),
  },
};
