import "server-only";
import { serverEnv } from "./env";

import type { Analytics, AttendanceInput, AttendanceStatus, Student } from "./types";

type NotionProperty = Record<string, unknown>;
type NotionPage = {
  id: string;
  properties: Record<string, NotionProperty>;
};

const NOTION_VERSION = "2022-06-28";

function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: serverEnv().APP_TIME_ZONE || "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function props() {
  return {
    name: serverEnv().NOTION_NAME_PROPERTY || "학생이름",
    rosterName: serverEnv().NOTION_STUDENT_NAME_PROPERTY || "이름",
    date: serverEnv().NOTION_DATE_PROPERTY || "날짜",
    period: serverEnv().NOTION_PERIOD_PROPERTY || "교시",
    status: serverEnv().NOTION_STATUS_PROPERTY || "상태",
    reason: serverEnv().NOTION_REASON_PROPERTY || "사유",
    contactTarget: serverEnv().NOTION_CONTACT_TARGET_PROPERTY || "연락대상",
    contactMethod: serverEnv().NOTION_CONTACT_METHOD_PROPERTY || "연락수단",
    occurredAt: serverEnv().NOTION_OCCURRED_AT_PROPERTY || "발생시간",
    medicalCertificate: serverEnv().NOTION_MEDICAL_CERTIFICATE_PROPERTY || "진단서",
    absenceReport: serverEnv().NOTION_ABSENCE_REPORT_PROPERTY || "결석신고서",
  };
}

function hasNotionConfig() {
  return Boolean(serverEnv().NOTION_API_TOKEN && serverEnv().NOTION_DATABASE_ID);
}

function hasRosterConfig() {
  return Boolean(serverEnv().NOTION_API_TOKEN && serverEnv().NOTION_STUDENT_DATABASE_ID);
}

