import React, { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';

interface ImportExportModalProps {
  projectId: string;
  projectName: string;
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'IMPORT' | 'EXPORT';
}

export const ImportExportModal: React.FC<ImportExportModalProps> = ({
  projectId,
  projectName,
  isOpen,
  onClose,
  initialMode = 'IMPORT',
}) => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<'IMPORT' | 'EXPORT'>(initialMode);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<{
    total: number;
    imported: number;
    failed: number;
    errors: { row: number; reason: string }[];
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<'xlsx' | 'csv'>('xlsx');
  const [isExporting, setIsExporting] = useState(false);

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiClient.post(`/projects/${projectId}/test-cases/import`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    },
    onSuccess: (data) => {
      setImportResult(data);
      queryClient.invalidateQueries({ queryKey: ['test-cases', projectId] });
      queryClient.invalidateQueries({ queryKey: ['test-suites', projectId] });
    },
    onError: (err: any) => {
      setImportError(err.response?.data?.message || 'Nhập khẩu tệp thất bại');
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setImportError(null);
      setImportResult(null);
    }
  };

  const handleStartImport = () => {
    if (!selectedFile) return;
    importMutation.mutate(selectedFile);
  };

  // Export handler
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await apiClient.get(`/projects/${projectId}/test-cases/export`, {
        params: { format: exportFormat },
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      const safeProjectName = projectName.replace(/[^a-zA-Z0-9_-]/g, '_');
      link.setAttribute(
        'download',
        `${safeProjectName}_test_cases_${new Date().toISOString().slice(0, 10)}.${exportFormat}`,
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Không thể xuất dữ liệu kiểm thử. Vui lòng thử lại.');
    } finally {
      setIsExporting(false);
    }
  };

  // Download sample template
  const handleDownloadTemplate = (format: 'xlsx' | 'csv') => {
    if (format === 'csv') {
      const csvContent =
        'Tiêu đề,Test Suite,Độ ưu tiên,Trạng thái,Tags,Điều kiện tiên quyết,Mô tả,Các bước thực hiện\n' +
        '"Đăng nhập thành công với email hợp lệ","Xác thực","HIGH","READY","auth,smoke","Tài khoản đã kích hoạt","Kiểm tra đăng nhập đúng mật khẩu","1. Nhập email và mật khẩu -> Kỳ vọng: Form hợp lệ\n2. Bấm Đăng nhập -> Kỳ vọng: Vào Dashboard thành công"\n' +
        '"Đăng nhập thất bại khi sai mật khẩu","Xác thực","MEDIUM","READY","auth","Tài khoản đã tồn tại","Kiểm tra thông báo lỗi khi nhập sai mật khẩu","1. Nhập mật khẩu sai -> Kỳ vọng: Hiển thị lỗi mật khẩu không đúng"';
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'test_cases_template.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } else {
      // Export as csv template is widely supported or trigger csv
      handleDownloadTemplate('csv');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden">
        {/* Header with Tabs */}
        <div className="bg-slate-50 border-b border-slate-200 p-4 flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs font-bold">
            <button
              onClick={() => setActiveTab('IMPORT')}
              className={`pb-1 border-b-2 transition ${
                activeTab === 'IMPORT'
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              📥 Nhập Test Case (Import)
            </button>
            <button
              onClick={() => setActiveTab('EXPORT')}
              className={`pb-1 border-b-2 transition ${
                activeTab === 'EXPORT'
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              📤 Xuất Test Case (Export)
            </button>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-base w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-200"
          >
            ✕
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 text-xs">
          {/* TAB 1: IMPORT */}
          {activeTab === 'IMPORT' && (
            <div className="space-y-4">
              <p className="text-slate-600 leading-relaxed">
                Tải lên tệp bảng tính <strong>Excel (.xlsx)</strong> hoặc <strong>CSV</strong> chứa danh sách ca kiểm thử. Hệ thống sẽ tự động đối soát và phân nhóm vào Test Suite tương ứng.
              </p>

              {/* Download Template Banner */}
              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="font-semibold text-indigo-900 block">Chưa có tệp mẫu?</span>
                  <span className="text-[11px] text-indigo-700">Tải tệp mẫu chuẩn cấu trúc</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleDownloadTemplate('csv')}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-3 py-1.5 rounded-lg text-xs transition shadow-2xs"
                >
                  📄 Tải tệp mẫu (.CSV)
                </button>
              </div>

              {/* Upload Drop Zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/30 p-6 rounded-2xl text-center cursor-pointer transition"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <span className="text-3xl block mb-2">📁</span>
                {selectedFile ? (
                  <div>
                    <span className="font-bold text-slate-800 text-sm block">
                      {selectedFile.name}
                    </span>
                    <span className="text-slate-400 text-[11px]">
                      ({(selectedFile.size / 1024).toFixed(1)} KB) · Bấm để đổi tệp khác
                    </span>
                  </div>
                ) : (
                  <div>
                    <span className="font-semibold text-slate-700 text-sm block">
                      Bấm để chọn tệp Excel hoặc CSV
                    </span>
                    <span className="text-slate-400 text-[11px] mt-1 block">
                      Hỗ trợ định dạng .xlsx, .xls, .csv (tối đa 10MB)
                    </span>
                  </div>
                )}
              </div>

              {/* Error Alert */}
              {importError && (
                <div className="p-3 bg-rose-50 border-l-4 border-rose-500 text-rose-700 text-xs rounded">
                  {importError}
                </div>
              )}

              {/* Success / Summary Result */}
              {importResult && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                  <div className="font-bold text-emerald-900 flex items-center justify-between">
                    <span>Kết quả nhập khẩu:</span>
                    <span className="text-xs font-mono font-bold">
                      {importResult.imported}/{importResult.total} ca kiểm thử
                    </span>
                  </div>
                  <div className="text-[11px] text-emerald-800">
                    - Thành công: <strong>{importResult.imported}</strong> ca kiểm thử.
                    {importResult.failed > 0 && (
                      <span className="text-rose-700 ml-2">
                        - Lỗi: <strong>{importResult.failed}</strong> dòng.
                      </span>
                    )}
                  </div>

                  {/* Errors detail if any */}
                  {importResult.errors && importResult.errors.length > 0 && (
                    <div className="max-h-24 overflow-y-auto bg-white p-2 rounded border border-rose-200 text-[11px] text-rose-700 space-y-1">
                      {importResult.errors.map((err, idx) => (
                        <div key={idx}>
                          Dòng {err.row}: {err.reason}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 transition"
                >
                  {importResult ? 'Đóng' : 'Hủy'}
                </button>
                {!importResult && (
                  <button
                    type="button"
                    disabled={!selectedFile || importMutation.isPending}
                    onClick={handleStartImport}
                    className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition shadow-sm disabled:opacity-50"
                  >
                    {importMutation.isPending ? 'Đang nhập khẩu...' : 'Bắt đầu Nhập khẩu'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: EXPORT */}
          {activeTab === 'EXPORT' && (
            <div className="space-y-4">
              <p className="text-slate-600 leading-relaxed">
                Xuất toàn bộ kho ca kiểm thử của dự án <strong>{projectName}</strong> ra tệp tin để lưu trữ ngoại tuyến hoặc gửi báo cáo cho các bên liên quan.
              </p>

              <div>
                <label className="block font-semibold text-slate-700 mb-2">Chọn định dạng tệp:</label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`border p-3.5 rounded-xl flex items-center gap-3 cursor-pointer transition ${
                      exportFormat === 'xlsx'
                        ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 font-semibold'
                        : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="format"
                      checked={exportFormat === 'xlsx'}
                      onChange={() => setExportFormat('xlsx')}
                      className="text-indigo-600"
                    />
                    <div>
                      <span className="block text-sm">📊 Microsoft Excel</span>
                      <span className="text-[10px] text-slate-400 font-normal">Định dạng .xlsx (Khuyên dùng)</span>
                    </div>
                  </label>

                  <label
                    className={`border p-3.5 rounded-xl flex items-center gap-3 cursor-pointer transition ${
                      exportFormat === 'csv'
                        ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 font-semibold'
                        : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="format"
                      checked={exportFormat === 'csv'}
                      onChange={() => setExportFormat('csv')}
                      className="text-indigo-600"
                    />
                    <div>
                      <span className="block text-sm">📄 CSV (Dấu phẩy)</span>
                      <span className="text-[10px] text-slate-400 font-normal">Định dạng .csv nhẹ, dễ tích hợp</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 transition"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={isExporting}
                  onClick={handleExport}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                >
                  <span>{isExporting ? 'Đang chuẩn bị tệp...' : 'Tải xuống ngay'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
