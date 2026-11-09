import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { MainLayout } from './components/layout/MainLayout';
import { LoginPage } from './pages/LoginPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { UsersManagementPage } from './pages/UsersManagementPage';
import { ProfilePage } from './pages/ProfilePage';
import { TestRepositoryPage } from './pages/TestRepositoryPage';
import { TestRunsPage } from './pages/TestRunsPage';
import { TestRunnerPage } from './pages/TestRunnerPage';
import { BugsPage } from './pages/BugsPage';
import { ErrorBoundary } from './components/common/ErrorBoundary';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white text-sm">
        <div className="flex flex-col items-center gap-3">
          <span className="text-3xl animate-bounce">🧪</span>
          <span>Đang tải hệ thống...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  if (user?.systemRole !== 'ADMIN') {
    return <Navigate to="/projects" replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public route */}
            <Route path="/login" element={<LoginPage />} />

            {/* Protected app routes inside MainLayout */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <ErrorBoundary>
                    <MainLayout />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/projects" replace />} />
              <Route path="projects" element={<ProjectsPage />} />
              <Route path="projects/:id" element={<ProjectDetailPage />} />
              <Route path="projects/:id/repository" element={<TestRepositoryPage />} />
              <Route path="test-suites" element={<TestRepositoryPage />} />
              <Route path="profile" element={<ProfilePage />} />

              {/* Admin-only system user management */}
              <Route
                path="users"
                element={
                  <AdminRoute>
                    <UsersManagementPage />
                  </AdminRoute>
                }
              />
              <Route path="projects/:id/test-runs" element={<TestRunsPage />} />
              <Route path="projects/:id/test-runs/:runId/runner" element={<TestRunnerPage />} />
              <Route path="test-runs" element={<TestRunsPage />} />

              <Route path="projects/:id/bugs" element={<BugsPage />} />
              <Route path="bugs" element={<BugsPage />} />
              <Route
                path="dashboard"
                element={
                  <div className="bg-white p-8 rounded-xl border border-slate-200 text-center">
                    <span className="text-3xl">📊</span>
                    <h3 className="font-bold text-slate-800 mt-2">Dashboard Thống Kê (Sprint 4)</h3>
                    <p className="text-xs text-slate-500 mt-1">Sẽ được phát triển trong Sprint 4: 18/01 - 31/01</p>
                  </div>
                }
              />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/projects" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
