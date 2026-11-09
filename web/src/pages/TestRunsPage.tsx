import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import type { TestRun, Project } from '../types';
import { CreateTestRunModal } from '../components/test-runs/CreateTestRunModal';

export const TestRunsPage: React.FC = () => {
  const { id: paramProjectId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(paramProjectId || '');
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Load user projects if no paramProjectId or to allow switching
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

  const fetchRuns = async () => {
    if (!selectedProjectId) return;
    setLoading(true);
    try {
      const params: any = { limit: 50 };
      if (statusFilter !== 'ALL') {
        params.status = statusFilter;
      }
      const res = await apiClient.get(`/projects/${selectedProjectId}/test-runs`, { params });
      setRuns(res.data.data || []);
    } catch (err) {
      console.error('Failed to load test runs', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns();
  }, [selectedProjectId, statusFilter]);

  const handleCompleteRun = async (runId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn kết thúc đợt kiểm thử này không?')) return;
    setActionLoading(runId);
    try {
      await apiClient.patch(`/projects/${selectedProjectId}/test-runs/${runId}`, {
        status: 'COMPLETED',
      });
      fetchRuns();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể đóng đợt kiểm thử');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteRun = async (runId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa vĩnh viễn đợt kiểm thử này cùng toàn bộ kết quả?')) return;
    setActionLoading(runId);
    try {
      await apiClient.delete(`/projects/${selectedProjectId}/test-runs/${runId}`);
      fetchRuns();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể xóa đợt kiểm thử');
    } finally {
      setActionLoading(null);
    }
  };

  const currentProject = projects.find((p) => p.id === selectedProjectId);

  // Summary statistics
  const totalRuns = runs.length;
  const inProgressRuns = runs.filter((r) => r.status === 'IN_PROGRESS').length;
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
          <p className="text-xs text-emerald-600 font-medium">Đã Hoàn Thành</p>
          <p className="text-2xl font-extrabold text-emerald-600 mt-1">{completedRuns}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-xs text-slate-500 font-medium">Tổng Lượt Test</p>
          <p className="text-2xl font-extrabold text-slate-900 mt-1">{totalExecutions}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-xs text-emerald-600 font-medium">Tỷ Lệ Đạt (Pass Rate)</p>
          <p className="text-2xl font-extrabold text-emerald-600 mt-1">{avgPassRate}%</p>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        {[
          { key: 'ALL', label: 'Tất cả trạng thái' },
          { key: 'OPEN', label: 'Chưa bắt đầu (Open)' },
          { key: 'IN_PROGRESS', label: 'Đang thực thi' },
          { key: 'COMPLETED', label: 'Đã hoàn thành' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              statusFilter === tab.key
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
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
          <h3 className="text-base font-bold text-slate-800">Chưa có đợt kiểm thử nào</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Tạo một Test Run mới để bắt đầu thực thi các ca kiểm thử, ghi nhận kết quả và phát hiện lỗi.
          </p>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition inline-flex items-center gap-1.5"
          >
            <span>➕</span> Tạo Test Run Đầu Tiên
          </button>
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

            return (
              <div
                key={run.id}
                className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-indigo-200 transition group"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          run.status === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-700'
                            : run.status === 'IN_PROGRESS'
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {run.status === 'COMPLETED'
                          ? 'Đã hoàn thành'
                          : run.status === 'IN_PROGRESS'
                          ? 'Đang thực thi'
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
                      <Link
                        to={`/projects/${selectedProjectId}/test-runs/${run.id}/runner`}
                        className="px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition flex items-center gap-1.5"
                      >
                        <span>▶️</span> Test Runner
                      </Link>

                      {!isCompleted && (
                        <button
                          onClick={() => handleCompleteRun(run.id)}
                          disabled={actionLoading === run.id}
                          className="px-3 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition"
                          title="Hoàn thành đợt kiểm thử"
                        >
                          ✓ Xong
                        </button>
                      )}

                      <button
                        onClick={() => handleDeleteRun(run.id)}
                        disabled={actionLoading === run.id}
                        className="p-2 text-xs font-medium text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title="Xóa đợt kiểm thử"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
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
