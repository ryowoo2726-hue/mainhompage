import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet } from '../src/lib/points/api.mjs';
import { SOURCES } from '../src/lib/points/notion-data.mjs';

test('points API is namespaced and fails closed without a secret', async () => {
  const call = path => onRequestGet({ request: new Request('https://example.com'+path), env: {} });
  assert.equal((await call('/api/points/students')).status, 503);
  assert.equal((await call('/api/students')).status, 404);
  assert.equal((await (await call('/api/points/settings')).json()).startDate, '2026-10-01');
});

test('public points responses exclude private roster fields and the token', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async url => Response.json({ has_more: false, results: String(url).includes(SOURCES.roster) ? [{ properties: { 이름: { title: [{ plain_text: '테스트학생' }] }, 숫자: { rich_text: [{ plain_text: '1' }] }, 연락처: { phone_number: 'private-phone' }, 이메일: { email: 'private-email' } } }] : [] });
    const response = await onRequestGet({ request: new Request('https://example.com/api/points/students'), env: { NOTION_API_TOKEN: 'server-only-secret' } });
    assert.equal(response.status, 200);
    const text = await response.text();
    for (const value of ['server-only-secret', 'private-phone', 'private-email', '연락처', '사유']) assert.equal(text.includes(value), false);
    assert.equal(JSON.parse(text).students.length, 1);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
  } finally { globalThis.fetch = original; }
});
