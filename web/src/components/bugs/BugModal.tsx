import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import type { Bug, BugSeverity, BugStatus, ProjectMember, TestCase } from '../../types';

interface BugModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (bug: Bug) => void;
  initialBug?: Bug | null;
}

export const BugModal: React.FC<BugModalProps> = ({
  projectId,
  isOpen,
  onClose,
  onSaved,
  initialBug,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<BugSeverity>('MEDIUM');
  const [status, setStatus] = useState<BugStatus>('OPEN');
  const [assigneeId, setAssigneeId] = useState('');
  const [testCaseId, setTestCaseId] = useState('');

  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (initialBug) {
      setTitle(initialBug.title);
      setDescription(initialBug.description);
      setSeverity(initialBug.severity);
      setStatus(initialBug.status);
      setAssigneeId(initialBug.assigneeId || '');
      setTestCaseId(initialBug.testCaseId || '');
    } else {
      setTitle('');
      setDescription('');
      setSeverity('MEDIUM');
      setStatus('OPEN');
      setAssigneeId('');
      setTestCaseId('');
    }

    const loadData = async () => {
      setLoading(true);
      try {
        const [mRes, tcRes] = await Promise.all([
          apiClient.get(`/projects/${projectId}/members`),
          apiClient.get(`/projects/${projectId}/test-cases?limit=200`),
        ]);
        const membersData = Array.isArray(mRes.data)
          ? mRes.data
          : Array.isArray(mRes.data?.data)
          ? mRes.data.data
          : [];
        const casesData = Array.isArray(tcRes.data)
          ? tcRes.data
          : Array.isArray(tcRes.data?.data)
          ? tcRes.data.data
          : [];

        setMembers(membersData);
        setTestCases(casesData);
      } catch (err: any) {
        console.error('Failed to load members/cases', err);
        setError(err.response?.data?.message || 'Không thể tải dữ liệu thành viên hoặc test case');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isOpen, initialBug, projectId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setError('Vui lòng điền tiêu đề và mô tả lỗi');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload: any = {
        title: title.trim(),
        description: description.trim(),
        severity,
        status,
        assigneeId: assigneeId || undefined,
        testCaseId: testCaseId || undefined,
      };

      let res;
      if (initialBug) {
        res = await apiClient.patch(`/projects/${projectId}/bugs/${initialBug.id}`, payload);
      } else {
        res = await apiClient.post(`/projects/${projectId}/bugs`, payload);
      }

      onSaved(res.data);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Có lỗi xảy ra khi lưu lỗi');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🐛</span>
            <div>
              <h3 className="font-bold text-base">
                {initialBug ? `Chỉnh sửa lỗi [${initialBug.code}]` : 'Tạo Báo Cáo Lỗi Mới (Bug)'}
              </h3>
              <p className="text-xs text-slate-400">Theo dõi và quản lý vòng đời lỗi phần mềm</p>
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
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Tiêu đề lỗi <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Không thể cập nhật trạng thái đơn hàng khi chọn hủy"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mức độ nghiêm trọng
              </label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as BugSeverity)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                <option value="LOW">Thấp (Low)</option>
                <option value="MEDIUM">Trung bình (Medium)</option>
                <option value="HIGH">Nghiêm trọng (High)</option>
                <option value="CRITICAL">Khẩn cấp (Critical / Blocker)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Trạng thái vòng đời
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as BugStatus)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                <option value="OPEN">Mở (Open)</option>
                <option value="IN_PROGRESS">Đang xử lý (In Progress)</option>
                <option value="RESOLVED">Đã sửa (Resolved)</option>
                <option value="CLOSED">Đã đóng (Closed)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Người được giao sửa (Assignee)
              </label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- Chưa chỉ định --</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.user.fullName} ({m.role})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Liên kết Test Case gốc (Tùy chọn)
              </label>
              <select
                value={testCaseId}
                onChange={(e) => setTestCaseId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- Không liên kết --</option>
                {testCases.map((tc) => (
                  <option key={tc.id} value={tc.id}>
                    [{tc.code}] {tc.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Mô tả chi tiết & Các bước tái hiện <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={6}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="1. Vào trang...\n2. Nhập dữ liệu...\n3. Bấm nút...\n-> Kết quả mong đợi vs Thực tế..."
              className="w-full p-3 font-mono text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200 rounded-lg"
          >
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || loading}
            className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition disabled:opacity-50"
          >
            {submitting ? 'Đang lưu...' : initialBug ? 'Cập nhật lỗi' : 'Tạo báo cáo lỗi'}
          </button>
        </div>
      </div>
    </div>
  );
};
