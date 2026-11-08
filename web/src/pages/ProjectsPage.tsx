import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import type { Project, PaginatedResponse } from '../types';

export const ProjectsPage: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const queryClient = useQueryClient();

  // Fetch projects
  const { data, isLoading, error } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await apiClient.get<PaginatedResponse<Project>>('/projects');
      return res.data;
    },
  });

  // Create project mutation
  const createMutation = useMutation({
    mutationFn: async (newProject: { name: string; description?: string }) => {
      const res = await apiClient.post<Project>('/projects', newProject);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setIsModalOpen(false);
      setName('');
      setDescription('');
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ name, description });
  };

  const projects = data?.data || [];

  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Dự án Kiểm thử</h2>
          <p className="text-sm text-slate-500 mt-1">
            Quản lý các dự án, danh sách test case và các thành viên liên quan
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg shadow-sm transition"
        >
          <span>➕</span> Tạo dự án mới
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Tìm kiếm dự án theo tên hoặc mô tả..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <span className="absolute left-3 top-2.5 text-slate-400">🔍</span>
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-white rounded-lg border border-slate-300 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="ALL">Tất cả trạng thái</option>
          <option value="ACTIVE">Đang hoạt động (ACTIVE)</option>
          <option value="ARCHIVED">Đã lưu trữ (ARCHIVED)</option>
        </select>
      </div>

      {/* Project Grid */}
      {isLoading ? (
        <div className="text-center py-16 text-slate-400 text-sm">
          ⏳ Đang tải danh sách dự án...
        </div>
      ) : error ? (
        <div className="text-center py-16 text-rose-500 text-sm">
          ❌ Không thể tải danh sách dự án. Vui lòng thử lại.
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-slate-300 p-8">
          <span className="text-4xl">📂</span>
          <h3 className="text-sm font-semibold text-slate-700 mt-3">Chưa có dự án nào</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Bấm "Tạo dự án mới" để bắt đầu thiết lập không gian kiểm thử đầu tiên của bạn.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <Link
              key={project.id}
              to={`/projects/${project.id}`}
              className={`bg-white rounded-xl p-6 border transition flex flex-col justify-between group ${
                project.status === 'ARCHIVED'
                  ? 'border-amber-200/80 bg-slate-50/50 hover:border-amber-400'
                  : 'border-slate-200 hover:border-indigo-400 hover:shadow-md'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-slate-800 group-hover:text-indigo-600 transition truncate">
                    {project.name}
                  </h3>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 flex items-center gap-1 ${
                      project.status === 'ACTIVE'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        project.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                    />
                    {project.status === 'ACTIVE' ? 'ACTIVE' : 'ARCHIVED'}
                  </span>
                </div>

                <p className="text-xs text-slate-500 line-clamp-2 mb-4">
                  {project.description || 'Không có mô tả chi tiết'}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-1.5">
                  <span>👥</span>
                  <span>{project._count?.members ?? 1} thành viên</span>
                </div>
                <div>
                  Tạo bởi {project.createdBy?.fullName || 'Admin'}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create Project Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Tạo Dự Án Mới</h3>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tên dự án *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="VD: Mobile App Testing Sprint 24"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mô tả ngắn
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Mô tả phạm vi kiểm thử, mục tiêu chất lượng..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition shadow-sm disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Đang tạo...' : 'Tạo dự án'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
