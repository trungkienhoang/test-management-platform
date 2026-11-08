# Test Management Platform

> Đồ án tốt nghiệp – Nền tảng quản lý kiểm thử phần mềm  
> Thực hiện: @Kien | 09/11/2026 – 28/03/2027

## Giới thiệu

Hệ thống web quản lý kiểm thử phần mềm với 14 chức năng MVP và 4 chức năng nâng cao, tích hợp CI/CD và phát hiện flaky test.

## 18 Chức năng

| # | Chức năng | Mức | Sprint |
|---|-----------|-----|--------|
| 1 | Đăng ký, đăng nhập, quản lý tài khoản | MVP | 1 |
| 2 | Phân quyền (Admin, QA Lead, Tester, Developer) | MVP | 1 |
| 3 | Quản lý dự án và thành viên | MVP | 1 |
| 4 | Quản lý test suite | MVP | 2 |
| 5 | Quản lý test case | MVP | 2 |
| 6 | Tìm kiếm, lọc test case | MVP | 2 |
| 7 | Import/export test case (CSV, Excel) | MVP | 2 |
| 8 | Lịch sử thay đổi test case | MVP | 2 |
| 9 | Quản lý test run, gán người thực hiện | MVP | 3 |
| 10 | Ghi nhận kết quả pass/fail/blocked | MVP | 3 |
| 11 | Quản lý bug, liên kết với test case | MVP | 3 |
| 12 | Thông báo trong ứng dụng | MVP | 3 |
| 13 | Dashboard thống kê | MVP | 4 |
| 14 | Xuất báo cáo PDF/Excel | MVP | 4 |
| 15 | Nhận báo cáo từ CI/CD (JUnit XML) | Nâng cao | 5 |
| 16 | Phát hiện flaky test | Nâng cao | 6 |
| 17 | Biểu đồ xu hướng chất lượng | Nâng cao | 6 |
| 18 | AI gợi ý test case từ user story | Tùy chọn | 6 |

## Tech Stack

| Lớp | Công nghệ |
|-----|-----------|
| Ngôn ngữ | TypeScript |
| Backend | NestJS, REST API, OpenAPI |
| Frontend | React + TypeScript, Recharts |
| Database | PostgreSQL + Prisma ORM |
| Testing | Jest, Supertest, Playwright, k6, OWASP ZAP |
| Infra | Docker Compose, GitHub Actions |

## Cấu trúc thư mục

```
test-management-platform/
├── api/          # NestJS backend
├── web/          # React frontend
├── docs/         # Tài liệu, ERD, wireframe, ADR
├── .github/
│   └── workflows/
│       └── ci.yml
├── docker-compose.yml
├── .env.example
└── README.md
```

## Bắt đầu nhanh

### 1. Clone và cài đặt
```bash
git clone <repo-url>
cd test-management-platform

# Copy env
cp .env.example .env
# Chỉnh sửa .env: điền GEMINI_API_KEY và JWT_SECRET

# Khởi động toàn bộ stack
docker compose up -d
```

### 2. Backend (dev mode)
```bash
cd api
npm install
npx prisma migrate dev
npm run start:dev
```

### 3. Frontend (dev mode)
```bash
cd web
npm install
npm run dev
```

## Lịch trình

| Tuần | Giai đoạn | Deadline |
|------|-----------|----------|
| 1-2 | Khởi động, đặc tả | 22/11/2026 |
| 3-4 | Thiết kế ERD, API, Wireframe | 06/12/2026 |
| 5-6 | Sprint 1: Auth + Phân quyền | 20/12/2026 |
| 7-8 | Sprint 2: Test case management | 03/01/2027 |
| 9-10 | Sprint 3: Test run + Bug | 17/01/2027 |
| 11-12 | Sprint 4: Dashboard + Report (MVP) | **31/01/2027** |
| 13-14 | Tết + Buffer | 14/02/2027 |
| 15-16 | Sprint 5: CI/CD Integration | 28/02/2027 |
| 17-18 | Sprint 6: Flaky test + AI | 14/03/2027 |
| 19 | Chất lượng: k6, OWASP ZAP | 21/03/2027 |
| 20 | Hoàn thiện hồ sơ, bảo vệ | 28/03/2027 |

## Liên kết

- [Lộ trình chi tiết](docs/roadmap.md)
- [ERD](docs/erd.md)
- [API Specification](docs/openapi.yaml)
- [ADR](docs/adr/)
