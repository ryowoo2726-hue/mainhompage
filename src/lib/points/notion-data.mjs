import studentRoles from './student-roles.json' with { type: 'json' };

export const START_DATE = '2026-10-01';
export const ROLE_DATABASE_URL = 'https://www.notion.so/17fcbad031404be58855c58e034ffd07';
export const HOLIDAY_DATABASE_URL = 'https://www.notion.so/4a6831b4c45f4dbf863894fc8d27ee2f';
export const SOURCES = {
  roster: '31117b13-a52b-802a-873e-000bd9dd1a7e',
  attendance: '36917b13-a52b-801c-9c75-000bc28d394c',
  roles: '3700af1f-ccc0-420a-93e6-f0e31468a443',
  holidays: '2b52dc85-75b2-43f4-95ee-81f2d6d54927'
};
export const ROLE_RULES = {
  '핸드폰 담당': { every: 5, points: 3 }, '출석부 담당': { every: 5, points: 1 },
  '분리수거': { every: 1, points: 3 }, '테블릿 관리': { every: 5, points: 3 },
  '특별실 청소': { every: 1, points: 1 }, '칠판정리': { every: 5, points: 3 },
  '학생 관리': { every: 5, points: 3 }, '급식 알리미': { every: 5, points: 3 }
};
export function seoulToday() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
function textProperty(property) {
  return (property?.title || property?.rich_text || []).map(t => t.plain_text ?? t.text?.content ?? '').join('').trim();
}
function dateKey(value) {
  if (!value) return null;
  const date = new Date(value.includes('T') ? value : value+'T00:00:00Z');
  if (Number.isNaN(date.valueOf())) return null;
  if (value.includes('T')) return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && date.toISOString().slice(0,10) === value ? value : null;
}
function range(page) {
  const property = page.properties?.['날짜']?.date;
  const start = dateKey(property?.start), end = dateKey(property?.end || property?.start);
  if (!start || !end || start > end) fail('노션 기록의 날짜를 확인해주세요.');
  return { start, end };
}
function days(start, end) {
  const result = [];
  for (let day = new Date(start+'T00:00:00Z'); day.toISOString().slice(0,10) <= end; day.setUTCDate(day.getUTCDate()+1)) result.push(day.toISOString().slice(0,10));
  return result;
}
function fail(message) { const error = new Error(message); error.publicMessage = message; throw error; }

export async function querySource(token, source, fetcher = fetch) {
  const rows = [];
  let cursor;
  do {
    const response = await fetcher(`https://api.notion.com/v1/data_sources/${source}/query`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Notion-Version': '2025-09-03', 'Content-Type': 'application/json' },
      body: JSON.stringify({ page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) }), signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) {
      if (response.status === 401) fail('노션 API 토큰을 확인해주세요.');
      if (response.status === 403 || response.status === 404) fail('노션 데이터베이스의 연결 권한을 확인해주세요. 학생 명단·출결·1인 1역 수행 기록·출석 상점 제외일을 앱 통합에 연결해야 합니다.');
      fail('노션 API 요청에 실패했습니다. 잠시 후 다시 시도해주세요.');
    }
    const data = await response.json();
    if (!Array.isArray(data.results)) throw new Error('Invalid response');
    rows.push(...data.results);
    if (data.has_more && (!data.next_cursor || data.next_cursor === cursor)) throw new Error('Invalid cursor');
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);
  return rows;
}

