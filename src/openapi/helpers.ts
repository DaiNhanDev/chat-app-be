import { OpenAPISpec } from 'src/openapi/types';

export const ref = (name: string): OpenAPISpec => ({
  $ref: `#/components/schemas/${name}`,
});

export const requestBodyRef = (name: string): OpenAPISpec => ({
  $ref: `#/components/requestBodies/${name}`,
});

export const array = (name: string): OpenAPISpec => ({
  type: 'array',
  items: ref(name),
});

export const paginated = (
  name: string,
  additionalPaginationProperties: Record<string, OpenAPISpec> = {},
): OpenAPISpec => ({
  type: 'object',
  properties: {
    paginate: {
      type: 'object',
      properties: {
        page: { type: 'integer' },
        limit: { type: 'integer' },
        total: { type: 'integer' },
        ...additionalPaginationProperties,
      },
    },
    results: array(name),
  },
});

const body = (schema: OpenAPISpec): OpenAPISpec => ({
  required: true,
  content: { 'application/json': { schema } },
});

export const reply = (description: string, schema?: OpenAPISpec): OpenAPISpec => ({
  description,
  ...(schema ? { content: { 'application/json': { schema } } } : {}),
});

const success = (dataSchema: OpenAPISpec = {}, statusCode = 200): OpenAPISpec => ({
  type: 'object',
  required: ['success', 'statusCode', 'message', 'data'],
  properties: {
    success: { type: 'boolean', example: true },
    statusCode: { type: 'integer', example: statusCode },
    message: { type: 'string', example: 'OK' },
    data: dataSchema,
  },
});

export const responses = (dataSchema?: OpenAPISpec, statusCode = 200): OpenAPISpec => ({
  [statusCode]: reply(
    statusCode === 201 ? 'Tạo mới thành công' : 'Thành công',
    success(dataSchema, statusCode),
  ),
  '400': reply('Yêu cầu không hợp lệ', ref('ErrorResponse')),
  '422': reply('Dữ liệu không hợp lệ', ref('ErrorResponse')),
  '500': reply('Lỗi hệ thống', ref('SystemErrorResponse')),
});

export const id = (name = 'id'): OpenAPISpec => ({
  in: 'path',
  name,
  required: true,
  schema: { type: 'string' },
});

export const query = (name: string, type = 'string', required = false): OpenAPISpec => ({
  in: 'query',
  name,
  required,
  schema: { type },
});

export const operation = (
  tag: string,
  summary: string,
  options: {
    auth?: boolean;
    operationId?: string;
    conflict?: string;
    notFound?: string;
    params?: OpenAPISpec[];
    body?: OpenAPISpec;
    result?: OpenAPISpec;
    description?: string;
    statusCode?: number;
  } = {},
): OpenAPISpec => {
  const value: OpenAPISpec = {
    tags: [tag],
    summary,
    ...(options.operationId ? { operationId: options.operationId } : {}),
    ...(options.description ? { description: options.description } : {}),
    ...(options.params ? { parameters: options.params } : {}),
    ...(options.body ? { requestBody: body(options.body) } : {}),
    responses: {
      ...responses(options.result, options.statusCode),
      ...(options.notFound ? { '404': reply(options.notFound, ref('ErrorResponse')) } : {}),
      ...(options.conflict ? { '409': reply(options.conflict, ref('ErrorResponse')) } : {}),
    },
  };

  if (!options.auth) return value;

  return {
    security: [{ bearerAuth: [] }],
    ...value,
    responses: {
      ...(value.responses as OpenAPISpec),
      '401': reply('Chưa xác thực hoặc token không hợp lệ', ref('ErrorResponse')),
      '403': reply('Không có quyền truy cập', ref('ErrorResponse')),
    },
  };
};
