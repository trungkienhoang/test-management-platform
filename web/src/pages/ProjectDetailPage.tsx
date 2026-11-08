import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { Project, ProjectMember, ProjectRole, ProjectStatus, User } from '../types';

export const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Add Member state
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [memberRole, setMemberRole] = useState<ProjectRole>('TESTER');
  const [modalError, setModalError] = useState<string | null>(null);

  // Edit Project Settings state
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editStatus, setEditStatus] = useState<ProjectStatus>('ACTIVE');
  const [settingsError, setSettingsError] = useState<string | null>(null);

  // Fetch Project details
  const { data: project, isLoading: isProjectLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: async () => {
      const res = await apiClient.get<Project>(`/projects/${id}`);
      return res.data;
    },
    enabled: !!id,
  });

  // Fetch Project members
  const { data: members, isLoading: isMembersLoading } = useQuery({
    queryKey: ['project-members', id],
    queryFn: async () => {
      const res = await apiClient.get<ProjectMember[]>(`/projects/${id}/members`);
      return res.data;
    },
    enabled: !!id,
  });

  // Permissions check
  const currentUserMember = members?.find((m) => m.userId === user?.id);
  const canManageProject = user?.systemRole === 'ADMIN' || currentUserMember?.role === 'QA_LEAD';
  const canDeleteProject = user?.systemRole === 'ADMIN' || project?.createdById === user?.id;

  // Search candidate users for adding to project (excludes current members)
  const { data: candidateUsers, isLoading: isSearchingUsers } = useQuery({
    queryKey: ['candidate-users', id, userSearchQuery],
    queryFn: async () => {
      const res = await apiClient.get<User[]>('/users/search', {
        params: { q: userSearchQuery, projectId: id },
      });
      return res.data;
    },
    enabled: isAddModalOpen && !selectedUser,
  });

  // Update Project Settings mutation (Name, Description, Status)
  const updateProjectMutation = useMutation({
    mutationFn: async (payload: { name?: string; description?: string; status?: ProjectStatus }) => {
      const res = await apiClient.patch<Project>(`/projects/${id}`, payload);
      return res.data;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(['project', id], updated);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setIsSettingsModalOpen(false);
      setSettingsError(null);
    },
    onError: (err: any) => {
      setSettingsError(err.response?.data?.message || 'Không thể cập nhật dự án');
    },
  });

  // Delete Project mutation
  const deleteProjectMutation = useMutation({
    mutationFn: async () => {
      await apiClient.delete(`/projects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      navigate('/projects');
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Không thể xóa dự án');
    },
  });

  // Add member mutation
  const addMemberMutation = useMutation({
    mutationFn: async (payload: { userId: string; role: ProjectRole }) => {
      const res = await apiClient.post(`/projects/${id}/members`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-members', id] });
      setIsAddModalOpen(false);
      setSelectedUser(null);
      setUserSearchQuery('');
      setMemberRole('TESTER');
      setModalError(null);
    },
    onError: (err: any) => {
      setModalError(err.response?.data?.message || 'Không thể thêm thành viên');
    },
  });

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiClient.delete(`/projects/${id}/members/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-members', id] });
    },
  });

  // Update member role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: ProjectRole }) => {
      await apiClient.patch(`/projects/${id}/members/${userId}`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-members', id] });
    },
  });

  const handleOpenSettings = () => {
    if (!project) return;
    setEditName(project.name);
    setEditDescription(project.description || '');
    setEditStatus(project.status);
    setSettingsError(null);
    setIsSettingsModalOpen(true);
  };

  const handleQuickToggleStatus = () => {
    if (!project) return;
    const nextStatus: ProjectStatus = project.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE';
    const actionName = nextStatus === 'ARCHIVED' ? 'LƯU TRỮ' : 'KÍCH HOẠT LẠI (ACTIVE)';
    if (confirm(`Bạn có chắc muốn chuyển trạng thái dự án sang "${actionName}"?`)) {
      updateProjectMutation.mutate({ status: nextStatus });
    }
  };

  if (isProjectLoading) {
    return <div className="text-center py-16 text-slate-400">⏳ Đang tải thông tin dự án...</div>;
  }

  if (!project) {
    return <div className="text-center py-16 text-rose-500">❌ Dự án không tồn tại hoặc bạn không có quyền xem.</div>;
  }

  const isArchived = project.status === 'ARCHIVED';

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Navigation */}
      <div>
        <Link to="/projects" className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 mb-2">
          ← Quay lại danh sách dự án
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-2xl font-bold text-slate-900">{project.name}</h2>
              <span
                className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1.5 ${
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
                {project.status === 'ACTIVE' ? 'ACTIVE (Hoạt động)' : 'ARCHIVED (Lưu trữ)'}
              </span>

              {/* Quick Status Toggle Button for QA Lead / Admin */}
              {canManageProject && (
                <button
                  onClick={handleQuickToggleStatus}
                  disabled={updateProjectMutation.isPending}
                  className="text-xs text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 px-2.5 py-1 rounded-md transition flex items-center gap-1 shadow-2xs"
                  title={isArchived ? 'Bấm để kích hoạt lại dự án' : 'Bấm để chuyển sang lưu trữ'}
                >
                  <span>{isArchived ? '⚡' : '📦'}</span>
                  <span>{isArchived ? 'Kích hoạt lại (Active)' : 'Lưu trữ (Archive)'}</span>
                </button>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-1 max-w-2xl">{project.description || 'Chưa có mô tả'}</p>
          </div>

          <div className="flex items-center gap-2">
            {canManageProject && (
              <button
                onClick={handleOpenSettings}
                className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold px-3 py-2 rounded-lg shadow-2xs transition flex items-center gap-1.5"
              >
                <span>⚙️</span> Cài đặt dự án
              </button>
            )}

            <button
              onClick={() => {
                setIsAddModalOpen(true);
                setSelectedUser(null);
                setUserSearchQuery('');
                setModalError(null);
              }}
              disabled={isArchived}
              className={`text-white text-xs font-semibold px-3.5 py-2 rounded-lg shadow-sm transition flex items-center gap-1.5 ${
                isArchived
                  ? 'bg-slate-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
              title={isArchived ? 'Không thể thêm thành viên vào dự án đã lưu trữ' : 'Thêm thành viên'}
            >
              <span>👤➕</span> Thêm thành viên
            </button>
          </div>
        </div>
      </div>

      {/* Alert Banner if Archived */}
      {isArchived && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📦</span>
            <div>
              <h4 className="text-sm font-bold text-amber-900">
                Dự án này đang ở trạng thái LƯU TRỮ (Archived)
              </h4>
              <p className="text-xs text-amber-800 mt-0.5">
                Dữ liệu kiểm thử đã được đóng băng để lưu trữ đối soát. Để tạo thêm bài test hoặc chạy test run, hãy kích hoạt lại dự án.
              </p>
            </div>
          </div>
          {canManageProject && (
            <button
              onClick={() => updateProjectMutation.mutate({ status: 'ACTIVE' })}
              disabled={updateProjectMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg shadow-sm transition shrink-0"
            >
              ⚡ Kích hoạt lại dự án (Active)
            </button>
          )}
        </div>
      )}

      {/* Sprint Roadmap Tabs for this Project */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="text-xs text-slate-400 uppercase font-semibold">Test Suites</div>
          <div className="text-2xl font-bold text-slate-800 mt-1">0</div>
          <div className="text-[11px] text-indigo-600 mt-1">Sprint 2</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="text-xs text-slate-400 uppercase font-semibold">Test Cases</div>
          <div className="text-2xl font-bold text-slate-800 mt-1">0</div>
          <div className="text-[11px] text-indigo-600 mt-1">Sprint 2</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="text-xs text-slate-400 uppercase font-semibold">Test Runs</div>
          <div className="text-2xl font-bold text-slate-800 mt-1">0</div>
          <div className="text-[11px] text-indigo-600 mt-1">Sprint 3</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="text-xs text-slate-400 uppercase font-semibold">Bugs ghi nhận</div>
          <div className="text-2xl font-bold text-slate-800 mt-1">0</div>
          <div className="text-[11px] text-indigo-600 mt-1">Sprint 3</div>
        </div>
      </div>

      {/* Members Section */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
            <span>👥</span> Thành viên dự án ({members?.length || 0})
          </h3>
          <span className="text-xs text-slate-400">Phân quyền theo vai trò trong dự án</span>
        </div>

        {isMembersLoading ? (
          <div className="p-8 text-center text-slate-400 text-xs">Đang tải danh sách thành viên...</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {members?.map((member) => (
              <div key={member.id} className="px-6 py-4 flex items-center justify-between gap-4 hover:bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm">
                    {member.user.fullName.charAt(0)}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-800">{member.user.fullName}</h4>
                    <p className="text-xs text-slate-400">{member.user.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <select
                    disabled={!canManageProject || isArchived}
                    value={member.role}
                    onChange={(e) =>
                      updateRoleMutation.mutate({
                        userId: member.userId,
                        role: e.target.value as ProjectRole,
                      })
                    }
                    className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <option value="QA_LEAD">QA Lead</option>
                    <option value="TESTER">Tester</option>
                    <option value="DEVELOPER">Developer</option>
                    <option value="VIEWER">Viewer</option>
                  </select>

                  {canManageProject && (
                    <button
                      disabled={isArchived}
                      onClick={() => {
                        if (confirm(`Bạn có chắc muốn xóa ${member.user.fullName} khỏi dự án?`)) {
                          removeMemberMutation.mutate(member.userId);
                        }
                      }}
                      className="text-xs text-rose-500 hover:text-rose-700 hover:bg-rose-50 px-2 py-1.5 rounded transition disabled:opacity-40 disabled:hover:bg-transparent"
                    >
                      Xóa
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Cài Đặt Dự Án (Edit Name, Description, Status, Delete) */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Cài Đặt Dự Án</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Chỉnh sửa thông tin và quản lý vòng đời trạng thái hoạt động của dự án.
              </p>
            </div>

            {settingsError && (
              <div className="p-2.5 bg-rose-50 border-l-4 border-rose-500 text-rose-700 text-xs rounded">
                {settingsError}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateProjectMutation.mutate({
                  name: editName,
                  description: editDescription,
                  status: editStatus,
                });
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tên dự án *</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mô tả dự án</label>
                <textarea
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Status Radio Picker */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">Trạng thái dự án *</label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`p-3 rounded-xl border cursor-pointer transition flex flex-col gap-1 ${
                      editStatus === 'ACTIVE'
                        ? 'border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-400/20'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="status"
                        value="ACTIVE"
                        checked={editStatus === 'ACTIVE'}
                        onChange={() => setEditStatus('ACTIVE')}
                        className="text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-xs font-bold text-emerald-800">🟢 ACTIVE</span>
                    </div>
                    <span className="text-[11px] text-slate-500 pl-5">
                      Đang hoạt động. Cho phép thêm test case, chạy test và ghi nhận bug.
                    </span>
                  </label>

                  <label
                    className={`p-3 rounded-xl border cursor-pointer transition flex flex-col gap-1 ${
                      editStatus === 'ARCHIVED'
                        ? 'border-amber-500 bg-amber-50/60 ring-2 ring-amber-400/20'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="status"
                        value="ARCHIVED"
                        checked={editStatus === 'ARCHIVED'}
                        onChange={() => setEditStatus('ARCHIVED')}
                        className="text-amber-600 focus:ring-amber-500"
                      />
                      <span className="text-xs font-bold text-amber-800">📦 ARCHIVED</span>
                    </div>
                    <span className="text-[11px] text-slate-500 pl-5">
                      Lưu trữ. Đóng băng dữ liệu ở chế độ chỉ đọc.
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSettingsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={updateProjectMutation.isPending}
                  className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition shadow-sm disabled:opacity-50"
                >
                  {updateProjectMutation.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>

            {/* Danger Zone: Delete Project */}
            {canDeleteProject && (
              <div className="pt-4 border-t border-slate-200 mt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="text-xs font-bold text-rose-600">Vùng nguy hiểm: Xóa dự án</h5>
                    <p className="text-[11px] text-slate-400">Xóa vĩnh viễn dự án và toàn bộ dữ liệu kiểm thử.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`CẢNH BÁO: Bạn có chắc chắn muốn XÓA VĨNH VIỄN dự án "${project.name}" không?`)) {
                        deleteProjectMutation.mutate();
                      }
                    }}
                    disabled={deleteProjectMutation.isPending}
                    className="text-xs font-semibold bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 px-3 py-1.5 rounded-lg transition"
                  >
                    Xóa dự án
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Member Modal (with Search Autocomplete / Dropdown) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Thêm Thành Viên Vào Dự Án</h3>
            <p className="text-xs text-slate-500 mb-4">
              Tìm kiếm theo tên hoặc email để chỉ định quyền cho thành viên.
            </p>

            {modalError && (
              <div className="mb-4 p-2.5 bg-rose-50 border-l-4 border-rose-500 text-rose-700 text-xs rounded">
                {modalError}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!selectedUser) {
                  setModalError('Vui lòng chọn một người dùng từ danh sách tìm kiếm');
                  return;
                }
                addMemberMutation.mutate({ userId: selectedUser.id, role: memberRole });
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Chọn người dùng *
                </label>

                {selectedUser ? (
                  /* Selected user card */
                  <div className="flex items-center justify-between p-3 rounded-xl border border-indigo-200 bg-indigo-50/50">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                        {selectedUser.fullName.charAt(0)}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800">{selectedUser.fullName}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{selectedUser.email}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedUser(null)}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold px-2 py-1 rounded hover:bg-indigo-100 transition"
                    >
                      Đổi người khác
                    </button>
                  </div>
                ) : (
                  /* Autocomplete search input & list */
                  <div className="space-y-2">
                    <div className="relative">
                      <input
                        type="text"
                        autoFocus
                        value={userSearchQuery}
                        onChange={(e) => setUserSearchQuery(e.target.value)}
                        placeholder="Gõ tên hoặc email người dùng..."
                        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <span className="absolute left-3 top-2.5 text-slate-400">🔍</span>
                    </div>

                    {/* Candidate dropdown options */}
                    <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 bg-white shadow-xs">
                      {isSearchingUsers ? (
                        <div className="p-3 text-center text-xs text-slate-400">Đang tìm kiếm...</div>
                      ) : !candidateUsers || candidateUsers.length === 0 ? (
                        <div className="p-3 text-center text-xs text-slate-400">
                          {userSearchQuery
                            ? 'Không tìm thấy người dùng nào phù hợp (hoặc đã là thành viên dự án)'
                            : 'Không còn người dùng nào để thêm'}
                        </div>
                      ) : (
                        candidateUsers.map((u) => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => {
                              setSelectedUser(u);
                              setModalError(null);
                            }}
                            className="w-full text-left p-2.5 hover:bg-indigo-50/70 transition flex items-center justify-between gap-2"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                                {u.fullName.charAt(0)}
                              </div>
                              <div className="overflow-hidden">
                                <div className="text-xs font-semibold text-slate-800 truncate">{u.fullName}</div>
                                <div className="text-[10px] text-slate-500 truncate font-mono">{u.email}</div>
                              </div>
                            </div>
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium border border-slate-200 shrink-0">
                              {u.systemRole}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Vai trò trong dự án *
                </label>
                <select
                  value={memberRole}
                  onChange={(e) => setMemberRole(e.target.value as ProjectRole)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="QA_LEAD">QA Lead (Toàn quyền quản lý test & thành viên)</option>
                  <option value="TESTER">Tester (Viết test case, thực thi test run, tạo bug)</option>
                  <option value="DEVELOPER">Developer (Xem test case, xử lý bug, tích hợp CI)</option>
                  <option value="VIEWER">Viewer (Chỉ xem)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={addMemberMutation.isPending || !selectedUser}
                  className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition shadow-sm disabled:opacity-50"
                >
                  {addMemberMutation.isPending ? 'Đang thêm...' : 'Thêm vào dự án'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
