import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import type { TestRunSummaryReport } from '../../types';

interface TestRunReportModalProps {
  projectId: string;
  runId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const TestRunReportModal: React.FC<TestRunReportModalProps> = ({
  projectId,
  runId,
  isOpen,
  onClose,
}) => {
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ISSUES' | 'PASSED'>('ALL');
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  const { data: report, isLoading, error } = useQuery<TestRunSummaryReport>({
    queryKey: ['test-run-report', projectId, runId],
    queryFn: async () => {
      const res = await apiClient.get<TestRunSummaryReport>(
        `/projects/${projectId}/reports/test-runs/${runId}/summary`,
      );
      return res.data;
    },
    enabled: isOpen && !!projectId && !!runId,
  });

  if (!isOpen) return null;

  const handleDownloadExcel = async () => {
    try {
      setIsExportingExcel(true);
      const res = await apiClient.get(
        `/projects/${projectId}/reports/test-runs/${runId}/excel`,
        {
          responseType: 'blob',
        },
      );
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `TestRun_${report?.run.name || runId}_Report.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Lỗi khi tải file Excel:', err);
      alert('Không thể tải file báo cáo Excel. Vui lòng thử lại sau.');
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handlePrintPdf = () => {
    window.print();
  };

  const filteredExecutions = report?.executions.filter((e) => {
    if (statusFilter === 'ISSUES') {
      return e.status === 'FAILED' || e.status === 'BLOCKED';
    }
    if (statusFilter === 'PASSED') {
      return e.status === 'PASSED';
    }
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PASSED':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-100 text-emerald-800">✓ ĐẠT</span>;
      case 'FAILED':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-rose-100 text-rose-800">✕ THẤT BẠI</span>;
      case 'BLOCKED':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-amber-100 text-amber-800">⚠ BỊ CHẶN</span>;
      case 'SKIPPED':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-slate-100 text-slate-700">⊘ BỎ QUA</span>;
      default:
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-slate-100 text-slate-500">○ CHƯA CHẠY</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 print:p-0 print:bg-white print:static">
      <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden print:max-h-none print:shadow-none print:border-none print:w-full">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center text-lg font-bold">
              📑
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Báo Cáo Tổng Kết Đợt Kiểm Thử</h3>
              <p className="text-xs text-slate-500">
                {report ? `${report.run.projectName} · ${report.run.name}` : 'Đang tải thông tin...'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadExcel}
              disabled={isExportingExcel || isLoading}
              className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium flex items-center gap-1.5 transition shadow-xs disabled:opacity-50"
              title="Tải tệp Excel 3 sheets: Tổng quan, Chi tiết, Bugs"
            >
              <span>📊</span>
              <span>{isExportingExcel ? 'Đang xuất...' : 'Xuất Excel (.xlsx)'}</span>
            </button>
            <button
              onClick={handlePrintPdf}
              disabled={isLoading}
              className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium flex items-center gap-1.5 transition shadow-xs disabled:opacity-50"
              title="In hoặc Lưu thành PDF định dạng A4"
            >
              <span>🖨️</span>
              <span>In / Lưu PDF</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 flex items-center justify-center transition ml-2"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 print:p-8 print:overflow-visible text-slate-800">
          {isLoading ? (
            <div className="py-20 text-center">
              <div className="text-3xl animate-bounce mb-3">📑</div>
              <p className="text-sm font-medium text-slate-600">Đang tổng hợp số liệu báo cáo...</p>
            </div>
          ) : error || !report ? (
            <div className="py-12 text-center text-rose-500 text-sm">
              Không thể tải dữ liệu báo cáo đợt kiểm thử. Vui lòng kiểm tra lại quyền truy cập.
            </div>
          ) : (
            <>
              {/* Printable Document Header */}
              <div className="border-b border-slate-200 pb-5">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
                      BÁO CÁO NGHIỆM THU KIỂM THỬ (TEST SUMMARY REPORT)
                    </span>
                    <h1 className="text-2xl font-black text-slate-900 mt-1">{report.run.name}</h1>
                    <p className="text-xs text-slate-500 mt-1">
                      Dự án: <span className="font-semibold text-slate-800">{report.run.projectName}</span>
                      {report.run.description && ` · ${report.run.description}`}
                    </p>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <div>Mã đợt test: <span className="font-mono text-slate-700">#{report.run.id.slice(-6)}</span></div>
                    <div>Trạng thái: <span className="font-semibold text-slate-800">{report.run.status}</span></div>
                    <div>Ngày xuất: {new Date().toLocaleDateString('vi-VN')}</div>
                  </div>
                </div>

                {/* Metadata Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-100 text-xs">
                  <div>
                    <span className="text-slate-400 block">Người tạo:</span>
                    <span className="font-semibold text-slate-800">{report.run.createdBy.fullName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Người được giao:</span>
                    <span className="font-semibold text-slate-800">
                      {report.run.assignedTo ? report.run.assignedTo.fullName : 'Chưa phân công'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Bắt đầu:</span>
                    <span className="font-medium text-slate-700">
                      {report.run.startedAt ? new Date(report.run.startedAt).toLocaleString('vi-VN') : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Hoàn thành:</span>
                    <span className="font-medium text-slate-700">
                      {report.run.completedAt ? new Date(report.run.completedAt).toLocaleString('vi-VN') : '—'}
                    </span>
                  </div>
                </div>

                {report.run.reworkReason && (
                  <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
                    <span className="font-bold">⚠️ Lý do QA Lead yêu cầu làm lại: </span>
                    {report.run.reworkReason}
                  </div>
                )}
              </div>

              {/* KPI Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase">Tổng Ca Test</span>
                  <div className="text-2xl font-bold text-slate-900 mt-0.5">{report.metrics.total}</div>
                  <span className="text-[10px] text-slate-400">100% phạm vi</span>
                </div>

                <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200">
                  <span className="text-[11px] font-semibold text-emerald-700 uppercase">Tỷ Lệ Đạt (Pass)</span>
                  <div className="text-2xl font-bold text-emerald-700 mt-0.5">{report.metrics.passRate}%</div>
                  <span className="text-[10px] text-emerald-600 font-medium">{report.metrics.passed} ca đạt</span>
                </div>

                <div className="bg-rose-50/70 p-3.5 rounded-xl border border-rose-200">
                  <span className="text-[11px] font-semibold text-rose-700 uppercase">Thất Bại (Fail)</span>
                  <div className="text-2xl font-bold text-rose-700 mt-0.5">{report.metrics.failed}</div>
                  <span className="text-[10px] text-rose-600 font-medium">Cần xử lý lỗi</span>
                </div>

                <div className="bg-amber-50/70 p-3.5 rounded-xl border border-amber-200">
                  <span className="text-[11px] font-semibold text-amber-700 uppercase">Bị Chặn (Blocked)</span>
                  <div className="text-2xl font-bold text-amber-700 mt-0.5">{report.metrics.blocked}</div>
                  <span className="text-[10px] text-amber-600 font-medium">Môi trường / rào cản</span>
                </div>

                <div className="bg-indigo-50/70 p-3.5 rounded-xl border border-indigo-200">
                  <span className="text-[11px] font-semibold text-indigo-700 uppercase">Bugs Phát Hiện</span>
                  <div className="text-2xl font-bold text-indigo-700 mt-0.5">{report.metrics.totalBugs}</div>
                  <span className="text-[10px] text-indigo-600 font-medium">Liên kết ca test</span>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase">Tiến Độ Chạy</span>
                  <div className="text-2xl font-bold text-slate-900 mt-0.5">{report.metrics.progressRate}%</div>
                  <span className="text-[10px] text-slate-400">{report.metrics.untested} ca chưa test</span>
                </div>
              </div>

              {/* Bugs Section (if any) */}
              {report.bugs.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                      <span>🐞</span> Danh Sách Bugs Phát Sinh Trong Đợt Kiểm Thử ({report.bugs.length})
                    </h4>
                  </div>
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">Mã Bug</th>
                          <th className="py-2.5 px-3">Tiêu Đề</th>
                          <th className="py-2.5 px-3">Ca Test Liên Quan</th>
                          <th className="py-2.5 px-3">Mức Độ</th>
                          <th className="py-2.5 px-3">Trạng Thái</th>
                          <th className="py-2.5 px-3">Người Nhận</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {report.bugs.map((b) => (
                          <tr key={b.id} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-3 font-mono font-bold text-rose-600">{b.code}</td>
                            <td className="py-2.5 px-3 font-medium text-slate-800">{b.title}</td>
                            <td className="py-2.5 px-3 text-slate-500">
                              {b.testCase ? `${b.testCase.code} - ${b.testCase.title}` : '—'}
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  b.severity === 'CRITICAL'
                                    ? 'bg-rose-100 text-rose-800'
                                    : b.severity === 'HIGH'
                                    ? 'bg-orange-100 text-orange-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {b.severity}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="font-medium text-slate-700">{b.status}</span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-600">
                              {b.assignee ? b.assignee.fullName : <span className="text-slate-400">Chưa gán</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Executions Table */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <span>🧪</span> Chi Tiết Thực Thi Ca Kiểm Thử ({filteredExecutions?.length || 0})
                  </h4>

                  {/* Filter Tabs (Hidden in print) */}
                  <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs print:hidden">
                    <button
                      onClick={() => setStatusFilter('ALL')}
                      className={`px-2.5 py-1 rounded-md font-medium transition ${
                        statusFilter === 'ALL'
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Tất cả ({report.executions.length})
                    </button>
                    <button
                      onClick={() => setStatusFilter('ISSUES')}
                      className={`px-2.5 py-1 rounded-md font-medium transition ${
                        statusFilter === 'ISSUES'
                          ? 'bg-rose-600 text-white shadow-2xs'
                          : 'text-rose-700 hover:bg-rose-50'
                      }`}
                    >
                      Chỉ ca Lỗi / Blocked ({report.metrics.failed + report.metrics.blocked})
                    </button>
                    <button
                      onClick={() => setStatusFilter('PASSED')}
                      className={`px-2.5 py-1 rounded-md font-medium transition ${
                        statusFilter === 'PASSED'
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'text-emerald-700 hover:bg-emerald-50'
                      }`}
                    >
                      Đạt ({report.metrics.passed})
                    </button>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Mã TC</th>
                        <th className="py-2.5 px-3">Tiêu Đề</th>
                        <th className="py-2.5 px-3">Độ Ưu Tiên</th>
                        <th className="py-2.5 px-3">Kết Quả</th>
                        <th className="py-2.5 px-3">Người Chạy</th>
                        <th className="py-2.5 px-3">Kết Quả Thực Tế / Ghi Chú</th>
                        <th className="py-2.5 px-3">Bugs Liên Kết</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredExecutions?.map((e) => (
                        <tr key={e.id} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-700">{e.testCaseCode}</td>
                          <td className="py-2.5 px-3 font-medium text-slate-900">{e.testCaseTitle}</td>
                          <td className="py-2.5 px-3 text-slate-500">{e.testCasePriority}</td>
                          <td className="py-2.5 px-3">{getStatusBadge(e.status)}</td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {e.executedBy ? e.executedBy.fullName : <span className="text-slate-400">—</span>}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate">
                            {e.actualResult || <span className="text-slate-400 italic">Không có ghi chú</span>}
                          </td>
                          <td className="py-2.5 px-3">
                            {e.bugs.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {e.bugs.map((b) => (
                                  <span
                                    key={b.id}
                                    className="px-1.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded font-mono font-semibold text-[10px]"
                                  >
                                    {b.code}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Sign-off Footer for Print */}
              <div className="hidden print:grid grid-cols-2 gap-8 pt-8 mt-12 border-t border-slate-200 text-xs">
                <div className="text-center">
                  <div className="font-bold text-slate-800 mb-12">NGƯỜI LẬP BÁO CÁO (TESTER)</div>
                  <div className="text-slate-500 italic">(Ký và ghi rõ họ tên)</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-slate-800 mb-12">PHÊ DUYỆT (QA LEAD / PM)</div>
                  <div className="text-slate-500 italic">(Ký và ghi rõ họ tên)</div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50/80 flex items-center justify-between shrink-0 print:hidden text-xs text-slate-500">
          <span>Xuất báo cáo dưới dạng Excel hoặc in ra tài liệu PDF chuẩn A4.</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium rounded-lg transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
