import {
  PrismaClient,
  SystemRole,
  ProjectRole,
  ProjectStatus,
  TestCasePriority,
  TestCaseStatus,
  TestRunStatus,
  TestExecutionStatus,
  BugSeverity,
  BugStatus,
  NotificationType,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Bắt đầu tạo dữ liệu mẫu toàn diện cho hệ thống...');

  // ─────────────────────────────────────────────────────────────
  // 1. TẠO TÀI KHOẢN NGƯỜI DÙNG & VAI TRÒ
  // ─────────────────────────────────────────────────────────────
  console.log('👤 Khởi tạo danh sách người dùng...');

  const passwordHashAdmin = await bcrypt.hash('Admin123!', 12);
  const passwordHashLead = await bcrypt.hash('QaLead123!', 12);
  const passwordHashTester = await bcrypt.hash('Tester123!', 12);
  const passwordHashDev = await bcrypt.hash('Dev12345!', 12);
  const passwordHashViewer = await bcrypt.hash('Viewer123!', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@testplatform.dev' },
    update: {},
    create: {
      email: 'admin@testplatform.dev',
      fullName: 'System Admin (Quản Trị)',
      passwordHash: passwordHashAdmin,
      systemRole: SystemRole.ADMIN,
    },
  });

  const qaLead = await prisma.user.upsert({
    where: { email: 'qa.lead@testplatform.dev' },
    update: {},
    create: {
      email: 'qa.lead@testplatform.dev',
      fullName: 'Nguyen QA Lead (Trưởng Nhóm QA)',
      passwordHash: passwordHashLead,
      systemRole: SystemRole.USER,
    },
  });

  const tester = await prisma.user.upsert({
    where: { email: 'tester@testplatform.dev' },
    update: {},
    create: {
      email: 'tester@testplatform.dev',
      fullName: 'Tran Tester (Kiểm Thử Viên)',
      passwordHash: passwordHashTester,
      systemRole: SystemRole.USER,
    },
  });

  const dev = await prisma.user.upsert({
    where: { email: 'dev@testplatform.dev' },
    update: {},
    create: {
      email: 'dev@testplatform.dev',
      fullName: 'Le Developer (Lập Trình Viên)',
      passwordHash: passwordHashDev,
      systemRole: SystemRole.USER,
    },
  });

  const viewer = await prisma.user.upsert({
    where: { email: 'viewer@testplatform.dev' },
    update: {},
    create: {
      email: 'viewer@testplatform.dev',
      fullName: 'Pham Viewer (Khách / PM Chỉ Xem)',
      passwordHash: passwordHashViewer,
      systemRole: SystemRole.USER,
    },
  });

  console.log('✅ Người dùng: Admin, QA Lead, Tester, Developer, Viewer');

  // ─────────────────────────────────────────────────────────────
  // 2. KHỞI TẠO CÁC DỰ ÁN (PROJECTS)
  // ─────────────────────────────────────────────────────────────
  console.log('📁 Khởi tạo các dự án mẫu...');

  // Dự án 1: Website Redesign QA (Dự án chính với đầy đủ dữ liệu sâu)
  const project1 = await prisma.project.upsert({
    where: { id: 'sample-project-001' },
    update: {
      testCaseSeq: 12,
      bugSeq: 6,
    },
    create: {
      id: 'sample-project-001',
      name: 'Website Thương Mại Điện Tử (Redesign)',
      description: 'Dự án kiểm thử toàn diện nền tảng E-commerce thế hệ mới: Auth, Cart, Checkout, Dashboard & Báo cáo.',
      status: ProjectStatus.ACTIVE,
      testCaseSeq: 12,
      bugSeq: 6,
      createdById: qaLead.id,
    },
  });

  // Thành viên Dự án 1
  const membersP1 = [
    { userId: qaLead.id, role: ProjectRole.QA_LEAD },
    { userId: tester.id, role: ProjectRole.TESTER },
    { userId: dev.id, role: ProjectRole.DEVELOPER },
    { userId: viewer.id, role: ProjectRole.VIEWER },
  ];
  for (const m of membersP1) {
    await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: project1.id, userId: m.userId } },
      update: { role: m.role },
      create: { projectId: project1.id, userId: m.userId, role: m.role },
    });
  }

  // Dự án 2: Mobile Banking App (Để test tính năng chuyển đổi dự án trên Dashboard)
  const project2 = await prisma.project.upsert({
    where: { id: 'sample-project-002' },
    update: {
      testCaseSeq: 4,
      bugSeq: 1,
    },
    create: {
      id: 'sample-project-002',
      name: 'Ứng Dụng Mobile Banking (iOS & Android)',
      description: 'Hệ thống ngân hàng số: Chuyển khoản nhanh 24/7, sinh mã QR, xác thực sinh trắc học FaceID.',
      status: ProjectStatus.ACTIVE,
      testCaseSeq: 4,
      bugSeq: 1,
      createdById: qaLead.id,
    },
  });

  for (const m of membersP1) {
    await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: project2.id, userId: m.userId } },
      update: { role: m.role },
      create: { projectId: project2.id, userId: m.userId, role: m.role },
    });
  }

  // Dự án 3: Dự án đã lưu trữ (Archived Project - kiểm tra cảnh báo Read-only)
  const project3 = await prisma.project.upsert({
    where: { id: 'sample-project-003' },
    update: {},
    create: {
      id: 'sample-project-003',
      name: 'Cổng Thanh Toán Cũ v1.0 (Archived)',
      description: 'Hệ thống thanh toán cũ đã ngừng bảo trì, lưu trữ để đối soát lịch sử kiểm thử.',
      status: ProjectStatus.ARCHIVED,
      testCaseSeq: 2,
      bugSeq: 0,
      createdById: admin.id,
    },
  });

  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: project3.id, userId: qaLead.id } },
    update: { role: ProjectRole.QA_LEAD },
    create: { projectId: project3.id, userId: qaLead.id, role: ProjectRole.QA_LEAD },
  });

  console.log('✅ Đã tạo 3 dự án: E-commerce, Mobile Banking, Cổng thanh toán (Lưu trữ)');

  // ─────────────────────────────────────────────────────────────
  // 3. TẠO CÂY THƯ MỤC TEST SUITE (PHÂN CẤP CHA - CON)
  // ─────────────────────────────────────────────────────────────
  console.log('📑 Khởi tạo cấu trúc Test Suites phân cấp...');

  // Xóa sạch suite/case/run cũ của project1 để re-seed chuẩn xác
  await prisma.notification.deleteMany({ where: { projectId: project1.id } });
  await prisma.bug.deleteMany({ where: { projectId: project1.id } });
  await prisma.testExecution.deleteMany({ where: { testRun: { projectId: project1.id } } });
  await prisma.testRun.deleteMany({ where: { projectId: project1.id } });
  await prisma.testCaseHistory.deleteMany({ where: { testCase: { projectId: project1.id } } });
  await prisma.testCase.deleteMany({ where: { projectId: project1.id } });
  await prisma.testSuite.deleteMany({ where: { projectId: project1.id } });

  // Suite Gốc 1: Xác Thực & Tài Khoản (Authentication)
  const suiteAuth = await prisma.testSuite.create({
    data: {
      id: 'suite-auth',
      projectId: project1.id,
      name: 'Module Xác Thực (Authentication)',
      description: 'Toàn bộ ca kiểm thử cho đăng ký, đăng nhập, bảo mật tài khoản',
      order: 1,
    },
  });

  // Con của Suite 1: Đăng Nhập
  const suiteLogin = await prisma.testSuite.create({
    data: {
      id: 'suite-login',
      projectId: project1.id,
      parentId: suiteAuth.id,
      name: 'Đăng Nhập (Login & 2FA)',
      description: 'Đăng nhập email/mật khẩu, ghi nhớ phiên, khóa tài khoản',
      order: 1,
    },
  });

  // Con của Suite 1: Đăng Ký & Quên Mật Khẩu
  const suiteRegister = await prisma.testSuite.create({
    data: {
      id: 'suite-register',
      projectId: project1.id,
      parentId: suiteAuth.id,
      name: 'Đăng Ký & OTP Email',
      description: 'Quy trình tạo tài khoản mới và xác minh mã OTP',
      order: 2,
    },
  });

  // Suite Gốc 2: Giỏ Hàng & Đặt Hàng (Cart & Checkout)
  const suiteCheckout = await prisma.testSuite.create({
    data: {
      id: 'suite-checkout',
      projectId: project1.id,
      name: 'Giỏ Hàng & Thanh Toán (Cart & Order)',
      description: 'Thêm vào giỏ, áp mã giảm giá voucher, chọn cổng thanh toán',
      order: 2,
    },
  });

  // Suite Gốc 3: Báo Cáo & Dashboard (Sprint 4)
  const suiteReports = await prisma.testSuite.create({
    data: {
      id: 'suite-reports',
      projectId: project1.id,
      name: 'Báo Cáo & Thống Kê (Dashboard & Analytics)',
      description: 'Kiểm thử hiển thị biểu đồ Recharts, xuất Excel và in PDF',
      order: 3,
    },
  });

  console.log('✅ Đã tạo cây Test Suite phân cấp cha - con');

  // ─────────────────────────────────────────────────────────────
  // 4. TẠO TEST CASES VỚI ĐỦ ĐỘ ƯU TIÊN, BƯỚC THỰC HIỆN & PHIÊN BẢN
  // ─────────────────────────────────────────────────────────────
  console.log('🧪 Khởi tạo danh sách Test Cases phong phú...');

  interface SeedTC {
    code: string;
    title: string;
    description: string;
    preconditions: string;
    suiteId: string;
    priority: TestCasePriority;
    status: TestCaseStatus;
    tags: string[];
    steps: Array<{ stepNumber: number; action: string; expectedResult: string }>;
    hasHistory?: boolean;
  }

  const testCasesList: SeedTC[] = [
    {
      code: 'TC-1',
      title: 'Đăng nhập thành công với tài khoản QA Lead',
      description: 'Kiểm tra tài khoản hợp lệ đăng nhập vào hệ sinh thái và lưu trữ JWT token',
      preconditions: 'Tài khoản qa.lead@testplatform.dev đã được kích hoạt trong DB',
      suiteId: suiteLogin.id,
      priority: TestCasePriority.CRITICAL,
      status: TestCaseStatus.READY,
      tags: ['smoke', 'auth', 'p0'],
      steps: [
        { stepNumber: 1, action: 'Truy cập trang /login', expectedResult: 'Hiển thị form đăng nhập đầy đủ' },
        { stepNumber: 2, action: 'Nhập email: qa.lead@testplatform.dev và mật khẩu', expectedResult: 'Hiển thị ký tự ẩn dấu chấm' },
        { stepNumber: 3, action: 'Bấm nút "Đăng nhập"', expectedResult: 'Đăng nhập thành công, chuyển hướng tới /projects' },
      ],
      hasHistory: true,
    },
    {
      code: 'TC-2',
      title: 'Đăng nhập thất bại khi nhập sai mật khẩu quá 5 lần',
      description: 'Đảm bảo tính năng Rate Limiting & Khóa tài khoản tạm thời hoạt động',
      preconditions: 'Có tài khoản người dùng đang hoạt động',
      suiteId: suiteLogin.id,
      priority: TestCasePriority.HIGH,
      status: TestCaseStatus.READY,
      tags: ['security', 'auth'],
      steps: [
        { stepNumber: 1, action: 'Nhập đúng email nhưng sai mật khẩu', expectedResult: 'Báo lỗi "Thông tin đăng nhập không chính xác"' },
        { stepNumber: 2, action: 'Thực hiện lặp lại 5 lần liên tiếp', expectedResult: 'Hiển thị cảnh báo khóa tài khoản trong 15 phút' },
      ],
    },
    {
      code: 'TC-3',
      title: 'Đăng ký tài khoản mới và xác minh mã OTP gửi qua Email',
      description: 'Kiểm tra quy trình OTP xác thực 6 số gửi qua Gmail SMTP',
      preconditions: 'Email đăng ký chưa từng tồn tại trên hệ thống',
      suiteId: suiteRegister.id,
      priority: TestCasePriority.HIGH,
      status: TestCaseStatus.READY,
      tags: ['auth', 'registration', 'email'],
      steps: [
        { stepNumber: 1, action: 'Nhập họ tên, email mới và mật khẩu mạnh', expectedResult: 'Nút "Gửi mã OTP" sáng lên' },
        { stepNumber: 2, action: 'Bấm nhận mã OTP', expectedResult: 'Hệ thống gửi mã 6 chữ số về hộp thư' },
        { stepNumber: 3, action: 'Nhập đúng mã OTP và hoàn tất', expectedResult: 'Tài khoản được tạo, tự động đăng nhập' },
      ],
    },
    {
      code: 'TC-4',
      title: 'Thêm sản phẩm vào giỏ hàng và cập nhật số lượng',
      description: 'Kiểm tra tính toán tổng tiền tạm tính và cập nhật giỏ thời gian thực',
      preconditions: 'Sản phẩm còn tồn kho > 10',
      suiteId: suiteCheckout.id,
      priority: TestCasePriority.CRITICAL,
      status: TestCaseStatus.READY,
      tags: ['cart', 'e-commerce', 'p0'],
      steps: [
        { stepNumber: 1, action: 'Chọn sản phẩm "Áo thun Tech Lead" và bấm "Thêm vào giỏ"', expectedResult: 'Badge giỏ hàng hiển thị số 1' },
        { stepNumber: 2, action: 'Tăng số lượng lên 3', expectedResult: 'Tổng tiền giỏ hàng tự động nhân x3 chính xác' },
      ],
    },
    {
      code: 'TC-5',
      title: 'Áp dụng mã giảm giá voucher TEST50 vào đơn hàng',
      description: 'Kiểm tra logic chiết khấu 50% tối đa 100.000 VNĐ',
      preconditions: 'Giỏ hàng có tổng tiền tối thiểu 200.000 VNĐ',
      suiteId: suiteCheckout.id,
      priority: TestCasePriority.MEDIUM,
      status: TestCaseStatus.READY,
      tags: ['voucher', 'checkout'],
      steps: [
        { stepNumber: 1, action: 'Tại bước thanh toán, nhập voucher "TEST50"', expectedResult: 'Hiển thị thông báo "Áp dụng thành công"' },
        { stepNumber: 2, action: 'Kiểm tra dòng giảm giá', expectedResult: 'Số tiền giảm hiển thị đúng -100.000 VNĐ' },
      ],
    },
    {
      code: 'TC-6',
      title: 'Thanh toán trực tuyến thất bại khi thẻ tín dụng không đủ số dư',
      description: 'Bắt lỗi từ cổng thanh toán đối tác và hiển thị cảnh báo thân thiện',
      preconditions: 'Người dùng đang ở bước chọn cổng thanh toán',
      suiteId: suiteCheckout.id,
      priority: TestCasePriority.HIGH,
      status: TestCaseStatus.READY,
      tags: ['payment', 'negative-test'],
      steps: [
        { stepNumber: 1, action: 'Chọn thanh toán thẻ quốc tế Visa/Mastercard', expectedResult: 'Mở form nhập thẻ' },
        { stepNumber: 2, action: 'Nhập thông tin thẻ thử nghiệm lỗi số dư', expectedResult: 'Báo lỗi "Giao dịch không thành công: Thẻ không đủ hạn mức"' },
      ],
    },
    {
      code: 'TC-7',
      title: 'Hiển thị đầy đủ 4 thẻ KPI trên Dashboard dự án',
      description: 'Kiểm tra các số liệu Pass Rate, tổng Test Runs, Test Cases, Active Bugs',
      preconditions: 'Dự án đã có dữ liệu thực thi kiểm thử',
      suiteId: suiteReports.id,
      priority: TestCasePriority.HIGH,
      status: TestCaseStatus.READY,
      tags: ['dashboard', 'sprint4'],
      steps: [
        { stepNumber: 1, action: 'Truy cập mục Dashboard trên thanh điều hướng', expectedResult: 'Tải nhanh, hiển thị 4 thẻ KPI đồng bộ' },
        { stepNumber: 2, action: 'Kiểm tra thanh tiến độ tỷ lệ Pass Rate', expectedResult: 'Hiển thị màu xanh nếu >= 80%, vàng nếu >= 60%' },
      ],
    },
    {
      code: 'TC-8',
      title: 'Xuất file Excel báo cáo tổng kết Test Run 3 sheets',
      description: 'Kiểm tra tải tệp .xlsx chứa sheet Tổng Quan, Chi Tiết và Danh Sách Bug',
      preconditions: 'Test Run đã hoàn thành',
      suiteId: suiteReports.id,
      priority: TestCasePriority.HIGH,
      status: TestCaseStatus.READY,
      tags: ['export', 'excel', 'sprint4'],
      steps: [
        { stepNumber: 1, action: 'Bấm nút "Xuất Excel (.xlsx)" trên modal báo cáo', expectedResult: 'Trình duyệt tải về tệp TestRun_..._Report.xlsx' },
        { stepNumber: 2, action: 'Mở file Excel trên máy tính', expectedResult: 'File chứa đủ 3 sheet, font chữ tiếng Việt hiển thị rõ ràng, không lỗi bảng mã' },
      ],
    },
    {
      code: 'TC-9',
      title: 'In và Lưu báo cáo nghiệm thu dạng PDF khổ A4',
      description: 'Kiểm tra giao diện in ấn loại bỏ sidebar và thanh cuộn, hỗ trợ ký tên',
      preconditions: 'Mở modal báo cáo tổng kết',
      suiteId: suiteReports.id,
      priority: TestCasePriority.MEDIUM,
      status: TestCaseStatus.READY,
      tags: ['export', 'pdf', 'print'],
      steps: [
        { stepNumber: 1, action: 'Bấm nút "In / Lưu PDF"', expectedResult: 'Mở hộp thoại in trình duyệt' },
        { stepNumber: 2, action: 'Kiểm tra bản xem trước in', expectedResult: 'Bố cục trang in gọn gàng, có khung chữ ký Tester và QA Lead ở cuối' },
      ],
    },
    {
      code: 'TC-10',
      title: 'Bảo mật mật khẩu khi truyền qua API (Mã hóa SSL & Hash)',
      description: 'Kiểm tra payload đăng nhập không lộ plaintext password trong log hệ thống',
      preconditions: 'Môi trường dev hoặc staging',
      suiteId: suiteLogin.id,
      priority: TestCasePriority.CRITICAL,
      status: TestCaseStatus.READY,
      tags: ['security', 'owasp'],
      steps: [
        { stepNumber: 1, action: 'Gửi request login và kiểm tra network tab', expectedResult: 'Payload được truyền an toàn qua HTTPS' },
      ],
    },
    {
      code: 'TC-11',
      title: '[DRAFT] Đăng nhập bằng tài khoản mạng xã hội Google / GitHub',
      description: 'Tích hợp OAuth2 SSO cho người dùng doanh nghiệp',
      preconditions: 'Cấu hình OAuth Client ID',
      suiteId: suiteLogin.id,
      priority: TestCasePriority.LOW,
      status: TestCaseStatus.DRAFT,
      tags: ['sso', 'oauth', 'draft'],
      steps: [
        { stepNumber: 1, action: 'Bấm "Tiếp tục với Google"', expectedResult: 'Chuyển hướng sang Google Consent Screen' },
      ],
    },
    {
      code: 'TC-12',
      title: '[DEPRECATED] Phương thức đăng nhập bằng số điện thoại SMS OTP',
      description: 'Phương thức SMS cũ đã dừng sử dụng do chi phí viễn thông cao',
      preconditions: 'Tính năng đã ngưng hỗ trợ',
      suiteId: suiteLogin.id,
      priority: TestCasePriority.LOW,
      status: TestCaseStatus.DEPRECATED,
      tags: ['deprecated'],
      steps: [
        { stepNumber: 1, action: 'Kiểm tra form đăng nhập', expectedResult: 'Không còn nút đăng nhập bằng SMS' },
      ],
    },
  ];

  const createdTestCases: any[] = [];

  for (let i = 0; i < testCasesList.length; i++) {
    const item = testCasesList[i];
    const tc = await prisma.testCase.create({
      data: {
        projectId: project1.id,
        suiteId: item.suiteId,
        code: item.code,
        title: item.title,
        description: item.description,
        preconditions: item.preconditions,
        steps: item.steps,
        priority: item.priority,
        status: item.status,
        tags: item.tags,
        order: i + 1,
        version: item.hasHistory ? 2 : 1,
        createdById: qaLead.id,
      },
    });

    // Tạo lịch sử v1
    await prisma.testCaseHistory.create({
      data: {
        testCaseId: tc.id,
        version: 1,
        title: item.title.replace(' (Updated)', ''),
        description: item.description,
        preconditions: item.preconditions,
        steps: item.steps,
        priority: item.priority,
        status: TestCaseStatus.DRAFT,
        tags: item.tags,
        changedById: tester.id,
        changeReason: 'Khởi tạo bản nháp ban đầu',
      },
    });

    // Nếu có lịch sử nâng cấp (v2)
    if (item.hasHistory) {
      await prisma.testCaseHistory.create({
        data: {
          testCaseId: tc.id,
          version: 2,
          title: item.title,
          description: item.description,
          preconditions: item.preconditions,
          steps: item.steps,
          priority: item.priority,
          status: item.status,
          tags: item.tags,
          changedById: qaLead.id,
          changeReason: 'QA Lead rà soát và chuyển trạng thái sang READY',
        },
      });
    }

    createdTestCases.push(tc);
  }

  console.log(`✅ Đã tạo ${createdTestCases.length} Test Cases và bản ghi lịch sử versioning`);

  // ─────────────────────────────────────────────────────────────
  // 5. TẠO TEST RUNS & EXECUTIONS (4 ĐỢT CHẠY VỚI 4 TRẠNG THÁI KHÁC NHAU)
  // ─────────────────────────────────────────────────────────────
  console.log('▶️ Khởi tạo các đợt Test Runs và kết quả kiểm thử...');

  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);

  // ── ĐỢT 1: COMPLETED (Smoke Test Sprint 1 - Đã nghiệm thu xong) ─────────
  const run1 = await prisma.testRun.create({
    data: {
      projectId: project1.id,
      name: 'Sprint 1 - Regression Smoke Test Release 1.0',
      description: 'Đợt kiểm thử khói trước khi bàn giao bản release cho khách hàng',
      status: TestRunStatus.COMPLETED,
      createdById: qaLead.id,
      assignedToId: tester.id,
      startedAt: threeDaysAgo,
      completedAt: oneDayAgo,
    },
  });

  // Executions cho Run 1 (TC-1 đến TC-6)
  const exec1_1 = await prisma.testExecution.create({
    data: {
      testRunId: run1.id,
      testCaseId: createdTestCases[0].id,
      testCaseCode: createdTestCases[0].code,
      testCaseTitle: createdTestCases[0].title,
      testCasePriority: createdTestCases[0].priority,
      testCaseVersion: createdTestCases[0].version,
      status: TestExecutionStatus.PASSED,
      actualResult: 'Đăng nhập thành công, nhận JWT token hợp lệ và chuyển trang chuẩn xác.',
      executedById: tester.id,
      executedAt: threeDaysAgo,
      executionDurationMs: 45000,
    },
  });

  const exec1_2 = await prisma.testExecution.create({
    data: {
      testRunId: run1.id,
      testCaseId: createdTestCases[1].id,
      testCaseCode: createdTestCases[1].code,
      testCaseTitle: createdTestCases[1].title,
      testCasePriority: createdTestCases[1].priority,
      testCaseVersion: createdTestCases[1].version,
      status: TestExecutionStatus.PASSED,
      actualResult: 'Khóa tài khoản và thông báo chuẩn sau 5 lần nhập sai.',
      executedById: tester.id,
      executedAt: threeDaysAgo,
      executionDurationMs: 62000,
    },
  });

  const exec1_3 = await prisma.testExecution.create({
    data: {
      testRunId: run1.id,
      testCaseId: createdTestCases[2].id,
      testCaseCode: createdTestCases[2].code,
      testCaseTitle: createdTestCases[2].title,
      testCasePriority: createdTestCases[2].priority,
      testCaseVersion: createdTestCases[2].version,
      status: TestExecutionStatus.FAILED,
      actualResult: 'Email OTP đến chậm hơn 5 phút trên một số domain @outlook.com.',
      executedById: tester.id,
      executedAt: threeDaysAgo,
      executionDurationMs: 120000,
    },
  });

  const exec1_4 = await prisma.testExecution.create({
    data: {
      testRunId: run1.id,
      testCaseId: createdTestCases[3].id,
      testCaseCode: createdTestCases[3].code,
      testCaseTitle: createdTestCases[3].title,
      testCasePriority: createdTestCases[3].priority,
      testCaseVersion: createdTestCases[3].version,
      status: TestExecutionStatus.PASSED,
      actualResult: 'Giỏ hàng hoạt động mượt mà, tính toán tiền chính xác.',
      executedById: tester.id,
      executedAt: twoDaysAgo(now),
      executionDurationMs: 38000,
    },
  });

  const exec1_5 = await prisma.testExecution.create({
    data: {
      testRunId: run1.id,
      testCaseId: createdTestCases[4].id,
      testCaseCode: createdTestCases[4].code,
      testCaseTitle: createdTestCases[4].title,
      testCasePriority: createdTestCases[4].priority,
      testCaseVersion: createdTestCases[4].version,
      status: TestExecutionStatus.PASSED,
      actualResult: 'Voucher TEST50 trừ đúng 100.000 VNĐ vào đơn hàng.',
      executedById: tester.id,
      executedAt: twoDaysAgo(now),
      executionDurationMs: 35000,
    },
  });

  const exec1_6 = await prisma.testExecution.create({
    data: {
      testRunId: run1.id,
      testCaseId: createdTestCases[5].id,
      testCaseCode: createdTestCases[5].code,
      testCaseTitle: createdTestCases[5].title,
      testCasePriority: createdTestCases[5].priority,
      testCaseVersion: createdTestCases[5].version,
      status: TestExecutionStatus.BLOCKED,
      actualResult: 'Môi trường Sandbox cổng thanh toán đang bảo trì định kỳ, chưa thể giả lập lỗi thẻ.',
      executedById: tester.id,
      executedAt: twoDaysAgo(now),
      executionDurationMs: 15000,
    },
  });

  // ── ĐỢT 2: IN_REVIEW (Chờ QA Lead rà soát & duyệt) ───────────────────────
  const run2 = await prisma.testRun.create({
    data: {
      projectId: project1.id,
      name: 'Sprint 3 - Test Runner & Bug Verification',
      description: 'Kiểm tra toàn bộ luồng tạo bug từ runner và liên kết 2 chiều',
      status: TestRunStatus.IN_REVIEW,
      createdById: qaLead.id,
      assignedToId: tester.id,
      startedAt: twoDaysAgo(now),
    },
  });

  const exec2_1 = await prisma.testExecution.create({
    data: {
      testRunId: run2.id,
      testCaseId: createdTestCases[6].id,
      testCaseCode: createdTestCases[6].code,
      testCaseTitle: createdTestCases[6].title,
      testCasePriority: createdTestCases[6].priority,
      testCaseVersion: createdTestCases[6].version,
      status: TestExecutionStatus.PASSED,
      actualResult: 'Các thẻ KPI hiển thị chuẩn xác số liệu từ backend.',
      executedById: tester.id,
      executedAt: oneDayAgo,
      executionDurationMs: 40000,
    },
  });

  const exec2_2 = await prisma.testExecution.create({
    data: {
      testRunId: run2.id,
      testCaseId: createdTestCases[7].id,
      testCaseCode: createdTestCases[7].code,
      testCaseTitle: createdTestCases[7].title,
      testCasePriority: createdTestCases[7].priority,
      testCaseVersion: createdTestCases[7].version,
      status: TestExecutionStatus.PASSED,
      actualResult: 'File Excel tải về đầy đủ 3 sheets, định dạng cột gọn gàng.',
      executedById: tester.id,
      executedAt: oneDayAgo,
      executionDurationMs: 55000,
    },
  });

  const exec2_3 = await prisma.testExecution.create({
    data: {
      testRunId: run2.id,
      testCaseId: createdTestCases[8].id,
      testCaseCode: createdTestCases[8].code,
      testCaseTitle: createdTestCases[8].title,
      testCasePriority: createdTestCases[8].priority,
      testCaseVersion: createdTestCases[8].version,
      status: TestExecutionStatus.FAILED,
      actualResult: 'Nút in trên trình duyệt Firefox bị vỡ lề phải khi hiển thị trên màn hình nhỏ.',
      executedById: tester.id,
      executedAt: oneDayAgo,
      executionDurationMs: 48000,
    },
  });

  // ── ĐỢT 3: IN_PROGRESS (Đang chạy, dành cho Tester bấm Test Runner) ───────
  const run3 = await prisma.testRun.create({
    data: {
      projectId: project1.id,
      name: 'Sprint 4 - Dashboard & Security Regression',
      description: 'Đợt test đang diễn ra: kiểm tra hiệu năng biểu đồ và tính an toàn mật khẩu',
      status: TestRunStatus.IN_PROGRESS,
      createdById: qaLead.id,
      assignedToId: tester.id,
      startedAt: new Date(),
    },
  });

  await prisma.testExecution.create({
    data: {
      testRunId: run3.id,
      testCaseId: createdTestCases[9].id,
      testCaseCode: createdTestCases[9].code,
      testCaseTitle: createdTestCases[9].title,
      testCasePriority: createdTestCases[9].priority,
      testCaseVersion: createdTestCases[9].version,
      status: TestExecutionStatus.PASSED,
      actualResult: 'Kiểm tra traffic payload bằng proxy, mật khẩu được mã hóa an toàn.',
      executedById: tester.id,
      executedAt: new Date(),
      executionDurationMs: 25000,
    },
  });

  await prisma.testExecution.create({
    data: {
      testRunId: run3.id,
      testCaseId: createdTestCases[0].id,
      testCaseCode: createdTestCases[0].code,
      testCaseTitle: createdTestCases[0].title,
      testCasePriority: createdTestCases[0].priority,
      testCaseVersion: createdTestCases[0].version,
      status: TestExecutionStatus.UNTESTED,
    },
  });

  await prisma.testExecution.create({
    data: {
      testRunId: run3.id,
      testCaseId: createdTestCases[1].id,
      testCaseCode: createdTestCases[1].code,
      testCaseTitle: createdTestCases[1].title,
      testCasePriority: createdTestCases[1].priority,
      testCaseVersion: createdTestCases[1].version,
      status: TestExecutionStatus.UNTESTED,
    },
  });

  // ── ĐỢT 4: OPEN (Đợt Retest mới tạo từ các ca FAIL của Run 1) ─────────────
  const run4 = await prisma.testRun.create({
    data: {
      projectId: project1.id,
      parentRunId: run1.id,
      name: '[Retest] Sprint 1 Regression - Failed & Blocked Cases',
      description: 'Chạy lại các ca kiểm thử đã bị FAIL hoặc BLOCKED ở đợt Sprint 1 sau khi Developer sửa lỗi.',
      status: TestRunStatus.OPEN,
      createdById: qaLead.id,
      assignedToId: tester.id,
    },
  });

  await prisma.testExecution.create({
    data: {
      testRunId: run4.id,
      testCaseId: createdTestCases[2].id,
      testCaseCode: createdTestCases[2].code,
      testCaseTitle: createdTestCases[2].title,
      testCasePriority: createdTestCases[2].priority,
      testCaseVersion: createdTestCases[2].version,
      status: TestExecutionStatus.UNTESTED,
    },
  });

  await prisma.testExecution.create({
    data: {
      testRunId: run4.id,
      testCaseId: createdTestCases[5].id,
      testCaseCode: createdTestCases[5].code,
      testCaseTitle: createdTestCases[5].title,
      testCasePriority: createdTestCases[5].priority,
      testCaseVersion: createdTestCases[5].version,
      status: TestExecutionStatus.UNTESTED,
    },
  });

  console.log('✅ Đã tạo 4 Test Runs: COMPLETED, IN_REVIEW, IN_PROGRESS, OPEN (Retest)');

  // ─────────────────────────────────────────────────────────────
  // 6. KHỞI TẠO DANH SÁCH BUGS VỚI ĐỦ CÁC TRẠNG THÁI & MỨC ĐỘ
  // ─────────────────────────────────────────────────────────────
  console.log('🐞 Khởi tạo danh sách Bugs đa dạng trạng thái...');

  const bug1 = await prisma.bug.create({
    data: {
      projectId: project1.id,
      testExecutionId: exec1_3.id,
      testCaseId: createdTestCases[2].id,
      code: 'BUG-1',
      title: 'Mã OTP qua email bị trễ hơn 5 phút trên server production',
      description: 'Khi người dùng đăng ký tài khoản với hòm thư Outlook/Hotmail, hàng đợi email bị nghẽn dẫn đến OTP hết hạn trước khi nhận được.',
      severity: BugSeverity.HIGH,
      status: BugStatus.OPEN,
      createdById: tester.id,
      assigneeId: dev.id,
      createdAt: threeDaysAgo,
    },
  });

  const bug2 = await prisma.bug.create({
    data: {
      projectId: project1.id,
      testExecutionId: exec2_3.id,
      testCaseId: createdTestCases[8].id,
      code: 'BUG-2',
      title: 'Vỡ giao diện xem trước khi in PDF trên trình duyệt Firefox',
      description: 'Layout CSS @media print bị tràn lề phải khoảng 15px trên Firefox phiên bản mới nhất, làm mất viền chữ ký.',
      severity: BugSeverity.MEDIUM,
      status: BugStatus.IN_PROGRESS,
      createdById: tester.id,
      assigneeId: dev.id,
      createdAt: oneDayAgo,
    },
  });

  const bug3 = await prisma.bug.create({
    data: {
      projectId: project1.id,
      code: 'BUG-3',
      title: 'Lỗi crash ứng dụng khi nhập mật khẩu quá 128 ký tự tại màn hình Đổi mật khẩu',
      description: 'Backend bcrypt bị treo quá tải khi mã hóa chuỗi byte quá dài không kiểm soát độ dài tối đa.',
      severity: BugSeverity.CRITICAL,
      status: BugStatus.RESOLVED,
      createdById: tester.id,
      assigneeId: dev.id,
      resolvedAt: oneDayAgo,
      createdAt: threeDaysAgo,
    },
  });

  const bug4 = await prisma.bug.create({
    data: {
      projectId: project1.id,
      code: 'BUG-4',
      title: 'Chậm tải danh sách bài test khi số lượng bản ghi vượt quá 500',
      description: 'Truy vấn thiếu index trên bảng TestExecution dẫn đến full table scan khi đếm tiến độ.',
      severity: BugSeverity.MEDIUM,
      status: BugStatus.VERIFIED,
      createdById: tester.id,
      assigneeId: dev.id,
      resolvedAt: oneDayAgo,
      createdAt: threeDaysAgo,
    },
  });

  const bug5 = await prisma.bug.create({
    data: {
      projectId: project1.id,
      code: 'BUG-5',
      title: 'Sai chính tả tiêu đề nút "Gửi yêu cầu duyệt đợt test"',
      description: 'Nhầm lẫn ký tự tiếng Việt có dấu trong file vi.json.',
      severity: BugSeverity.LOW,
      status: BugStatus.CLOSED,
      createdById: qaLead.id,
      assigneeId: dev.id,
      resolvedAt: twoDaysAgo(now),
      closedAt: oneDayAgo,
      createdAt: threeDaysAgo,
    },
  });

  const bug6 = await prisma.bug.create({
    data: {
      projectId: project1.id,
      code: 'BUG-6',
      title: 'Lỗi gửi OTP 2 lần khi người dùng bấm nút Xác nhận liên tục (Double Click)',
      description: 'Thiếu debounce và disable trạng thái nút khi request đang bay, dẫn đến 2 OTP được sinh ra cùng lúc.',
      severity: BugSeverity.HIGH,
      status: BugStatus.REOPENED,
      createdById: tester.id,
      assigneeId: dev.id,
      createdAt: twoDaysAgo(now),
    },
  });

  console.log('✅ Đã tạo 6 Bugs: OPEN, IN_PROGRESS, RESOLVED, VERIFIED, CLOSED, REOPENED');

  // ─────────────────────────────────────────────────────────────
  // 7. KHỞI TẠO THÔNG BÁO IN-APP (NOTIFICATIONS)
  // ─────────────────────────────────────────────────────────────
  console.log('🔔 Khởi tạo thông báo trong ứng dụng...');

  await prisma.notification.createMany({
    data: [
      {
        userId: tester.id,
        projectId: project1.id,
        title: 'Bạn được phân công đợt kiểm thử mới',
        message: 'QA Lead đã phân công bạn thực hiện đợt kiểm thử: "Sprint 4 - Dashboard & Security Regression".',
        type: NotificationType.TEST_RUN_ASSIGNED,
        link: `/projects/${project1.id}/test-runs/${run3.id}/runner`,
        isRead: false,
      },
      {
        userId: qaLead.id,
        projectId: project1.id,
        title: 'Đợt kiểm thử đang chờ bạn rà soát',
        message: 'Tester Tran Tester đã hoàn thành ca kiểm thử và gửi yêu cầu duyệt đợt: "Sprint 3 - Test Runner & Bug Verification".',
        type: NotificationType.TEST_RUN_REVIEW_REQUESTED,
        link: `/projects/${project1.id}/test-runs/${run2.id}/runner`,
        isRead: false,
      },
      {
        userId: dev.id,
        projectId: project1.id,
        title: 'Bạn được giao xử lý Bug mới',
        message: 'Tester đã gán bạn xử lý BUG-1: "Mã OTP qua email bị trễ hơn 5 phút trên server production".',
        type: NotificationType.BUG_ASSIGNED,
        link: `/projects/${project1.id}/bugs`,
        isRead: false,
      },
      {
        userId: tester.id,
        projectId: project1.id,
        title: 'Trạng thái Bug đã được cập nhật',
        message: 'Developer Le Developer đã chuyển BUG-3 sang trạng thái RESOLVED. Vui lòng kiểm tra lại.',
        type: NotificationType.BUG_STATUS_CHANGED,
        link: `/projects/${project1.id}/bugs`,
        isRead: true,
      },
    ],
  });

  console.log('✅ Đã tạo thông báo in-app cho Tester, QA Lead và Developer');

  console.log('\n🎉 Hoàn thành nạp dữ liệu mẫu!');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('Danh sách tài khoản kiểm thử:');
  console.log('1. Admin:     admin@testplatform.dev    / Admin123!');
  console.log('2. QA Lead:   qa.lead@testplatform.dev  / QaLead123!');
  console.log('3. Tester:    tester@testplatform.dev   / Tester123!');
  console.log('4. Developer: dev@testplatform.dev       / Dev12345!');
  console.log('5. Viewer:    viewer@testplatform.dev   / Viewer123!');
  console.log('═══════════════════════════════════════════════════════════');
}

function twoDaysAgo(now: Date): Date {
  return new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
