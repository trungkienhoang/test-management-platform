import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import type {
  TestCase,
  TestCasePriority,
  TestCaseStatus,
  TestCaseStep,
  TestSuiteTreeNode,
} from '../../types';

interface TestCaseModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  suites: TestSuiteTreeNode[];
  initialSuiteId?: string | null;
  editingTestCase?: TestCase | null;
}

export const TestCaseModal: React.FC<TestCaseModalProps> = ({
  projectId,
  isOpen,
  onClose,
  suites,
  initialSuiteId,
  editingTestCase,
}) => {
  const queryClient = useQueryClient();

  const [title, setTitle] = useState(editingTestCase?.title || '');
  const [suiteId, setSuiteId] = useState<string>(
    editingTestCase?.suiteId || (initialSuiteId && initialSuiteId !== 'none' ? initialSuiteId : '') || '',
  );
  const [priority, setPriority] = useState<TestCasePriority>(editingTestCase?.priority || 'MEDIUM');
  const [status, setStatus] = useState<TestCaseStatus>(editingTestCase?.status || 'DRAFT');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(editingTestCase?.tags || []);
  const [preconditions, setPreconditions] = useState(editingTestCase?.preconditions || '');
  const [description, setDescription] = useState(editingTestCase?.description || '');
  const [changeReason, setChangeReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Steps state
  const [steps, setSteps] = useState<TestCaseStep[]>(() => {
    const rawSteps = editingTestCase?.steps;
    if (Array.isArray(rawSteps) && rawSteps.length > 0) return rawSteps;
    if (typeof rawSteps === 'string') {
      try {
        const parsed = JSON.parse(rawSteps);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    return [{ stepNumber: 1, action: '', expectedResult: '' }];
  });

  // Helper to flatten suites for dropdown
  const flattenSuites = (nodes: TestSuiteTreeNode[] = [], depth = 0): { id: string; name: string }[] => {
    if (!Array.isArray(nodes)) return [];
    let result: { id: string; name: string }[] = [];
    nodes.forEach((n) => {
      result.push({ id: n.id, name: `${'— '.repeat(depth)}${n.name}` });
      if (Array.isArray(n.children) && n.children.length > 0) {
        result = result.concat(flattenSuites(n.children, depth + 1));
      }
    });
    return result;
  };

  // Step operations
  const handleAddStep = () => {
    setSteps((prev) => [
      ...prev,
      { stepNumber: prev.length + 1, action: '', expectedResult: '' },
    ]);
  };

  const handleRemoveStep = (index: number) => {
    setSteps((prev) => {
      const filtered = prev.filter((_, i) => i !== index);
      return filtered.map((s, idx) => ({ ...s, stepNumber: idx + 1 }));
    });
  };

  const handleUpdateStep = (index: number, field: 'action' | 'expectedResult', value: string) => {
    setSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
    );
  };

  const handleMoveStep = (index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === steps.length - 1)) {
      return;
    }
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    setSteps((prev) => {
      const newSteps = [...prev];
      const temp = newSteps[index];
      newSteps[index] = newSteps[targetIndex];
      newSteps[targetIndex] = temp;
      return newSteps.map((s, idx) => ({ ...s, stepNumber: idx + 1 }));
    });
  };

  // Tag operations
  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = tagInput.trim().replace(/^#/, '');
      if (val && !tags.includes(val)) {
        setTags([...tags, val]);
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (editingTestCase) {
        const res = await apiClient.patch(
          `/projects/${projectId}/test-cases/${editingTestCase.id}`,
          payload,
        );
        return res.data;
      } else {
        const res = await apiClient.post(`/projects/${projectId}/test-cases`, payload);
        return res.data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-cases', projectId] });
      queryClient.invalidateQueries({ queryKey: ['test-suites', projectId] });
      onClose();
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Không thể lưu Test Case');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Tiêu đề Test Case không được để trống');
      return;
    }

    // Filter out completely blank steps
    const cleanSteps = steps
      .filter((s) => s.action.trim() || s.expectedResult.trim())
      .map((s, idx) => ({
        stepNumber: idx + 1,
        action: s.action.trim() || `Bước ${idx + 1}`,
        expectedResult: s.expectedResult.trim() || 'Hệ thống hoạt động bình thường',
      }));

    const payload: any = {
      title: title.trim(),
      suiteId: suiteId || null,
      priority,
      status,
      tags,
      preconditions: preconditions.trim() || null,
      description: description.trim() || null,
      steps: cleanSteps,
    };

    if (editingTestCase) {
      payload.changeReason = changeReason.trim() || undefined;
    }

    saveMutation.mutate(payload);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col border border-slate-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 rounded-t-2xl">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span>{editingTestCase ? '✏️ Chỉnh sửa Test Case' : '➕ Soạn thảo Test Case Mới'}</span>
              {editingTestCase && (
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 font-bold">
                  {editingTestCase.code} · v{editingTestCase.version}
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {editingTestCase
                ? 'Chỉnh sửa nội dung sẽ tự động ghi nhận phiên bản mới vào lịch sử kiểm thử.'
                : 'Tạo ca kiểm thử chi tiết từng bước (Step-by-step) cho dự án.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-lg w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-200"
          >
            ✕
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="mx-5 mt-4 p-3 bg-rose-50 border-l-4 border-rose-500 text-rose-700 text-xs rounded">
            {error}
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* Row 1: Title & Code preview */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Tiêu đề Test Case *</label>
            <input
              type="text"
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ví dụ: Kiểm tra đăng nhập với email và mật khẩu hợp lệ"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Row 2: Suite, Priority, Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Test Suite (Module)</label>
              <select
                value={suiteId}
                onChange={(e) => setSuiteId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="">(Chưa phân loại - Root)</option>
                {flattenSuites(suites).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Độ ưu tiên (Priority)</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TestCasePriority)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="LOW">🟢 LOW (Thấp)</option>
                <option value="MEDIUM">🔵 MEDIUM (Trung bình)</option>
                <option value="HIGH">🟠 HIGH (Cao)</option>
                <option value="CRITICAL">🔴 CRITICAL (Nghiêm trọng)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Trạng thái (Status)</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TestCaseStatus)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="DRAFT">📝 DRAFT (Bản nháp)</option>
                <option value="READY">✅ READY (Sẵn sàng chạy)</option>
                <option value="DEPRECATED">⛔ DEPRECATED (Ngưng dùng)</option>
              </select>
            </div>
          </div>

          {/* Row 3: Preconditions */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Điều kiện tiên quyết (Pre-conditions)</label>
            <textarea
              rows={2}
              value={preconditions}
              onChange={(e) => setPreconditions(e.target.value)}
              placeholder="Ví dụ: Người dùng đã đăng ký tài khoản, tài khoản đang ở trạng thái kích hoạt (Active)..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Row 3.5: Description */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Mô tả tóm tắt (Description)</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mô tả mục tiêu bài test hoặc ghi chú đặc biệt..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Row 4: Step Builder */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block font-semibold text-slate-700">
                Các bước thực hiện (Test Steps) <span className="text-slate-400 font-normal">({steps.length} bước)</span>
              </label>
              <button
                type="button"
                onClick={handleAddStep}
                className="text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 hover:underline"
              >
                <span>➕</span> Thêm bước
              </button>
            </div>

            <div className="space-y-2.5">
              {steps.map((step, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3 relative group"
                >
                  <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold font-mono text-xs shrink-0 mt-1">
                    {step.stepNumber}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 flex-1">
                    <div>
                      <span className="text-[10px] font-semibold text-slate-500 block mb-0.5">
                        Hành động (Action) *
                      </span>
                      <textarea
                        rows={2}
                        value={step.action}
                        onChange={(e) => handleUpdateStep(idx, 'action', e.target.value)}
                        placeholder="Ví dụ: Truy cập trang đăng nhập, điền email và mật khẩu..."
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white resize-none"
                      />
                    </div>

                    <div>
                      <span className="text-[10px] font-semibold text-slate-500 block mb-0.5">
                        Kết quả mong đợi (Expected Result) *
                      </span>
                      <textarea
                        rows={2}
                        value={step.expectedResult}
                        onChange={(e) => handleUpdateStep(idx, 'expectedResult', e.target.value)}
                        placeholder="Ví dụ: Chuyển hướng vào trang dự án và hiển thị toast thành công..."
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white resize-none"
                      />
                    </div>
                  </div>

                  {/* Step Action Buttons */}
                  <div className="flex flex-col gap-1 shrink-0 pt-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveStep(idx, 'up')}
                      title="Di chuyển lên"
                      className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-20"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      disabled={idx === steps.length - 1}
                      onClick={() => handleMoveStep(idx, 'down')}
                      title="Di chuyển xuống"
                      className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-20"
                    >
                      ▼
                    </button>
                    {steps.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveStep(idx)}
                        title="Xóa bước này"
                        className="p-1 rounded text-rose-400 hover:text-rose-700"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Row 5: Tags */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Thẻ phân loại (Tags) <span className="text-slate-400 font-normal">(gõ từ khóa và nhấn Enter)</span>
            </label>
            <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-lg border border-slate-300 bg-white focus-within:ring-2 focus-within:ring-indigo-500">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1 border border-indigo-200"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-rose-600 font-bold"
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                placeholder={tags.length === 0 ? 'Ví dụ: auth, smoke, regression...' : 'Thêm tag...'}
                className="flex-1 min-w-[120px] outline-none text-xs"
              />
            </div>
          </div>

          {/* Row 6: Change Reason (Only when Editing) */}
          {editingTestCase && (
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
              <label className="block font-semibold text-amber-900 mb-1">
                Lý do sửa đổi (Ghi chú cho phiên bản v{editingTestCase.version + 1})
              </label>
              <input
                type="text"
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value)}
                placeholder="Ví dụ: Bổ sung thêm bước kiểm tra mã OTP, nâng độ ưu tiên lên HIGH..."
                className="w-full px-3 py-1.5 rounded-lg border border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
              />
            </div>
          )}

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-md transition disabled:opacity-50"
            >
              {saveMutation.isPending
                ? 'Đang lưu...'
                : editingTestCase
                ? 'Cập nhật Test Case'
                : 'Tạo Test Case'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
