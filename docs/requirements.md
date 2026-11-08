# Đặc Tả Yêu Cầu Hệ Thống: Test Management Platform

**Tác giả:** @Kien  
**Thời gian:** Học kỳ 1, 2026 – 2027  
**Dự án:** Nền tảng quản lý kiểm thử phần mềm tích hợp CI/CD và AI

---

## 1. Giới thiệu và Bối cảnh

Trong quy trình phát triển phần mềm hiện đại (DevOps / Agile), hoạt động kiểm thử phần mềm đóng vai trò then chốt nhưng thường gặp các rào cản:
- Quản lý test case phân tán trên bảng tính (Excel/Sheets), khó theo dõi lịch sử phiên bản và phân công.
- Khoảng cách giữa kiểm thử thủ công (manual testing) và kiểm thử tự động (automation testing trong CI/CD pipeline).
- Flaky test (test chập chờn) làm xói mòn lòng tin vào CI/CD nhưng khó phát hiện và định lượng.
- Các giải pháp thương mại như TestRail, Xray có chi phí bản quyền đắt đỏ và nặng nề cho các nhóm vừa và nhỏ.

**Test Management Platform** được xây dựng nhằm giải quyết bài toán này với kiến trúc nhẹ, trực quan, hỗ trợ quản lý trọn vẹn vòng đời kiểm thử từ viết test case, tạo test run, báo cáo bug đến tích hợp trực tiếp kết quả CI/CD và ứng dụng AI hỗ trợ sinh test case.

---

## 2. Các Vai Trò trong Hệ Thống (Roles & Permissions)

Hệ thống phân cấp quyền trên 2 cấp độ:

### 2.1 Quyền Hệ Thống (System Role)
- **ADMIN**: Quản trị toàn bộ người dùng, xem tất cả dự án, cấu hình hệ thống.
- **USER**: Người dùng tiêu chuẩn, chỉ truy cập các dự án mà mình được thêm vào.

### 2.2 Quyền Dự Án (Project Role)
- **QA_LEAD**:
  - Quản lý thành viên dự án, phân vai trò.
  - CRUD Test Suite, Test Case, Test Run.
  - Đóng/Mở Test Run, chỉnh sửa kết quả sau khi đóng Run.
  - Quản lý API Key tích hợp CI/CD.
  - Xuất báo cáo, xem toàn bộ dashboard & số liệu flaky test.
- **TESTER**:
  - Xem và đóng góp Test Case (soạn thảo test case, tạo bản nháp).
  - Nhận nhiệm vụ thực thi Test Run được gán.
  - Ghi nhận kết quả thực thi (Pass, Fail, Blocked), đính kèm ghi chú/ảnh.
  - Tạo Bug và liên kết trực tiếp với Test Case bị fail.
- **DEVELOPER**:
  - Xem Test Case, Test Run và kết quả thực thi.
  - Xem danh sách Bug, cập nhật trạng thái Bug (In Progress, Resolved).
  - Tích hợp test tự động thông qua CI API Key.
- **VIEWER**:
  - Quyền chỉ đọc (Read-only) trên toàn bộ tài nguyên dự án (dành cho PO/PM/Khách hàng).

---

## 3. Danh Sách 18 Chức Năng Chi Tiết

