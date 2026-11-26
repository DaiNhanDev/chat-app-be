import { userPaths } from 'src/openapi/paths/user.paths';
import { createChatPaths } from 'src/openapi/paths/chat.paths';
import { authPaths } from 'src/openapi/paths/auth.paths';
import { components } from 'src/openapi/components';
import { OpenAPISpec } from 'src/openapi/types';

const tagNames = ['Auth', 'Users', 'Chat', 'Push'];

const toApiV1Url = (baseUrl: string): string => {
  const normalized = baseUrl.replace(/\/+$/, '');
  return normalized.endsWith('/api/v1') ? normalized : `${normalized}/api/v1`;
};

export const createSwaggerDocument = (baseUrl = ''): OpenAPISpec => {
  const servers: OpenAPISpec[] = [{ url: '/api/v1', description: 'Current origin - API v1' }];

  if (baseUrl.trim()) {
    const configuredUrl = toApiV1Url(baseUrl.trim());
    if (configuredUrl !== '/api/v1') {
      servers.push({ url: configuredUrl, description: 'Configured API v1' });
    }
  }

  return {
    openapi: '3.0.3',
    info: {
      title: 'Chat API Documentation',
      version: '1.0.0',
      description: [
        '**Chỉ ADMIN tạo USER và phòng.** `POST /users` với role USER và `POST /auth/register` tạo luôn phòng 1–1 với ADMIN đang đăng nhập. Response 201 chứa `data.user` và `data.conversation`.',
        'Mọi REST API cần đăng nhập dùng JWT server và kiểm tra lại tài khoản MongoDB. BE quản lý room, ghi tin và gửi push; FE chỉ đọc messages qua RTDB listener bằng custom-token session.',
        '**[Mở tài liệu Chat cho FE](./chat-contract/)**. Các route custom token, tìm người, tạo/liệt kê room, gửi tin và thiết bị đã được triển khai; cần cấu hình Firebase Admin và Rules cùng project.',
      ].join('\n\n'),
    },
    servers,
    tags: tagNames.map((name) => ({ name })),
    paths: { ...authPaths, ...userPaths, ...createChatPaths() },
    components,
  };
};
