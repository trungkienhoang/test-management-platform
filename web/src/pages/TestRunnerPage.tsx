import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type {
  TestRun,
  TestExecution,
  TestExecutionStatus,
  BugSeverity,
  Bug,
  TestCaseStep,
  ProjectMember,
} from '../types';

export const TestRunnerPage: React.FC = () => {
  const { id: projectId, runId } = useParams<{ id: string; runId: string }>();
  const { user } = useAuth();

  const [run, setRun] = useState<TestRun | null>(null);
  const [executions, setExecutions] = useState<TestExecution[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterOnlyFailedBlocked, setFilterOnlyFailedBlocked] = useState<boolean>(false);

  // Current execution input state (for Tester in In-Progress)
  const [actualResult, setActualResult] = useState<string>('');
  const [stepChecklist, setStepChecklist] = useState<Record<number, boolean>>({});
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Stop-watch timer for active test case
  const [timerSeconds, setTimerSeconds] = useState<number>(0);
  const timerRef = useRef<any>(null);

  // Bug modal inside runner
  const [isBugModalOpen, setIsBugModalOpen] = useState<boolean>(false);
  const [bugTitle, setBugTitle] = useState<string>('');
  const [bugDesc, setBugDesc] = useState<string>('');
  const [bugSeverity, setBugSeverity] = useState<BugSeverity>('HIGH');
  const [creatingBug, setCreatingBug] = useState<boolean>(false);

  // Request Rework modal (for QA Lead)
  const [isReworkModalOpen, setIsReworkModalOpen] = useState<boolean>(false);
  const [reworkReason, setReworkReason] = useState<string>('');
  const [submittingRework, setSubmittingRework] = useState<boolean>(false);

  // Action loading states
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Load project members to determine role
  useEffect(() => {
    if (!projectId) return;
    apiClient
      .get(`/projects/${projectId}/members`)
      .then((res) => setMembers(res.data || []))
      .catch(() => setMembers([]));
  }, [projectId]);

  // Status flags
  const isCompleted = run?.status === 'COMPLETED';
  const isInReview = run?.status === 'IN_REVIEW';

  const currentUserMember = members.find((m) => m.userId === user?.id);
  const isQALeadOrAdmin =
    run?.permissions?.isQALeadOrAdmin ??
    (user?.systemRole === 'ADMIN' || currentUserMember?.role === 'QA_LEAD');
  const canApprove = run?.permissions?.canApprove ?? (isInReview && isQALeadOrAdmin);
  const canRequestRework = run?.permissions?.canRequestRework ?? (isInReview && isQALeadOrAdmin);
  const canSubmitForReview = run?.permissions?.canSubmitForReview ?? (!isCompleted && !isInReview);

  // Fetch run and execution details
  const fetchRunDetails = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/projects/${projectId}/test-runs/${runId}`);
      const data: TestRun = res.data;
      setRun(data);
      const execList = data.executions || [];
      setExecutions(execList);

      // If IN_REVIEW, default filter to only failed/blocked to help QA Lead
      if (data.status === 'IN_REVIEW') {
        const hasFailedOrBlocked = execList.some(
          (e: TestExecution) => e.status === 'FAILED' || e.status === 'BLOCKED',
        );
        if (hasFailedOrBlocked) {
          setFilterOnlyFailedBlocked(true);
        }
      }

      // Find first untested or start at 0
      const firstUntested = execList.findIndex((e: TestExecution) => e.status === 'UNTESTED');
      if (firstUntested !== -1 && data.status !== 'IN_REVIEW' && data.status !== 'COMPLETED') {
        setCurrentIndex(firstUntested);
      }
    } catch (err) {
      console.error('Failed to load test run', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRunDetails();
  }, [projectId, runId]);

  // Filtered executions
  const filteredExecutions = executions.filter((exec) => {
    if (filterOnlyFailedBlocked) {
      if (exec.status !== 'FAILED' && exec.status !== 'BLOCKED') {
        return false;
      }
    } else if (filterStatus !== 'ALL' && exec.status !== filterStatus) {
      return false;
    }

    const matchSearch =
      !searchQuery ||
      exec.testCaseCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exec.testCaseTitle.toLowerCase().includes(searchQuery.toLowerCase());
    return matchSearch;
  });

  const activeExecution = executions[currentIndex];

  // Sync state when currentIndex changes
  useEffect(() => {
    if (activeExecution) {
      setActualResult(activeExecution.actualResult || '');
      setStepChecklist((activeExecution.stepResults as any) || {});
      setTimerSeconds(0);
    }
  }, [currentIndex, activeExecution?.id]);

  // Timer interval - only run if not completed/in-review
  useEffect(() => {
    if (isCompleted || isInReview) return;

    timerRef.current = setInterval(() => {
      setTimerSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [currentIndex, isCompleted, isInReview]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle Step Toggle (only allowed when not read-only and not review mode)
  const toggleStep = (stepIdx: number) => {
    if (isCompleted || isInReview) return;
    setStepChecklist((prev) => ({
      ...prev,
      [stepIdx]: !prev[stepIdx],
    }));
  };

  // Submit execution result (Tester) for PASS, BLOCKED, SKIPPED
  const handleRecordResult = async (status: TestExecutionStatus, autoAdvance = true) => {
    if (!activeExecution || isCompleted || isInReview) return;
    setSubmitting(true);
    try {
      const payload = {
        status,
        actualResult: actualResult.trim() || undefined,
        stepResults: stepChecklist,
        executionDurationMs: timerSeconds * 1000,
      };

      const res = await apiClient.patch(
        `/projects/${projectId}/test-runs/${runId}/executions/${activeExecution.id}`,
        payload,
      );

      const updated = res.data;
      setExecutions((prev) =>
        prev.map((e) => (e.id === activeExecution.id ? { ...e, ...updated } : e)),
      );

      if (autoAdvance && currentIndex < executions.length - 1) {
        setCurrentIndex(currentIndex + 1);
      }

      // Re-fetch run to update stats
      const runRes = await apiClient.get(`/projects/${projectId}/test-runs/${runId}`);
      setRun(runRes.data);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Có lỗi khi lưu kết quả kiểm thử');
    } finally {
      setSubmitting(false);
    }
  };

  // Bug Modal helpers
  const openBugModalForExecution = (exec: TestExecution, userActualResult: string) => {
    setBugTitle(`[${exec.testCaseCode}] Lỗi phát sinh: ${exec.testCaseTitle}`);
    const stepsText = Array.isArray(exec.testCaseSteps)
      ? exec.testCaseSteps
          .map((s: TestCaseStep) => `${s.stepNumber}. Thao tác: ${s.action} -> Kỳ vọng: ${s.expectedResult}`)
          .join('\n')
      : '';

    setBugDesc(
      `## 1. Chi tiết ca kiểm thử\n- Mã: ${exec.testCaseCode}\n- Tên: ${exec.testCaseTitle}\n\n## 2. Các bước thực hiện\n${stepsText}\n\n## 3. Kết quả thực tế phát hiện lỗi\n${
        userActualResult || 'Thực tế không đúng với kỳ vọng của ca kiểm thử'
      }`,
    );
    setBugSeverity('HIGH');
    setIsBugModalOpen(true);
  };

  const handleCreateBug = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeExecution) return;
    setCreatingBug(true);
    try {
      // 1. Create bug
      const res = await apiClient.post(`/projects/${projectId}/bugs`, {
        title: bugTitle.trim(),
        description: bugDesc.trim(),
        severity: bugSeverity,
        testExecutionId: activeExecution.id,
        testCaseId: activeExecution.testCaseId || undefined,
      });

      const newBug: Bug = res.data;

      // 2. Mark execution as FAILED and persist actualResult & duration
      const payload = {
        status: 'FAILED',
        actualResult: actualResult.trim() || undefined,
        stepResults: stepChecklist,
        executionDurationMs: timerSeconds * 1000,
      };

      const execRes = await apiClient.patch(
        `/projects/${projectId}/test-runs/${runId}/executions/${activeExecution.id}`,
        payload,
      );
      const updated = execRes.data;

      setExecutions((prev) =>
        prev.map((e) =>
          e.id === activeExecution.id
            ? { ...e, ...updated, bugs: [...(e.bugs || []), newBug] }
            : e,
        ),
      );

      setIsBugModalOpen(false);
      alert(`Đã ghi nhận kết quả THẤT BẠI (FAIL) và liên kết lỗi [${newBug.code}] thành công!`);

      if (currentIndex < executions.length - 1) {
        setCurrentIndex(currentIndex + 1);
      }

      // Re-fetch run to update stats
      const runRes = await apiClient.get(`/projects/${projectId}/test-runs/${runId}`);
      setRun(runRes.data);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Có lỗi xảy ra khi tạo bug và lưu kết quả');
    } finally {
      setCreatingBug(false);
    }
  };

  // QA Lead & Tester Workflow Actions
  const handleSubmitForReview = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn gửi đợt kiểm thử này cho QA Lead rà soát không?')) return;
    setActionLoading(true);
    try {
      await apiClient.post(`/projects/${projectId}/test-runs/${runId}/submit-for-review`);
      alert('Đã gửi yêu cầu rà soát thành công tới QA Lead!');
      await fetchRunDetails();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể gửi yêu cầu duyệt');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveAndClose = async () => {
    if (
      !window.confirm(
        'Bạn có chắc chắn muốn chốt và đóng đợt kiểm thử này? Dữ liệu sẽ được khóa ở chế độ Read-only và Tester không thể sửa đổi kết quả.',
      )
    )
      return;
    setActionLoading(true);
    try {
      await apiClient.post(`/projects/${projectId}/test-runs/${runId}/approve-and-close`);
      alert('Đã chốt và đóng đợt kiểm thử thành công!');
      await fetchRunDetails();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể chốt đợt kiểm thử');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmRework = async () => {
    if (!reworkReason.trim()) {
      alert('Vui lòng nhập lý do cụ thể yêu cầu Tester làm lại.');
      return;
    }
    setSubmittingRework(true);
    try {
      await apiClient.post(`/projects/${projectId}/test-runs/${runId}/request-rework`, {
        reason: reworkReason.trim(),
      });
      setIsReworkModalOpen(false);
      setReworkReason('');
      alert('Đã gửi yêu cầu làm lại cho Tester thành công!');
      await fetchRunDetails();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể gửi yêu cầu làm lại');
    } finally {
      setSubmittingRework(false);
    }
  };

  const handleCreateRetest = async () => {
    if (
      !window.confirm(
        'Tạo đợt Retest mới? Hệ thống sẽ tự động lọc và clone các ca kiểm thử có kết quả FAIL hoặc BLOCKED sang một đợt test mới.',
      )
    )
      return;
    setActionLoading(true);
    try {
      const res = await apiClient.post(`/projects/${projectId}/test-runs/${runId}/retest`);
      alert(`Đã tạo thành công đợt Retest: "${res.data.name}"! Chuyển hướng tới đợt mới...`);
      window.location.href = `/projects/${projectId}/test-runs/${res.data.id}/runner`;
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể tạo đợt Retest');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-500">
        <span className="text-4xl block animate-spin mb-3">⚙️</span>
        <p className="text-sm font-medium">Đang tải môi trường Test Runner...</p>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
        <p className="text-slate-600">Không tìm thấy đợt kiểm thử này</p>
        <Link
          to={`/projects/${projectId}/test-runs`}
          className="mt-3 inline-block text-indigo-600 hover:underline text-xs"
        >
          Quay lại danh sách Test Runs
        </Link>
      </div>
    );
  }

  const stats = run.stats || {
    total: executions.length,
    passed: executions.filter((e) => e.status === 'PASSED').length,
    failed: executions.filter((e) => e.status === 'FAILED').length,
    blocked: executions.filter((e) => e.status === 'BLOCKED').length,
    skipped: executions.filter((e) => e.status === 'SKIPPED').length,
    untested: executions.filter((e) => e.status === 'UNTESTED').length,
    passRate: 0,
  };

  const countFailedBlocked = executions.filter(
    (e) => e.status === 'FAILED' || e.status === 'BLOCKED',
  ).length;

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-fadeIn">
      {/* ─── TOP RUNNER BAR ──────────────────────────────────────────────────────── */}
      <div className="px-6 py-3 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <Link
            to={`/projects/${projectId}/test-runs`}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Thoát Test Runner"
          >
            ←
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm">▶️</span>
              <h2 className="font-bold text-sm tracking-wide text-white">{run.name}</h2>

              {/* Status Badge */}
              {isCompleted ? (
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full font-semibold">
                  🔒 Đã Hoàn Thành (Read-only)
                </span>
              ) : isInReview ? (
                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-400/40 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                  <span>⚠️</span> Chờ QA Duyệt (Review Mode)
                </span>
              ) : (
                <span className="text-[10px] bg-indigo-500/30 text-indigo-300 border border-indigo-400/40 px-2 py-0.5 rounded-full font-semibold">
                  Test Runner Mode
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 truncate max-w-xl">
              {run.description || 'Chế độ thực thi và rà soát ca kiểm thử chuyên nghiệp'}
            </p>
          </div>
        </div>

        {/* Mini stats & Timer */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 text-xs font-semibold">
            <span className="text-emerald-400">✓ {stats.passed} Pass</span>
            <span className="text-rose-400">✗ {stats.failed} Fail</span>
            <span className="text-amber-400">⊘ {stats.blocked} Block</span>
            <span className="text-slate-400">⋯ {stats.untested} Chưa test</span>
          </div>

          <div className="h-6 w-px bg-slate-700" />

          {/* Active test case stopwatch (only if not completed/in-review) */}
          {!isCompleted && !isInReview && (
            <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 text-xs font-mono text-emerald-400">
              <span>⏱️</span>
              <span>{formatTimer(timerSeconds)}</span>
            </div>
          )}
        </div>
      </div>

      {/* ─── REVIEW / REWORK / COMPLETED BANNERS ─────────────────────────────────── */}
      {isInReview && (
        <div className="px-6 py-2.5 bg-amber-500/10 border-b border-amber-300/40 text-amber-900 text-xs flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-base">⚠️</span>
            <span>
              <strong>Chế độ Rà soát (Review Mode):</strong> Đợt kiểm thử này đang chờ QA Lead rà soát và đóng.
              Hãy kiểm tra kỹ các ca FAIL / BLOCKED và các Bug liên kết trước khi chốt.
            </span>
          </div>
          {canApprove && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsReworkModalOpen(true)}
                disabled={actionLoading}
                className="px-3 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-300 rounded-lg transition"
              >
                ❌ Yêu cầu làm lại
              </button>
              <button
                onClick={handleApproveAndClose}
                disabled={actionLoading}
                className="px-3 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs transition"
              >
                ✓ Chốt đợt kiểm thử
              </button>
            </div>
          )}
        </div>
      )}

      {run.reworkReason && run.status === 'IN_PROGRESS' && (
        <div className="px-6 py-2.5 bg-rose-50 border-b border-rose-200 text-rose-900 text-xs flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-base">❌</span>
            <span>
              <strong>QA Lead yêu cầu làm lại:</strong> &quot;{run.reworkReason}&quot; — Vui lòng kiểm tra lại kết quả, bổ sung bằng chứng và bug liên kết.
            </span>
          </div>
        </div>
      )}

      {isCompleted && (
        <div className="px-6 py-2.5 bg-slate-100 border-b border-slate-200 text-slate-700 text-xs flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-base">🔒</span>
            <span>
              <strong>Đợt kiểm thử đã hoàn thành (Read-only):</strong> Dữ liệu đã được chốt và khóa chỉnh sửa để bảo toàn tính toàn vẹn của báo cáo.
            </span>
          </div>
          <button
            onClick={handleCreateRetest}
            disabled={actionLoading}
            className="px-3 py-1 text-xs font-semibold text-indigo-700 bg-white hover:bg-indigo-50 border border-indigo-300 rounded-lg shadow-2xs transition flex items-center gap-1"
          >
            <span>🔄</span> Tạo đợt Retest (Clone ca Fail / Blocked)
          </button>
        </div>
      )}

      {/* ─── BODY (SIDEBAR + MAIN CANVAS) ────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left sidebar: Test Cases list */}
        <div className="w-80 bg-slate-50 border-r border-slate-200 flex flex-col shrink-0">
          {/* Search & Quick Filters */}
          <div className="p-3 border-b border-slate-200 space-y-2.5 bg-white">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="🔍 Tìm mã hoặc tên test case..."
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            />

            {/* Quick Filter: Only Fail / Blocked toggle */}
            <div className="flex items-center justify-between pt-0.5">
              <button
                type="button"
                onClick={() => setFilterOnlyFailedBlocked(!filterOnlyFailedBlocked)}
                className={`w-full py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 border ${
                  filterOnlyFailedBlocked
                    ? 'bg-rose-50 text-rose-700 border-rose-300 shadow-xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span>⚡</span>
                <span>Chỉ hiện ca Fail / Blocked</span>
                <span
                  className={`ml-1 text-[10px] px-1.5 py-0.2 rounded-full ${
                    filterOnlyFailedBlocked ? 'bg-rose-200 text-rose-800' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {countFailedBlocked}
                </span>
              </button>
            </div>

            {/* Status pills (active when not in onlyFailedBlocked mode) */}
            {!filterOnlyFailedBlocked && (
              <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px]">
                {['ALL', 'UNTESTED', 'PASSED', 'FAILED', 'BLOCKED'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setFilterStatus(st)}
                    className={`px-2 py-0.5 rounded font-semibold whitespace-nowrap transition ${
                      filterStatus === st
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {st === 'ALL'
                      ? 'Tất cả'
                      : st === 'UNTESTED'
                      ? 'Chưa test'
                      : st === 'PASSED'
                      ? 'Pass'
                      : st === 'FAILED'
                      ? 'Fail'
                      : 'Blocked'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Execution List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-200/60">
            {filteredExecutions.length === 0 ? (
              <p className="p-4 text-xs text-center text-slate-400">
                {filterOnlyFailedBlocked
                  ? 'Tuyệt vời! Không có ca kiểm thử nào bị Fail hoặc Blocked.'
                  : 'Không có test case phù hợp'}
              </p>
            ) : (
              filteredExecutions.map((exec) => {
                const originalIndex = executions.findIndex((e) => e.id === exec.id);
                const isSelected = originalIndex === currentIndex;

                const getStatusColor = (st: TestExecutionStatus) => {
                  switch (st) {
                    case 'PASSED':
                      return 'bg-emerald-50 text-emerald-700 border-emerald-300';
                    case 'FAILED':
                      return 'bg-rose-50 text-rose-700 border-rose-300';
                    case 'BLOCKED':
                      return 'bg-amber-50 text-amber-700 border-amber-300';
                    case 'SKIPPED':
                      return 'bg-slate-100 text-slate-600 border-slate-300';
                    default:
                      return 'bg-slate-100 text-slate-500 border-transparent';
                  }
                };

                return (
                  <div
                    key={exec.id}
                    onClick={() => setCurrentIndex(originalIndex)}
                    className={`p-3 cursor-pointer transition flex items-start gap-2.5 ${
                      isSelected
                        ? 'bg-indigo-50/80 border-l-4 border-indigo-600'
                        : 'hover:bg-slate-100/70'
                    }`}
                  >
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase shrink-0 mt-0.5 ${getStatusColor(
                        exec.status,
                      )}`}
                    >
                      {exec.status === 'PASSED'
                        ? 'PASS'
                        : exec.status === 'FAILED'
                        ? 'FAIL'
                        : exec.status === 'BLOCKED'
                        ? 'BLOCK'
                        : exec.status === 'SKIPPED'
                        ? 'SKIP'
                        : 'UNTEST'}
                    </span>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="font-mono text-xs font-bold text-slate-800">
                          {exec.testCaseCode}
                        </span>
                        {exec.bugs && exec.bugs.length > 0 && (
                          <span className="text-[10px] text-rose-600 font-bold flex items-center gap-0.5">
                            🐛 {exec.bugs.length}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 truncate">{exec.testCaseTitle}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Main Canvas: Active Test Execution */}
        {activeExecution ? (
          <div className="flex-1 flex flex-col min-w-0 bg-white overflow-hidden">
            {/* Header info */}
            <div className="p-6 border-b border-slate-200 bg-slate-50/40 shrink-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="font-mono text-sm font-extrabold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                      {activeExecution.testCaseCode}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                      Độ ưu tiên: {activeExecution.testCasePriority}
                    </span>
                    <span className="text-[11px] text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200 flex items-center gap-1 font-medium">
                      <span>❄️</span> Đóng băng v{activeExecution.testCaseVersion}
                    </span>

                    {/* Execution status indicator badge */}
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                        activeExecution.status === 'PASSED'
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : activeExecution.status === 'FAILED'
                          ? 'bg-rose-100 text-rose-800 border-rose-300'
                          : activeExecution.status === 'BLOCKED'
                          ? 'bg-amber-100 text-amber-800 border-amber-300'
                          : activeExecution.status === 'SKIPPED'
                          ? 'bg-slate-100 text-slate-600 border-slate-300'
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}
                    >
                      Trạng thái:{' '}
                      {activeExecution.status === 'PASSED'
                        ? '✓ ĐẠT (PASS)'
                        : activeExecution.status === 'FAILED'
                        ? '✗ THẤT BẠI (FAIL)'
                        : activeExecution.status === 'BLOCKED'
                        ? '⊘ BỊ CHẶN (BLOCKED)'
                        : activeExecution.status === 'SKIPPED'
                        ? '⏭ BỎ QUA'
                        : '⋯ CHƯA TEST'}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 leading-snug">
                    {activeExecution.testCaseTitle}
                  </h3>
                </div>

                {/* Navigation Prev / Next */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    disabled={currentIndex === 0}
                    onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                    className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-40 transition"
                  >
                    ← Trước
                  </button>
                  <span className="text-xs text-slate-500 font-mono px-1">
                    {currentIndex + 1} / {executions.length}
                  </span>
                  <button
                    disabled={currentIndex === executions.length - 1}
                    onClick={() => setCurrentIndex((prev) => Math.min(executions.length - 1, prev + 1))}
                    className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-40 transition"
                  >
                    Tiếp →
                  </button>
                </div>
              </div>

              {/* Preconditions */}
              {activeExecution.testCasePreconditions && (
                <div className="mt-3 p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-amber-900">
                  <span className="font-bold mr-1">📌 Điều kiện tiên quyết:</span>
                  {activeExecution.testCasePreconditions}
                </div>
              )}
            </div>

            {/* Scrollable Test Execution Work Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Review Warning if FAILED without Bug attached */}
              {activeExecution.status === 'FAILED' && (!activeExecution.bugs || activeExecution.bugs.length === 0) && (
                <div className="p-3.5 bg-rose-50 border-2 border-rose-400 rounded-xl text-xs text-rose-900 flex items-start gap-2.5 shadow-xs">
                  <span className="text-xl shrink-0">⚠️</span>
                  <div>
                    <h5 className="font-bold text-rose-900">CẢNH BÁO KIỂM THỬ:</h5>
                    <p className="mt-0.5 text-rose-800 leading-relaxed">
                      Ca kiểm thử này bị đánh dấu là <span className="font-extrabold underline">FAIL</span> nhưng hiện chưa có bất kỳ Bug nào được tạo và liên kết!
                      {isInReview ? ' QA Lead nên yêu cầu Tester làm lại hoặc tự bổ sung Bug.' : ' Vui lòng bấm "Báo thêm Bug" để đính kèm lỗi.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Step Checklist */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <span>📋</span> Các bước thực hiện & Kiểm tra kết quả kỳ vọng
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    {isCompleted || isInReview
                      ? 'Chế độ xem các bước kiểm thử (Read-only)'
                      : 'Bấm checkbox để ghi nhớ bước đã hoàn thành'}
                  </span>
                </div>

                {Array.isArray(activeExecution.testCaseSteps) && activeExecution.testCaseSteps.length > 0 ? (
                  <div className="space-y-2.5">
                    {activeExecution.testCaseSteps.map((step: TestCaseStep, idx: number) => {
                      const isChecked = !!stepChecklist[idx];
                      return (
                        <div
                          key={idx}
                          onClick={() => toggleStep(idx)}
                          className={`p-3.5 rounded-xl border transition ${
                            isCompleted || isInReview ? 'cursor-default' : 'cursor-pointer'
                          } flex items-start gap-3 ${
                            isChecked
                              ? 'bg-emerald-50/40 border-emerald-200 ring-1 ring-emerald-500/20'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={isCompleted || isInReview}
                            onChange={() => {}} // handled by div click or disabled
                            className="mt-1 h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer disabled:cursor-default"
                          />
                          <div className="flex-1 text-xs space-y-1">
                            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                              <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-[10px] font-bold">
                                {step.stepNumber || idx + 1}
                              </span>
                              <span>{step.action}</span>
                            </div>
                            <div className="text-slate-600 pl-6 text-[11px] bg-slate-50/80 p-2 rounded-lg border border-slate-100">
                              <span className="font-semibold text-slate-700">Kỳ vọng: </span>
                              {step.expectedResult}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Không có bước cụ thể cho ca kiểm thử này.</p>
                )}
              </div>

              {/* Actual Result / Tester Report */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <span>📝</span> Kết quả thực tế (Actual Result) / Ghi chú kiểm thử
                  </label>
                  {activeExecution.executionDurationMs ? (
                    <span className="text-[11px] text-slate-500 font-mono">
                      ⏱️ Thời lượng test: {(activeExecution.executionDurationMs / 1000).toFixed(1)}s
                    </span>
                  ) : null}
                </div>

                {isCompleted || isInReview ? (
                  /* Read-only view for Review Mode / Completed */
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 min-h-[4.5rem] whitespace-pre-wrap">
                    {activeExecution.actualResult ? (
                      activeExecution.actualResult
                    ) : (
                      <span className="italic text-slate-400">
                        Tester không nhập ghi chú hoặc kết quả thực tế cho ca kiểm thử này.
                      </span>
                    )}
                  </div>
                ) : (
                  /* Editable textarea for active testing */
                  <textarea
                    rows={3}
                    value={actualResult}
                    onChange={(e) => setActualResult(e.target.value)}
                    placeholder="Ghi nhận hành vi thực tế của hệ thống, mã lỗi, hoặc ghi chú kiểm thử nếu có..."
                    className="w-full p-3 text-xs border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white"
                  />
                )}
              </div>

              {/* Linked Bugs Section */}
              <div className="p-4 bg-rose-50/60 border border-rose-200 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-rose-800 flex items-center gap-1">
                    <span>🐛</span> Lỗi đã liên kết với ca kiểm thử này ({activeExecution.bugs?.length || 0}):
                  </span>
                  {!isCompleted && (
                    <button
                      onClick={() => openBugModalForExecution(activeExecution, actualResult)}
                      className="text-[11px] text-rose-700 hover:underline font-semibold"
                    >
                      + Báo thêm Bug
                    </button>
                  )}
                </div>

                {activeExecution.bugs && activeExecution.bugs.length > 0 ? (
                  <div className="space-y-1.5">
                    {activeExecution.bugs.map((bug: Bug) => (
                      <div
                        key={bug.id}
                        className="bg-white p-2.5 rounded-lg border border-rose-200 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-rose-700">{bug.code}</span>
                          <span className="text-slate-800 font-medium">{bug.title}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-semibold">
                            {bug.severity}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                            {bug.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Chưa có lỗi nào được liên kết với ca kiểm thử này.</p>
                )}
              </div>
            </div>

            {/* ─── BOTTOM ACTION TOOLBAR ────────────────────────────────────────── */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              {/* Left Note */}
              <div className="flex items-center gap-2 text-xs text-slate-500">
                {isCompleted ? (
                  <span className="font-medium text-slate-600 flex items-center gap-1">
                    <span>🔒</span> Đợt kiểm thử đã hoàn thành (Read-only lock)
                  </span>
                ) : isInReview ? (
                  <span className="font-medium text-amber-700 flex items-center gap-1">
                    <span>⚠️</span> Chế độ rà soát dành cho QA Lead (Review Mode)
                  </span>
                ) : (
                  <span>Đánh dấu kết quả:</span>
                )}
              </div>

              {/* Right Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                {isCompleted ? (
                  /* Completed State: Clone Retest Button */
                  <button
                    onClick={handleCreateRetest}
                    disabled={actionLoading}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <span>🔄</span> Tạo Đợt Retest (Clone ca Fail / Blocked)
                  </button>
                ) : isInReview ? (
                  /* Review Mode for QA Lead */
                  canApprove ? (
                    <>
                      {canRequestRework && (
                        <button
                          onClick={() => setIsReworkModalOpen(true)}
                          disabled={actionLoading}
                          className="px-4 py-2.5 bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 text-xs font-bold rounded-xl shadow-2xs transition flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <span>❌</span> Yêu cầu làm lại
                        </button>
                      )}
                      <button
                        onClick={handleApproveAndClose}
                        disabled={actionLoading}
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <span>✓</span> Chốt đợt kiểm thử (Approve & Close)
                      </button>
                    </>
                  ) : (
                    <span className="text-xs text-amber-700 font-medium bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
                      ⏳ Đợt kiểm thử đang chờ QA Lead rà soát và đóng
                    </span>
                  )
                ) : (
                  /* Normal Testing Buttons (Tester / Dev in OPEN / IN_PROGRESS) */
                  <>
                    <button
                      onClick={() => handleRecordResult('PASSED')}
                      disabled={submitting}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <span>✓</span> ĐẠT (PASS)
                    </button>

                    <button
                      onClick={() => openBugModalForExecution(activeExecution, actualResult)}
                      disabled={submitting}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
                      title="Bắt buộc tạo hoặc liên kết Bug khi đánh dấu Thất bại"
                    >
                      <span>✗</span> THẤT BẠI (FAIL) & TẠO BUG
                    </button>

                    <button
                      onClick={() => handleRecordResult('BLOCKED')}
                      disabled={submitting}
                      className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <span>⊘</span> BỊ CHẶN (BLOCKED)
                    </button>

                    <button
                      onClick={() => handleRecordResult('SKIPPED')}
                      disabled={submitting}
                      className="px-3.5 py-2 bg-slate-600 hover:bg-slate-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <span>⏭</span> BỎ QUA
                    </button>

                    {canSubmitForReview && (
                      <>
                        <div className="h-6 w-px bg-slate-300 mx-1" />

                        <button
                          onClick={handleSubmitForReview}
                          disabled={submitting || actionLoading}
                          className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
                          title="Gửi toàn bộ kết quả kiểm thử cho QA Lead rà soát"
                        >
                          <span>📤</span> Gửi QA Duyệt
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-8 text-center text-slate-400">
            <div>
              <span className="text-4xl block mb-2">🏁</span>
              <p className="text-sm font-semibold">Tất cả ca kiểm thử đã được xem qua</p>
            </div>
          </div>
        )}
      </div>

      {/* ─── QUICK BUG CREATION MODAL ────────────────────────────────────────────── */}
      {isBugModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 bg-rose-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">🐛</span>
                <div>
                  <h3 className="font-bold text-base">Tạo Báo Cáo Lỗi (Bug Report)</h3>
                  <p className="text-xs text-rose-100">
                    Tự động liên kết với {activeExecution?.testCaseCode}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsBugModalOpen(false)}
                className="text-rose-200 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateBug} className="p-6 overflow-y-auto space-y-4 flex-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tiêu đề Bug <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={bugTitle}
                  onChange={(e) => setBugTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-rose-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mức độ nghiêm trọng (Severity)
                </label>
                <select
                  value={bugSeverity}
                  onChange={(e) => setBugSeverity(e.target.value as BugSeverity)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                >
                  <option value="LOW">Thấp (Low)</option>
                  <option value="MEDIUM">Trung bình (Medium)</option>
                  <option value="HIGH">Nghiêm trọng (High)</option>
                  <option value="CRITICAL">Tối khẩn cấp (Critical / Blocker)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mô tả lỗi & Các bước tái hiện (Markdown)
                </label>
                <textarea
                  rows={8}
                  required
                  value={bugDesc}
                  onChange={(e) => setBugDesc(e.target.value)}
                  className="w-full p-3 font-mono text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-rose-500 leading-relaxed"
                />
              </div>
            </form>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsBugModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200 rounded-lg"
              >
                Bỏ qua
              </button>
              <button
                onClick={handleCreateBug}
                disabled={creatingBug}
                className="px-5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition disabled:opacity-50"
              >
                {creatingBug ? 'Đang tạo Bug & lưu kết quả...' : 'Xác nhận FAIL & Lưu Bug'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── QA REQUEST REWORK MODAL ─────────────────────────────────────────────── */}
      {isReworkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden">
            <div className="px-6 py-4 bg-rose-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">❌</span>
                <div>
                  <h3 className="font-bold text-base">Yêu Cầu Làm Lại (Request Rework)</h3>
                  <p className="text-xs text-rose-100">Trả lại đợt kiểm thử cho Tester để kiểm tra lại</p>
                </div>
              </div>
              <button
                onClick={() => setIsReworkModalOpen(false)}
                className="text-rose-200 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600">
                Hãy cung cấp lý do cụ thể để Tester biết cần sửa đổi hoặc bổ sung gì (ví dụ: ca kiểm thử đánh FAIL nhưng thiếu Bug đính kèm hoặc kết quả thực tế chưa rõ ràng).
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Lý do yêu cầu làm lại <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  value={reworkReason}
                  onChange={(e) => setReworkReason(e.target.value)}
                  placeholder="Ví dụ: Ca TC-10 đánh Fail nhưng chưa có ảnh chụp lỗi và chưa tạo Bug, yêu cầu kiểm tra lại và đính kèm Bug..."
                  className="w-full p-3 text-xs border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-rose-500 bg-white"
                />
              </div>
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsReworkModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200 rounded-lg"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleConfirmRework}
                disabled={submittingRework}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition disabled:opacity-50"
              >
                {submittingRework ? 'Đang gửi...' : 'Xác nhận Yêu Cầu Làm Lại'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
