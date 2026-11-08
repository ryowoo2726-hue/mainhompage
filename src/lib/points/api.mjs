import { loadNotionStudents, START_DATE, ROLE_DATABASE_URL, HOLIDAY_DATABASE_URL } from './notion-data.mjs';

export async function onRequestGet({ request, env }) {
  const path = new URL(request.url).pathname;
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  if (path === '/api/points/settings') return Response.json({ startDate: START_DATE, roleUrl: ROLE_DATABASE_URL, holidayUrl: HOLIDAY_DATABASE_URL }, { headers });
  if (path !== '/api/points/students') return new Response('Not found', { status: 404 });
  if (!env.NOTION_API_TOKEN) return Response.json({ error: '서버의 NOTION_API_TOKEN 설정이 필요합니다.' }, { status: 503, headers });
  try {
    return Response.json({ startDate: START_DATE, students: await loadNotionStudents(env) }, { headers });
  } catch (error) {
    return Response.json({ error: error.publicMessage || '노션 기록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.' }, { status: 502, headers });
  }
}
