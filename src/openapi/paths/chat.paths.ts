import { id, operation, ref, query, responses } from 'src/openapi/helpers';

const message = {
  type: 'object',
  required: ['id', 'senderId', 'text', 'createdAt'],
  properties: {
    id: { type: 'string' },
    senderId: { type: 'string', description: 'UID chat do BE quản lý' },
    text: { type: 'string' },
    createdAt: { type: 'integer', description: 'RTDB server timestamp (milliseconds)' },
    sequence: { type: 'integer', minimum: 1, description: 'Thứ tự ghi do server cấp cho tin mới.' },
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
            'JWT server. Gửi lại cùng phòng, người gửi, ID và nội dung trả 200. ID dùng cho tin khác hoặc tin đã bị xóa trả 409.',
        }),
        responses: {
          ...operation('Chat', '', { ...auth, result: savedMessage, statusCode: 201 }).responses,
          '200': {
            ...responses(savedMessage)['200'],
            description: 'Tin đã tồn tại; duplicate=true, không gửi push lại',
          },
          '404': { description: 'Không tìm thấy cuộc trò chuyện' },
          '409': {
            description:
              'IDEMPOTENCY_CONFLICT khi ID đã dùng cho tin khác. MESSAGE_DELETED khi ID thuộc tin đã xóa.',
            content: { 'application/json': { schema: ref('ErrorResponse') } },
          },
        },
      },
    },
    '/conversations/{conversationId}/messages/{messageId}': {
      delete: operation('Chat', 'Xóa tin nhắn đã gửi', {
        ...auth,
        operationId: 'deleteMessage',
        params: [id('conversationId'), id('messageId')],
        description: [
          'Dùng JWT server và message.id lấy từ dữ liệu tin nhắn. Thành viên phòng chỉ được xóa tin do mình gửi. Người gọi khác nhận 403.',
          'Trả 200 kể cả khi người gửi gọi lại với cùng ID. Tin bị gỡ khỏi nhánh messages và phần xem trước được cập nhật nếu cần. FE nhận thay đổi qua RTDB listener. Gọi GET /conversations để cập nhật phần xem trước.',
        ].join('\n\n'),
        result: {
          type: 'object',
          required: ['messageId', 'deleted'],
          properties: {
            messageId: { type: 'string', maxLength: 128 },
            deleted: { type: 'boolean', enum: [true] },
          },
        },
        notFound: 'Không tìm thấy phòng hoặc tin nhắn.',
      }),
    },
    '/conversations/{conversationId}/read': {
      put: operation('Chat', 'Đánh dấu đã đọc đến một tin nhắn', {
        ...auth,
        operationId: 'markConversationRead',
        params: [id('conversationId')],
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['throughMessageId'],
          properties: { throughMessageId: { type: 'string', maxLength: 128 } },
        },
        result: {
          type: 'object',
          required: ['conversationId', 'unreadCount', 'unreadRecipients', 'unreadRevision'],
          properties: {
            conversationId: { type: 'string' },
            unreadCount: { type: 'integer', minimum: 0 },
            unreadRecipients: { type: 'integer', minimum: 0 },
            unreadRevision: { type: 'integer', minimum: 0 },
          },
        },
        description:
          'Chỉ thành viên phòng. Ghi mốc đã đọc của tài khoản đang đăng nhập đến tin được chỉ định và giữ các tin đến sau mốc.',
        notFound: 'Không tìm thấy phòng hoặc tin nhắn.',
      }),
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
