import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { TestRun, Project, ProjectMember } from '../types';
import { CreateTestRunModal } from '../components/test-runs/CreateTestRunModal';

export const TestRunsPage: React.FC = () => {
  const { id: paramProjectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(paramProjectId || '');
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Load user projects
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await apiClient.get('/projects');
        const list = res.data.data || res.data || [];
        setProjects(list);
        if (!selectedProjectId && list.length > 0) {
          setSelectedProjectId(list[0].id);
        }
      } catch (err) {
        console.error('Failed to load projects', err);
      }
    };
    fetchProjects();
  }, []);

  useEffect(() => {
    if (paramProjectId) {
      setSelectedProjectId(paramProjectId);
    }
  }, [paramProjectId]);

  // Load project members to determine user permissions
  useEffect(() => {
    if (!selectedProjectId) return;
    const fetchMembers = async () => {
      try {
        const res = await apiClient.get(`/projects/${selectedProjectId}/members`);
        setMembers(res.data || []);
      } catch (err) {
        console.error('Failed to load project members', err);
        setMembers([]);
      }
    };
    fetchMembers();
  }, [selectedProjectId]);

  const currentProject = projects.find((p) => p.id === selectedProjectId);
  const currentUserMember = members.find((m) => m.userId === user?.id);
  const isQALeadOrAdmin =
    user?.systemRole === 'ADMIN' ||
    currentUserMember?.role === 'QA_LEAD' ||
    currentProject?.createdById === user?.id;

  const fetchRuns = async () => {
    if (!selectedProjectId) return;
    setLoading(true);
    try {
      const params: any = { limit: 50 };
      if (statusFilter !== 'ALL') {
        params.status = statusFilter;
      }
      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }
      const res = await apiClient.get(`/projects/${selectedProjectId}/test-runs`, { params });
      setRuns(res.data.data || []);
    } catch (err) {
      console.error('Failed to load test runs', err);
    } finally {
      setLoading(false);
    }
  };

  // Debounced search / trigger on filter change
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRuns();
    }, 300);
    return () => clearTimeout(timer);
  }, [selectedProjectId, statusFilter, searchQuery]);

  // Actions
  const handleSubmitForReview = async (runId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn gửi đợt kiểm thử này cho QA Lead rà soát không?')) return;
    setActionLoading(runId);
    try {
      await apiClient.post(`/projects/${selectedProjectId}/test-runs/${runId}/submit-for-review`);
      alert('Đã gửi yêu cầu rà soát thành công tới QA Lead!');
      await fetchRuns();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể gửi yêu cầu duyệt');
    } finally {
      setActionLoading(null);
    }
  };

  const handleApproveAndClose = async (runId: string) => {
    if (
      !window.confirm(
        'Bạn có chắc chắn muốn chốt và đóng đợt kiểm thử này? Dữ liệu sẽ được khóa ở chế độ Read-only và Tester không thể sửa đổi kết quả.',
      )
    )
      return;
    setActionLoading(runId);
    try {
      await apiClient.post(`/projects/${selectedProjectId}/test-runs/${runId}/approve-and-close`);
      alert('Đã chốt và đóng đợt kiểm thử thành công!');
      await fetchRuns();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể chốt đợt kiểm thử');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateRetest = async (runId: string, runName: string) => {
    if (
      !window.confirm(
        `Bạn có muốn tạo đợt Retest mới từ "${runName}"? Hệ thống sẽ tự động lọc và clone các ca kiểm thử có kết quả FAIL hoặc BLOCKED sang đợt mới.`,
      )
    )
      return;
    setActionLoading(runId);
    try {
      const res = await apiClient.post(`/projects/${selectedProjectId}/test-runs/${runId}/retest`);
      const newRun = res.data;
      alert(`Đã tạo thành công đợt Retest: "${newRun.name}" với ${newRun.executions?.length || 0} ca kiểm thử!`);
      await fetchRuns();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể tạo đợt Retest');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteRun = async (runId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa vĩnh viễn đợt kiểm thử này cùng toàn bộ kết quả?')) return;
    setActionLoading(runId);
    try {
      await apiClient.delete(`/projects/${selectedProjectId}/test-runs/${runId}`);
      await fetchRuns();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể xóa đợt kiểm thử');
    } finally {
      setActionLoading(null);
    }
  };

  // Summary statistics
  const totalRuns = runs.length;
  const inProgressRuns = runs.filter((r) => r.status === 'IN_PROGRESS').length;
  const inReviewRuns = runs.filter((r) => r.status === 'IN_REVIEW').length;
  const completedRuns = runs.filter((r) => r.status === 'COMPLETED').length;
  const totalExecutions = runs.reduce((sum, r) => sum + (r.stats?.total || 0), 0);
  const totalPassed = runs.reduce((sum, r) => sum + (r.stats?.passed || 0), 0);
  const avgPassRate = totalExecutions > 0 ? Math.round((totalPassed / totalExecutions) * 100) : 0;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Breadcrumb & Project Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <Link to="/projects" className="hover:text-indigo-600 transition">
              Dự án
            </Link>
            <span>/</span>
            {currentProject && (
              <Link to={`/projects/${currentProject.id}`} className="hover:text-indigo-600 transition">
                {currentProject.name}
              </Link>
            )}
            <span>/</span>
            <span className="text-slate-800 font-semibold">Test Runs</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>▶️</span> Quản lý Đợt Kiểm Thử (Test Runs)
          </h2>
        </div>

        <div className="flex items-center gap-3">
          {/* Project dropdown switcher */}
          <select
            value={selectedProjectId}
            onChange={(e) => {
              setSelectedProjectId(e.target.value);
              navigate(`/projects/${e.target.value}/test-runs`);
            }}
            className="px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-lg text-slate-700 shadow-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                📁 {p.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => setIsCreateOpen(true)}
            disabled={!selectedProjectId}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <span>➕</span> Tạo Test Run Mới
          </button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-xs text-slate-500 font-medium">Tổng Đợt Chạy</p>
          <p className="text-2xl font-extrabold text-slate-900 mt-1">{totalRuns}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-xs text-indigo-600 font-medium">Đang Chạy</p>
          <p className="text-2xl font-extrabold text-indigo-600 mt-1">{inProgressRuns}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-xs text-amber-600 font-medium">Chờ QA Duyệt</p>
          <p className="text-2xl font-extrabold text-amber-600 mt-1">{inReviewRuns}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-xs text-emerald-600 font-medium">Đã Hoàn Thành</p>
          <p className="text-2xl font-extrabold text-emerald-600 mt-1">{completedRuns}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-xs text-emerald-600 font-medium">Tỷ Lệ Đạt (Pass)</p>
          <p className="text-2xl font-extrabold text-emerald-600 mt-1">{avgPassRate}%</p>
        </div>
      </div>

      {/* Toolbar: Filter Tabs + Search Input */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { key: 'ALL', label: 'Tất cả' },
            { key: 'OPEN', label: 'Chưa bắt đầu' },
            { key: 'IN_PROGRESS', label: 'Đang thực thi' },
            { key: 'IN_REVIEW', label: 'Chờ QA duyệt ⚠️' },
            { key: 'COMPLETED', label: 'Đã hoàn thành' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                statusFilter === tab.key
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input by Run Name or Assignee */}
        <div className="relative w-full sm:w-72 shrink-0">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 text-xs">
            🔍
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên đợt test, người test..."
            className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 shadow-2xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 text-xs"
              title="Xóa tìm kiếm"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* List of Test Runs */}
      {loading ? (
        <div className="py-16 text-center text-slate-400">
          <span className="text-3xl block animate-spin mb-2">⚙️</span>
          <p className="text-sm">Đang tải danh sách Test Run...</p>
        </div>
      ) : runs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
          <span className="text-4xl block mb-3">🧪</span>
          <h3 className="text-base font-bold text-slate-800">
            {searchQuery ? 'Không tìm thấy đợt kiểm thử phù hợp' : 'Chưa có đợt kiểm thử nào'}
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            {searchQuery
              ? 'Thử thay đổi từ khóa tìm kiếm hoặc bỏ bộ lọc trạng thái.'
              : 'Tạo một Test Run mới để bắt đầu thực thi các ca kiểm thử, ghi nhận kết quả và phát hiện lỗi.'}
          </p>
          {!searchQuery && (
            <button
              onClick={() => setIsCreateOpen(true)}
              className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition inline-flex items-center gap-1.5"
            >
              <span>➕</span> Tạo Test Run Đầu Tiên
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {runs.map((run) => {
            const stats = run.stats || {
              total: 0,
              passed: 0,
              failed: 0,
              blocked: 0,
              skipped: 0,
              untested: 0,
              passRate: 0,
            };

            const passedPct = stats.total > 0 ? (stats.passed / stats.total) * 100 : 0;
            const failedPct = stats.total > 0 ? (stats.failed / stats.total) * 100 : 0;
            const blockedPct = stats.total > 0 ? (stats.blocked / stats.total) * 100 : 0;
            const skippedPct = stats.total > 0 ? (stats.skipped / stats.total) * 100 : 0;
            const untestedPct = stats.total > 0 ? (stats.untested / stats.total) * 100 : 0;

            const isCompleted = run.status === 'COMPLETED';
            const isInReview = run.status === 'IN_REVIEW';

            return (
              <div
                key={run.id}
                className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-indigo-200 transition group space-y-3"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                          isCompleted
                            ? 'bg-emerald-100 text-emerald-800'
                            : isInReview
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : run.status === 'IN_PROGRESS'
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {isCompleted
                          ? '✓ Đã hoàn thành (Khóa)'
                          : isInReview
                          ? '⚠️ Chờ QA duyệt'
                          : run.status === 'IN_PROGRESS'
                          ? '⚡ Đang thực thi'
                          : 'Mở (Chưa chạy)'}
                      </span>

                      <h3 className="text-base font-bold text-slate-900 truncate">
                        {run.name}
                      </h3>

                      <span className="text-xs text-slate-400">
                        ({stats.total} ca kiểm thử)
                      </span>
                    </div>

                    {run.description && (
                      <p className="text-xs text-slate-600 line-clamp-1 mb-2">
                        {run.description}
                      </p>
                    )}

                    {/* Assignee & Dates */}
                    <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400">Giao cho:</span>
                        {run.assignedTo ? (
                          <span className="font-medium text-slate-800 flex items-center gap-1">
                            <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold">
                              {run.assignedTo.fullName?.charAt(0) || 'U'}
                            </span>
                            {run.assignedTo.fullName}
                          </span>
                        ) : (
                          <span className="italic text-slate-400">Chưa chỉ định</span>
                        )}
                      </div>

                      <span>•</span>
                      <span>Tạo lúc: {new Date(run.createdAt).toLocaleDateString('vi-VN')}</span>

                      {run.completedAt && (
                        <>
                          <span>•</span>
                          <span className="text-emerald-600 font-medium">
                            Xong lúc: {new Date(run.completedAt).toLocaleDateString('vi-VN')}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Progress & Actions */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-6 shrink-0">
                    {/* Visual Progress Bar */}
                    <div className="w-56 space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-slate-700">Tỷ lệ Đạt (Pass):</span>
                        <span className="text-emerald-600 font-bold">{stats.passRate}%</span>
                      </div>

                      {/* Stacked Progress Bar */}
                      <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                        <div
                          style={{ width: `${passedPct}%` }}
                          title={`Passed: ${stats.passed}`}
                          className="bg-emerald-500 transition-all duration-300"
                        />
                        <div
                          style={{ width: `${failedPct}%` }}
                          title={`Failed: ${stats.failed}`}
                          className="bg-rose-500 transition-all duration-300"
                        />
                        <div
                          style={{ width: `${blockedPct}%` }}
                          title={`Blocked: ${stats.blocked}`}
                          className="bg-amber-400 transition-all duration-300"
                        />
                        <div
                          style={{ width: `${skippedPct}%` }}
                          title={`Skipped: ${stats.skipped}`}
                          className="bg-slate-400 transition-all duration-300"
                        />
                        <div
                          style={{ width: `${untestedPct}%` }}
                          title={`Untested: ${stats.untested}`}
                          className="bg-slate-200 transition-all duration-300"
                        />
                      </div>

                      {/* Mini legend breakdown */}
                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                        <span className="text-emerald-700 font-medium">✓ {stats.passed}</span>
                        <span className="text-rose-700 font-medium">✗ {stats.failed}</span>
                        <span className="text-amber-700 font-medium">⊘ {stats.blocked}</span>
                        <span className="text-slate-500">⋯ {stats.untested}</span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2">
                      {/* COMPLETED State: Hide Test Runner and Xong. Show View Results + Retest */}
                      {isCompleted ? (
                        <>
                          <Link
                            to={`/projects/${selectedProjectId}/test-runs/${run.id}/runner`}
                            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition flex items-center gap-1.5"
                          >
                            <span>👁️</span> Xem kết quả
                          </Link>
                          <button
                            onClick={() => handleCreateRetest(run.id, run.name)}
                            disabled={actionLoading === run.id}
                            className="px-3 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition flex items-center gap-1.5 disabled:opacity-50"
                            title="Tạo đợt Retest mới từ các ca FAIL hoặc BLOCKED"
                          >
                            <span>🔄</span> Tạo Retest
                          </button>
                        </>
                      ) : isInReview ? (
                        /* IN_REVIEW State */
                        <>
                          {isQALeadOrAdmin ? (
                            <>
                              <Link
                                to={`/projects/${selectedProjectId}/test-runs/${run.id}/runner`}
                                className="px-3.5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm transition flex items-center gap-1.5"
                              >
                                <span>🔍</span> Rà soát (Review)
                              </Link>
                              <button
                                onClick={() => handleApproveAndClose(run.id)}
                                disabled={actionLoading === run.id}
                                className="px-3 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition flex items-center gap-1"
                                title="Chốt và đóng đợt kiểm thử"
                              >
                                ✓ Chốt đợt
                              </button>
                            </>
                          ) : (
                            <>
                              <Link
                                to={`/projects/${selectedProjectId}/test-runs/${run.id}/runner`}
                                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition flex items-center gap-1.5"
                              >
                                <span>👁️</span> Xem đợt test
                              </Link>
                              <span className="text-[11px] px-2.5 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg font-medium">
                                ⏳ Chờ QA duyệt
                              </span>
                            </>
                          )}
                        </>
                      ) : (
                        /* OPEN or IN_PROGRESS State */
                        <>
                          <Link
                            to={`/projects/${selectedProjectId}/test-runs/${run.id}/runner`}
                            className="px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition flex items-center gap-1.5"
                          >
                            <span>▶️</span> Test Runner
                          </Link>

                          {/* Submit for Review Button */}
                          <button
                            onClick={() => handleSubmitForReview(run.id)}
                            disabled={actionLoading === run.id}
                            className="px-3 py-2 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition flex items-center gap-1"
                            title="Gửi đợt test cho QA Lead rà soát"
                          >
                            📤 Gửi duyệt
                          </button>

                          {/* Direct Close for QA Lead/Admin */}
                          {isQALeadOrAdmin && (
                            <button
                              onClick={() => handleApproveAndClose(run.id)}
                              disabled={actionLoading === run.id}
                              className="px-3 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition flex items-center gap-1"
                              title="Chốt và đóng đợt kiểm thử"
                            >
                              ✓ Xong
                            </button>
                          )}
                        </>
                      )}

                      {/* Delete button (QA Lead or Creator) */}
                      {(isQALeadOrAdmin || run.createdById === user?.id) && (
                        <button
                          onClick={() => handleDeleteRun(run.id)}
                          disabled={actionLoading === run.id}
                          className="p-2 text-xs font-medium text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Xóa đợt kiểm thử"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Rework alert notification if requested by QA */}
                {run.reworkReason && run.status !== 'COMPLETED' && (
                  <div className="p-2.5 bg-rose-50/90 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-start gap-2 animate-fadeIn">
                    <span className="text-sm">❌</span>
                    <div>
                      <span className="font-bold">QA Lead yêu cầu làm lại: </span>
                      <span className="italic">{run.reworkReason}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal create run */}
      {isCreateOpen && (
        <CreateTestRunModal
          projectId={selectedProjectId}
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          onCreated={() => {
            fetchRuns();
          }}
        />
      )}
    </div>
  );
};
