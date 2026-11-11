import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  CartesianGrid,
} from 'recharts';
import { apiClient } from '../api/client';
import type { DashboardSummary, Project } from '../types';
import { TestRunReportModal } from '../components/reports/TestRunReportModal';

// Colors for Charts
const EXECUTION_COLORS: Record<string, string> = {
  PASSED: '#10B981', // emerald-500
  FAILED: '#EF4444', // rose-500
  BLOCKED: '#F59E0B', // amber-500
  SKIPPED: '#94A3B8', // slate-400
  UNTESTED: '#CBD5E1', // slate-300
};

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: '#BE123C', // rose-700
  HIGH: '#F97316', // orange-500
  MEDIUM: '#FBBF24', // amber-400
  LOW: '#06B6D4', // cyan-500
};

export const DashboardPage: React.FC = () => {
  const { id: routeProjectId } = useParams<{ id: string }>();

  // Selected project state
  const [selectedProjectId, setSelectedProjectId] = useState<string>(routeProjectId || '');

  // Report modal state
  const [selectedRunIdForReport, setSelectedRunIdForReport] = useState<string | null>(null);

  // Fetch all projects for the dropdown
  const { data: projectsData, isLoading: isProjectsLoading } = useQuery<{ data: Project[] }>({
    queryKey: ['projects-list'],
    queryFn: async () => {
      const res = await apiClient.get<{ data: Project[] }>('/projects?limit=100');
      return res.data;
    },
  });

  const projects = projectsData?.data || [];

  // Auto-select first project if none selected
  const activeProjectId = selectedProjectId || routeProjectId || projects[0]?.id || '';

  // Fetch Dashboard Summary for selected project
  const {
    data: dashboard,
    isLoading: isDashboardLoading,
    error: dashboardError,
    refetch,
  } = useQuery<DashboardSummary>({
    queryKey: ['project-dashboard', activeProjectId],
    queryFn: async () => {
      const res = await apiClient.get<DashboardSummary>(
        `/projects/${activeProjectId}/dashboard`,
      );
      return res.data;
    },
    enabled: !!activeProjectId,
  });

  // Data for Execution Donut Chart
  const executionPieData = dashboard
    ? [
        { name: 'Đạt (Passed)', value: dashboard.overview.executionsByStatus.PASSED, color: EXECUTION_COLORS.PASSED },
        { name: 'Thất bại (Failed)', value: dashboard.overview.executionsByStatus.FAILED, color: EXECUTION_COLORS.FAILED },
        { name: 'Bị chặn (Blocked)', value: dashboard.overview.executionsByStatus.BLOCKED, color: EXECUTION_COLORS.BLOCKED },
        { name: 'Bỏ qua (Skipped)', value: dashboard.overview.executionsByStatus.SKIPPED, color: EXECUTION_COLORS.SKIPPED },
        { name: 'Chưa chạy (Untested)', value: dashboard.overview.executionsByStatus.UNTESTED, color: EXECUTION_COLORS.UNTESTED },
      ].filter((d) => d.value > 0)
    : [];

  // Data for Bug Severity Bar Chart
  const bugSeverityData = dashboard
    ? [
        { name: 'Critical', count: dashboard.overview.bugsBySeverity.CRITICAL, fill: SEVERITY_COLORS.CRITICAL },
        { name: 'High', count: dashboard.overview.bugsBySeverity.HIGH, fill: SEVERITY_COLORS.HIGH },
        { name: 'Medium', count: dashboard.overview.bugsBySeverity.MEDIUM, fill: SEVERITY_COLORS.MEDIUM },
        { name: 'Low', count: dashboard.overview.bugsBySeverity.LOW, fill: SEVERITY_COLORS.LOW },
      ]
    : [];

  // Data for Recent Runs Comparison Chart
  const recentRunsChartData = dashboard?.recentRuns
    .slice()
    .reverse()
    .map((run) => ({
      name: run.name.length > 15 ? `${run.name.slice(0, 15)}...` : run.name,
      'Đạt (Passed)': run.passed,
      'Thất bại (Failed)': run.failed,
      'Bị chặn (Blocked)': run.blocked,
      passRate: run.passRate,
    })) || [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-2xl shadow-sm">
            📊
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Dashboard & Thống Kê Kiểm Thử</h1>
            <p className="text-xs text-slate-500">
              Tổng quan chỉ số chất lượng, tỷ lệ Pass/Fail, phân bố lỗi và tiến độ dự án
            </p>
          </div>
        </div>

        {/* Project Selector & Actions */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="project-select" className="text-xs font-semibold text-slate-500 uppercase shrink-0">
              Dự án:
            </label>
            <select
              id="project-select"
              value={activeProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.status === 'ARCHIVED' ? '(Lưu trữ)' : ''}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => refetch()}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition border border-slate-200"
            title="Làm mới dữ liệu"
          >
            🔄
          </button>
        </div>
      </div>

      {isProjectsLoading || (isDashboardLoading && !dashboard) ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center shadow-xs">
          <div className="text-4xl animate-bounce mb-3">📊</div>
          <p className="text-sm font-semibold text-slate-700">Đang tổng hợp dữ liệu thống kê...</p>
        </div>
      ) : !activeProjectId ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center shadow-xs">
          <div className="text-4xl mb-3">📁</div>
          <p className="text-sm font-semibold text-slate-700">Chưa có dự án nào để thống kê.</p>
          <Link
            to="/projects"
            className="inline-block mt-3 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs"
          >
            Xem danh sách dự án
          </Link>
        </div>
      ) : dashboardError ? (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-8 text-center text-rose-700 text-sm">
          Không thể tải dữ liệu thống kê cho dự án này. Vui lòng thử lại sau.
        </div>
      ) : dashboard ? (
        <>
          {/* KPI CARDS GRID */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Card 1: Pass Rate */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs relative overflow-hidden">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase">
                <span>Tỷ Lệ Đạt (Pass Rate)</span>
                <span className="text-lg">🎯</span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span
                  className={`text-3xl font-black ${
                    dashboard.overview.passRate >= 80
                      ? 'text-emerald-600'
                      : dashboard.overview.passRate >= 60
                      ? 'text-amber-600'
                      : 'text-rose-600'
                  }`}
                >
                  {dashboard.overview.passRate}%
                </span>
                <span className="text-xs text-slate-400">
                  ({dashboard.overview.executionsByStatus.PASSED} /{' '}
                  {dashboard.overview.totalExecutions - dashboard.overview.executionsByStatus.UNTESTED} đã chạy)
                </span>
              </div>
              {/* Mini progress bar */}
              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    dashboard.overview.passRate >= 80
                      ? 'bg-emerald-500'
                      : dashboard.overview.passRate >= 60
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                  }`}
                  style={{ width: `${Math.min(dashboard.overview.passRate, 100)}%` }}
                />
              </div>
            </div>

            {/* Card 2: Test Runs */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase">
                <span>Đợt Kiểm Thử (Runs)</span>
                <span className="text-lg">▶️</span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-800">
                  {dashboard.overview.totalTestRuns}
                </span>
                <span className="text-xs text-emerald-600 font-medium">
                  {dashboard.overview.testRunsByStatus.COMPLETED} hoàn thành
                </span>
              </div>
              <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
                <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">
                  {dashboard.overview.testRunsByStatus.IN_PROGRESS} đang chạy
                </span>
                <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-medium">
                  {dashboard.overview.testRunsByStatus.IN_REVIEW} chờ duyệt
                </span>
              </div>
            </div>

            {/* Card 3: Test Cases */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase">
                <span>Kho Test Cases</span>
                <span className="text-lg">🧪</span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-800">
                  {dashboard.overview.totalTestCases}
                </span>
                <span className="text-xs text-slate-400">
                  trong {dashboard.overview.totalTestSuites} modules
                </span>
              </div>
              <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
                <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium">
                  {dashboard.overview.testCasesByStatus.READY} sẵn sàng
                </span>
                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                  {dashboard.overview.testCasesByStatus.DRAFT} bản nháp
                </span>
              </div>
            </div>

            {/* Card 4: Bugs */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase">
                <span>Lỗi Phát Hiện (Bugs)</span>
                <span className="text-lg">🐞</span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-black text-rose-600">
                  {dashboard.overview.totalBugs}
                </span>
                <span className="text-xs text-rose-500 font-medium">
                  ({dashboard.overview.activeBugs} đang mở)
                </span>
              </div>
              <div className="mt-3 flex items-center gap-2 text-[11px]">
                <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-bold">
                  {dashboard.overview.bugsBySeverity.CRITICAL} Critical
                </span>
                <span className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-800 font-medium">
                  {dashboard.overview.bugsBySeverity.HIGH} High
                </span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium">
                  {dashboard.overview.resolvedBugs} đã sửa
                </span>
              </div>
            </div>
          </div>

          {/* CHARTS ROW 1: EXECUTION PIE & BUG SEVERITY BAR */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Donut Chart: Execution Status */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <span>🍩</span> Phân Bố Kết Quả Kiểm Thử (Test Executions)
                </h3>
                <span className="text-xs text-slate-400">
                  Tổng: {dashboard.overview.totalExecutions} lượt test
                </span>
              </div>

              {executionPieData.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400">
                  Chưa có dữ liệu thực thi kiểm thử nào trong dự án này.
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={executionPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {executionPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val: any, name: any) => [`${val} ca`, name]}
                        contentStyle={{
                          backgroundColor: '#0F172A',
                          borderRadius: '8px',
                          color: '#fff',
                          fontSize: '12px',
                        }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        formatter={(value) => <span className="text-xs text-slate-600">{value}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Bar Chart: Bug Severity Distribution */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <span>📊</span> Phân Bố Bug Theo Mức Độ Nghiêm Trọng
                </h3>
                <span className="text-xs text-slate-400">
                  {dashboard.overview.totalBugs} bugs ghi nhận
                </span>
              </div>

              {dashboard.overview.totalBugs === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400">
                  Chưa ghi nhận bug nào trong dự án này.
                </div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={bugSeverityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                      <Tooltip
                        formatter={(value: any) => [`${value} lỗi`, 'Số lượng']}
                        contentStyle={{
                          backgroundColor: '#0F172A',
                          borderRadius: '8px',
                          color: '#fff',
                          fontSize: '12px',
                        }}
                      />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                        {bugSeverityData.map((entry, index) => (
                          <Cell key={`cell-bar-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* CHARTS ROW 2: EXECUTION VELOCITY & RECENT RUNS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Area Chart: 14-day Execution Velocity */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <span>📈</span> Tốc Độ Thực Thi Kiểm Thử (14 Ngày Gần Nhất)
                </h3>
                <span className="text-xs text-slate-400">Velocity theo ngày</span>
              </div>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={dashboard.executionTrend}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorPassed" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#EF4444" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(d) => d.slice(5)}
                      tick={{ fontSize: 10, fill: '#64748B' }}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                    <Tooltip
                      labelFormatter={(l) => `Ngày: ${l}`}
                      contentStyle={{
                        backgroundColor: '#0F172A',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '12px',
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={30}
                      formatter={(value) => <span className="text-xs text-slate-600">{value}</span>}
                    />
                    <Area
                      type="monotone"
                      dataKey="passed"
                      name="Đạt (Pass)"
                      stroke="#10B981"
                      fillOpacity={1}
                      fill="url(#colorPassed)"
                    />
                    <Area
                      type="monotone"
                      dataKey="failed"
                      name="Hỏng (Fail)"
                      stroke="#EF4444"
                      fillOpacity={1}
                      fill="url(#colorFailed)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Bar Chart: Recent Runs Pass/Fail Comparison */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <span>🏁</span> So Sánh Tỷ Lệ Đợt Test Gần Nhất
                </h3>
                <span className="text-xs text-slate-400">
                  {recentRunsChartData.length} đợt chạy gần đây
                </span>
              </div>

              {recentRunsChartData.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400">
                  Chưa có đợt test nào được tạo trong dự án này.
                </div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={recentRunsChartData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748B' }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0F172A',
                          borderRadius: '8px',
                          color: '#fff',
                          fontSize: '12px',
                        }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={30}
                        formatter={(value) => <span className="text-xs text-slate-600">{value}</span>}
                      />
                      <Bar dataKey="Đạt (Passed)" fill="#10B981" stackId="a" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="Thất bại (Failed)" fill="#EF4444" stackId="a" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="Bị chặn (Blocked)" fill="#F59E0B" stackId="a" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* TESTER WORKLOAD & RECENT TEST RUNS LIST */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tester Workload Table */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <span>👥</span> Năng Suất Kiểm Thử Thành Viên ({dashboard.testerWorkload.length})
                </h3>
                <span className="text-xs text-slate-400">Đóng góp thực thi</span>
              </div>

              {dashboard.testerWorkload.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  Chưa có thành viên nào thực hiện test trong dự án này.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 text-xs">
                  {dashboard.testerWorkload.map((t) => (
                    <div key={t.user.id} className="p-4 flex items-center justify-between gap-3 hover:bg-slate-50/50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center shrink-0">
                          {t.user.fullName.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{t.user.fullName}</div>
                          <div className="text-[11px] text-slate-400">{t.user.email}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-right">
                        <div>
                          <span className="font-bold text-slate-800 text-sm">{t.totalExecuted}</span>
                          <span className="text-[10px] text-slate-400 block">ca đã chạy</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold">
                            {t.passed} P
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 font-bold">
                            {t.failed} F
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold">
                            {t.bugsReported} 🐞
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Test Runs Quick Access */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <span>🚀</span> Đợt Test Gần Nhất & Báo Cáo
                </h3>
                <Link
                  to={`/projects/${activeProjectId}/test-runs`}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold"
                >
                  Xem tất cả →
                </Link>
              </div>

              {dashboard.recentRuns.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  Chưa có đợt test nào trong dự án này.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 text-xs">
                  {dashboard.recentRuns.map((run) => (
                    <div key={run.id} className="p-4 flex items-center justify-between gap-3 hover:bg-slate-50/50">
                      <div>
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                          <span>{run.name}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              run.status === 'COMPLETED'
                                ? 'bg-slate-100 text-slate-700'
                                : run.status === 'IN_REVIEW'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {run.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-3">
                          <span>Giao cho: {run.assignedTo?.fullName || 'Chưa gán'}</span>
                          <span>•</span>
                          <span>{run.totalTests} ca test</span>
                          <span>•</span>
                          <span className="text-emerald-600 font-semibold">Pass: {run.passRate}%</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedRunIdForReport(run.id)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition text-xs flex items-center gap-1 shadow-2xs"
                          title="Xem & Xuất báo cáo tổng kết"
                        >
                          <span>📑</span> Báo Cáo
                        </button>
                        <Link
                          to={`/projects/${activeProjectId}/test-runs/${run.id}/runner`}
                          className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg font-medium transition text-xs flex items-center gap-1"
                        >
                          <span>▶️</span> Runner
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}

      {/* Test Run Report Modal */}
      {selectedRunIdForReport && (
        <TestRunReportModal
          projectId={activeProjectId}
          runId={selectedRunIdForReport}
          isOpen={!!selectedRunIdForReport}
          onClose={() => setSelectedRunIdForReport(null)}
        />
      )}
    </div>
  );
};
