import { operation, ref } from 'src/openapi/helpers';

export const authPaths = {
  '/auth/register-admin': {
    post: {
      ...operation('Auth', 'Đăng ký ADMIN đầu tiên', {
        body: ref('RegisterInput'),
        statusCode: 201,
        result: { type: 'object', properties: { user: ref('User') } },
        description:
          'Không cần JWT. Chỉ tạo ADMIN đầu tiên khi chưa có ADMIN hoặc bản ghi bootstrap. Role do server gán ADMIN. Các ADMIN tiếp theo dùng POST /users/admin với JWT ADMIN.',
      }),
      responses: {
        ...operation('Auth', '', {
          statusCode: 201,
          result: { type: 'object', properties: { user: ref('User') } },
        }).responses,
        '409': {
          description:
            'Đã có ADMIN/bản ghi bootstrap (INITIAL_ADMIN_ALREADY_EXISTS), hoặc email/code trùng',
          content: { 'application/json': { schema: ref('ErrorResponse') } },
        },
      },
    },
  },
  '/auth/register': {
    post: operation('Auth', 'ADMIN tạo USER và phòng 1–1', {
      auth: true,
      operationId: 'registerUserWithRoom',
      description:
        'JWT của ADMIN đang hoạt động. Tạo USER và phòng với ADMIN gửi request. Gửi lại cùng dữ liệu nếu tạo phòng bị gián đoạn.',
      body: ref('RegisterInput'),
      result: ref('UserWithRoom'),
      conflict: 'Email hoặc code đã được sử dụng.',
      statusCode: 201,
    }),
  },
  '/auth/login': {
    post: operation('Auth', 'Đăng nhập', {
      description:
        'Access token và refresh token của server có hiệu lực 365 ngày kể từ lúc cấp. Response đặt cookie HttpOnly, SameSite=Lax (mặc định), Secure khi HTTPS/production, hết hạn cùng access token; FE gửi credentials: include. Dùng data.tokens.accessToken để gọi [GET /conversations](#/Chat/listMyConversations) và lấy phòng của ADMIN hoặc USER hiện tại.',
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', format: 'password' },
        },
      },
      result: {
        type: 'object',
        properties: { user: ref('User'), tokens: ref('TokenPair') },
      },
    }),
  },
  '/auth/session': {
    get: operation('Auth', 'Khôi phục đăng nhập bằng cookie HttpOnly', {
      description:
        'Gửi cookie chatapp_session bằng credentials: include. Kiểm tra chữ ký/hạn access token và tài khoản hiện tại; trả user và tokens.accessToken để FE giữ trong bộ nhớ. Không kéo dài hạn token. Chỉ cho phép origin tin cậy.',
      result: {
        type: 'object',
        properties: {
          user: ref('User'),
          tokens: {
            type: 'object',
            properties: { accessToken: { type: 'string' } },
          },
        },
      },
    }),
  },
  '/auth/logout': {
    post: operation('Auth', 'Xóa cookie đăng nhập của trình duyệt', {
      description:
        'Gửi credentials: include, không cần Bearer. Xóa cookie với cùng path/flags, không thu hồi JWT đã sao chép hoặc phiên Firebase. Chỉ cho phép origin tin cậy.',
      result: {
        type: 'object',
        properties: { loggedOut: { type: 'boolean' } },
      },
    }),
  },
  '/auth/firebase-token': {
    post: operation('Auth', 'Cấp phiên chỉ đọc Firebase', {
      auth: true,
      description:
        'JWT server. Kiểm tra lại tài khoản đang hoạt động, trả custom token có chatRead=true và UID do BE quản lý. Không nhận UID từ body; response no-store.',
      result: {
        type: 'object',
        required: ['customToken'],
        properties: { customToken: { type: 'string' } },
      },
    }),
  },
  '/auth/me': {
    get: operation('Auth', 'Thông tin người dùng hiện tại', {
      auth: true,
      result: ref('User'),
    }),
  },
};