export function buildStudents({ roster, attendance, roles, holidays }, end = seoulToday()) {
  const normalizeId = value => String(value).replace(/-/g, '');
  const rosterByPage = new Map(roster.filter(page => page.id).map(page => [normalizeId(page.id), page]));
  const students = roster.map(page => {
    const p = page.properties;
    const name = textProperty(p['이름']);
    const number = Number(textProperty(p['숫자']));
    if (!name || !Number.isInteger(number) || number < 1 || number > 99) fail('노션 학생 명단의 이름과 숫자(출석번호)를 확인해주세요.');
    const id = `202${String(number).padStart(2,'0')}`;
    return { id, number, name, role: studentRoles[id] || '', attendanceDates: [], attendanceEvents: [], excludedDates: [], roleRecords: [], roleAwards: [], history: [], loaded: true };
  }).sort((a,b)=>a.number-b.number);
  if (!students.length || new Set(students.map(s=>s.id)).size !== students.length || new Set(students.map(s=>s.name)).size !== students.length) fail('노션 학생 명단이 비어 있거나 이름·번호가 중복됩니다.');
  const schoolDays = days(START_DATE, end).filter(date => ![0,6].includes(new Date(date+'T00:00:00Z').getUTCDay()));
  const excluded = new Set();
  for (const page of holidays) {
    const r = range(page);
    for (const day of schoolDays) if (day >= r.start && day <= r.end) excluded.add(day);
  }
  const blocked = new Map(students.map(s=>[s.id,new Set()]));
  for (const page of attendance) {
    const r = range(page);
    if (r.end < START_DATE || r.start > end) continue;
    const name = textProperty(page.properties['학생이름']);
    const student = students.find(s=>s.name === name);
    if (!student) fail('출결 기록의 학생이름이 학생 명단과 일치하지 않습니다. 이름을 확인해주세요.');
    // 상태·사유에 관계없이 해당 날짜의 출결 기록이 있으면 제외합니다.
    const rawStatus = page.properties['상태']?.select?.name;
    const status = ['지각', '조퇴', '결석'].includes(rawStatus) ? rawStatus : '출결 기록';
    for (const day of schoolDays) if (day >= r.start && day <= r.end) {
      blocked.get(student.id).add(day);
      if (!student.attendanceEvents.some(event => event.date === day && event.status === status)) {
        student.attendanceEvents.push({ date: day, status });
      }
    }
  }
  for (const student of students) {
    student.attendanceDates = schoolDays.filter(day=>!excluded.has(day) && !blocked.get(student.id).has(day));
    student.excludedDates = [...excluded].sort();
    student.attendanceEvents.sort((a, b) => a.date.localeCompare(b.date) || a.status.localeCompare(b.status));
  }
  for (const page of roles) {
    const p = page.properties;
    if (p['수행 완료']?.checkbox !== true) continue;
    const r = range(page);
    if (r.start < START_DATE || r.start > end) continue;
    if (r.start !== r.end) fail('1인 1역 수행 날짜는 하루씩 입력해주세요.');
    const assignees = p['담당 학생']?.relation || [];
    if (assignees.length > 1 || p['담당 학생']?.has_more) fail('1인 1역 기록에는 담당 학생을 한 명만 선택해주세요.');
    const assignedPage = assignees.length ? rosterByPage.get(normalizeId(assignees[0].id)) : null;
    if (assignees.length && !assignedPage) fail('담당 학생이 노션 학생 명단에 연결되어 있는지 확인해주세요.');
    const id = assignedPage ? `202${String(Number(textProperty(assignedPage.properties['숫자']))).padStart(2, '0')}` : textProperty(p['학번']);
    const name = assignedPage ? '' : textProperty(p['학생이름']);
    const student = id ? students.find(s=>s.id===id) : students.find(s=>s.name===name);
    const role = p['역할']?.select?.name;
    if (!student || (name && student.name !== name) || !ROLE_RULES[role]) fail('1인 1역 수행 기록의 학생·학번·역할을 확인해주세요.');
    let record = student.roleRecords.find(item=>item.role===role);
    if (!record) { record = { role, dates: [] }; student.roleRecords.push(record); }
    if (!record.dates.includes(r.start)) record.dates.push(r.start);
  }
  for (const student of students) {
    if (ROLE_RULES[student.role] && !student.roleRecords.some(record => record.role === student.role)) student.roleRecords.push({ role: student.role, dates: [] });
    for (const record of student.roleRecords) {
      record.dates.sort();
      const rule = ROLE_RULES[record.role];
      record.dates.forEach((date,index)=>{ if ((index+1)%rule.every === 0) student.roleAwards.push({ date, points: rule.points, role: record.role }); });
    }
    student.points = student.attendanceDates.length + student.roleAwards.reduce((sum,r)=>sum+r.points,0);
  }
  return students;
}

let cached = null, pending = null;
export async function loadNotionStudents(env) {
  const today = seoulToday();
  if (cached?.token === env.NOTION_API_TOKEN && cached.today === today && cached.expires > Date.now()) return cached.students;
  if (pending?.token === env.NOTION_API_TOKEN && pending.today === today) return pending.promise;
  const promise = (async () => {
    const input = {};
    for (const [key,id] of Object.entries(SOURCES)) input[key] = await querySource(env.NOTION_API_TOKEN,id);
    const students = buildStudents(input,today);
    cached = { token: env.NOTION_API_TOKEN, today, expires: Date.now()+30000, students };
    return students;
  })();
  pending = { token: env.NOTION_API_TOKEN, today, promise };
  try { return await promise; } finally { if (pending?.promise === promise) pending = null; }
}
