import { components } from 'src/openapi/components';
import { authPaths } from 'src/openapi/paths/auth.paths';
import { userPaths } from 'src/openapi/paths/user.paths';
import { createChatPaths } from 'src/openapi/paths/chat.paths';
import { OpenAPISpec } from 'src/openapi/types';

export const createChatContractDocument = (servers: OpenAPISpec[]): OpenAPISpec => ({
  openapi: '3.0.3',
  info: {
    title: 'Chat và phiên đọc Firebase',
    version: '1.0.0',
    description: [
      '**Chỉ ADMIN tạo USER và phòng.** Tạo USER qua `POST /users` hoặc `POST /auth/register` đồng thời tạo phòng riêng với ADMIN gửi request. Mỗi USER có một phòng. Khi thành công, `data` có cả `user` và `conversation`.',
      '**Đã triển khai.** Custom token, tìm người, tạo/liệt kê room và gửi tin/thiết bị đều nhận JWT server. Cấu hình Firebase Admin/Rules trước khi sử dụng cloud. [Xem toàn bộ API](../).',
      'Trong hợp đồng này, FE dùng access token từ `POST /auth/login` làm Bearer cho mọi request REST. BE quản lý phòng, kiểm tra thành viên, ghi tin vào RTDB và gửi FCM sau khi lưu tin mới.',
      'FE gọi `signInWithCustomToken` để tạo phiên đọc Firebase, rồi dùng `onValue` tại `rooms/{conversationId}/messages`. Rules kiểm tra claim `chatRead` và `info/memberIds/{auth.uid}`. FCM registration token xác định thiết bị nhận push và được gửi trong body của PUT thiết bị.',
    ].join('\n\n'),
  },
  servers,
  tags: [{ name: 'Users' }, { name: 'Auth' }, { name: 'Chat' }, { name: 'Push' }],
  components,
  paths: {
    '/users': { post: userPaths['/users'].post },
    '/auth/login': authPaths['/auth/login'],
    '/auth/register': authPaths['/auth/register'],
    '/auth/firebase-token': authPaths['/auth/firebase-token'],
    ...createChatPaths(),
  },
});
