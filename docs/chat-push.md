# Chat, room và push cho Chatapp

Luồng: REST dùng JWT server → kiểm tra lại tài khoản MongoDB → UID chat do BE quản lý → Admin SDK ghi RTDB/FCM. FE chỉ đọc tin qua RTDB listener bằng custom-token session.

Contract và cấu hình nằm tại [README](../README.md#tích-hợp-chat-notification-và-pwa), được công bố trong Swagger. Routes mới: POST auth/firebase-token, GET chat/people, POST/GET conversations. POST messages và PUT/DELETE devices đã chuyển sang JWT server; không còn dùng Firebase ID token ở REST.

## Room và danh tính

Khi ADMIN tạo USER, BE tạo luôn phòng 1–1 giữa hai tài khoản. `POST /conversations` chỉ dành cho ADMIN và nhận đúng một Mongo account ID của USER trong `participantIds`. Xin lại cùng phòng trả về metadata hiện có. Xin tạo với USER đã thuộc phòng khác trả `409 USER_ROOM_ALREADY_ASSIGNED`.

Phòng mới có ID xác định theo Mongo ID của USER, nên hai ADMIN tạo đồng thời cạnh tranh trên cùng bản ghi RTDB. Phòng cũ đã có đúng hai thành viên được giữ nguyên ID và lịch sử khi mở lại. Tài khoản cũ đã có nhiều phòng cần xử lý riêng.

GET conversations chỉ tải index của actor và metadata phòng actor thực sự là thành viên. Không đọc/trả messages. GET people chỉ tìm exact email và trả id/name, không trả mật khẩu/role/email danh bạ rộng.

firebaseUid là mapping private do quản trị viên migration gán, unique sparse, không nhận từ public forms/API. Không tự liên kết theo email. Mọi mapping phải tránh UID mặc định của account khác.

## Gửi tin và response

POST conversations/:id/messages nhận `{ clientMessageId, text }`. Text trim 1–4000 ký tự, ID tối đa 128 ký tự và là RTDB key hợp lệ. Transaction kiểm tra room/membership, chỉ thêm tin chưa có, cập nhật preview trong cùng commit. Response `{ message: { id, senderId, text, createdAt }, duplicate }`, 201 mới/200 retry; 409 khi ID dùng cho nội dung/người gửi khác.

`DELETE /conversations/{conversationId}/messages/{messageId}` dùng JWT server và chỉ dành cho người gửi còn là thành viên phòng. Backend gỡ tin khỏi nhánh `messages` và cập nhật preview trong cùng transaction. Gọi lại DELETE bằng chính người gửi trả `200` với `{ messageId, deleted: true }`. POST lại ID đã xóa trả `409 MESSAGE_DELETED`. RTDB listener nhận danh sách tin sau khi xóa. FE gọi lại `GET /conversations` nếu cần làm mới preview.

`GET /conversations` trả `unreadCount` theo từng phòng của người gọi. Khi người dùng đang xem cuối phòng ở tab hiển thị, FE lấy tin có `sequence` cao nhất đã nhận và gửi ID đó trong `throughMessageId` tới `PUT /conversations/{conversationId}/read`. BE ghi mốc đọc bằng JWT và giữ nguyên số tin đến sau mốc. Các tin có từ trước khi có trường `sequence` vẫn hiển thị trong lịch sử. Bộ đếm chỉ tính tin được gửi sau khi bật tính năng.

Tin commit trước push. Lỗi FCM không rollback tin hoặc đổi kết quả gửi thành thất bại. Retry duplicate không gửi push lại. UI ghép theo message ID, giữ draft/ID khi kết quả chưa chắc chắn. Chi tiết transaction và push registry được giữ tại repositories/chat.repository.ts, push-device.repository.ts và services/push.service.ts.

## Quyền truy cập RTDB

BE cấp custom token có chatRead=true, UID phải khớp memberIds/senderId. FE dùng inMemoryPersistence rồi listener tại rooms/:id/messages, createdAt/limitToLast 100. Unsubscribe khi đổi room, mất quyền hoặc logout; PERMISSION_DENIED xóa tin và lấy lại danh sách từ BE.

Rules mục tiêu trong ../chatapp/database.rules.json deny mọi ghi client, chỉ cho thành viên có claim đọc messages. Admin SDK bỏ qua Rules nên quyền ghi được kiểm tra tại BE. Chưa tự deploy Rules. Client cũ còn ghi trực tiếp phải được chuyển đổi trước khi deploy.

## Push và PWA

PUT push/devices/:id nhận FCM registration token trong body, JWT server trong header; DELETE không body. Ownership registry dùng UID chat đã ánh xạ, không tin UID client gửi. Response chỉ có deviceId/registered, không trả token.

FCM SDK ở FE hỏi quyền chủ động, dùng một worker sw.js. Nội dung thông báo hiển thị tổng số tin chưa đọc của người nhận ở thời điểm BE gửi, kể cả khi tab đang ở nền hoặc đã đóng. Worker dùng `data.unreadCount` cho huy hiệu trên biểu tượng PWA khi nền tảng hỗ trợ. Thông báo cho ADMIN còn kèm số USER đang có tin chưa đọc trong phòng 1–1. Hai số phản ánh trạng thái tại lúc gửi push. Số trên biểu tượng được cập nhật ở lần nhận push hoặc đồng bộ tiếp theo. Click thông báo về cùng origin /?conversationId=…. AuthGuard giữ room qua login và FE gắn listener sau khi xác minh room từ BE.

Cấu hình FIREBASE_PROJECT_ID, FIREBASE_DATABASE_URL, GOOGLE_APPLICATION_CREDENTIALS/ADC và PWA_BASE_URL tại BE; Web App/VAPID ở FE cùng project. Không để service account hoặc JWT vào source/VITE_*.

## Kiểm tra

Không viết/sửa unit test. Typecheck, lint, build và integration bằng MongoDB riêng + Firebase Auth/RTDB Emulator thật đã đạt: cấp phiên, mapping UID, tạo/mở room, membership, listener nhận BE write, idempotency, từ chối ghi client và device REST. Kiểm tra cloud/FCM và Rules rollout cần được ghi riêng với kết quả môi trường thật.

## Xác minh cloud sau tích hợp

UI đã chat bằng BE và Firebase thật, không dùng API/SDK mock. Custom token ký trực tiếp bằng cert(file) từ credentials ngoài repo; nhận/gửi tin, tạo room từ UI, đổi room và logout đều đạt. Rules chỉ đọc đã áp dụng lên database cấu hình hiện tại và xác minh thành viên đọc được, người ngoài/ẩn danh và mọi ghi client bị từ chối. Dữ liệu review được dọn riêng; FCM delivery/Android/iOS chưa nghiệm thu.

## Cookie đăng nhập

Login đặt cookie HttpOnly theo hạn access token. FE restore qua GET auth/session trước khi xin lại custom token Firebase. Logout cleanup push/listener/Firebase, gọi POST auth/logout xóa cookie, sau đó xóa state trong bộ nhớ. Logout cookie không thu hồi JWT đã sao chép hoặc phiên Firebase đã cấp. GET session không kéo dài hạn đăng nhập. Xem README về SameSite/Secure/Origin và CORS khi khác origin/site.
