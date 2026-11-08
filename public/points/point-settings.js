(function () {
  'use strict';
  let startDate = null, pending = null;
  function today() {
    return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  }
  async function load() {
    if (pending) return pending;
    pending = (async () => {
      try {
        const response = await fetch('/api/points/settings', { cache: 'no-store', signal: AbortSignal.timeout(15000) });
        if (!response.ok) throw new Error('조회 설정을 불러오지 못했습니다.');
        const data = await response.json();
        if (!AdminPoints.dateKey(data.startDate) || data.startDate > today()) throw new Error('조회 시작일을 확인해주세요.');
        startDate = data.startDate;
        return startDate;
      } catch (error) { startDate = null; throw error; }
    })();
    try { return await pending; } finally { pending = null; }
  }
  window.PointSettings = { today, load, get startDate() { return startDate; } };
  let studentRequest = null;
  window.NotionPoints = {
    async load() {
      if (studentRequest) return studentRequest;
      studentRequest = (async () => {
        const response = await fetch('/api/points/students', { cache: 'no-store', signal: AbortSignal.timeout(60000) });
        const data = await response.json();
        if (!response.ok || !Array.isArray(data.students)) throw new Error(data.error || '노션 기록을 불러오지 못했습니다.');
        return data.students;
      })();
      try { return await studentRequest; } finally { studentRequest = null; }
    }
  };
})();
