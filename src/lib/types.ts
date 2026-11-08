export type Period = "조회" | "1교시" | "2교시" | "3교시" | "4교시" | "5교시" | "6교시" | "7교시" | "종례";
export type AttendanceStatus = "조퇴" | "지각" | "결석";
export type AbsenceReason = "질병" | "인정" | "인정(생)" | "미인정" | "기타";
export type ContactTarget = "부" | "모" | "기타";
export type ContactMethod = "전화" | "문자";

export type Student = {
  id: string;
  name: string;
  date: string;
  period?: Period;
  status?: AttendanceStatus;
  reason?: AbsenceReason;
  contactTarget?: ContactTarget;
  contactMethod?: ContactMethod;
  occurredAt?: string;
  medicalCertificateReceived?: boolean;
  absenceReportReceived?: boolean;
  notionPageId?: string;
};

export type AttendanceInput = {
  name: string;
  date: string;
  period: Period;
  status: AttendanceStatus;
  reason?: AbsenceReason;
  contactTarget?: ContactTarget;
  contactMethod?: ContactMethod;
  occurredAt?: string;
  medicalCertificateReceived?: boolean;
  absenceReportReceived?: boolean;
};

export type Analytics = {
  date: string;
  total: number;
  earlyLeave: number;
  late: number;
  absent: number;
  recordedRate: number;
  lateRate: number;
  absenceRate: number;
  trend: "up" | "flat" | "down";
  trendLabel: string;
};

export const periods: Period[] = ["조회", "1교시", "2교시", "3교시", "4교시", "5교시", "6교시", "7교시", "종례"];
export const attendanceStatuses: AttendanceStatus[] = ["조퇴", "지각", "결석"];
export const absenceReasons: AbsenceReason[] = ["질병", "인정", "인정(생)", "미인정", "기타"];
export const contactTargets: ContactTarget[] = ["부", "모", "기타"];
export const contactMethods: ContactMethod[] = ["전화", "문자"];
