/**
 * \ub9c8\uc11d\uc911\ud559\uad50 2\ud559\ub144 2\ubc18 \uc0c1\uc810 \uac04\ud3b8 \uc870\ud68c \uc2dc\uc2a4\ud15c (Design 1 \ud074\ub9b0 \ub9e4\ud2b8 \ub2e8\uc77c \ud14c\ub9c8)
 */

(function () {
  'use strict';

  let students = [];
  let currentStudent = null;
  let autoSyncTimer = null;
  let calendarMonth = null, calendarTrigger = null, calendarRole = null;
  let studentQueryStart = null;

  const searchSection = document.getElementById('searchSection');
  const resultSection = document.getElementById('resultSection');

  const searchForm = document.getElementById('searchForm');
  const studentInput = document.getElementById('studentInput');

  const studentNum = document.getElementById('studentNum');
  const studentName = document.getElementById('studentName');
  const studentPoints = document.getElementById('studentPoints');
  const studentMetaPills = document.getElementById('studentMetaPills');
  const rolePill = document.getElementById('rolePill');
  const monthlyList = document.getElementById('monthlyList');

  const backBtn = document.getElementById('backBtn');
  const searchAgainBtn = document.getElementById('searchAgainBtn');

  const toast = document.getElementById('toast');
  const roleCriteriaBtn = document.getElementById('roleCriteriaBtn');
  const roleCriteriaModal = document.getElementById('roleCriteriaModal');
  const roleCriteriaCloseBtn = document.getElementById('roleCriteriaCloseBtn');
  const attendanceModal = document.getElementById('attendanceModal');
  const attendanceCloseBtn = document.getElementById('attendanceCloseBtn');
  const calendarMonthInput = document.getElementById('calendarMonthInput');
  const studentPeriodOptions = document.getElementById('studentPeriodOptions');
  const studentPeriodForm = document.getElementById('studentPeriodForm');
  const studentStartDate = document.getElementById('studentStartDate');

  function studentPeriodStart() {
    return studentQueryStart && studentQueryStart >= PointSettings.startDate && studentQueryStart <= PointSettings.today()
      ? studentQueryStart : PointSettings.startDate;
  }

  function updateStudentPeriodControls() {
    studentStartDate.min = PointSettings.startDate;
    studentStartDate.max = PointSettings.today();
    if (!studentPeriodForm.contains(document.activeElement)) studentStartDate.value = studentPeriodStart();
    document.getElementById('studentPeriodEnd').textContent = PointSettings.today();
  }

  function init() {
    loadInitialData();
    bindEvents();

    syncNotion(false);

    setupAutoSync();
  }

  function loadInitialData() {
    students = (typeof DEFAULT_STUDENTS !== 'undefined') ? [...DEFAULT_STUDENTS] : [];
  }

  async function handleSearch() {
    try {
      await PointSettings.load();
      updateStudentPeriodControls();
      students = await NotionPoints.load();
    } catch (error) {
      hideUnverifiedResult();
      showToast(error.message);
      return;
    }
    const query = studentInput.value.trim();
    if (!query) {
      showToast('\ud559\ubc88\uc744 \uc785\ub825\ud574\uc8fc\uc138\uc694.');
      studentInput.focus();
      return;
    }

    const digits = query.replace(/[^0-9]/g, '');
    let matched = null;

    if (digits.length === 5) {
      matched = students.find(s => s.id === digits);
    } else if (digits.length > 0 && digits.length <= 2) {
      const num = parseInt(digits, 10);
      matched = students.find(s => s.number === num);
    }

    if (!matched) {
      matched = students.find(s => s.name === query || s.name.includes(query));
    }

    if (!matched) {
      showToast(`'${query}' \ud559\uc0dd\uc744 \ucc3e\uc744 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4.`);
      return;
    }

    showResult(matched);


  }

  function showResult(student) {
    if (!PointSettings.startDate) { hideUnverifiedResult(); return; }
    currentStudent = student;
    const start = studentPeriodStart();
    const end = PointSettings.today();
    const result = AdminPoints.calculate(student, start, end, POINT_CONFIG.academicYear);
    document.getElementById('studentPeriod').textContent = start + ' ~ ' + end + ' (오늘) 기록';
    const recordWarning = document.getElementById('studentRecordWarning');
    recordWarning.hidden = result.issues.length === 0;
    recordWarning.textContent = '일부 기록을 확인해야 합니다. 날짜가 확인된 기간 내 기록만 표시합니다.';
    studentNum.textContent = `${student.id} (${student.number}\ubc88)`;
    studentName.textContent = student.name;
    studentPoints.textContent = result.issues.length ? '확인 중' : result.total;

    renderRolePill(student);

    renderPointRecords(getPointRecords(student));
    if (!attendanceModal.hidden && calendarMonth) renderAttendanceCalendar(calendarMonth);

    searchSection.style.display = 'none';
    resultSection.style.display = 'block';
  }

  function renderRolePill(student) {
    if (student.role && student.role !== '\uc5c6\uc74c' && student.role !== '\uc5ed\ud560 \uc5c6\uc74c') {
      rolePill.textContent = `1\uc7781\uc5ed: ${student.role}`;
      rolePill.style.display = 'inline-block';
    } else {
      rolePill.style.display = 'none';
    }
  }

  function getPointRecords(student) {
    return AdminPoints.periodRecords(student, studentPeriodStart(), PointSettings.today(), POINT_CONFIG.academicYear);
  }

  function hideUnverifiedResult() {
    studentPoints.textContent = '—';
    monthlyList.innerHTML = '';
    resultSection.style.display = 'none';
    searchSection.style.display = 'block';
  }

  function renderPointRecords(records) {
    monthlyList.innerHTML = '';

    if (!records || records.length === 0) {
      monthlyList.innerHTML = '<div style="font-size:0.8rem; color:var(--text-muted); text-align:center; padding:12px;">\ubc1b\uc740 \uc0c1\uc810 \uae30\ub85d\uc774 \uc5c6\uc2b5\ub2c8\ub2e4.</div>';
      return;
    }

    records.forEach(item => {
      const row = document.createElement('div');
      const isRoleRecord = /^1\uc778\s*1\uc5ed/.test(item.label);
      row.className = `monthly-row${isRoleRecord ? ' role-point-row' : ''}`;

      const hasDetail = item.detail && item.detail.trim() !== '';

      row.innerHTML = `
        <button type="button" class="monthly-main" ${item.month || item.calendarRole ? 'aria-haspopup="dialog" aria-controls="attendanceModal"' : 'aria-expanded="false"'}>
          <div class="month-name-wrap">
            <span class="month-name">${escapeHtml(item.label)}</span>
          </div>
          <span class="month-pts">
            +${item.points}\uc810
          </span>
        </button>
        ${item.month || item.calendarRole ? `<p class="record-caption">${item.calendarRole ? `수행 ${item.count}회 · 달력 보기` : '달력 보기 · 날짜별 출결 확인'}</p>` : hasDetail ? `<div class="month-detail-panel">${escapeHtml(item.detail)}</div>` : ''}
      `;

      if (item.month || item.calendarRole) {
        row.querySelector('.monthly-main').addEventListener('click', event => {
          calendarTrigger = event.currentTarget;
          calendarRole = item.calendarRole || null;
          renderAttendanceCalendar(item.month || PointSettings.today().slice(0, 7));
          attendanceModal.hidden = false;
          document.body.classList.add('modal-open');
          attendanceCloseBtn.focus();
        });
      } else if (hasDetail) {
        row.querySelector('.monthly-main').addEventListener('click', event => {
          row.classList.toggle('open');
          event.currentTarget.setAttribute('aria-expanded', String(row.classList.contains('open')));
        });
        if (item.label === '9\uc6d4 \ucd9c\uc11d') {
          row.classList.add('open');
        }
      }

      monthlyList.appendChild(row);
    });
  }

  function renderAttendanceCalendar(month) {
    if (!currentStudent) return;
    calendarMonth = month;
    const start = studentPeriodStart();
    if (month < start.slice(0, 7)) month = start.slice(0, 7);
    calendarMonth = month;
    calendarMonthInput.min = start.slice(0, 7);
    calendarMonthInput.max = PointSettings.today().slice(0, 7);
    calendarMonthInput.value = month;
    const calendar = calendarRole
      ? AdminPoints.roleCalendar(currentStudent, calendarRole, month, start, PointSettings.today())
      : AdminPoints.attendanceCalendar(currentStudent, month, start, PointSettings.today());
    document.getElementById('attendanceStudent').textContent = currentStudent.name + ' · ' + (calendarRole || '출석 기록');
    document.getElementById('attendanceTitle').textContent = `${month.slice(0, 4)}년 ${Number(month.slice(5))}월`;
    document.getElementById('attendanceSummary').textContent = calendarRole ? `수행 ${calendar.count}회 · 역할 상점 ${calendar.points}점` : `출석 ${calendar.attendance}일 · 출석 상점 ${calendar.attendance}점`;
    const grid = document.getElementById('attendanceGrid');
    grid.replaceChildren();
    for (const day of calendar.cells) {
      const cell = document.createElement('div');
      if (!day) { cell.className = 'attendance-day empty'; cell.setAttribute('aria-hidden', 'true'); }
      else {
        cell.className = 'attendance-day ' + day.kind;
        cell.setAttribute('role', 'listitem');
        cell.setAttribute('aria-label', day.date + ' ' + (calendarRole && day.kind === 'present' ? '수행 완료 ' + day.label : day.label || (day.kind === 'present' ? '출석' : day.kind === 'weekend' ? '주말' : day.kind === 'unmarked' ? '수행 기록 없음' : '집계 기간 밖')));
        const number = document.createElement('span');
        number.className = 'calendar-day-number'; number.textContent = day.day;
        const label = document.createElement('span');
        label.className = 'calendar-day-label'; label.textContent = day.kind === 'present' && !calendarRole ? '' : day.label;
        cell.append(number, label);
      }
      grid.append(cell);
    }
  }

  function closeAttendanceCalendar() {
    attendanceModal.hidden = true;
    document.body.classList.remove('modal-open');
    if (calendarTrigger?.isConnected) calendarTrigger.focus(); else searchAgainBtn.focus();
  }

  function showSearch() {
    currentStudent = null;
    resultSection.style.display = 'none';
    searchSection.style.display = 'block';
    studentInput.value = '';
    studentInput.focus();
  }

  function openRoleCriteriaModal() {
    roleCriteriaModal.hidden = false;
    document.body.classList.add('modal-open');
    roleCriteriaCloseBtn.focus();
  }

  function closeRoleCriteriaModal() {
    roleCriteriaModal.hidden = true;
    document.body.classList.remove('modal-open');
    roleCriteriaBtn.focus();
  }

  async function syncNotion(notify = false) {
    try {
      await PointSettings.load();
      updateStudentPeriodControls();
      students = await NotionPoints.load();
      if (currentStudent) {
        const fresh = students.find(s => s.id === currentStudent.id);
        if (fresh) showResult(fresh); else hideUnverifiedResult();
      }
      if (notify) showToast('노션 기록을 반영했습니다.');
      return true;
    } catch (error) {
      if (!students.length) hideUnverifiedResult();
      showToast(error.message);
      return false;
    }
  }

  function setupAutoSync() {
    if (autoSyncTimer) clearInterval(autoSyncTimer);
    autoSyncTimer = setInterval(() => { if (!document.hidden) syncNotion(); }, 60000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) syncNotion(); });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  let toastTimer = null;
  function showToast(msg) {
    if (toastTimer) clearTimeout(toastTimer);
    toast.textContent = msg;
    toast.classList.add('show');
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2200);
  }

  function bindEvents() {
    studentPeriodForm.addEventListener('submit', async event => {
      event.preventDefault();
      try {
        await PointSettings.load();
        studentStartDate.min = PointSettings.startDate;
        studentStartDate.max = PointSettings.today();
        if (!studentPeriodForm.reportValidity()) return;
        studentQueryStart = studentStartDate.value;
        studentPeriodOptions.open = false;
        if (currentStudent) showResult(currentStudent);
        showToast('조회 시작일을 ' + studentQueryStart + '로 적용했습니다.');
      } catch (error) { showToast(error.message); }
    });
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleSearch();
    });

    backBtn.addEventListener('click', showSearch);
    searchAgainBtn.addEventListener('click', showSearch);
    roleCriteriaBtn.addEventListener('click', openRoleCriteriaModal);
    roleCriteriaCloseBtn.addEventListener('click', closeRoleCriteriaModal);
    attendanceCloseBtn.addEventListener('click', closeAttendanceCalendar);
    calendarMonthInput.addEventListener('change', () => { if (calendarMonthInput.reportValidity() && calendarMonthInput.value) renderAttendanceCalendar(calendarMonthInput.value); });
    attendanceModal.addEventListener('click', event => { if (event.target === attendanceModal) closeAttendanceCalendar(); });
    roleCriteriaModal.addEventListener('click', (e) => {
      if (e.target === roleCriteriaModal) closeRoleCriteriaModal();
    });

    document.addEventListener('keydown', (e) => {
      if (!attendanceModal.hidden) {
        if (e.key === 'Escape') { e.preventDefault(); closeAttendanceCalendar(); }
        if (e.key === 'Tab') {
          if (e.shiftKey && document.activeElement === attendanceCloseBtn) { e.preventDefault(); calendarMonthInput.focus(); }
          else if (!e.shiftKey && document.activeElement === calendarMonthInput) { e.preventDefault(); attendanceCloseBtn.focus(); }
        }
        return;
      }
      if (e.key === 'Escape') {
        if (!document.getElementById('rankingModal').hidden) return;
        if (!roleCriteriaModal.hidden) {
          closeRoleCriteriaModal();
          return;
        }
        if (resultSection.style.display !== 'none') {
          showSearch();
        }
      }
    });

  }

  document.addEventListener('DOMContentLoaded', init);
})();
