import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import type { Bug, BugSeverity, BugStatus, BugSummary, Project } from '../types';
import { BugModal } from '../components/bugs/BugModal';
import { BugDetailDrawer } from '../components/bugs/BugDetailDrawer';

export const BugsPage: React.FC = () => {
  const { id: paramProjectId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const queryBugId = searchParams.get('bugId') || searchParams.get('id');
  const navigate = useNavigate();

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(paramProjectId || '');
  const [bugs, setBugs] = useState<Bug[]>([]);
  const [summary, setSummary] = useState<BugSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalBugs, setTotalBugs] = useState<number>(0);

  // Modal / Drawer state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingBug, setEditingBug] = useState<Bug | null>(null);
  const [selectedBug, setSelectedBug] = useState<Bug | null>(null);

  // Fetch projects list
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

  const fetchBugs = async () => {
    if (!selectedProjectId) return;
    setLoading(true);
    try {
      const params: any = {
        page,
        limit: 15,
      };
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (severityFilter !== 'ALL') params.severity = severityFilter;

      const [bugsRes, summaryRes] = await Promise.all([
        apiClient.get(`/projects/${selectedProjectId}/bugs`, { params }),
        apiClient.get(`/projects/${selectedProjectId}/bugs/summary`),
      ]);

      setBugs(bugsRes.data.data || []);
      setTotalPages(bugsRes.data.totalPages || 1);
      setTotalBugs(bugsRes.data.total || 0);
      setSummary(summaryRes.data);

      // If queryBugId was passed via URL (e.g. from notification click), open it
      if (queryBugId) {
        const target = (bugsRes.data.data || []).find((b: Bug) => b.id === queryBugId);
        if (target) {
          setSelectedBug(target);
        } else {
          // Fetch single
          apiClient
            .get(`/projects/${selectedProjectId}/bugs/${queryBugId}`)
            .then((r) => setSelectedBug(r.data))
            .catch(() => {});
        }
      }
    } catch (err) {
      console.error('Failed to load bugs', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBugs();
  }, [selectedProjectId, page, statusFilter, severityFilter]);

  // Debounced search trigger
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchBugs();
  };

  const currentProject = projects.find((p) => p.id === selectedProjectId);

  const getSeverityBadge = (sev: BugSeverity) => {
    switch (sev) {
      case 'CRITICAL':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'HIGH':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'MEDIUM':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStatusBadge = (st: BugStatus) => {
    switch (st) {
      case 'OPEN':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'IN_PROGRESS':
        return 'bg-indigo-100 text-indigo-700 border-indigo-200';
      case 'RESOLVED':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'CLOSED':
        return 'bg-teal-100 text-teal-800 border-teal-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

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
            <span className="text-slate-800 font-semibold">Bugs & Defects</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>🐛</span> Quản lý Lỗi & Khuyết Tật (Bugs)
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedProjectId}
            onChange={(e) => {
              setSelectedProjectId(e.target.value);
              navigate(`/projects/${e.target.value}/bugs`);
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
            onClick={() => {
              setEditingBug(null);
              setIsModalOpen(true);
            }}
            disabled={!selectedProjectId}
            className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <span>➕</span> Báo Cáo Bug Mới
          </button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <p className="text-xs text-slate-500 font-medium">Tổng Số Bug</p>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">{summary.total}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <p className="text-xs text-rose-600 font-medium">Đang Mở / Đang Sửa</p>
            <p className="text-2xl font-extrabold text-rose-600 mt-1">{summary.activeBugs}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <p className="text-xs text-emerald-600 font-medium">Đã Sửa & Đã Đóng</p>
            <p className="text-2xl font-extrabold text-emerald-600 mt-1">
              {summary.byStatus.RESOLVED + summary.byStatus.CLOSED}
            </p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <p className="text-xs text-purple-600 font-medium">Khẩn cấp (Critical / High)</p>
            <p className="text-2xl font-extrabold text-purple-600 mt-1">
              {summary.bySeverity.CRITICAL + summary.bySeverity.HIGH}
            </p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <p className="text-xs text-emerald-600 font-medium">Tỷ Lệ Giải Quyết</p>
            <p className="text-2xl font-extrabold text-emerald-600 mt-1">{summary.resolvedRate}%</p>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="flex-1 flex items-center gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="🔍 Tìm theo mã (BUG-1) hoặc từ khóa tiêu đề/mô tả..."
            className="w-full max-w-md px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
          >
            Tìm
          </button>
        </form>

        <div className="flex items-center gap-3">
          {/* Status filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500 font-medium">Trạng thái:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">Tất cả</option>
              <option value="OPEN">Mở (Open)</option>
              <option value="IN_PROGRESS">Đang xử lý</option>
              <option value="RESOLVED">Đã sửa</option>
              <option value="CLOSED">Đã đóng</option>
            </select>
          </div>

          {/* Severity filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500 font-medium">Mức độ:</span>
            <select
              value={severityFilter}
              onChange={(e) => {
                setSeverityFilter(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">Tất cả</option>
              <option value="LOW">Thấp</option>
              <option value="MEDIUM">Trung bình</option>
              <option value="HIGH">Nghiêm trọng</option>
              <option value="CRITICAL">Khẩn cấp</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bugs Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400">
            <span className="text-3xl block animate-spin mb-2">⚙️</span>
            <p className="text-sm">Đang tải danh sách lỗi...</p>
          </div>
        ) : bugs.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <span className="text-4xl block mb-2">🎉</span>
            <h4 className="font-bold text-slate-700 text-sm">Không có báo cáo lỗi nào</h4>
            <p className="text-xs text-slate-500 mt-1">
              Hệ thống hiện không ghi nhận lỗi nào phù hợp với bộ lọc đã chọn.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4">Mã</th>
                  <th className="py-3 px-4">Tiêu đề & Nguồn gốc liên kết</th>
                  <th className="py-3 px-4">Mức độ</th>
                  <th className="py-3 px-4">Trạng thái</th>
                  <th className="py-3 px-4">Người xử lý</th>
                  <th className="py-3 px-4">Người tạo</th>
                  <th className="py-3 px-4">Thời gian</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bugs.map((bug) => (
                  <tr
                    key={bug.id}
                    onClick={() => setSelectedBug(bug)}
                    className="hover:bg-slate-50/80 cursor-pointer transition group"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-rose-600 whitespace-nowrap">
                      {bug.code}
                    </td>

                    <td className="py-3 px-4 min-w-[280px]">
                      <p className="font-semibold text-slate-900 group-hover:text-indigo-600 transition line-clamp-1">
                        {bug.title}
                      </p>

                      {/* Origin badges */}
                      <div className="flex items-center gap-2 mt-1">
                        {bug.testExecution ? (
                          <span className="text-[10px] text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200/60 flex items-center gap-1 font-medium">
                            <span>▶️</span> Run:{' '}
                            {bug.testExecution.testRun?.title || bug.testExecution.testRun?.name || 'Đợt test'} ·{' '}
                            {bug.testExecution.testCaseCode}
                          </span>
                        ) : bug.testCase ? (
                          <span className="text-[10px] text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200/60 font-medium">
                            📑 {bug.testCase.code}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Độc lập</span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${getSeverityBadge(
                          bug.severity,
                        )}`}
                      >
                        {bug.severity}
                      </span>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${getStatusBadge(
                          bug.status,
                        )}`}
                      >
                        {bug.status === 'OPEN'
                          ? 'Mở'
                          : bug.status === 'IN_PROGRESS'
                          ? 'Đang sửa'
                          : bug.status === 'RESOLVED'
                          ? 'Đã sửa'
                          : 'Đã đóng'}
                      </span>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      {bug.assignee ? (
                        <div className="flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[9px]">
                            {bug.assignee.fullName?.charAt(0) || 'A'}
                          </span>
                          <span className="text-slate-800 font-medium">{bug.assignee.fullName}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Chưa chỉ định</span>
                      )}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                      {bug.createdBy?.fullName}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap text-slate-500">
                      {new Date(bug.createdAt).toLocaleDateString('vi-VN')}
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setSelectedBug(bug)}
                        className="px-2.5 py-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-md transition mr-1.5"
                      >
                        Chi tiết
                      </button>
                      <button
                        onClick={() => {
                          setEditingBug(bug);
                          setIsModalOpen(true);
                        }}
                        className="px-2 py-1 text-[11px] text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition"
                      >
                        ✏️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination bar */}
        {totalPages > 1 && (
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
            <span className="text-slate-500">
              Tổng số <span className="font-semibold text-slate-800">{totalBugs}</span> lỗi · Trang{' '}
              <span className="font-semibold text-slate-800">{page}</span> / {totalPages}
            </span>

            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 border border-slate-300 rounded-md bg-white hover:bg-slate-100 disabled:opacity-40 transition font-medium"
              >
                ← Trước
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1 border border-slate-300 rounded-md bg-white hover:bg-slate-100 disabled:opacity-40 transition font-medium"
              >
                Sau →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bug Modal (Create / Edit) */}
      {isModalOpen && (
        <BugModal
          projectId={selectedProjectId}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingBug(null);
          }}
          initialBug={editingBug}
          onSaved={() => {
            fetchBugs();
          }}
        />
      )}

      {/* Bug Detail Drawer */}
      {selectedBug && (
        <BugDetailDrawer
          projectId={selectedProjectId}
          bug={selectedBug}
          isOpen={!!selectedBug}
          onClose={() => setSelectedBug(null)}
          onUpdated={(updated) => {
            setSelectedBug(updated);
            fetchBugs();
          }}
          onEdit={(bug) => {
            setSelectedBug(null);
            setEditingBug(bug);
            setIsModalOpen(true);
          }}
          onDeleted={() => {
            fetchBugs();
          }}
        />
      )}
    </div>
  );
};
