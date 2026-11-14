# Chat Backend

Backend Express + TypeScript + MongoDB, sao chép kiến trúc từ `ncjsc-staff-be` với module auth, gửi tin RTDB và Web Push FCM.

## Khởi chạy

Yêu cầu Node.js >= 22, npm và MongoDB.

```sh
npm ci
cp .env.example .env
# Cấu hình MONGODB_URI và JWT_SECRET trong .env.
npm run dev
```

Database mặc định: `mongodb://127.0.0.1:27017/chat`. Cổng mặc định: `3715`.

```sh
npm test
npm run check
npm run build
npm start
```

## Kiến trúc

```text
src/
  app.ts               # Express, middleware, database, router
  server.ts            # HTTP server và graceful shutdown
  configs/             # Environment, JWT, Firebase Admin, Swagger
  constants/           # Role, mã lỗi, thông điệp phản hồi
  controllers/         # HTTP auth, chat và thiết bị push
  db/                  # Kết nối MongoDB
  helpers/             # Tiện ích kết nối database
  middlewares/         # JWT, kiểm tra quyền, validation, lỗi, request logger
  models/              # AppSchema, User
  openapi/             # Tài liệu Auth, Chat, Push
  repositories/        # MongoDB user, RTDB chat và push registry
  routes/v1/auth/      # Router auth
  routes/swagger/      # Swagger UI và swagger.json
  services/            # Auth, lưu tin và push best-effort
  types/               # Kiểu dữ liệu dùng chung và auth
  utils/               # Mật khẩu, JWT, phản hồi, logger, repository helpers
```

Luồng xử lý: route → validation → controller → service → repository → model.
Giữ alias `src/*`, định dạng phản hồi, cấu hình lint/format và base repository của dự án nguồn.
Không sao chép `.env`, dữ liệu, lịch sử Git hay cấu hình triển khai của dự án nguồn.

## API

Base URL: `http://localhost:3715/api/v1`.

| Method | Endpoint         | Body / xác thực                       |
| ------ | ---------------- | ------------------------------------- |
| POST   | `/auth/register` | `name`, `email`, `password`, `code`   |
| POST   | `/auth/login`    | `email`, `password`                   |
| GET    | `/auth/me`       | `Authorization: Bearer <accessToken>` |

Ứng dụng chỉ hỗ trợ hai role `ADMIN` và `USER`. Đăng ký public luôn tạo `USER` và không nhận trường `role` từ client.
Role là enum `ADMIN | USER`, được lưu trực tiếp tại trường `Users.role`, mặc định `USER`. Không có model hoặc collection riêng cho role.
Tài khoản ADMIN được cấp quyền bằng cách đặt `Users.role` thành `ADMIN` trong database; không có API public tạo ADMIN.
Thông tin user trong response đăng ký, đăng nhập và `/auth/me` dùng trường `role`.
Model, đăng nhập và JWT đều kiểm tra giới hạn hai role này. Tài khoản hoặc token dùng role khác bị từ chối.
Mật khẩu đăng ký dài 8–128 ký tự. Email được chuẩn hóa thành chữ thường.
Login trả về `user` và `tokens`; access token có hạn 2 ngày, refresh token có hạn 7 ngày. Chưa có endpoint refresh hoặc logout trong dự án nguồn.

Swagger: `/docs`, `/api-docs`, `/swagger-ui`. JSON: `/docs/swagger.json`.

Ví dụ đăng ký:

```sh
curl -X POST http://localhost:3715/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Demo","email":"demo@example.com","password":"example-password","code":"DEMO001"}'
```

Response thành công: `{ success, statusCode, message, data }`.
Response lỗi: `{ success: false, statusCode, errorCode, message }`.

Production yêu cầu cấu hình `MONGODB_URI` và `JWT_SECRET`. Các tùy chọn còn lại nằm trong `.env.example`.

## Chat RTDB và Web Push FCM

Ba endpoint mới (Firebase ID token):

- `POST /api/v1/conversations/:conversationId/messages`
- `PUT /api/v1/push/devices/:deviceId`
- `DELETE /api/v1/push/devices/:deviceId`

React vẫn nghe RTDB, nhưng cần chuyển gửi tin sang Express. JWT của module auth ở trên không dùng làm Firebase UID. Cấu hình, request/response, giới hạn push, tích hợp FE và bản Rules chờ cutover được mô tả trong [docs/chat-push.md](docs/chat-push.md).
