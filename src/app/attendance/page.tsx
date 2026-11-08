"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  ChevronRight,
  Clock3,
  Lock,
  LogOut,
  Phone,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import type {
  AbsenceReason,
  Analytics,
  AttendanceInput,
  AttendanceStatus,
  ContactMethod,
  ContactTarget,
  Period,
  Student,
} from "@/lib/types";
import { absenceReasons, attendanceStatuses, contactMethods, contactTargets, periods } from "@/lib/types";
import "./page.css";

const idleMs = 15 * 60 * 1000;
const syncMs = 60 * 1000;

function todayString() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function emptyForm(name = ""): AttendanceInput {
  return {
    name,
    date: todayString(),
    period: "조회",
    status: "지각",
    reason: "질병",
    contactTarget: "모",
    contactMethod: "문자",
    occurredAt: "",
    medicalCertificateReceived: false,
    absenceReportReceived: false,
  };
}

function formFromStudent(student: Student): AttendanceInput {
  return {
    name: student.name,
    date: todayString(),
    period: student.period || "조회",
    status: student.status || "지각",
    reason: student.reason || "질병",
    contactTarget: student.contactTarget || "모",
    contactMethod: student.contactMethod || "문자",
    occurredAt: student.occurredAt || "",
    medicalCertificateReceived: student.medicalCertificateReceived ?? false,
    absenceReportReceived: student.absenceReportReceived ?? false,
  };
}

