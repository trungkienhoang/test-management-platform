import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import type { ProjectMember, TestCase, TestSuiteTreeNode } from '../../types';

interface CreateTestRunModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onCreated: (newRun: any) => void;
}

export const CreateTestRunModal: React.FC<CreateTestRunModalProps> = ({
  projectId,
  isOpen,
  onClose,
  onCreated,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [assignedToId, setAssignedToId] = useState('');
  const [mode, setMode] = useState<'ALL' | 'SUITES' | 'CUSTOM'>('ALL');
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [suites, setSuites] = useState<TestSuiteTreeNode[]>([]);
  const [selectedSuiteIds, setSelectedSuiteIds] = useState<string[]>([]);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [membersRes, suitesRes, casesRes] = await Promise.all([
          apiClient.get(`/projects/${projectId}/members`),
          apiClient.get(`/projects/${projectId}/suites`),
          apiClient.get(`/projects/${projectId}/test-cases?limit=200`),
        ]);

        const membersData = Array.isArray(membersRes.data)
          ? membersRes.data
          : Array.isArray(membersRes.data?.data)
          ? membersRes.data.data
          : [];
        const suitesData = Array.isArray(suitesRes.data)
          ? suitesRes.data
          : Array.isArray(suitesRes.data?.data)
          ? suitesRes.data.data
          : [];
        const casesData = Array.isArray(casesRes.data)
          ? casesRes.data
          : Array.isArray(casesRes.data?.data)
          ? casesRes.data.data
          : [];

        setMembers(membersData);
        setSuites(suitesData);
        setTestCases(casesData);
      } catch (err: any) {
        console.error('CreateTestRunModal loadData error:', err);
        setError(err.response?.data?.message || 'Không thể tải dữ liệu thành viên hoặc test case');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isOpen, projectId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Vui lòng nhập tên đợt kiểm thử');
      return;
    }

    if (mode === 'SUITES' && selectedSuiteIds.length === 0) {
      setError('Vui lòng chọn ít nhất một thư mục Test Suite');
      return;
    }

    if (mode === 'CUSTOM' && selectedCaseIds.length === 0) {
      setError('Vui lòng chọn ít nhất một Test Case');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload: any = {
        name: name.trim(),
        description: description.trim() || undefined,
        assignedToId: assignedToId || undefined,
        includeAll: mode === 'ALL',
      };

      if (mode === 'SUITES') {
        payload.suiteIds = selectedSuiteIds;
      } else if (mode === 'CUSTOM') {
        payload.testCaseIds = selectedCaseIds;
      }

      const res = await apiClient.post(`/projects/${projectId}/test-runs`, payload);
      onCreated(res.data);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Có lỗi xảy ra khi tạo đợt kiểm thử');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleSuite = (suiteId: string) => {
    setSelectedSuiteIds((prev) =>
      prev.includes(suiteId) ? prev.filter((id) => id !== suiteId) : [...prev, suiteId],
    );
  };

  const toggleCase = (caseId: string) => {
    setSelectedCaseIds((prev) =>
      prev.includes(caseId) ? prev.filter((id) => id !== caseId) : [...prev, caseId],
    );
  };

  // Flatten suites for checkbox list
  const flattenSuites = (nodes: TestSuiteTreeNode[], depth = 0): Array<{ id: string; name: string; depth: number }> => {
    const list: Array<{ id: string; name: string; depth: number }> = [];
    for (const node of nodes) {
      list.push({ id: node.id, name: node.name, depth });
      if (node.children?.length) {
        list.push(...flattenSuites(node.children, depth + 1));
      }
    }
    return list;
  };

  const flattenedSuites = flattenSuites(suites);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">▶️</span>
            <div>
              <h3 className="font-bold text-base">Tạo Đợt Kiểm Thử Mới (Test Run)</h3>
              <p className="text-xs text-slate-400">Đóng băng snapshot phiên bản các ca kiểm thử</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-4">
          {error && (
            <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Tên đợt kiểm thử <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Regression Test Sprint 3 - Auth & Workspace"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Mục tiêu / Mô tả đợt kiểm thử
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ghi chú phạm vi, môi trường (Staging/Production), mục tiêu kiểm thử..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Người thực thi chính (Assignee)
            </label>
            <select
              value={assignedToId}
              onChange={(e) => setAssignedToId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">-- Chưa gán người thực thi --</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.user.fullName} ({m.role}) - {m.user.email}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              Người được gán sẽ tự động nhận thông báo in-app kèm đường dẫn đến Test Runner.
            </p>
          </div>

          {/* Scope selection */}
          <div className="pt-2 border-t border-slate-200">
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Phạm vi ca kiểm thử đưa vào Run
            </label>

            <div className="grid grid-cols-3 gap-3 mb-3">
              <button
                type="button"
                onClick={() => setMode('ALL')}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  mode === 'ALL'
                    ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="font-semibold text-xs text-slate-900 flex items-center gap-1.5">
                  <span>🌐</span> Toàn bộ ({testCases.length})
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Đưa tất cả test case hiện có vào run
                </p>
              </button>

              <button
                type="button"
                onClick={() => setMode('SUITES')}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  mode === 'SUITES'
                    ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="font-semibold text-xs text-slate-900 flex items-center gap-1.5">
                  <span>📁</span> Theo Test Suite
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Lọc theo thư mục chức năng
                </p>
              </button>

              <button
                type="button"
                onClick={() => setMode('CUSTOM')}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  mode === 'CUSTOM'
                    ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="font-semibold text-xs text-slate-900 flex items-center gap-1.5">
                  <span>✅</span> Tùy chọn lẻ
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Chọn thủ công từng test case
                </p>
              </button>
            </div>

            {/* Mode: Suites */}
            {mode === 'SUITES' && (
              <div className="border border-slate-200 rounded-lg p-3 max-h-48 overflow-y-auto space-y-1.5 bg-slate-50/50">
                {flattenedSuites.length === 0 ? (
                  <p className="text-xs text-slate-400">Không có thư mục Test Suite nào</p>
                ) : (
                  flattenedSuites.map((s) => (
                    <label
                      key={s.id}
                      className="flex items-center gap-2 p-1.5 rounded-md hover:bg-slate-100 cursor-pointer text-xs"
                      style={{ paddingLeft: `${s.depth * 16 + 6}px` }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedSuiteIds.includes(s.id)}
                        onChange={() => toggleSuite(s.id)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-slate-800 font-medium">{s.name}</span>
                    </label>
                  ))
                )}
              </div>
            )}

            {/* Mode: Custom test cases */}
            {mode === 'CUSTOM' && (
              <div className="border border-slate-200 rounded-lg p-3 max-h-48 overflow-y-auto space-y-1.5 bg-slate-50/50">
                {testCases.length === 0 ? (
                  <p className="text-xs text-slate-400">Không có ca kiểm thử nào</p>
                ) : (
                  testCases.map((tc) => (
                    <label
                      key={tc.id}
                      className="flex items-center gap-2 p-1.5 rounded-md hover:bg-slate-100 cursor-pointer text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCaseIds.includes(tc.id)}
                        onChange={() => toggleCase(tc.id)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="font-mono text-indigo-600 font-bold">{tc.code}</span>
                      <span className="text-slate-800 truncate flex-1">{tc.title}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                        v{tc.version}
                      </span>
                    </label>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
            <span className="text-base shrink-0">❄️</span>
            <div>
              <p className="font-semibold">Bảo toàn dữ liệu kiểm thử (Snapshot Freeze):</p>
              <p className="text-[11px] mt-0.5 text-amber-700 leading-relaxed">
                Tất cả các bước, điều kiện tiên quyết và phiên bản của ca kiểm thử sẽ được chụp ảnh đóng băng vào thời điểm tạo Run. Những chỉnh sửa về sau của Test Case gốc sẽ không làm sai lệch kết quả lịch sử của đợt test này.
              </p>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200 rounded-lg transition"
          >
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || loading}
            className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition disabled:opacity-50 flex items-center gap-1.5"
          >
            {submitting ? 'Đang tạo...' : 'Tạo Test Run & Khởi tạo Snapshot'}
          </button>
        </div>
      </div>
    </div>
  );
};
