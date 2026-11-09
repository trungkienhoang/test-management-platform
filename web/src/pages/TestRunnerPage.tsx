import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import type { TestRun, TestExecution, TestExecutionStatus, BugSeverity, Bug, TestCaseStep } from '../types';

export const TestRunnerPage: React.FC = () => {
  const { id: projectId, runId } = useParams<{ id: string; runId: string }>();

  const [run, setRun] = useState<TestRun | null>(null);
  const [executions, setExecutions] = useState<TestExecution[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Current execution input state
  const [actualResult, setActualResult] = useState<string>('');
  const [stepChecklist, setStepChecklist] = useState<Record<number, boolean>>({});
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Stop-watch timer for current test execution
  const [timerSeconds, setTimerSeconds] = useState<number>(0);
  const timerRef = useRef<any>(null);

  // Bug modal inside runner
  const [isBugModalOpen, setIsBugModalOpen] = useState<boolean>(false);
  const [bugTitle, setBugTitle] = useState<string>('');
  const [bugDesc, setBugDesc] = useState<string>('');
  const [bugSeverity, setBugSeverity] = useState<BugSeverity>('HIGH');
  const [creatingBug, setCreatingBug] = useState<boolean>(false);

  // Fetch run and execution details
  const fetchRunDetails = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/projects/${projectId}/test-runs/${runId}`);
      const data: TestRun = res.data;
      setRun(data);
      const execList = data.executions || [];
      setExecutions(execList);

      // Find first untested or start at 0
      const firstUntested = execList.findIndex((e: TestExecution) => e.status === 'UNTESTED');
      if (firstUntested !== -1) {
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

  // Sync state when currentIndex changes
  const activeExecution = executions[currentIndex];

  useEffect(() => {
    if (activeExecution) {
      setActualResult(activeExecution.actualResult || '');
      setStepChecklist((activeExecution.stepResults as any) || {});
      setTimerSeconds(0);
    }
  }, [currentIndex, activeExecution?.id]);

  // Timer interval
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimerSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [currentIndex]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Filtered list of executions in left sidebar
  const filteredExecutions = executions.filter((exec) => {
    const matchStatus = filterStatus === 'ALL' || exec.status === filterStatus;
    const matchSearch =
      !searchQuery ||
      exec.testCaseCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exec.testCaseTitle.toLowerCase().includes(searchQuery.toLowerCase());
    return matchStatus && matchSearch;
  });

  // Handle Step Toggle
  const toggleStep = (stepIdx: number) => {
    setStepChecklist((prev) => ({
      ...prev,
      [stepIdx]: !prev[stepIdx],
    }));
  };

  // Submit execution result
  const handleRecordResult = async (status: TestExecutionStatus, autoAdvance = true) => {
    if (!activeExecution) return;
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

      // If FAILED, suggest opening bug modal
      if (status === 'FAILED') {
        openBugModalForExecution(activeExecution, actualResult);
      } else if (autoAdvance && currentIndex < executions.length - 1) {
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
      const res = await apiClient.post(`/projects/${projectId}/bugs`, {
        title: bugTitle.trim(),
        description: bugDesc.trim(),
        severity: bugSeverity,
        testExecutionId: activeExecution.id,
        testCaseId: activeExecution.testCaseId || undefined,
      });

      const newBug: Bug = res.data;
      // Add bug to active execution
      setExecutions((prev) =>
        prev.map((e) =>
          e.id === activeExecution.id
            ? { ...e, bugs: [...(e.bugs || []), newBug] }
            : e,
        ),
      );

      setIsBugModalOpen(false);
      alert(`Đã tạo và liên kết thành công lỗi [${newBug.code}]!`);

      // Advance to next test case if exists
      if (currentIndex < executions.length - 1) {
        setCurrentIndex(currentIndex + 1);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Có lỗi xảy ra khi tạo bug');
    } finally {
      setCreatingBug(false);
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

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-fadeIn">
      {/* ─── TOP RUNNER BAR ──────────────────────────────────────────────────────── */}
      <div className="px-6 py-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
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
              <span className="text-[10px] bg-indigo-500/30 text-indigo-300 border border-indigo-400/40 px-2 py-0.5 rounded-full font-semibold">
                Test Runner Mode
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate max-w-xl">
              {run.description || 'Chế độ thực thi ca kiểm thử tuần tự chuyên nghiệp'}
            </p>
          </div>
        </div>

        {/* Mini stats & Timer */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4 text-xs font-semibold">
            <span className="text-emerald-400">✓ {stats.passed} Pass</span>
            <span className="text-rose-400">✗ {stats.failed} Fail</span>
            <span className="text-amber-400">⊘ {stats.blocked} Block</span>
            <span className="text-slate-400">⋯ {stats.untested} Còn lại</span>
          </div>

          <div className="h-6 w-px bg-slate-700" />

          {/* Active test case stopwatch */}
          <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 text-xs font-mono text-emerald-400">
            <span>⏱️</span>
            <span>{formatTimer(timerSeconds)}</span>
          </div>
        </div>
      </div>

      {/* ─── BODY (SIDEBAR + MAIN CANVAS) ────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left sidebar: Test Cases list */}
        <div className="w-80 bg-slate-50 border-r border-slate-200 flex flex-col shrink-0">
          {/* Search & Filter */}
          <div className="p-3 border-b border-slate-200 space-y-2 bg-white">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="🔍 Tìm mã hoặc tên test case..."
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            />

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
          </div>

          {/* Execution List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-200/60">
            {filteredExecutions.length === 0 ? (
              <p className="p-4 text-xs text-center text-slate-400">Không có test case phù hợp</p>
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
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="font-mono text-sm font-extrabold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                      {activeExecution.testCaseCode}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                      Độ ưu tiên: {activeExecution.testCasePriority}
                    </span>
                    <span className="text-[11px] text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200 flex items-center gap-1 font-medium">
                      <span>❄️</span> Đóng băng v{activeExecution.testCaseVersion}
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
              {/* Step Checklist */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <span>📋</span> Các bước thực hiện & Kiểm tra kết quả kỳ vọng
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    Bấm checkbox để ghi nhớ bước đã hoàn thành
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
                          className={`p-3.5 rounded-xl border transition cursor-pointer flex items-start gap-3 ${
                            isChecked
                              ? 'bg-emerald-50/40 border-emerald-200 ring-1 ring-emerald-500/20'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}} // handled by div click
                            className="mt-1 h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
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

              {/* Actual Result Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <span>📝</span> Kết quả thực tế (Actual Result) / Ghi chú kiểm thử
                </label>
                <textarea
                  rows={3}
                  value={actualResult}
                  onChange={(e) => setActualResult(e.target.value)}
                  placeholder="Ghi nhận hành vi thực tế của hệ thống, mã lỗi, hoặc ghi chú kiểm thử nếu có..."
                  className="w-full p-3 text-xs border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white"
                />
              </div>

              {/* Linked Bugs Section */}
              {activeExecution.bugs && activeExecution.bugs.length > 0 && (
                <div className="p-4 bg-rose-50/60 border border-rose-200 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-rose-800 flex items-center gap-1">
                      <span>🐛</span> Lỗi đã liên kết với ca kiểm thử này ({activeExecution.bugs.length}):
                    </span>
                    <button
                      onClick={() => openBugModalForExecution(activeExecution, actualResult)}
                      className="text-[11px] text-rose-700 hover:underline font-semibold"
                    >
                      + Báo thêm Bug
                    </button>
                  </div>
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
                </div>
              )}
            </div>

            {/* Bottom Execution Action Toolbar */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Đánh dấu kết quả:</span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleRecordResult('PASSED')}
                  disabled={submitting}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  <span>✓</span> ĐẠT (PASS)
                </button>

                <button
                  onClick={() => handleRecordResult('FAILED')}
                  disabled={submitting}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  <span>✗</span> THẤT BẠI (FAIL) & TẠO BUG
                </button>

                <button
                  onClick={() => handleRecordResult('BLOCKED')}
                  disabled={submitting}
                  className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  <span>⊘</span> BỊ CHẶN (BLOCKED)
                </button>

                <button
                  onClick={() => handleRecordResult('SKIPPED')}
                  disabled={submitting}
                  className="px-4 py-2.5 bg-slate-600 hover:bg-slate-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  <span>⏭</span> BỎ QUA (SKIP)
                </button>
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
                {creatingBug ? 'Đang tạo Bug...' : 'Lưu Bug & Liên kết'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
