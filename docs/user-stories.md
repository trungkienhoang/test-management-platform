# Danh Sách User Stories: Test Management Platform

**Tổng số:** 28 User Stories  
**Phân loại ưu tiên:** Must Have (M), Should Have (S), Could Have (C)

---

## Nhóm 1: Xác Thực & Phân Quyền (Sprint 1)

| ID | Vai trò (As a...) | Mong muốn (I want to...) | Mục đích (So that...) | Ưu tiên |
|---|---|---|---|:---:|
| **US01** | Người dùng mới | Đăng ký tài khoản với email, họ tên và mật khẩu mạnh | Tôi có tài khoản để tham gia vào hệ thống quản lý kiểm thử | **Must** |
| **US02** | Người dùng | Đăng nhập bằng email và mật khẩu | Tôi nhận được JWT token để sử dụng các tính năng bảo mật | **Must** |
| **US03** | Người dùng | Tự động làm mới phiên làm việc bằng Refresh Token | Tôi không bị gián đoạn công việc khi Access Token hết hạn | **Must** |
| **US04** | Người dùng | Đăng xuất khỏi hệ thống | Token bị thu hồi, đảm bảo an toàn tài khoản khi dùng máy chung | **Must** |
| **US05** | Quản trị viên (Admin) | Xem danh sách người dùng và khóa tài khoản khi cần | Quản trị bảo mật toàn bộ hệ sinh thái | **Should** |

---

## Nhóm 2: Quản Lý Dự Án & Thành Viên (Sprint 1)

| ID | Vai trò (As a...) | Mong muốn (I want to...) | Mục đích (So that...) | Ưu tiên |
|---|---|---|---|:---:|
| **US06** | QA Lead / Admin | Tạo dự án mới và tự động được gán quyền QA Lead | Khởi tạo không gian làm việc cho một đợt phát triển sản phẩm | **Must** |
| **US07** | Thành viên | Xem danh sách các dự án mà mình tham gia | Truy cập nhanh vào đúng dự án đang làm việc | **Must** |
| **US08** | QA Lead | Mời người dùng vào dự án và chỉ định vai trò (Tester/Dev/Viewer) | Phân quyền công việc minh bạch theo đúng năng lực thành viên | **Must** |
| **US09** | QA Lead | Cập nhật vai trò hoặc xóa thành viên khỏi dự án | Duy trì danh sách nhân sự chính xác theo thực tế dự án | **Must** |

---

## Nhóm 3: Quản Lý Test Suite & Test Case (Sprint 2)

| ID | Vai trò (As a...) | Mong muốn (I want to...) | Mục đích (So that...) | Ưu tiên |
|---|---|---|---|:---:|
| **US10** | QA Lead / Tester | Tạo cây Test Suite phân cấp theo module tính năng | Tổ chức kho test case khoa học, dễ tìm kiếm | **Must** |
| **US11** | Tester | Soạn thảo Test Case với Pre-conditions, các Steps và Expected Result | Đảm bảo bất kỳ ai đọc vào cũng có thể thực thi nhất quán | **Must** |
| **US12** | Tester | Gán độ ưu tiên (Low, Medium, High, Critical) và Tags cho test case | Phân loại và dễ dàng lọc test case cho các đợt regression test | **Must** |
| **US13** | QA Lead | Xem lịch sử các phiên bản sửa đổi của một Test Case | Biết ai đã sửa gì, vào thời điểm nào và phục hồi khi cần | **Should** |
| **US14** | Tester | Tìm kiếm và lọc Test Case theo tên, tag, suite và độ ưu tiên | Tiết kiệm thời gian tìm kiếm trong kho hàng ngàn test case | **Must** |
| **US15** | QA Lead | Import danh sách test case từ file CSV/Excel | Di chuyển dữ liệu kiểm thử cũ vào hệ thống nhanh chóng | **Should** |
| **US16** | QA Lead | Export danh sách test case ra file Excel | Lưu trữ offline hoặc chia sẻ với đối tác ngoại vi | **Should** |

---

## Nhóm 4: Quản Lý Test Run & Thực Thi Kiểm Thử (Sprint 3)

| ID | Vai trò (As a...) | Mong muốn (I want to...) | Mục đích (So that...) | Ưu tiên |
|---|---|---|---|:---:|
| **US17** | QA Lead | Tạo Test Run từ một bộ Test Case chọn lọc và gán cho Tester | Định nghĩa phạm vi kiểm thử cụ thể cho một sprint/release | **Must** |
| **US18** | QA Lead | Chốt phiên bản Test Case (Snapshot) tại thời điểm tạo Run | Tránh sai lệch kết quả khi có ai đó sửa test case trong lúc chạy | **Must** |
| **US19** | Tester | Giao diện Runner tuần tự từng test case để ghi Pass/Fail/Blocked | Tối ưu trải nghiệm thực thi kiểm thử thủ công không bị phân tâm | **Must** |
| **US20** | Tester | Đính kèm ghi chú thực tế và chụp màn hình lỗi khi đánh Fail | Cung cấp đầy đủ bằng chứng cụ thể cho lập trình viên sửa bug | **Must** |
| **US21** | Tester | Tạo Bug liên kết tự động với Test Case bị fail ngay trên Runner | Giảm thiểu thao tác nhập liệu thủ công lặp lại giữa các công cụ | **Must** |
| **US22** | Thành viên | Nhận thông báo trong ứng dụng khi được gán Test Run hoặc có Bug mới | Phản ứng nhanh với các sự vụ quan trọng trong dự án | **Should** |

---

## Nhóm 5: Dashboard & Báo Cáo (Sprint 4)

| ID | Vai trò (As a...) | Mong muốn (I want to...) | Mục đích (So that...) | Ưu tiên |
|---|---|---|---|:---:|
| **US23** | QA Lead / PM | Xem biểu đồ tỷ lệ Pass/Fail và tiến độ thực thi của Test Run | Đánh giá nhanh mức độ sẵn sàng phát hành của sản phẩm | **Must** |
| **US24** | QA Lead | Xuất báo cáo tổng kết Test Run định dạng PDF/Excel | Làm tài liệu chính thức gửi cho khách hàng và ban giám đốc | **Must** |

---

## Nhóm 6: Tích Hợp CI/CD, Flaky Test & AI (Sprint 5-6)

| ID | Vai trò (As a...) | Mong muốn (I want to...) | Mục đích (So that...) | Ưu tiên |
|---|---|---|---|:---:|
| **US25** | QA Lead / Dev | Tạo và thu hồi API Key dự án cho pipeline CI/CD | Cung cấp phương thức xác thực an toàn cho các tác vụ tự động | **Must** (S5) |
| **US26** | DevOps / Dev | Pipeline CI/CD tự động gửi kết quả JUnit XML về API | Đồng bộ kết quả test tự động vào hệ thống mà không cần người can thiệp | **Must** (S5) |
| **US27** | QA Lead | Xem danh sách cảnh báo các Flaky Test có độ tin cậy thấp | Kịp thời refactor các ca test không ổn định, nâng cao chất lượng CI | **Should** (S6) |
| **US28** | Tester | Nhập User Story và để Gemini AI tự động gợi ý danh sách Test Case | Tăng tốc độ viết tài liệu kiểm thử lên gấp nhiều lần | **Could** (S6) |
