import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../api/client';
import type { Bug, BugStatus, BugSeverity } from '../../types';

interface BugDetailDrawerProps {
  projectId: string;
  bug: Bug | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: (updatedBug: Bug) => void;
  onEdit: (bug: Bug) => void;
  onDeleted: (bugId: string) => void;
}

export const BugDetailDrawer: React.FC<BugDetailDrawerProps> = ({
  projectId,
  bug,
  isOpen,
  onClose,
  onUpdated,
  onEdit,
  onDeleted,
}) => {
  const [updatingStatus, setUpdatingStatus] = useState<boolean>(false);

  if (!isOpen || !bug) return null;

  const handleStatusChange = async (newStatus: BugStatus) => {
    if (newStatus === bug.status) return;
    setUpdatingStatus(true);
    try {
      const res = await apiClient.patch(`/projects/${projectId}/bugs/${bug.id}`, {
        status: newStatus,
      });
      onUpdated(res.data);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể đổi trạng thái lỗi');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa báo cáo lỗi [${bug.code}] không?`)) return;
    try {
      await apiClient.delete(`/projects/${projectId}/bugs/${bug.id}`);
      onDeleted(bug.id);
      onClose();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể xóa lỗi');
    }
  };

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

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col overflow-hidden animate-slideLeft">
        {/* Header */}
        <div className="p-6 bg-slate-900 text-white shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-extrabold bg-rose-600 text-white px-2.5 py-0.5 rounded">
                {bug.code}
              </span>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded border uppercase ${getSeverityBadge(
                  bug.severity,
                )}`}
              >
                {bug.severity}
              </span>
            </div>

            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              ✕
            </button>
          </div>

          <h3 className="text-lg font-bold text-white leading-snug">{bug.title}</h3>
        </div>

        {/* Quick Lifecycle Status Switcher */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 shrink-0">
          <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
            Trạng thái vòng đời lỗi:
          </span>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'VERIFIED', 'CLOSED', 'REOPENED'] as BugStatus[]).map((st) => (
              <button
                key={st}
                disabled={updatingStatus}
                onClick={() => handleStatusChange(st)}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 ${
                  bug.status === st
                    ? st === 'RESOLVED' || st === 'CLOSED'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : st === 'VERIFIED'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : st === 'REOPENED'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : st === 'IN_PROGRESS'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-800 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {st === 'OPEN' && 'Mở'}
                {st === 'IN_PROGRESS' && 'Đang sửa'}
                {st === 'RESOLVED' && 'Đã sửa'}
                {st === 'VERIFIED' && 'Đã duyệt'}
                {st === 'CLOSED' && 'Đã đóng'}
                {st === 'REOPENED' && 'Mở lại'}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* 2-WAY TRACEABILITY CARD */}
          <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/40 space-y-3">
            <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
              <span>🔗</span> Liên kết 2 chiều (Traceability)
            </h4>

            {bug.testExecution ? (
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-indigo-200/60">
                  <div>
                    <p className="text-[11px] text-slate-500 font-medium">Xuất phát từ Test Run:</p>
                    <p className="font-bold text-slate-900">
                      {bug.testExecution.testRun?.name || bug.testExecution.testRun?.title || 'Đợt kiểm thử'}
                    </p>
                  </div>
                  <Link
                    to={`/projects/${projectId}/test-runs/${bug.testExecution.testRunId}/runner`}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2.5 py-1 rounded border border-indigo-200"
                  >
                    Mở Runner →
                  </Link>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-indigo-200/60">
                  <p className="text-[11px] text-slate-500 font-medium">Ca kiểm thử (Snapshot):</p>
                  <p className="font-mono text-indigo-600 font-bold">
                    {bug.testExecution.testCaseCode} - {bug.testExecution.testCaseTitle}
                  </p>
                  {bug.testExecution.actualResult && (
                    <div className="mt-1 text-[11px] text-slate-600 italic bg-slate-50 p-1.5 rounded">
                      Kết quả thực tế ghi nhận: "{bug.testExecution.actualResult}"
                    </div>
                  )}
                </div>
              </div>
            ) : bug.testCase ? (
              <div className="bg-white p-2.5 rounded-lg border border-indigo-200/60 text-xs">
                <p className="text-[11px] text-slate-500 font-medium">Liên kết Test Case:</p>
                <p className="font-mono text-indigo-600 font-bold">
                  {bug.testCase.code} - {bug.testCase.title}
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">
                Lỗi độc lập (không liên kết trực tiếp với ca kiểm thử cụ thể).
              </p>
            )}
          </div>

          {/* People & Timestamps */}
          <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <p className="text-[11px] text-slate-400 font-medium mb-1">Người báo cáo (Reporter):</p>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-700 text-[10px]">
                  {bug.createdBy?.fullName?.charAt(0) || 'U'}
                </div>
                <span className="font-semibold text-slate-800">{bug.createdBy?.fullName}</span>
              </div>
            </div>

            <div>
              <p className="text-[11px] text-slate-400 font-medium mb-1">Người xử lý (Assignee):</p>
              <div className="flex items-center gap-2">
                {bug.assignee ? (
                  <>
                    <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[10px]">
                      {bug.assignee.fullName?.charAt(0) || 'A'}
                    </div>
                    <span className="font-semibold text-slate-800">{bug.assignee.fullName}</span>
                  </>
                ) : (
                  <span className="text-slate-400 italic">Chưa chỉ định</span>
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 text-slate-500">
              <span className="text-[10px] block text-slate-400">Thời gian tạo:</span>
              <span>{new Date(bug.createdAt).toLocaleString('vi-VN')}</span>
            </div>

            <div className="pt-2 border-t border-slate-200 text-slate-500">
              <span className="text-[10px] block text-slate-400">Thời gian giải quyết:</span>
              <span>
                {bug.resolvedAt
                  ? new Date(bug.resolvedAt).toLocaleString('vi-VN')
                  : 'Chưa giải quyết'}
              </span>
            </div>
          </div>

          {/* Description */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Mô tả chi tiết & Các bước tái hiện
            </h4>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 whitespace-pre-wrap font-sans leading-relaxed">
              {bug.description}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            onClick={handleDelete}
            className="px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition"
          >
            🗑️ Xóa lỗi
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onEdit(bug)}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition"
            >
              ✏️ Chỉnh sửa
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
