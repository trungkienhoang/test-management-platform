import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[400px] flex items-center justify-center p-6">
          <div className="bg-white border border-rose-200 rounded-2xl p-8 max-w-lg w-full shadow-lg text-center">
            <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">
              ⚠️
            </div>
            <h2 className="text-lg font-bold text-slate-800 mb-2">Đã xảy ra lỗi giao diện</h2>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Hệ thống gặp sự cố khi tải trang này. Bạn có thể bấm &quot;Thử lại&quot; hoặc quay về Dashboard.
            </p>
            {this.state.error && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-[11px] font-mono text-rose-600 text-left mb-5 overflow-x-auto max-h-32">
                {this.state.error.message}
              </div>
            )}
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={this.handleReset}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
              >
                🔄 Thử lại
              </button>
              <button
                type="button"
                onClick={() => {
                  window.location.href = '/projects';
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
              >
                🏠 Về danh sách dự án
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
