import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
const base = process.env.SMOKE_URL || 'http://127.0.0.1:8790';
for (const [route, text] of [['/', '2학년 2반 웹 허브'], ['/attendance', '교실 출결 기록'], ['/points', 'rankingBtn']]) {
  const response = await fetch(base+route);
  assert.equal(response.status, 200, route);
  const html = await response.text();
  assert.ok(html.includes(text), route);
  for (const [, asset] of html.matchAll(/(?:src|href)="((?:\/home\/|\/points\/|\/_next\/)[^" ]+\.(?:js|css|svg)(?:\?[^" ]*)?)"/g)) {
    assert.equal((await fetch(base+asset)).status, 200, asset);
  }
}
assert.equal((await fetch(base+'/api/attendance')).status, 401);
assert.equal((await fetch(base+'/api/analytics')).status, 401);
assert.equal((await fetch(base+'/api/points/students', { method: 'POST' })).status, 405);
const points = await fetch(base+'/api/points/students');
assert.equal(points.status, 200);
const pointData = await points.json();
assert.equal(pointData.startDate, '2026-10-01');
assert.equal(pointData.students.length, 30);
const env = parseEnv(readFileSync('.dev.vars', 'utf8'));
assert.ok(!JSON.stringify(pointData).includes(env.NOTION_API_TOKEN));
const login = await fetch(base+'/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ passcode: env.APP_PASSCODE }) });
assert.equal(login.status, 200);
assert.match(login.headers.get('set-cookie'), /HttpOnly/i);
const cookie = login.headers.get('set-cookie').split(';')[0];
const headers = { Cookie: cookie };
const roster = await fetch(base+'/api/attendance', { headers });
assert.equal(roster.status, 200);
assert.equal((await roster.json()).students.length, 30);
const analytics = await fetch(base+'/api/analytics', { headers });
assert.equal(analytics.status, 200);
assert.equal((await analytics.json()).analytics.total, 30);
assert.equal((await fetch(base+'/api/auth/logout', { method: 'POST', headers })).status, 200);
console.log('화면·정적 자원·인증·실제 Notion 학생 30명 조회 확인 (데이터 쓰기 없음)');
