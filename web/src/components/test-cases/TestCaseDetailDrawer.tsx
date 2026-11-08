import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import type { TestCase, TestCaseHistory } from '../../types';

interface TestCaseDetailDrawerProps {
  projectId: string;
  testCaseId: string | null;
  onClose: () => void;
  onEdit: (testCase: TestCase) => void;
  canManage: boolean;
}

export const TestCaseDetailDrawer: React.FC<TestCaseDetailDrawerProps> = ({
  projectId,
  testCaseId,
  onClose,
  onEdit,
  canManage,
}) => {
  const [activeTab, setActiveTab] = useState<'DETAILS' | 'HISTORY'>('DETAILS');
  const [diffBaseVersion, setDiffBaseVersion] = useState<number | null>(null);
  const [diffTargetVersion, setDiffTargetVersion] = useState<number | null>(null);

  // Fetch Test Case details
  const { data: testCase, isLoading: isDetailsLoading } = useQuery<TestCase>({
    queryKey: ['test-case-detail', projectId, testCaseId],
    queryFn: async () => {
      const res = await apiClient.get<TestCase>(`/projects/${projectId}/test-cases/${testCaseId}`);
      return res.data;
    },
    enabled: !!testCaseId,
  });

  // Fetch Version History
  const { data: rawHistories = [], isLoading: isHistoryLoading } = useQuery<TestCaseHistory[]>({
    queryKey: ['test-case-histories', projectId, testCaseId],
    queryFn: async () => {
      const res = await apiClient.get<TestCaseHistory[]>(
        `/projects/${projectId}/test-cases/${testCaseId}/history`,
      );
      return res.data;
    },
    enabled: !!testCaseId && activeTab === 'HISTORY',
  });

  const histories = Array.isArray(rawHistories) ? rawHistories : [];

  // Auto-initialize diff versions if not set
  React.useEffect(() => {
    if (histories.length >= 2) {
      if (diffBaseVersion === null) setDiffBaseVersion(histories[histories.length - 1].version);
      if (diffTargetVersion === null) setDiffTargetVersion(histories[0].version);
    }
  }, [histories, diffBaseVersion, diffTargetVersion]);

  if (!testCaseId) return null;

  // Selected history snapshots for Diff comparison
  const baseHistory = histories.find((h) => h.version === diffBaseVersion);
  const targetHistory = histories.find((h) => h.version === diffTargetVersion);

  const getStepsCount = (steps: any): number => {
    if (Array.isArray(steps)) return steps.length;
    if (typeof steps === 'string') {
      try {
        const p = JSON.parse(steps);
        if (Array.isArray(p)) return p.length;
      } catch {}
    }
    return 0;
  };

  const normalizedSteps: any[] = (() => {
    if (!testCase?.steps) return [];
    if (Array.isArray(testCase.steps)) return testCase.steps;
    if (typeof testCase.steps === 'string') {
      try {
        const parsed = JSON.parse(testCase.steps);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }
    return [];
  })();

  const normalizedTags: string[] = (() => {
    if (!testCase?.tags) return [];
    if (Array.isArray(testCase.tags)) return testCase.tags;
    if (typeof testCase.tags === 'string') {
      return (testCase.tags as string).split(',').map((t) => t.trim()).filter(Boolean);
    }
    return [];
  })();

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case 'CRITICAL':
        return <span className="bg-rose-100 text-rose-700 font-bold px-2 py-0.5 rounded text-[11px]">🔴 CRITICAL</span>;
      case 'HIGH':
        return <span className="bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded text-[11px]">🟠 HIGH</span>;
      case 'LOW':
        return <span className="bg-slate-100 text-slate-700 font-medium px-2 py-0.5 rounded text-[11px]">🟢 LOW</span>;
      default:
        return <span className="bg-blue-100 text-blue-700 font-medium px-2 py-0.5 rounded text-[11px]">🔵 MEDIUM</span>;
    }
  };

  const getStatusBadge = (s: string) => {
    switch (s) {
      case 'READY':
        return <span className="bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded text-[11px]">✅ READY</span>;
      case 'DEPRECATED':
        return <span className="bg-rose-100 text-rose-700 font-semibold px-2 py-0.5 rounded text-[11px]">⛔ DEPRECATED</span>;
      default:
        return <span className="bg-slate-100 text-slate-600 font-medium px-2 py-0.5 rounded text-[11px]">📝 DRAFT</span>;
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex justify-end z-50 transition-opacity">
      <div className="bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-start justify-between">
          <div className="flex-1 pr-4">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-indigo-600 text-white shadow-2xs">
                {testCase?.code || 'TC-...'}
              </span>
              {testCase?.suite && (
                <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded text-xs">
                  📁 {testCase.suite.name}
                </span>
              )}
              {testCase && getPriorityBadge(testCase.priority)}
              {testCase && getStatusBadge(testCase.status)}
              <span className="text-slate-400 text-xs font-mono font-bold">
                v{testCase?.version || 1}
              </span>
            </div>
            <h2 className="text-base font-bold text-slate-900 leading-snug">
              {testCase?.title || 'Đang tải...'}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {canManage && testCase && (
              <button
                onClick={() => {
                  onClose();
                  onEdit(testCase);
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-2xs transition flex items-center gap-1"
              >
                <span>✏️</span> Sửa
              </button>
            )}
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-200 text-base"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-6 px-5 border-b border-slate-200 bg-white text-xs font-semibold">
          <button
            onClick={() => setActiveTab('DETAILS')}
            className={`py-3 border-b-2 transition ${
              activeTab === 'DETAILS'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            📋 Chi tiết Ca kiểm thử
          </button>
          <button
            onClick={() => {
              setActiveTab('HISTORY');
              if (histories.length >= 2 && !diffBaseVersion) {
                setDiffBaseVersion(histories[1].version);
                setDiffTargetVersion(histories[0].version);
              }
            }}
            className={`py-3 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'HISTORY'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>🕒 Lịch sử phiên bản & So sánh Diff</span>
            {testCase && (
              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded-full font-mono">
                {testCase.version}
              </span>
            )}
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 text-xs">
          {/* TAB 1: DETAILS */}
          {activeTab === 'DETAILS' && (
            <div className="space-y-5">
              {isDetailsLoading ? (
                <div className="text-center py-10 text-slate-400">Đang tải thông tin chi tiết...</div>
              ) : testCase ? (
                <>
                  {/* Pre-conditions */}
                  {testCase.preconditions && (
                    <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl">
                      <div className="font-bold text-amber-900 mb-1 flex items-center gap-1.5">
                        <span>⚡</span> Điều kiện tiên quyết (Pre-conditions):
                      </div>
                      <p className="text-amber-800 leading-relaxed whitespace-pre-line">
                        {testCase.preconditions}
                      </p>
                    </div>
                  )}

                  {/* Description */}
                  {testCase.description && (
                    <div>
                      <h4 className="font-bold text-slate-700 mb-1">Mô tả:</h4>
                      <p className="text-slate-600 leading-relaxed whitespace-pre-line">
                        {testCase.description}
                      </p>
                    </div>
                  )}

                  {/* Steps Table */}
                  <div>
                    <h4 className="font-bold text-slate-800 mb-2 flex items-center justify-between">
                      <span>Các bước thực hiện ({normalizedSteps.length} bước):</span>
                    </h4>

                    {normalizedSteps.length === 0 ? (
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-400">
                        Chưa có bước thực hiện cụ thể.
                      </div>
                    ) : (
                      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                        <table className="w-full text-left">
                          <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] font-bold border-b border-slate-200">
                            <tr>
                              <th className="py-2 px-3 w-12 text-center">#</th>
                              <th className="py-2 px-3">Hành động (Action)</th>
                              <th className="py-2 px-3">Kết quả mong đợi (Expected Result)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {normalizedSteps.map((step: any, idx: number) => (
                              <tr key={step.stepNumber || idx + 1} className="hover:bg-slate-50">
                                <td className="py-2.5 px-3 text-center font-bold text-indigo-600 font-mono">
                                  {step.stepNumber || idx + 1}
                                </td>
                                <td className="py-2.5 px-3 text-slate-800 font-medium whitespace-pre-line">
                                  {step.action}
                                </td>
                                <td className="py-2.5 px-3 text-slate-600 whitespace-pre-line">
                                  {step.expectedResult}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Tags */}
                  {normalizedTags.length > 0 && (
                    <div>
                      <h4 className="font-bold text-slate-700 mb-1.5">Thẻ phân loại (Tags):</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {normalizedTags.map((t) => (
                          <span
                            key={t}
                            className="bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full font-medium border border-indigo-200 text-[11px]"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Metadata */}
                  <div className="pt-4 border-t border-slate-100 text-slate-400 text-[11px] space-y-1">
                    <div>
                      Tạo bởi:{' '}
                      <span className="font-semibold text-slate-600">
                        {testCase.createdBy?.fullName || 'Hệ thống'}
                      </span>{' '}
                      vào ngày {new Date(testCase.createdAt).toLocaleString('vi-VN')}
                    </div>
                    <div>
                      Cập nhật lần cuối: {new Date(testCase.updatedAt).toLocaleString('vi-VN')}
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          )}

          {/* TAB 2: VERSION HISTORY & DIFF */}
          {activeTab === 'HISTORY' && (
            <div className="space-y-6">
              {isHistoryLoading ? (
                <div className="text-center py-10 text-slate-400">Đang tải lịch sử phiên bản...</div>
              ) : (
                <>
                  {/* Diff Comparison Selector */}
                  {histories.length >= 2 && (
                    <div className="p-3.5 bg-indigo-50/60 border border-indigo-200 rounded-xl space-y-3">
                      <div className="font-bold text-indigo-900 flex items-center justify-between">
                        <span>🔍 So sánh Diff giữa 2 phiên bản:</span>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Phiên bản gốc (Cũ):
                          </label>
                          <select
                            value={diffBaseVersion || ''}
                            onChange={(e) => setDiffBaseVersion(Number(e.target.value))}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                          >
                            {histories.map((h) => (
                              <option key={h.version} value={h.version}>
                                v{h.version} ({new Date(h.createdAt).toLocaleDateString('vi-VN')})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Phiên bản so sánh (Mới):
                          </label>
                          <select
                            value={diffTargetVersion || ''}
                            onChange={(e) => setDiffTargetVersion(Number(e.target.value))}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                          >
                            {histories.map((h) => (
                              <option key={h.version} value={h.version}>
                                v{h.version} ({new Date(h.createdAt).toLocaleDateString('vi-VN')})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Visual Diff Result */}
                      {baseHistory && targetHistory && baseHistory.version !== targetHistory.version && (
                        <div className="mt-2 pt-2 border-t border-indigo-100 text-xs space-y-2">
                          <div className="font-semibold text-indigo-800">
                            Kết quả khác biệt (v{baseHistory.version} ➔ v{targetHistory.version}):
                          </div>

                          <div className="grid grid-cols-2 gap-2 p-2 bg-white rounded-lg border border-slate-200">
                            <div>
                              <span className="text-[10px] text-slate-400 font-bold block mb-0.5">
                                [v{baseHistory.version}] Tiêu đề
                              </span>
                              <div className="text-rose-700 bg-rose-50 p-1 rounded font-medium">
                                {baseHistory.title}
                              </div>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 font-bold block mb-0.5">
                                [v{targetHistory.version}] Tiêu đề
                              </span>
                              <div className="text-emerald-700 bg-emerald-50 p-1 rounded font-medium">
                                {targetHistory.title}
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 p-2 bg-white rounded-lg border border-slate-200">
                            <div>
                              <span className="text-[10px] text-slate-400 font-bold block mb-0.5">
                                [v{baseHistory.version}] Độ ưu tiên & Trạng thái
                              </span>
                              <div className="flex gap-1.5">
                                {getPriorityBadge(baseHistory.priority)}
                                {getStatusBadge(baseHistory.status)}
                              </div>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 font-bold block mb-0.5">
                                [v{targetHistory.version}] Độ ưu tiên & Trạng thái
                              </span>
                              <div className="flex gap-1.5">
                                {getPriorityBadge(targetHistory.priority)}
                                {getStatusBadge(targetHistory.status)}
                              </div>
                            </div>
                          </div>

                          {/* Steps diff count */}
                          <div className="text-slate-600 bg-white p-2 rounded-lg border border-slate-200">
                            Số bước: <strong>{getStepsCount(baseHistory.steps)}</strong> (cũ) ➔{' '}
                            <strong className="text-indigo-600">{getStepsCount(targetHistory.steps)}</strong> (mới).
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* History Timeline Cards */}
                  <div>
                    <h4 className="font-bold text-slate-800 mb-3">Tất cả các phiên bản ({histories.length}):</h4>
                    <div className="space-y-3 relative before:absolute before:top-2 before:bottom-2 before:left-3 before:w-0.5 before:bg-slate-200">
                      {histories.map((h) => (
                        <div key={h.version} className="relative pl-7 group">
                          {/* Dot on timeline */}
                          <div className="absolute left-1.5 top-2.5 w-3.5 h-3.5 rounded-full bg-white border-2 border-indigo-600 group-hover:scale-125 transition" />

                          <div className="p-3.5 bg-slate-50 hover:bg-white border border-slate-200 rounded-xl transition shadow-2xs">
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-700">
                                  Phiên bản v{h.version}
                                </span>
                                {getPriorityBadge(h.priority)}
                                {getStatusBadge(h.status)}
                              </div>
                              <span className="text-[11px] text-slate-400">
                                {new Date(h.createdAt).toLocaleString('vi-VN')}
                              </span>
                            </div>

                            <h5 className="font-bold text-slate-800 text-xs mb-1">{h.title}</h5>

                            {h.changeReason && (
                              <p className="text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-200/60 mb-2">
                                💬 <em>Lý do: {h.changeReason}</em>
                              </p>
                            )}

                            <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
                              <span>
                                Người thực hiện:{' '}
                                <strong className="text-slate-700">
                                  {h.changedBy?.fullName || 'Hệ thống'}
                                </strong>
                              </span>
                              <span>{getStepsCount(h.steps)} bước thực hiện</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
