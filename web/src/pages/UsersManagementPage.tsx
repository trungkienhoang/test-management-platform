import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { User, PaginatedResponse, SystemRole } from '../types';

export const UsersManagementPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);

  // Form states for Create
  const [newEmail, setNewEmail] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<SystemRole>('USER');
  const [createError, setCreateError] = useState<string | null>(null);

  // Form states for Edit
  const [editFullName, setEditFullName] = useState('');
  const [editRole, setEditRole] = useState<SystemRole>('USER');
  const [editActive, setEditActive] = useState(true);
  const [editError, setEditError] = useState<string | null>(null);

  // Fetch users with filters and pagination
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-users', page, search, roleFilter, statusFilter],
    queryFn: async () => {
      const params: Record<string, any> = { page, limit: 10 };
      if (search.trim()) params.search = search.trim();
      if (roleFilter !== 'ALL') params.role = roleFilter;
      if (statusFilter !== 'ALL') params.isActive = statusFilter === 'ACTIVE';

      const res = await apiClient.get<PaginatedResponse<User>>('/users', { params });
      return res.data;
    },
  });

  // Create User Mutation
  const createMutation = useMutation({
    mutationFn: async (payload: { email: string; fullName: string; password: string; systemRole: SystemRole }) => {
      const res = await apiClient.post<User>('/users', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setIsCreateOpen(false);
      setNewEmail('');
      setNewFullName('');
      setNewPassword('');
      setNewRole('USER');
      setCreateError(null);
    },
    onError: (err: any) => {
      setCreateError(err.response?.data?.message || 'Không thể tạo người dùng');
    },
  });

  // Update User Mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { fullName?: string; systemRole?: SystemRole; isActive?: boolean } }) => {
      const res = await apiClient.patch<User>(`/users/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setEditUser(null);
      setEditError(null);
    },
    onError: (err: any) => {
      setEditError(err.response?.data?.message || 'Không thể cập nhật người dùng');
    },
  });

  // Delete User Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Không thể xóa người dùng');
    },
  });

  const handleOpenEdit = (user: User) => {
    setEditUser(user);
    setEditFullName(user.fullName);
    setEditRole(user.systemRole);
    setEditActive(user.isActive !== false);
    setEditError(null);
  };

  const users = data?.data || [];
  const meta = data?.meta || { total: 0, totalPages: 1, page: 1 };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">👥</span>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Quản Lý Người Dùng</h2>
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-semibold uppercase">
              System Admin
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Quản trị tài khoản, phân quyền cấp hệ sinh thái và trạng thái truy cập toàn nền tảng.
          </p>
        </div>

        <button
          onClick={() => {
            setIsCreateOpen(true);
            setCreateError(null);
          }}
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg shadow-sm transition"
        >
          <span>➕</span> Tạo người dùng mới
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Tìm kiếm theo họ tên hoặc email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 bg-white rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <span className="absolute left-3 top-2.5 text-slate-400">🔍</span>
        </div>

        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 bg-white rounded-lg border border-slate-300 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="ALL">Tất cả vai trò</option>
          <option value="ADMIN">ADMIN</option>
          <option value="USER">USER</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 bg-white rounded-lg border border-slate-300 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="ALL">Tất cả trạng thái</option>
          <option value="ACTIVE">Hoạt động (Active)</option>
          <option value="INACTIVE">Bị khóa (Inactive)</option>
        </select>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="py-16 text-center text-slate-400 text-sm">⏳ Đang tải danh sách người dùng...</div>
        ) : error ? (
          <div className="py-16 text-center text-rose-500 text-sm">❌ Không thể tải dữ liệu người dùng.</div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">Không tìm thấy người dùng nào phù hợp.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 font-semibold text-xs uppercase border-b border-slate-200 tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Họ Tên</th>
                  <th className="px-6 py-3.5">Email</th>
                  <th className="px-6 py-3.5">Vai trò hệ thống</th>
                  <th className="px-6 py-3.5">Trạng thái</th>
                  <th className="px-6 py-3.5">Ngày tạo</th>
                  <th className="px-6 py-3.5 text-right">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => {
                  const isSelf = u.id === currentUser?.id;
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-6 py-4 font-medium text-slate-800 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm shrink-0">
                          {u.fullName?.charAt(0) || 'U'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span>{u.fullName}</span>
                            {isSelf && (
                              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-semibold border border-slate-200">
                                Bạn
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 font-mono text-xs">{u.email}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            u.systemRole === 'ADMIN'
                              ? 'bg-purple-100 text-purple-700 border border-purple-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {u.systemRole}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            u.isActive !== false
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              u.isActive !== false ? 'bg-emerald-500' : 'bg-rose-500'
                            }`}
                          />
                          {u.isActive !== false ? 'Hoạt động' : 'Bị khóa'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400">
                        {new Date((u as any).createdAt).toLocaleDateString('vi-VN')}
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button
                          onClick={() => handleOpenEdit(u)}
                          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2.5 py-1.5 rounded transition"
                        >
                          Sửa
                        </button>
                        <button
                          disabled={isSelf}
                          onClick={() => {
                            if (confirm(`Bạn có chắc muốn ${u.isActive !== false ? 'KHÓA' : 'MỞ KHÓA'} tài khoản ${u.email}?`)) {
                              updateMutation.mutate({
                                id: u.id,
                                data: { isActive: u.isActive === false },
                              });
                            }
                          }}
                          className={`text-xs font-semibold px-2.5 py-1.5 rounded transition ${
                            isSelf
                              ? 'text-slate-300 cursor-not-allowed'
                              : u.isActive !== false
                              ? 'text-amber-600 hover:text-amber-800 hover:bg-amber-50'
                              : 'text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50'
                          }`}
                        >
                          {u.isActive !== false ? 'Khóa' : 'Mở khóa'}
                        </button>
                        <button
                          disabled={isSelf}
                          onClick={() => {
                            if (confirm(`Hành động này không thể hoàn tác! Bạn có chắc muốn XÓA VĨNH VIỄN tài khoản ${u.email}?`)) {
                              deleteMutation.mutate(u.id);
                            }
                          }}
                          className={`text-xs font-semibold px-2.5 py-1.5 rounded transition ${
                            isSelf
                              ? 'text-slate-300 cursor-not-allowed'
                              : 'text-rose-600 hover:text-rose-800 hover:bg-rose-50'
                          }`}
                        >
                          Xóa
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div>
            Hiển thị <span className="font-semibold text-slate-700">{users.length}</span> trên tổng số{' '}
            <span className="font-semibold text-slate-700">{meta.total}</span> người dùng
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent transition"
            >
              ← Trang trước
            </button>
            <span className="px-2 font-medium text-slate-700">
              {page} / {meta.totalPages || 1}
            </span>
            <button
              disabled={page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent transition"
            >
              Trang sau →
            </button>
          </div>
        </div>
      </div>

      {/* Modal Tạo Người Dùng Mới */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Tạo Người Dùng Mới</h3>
            <p className="text-xs text-slate-500 mb-4">
              Tạo tài khoản trực tiếp trong hệ thống với quyền hạn chỉ định.
            </p>

            {createError && (
              <div className="mb-4 p-2.5 bg-rose-50 border-l-4 border-rose-500 text-rose-700 text-xs rounded">
                {createError}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate({
                  email: newEmail,
                  fullName: newFullName,
                  password: newPassword,
                  systemRole: newRole,
                });
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Họ và tên *</label>
                <input
                  type="text"
                  required
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="VD: Trần Văn C"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="user@testplatform.dev"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mật khẩu khởi tạo *</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Tối thiểu 8 ký tự (chữ hoa, chữ thường, số)"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Vai trò hệ thống *</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as SystemRole)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="USER">USER (Người dùng tiêu chuẩn)</option>
                  <option value="ADMIN">ADMIN (Quản trị viên toàn hệ thống)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition shadow-sm disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Đang tạo...' : 'Tạo người dùng'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Chỉnh Sửa Người Dùng */}
      {editUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Chỉnh Sửa Người Dùng</h3>
            <p className="text-xs text-slate-500 mb-4 font-mono">{editUser.email}</p>

            {editError && (
              <div className="mb-4 p-2.5 bg-rose-50 border-l-4 border-rose-500 text-rose-700 text-xs rounded">
                {editError}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateMutation.mutate({
                  id: editUser.id,
                  data: {
                    fullName: editFullName,
                    systemRole: editRole,
                    isActive: editActive,
                  },
                });
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Họ và tên *</label>
                <input
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Vai trò hệ thống *</label>
                <select
                  disabled={editUser.id === currentUser?.id}
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as SystemRole)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                >
                  <option value="USER">USER (Người dùng tiêu chuẩn)</option>
                  <option value="ADMIN">ADMIN (Quản trị viên)</option>
                </select>
                {editUser.id === currentUser?.id && (
                  <p className="text-[11px] text-slate-400 mt-1">Bạn không thể thay đổi vai trò của chính mình.</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Trạng thái tài khoản *</label>
                <select
                  disabled={editUser.id === currentUser?.id}
                  value={editActive ? 'true' : 'false'}
                  onChange={(e) => setEditActive(e.target.value === 'true')}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                >
                  <option value="true">Hoạt động (Active)</option>
                  <option value="false">Bị khóa (Inactive)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditUser(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition shadow-sm disabled:opacity-50"
                >
                  {updateMutation.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
