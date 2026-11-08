import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function loadModule(file, globals = {}) {
  const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports = {};
  runInNewContext(outputText, { exports, require: () => ({ serverEnv: () => ({ NOTION_API_TOKEN: "test-token", NOTION_DATABASE_ID: "test-database", ...globals.process?.env }) }), Intl, Date, AbortSignal, ...globals });
  return exports;
}

function notionFixture({ existing, env = {} } = {}) {
  const calls = [];
  const notion = loadModule("src/lib/notion.ts", {
    process: {
      env: { NOTION_API_TOKEN: "test-token", NOTION_DATABASE_ID: "test-database", ...env },
    },
    fetch: async (url, init) => {
      const body = JSON.parse(init.body);
      calls.push({ url, method: init.method, body });
      if (url.endsWith("/query")) {
        return { ok: true, json: async () => ({ results: existing ? [existing] : [] }) };
      }
      const properties = { ...existing?.properties, ...body.properties };
      const nameProperty = env.NOTION_NAME_PROPERTY || "학생이름";
      properties[nameProperty] = {
        title: properties[nameProperty].title.map((part) => ({ plain_text: part.text.content })),
      };
      return { ok: true, json: async () => ({ id: existing?.id || "new-page", properties }) };
    },
  });
  return { notion, calls };
}

const absence = {
  name: "테스트 학생",
  date: "2026-09-28",
  period: "조회",
  status: "결석",
};

test("all absence reasons, including 인정(생), save with independent document checkboxes", async () => {
  for (const reason of ["질병", "인정", "인정(생)", "미인정", "기타"]) {
    for (const medicalCertificateReceived of [false, true]) {
      for (const absenceReportReceived of [false, true]) {
        const { notion, calls } = notionFixture();
        const student = await notion.upsertAttendance({
          ...absence,
          reason,
          medicalCertificateReceived,
          absenceReportReceived,
          contactTarget: "모",
          contactMethod: "문자",
          occurredAt: "09:20",
        });
        const properties = calls[1].body.properties;
        assert.equal(properties.사유.select.name, reason);
        assert.equal(properties.진단서.checkbox, medicalCertificateReceived);
        assert.equal(properties.결석신고서.checkbox, absenceReportReceived);
        assert.equal(properties.연락대상.select, null);
        assert.equal(properties.연락수단.select, null);
        assert.equal(properties.발생시간.rich_text.length, 0);
        assert.equal(student.reason, reason);
        assert.equal(student.medicalCertificateReceived, medicalCertificateReceived);
        assert.equal(student.absenceReportReceived, absenceReportReceived);
      }
    }
  }
});

test("ordinary updates preserve documents checked in Notion and target the selected date", async () => {
  const { notion, calls } = notionFixture({
    existing: { id: "existing-page", properties: { 진단서: { checkbox: true }, 결석신고서: { checkbox: true } } },
  });
  const student = await notion.upsertAttendance({ ...absence, reason: "인정(생)" });
  assert.equal(calls[0].body.filter.and[1].date.equals, absence.date);
  assert.equal(calls[1].method, "PATCH");
  assert.ok(calls[1].url.endsWith("/pages/existing-page"));
  assert.equal(Object.hasOwn(calls[1].body.properties, "진단서"), false);
  assert.equal(Object.hasOwn(calls[1].body.properties, "결석신고서"), false);
  assert.equal(student.medicalCertificateReceived, true);
  assert.equal(student.absenceReportReceived, true);
});

test("explicitly unchecking one document preserves the other", async () => {
  const { notion, calls } = notionFixture({
    existing: { id: "existing-page", properties: { 진단서: { checkbox: true }, 결석신고서: { checkbox: true } } },
  });
  const student = await notion.upsertAttendance({ ...absence, reason: "질병", absenceReportReceived: false });
  assert.equal(calls[1].body.properties.결석신고서.checkbox, false);
  assert.equal(Object.hasOwn(calls[1].body.properties, "진단서"), false);
  assert.equal(student.medicalCertificateReceived, true);
  assert.equal(student.absenceReportReceived, false);
});

test("late/early leave details and configurable document names still round-trip", async () => {
  for (const status of ["지각", "조퇴"]) {
    const { notion, calls } = notionFixture({
      env: { NOTION_MEDICAL_CERTIFICATE_PROPERTY: "증빙서류", NOTION_ABSENCE_REPORT_PROPERTY: "신고서" },
    });
    const student = await notion.upsertAttendance({
      ...absence, status, reason: "질병", contactTarget: "모", contactMethod: "문자", occurredAt: "09:20",
      medicalCertificateReceived: true, absenceReportReceived: false,
    });
    assert.equal(calls[1].body.properties.증빙서류.checkbox, true);
    assert.equal(calls[1].body.properties.신고서.checkbox, false);
    assert.equal(calls[1].body.properties.연락대상.select.name, "모");
    assert.equal(calls[1].body.properties.발생시간.rich_text[0].text.content, "09:20");
    assert.equal(student.medicalCertificateReceived, true);
  }
});

test("attendance API rejects non-boolean document values before saving", async () => {
  let saved = false;
  const route = loadModule("src/app/api/attendance/route.ts", {
    Response,
    require: (name) => name === "@/lib/auth"
      ? { requireAuth: async () => null }
      : { upsertAttendance: async () => { saved = true; } },
  });
  for (const field of ["medicalCertificateReceived", "absenceReportReceived"]) {
    const response = await route.PATCH(new Request("http://localhost/api/attendance", {
      method: "PATCH",
      body: JSON.stringify({ ...absence, [field]: "true" }),
    }));
    assert.equal(response.status, 400);
  }
  assert.equal(saved, false);
});


test("attendance reads subsequent Notion pages", async () => {
  const cursors = [];
  const notion = loadModule("src/lib/notion.ts", {
    process: { env: { NOTION_API_TOKEN: "test-token", NOTION_DATABASE_ID: "test-database" } },
    fetch: async (_url, init) => {
      const body = JSON.parse(init.body); cursors.push(body.start_cursor);
      return { ok: true, json: async () => ({ results: [], has_more: cursors.length === 1, next_cursor: "page-2" }) };
    },
  });
  await notion.getStudents();
  assert.deepEqual(cursors, [undefined, "page-2"]);
});

test("sessions require a private secret and reject tampered or malformed cookies", async () => {
  let value;
  let configuration = { SESSION_SECRET: "x".repeat(32), APP_PASSCODE: "4567" };
  const auth = loadModule("src/lib/auth.ts", {
    crypto, TextEncoder, btoa, Response, process: { env: { NODE_ENV: "production" } },
    require: (name) => name === "./env"
      ? { serverEnv: () => configuration }
      : { cookies: async () => ({ get: () => value ? { value } : undefined, set: (_key, next) => { value = next; } }) },
  });
  assert.equal(await auth.verifyPasscode("1234"), false);
  assert.equal(await auth.verifyPasscode("4567"), true);
  await auth.createSessionCookie();
  assert.equal(await auth.isAuthenticated(), true);
  value += "tampered";
  assert.equal(await auth.isAuthenticated(), false);
  value = "123.invalid.signature";
  assert.equal(await auth.isAuthenticated(), false);
  configuration = {};
  assert.equal(await auth.verifyPasscode("1234"), false);
  await assert.rejects(auth.createSessionCookie(), /SESSION_SECRET/);
});
