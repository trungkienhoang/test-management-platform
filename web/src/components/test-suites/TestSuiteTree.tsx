import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import type { TestSuiteTreeNode } from '../../types';

interface TestSuiteTreeProps {
  projectId: string;
  selectedSuiteId: string | null;
  onSelectSuite: (suiteId: string | null) => void;
  canManage: boolean;
}

export const TestSuiteTree: React.FC<TestSuiteTreeProps> = ({
  projectId,
  selectedSuiteId,
  onSelectSuite,
  canManage,
}) => {
  const queryClient = useQueryClient();
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSuite, setEditingSuite] = useState<TestSuiteTreeNode | null>(null);
  const [modalParentId, setModalParentId] = useState<string | null>(null);
  const [suiteName, setSuiteName] = useState('');
  const [suiteDesc, setSuiteDesc] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);

  // Fetch Suites tree
  const { data: suites = [], isLoading } = useQuery<TestSuiteTreeNode[]>({
    queryKey: ['test-suites', projectId],
    queryFn: async () => {
      const res = await apiClient.get<TestSuiteTreeNode[]>(`/projects/${projectId}/suites`);
      return res.data;
    },
    enabled: !!projectId,
  });

  // Calculate total cases in all suites
  const totalAllCases = suites.reduce((acc, s) => acc + s.totalCaseCount, 0);

  // Toggle node expand/collapse
  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Open modal for Create
  const handleOpenCreate = (parentId: string | null = null, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingSuite(null);
    setModalParentId(parentId);
    setSuiteName('');
    setSuiteDesc('');
    setModalError(null);
    setIsModalOpen(true);
  };

  // Open modal for Edit
  const handleOpenEdit = (suite: TestSuiteTreeNode, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSuite(suite);
    setModalParentId(suite.parentId ?? null);
    setSuiteName(suite.name);
    setSuiteDesc(suite.description || '');
    setModalError(null);
    setIsModalOpen(true);
  };

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (payload: { name: string; description?: string; parentId?: string | null }) => {
      const res = await apiClient.post(`/projects/${projectId}/suites`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-suites', projectId] });
      setIsModalOpen(false);
    },
    onError: (err: any) => {
      setModalError(err.response?.data?.message || 'Không thể tạo Test Suite');
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (payload: { name: string; description?: string; parentId?: string | null }) => {
      if (!editingSuite) return;
      const res = await apiClient.patch(`/projects/${projectId}/suites/${editingSuite.id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-suites', projectId] });
      setIsModalOpen(false);
    },
    onError: (err: any) => {
      setModalError(err.response?.data?.message || 'Không thể cập nhật Test Suite');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/projects/${projectId}/suites/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-suites', projectId] });
      if (selectedSuiteId === editingSuite?.id) {
        onSelectSuite(null);
      }
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Không thể xóa Test Suite');
    },
  });

  const handleDelete = (suite: TestSuiteTreeNode, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Bạn có chắc chắn muốn xóa Test Suite "${suite.name}"? Các Test Case trong suite này sẽ được chuyển về Chưa phân loại.`)) {
      deleteMutation.mutate(suite.id);
    }
  };

  const handleSaveSuite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!suiteName.trim()) {
      setModalError('Vui lòng nhập tên Test Suite');
      return;
    }
    const payload = {
      name: suiteName.trim(),
      description: suiteDesc.trim() || undefined,
      parentId: modalParentId || null,
    };

    if (editingSuite) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  // Helper to flatten suites for parent dropdown
  const flattenSuites = (nodes: TestSuiteTreeNode[], depth = 0): { id: string; name: string }[] => {
    let result: { id: string; name: string }[] = [];
    nodes.forEach((n) => {
      if (!editingSuite || n.id !== editingSuite.id) {
        result.push({ id: n.id, name: `${'— '.repeat(depth)}${n.name}` });
        if (n.children && n.children.length > 0) {
          result = result.concat(flattenSuites(n.children, depth + 1));
        }
      }
    });
    return result;
  };

  // Recursive Tree Node Renderer
  const renderTreeNode = (node: TestSuiteTreeNode, depth = 0) => {
    const isExpanded = expandedNodes[node.id] !== false; // default expanded
    const isSelected = selectedSuiteId === node.id;
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div key={node.id} className="select-none">
        <div
          onClick={() => onSelectSuite(node.id)}
          style={{ paddingLeft: `${depth * 14 + 8}px` }}
          className={`group flex items-center justify-between py-1.5 pr-2 rounded-lg cursor-pointer text-xs transition ${
            isSelected
              ? 'bg-indigo-50 text-indigo-700 font-semibold'
              : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => toggleExpand(node.id, e)}
                className="w-4 h-4 flex items-center justify-center text-slate-400 hover:text-slate-600 transition"
              >
                {isExpanded ? '▾' : '▸'}
              </button>
            ) : (
              <span className="w-4" />
            )}

            <span className="text-sm shrink-0">
              {hasChildren ? (isExpanded ? '📂' : '📁') : '📄'}
            </span>

            <span className="truncate" title={node.name}>
              {node.name}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Case count badge */}
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                isSelected
                  ? 'bg-indigo-200 text-indigo-800'
                  : 'bg-slate-200 text-slate-600 group-hover:bg-slate-300'
              }`}
            >
              {node.totalCaseCount}
            </span>

            {/* Quick Actions (QA Lead / Admin) */}
            {canManage && (
              <div className="hidden group-hover:flex items-center gap-0.5 ml-1">
                <button
                  type="button"
                  title="Thêm Suite con"
                  onClick={(e) => handleOpenCreate(node.id, e)}
                  className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-800"
                >
                  ➕
                </button>
                <button
                  type="button"
                  title="Sửa tên Suite"
                  onClick={(e) => handleOpenEdit(node, e)}
                  className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-800"
                >
                  ✏️
                </button>
                <button
                  type="button"
                  title="Xóa Suite"
                  onClick={(e) => handleDelete(node, e)}
                  className="p-1 hover:bg-rose-100 rounded text-rose-500 hover:text-rose-700"
                >
                  🗑️
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Render child nodes if expanded */}
        {hasChildren && isExpanded && (
          <div className="mt-0.5">
            {node.children.map((child) => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-2xs flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-3.5 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <span>📑</span> Test Suites
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">Cây thư mục phân cấp module</p>
        </div>

        {canManage && (
          <button
            onClick={() => handleOpenCreate(null)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold px-2 py-1 rounded-md shadow-2xs transition flex items-center gap-1"
          >
            <span>+</span> Suite
          </button>
        )}
      </div>

      {/* Tree Content */}
      <div className="p-2 flex-1 overflow-y-auto space-y-1">
        {/* All Cases Root Option */}
        <div
          onClick={() => onSelectSuite(null)}
          className={`flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer text-xs transition ${
            selectedSuiteId === null
              ? 'bg-indigo-600 text-white font-semibold shadow-2xs'
              : 'text-slate-700 hover:bg-slate-100 font-medium'
          }`}
        >
          <div className="flex items-center gap-2">
            <span>📦</span>
            <span>Tất cả Test Cases</span>
          </div>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
              selectedSuiteId === null
                ? 'bg-indigo-700 text-white'
                : 'bg-slate-200 text-slate-600'
            }`}
          >
            {totalAllCases}
          </span>
        </div>

        {/* Uncategorized option */}
        <div
          onClick={() => onSelectSuite('none')}
          className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer text-xs transition ${
            selectedSuiteId === 'none'
              ? 'bg-indigo-50 text-indigo-700 font-semibold'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <div className="flex items-center gap-2">
            <span>🏷️</span>
            <span>Chưa phân loại (Root)</span>
          </div>
        </div>

        <div className="my-1 border-t border-slate-100" />

        {/* Loading state */}
        {isLoading && (
          <div className="p-4 text-center text-xs text-slate-400">Đang tải Test Suites...</div>
        )}

        {/* Empty state */}
        {!isLoading && suites.length === 0 && (
          <div className="p-4 text-center text-xs text-slate-400">
            Chưa có Test Suite nào.
            {canManage && <div className="mt-1 text-indigo-600 font-medium">Bấm "+ Suite" để tạo mới.</div>}
          </div>
        )}

        {/* Tree Nodes */}
        {!isLoading && suites.map((suite) => renderTreeNode(suite))}
      </div>

      {/* Modal Tạo / Sửa Test Suite */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5 border border-slate-200">
            <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-1.5">
              <span>{editingSuite ? '✏️ Chỉnh sửa Test Suite' : '📑 Tạo Test Suite Mới'}</span>
            </h3>

            {modalError && (
              <div className="mb-3 p-2.5 bg-rose-50 border-l-3 border-rose-500 text-rose-700 text-xs rounded">
                {modalError}
              </div>
            )}

            <form onSubmit={handleSaveSuite} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tên Test Suite *</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={suiteName}
                  onChange={(e) => setSuiteName(e.target.value)}
                  placeholder="Ví dụ: Module Xác thực & Tài khoản"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Mô tả (tùy chọn)</label>
                <textarea
                  rows={2}
                  value={suiteDesc}
                  onChange={(e) => setSuiteDesc(e.target.value)}
                  placeholder="Mô tả phạm vi các ca kiểm thử trong suite này..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Thư mục cha (Parent Suite)</label>
                <select
                  value={modalParentId || ''}
                  onChange={(e) => setModalParentId(e.target.value || null)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="">(Không có - Thư mục gốc)</option>
                  {flattenSuites(suites).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition shadow-2xs disabled:opacity-50"
                >
                  {createMutation.isPending || updateMutation.isPending ? 'Đang lưu...' : 'Lưu Suite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