async function notionFetch(path: string, init: RequestInit = {}) {
  const response = await fetch(`https://api.notion.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${serverEnv().NOTION_API_TOKEN}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
      ...init.headers,
    },
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`노션 요청을 처리하지 못했습니다. (${response.status})`);
  }

  return response.json();
}

function titleText(property?: NotionProperty) {
  const title = property?.title as Array<{ plain_text?: string }> | undefined;
  return title?.map((part) => part.plain_text || "").join("").trim() || "";
}

function richText(property?: NotionProperty) {
  const text = property?.rich_text as Array<{ plain_text?: string }> | undefined;
  return text?.map((part) => part.plain_text || "").join("").trim() || "";
}

function selectName(property?: NotionProperty) {
  return (property?.select as { name?: string } | undefined)?.name || "";
}

function dateValue(property?: NotionProperty) {
  return (property?.date as { start?: string } | undefined)?.start?.slice(0, 10) || today();
}

function toStudent(page: NotionPage): Student | null {
  const p = props();
  const name = titleText(page.properties[p.name]);
  if (!name) return null;

  return {
    id: name,
    name,
    date: dateValue(page.properties[p.date]),
    period: selectName(page.properties[p.period]) as Student["period"],
    status: selectName(page.properties[p.status]) as AttendanceStatus,
    reason: selectName(page.properties[p.reason]) as Student["reason"],
    contactTarget: selectName(page.properties[p.contactTarget]) as Student["contactTarget"],
    contactMethod: selectName(page.properties[p.contactMethod]) as Student["contactMethod"],
    occurredAt: richText(page.properties[p.occurredAt]),
    medicalCertificateReceived: page.properties[p.medicalCertificate]?.checkbox === true,
    absenceReportReceived: page.properties[p.absenceReport]?.checkbox === true,
    notionPageId: page.id,
  };
}

function toRosterStudent(page: NotionPage): Student | null {
  const p = props();
  const name = richText(page.properties[p.rosterName]) || titleText(page.properties[p.rosterName]);
  if (!name) return null;

  return {
    id: page.id,
    name,
    date: today(),
  };
}

function summarize(students: Student[], previousRate?: number): Analytics {
  const total = students.length;
  const count = (status: AttendanceStatus) => students.filter((student) => student.status === status).length;
  const earlyLeave = count("조퇴");
  const late = count("지각");
  const absent = count("결석");
  const recorded = earlyLeave + late + absent;
  const recordedRate = total ? Math.round((recorded / total) * 100) : 0;
  const lateRate = total ? Math.round((late / total) * 100) : 0;
  const absenceRate = total ? Math.round((absent / total) * 100) : 0;
  const delta = previousRate === undefined ? 0 : recordedRate - previousRate;

  return {
    date: today(),
    total,
    earlyLeave,
    late,
    absent,
    recordedRate,
    lateRate,
    absenceRate,
    trend: Math.abs(delta) < 3 ? "flat" : delta > 0 ? "up" : "down",
    trendLabel:
      previousRate === undefined ? "오늘 기록 기준" : `${delta >= 0 ? "+" : ""}${delta}%p vs 이전 기록`,
  };
}

async function queryDatabase(databaseId: string, sorts?: unknown[]) {
  const results: NotionPage[] = [];
  let cursor: string | undefined;
  do {
    const data = await notionFetch(`/databases/${databaseId}/query`, {
      method: "POST",
      body: JSON.stringify({ page_size: 100, sorts, start_cursor: cursor }),
    });
    results.push(...data.results);
    if (data.has_more && (!data.next_cursor || data.next_cursor === cursor)) {
      throw new Error("노션의 다음 기록을 불러오지 못했습니다.");
    }
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return { results };
}

function queryPages() {
  return queryDatabase(serverEnv().NOTION_DATABASE_ID!, [{ property: props().date, direction: "descending" }]);
}

function queryRosterPages() {
  return queryDatabase(serverEnv().NOTION_STUDENT_DATABASE_ID!);
}

async function getRosterStudents(): Promise<Student[]> {
  if (!hasRosterConfig()) return [];

  const data = await queryRosterPages();
  const students = (data.results as NotionPage[])
    .map(toRosterStudent)
    .filter((student): student is Student => Boolean(student));

  return students.sort((a, b) => a.name.localeCompare(b.name, "ko"));
}

async function getAttendanceStudents(): Promise<Student[]> {
  const data = await queryPages();
  return (data.results as NotionPage[]).map(toStudent).filter((student): student is Student => Boolean(student));
}

async function findAttendancePage(name: string, date: string) {
  const p = props();
  const data = await notionFetch(`/databases/${serverEnv().NOTION_DATABASE_ID}/query`, {
    method: "POST",
    body: JSON.stringify({
      filter: {
        and: [
          { property: p.name, title: { equals: name } },
          { property: p.date, date: { equals: date } },
        ],
      },
      page_size: 1,
    }),
  });

  return ((data.results as NotionPage[])[0] as NotionPage | undefined) || null;
}

export async function getStudents(): Promise<Student[]> {
  if (!hasNotionConfig()) throw new Error("노션 연결 설정을 확인해주세요.");

  const [rosterStudents, attendanceStudents] = await Promise.all([getRosterStudents(), getAttendanceStudents()]);
  const latestByName = new Map<string, Student>();

  for (const student of rosterStudents) {
    latestByName.set(student.name, student);
  }

  for (const student of attendanceStudents) {
    const existing = latestByName.get(student.name);
    if (!existing || student.date === today()) {
      latestByName.set(student.name, {
        ...existing,
        ...student,
        date: student.date === today() ? student.date : today(),
      });
    }
  }

  return [...latestByName.values()].sort((a, b) => a.name.localeCompare(b.name, "ko"));
}

export async function upsertAttendance(input: AttendanceInput) {
  if (!hasNotionConfig()) {
    throw new Error("노션 연결 설정을 확인해주세요.");
  }

  const p = props();
  const isDetailed = input.status === "지각" || input.status === "조퇴";
  const properties = {
    [p.name]: { title: [{ text: { content: input.name } }] },
    [p.date]: { date: { start: input.date || today() } },
    [p.period]: { select: { name: input.period } },
    [p.status]: { select: { name: input.status } },
    [p.reason]: input.reason ? { select: { name: input.reason } } : { select: null },
    [p.contactTarget]: isDetailed && input.contactTarget ? { select: { name: input.contactTarget } } : { select: null },
    [p.contactMethod]: isDetailed && input.contactMethod ? { select: { name: input.contactMethod } } : { select: null },
    [p.occurredAt]: {
      rich_text: isDetailed && input.occurredAt ? [{ text: { content: input.occurredAt } }] : [],
    },
    // Omitted fields preserve documents checked directly in Notion.
    ...(typeof input.medicalCertificateReceived === "boolean"
      ? { [p.medicalCertificate]: { checkbox: input.medicalCertificateReceived } }
      : {}),
    ...(typeof input.absenceReportReceived === "boolean"
      ? { [p.absenceReport]: { checkbox: input.absenceReportReceived } }
      : {}),
  };

  const existing = await findAttendancePage(input.name, input.date || today());

  if (existing) {
    const updated = await notionFetch(`/pages/${existing.id}`, {
      method: "PATCH",
      body: JSON.stringify({ properties }),
    });
    return toStudent(updated) || ({ id: input.name, ...input } satisfies Student);
  }

  const created = await notionFetch("/pages", {
    method: "POST",
    body: JSON.stringify({
      parent: { database_id: serverEnv().NOTION_DATABASE_ID },
      properties,
    }),
  });

  return toStudent(created) || ({ id: input.name, ...input } satisfies Student);
}

export async function getAnalytics(): Promise<Analytics> {
  if (!hasNotionConfig()) throw new Error("노션 연결 설정을 확인해주세요.");

  const students = await getAttendanceStudents();
  const rosterStudents = await getRosterStudents();
  const todays = students.filter((student) => student.date === today());
  const previousDate = students.find((student) => student.date !== today())?.date;
  const previous = previousDate ? students.filter((student) => student.date === previousDate) : undefined;
  const todaysWithRoster =
    rosterStudents.length > 0
      ? rosterStudents.map((student) => ({
          ...student,
          ...todays.find((record) => record.name === student.name),
        }))
      : todays;

  return summarize(
    todaysWithRoster.length ? todaysWithRoster : await getStudents(),
    previous ? summarize(previous).recordedRate : undefined,
  );
}
