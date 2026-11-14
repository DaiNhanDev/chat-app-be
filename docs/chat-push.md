# Chat qua Express và Web Push FCM

## Schema và danh tính đã xác minh từ workspace

Nguồn: `../chatapp/src/apis/chat.ts`, `src/apis/auth.ts`, `src/apis/endpoint.ts`, `src/models/chat.model.ts`, `src/routes/routeConfig.tsx`, `database.rules.json`.

```text
users/{firebaseUid} = { uid, email, displayName }
userConversations/{firebaseUid}/{conversationId} = true
rooms/{conversationId}/info = {
  title, memberIds: { [firebaseUid]: true }, members, memberSlots,
  createdBy, createdAt, updatedAt, lastMessage, lastMessageId, lastSenderId
}
rooms/{conversationId}/messages/{clientMessageId} = {
  senderId: firebaseUid, text, createdAt: serverTimestamp
}
_server/pushRegistry = {
  devices: { [deviceId]: { ownerUid, token, tokenHash, version } },
  tokens: { [sha256Token]: deviceId }
}
```

React vẫn nghe `userConversations`, `rooms/{id}/info`, `rooms/{id}/messages`, sắp xếp theo `createdAt` và giới hạn 100 tin. Không đổi UID, đường dẫn hoặc tạo bản sao schema chat. UI chưa có unread state nên backend không thêm unread counter. `id` trong response là key của tin, không phải field mới lưu trong RTDB.

Frontend hiện dùng **Firebase Authentication**, còn `/api/v1/auth/*` trong backend dùng JWT và MongoDB. Các endpoint chat/push mới yêu cầu **Firebase ID token**, xác minh bằng Admin `verifyIdToken(token, true)` rồi dùng trực tiếp UID. Không suy diễn mapping từ email, Mongo `_id`, `senderId` hay request body. JWT từ `/auth/login` không được dùng cho chat/push; JWT middleware vẫn phục vụ auth cũ. Không tạo hoặc đổi tài khoản giữa hai hệ thống.

## Cấu hình

```dotenv
FIREBASE_PROJECT_ID=your-existing-firebase-project
FIREBASE_DATABASE_URL=https://your-existing-db.REGION.firebasedatabase.app
# Chỉ đặt nếu host không dùng workload identity / Application Default Credentials:
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/outside-the-repo/service-account.json
PWA_BASE_URL=https://chat.example.com
PUSH_TIMEOUT_MS=5000
```

Dùng cùng project và database với `VITE_FIREBASE_*` của React. Cấp quyền Auth token verification, RTDB và FCM cho backend. Bật FCM HTTP v1 trong project và cấu hình Web Push VAPID public key cho FE. `GOOGLE_APPLICATION_CREDENTIALS` được Google SDK đọc trực tiếp; không đưa private key hay credential JSON vào source. Firebase Admin khởi tạo một lần và lazy để API JWT vẫn chạy khi chưa cấu hình Firebase. Thiếu cấu hình Firebase sẽ không cho truy cập chat/push.

`PWA_BASE_URL` phải là HTTPS origin, không chứa path, query, credentials hoặc fragment. Backend tạo link `https://chat.example.com/?conversationId=<id>` vì route chat thật hiện là `/`. **Frontend hiện chưa đọc query này**; cần bước chọn cuộc trò chuyện dưới đây để notification click mở đúng phòng. Không có endpoint nhận URL, danh sách người nhận hoặc token gửi push tùy ý.

## API và response

Base URL theo convention repo: `/api/v1`. Cả ba endpoint dùng `Authorization: Bearer <firebase-id-token>`.

### Gửi tin

```http
POST /api/v1/conversations/direct_uidA_uidB/messages
Authorization: Bearer <firebase-id-token>
Content-Type: application/json

{"clientMessageId":"a-stable-uuid","text":"Xin chào"}
```

`clientId` là alias để tương thích payload hiện tại của React. Không gửi đồng thời hai tên. Tạo ID một lần khi soạn gửi và **giữ nguyên khi retry**. ID tin là một RTDB key dài tối đa 128 ký tự; conversationId hỗ trợ RTDB key tối đa 768 bytes (bao gồm direct room ID ghép từ hai UID); không chứa `. # $ [ ] /`, ký tự điều khiển hoặc tên khóa prototype. Text được trim, dài 1–4000 ký tự. Field ngoài schema như `senderId`, `recipientIds`, `createdAt`, `role`, `url` bị từ chối.

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Success",
  "data": {
    "message": {
      "id": "a-stable-uuid",
      "senderId": "uidA",
      "text": "Xin chào",
      "createdAt": 1794661200000
    },
    "duplicate": false
  }
}
```

Retry cùng phòng, ID, người gửi và text trả **200**, cùng bản ghi/thời gian, `duplicate: true`, không gửi push lại. ID đã dùng cho nội dung hoặc người gửi khác trả **409 / IDEMPOTENCY_CONFLICT**. Chưa xác thực: 401; không phải thành viên: 403; phòng không tồn tại: 404; validation: 422. Nếu FCM lỗi hoặc timeout sau commit, API vẫn trả thành công.

### Đăng ký / cập nhật thiết bị

```http
PUT /api/v1/push/devices/<stable-browser-device-id>
Authorization: Bearer <firebase-id-token>
Content-Type: application/json

