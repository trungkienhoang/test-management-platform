import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { TestSuiteTree } from '../components/test-suites/TestSuiteTree';
import { TestCaseModal } from '../components/test-cases/TestCaseModal';
import { TestCaseDetailDrawer } from '../components/test-cases/TestCaseDetailDrawer';
import { ImportExportModal } from '../components/test-cases/ImportExportModal';
import type {
  Project,
  ProjectMember,
  TestCase,
  TestCasePriority,
  TestCaseStatus,
  TestSuiteTreeNode,
  PaginatedResponse,
} from '../types';

export const TestRepositoryPage: React.FC = () => {
  const { id: paramProjectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // If accessed via /test-suites without param, user can select project
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(paramProjectId || null);

  // Active Suite selection (null = all cases, 'none' = uncategorized, or suiteId)
  const [selectedSuiteId, setSelectedSuiteId] = useState<string | null>(null);

  // Filters state
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [tagFilter, setTagFilter] = useState<string>('');
  const [page, setPage] = useState(1);

  // Modals state
  const [isCaseModalOpen, setIsCaseModalOpen] = useState(false);
  const [editingTestCase, setEditingTestCase] = useState<TestCase | null>(null);
  const [viewingTestCaseId, setViewingTestCaseId] = useState<string | null>(null);
  const [isImportExportOpen, setIsImportExportOpen] = useState(false);
  const [importExportMode, setImportExportMode] = useState<'IMPORT' | 'EXPORT'>('IMPORT');

  // Fetch list of user projects (for project switcher if needed)
  const { data: projectsData, isLoading: isProjectsLoading } = useQuery<any>({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await apiClient.get('/projects');
      return res.data;
    },
  });

  const projects: Project[] = Array.isArray(projectsData)
    ? projectsData
    : Array.isArray(projectsData?.data)
      ? projectsData.data
      : [];

  // Effective project ID (fall back to first available project if none specified)
  const effectiveProjectId = paramProjectId || selectedProjectId || (projects.length > 0 ? projects[0].id : null);

  // Fetch current project details
  const { data: currentProject } = useQuery<Project>({
    queryKey: ['project', effectiveProjectId],
    queryFn: async () => {
      const res = await apiClient.get<Project>(`/projects/${effectiveProjectId}`);
      return res.data;
    },
    enabled: !!effectiveProjectId,
  });

  // Fetch current project members to check permissions
  const { data: rawMembers = [] } = useQuery<ProjectMember[]>({
    queryKey: ['project-members', effectiveProjectId],
    queryFn: async () => {
      const res = await apiClient.get<ProjectMember[]>(`/projects/${effectiveProjectId}/members`);
      return res.data;
    },
    enabled: !!effectiveProjectId,
  });

  const members = Array.isArray(rawMembers) ? rawMembers : [];
  const currentUserMember = members.find((m) => m.userId === user?.id);
  const canManage =
    user?.systemRole === 'ADMIN' ||
    currentUserMember?.role === 'QA_LEAD' ||
    currentProject?.createdById === user?.id;
  const canWrite = canManage || currentUserMember?.role === 'TESTER';

  // Fetch Test Suites for dropdowns
  const { data: rawSuites = [] } = useQuery<TestSuiteTreeNode[]>({
    queryKey: ['test-suites', effectiveProjectId],
    queryFn: async () => {
      const res = await apiClient.get<TestSuiteTreeNode[]>(`/projects/${effectiveProjectId}/suites`);
      return res.data;
    },
    enabled: !!effectiveProjectId,
  });

  const suites = Array.isArray(rawSuites) ? rawSuites : [];

  // Fetch Test Cases with search, filter, and pagination
  const { data: casesData, isLoading: isCasesLoading } = useQuery<PaginatedResponse<TestCase>>({
    queryKey: [
      'test-cases',
      effectiveProjectId,
      selectedSuiteId,
      search,
      priorityFilter,
      statusFilter,
      tagFilter,
      page,
    ],
    queryFn: async () => {
      const params: any = {
        page,
        limit: 15,
        search: search.trim() || undefined,
        suiteId: selectedSuiteId || undefined,
        priority: priorityFilter !== 'ALL' ? priorityFilter : undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        tag: tagFilter.trim() || undefined,
      };
      const res = await apiClient.get<PaginatedResponse<TestCase>>(
        `/projects/${effectiveProjectId}/test-cases`,
        { params },
      );
      return res.data;
    },
    enabled: !!effectiveProjectId,
  });

  // Delete Test Case mutation
  const deleteCaseMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/projects/${effectiveProjectId}/test-cases/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-cases', effectiveProjectId] });
      queryClient.invalidateQueries({ queryKey: ['test-suites', effectiveProjectId] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Không thể xóa Test Case');
    },
  });

  const handleDeleteCase = (tc: TestCase, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Bạn có chắc muốn xóa ca kiểm thử "${tc.code} - ${tc.title}"?`)) {
      deleteCaseMutation.mutate(tc.id);
    }
  };

  const getPriorityBadge = (p: TestCasePriority) => {
    switch (p) {
      case 'CRITICAL':
        return <span className="bg-rose-100 text-rose-700 font-bold px-2 py-0.5 rounded text-[10px]">🔴 CRITICAL</span>;
      case 'HIGH':
        return <span className="bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded text-[10px]">🟠 HIGH</span>;
      case 'LOW':
        return <span className="bg-slate-100 text-slate-700 font-medium px-2 py-0.5 rounded text-[10px]">🟢 LOW</span>;
      default:
        return <span className="bg-blue-100 text-blue-700 font-medium px-2 py-0.5 rounded text-[10px]">🔵 MEDIUM</span>;
    }
  };

  const getStatusBadge = (s: TestCaseStatus) => {
    switch (s) {
      case 'READY':
        return <span className="bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded text-[10px]">✅ READY</span>;
      case 'DEPRECATED':
        return <span className="bg-rose-100 text-rose-700 font-semibold px-2 py-0.5 rounded text-[10px]">⛔ DEPRECATED</span>;
      default:
        return <span className="bg-slate-100 text-slate-600 font-medium px-2 py-0.5 rounded text-[10px]">📝 DRAFT</span>;
    }
  };

  if (isProjectsLoading) {
    return (
      <div className="p-16 text-center text-slate-500 text-sm">
        <span className="text-3xl animate-bounce block mb-2">📑</span>
        Đang tải thông tin dự án và kho kiểm thử...
      </div>
    );
  }

  if (!effectiveProjectId) {
    return (
      <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center max-w-md mx-auto mt-12">
        <span className="text-4xl block mb-3">📁</span>
        <h3 className="font-bold text-slate-800 text-base">Chưa có dự án nào</h3>
        <p className="text-xs text-slate-500 mt-1 mb-4">
          Bạn cần tạo hoặc tham gia vào một dự án trước khi quản lý Test Suites và Test Cases.
        </p>
        <button
          onClick={() => navigate('/projects')}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition"
        >
          Đi tới trang Dự án
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Banner & Project Switcher */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-xl shadow-2xs shrink-0">
            📑
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 leading-tight">
                Kho Kiểm Thử (Test Repository)
              </h2>
              <span className="text-[10px] bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-full">
                Sprint 2
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Quản lý phân cấp Test Suites, soạn thảo Test Cases và kiểm soát lịch sử phiên bản.
            </p>
          </div>
        </div>

        {/* Project Switcher Selector */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <label className="text-xs font-semibold text-slate-500 whitespace-nowrap">Dự án:</label>
          <select
            value={effectiveProjectId || ''}
            onChange={(e) => {
              const newProjId = e.target.value;
              setSelectedProjectId(newProjId);
              setSelectedSuiteId(null);
              setPage(1);
              if (paramProjectId) {
                navigate(`/projects/${newProjId}/repository`);
              }
            }}
            className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.status === 'ARCHIVED' ? '(Lưu trữ)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main 2-Pane Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start min-h-[600px]">
        {/* Left Pane: Test Suites Tree (1 col) */}
        <div className="lg:col-span-1 h-[680px]">
          <TestSuiteTree
            projectId={effectiveProjectId}
            selectedSuiteId={selectedSuiteId}
            onSelectSuite={(sId) => {
              setSelectedSuiteId(sId);
              setPage(1);
            }}
            canManage={canManage}
          />
        </div>

        {/* Right Pane: Test Cases Management (3 cols) */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 shadow-2xs flex flex-col h-[680px] overflow-hidden">
          {/* Header & Main Actions */}
          <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-800 text-sm">
                  {selectedSuiteId === null
                    ? 'Tất cả Test Cases'
                    : selectedSuiteId === 'none'
                    ? 'Chưa phân loại (Root)'
                    : 'Danh sách Test Cases'}
                </h3>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                  {casesData?.pagination?.total || 0}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {currentProject?.name} · Click vào dòng để xem chi tiết hoặc so sánh lịch sử phiên bản
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setImportExportMode('EXPORT');
                  setIsImportExportOpen(true);
                }}
                className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold px-3 py-1.5 rounded-lg shadow-2xs transition flex items-center gap-1.5"
              >
                <span>📤</span> Xuất Excel/CSV
              </button>

              {canWrite && (
                <button
                  onClick={() => {
                    setImportExportMode('IMPORT');
                    setIsImportExportOpen(true);
                  }}
                  className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold px-3 py-1.5 rounded-lg shadow-2xs transition flex items-center gap-1.5"
                >
                  <span>📥</span> Nhập tệp
                </button>
              )}

              {canWrite && (
                <button
                  onClick={() => {
                    setEditingTestCase(null);
                    setIsCaseModalOpen(true);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg shadow-sm transition flex items-center gap-1.5"
                >
                  <span>➕</span> Tạo Test Case
                </button>
              )}
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="p-3 border-b border-slate-200 bg-white grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs">
            {/* Search Input */}
            <div className="sm:col-span-2 relative">
              <span className="absolute left-3 top-2 text-slate-400">🔍</span>
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Tìm theo tiêu đề, mô tả hoặc mã (TC-1)..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Priority Filter */}
            <div>
              <select
                value={priorityFilter}
                onChange={(e) => {
                  setPriorityFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-700"
              >
                <option value="ALL">Độ ưu tiên: Tất cả</option>
                <option value="CRITICAL">🔴 CRITICAL (Nghiêm trọng)</option>
                <option value="HIGH">🟠 HIGH (Cao)</option>
                <option value="MEDIUM">🔵 MEDIUM (Trung bình)</option>
                <option value="LOW">🟢 LOW (Thấp)</option>
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-700"
              >
                <option value="ALL">Trạng thái: Tất cả</option>
                <option value="READY">✅ READY (Sẵn sàng)</option>
                <option value="DRAFT">📝 DRAFT (Bản nháp)</option>
                <option value="DEPRECATED">⛔ DEPRECATED (Ngưng dùng)</option>
              </select>
            </div>

            {/* Tag Filter */}
            <div className="relative">
              <input
                type="text"
                value={tagFilter}
                onChange={(e) => {
                  setTagFilter(e.target.value);
                  setPage(1);
                }}
                placeholder="Lọc tag (#auth)..."
                className="w-full pl-2.5 pr-6 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-700"
              />
              {tagFilter && (
                <button
                  type="button"
                  onClick={() => setTagFilter('')}
                  className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-600 text-xs"
                  title="Xóa lọc tag"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Test Cases Table */}
          <div className="flex-1 overflow-y-auto">
            {isCasesLoading ? (
              <div className="p-12 text-center text-xs text-slate-400">Đang tải danh sách Test Cases...</div>
            ) : !casesData?.data || casesData.data.length === 0 ? (
              <div className="p-16 text-center text-slate-400">
                <span className="text-4xl block mb-2">📑</span>
                <p className="text-xs font-semibold text-slate-600">Không tìm thấy Test Case nào</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Thử thay đổi bộ lọc hoặc bấm "+ Tạo Test Case" để thêm mới.
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-bold border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3 w-16 text-center">Mã</th>
                    <th className="py-2.5 px-3">Tiêu đề Test Case</th>
                    <th className="py-2.5 px-3 w-32">Suite</th>
                    <th className="py-2.5 px-3 w-28">Độ ưu tiên</th>
                    <th className="py-2.5 px-3 w-28">Trạng thái</th>
                    <th className="py-2.5 px-3 w-32">Tags</th>
                    <th className="py-2.5 px-3 w-16 text-center">Phiên bản</th>
                    <th className="py-2.5 px-3 w-24 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {casesData.data.map((tc) => (
                    <tr
                      key={tc.id}
                      onClick={() => setViewingTestCaseId(tc.id)}
                      className="hover:bg-indigo-50/40 cursor-pointer transition group"
                    >
                      {/* Code */}
                      <td className="py-3 px-3 text-center font-mono font-bold text-indigo-700">
                        {tc.code}
                      </td>

                      {/* Title & Steps summary */}
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-900 group-hover:text-indigo-600 transition">
                          {tc.title}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2">
                          <span>{tc.steps?.length || 0} bước thực hiện</span>
                          {tc.preconditions && (
                            <span className="truncate max-w-[200px]" title={tc.preconditions}>
                              · Tiên quyết: {tc.preconditions}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Suite */}
                      <td className="py-3 px-3 text-slate-600 truncate max-w-[130px]" title={tc.suite?.name || 'Root'}>
                        {tc.suite ? `📁 ${tc.suite.name}` : <span className="text-slate-400">—</span>}
                      </td>

                      {/* Priority */}
                      <td className="py-3 px-3">{getPriorityBadge(tc.priority)}</td>

                      {/* Status */}
                      <td className="py-3 px-3">{getStatusBadge(tc.status)}</td>

                      {/* Tags */}
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap gap-1 max-w-[140px]">
                          {tc.tags && tc.tags.length > 0 ? (
                            tc.tags.slice(0, 2).map((t) => (
                              <button
                                key={t}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTagFilter(t);
                                  setPage(1);
                                }}
                                className="bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 px-1.5 py-0.2 rounded text-[10px] transition"
                                title={`Lọc theo tag #${t}`}
                              >
                                #{t}
                              </button>
                            ))
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                          {tc.tags && tc.tags.length > 2 && (
                            <span className="text-[10px] text-slate-400">+{tc.tags.length - 2}</span>
                          )}
                        </div>
                      </td>

                      {/* Version */}
                      <td className="py-3 px-3 text-center">
                        <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          v{tc.version}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100">
                          <button
                            type="button"
                            title="Xem chi tiết"
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewingTestCaseId(tc.id);
                            }}
                            className="p-1 hover:bg-slate-200 rounded text-slate-600"
                          >
                            👁️
                          </button>
                          {canWrite && (
                            <button
                              type="button"
                              title="Sửa"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingTestCase(tc);
                                setIsCaseModalOpen(true);
                              }}
                              className="p-1 hover:bg-slate-200 rounded text-slate-600"
                            >
                              ✏️
                            </button>
                          )}
                          {canManage && (
                            <button
                              type="button"
                              title="Xóa"
                              onClick={(e) => handleDeleteCase(tc, e)}
                              className="p-1 hover:bg-rose-100 rounded text-rose-500 hover:text-rose-700"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination Footer */}
          {casesData?.pagination && casesData.pagination.totalPages > 1 && (
            <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
              <div>
                Trang <strong>{casesData.pagination.page}</strong> / <strong>{casesData.pagination.totalPages}</strong> (Tổng {casesData.pagination.total} ca kiểm thử)
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 transition"
                >
                  ← Trước
                </button>
                <button
                  disabled={page >= casesData.pagination.totalPages}
                  onClick={() => setPage(page + 1)}
                  className="px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 transition"
                >
                  Sau →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Soạn thảo / Sửa Test Case */}
      {isCaseModalOpen && (
        <TestCaseModal
          projectId={effectiveProjectId}
          isOpen={isCaseModalOpen}
          onClose={() => setIsCaseModalOpen(false)}
          suites={suites}
          initialSuiteId={selectedSuiteId}
          editingTestCase={editingTestCase}
        />
      )}

      {/* Drawer Chi tiết & Lịch sử Diff */}
      {viewingTestCaseId && (
        <TestCaseDetailDrawer
          projectId={effectiveProjectId}
          testCaseId={viewingTestCaseId}
          onClose={() => setViewingTestCaseId(null)}
          onEdit={(tc) => {
            setViewingTestCaseId(null);
            setEditingTestCase(tc);
            setIsCaseModalOpen(true);
          }}
          canManage={canWrite}
        />
      )}

      {/* Modal Import / Export */}
      {isImportExportOpen && (
        <ImportExportModal
          projectId={effectiveProjectId}
          projectName={currentProject?.name || 'Project'}
          isOpen={isImportExportOpen}
          onClose={() => setIsImportExportOpen(false)}
          initialMode={importExportMode}
        />
      )}
    </div>
  );
};
