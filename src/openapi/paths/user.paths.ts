import { ROLE } from 'src/constants';
import { id, operation, paginated, query, ref } from 'src/openapi/helpers';

const userProperties = {
  name: { type: 'string', minLength: 1, maxLength: 150 },
  email: { type: 'string', format: 'email' },
  password: { type: 'string', format: 'password', minLength: 8, maxLength: 128, writeOnly: true },
  code: { type: 'string', minLength: 1, maxLength: 50 },
  role: { type: 'string', enum: Object.values(ROLE) },
};
const userResult = { type: 'object', properties: { user: ref('User') } };
const admin = {
  auth: true,
  description: 'Chỉ ADMIN. Quyền được kiểm tra lại từ database ở mỗi request. Không trả mật khẩu.',
};

export const userPaths = {
  '/users/admin': {
    post: operation('Users', 'Tạo tài khoản ADMIN', {
      ...admin,
      description: 'Chỉ ADMIN. Backend luôn gán role ADMIN; request không nhận trường role.',
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'email', 'password', 'code'],
        properties: {
          name: userProperties.name,
          email: userProperties.email,
          password: userProperties.password,
          code: userProperties.code,
        },
      },
      result: userResult,
      statusCode: 201,
    }),
  },
  '/users': {
    post: operation('Users', 'ADMIN tạo tài khoản (USER được tạo phòng 1–1)', {
      ...admin,
      operationId: 'createManagedUser',
      description:
        'ADMIN tạo USER sẽ nhận user và phòng 1–1 với chính ADMIN đó. Dùng data.conversation.id để mở ngay phòng mới. Sau khi đăng nhập, cả ADMIN và USER lấy phòng qua [GET /conversations](#/Chat/listMyConversations). Khi tạo ADMIN, response chỉ có user.',
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'email', 'password', 'code'],
        properties: {
          ...userProperties,
          role: { ...userProperties.role, default: ROLE.USER },
        },
      },
      result: {
        oneOf: [
          ref('UserWithRoom'),
          { ...userResult, title: 'Tạo ADMIN', required: ['user'], additionalProperties: false },
        ],
      },
      conflict: 'Email hoặc code đã được sử dụng.',
      statusCode: 201,
    }),
    get: operation('Users', 'Danh sách tài khoản', {
      ...admin,
      params: [query('page', 'integer'), query('limit', 'integer'), query('search'), query('role')],
      result: paginated('User', { totalPages: { type: 'integer' } }),
    }),
  },
  '/users/{id}': {
    get: operation('Users', 'Chi tiết tài khoản', { ...admin, params: [id()], result: userResult }),
    patch: operation('Users', 'Cập nhật tài khoản', {
      ...admin,
      params: [id()],
      body: {
        type: 'object',
        minProperties: 1,
        additionalProperties: false,
        properties: userProperties,
      },
      result: userResult,
      description:
        'Chỉ ADMIN. PATCH nhận các field cần sửa. Server băm mật khẩu mới và chặn ADMIN tự hạ quyền.',
    }),
    delete: operation('Users', 'Xóa tài khoản cùng các phòng chat liên quan', {
      ...admin,
      operationId: 'deleteUserAndRooms',
      params: [id()],
      result: {
        type: 'object',
        properties: { id: { type: 'string' }, deleted: { type: 'boolean' } },
      },
      description:
        'Chỉ ADMIN. Xóa vĩnh viễn tài khoản, phòng mà tài khoản là thành viên, tin nhắn trong phòng và mục phòng trong danh sách của mọi thành viên. ADMIN không thể tự xóa. Nếu lần xóa trước bị gián đoạn, gọi lại cùng ID để tiếp tục.',
      notFound: 'Không tìm thấy tài khoản.',
    }),
  },
};