{"token":"<fcm-registration-token>"}
```

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Success",
  "data": { "deviceId": "stable-browser-device-id", "registered": true }
}
```

Một tài khoản có nhiều deviceId. Tạo deviceId ngẫu nhiên (ví dụ `crypto.randomUUID()`), lưu định danh thiết bị qua các phiên; không lưu access/ID token hay mật khẩu trong localStorage. Registration token chỉ gửi qua HTTPS và không có trong response/log. Gọi lại PUT khi FCM token đổi hoặc đăng nhập lại.

Registry dùng transaction để token có duy nhất một chủ sở hữu. Cùng token đăng ký dưới tài khoản khác sẽ chuyển quyền nhận push, bỏ liên kết cũ, kể cả deviceId thay đổi. Một người không thể thay token của deviceId người khác bằng token khác. Khi đổi tài khoản và rotate token đồng thời, DELETE khi tài khoản cũ còn đăng nhập trước, hoặc dùng deviceId mới. Push recheck ownership ngay trước dispatch. Push đã được FCM chấp nhận trước lúc đổi tài khoản có thể vẫn đến sau; ứng dụng không thể thu hồi notification đang trên đường gửi.

### Gỡ thiết bị

```http
DELETE /api/v1/push/devices/<stable-browser-device-id>
Authorization: Bearer <firebase-id-token>
```

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Success",
  "data": { "deviceId": "stable-browser-device-id", "registered": false }
}
```

DELETE idempotent, chỉ sửa registration thuộc UID đã xác thực. Thiết bị không tồn tại hoặc thuộc UID khác trả cùng response, không xóa dữ liệu của UID khác. Khi logout/tắt thông báo, **await DELETE trước Firebase signOut**, sau đó có thể dùng client `deleteToken(messaging)` để hủy token trong trình duyệt.

## Ghi nguyên tử và idempotency

Repository dùng **transaction trên `rooms/{conversationId}`**. Nó kiểm tra thành viên trong callback CAS, kiểm tra ID tin, rồi ghi tin và chỉ đổi bốn field preview. Các field khác được giữ nguyên. SDK retry callback khi có write cạnh tranh; callback không gửi FCM và không có side effect ngoài giá trị trả về. Chỉ request có commit tạo tin mới mới gọi PushService.

Đây là điều chỉnh so với đề xuất multi-location `update()`: `update()` đảm bảo các path cùng ghi hoặc cùng lỗi nhưng không có điều kiện “chỉ insert nếu ID chưa tồn tại”. Transaction gộp luôn membership, dedup, tin và preview trong một commit, tránh tách khóa idempotency khỏi lần ghi tin. Không dùng read-then-write đơn thuần. Tradeoff MVP: transaction đọc/ghi subtree phòng gồm lịch sử tin; khi lịch sử/phòng lớn cần thiết kế lưu trữ và contention khác. Nguồn: [Firebase atomic updates và transactions](https://firebase.google.com/docs/database/admin/save-data).

Registry thiết bị cũng transaction toàn bộ `_server/pushRegistry` để chuyển token và thay index cùng lúc. Đây là lựa chọn MVP cho số thiết bị nhỏ, chưa phù hợp registry lớn.

## Push best-effort

- Người nhận lấy từ `info/memberIds` của snapshot commit, chỉ nhận giá trị `true`, loại người gửi. Dedupe token, batch tối đa 500.
- Payload notification mặc định: title `Chat`, body **“Bạn có tin nhắn mới”**; data chỉ chứa conversationId/messageId, không chứa text hay tên người gửi.
- Chỉ xóa registration khi mã lỗi là `messaging/invalid-registration-token` hoặc `messaging/registration-token-not-registered`. Không xóa vì `invalid-argument`, credential, quota, network hay lỗi tạm thời. Cleanup kiểm tra version để không xóa token vừa refresh/chuyển chủ.
- API await push tối đa `PUSH_TIMEOUT_MS`, log riêng lỗi và timeout. Những thao tác SDK còn chạy được giữ trong tập pending có giới hạn 100; shutdown đợi tối đa 5 giây. Deadline chặn các batch/cleanup tiếp theo; Admin FCM request đã gửi không có cơ chế cancel tương ứng nên kết quả ở thời điểm timeout là **unknown**. Không coi timeout là giao push thành công.
- Nếu process dừng giữa commit tin và dispatch thì notification có thể bị mất. Replay không gửi lại để tránh push trùng. Không đảm bảo exactly-once delivery của FCM.
- Nếu cần retry bền vững: lưu `pushJob` trong cùng transaction ghi tin, worker claim job bằng transaction, retry có backoff và version. Phải xử lý cửa sổ FCM nhận tin nhưng worker chết trước ack. Bản này chưa thêm job/worker, queue, Redis, BullMQ, Cloud Functions hoặc WebSocket.

Nguồn: [FCM error codes](https://firebase.google.com/docs/cloud-messaging/error-codes), [Firebase ID token verification](https://firebase.google.com/docs/auth/admin/verify-id-tokens).

## Tích hợp React/Vite hiện tại

Frontend chưa được sửa trong nhiệm vụ backend này. Các thay đổi FE cần làm trong kiến trúc `apis → saga → reducer` hiện có:

1. Thêm `VITE_API_BASE_URL=https://api.example.com/api/v1`. Đưa origin FE vào `CORS_ORIGINS` của backend nếu dùng allowlist.
2. Thay phần ghi trực tiếp RTDB trong `src/apis/chat.ts::sendMessage` bằng gọi Express. Giữ `subscribeMessages`, `subscribeConversations` và cách reducer xử lý `clientId` để reconciliation vẫn hoạt động. Không gửi user từ Redux làm nguồn danh tính.