| Mã | Chức năng | Phân loại | Mô tả tóm tắt |
|---|---|---|---|
| **F01** | Xác thực & Quản lý tài khoản | MVP (Sprint 1) | Đăng ký, đăng nhập JWT (access + refresh token), đổi mật khẩu, xem hồ sơ. |
| **F02** | Phân quyền RBAC | MVP (Sprint 1) | Phân quyền 2 tầng: Toàn hệ thống (Admin/User) và Dự án (QA Lead, Tester, Dev, Viewer). |
| **F03** | Quản lý dự án & thành viên | MVP (Sprint 1) | CRUD dự án, mời/xóa thành viên, phân vai trò trong dự án. |
| **F04** | Quản lý Test Suite | MVP (Sprint 2) | Cây thư mục tổ chức test case theo module, tính năng. |
| **F05** | Quản lý Test Case | MVP (Sprint 2) | Soạn thảo test case: Pre-conditions, các bước thực hiện, kết quả mong đợi, độ ưu tiên, tags. |
| **F06** | Tìm kiếm & Lọc Test Case | MVP (Sprint 2) | Tìm full-text theo tên, lọc theo suite, tag, priority, status với phân trang. |
| **F07** | Import / Export Test Case | MVP (Sprint 2) | Nhập và xuất định dạng CSV/Excel, validate dữ liệu theo từng dòng. |
| **F08** | Lịch sử phiên bản Test Case | MVP (Sprint 2) | Versioning mỗi lần cập nhật test case, so sánh diff giữa 2 phiên bản. |
| **F09** | Quản lý Test Run | MVP (Sprint 3) | Tạo đợt chạy từ test suite/filter, gán tester, chốt snapshot phiên bản test case. |
| **F10** | Ghi nhận kết quả Test | MVP (Sprint 3) | Runner thực thi từng step, ghi nhận Pass/Fail/Blocked, đính kèm ghi chú, screenshot. |
| **F11** | Quản lý Bug & Liên kết | MVP (Sprint 3) | Tạo bug trực tiếp từ test result fail, theo dõi lifecycle, liên kết 2 chiều với test case. |
| **F12** | Thông báo (Notifications) | MVP (Sprint 3) | Thông báo in-app khi được gán test run, khi bug liên quan được cập nhật. |
| **F13** | Dashboard thống kê | MVP (Sprint 4) | Thống kê tỷ lệ pass/fail, tiến độ run, phân bố bug theo severity, velocity. |
| **F14** | Xuất báo cáo PDF/Excel | MVP (Sprint 4) | Tạo báo cáo tổng kết đợt kiểm thử chuyên nghiệp tải về PDF/Excel. |
| **F15** | Tích hợp CI/CD Report | Nâng cao (Sprint 5) | API endpoint nhận JUnit XML từ GitHub Actions / GitLab CI, tự động tạo Test Run. |
| **F16** | Phát hiện Flaky Test | Nâng cao (Sprint 6) | Thuật toán phân tích tính bất định (Pass/Fail xen kẽ trên cùng source commit qua N lần chạy). |
| **F17** | Biểu đồ xu hướng chất lượng | Nâng cao (Sprint 6) | Trực quan hóa tỷ lệ pass và thời gian chạy qua các build CI/CD liên tiếp. |
| **F18** | AI gợi ý Test Case | Tùy chọn (Sprint 6) | Ứng dụng Gemini AI phân tích User Story và tự động sinh test case hoàn chỉnh. |

---

## 4. Yêu Cầu Phi Chức Năng (Non-Functional Requirements)

1. **Hiệu năng (Performance)**:
   - Thời gian phản hồi API p95 < 500ms với 50 người dùng đồng thời (kiểm chứng bằng k6).
   - Tìm kiếm test case trả về kết quả < 1s trên tập dữ liệu 10.000 test cases.
   - Import file XML/Excel dung lượng đến 10MB hoàn thành trong < 30s.

2. **Bảo mật (Security)**:
   - Mật khẩu mã hóa bằng bcrypt (cost factor = 12).
   - JWT Access Token hết hạn sau 15 phút; Refresh Token được hash bằng SHA-256 lưu trong DB và hỗ trợ cơ chế Token Rotation.
   - CI/CD API Key được lưu dạng hashed (chỉ hiển thị 1 lần duy nhất khi tạo).
   - Kiểm tra an toàn đạt chuẩn OWASP Top 10 (kiểm chứng bằng OWASP ZAP).

3. **Tính toàn vẹn dữ liệu (Data Integrity)**:
   - Khi chạy Test Run, snapshot nội dung test case được đóng băng, việc sửa đổi test case sau đó không làm thay đổi lịch sử của Run cũ.
   - Ràng buộc khóa ngoại và Transaction đảm bảo không có dữ liệu mồ côi (orphan records).

4. **Khả năng mở rộng & Triển khai (Scalability & DevOps)**:
   - Kiến trúc module hóa NestJS tách bạch ranh giới nghiệp vụ.
   - Container hóa hoàn toàn bằng Docker Compose.
   - Pipeline CI GitHub Actions tự động kiểm thử và build trên mỗi pull request.
