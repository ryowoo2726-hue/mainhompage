(function () {
  'use strict';
  const modal = document.getElementById('rankingModal');
  const openBtn = document.getElementById('rankingBtn');
  const closeBtn = document.getElementById('rankingCloseBtn');
  const form = document.getElementById('rankingDateForm');
  const dateInput = document.getElementById('rankingStartDate');
  const status = document.getElementById('rankingStatus');
  const results = document.getElementById('rankingResults');
  const body = document.getElementById('rankingBody');
  const period = document.getElementById('rankingPeriod');
  let students = null, loading = false;

  function render() {
    dateInput.max = PointSettings.today();
    if (!students) return;
    if (!form.reportValidity()) {
      results.hidden = true;
      period.textContent = '';
      status.textContent = '집계 시작일부터 오늘 사이의 날짜를 선택해주세요.';
      return;
    }
    const ranked = AdminPoints.rankStudents(students, dateInput.value, dateInput.max);
    body.replaceChildren();
    for (const student of ranked) {
      const row = document.createElement('tr');
      if (student.rank === 1) row.className = 'top-ranked';
      const rank = document.createElement('td');
      const badge = document.createElement('span');
      badge.className = 'rank-number' + (student.rank === 1 ? ' rank-first' : '');
      badge.textContent = student.rank ?? '—';
      rank.append(badge);
      const profile = document.createElement('th');
      profile.scope = 'row';
      const name = document.createElement('span');
      name.className = 'ranking-name'; name.textContent = student.name;
      const id = document.createElement('span');
      id.className = 'ranking-student-id'; id.textContent = `${student.id} · ${student.number}번`;
      profile.append(name, id);
      row.append(rank, profile);
      for (const value of [student.attendance, student.roleScore, student.total]) {
        const cell = document.createElement('td');
        cell.textContent = value;
        row.append(cell);
      }
      row.lastElementChild.className = 'ranking-total';
      body.append(row);
    }
    period.textContent = `${dateInput.value} ~ ${dateInput.max}`;
    status.textContent = ranked.length ? `${ranked.length}명 · 오늘까지의 기록` : '조회할 학생이 없습니다.';
    status.classList.remove('record-warning');
    results.hidden = ranked.length === 0;
  }

  async function load() {
    if (loading) return;
    loading = true;
    results.hidden = true;
    status.classList.remove('record-warning');
    status.textContent = '상점 기록을 불러오는 중입니다.';
    form.querySelector('button').disabled = true;
    modal.setAttribute('aria-busy', 'true');
    try {
      const start = await PointSettings.load();
      dateInput.min = start;
      dateInput.max = PointSettings.today();
      if (!dateInput.value || dateInput.value < start) dateInput.value = start;
      students = await NotionPoints.load();
      render();
    } catch (error) {
      students = null;
      period.textContent = '';
      status.textContent = error.message + ' 조회 버튼을 눌러 다시 시도해주세요.';
      status.classList.add('record-warning');
    } finally {
      loading = false;
      form.querySelector('button').disabled = false;
      modal.removeAttribute('aria-busy');
    }
  }

  function close() {
    modal.hidden = true;
    document.body.classList.remove('modal-open');
    openBtn.focus();
  }
  openBtn.addEventListener('click', () => {
    modal.hidden = false;
    document.body.classList.add('modal-open');
    dateInput.focus();
    load();
  });
  closeBtn.addEventListener('click', close);
  modal.addEventListener('click', event => { if (event.target === modal) close(); });
  form.addEventListener('submit', event => { event.preventDefault(); load(); });
  dateInput.addEventListener('change', () => { if (!loading) render(); });
  document.addEventListener('keydown', event => {
    if (modal.hidden) return;
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    if (event.key === 'Tab') {
      const controls = [...modal.querySelectorAll('button, input')].filter(el => !el.disabled);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
})();