```ts
// Bên trong chatApi.sendMessage, thay block update(ref(requireDb()), ...).
const user = requireAuth().currentUser;
if (!user) throw new Error('errors.session');
const idToken = await user.getIdToken();
const response = await fetch(
  `${import.meta.env.VITE_API_BASE_URL}/conversations/${encodeURIComponent(payload.conversationId)}/messages`,
  {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientMessageId: payload.clientId, text: payload.text }),
  },
);
const result = await response.json();
if (!response.ok) throw new Error('errors.unknown');
// saga vẫn dispatch messageSent(payload.clientId); dữ liệu tin đến từ RTDB listener.
```

3. Với tab foreground: `onMessage` có thể hiển thị thông báo trong app; tránh hiển thị hai thông báo cùng lúc với RTDB listener. Chỉ hỏi Notification permission sau thao tác chủ động của người dùng. Kiểm tra `isSupported()` trước khi dùng FCM.
4. Vite PWA hiện generate `sw.js` bằng Workbox. Tích hợp Firebase Messaging vào worker đó (ví dụ chuyển sang `injectManifest` và giữ precache), rồi truyền đúng registration vào `getToken(messaging, { vapidKey, serviceWorkerRegistration })`. **Không đăng ký thêm một worker thứ hai cùng scope `/` để đè worker PWA**. Với payload có `notification`, không gọi thêm `showNotification()` trong background handler; để Firebase hiển thị mặc định. Web Push/iOS cần test trên trình duyệt/PWA thật.
5. Gọi PUT registration sau đăng nhập/token refresh; DELETE và client deleteToken trước signOut hoặc khi tắt thông báo. Chỉ lưu deviceId lâu dài; đăng ký token với UID mới khi đổi tài khoản.
6. Trong `src/modules/Chat/chat.handler.ts`, đọc `conversationId` từ query bằng `useSearchParams()`. Khi danh sách phòng đã tải và có ID này, gọi `selectConversation(id)`, rồi xóa query `conversationId` với `{ replace: true }` để những lần listener cập nhật sau không reset phòng/tin. Giữ các query khác. Nếu phải login trước, giữ URL đích qua bước AuthGuard để quay lại phòng sau đăng nhập. Không tạo route `/conversations/:id` vì router hiện chưa có.

## Rules và cutover

`docs/firebase/database.rules.after-express.json` là **bản Rules chuẩn bị cho sau cutover**, dựa trên Rules thực tế của `chatapp`. Chưa thay Rules đang dùng ở frontend, chưa deploy production.

Sau khi mọi client đã gửi tin qua Express:

1. Rà soát và thay Rules trong dự án FE bằng bản này.
2. Bản Rules giữ nguyên đọc theo thành viên, index tin, profile, `userConversations`, validation và quyền tạo cuộc trò chuyện. Chặn ghi trực tiếp message; `info` chỉ còn cho tạo mới để client không sửa preview sau khi đã tạo.
3. `_server` bị chặn read/write cho client, kể cả tài khoản đăng nhập; Admin SDK dùng quyền server. Không đặt token dưới `users` hoặc `rooms` vì các path đó cho client đọc.
4. Test Rules bằng Firebase Emulator Suite trước khi người vận hành chủ động deploy. Nhiệm vụ này không chạy deploy hoặc sửa dữ liệu production.

## Xác minh

Repo chưa có test framework; dùng `node:test` tích hợp Node, không thêm test dependency. `npm test` build TypeScript rồi chạy HTTP integration tests và service/repository tests với mock RTDB optimistic CAS, mock verifier và mock FCM. Không đọc ADC, không dùng Firebase thật, không gửi push thật hoặc ghi production. HTTP tests chỉ mở cổng ngẫu nhiên tại 127.0.0.1.

```sh
npm ci
npm test
npm run check
```

Coverage gồm thiếu/sai token, không phải thành viên, schema và metadata, request retry cạnh tranh, idempotency conflict, loại người gửi, RTDB failure, FCM failure/deadline, nhiều thiết bị, dedupe, rotation, đổi tài khoản, ownership lúc dispatch và cleanup, batch limit, URL HTTPS. Các test mock không thay thế xác minh Firebase Rules/Admin Auth/FCM trên emulator và browser thật. Chưa kiểm thử Rules bằng emulator hoặc delivery trên thiết bị thật trong bước này.
