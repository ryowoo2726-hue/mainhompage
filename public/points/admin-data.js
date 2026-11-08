/* 노션에서 정규화한 기록을 학생 화면과 관리자 화면에 동일하게 반영합니다. */
(function (root) {
  'use strict';
  function dateKey(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return null;
    const date = new Date(value+'T00:00:00Z');
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0,10) === value ? value : null;
  }
  function calculate(student, start, end) {
    if (!dateKey(start) || !dateKey(end) || start > end) throw new RangeError('조회 기간을 확인해주세요.');
    const within = record => record.date >= start && record.date <= end;
    const attendance = (student.attendanceDates || []).filter(date=>date>=start && date<=end).length;
    const roleScore = (student.roleAwards || []).filter(within).reduce((sum,r)=>sum+r.points,0);
    const extraScore = (student.history || []).filter(within).reduce((sum,r)=>sum+r.points,0);
    return { ...student, attendance, roleScore, extraScore, total: attendance+roleScore+extraScore, issues: student.loaded ? [] : ['노션 기록 확인 필요'] };
  }
  function rankStudents(students, start, end) {
    const entries = students.map(s=>calculate(s,start,end));
    entries.sort((a,b)=>Boolean(a.issues.length)-Boolean(b.issues.length)||b.total-a.total||a.number-b.number);
    let previous = null, rank = 0, position = 0;
    return entries.map(entry=>{
      if (entry.issues.length) return { ...entry, rank: null };
      position++;
      if (entry.total !== previous) rank = position;
      previous = entry.total;
      return { ...entry, rank };
    });
  }
  function periodRecords(student, start, end) {
    const months = new Map();
    for (const cursor = new Date(start.slice(0, 7) + '-01T00:00:00Z'); cursor.toISOString().slice(0, 7) <= end.slice(0, 7); cursor.setUTCMonth(cursor.getUTCMonth() + 1)) {
      months.set(cursor.toISOString().slice(0, 7), []);
    }
    for (const date of student.attendanceDates || []) {
      if (date < start || date > end) continue;
      const month = date.slice(0,7);
      if (!months.has(month)) months.set(month,[]);
      months.get(month).push(date);
    }
    const records = [...months].map(([month,dates])=>({ label: `${month} 출석`, month, points: dates.length, detail: dates.join(', ') }));
    for (const record of student.roleRecords || []) {
      const dates = record.dates.filter(date=>date>=start && date<=end);
      const points = (student.roleAwards || []).filter(r=>r.role===record.role && r.date>=start && r.date<=end).reduce((sum,r)=>sum+r.points,0);
      records.push({ label: `1인1역 · ${record.role}`, calendarRole: record.role, count: dates.length, points, detail: `기간 내 수행 ${dates.length}회\n수행 날짜: ${dates.join(', ')}\n기간 내 받은 상점: ${points}점` });
    }
    return records;
  }
  function attendanceCalendar(student, month, start, end) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !dateKey(start) || !dateKey(end) || start > end) throw new RangeError('달력 기간을 확인해주세요.');
    const [year, monthNumber] = month.split('-').map(Number);
    const first = new Date(Date.UTC(year, monthNumber - 1, 1));
    const length = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    const present = new Set(student.attendanceDates || []), holidays = new Set(student.excludedDates || []);
    const events = new Map();
    for (const event of student.attendanceEvents || []) {
      if (!events.has(event.date)) events.set(event.date, new Set());
      events.get(event.date).add(event.status);
    }
    const cells = Array(first.getUTCDay()).fill(null);
    for (let day = 1; day <= length; day++) {
      const date = `${month}-${String(day).padStart(2, '0')}`;
      const weekday = new Date(date + 'T00:00:00Z').getUTCDay();
      let kind = 'unconfirmed', label = '미확인';
      if (date < start || date > end) { kind = 'inactive'; label = ''; }
      else if (holidays.has(date)) { kind = 'holiday'; label = '휴일'; }
      else if (weekday === 0 || weekday === 6) { kind = 'weekend'; label = ''; }
      else if (events.has(date)) { kind = 'exception'; label = [...events.get(date)].join('·'); }
      else if (present.has(date)) { kind = 'present'; label = '출석'; }
      cells.push({ date, day, kind, label });
    }
    return { cells, attendance: cells.filter(cell => cell?.kind === 'present').length };
  }
  function roleCalendar(student, role, month, start, end) {
    const calendar = attendanceCalendar(student, month, start, end);
    const performed = new Set((student.roleRecords || []).find(record => record.role === role)?.dates || []);
    const awards = (student.roleAwards || []).filter(record => record.role === role);
    const cells = calendar.cells.map(cell => {
      if (!cell || cell.kind === 'inactive') return cell;
      const done = performed.has(cell.date);
      const points = awards.filter(record => record.date === cell.date).reduce((sum, record) => sum + record.points, 0);
      return { ...cell, kind: done ? 'present' : 'unmarked', label: done && points ? `+${points}점` : '' };
    });
    return { cells, count: cells.filter(cell => cell?.kind === 'present').length,
      points: awards.filter(record => record.date.startsWith(month) && record.date >= start && record.date <= end).reduce((sum, record) => sum + record.points, 0) };
  }
  const api = { dateKey, calculate, rankStudents, periodRecords, attendanceCalendar, roleCalendar };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AdminPoints = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
