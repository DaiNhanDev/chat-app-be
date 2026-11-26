import { id, operation, ref, query, responses } from 'src/openapi/helpers';

const message = {
  type: 'object',
  required: ['id', 'senderId', 'text', 'createdAt'],
  properties: {
    id: { type: 'string' },
    senderId: { type: 'string', description: 'UID chat do BE quản lý' },
    text: { type: 'string' },
    createdAt: { type: 'integer', description: 'RTDB server timestamp (milliseconds)' },
  },
};
const savedMessage = {
  type: 'object',
  required: ['message', 'duplicate'],
  properties: { message, duplicate: { type: 'boolean' } },
};

export const createChatPaths = () => {
  const auth = { auth: true };
  return {
    '/chat/people': {
      get: operation('Chat', 'Tìm thành viên theo email chính xác', {
        ...auth,
        params: [query('email', 'string', true)],
        result: {
          type: 'object',
          required: ['person'],
          properties: {
            person: {
              type: 'object',
              nullable: true,
              properties: {
                id: { type: 'string', description: 'Mongo account ID cho participantIds' },
                displayName: { type: 'string' },
              },
            },
          },
        },
      }),
    },
    '/conversations': {
      get: operation('Chat', 'ADMIN và USER lấy danh sách phòng sau khi đăng nhập', {
        ...auth,
        operationId: 'listMyConversations',
        result: {
          type: 'object',
          required: ['conversations'],
          properties: { conversations: { type: 'array', items: ref('Conversation') } },
        },
        description: [
          'Gọi khi mở hoặc tải lại màn hình chat, dùng Bearer `data.tokens.accessToken` từ `POST /auth/login`. BE xác định tài khoản từ JWT. Request không cần body hay userId.',
          'Trong `data.conversations`, ADMIN chọn một phòng mình tham gia. USER mới được cấp một phòng riêng với ADMIN tạo tài khoản. Khi chưa có phòng, API trả 200 với `data.conversations = []`.',
          'Dùng trường `id` của phòng đã chọn. Lấy `data.customToken` qua `POST /auth/firebase-token`, gọi `signInWithCustomToken` rồi lắng nghe `rooms/{id}/messages`. Gọi lại GET này để cập nhật danh sách phòng.',
        ].join('\n\n'),
      }),
      post: operation('Chat', 'ADMIN tạo hoặc mở lại phòng 1–1 với USER', {
        ...auth,
        operationId: 'openUserRoom',
        statusCode: 201,
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['participantIds'],
          properties: {
            participantIds: {
              type: 'array',
              minItems: 1,
              maxItems: 1,
              uniqueItems: true,
              items: { type: 'string', pattern: '^[a-f0-9]{24}$' },
            },
            title: { type: 'string', enum: [''], description: 'Có thể bỏ qua cho phòng 1–1.' },
          },
        },
        result: {
          type: 'object',
          required: ['conversation'],
          properties: { conversation: ref('DirectConversation') },
        },
        description:
          'Chỉ ADMIN. participantIds chứa Mongo ID của đúng một USER. Khi tạo USER, phòng đã được tạo tự động. Cùng ADMIN gọi lại sẽ nhận phòng hiện có. ADMIN có thể mở ngay data.conversation.id. Cả hai thành viên lấy lại phòng qua [GET /conversations](#/Chat/listMyConversations).',
        conflict: 'USER_ROOM_ALREADY_ASSIGNED khi USER đã có phòng khác.',
        notFound: 'Không tìm thấy tài khoản trong participantIds.',
      }),
    },
    '/conversations/{conversationId}/messages': {
      post: {
        ...operation('Chat', 'Gửi tin nhắn', {
          ...auth,
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
            'JWT server; BE xác minh tài khoản và UID chat. Retry cùng room/người gửi/ID/nội dung trả 200, không gửi push lại; khác nội dung/người gửi trả 409.',
        }),
        responses: {
          ...operation('Chat', '', { ...auth, result: savedMessage, statusCode: 201 }).responses,
          '200': {
            ...responses(savedMessage)['200'],
            description: 'Tin đã tồn tại; duplicate=true, không gửi push lại',
          },
          '404': { description: 'Không tìm thấy cuộc trò chuyện' },
          '409': { description: 'clientMessageId đã được dùng cho tin nhắn khác' },
        },
      },
    },
    '/push/devices/{deviceId}': {
      put: operation('Push', 'Đăng ký hoặc cập nhật thiết bị', {
        ...auth,
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
          'JWT server; token FCM chỉ trong body. Thiết bị thuộc duy nhất một UID chat; response không trả token.',
      }),
      delete: operation('Push', 'Gỡ thiết bị của tài khoản hiện tại', {
        ...auth,
        params: [id('deviceId')],
        result: {
          type: 'object',
          properties: { deviceId: { type: 'string' }, registered: { type: 'boolean' } },
        },
        description: 'JWT server. Idempotent; không sửa thiết bị người khác, kể cả biết deviceId.',
      }),
    },
  };
};