export default function Home() {
  const [passcode, setPasscode] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedName, setSelectedName] = useState("");
  const [form, setForm] = useState<AttendanceInput>(() => emptyForm());
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const sortedStudents = useMemo(
    () => [...students].sort((a, b) => a.name.localeCompare(b.name, "ko")),
    [students],
  );

  const filteredStudents = useMemo(
    () => sortedStudents.filter((student) => student.name.includes(query.trim())),
    [query, sortedStudents],
  );

  const selectedStudent = useMemo(
    () => students.find((student) => student.name === selectedName) || null,
    [selectedName, students],
  );

  const needsDetails = form.status === "지각" || form.status === "조퇴";

  const fetchJson = useCallback(async function fetchJson<T>(url: string, init?: RequestInit) {
    const response = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
    const data = (await response.json().catch(() => null)) as T & { error?: string };

    if (!response.ok) {
      throw new Error(data?.error || "요청을 처리하지 못했습니다.");
    }

    return data;
  }, []);

  const selectStudent = useCallback((student: Student) => {
    setSelectedName(student.name);
    setForm(formFromStudent(student));
    setError("");
  }, []);

  const loadDashboard = useCallback(async function loadDashboard() {
    setLoading(true);
    setError("");
    try {
      const [attendanceData, analyticsData] = await Promise.all([
        fetchJson<{ students: Student[] }>("/api/attendance"),
        fetchJson<{ analytics: Analytics }>("/api/analytics"),
      ]);
      setStudents(attendanceData.students);
      setAnalytics(analyticsData.analytics);

      const preferred =
        attendanceData.students.find((student) => student.name === selectedName) || attendanceData.students[0];
      if (preferred) {
        selectStudent(preferred);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "데이터를 불러오지 못했습니다.");
      if (err instanceof Error && err.message.includes("Unauthorized")) {
        setAuthenticated(false);
      }
    } finally {
      setLoading(false);
    }
  }, [fetchJson, selectStudent, selectedName]);

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await fetchJson("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ passcode }),
      });
      setAuthenticated(true);
      setPasscode("");
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "비밀 코드가 맞지 않습니다.");
    } finally {
      setLoading(false);
    }
  }

  const logout = useCallback(async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setAuthenticated(false);
    setStudents([]);
    setSelectedName("");
    setAnalytics(null);
  }, []);

  function updateForm<Key extends keyof AttendanceInput>(key: Key, value: AttendanceInput[Key]) {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === "status" && value === "결석") {
        return {
          ...next,
          reason: current.reason || "질병",
          contactTarget: undefined,
          contactMethod: undefined,
          occurredAt: "",
        };
      }
      if (key === "status" && (value === "지각" || value === "조퇴")) {
        return {
          ...next,
          reason: current.reason || "질병",
          contactTarget: current.contactTarget || "모",
          contactMethod: current.contactMethod || "문자",
        };
      }
      return next;
    });
  }

  async function saveAttendance(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name) {
      setError("학생을 먼저 선택하세요.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const payload: AttendanceInput = needsDetails
        ? { ...form }
        : {
            name: form.name,
            date: form.date,
            period: form.period,
            status: form.status,
            reason: form.reason,
          };
      // Only send document changes so a normal save preserves Notion-side checks.
      const savedRecord = selectedStudent?.date === form.date ? selectedStudent : null;
      if (form.medicalCertificateReceived !== (savedRecord?.medicalCertificateReceived ?? false)) {
        payload.medicalCertificateReceived = form.medicalCertificateReceived;
      } else {
        delete payload.medicalCertificateReceived;
      }
      if (form.absenceReportReceived !== (savedRecord?.absenceReportReceived ?? false)) {
        payload.absenceReportReceived = form.absenceReportReceived;
      } else {
        delete payload.absenceReportReceived;
      }
      const data = await fetchJson<{ student: Student }>("/api/attendance", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setStudents((current) =>
        current.map((student) => (student.name === data.student.name ? { ...student, ...data.student } : student)),
      );
      setSelectedName(data.student.name);
      setForm(formFromStudent({ ...selectedStudent, ...data.student }));
      const analyticsData = await fetchJson<{ analytics: Analytics }>("/api/analytics");
      setAnalytics(analyticsData.analytics);
    } catch (err) {
      setError(err instanceof Error ? err.message : "출결 상태 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    fetchJson<{ authenticated: boolean }>("/api/auth/session")
      .then((data) => {
        setAuthenticated(data.authenticated);
        if (data.authenticated) {
          void loadDashboard();
        }
      })
      .catch(() => setAuthenticated(false))
      .finally(() => setLoading(false));
  }, [fetchJson, loadDashboard]);

  useEffect(() => {
    if (!authenticated) return;

    const syncTimer = window.setInterval(() => {
      void loadDashboard();
    }, syncMs);

    return () => window.clearInterval(syncTimer);
  }, [authenticated, loadDashboard]);

  useEffect(() => {
    if (!authenticated) return;

    let timer = window.setTimeout(logout, idleMs);
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(logout, idleMs);
    };

    window.addEventListener("pointerdown", reset);
    window.addEventListener("keydown", reset);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", reset);
      window.removeEventListener("keydown", reset);
    };
  }, [authenticated, logout]);

  if (!authenticated) {
    return (
      <main className="login-screen">
        <a className="home-link" href="/">홈으로</a>
        <section className="login-panel" aria-label="출석부 로그인">
          <div className="lock-mark">
            <Lock size={28} />
          </div>
          <h1>교실 출결 기록</h1>
          <p>선생님 비밀 코드를 입력하세요.</p>
          <form onSubmit={login} className="passcode-form">
            <input
              aria-label="비밀 코드"
              inputMode="numeric"
              maxLength={6}
              minLength={4}
              pattern="[0-9]*"
              type="password"
              value={passcode}
              onChange={(event) => setPasscode(event.target.value.replace(/\D/g, ""))}
              placeholder="4-6자리"
            />
            <button disabled={loading || passcode.length < 4} type="submit">
              <ShieldCheck size={22} />
              입장
            </button>
          </form>
          {error ? <p className="error-text">{error}</p> : null}

        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Notion Live Sync</p>
          <h1>교실 출결 기록</h1>
        </div>
        <div className="toolbar">
          <a className="home-link" href="/">홈으로</a>
          <button className="icon-button" aria-label="새로고침" onClick={loadDashboard} disabled={loading}>
            <RefreshCw size={22} />
          </button>
          <button className="icon-button" aria-label="잠금" onClick={logout}>
            <LogOut size={22} />
          </button>
        </div>
      </header>

      <section className="analytics-band" aria-label="출결 통계">
        <div className="metric primary-metric">
          <div>
            <p>오늘 기록률</p>
            <strong>{analytics?.recordedRate ?? 0}%</strong>
          </div>
          <BarChart3 size={30} />
        </div>
        <div className="bar-stack" aria-hidden="true">
          <span style={{ width: `${analytics?.lateRate ?? 0}%` }} className="bar late" />
          <span style={{ width: `${analytics?.absenceRate ?? 0}%` }} className="bar absent" />
        </div>
        <div className="mini-metrics">
          <span>지각 {analytics?.late ?? 0}</span>
          <span>조퇴 {analytics?.earlyLeave ?? 0}</span>
          <span>결석 {analytics?.absent ?? 0}</span>
          <span>{analytics?.trendLabel ?? "기록 대기"}</span>
        </div>
      </section>

      {error ? <div className="notice">{error}</div> : null}

      <section className="workspace" aria-label="출결 입력 화면">
        <aside className="student-sidebar">
          <div className="sidebar-heading">
            <div>
              <p>학생 목록</p>
              <strong>{filteredStudents.length}명</strong>
            </div>
            <UsersRound size={24} />
          </div>
          <label className="search-box">
            <Search size={18} />
            <input
              aria-label="학생 검색"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="이름 검색"
            />
          </label>
          <div className="student-list">
            {loading ? (
              <div className="empty-list">불러오는 중</div>
            ) : (
              filteredStudents.map((student) => (
                <button
                  className={`student-row ${student.name === selectedName ? "active" : ""}`}
                  key={student.id}
                  onClick={() => selectStudent(student)}
                  type="button"
                >
                  <span>
                    <strong>{student.name}</strong>
                    <small>
                      {student.status
                        ? `${student.period || "조회"} · ${student.status}${student.reason ? ` · ${student.reason}` : ""}`
                        : "오늘 기록 없음"}
                    </small>
                  </span>
                  <ChevronRight size={18} />
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="form-panel">
          <div className="selected-header">
            <div>
              <p>선택 학생</p>
              <h2>{selectedStudent?.name || "학생을 선택하세요"}</h2>
            </div>
            <span className={`status-pill ${selectedStudent?.status || "none"}`}>
              {selectedStudent?.status || "미기록"}
            </span>
          </div>

          <form className="attendance-form" onSubmit={saveAttendance}>
            <label className="field">
              <span>
                <CalendarDays size={18} />
                날짜
              </span>
              <input type="date" value={form.date} onChange={(event) => updateForm("date", event.target.value)} />
            </label>

            <SegmentedField<Period>
              label="교시"
              options={periods}
              value={form.period}
              onChange={(value) => updateForm("period", value)}
            />

            <SegmentedField<AttendanceStatus>
              label="상태"
              options={attendanceStatuses}
              value={form.status}
              onChange={(value) => updateForm("status", value)}
            />

            <SegmentedField<AbsenceReason>
              label="사유"
              options={absenceReasons}
              value={form.reason || "질병"}
              onChange={(value) => updateForm("reason", value)}
            />

            {needsDetails ? (
              <div className="detail-fields">
                <SegmentedField<ContactTarget>
                  label="연락대상"
                  options={contactTargets}
                  value={form.contactTarget || "모"}
                  onChange={(value) => updateForm("contactTarget", value)}
                />

                <SegmentedField<ContactMethod>
                  label="연락수단"
                  options={contactMethods}
                  value={form.contactMethod || "문자"}
                  onChange={(value) => updateForm("contactMethod", value)}
                />

                <label className="field">
                  <span>
                    <Clock3 size={18} />
                    발생시간
                  </span>
                  <input
                    type="time"
                    value={form.occurredAt || ""}
                    onChange={(event) => updateForm("occurredAt", event.target.value)}
                  />
                </label>
              </div>
            ) : null}

            <fieldset className="document-fields">
              <legend>서류 제출 확인</legend>
              <div className="document-checks">
                <label className="document-check">
                  <input
                    type="checkbox"
                    checked={form.medicalCertificateReceived ?? false}
                    onChange={(event) => updateForm("medicalCertificateReceived", event.target.checked)}
                  />
                  <span>진단서 제출</span>
                </label>
                {form.status === "결석" ? (
                  <label className="document-check">
                    <input
                      type="checkbox"
                      checked={form.absenceReportReceived ?? false}
                      onChange={(event) => updateForm("absenceReportReceived", event.target.checked)}
                    />
                    <span>결석신고서 제출</span>
                  </label>
                ) : null}
              </div>
            </fieldset>

            <button className="save-button" disabled={saving || !form.name} type="submit">
              <Save size={22} />
              {saving ? "저장 중" : "노션에 저장"}
            </button>
          </form>

          <div className="sync-card">
            <Phone size={20} />
            <p>같은 날짜와 같은 학생이름 기록이 있으면 새로 만들지 않고 기존 Notion 페이지를 수정합니다.</p>
          </div>
        </section>
      </section>
    </main>
  );
}

function SegmentedField<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: T[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="segmented-field">
      <legend>{label}</legend>
      <div className="segment-group">
        {options.map((option) => (
          <button
            className={option === value ? "selected" : ""}
            key={option}
            aria-pressed={option === value}
            onClick={() => onChange(option)}
            type="button"
          >
            {option}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
