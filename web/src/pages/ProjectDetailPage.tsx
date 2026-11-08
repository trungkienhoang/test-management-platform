import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { Project, ProjectMember, ProjectRole, User } from '../types';

export const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [memberRole, setMemberRole] = useState<ProjectRole>('TESTER');
  const [modalError, setModalError] = useState<string | null>(null);

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

  if (isProjectLoading) {
    return <div className="text-center py-16 text-slate-400">⏳ Đang tải thông tin dự án...</div>;
  }

  if (!project) {
    return <div className="text-center py-16 text-rose-500">❌ Dự án không tồn tại hoặc bạn không có quyền xem.</div>;
  }

  return (
    <div className="space-y-8">
      {/* Breadcrumb & Navigation */}
      <div>
        <Link to="/projects" className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 mb-2">
          ← Quay lại danh sách dự án
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-slate-900">{project.name}</h2>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  project.status === 'ACTIVE'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {project.status}
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1 max-w-2xl">{project.description || 'Chưa có mô tả'}</p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                setIsAddModalOpen(true);
                setSelectedUser(null);
                setUserSearchQuery('');
                setModalError(null);
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg shadow-sm transition flex items-center gap-1.5"
            >
              <span>👤➕</span> Thêm thành viên
            </button>
          </div>
        </div>
      </div>

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
                    value={member.role}
                    onChange={(e) =>
                      updateRoleMutation.mutate({
                        userId: member.userId,
                        role: e.target.value as ProjectRole,
                      })
                    }
                    className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="QA_LEAD">QA Lead</option>
                    <option value="TESTER">Tester</option>
                    <option value="DEVELOPER">Developer</option>
                    <option value="VIEWER">Viewer</option>
                  </select>

                  <button
                    onClick={() => {
                      if (confirm(`Bạn có chắc muốn xóa ${member.user.fullName} khỏi dự án?`)) {
                        removeMemberMutation.mutate(member.userId);
                      }
                    }}
                    className="text-xs text-rose-500 hover:text-rose-700 hover:bg-rose-50 px-2 py-1.5 rounded transition"
                  >
                    Xóa
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
