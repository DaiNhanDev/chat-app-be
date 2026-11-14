import { chatPaths } from 'src/openapi/paths/chat.paths';
import { authPaths } from 'src/openapi/paths/auth.paths';
import { components } from 'src/openapi/components';
import { OpenAPISpec } from 'src/openapi/types';

const tagNames = ['Auth', 'Chat', 'Push'];

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
      description: 'API xác thực JWT, chat RTDB và đăng ký thiết bị Web Push FCM.',
    },
    servers,
    tags: tagNames.map((name) => ({ name })),
    paths: { ...authPaths, ...chatPaths },
    components,
  };
};
