import { operation, ref } from 'src/openapi/helpers';

export const authPaths = {
  '/auth/register': {
    post: operation('Auth', 'Đăng ký tài khoản', {
      description: 'Tạo tài khoản USER. Không nhận role từ client.',
      body: ref('RegisterInput'),
      result: { type: 'object', properties: { user: ref('UserSummary') } },
      statusCode: 201,
    }),
  },
  '/auth/login': {
    post: operation('Auth', 'Đăng nhập', {
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
  '/auth/me': {
    get: operation('Auth', 'Thông tin người dùng hiện tại', {
      auth: true,
      result: ref('User'),
    }),
  },
};
