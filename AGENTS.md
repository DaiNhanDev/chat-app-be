# Hướng dẫn cho agent

Áp dụng cho toàn bộ repository này.

## Không tự viết unit test

- Không tạo mới, bổ sung hoặc chỉnh sửa unit test khi triển khai tính năng, sửa lỗi hay refactor.
- Không tự thêm file test, mock, fixture, script hoặc dependency để phục vụ unit test.
- Chỉ viết hoặc sửa unit test khi người dùng yêu cầu trực tiếp trong tác vụ hiện tại.
- Repository đã loại bỏ unit test. Không khôi phục file test, cấu hình coverage hoặc lệnh chạy unit test nếu người dùng chưa yêu cầu trực tiếp.
- Kiểm tra thay đổi bằng typecheck, lint, build hoặc kiểm tra thủ công phù hợp.
- Khi báo cáo kết quả, nêu rõ các bước kiểm tra đã thực hiện và giới hạn còn lại; không viết unit test chỉ để hoàn thành bước xác minh.
