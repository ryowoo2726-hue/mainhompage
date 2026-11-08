const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('../public/points/admin-data.js');
const text = value => ({ rich_text: [{ plain_text: value }] });
const title = value => ({ title: [{ plain_text: value }] });
const page = properties => ({ properties });
const dated = (start,end=null) => ({ date: { start,end } });
const fixture = () => ({ roster: [page({ 이름:title('학생가'), 숫자:text('1') }),page({ 이름:title('학생나'), 숫자:text('2') })], attendance:[], roles:[], holidays:[] });
const role = (date,name='학생가',roleName='핸드폰 담당',done=true) => page({ 학생이름:title(name), 날짜:dated(date), 역할:{ select:{ name:roleName } }, '수행 완료':{ checkbox:done } });

test('평일 출석, 상태 무관 제외, 휴일 범위, 중복 출결을 반영한다', async()=>{
  const { buildStudents }=await import('../src/lib/points/notion-data.mjs');
  const f=fixture();
  f.attendance=[page({학생이름:title('학생가'),날짜:dated('2026-10-02'),상태:{select:{name:'조퇴'}}}),page({학생이름:title('학생가'),날짜:dated('2026-10-02')})];
  f.holidays=[page({날짜:dated('2026-10-05','2026-10-06')})];
  const students=buildStudents(f,'2026-10-07');
  assert.deepEqual(students[0].attendanceDates,['2026-10-01','2026-10-07']);
  assert.deepEqual(students[1].attendanceDates,['2026-10-01','2026-10-02','2026-10-07']);
});
test('출결 기간과 한국 시간 날짜 경계를 적용한다',async()=>{
  const {buildStudents}=await import('../src/lib/points/notion-data.mjs');
  const f=fixture();
  f.attendance=[page({학생이름:title('학생가'),날짜:dated('2026-09-30','2026-10-02')}),page({학생이름:title('학생나'),날짜:dated('2026-09-30T15:30:00Z')})];
  const s=buildStudents(f,'2026-10-02');
  assert.deepEqual(s[0].attendanceDates,[]);
  assert.deepEqual(s[1].attendanceDates,['2026-10-02']);
});
test('역할 횟수는 10월부터 시작하며 중복·미완료·미래 기록을 제외한다',async()=>{
  const {buildStudents}=await import('../src/lib/points/notion-data.mjs');
  const f=fixture();
  f.roles=['2026-09-30','2026-10-01','2026-10-02','2026-10-06','2026-10-07','2026-10-08','2026-11-09'].map(d=>role(d));
  f.roles.push(role('2026-10-08'),role('2026-10-09','학생가','핸드폰 담당',false),role('2026-10-02','학생가','분리수거'));
  const s=buildStudents(f,'2026-10-09')[0];
  assert.deepEqual(s.roleAwards,[{date:'2026-10-08',points:3,role:'핸드폰 담당'},{date:'2026-10-02',points:3,role:'분리수거'}]);
  const narrow=api.calculate(s,'2026-10-06','2026-10-09');
  assert.equal(narrow.roleScore,3);
  assert.equal(narrow.attendance,4);
  assert.ok(api.periodRecords(s,'2026-10-01','2026-10-09').some(r=>r.label.includes('핸드폰 담당')));
});
test('명단 불일치·날짜 누락·잘못된 역할은 점수 확정 대신 오류를 반환한다',async()=>{
  const {buildStudents}=await import('../src/lib/points/notion-data.mjs');
  for(const entry of [page({학생이름:title('다른학생'),날짜:dated('2026-10-01')}),page({학생이름:title('학생가')})]){
    const f=fixture();f.attendance=[entry];assert.throws(()=>buildStudents(f,'2026-10-02'));
  }
  const f=fixture();f.roles=[role('2026-10-01','학생가','알수없음')];assert.throws(()=>buildStudents(f,'2026-10-02'));
});
test('동점은 공동 순위이고 잘못된 기간은 거부한다',()=>{
  const student={loaded:true,attendanceDates:['2026-10-01'],roleAwards:[],history:[]};
  const ranked=api.rankStudents([{...student,number:1},{...student,number:2},{...student,number:3,attendanceDates:[]}],'2026-10-01','2026-10-02');
  assert.deepEqual(ranked.map(s=>s.rank),[1,1,3]);
  assert.throws(()=>api.calculate(student,'2026-10-02','2026-10-01'),RangeError);
});
test('노션 조회는 마지막 페이지까지 읽고 권한 오류를 안내한다',async()=>{
  const {querySource}=await import('../src/lib/points/notion-data.mjs');let calls=0;
  const rows=await querySource('test-token','source',async(url,options)=>{
    const body=JSON.parse(options.body);calls++;
    assert.equal(options.headers.Authorization,'Bearer test-token');
    if(calls===1)return Response.json({results:[{id:'a'}],has_more:true,next_cursor:'next'});
    assert.equal(body.start_cursor,'next');return Response.json({results:[{id:'b'}],has_more:false});
  });
  assert.equal(rows.length,2);assert.equal(calls,2);
  await assert.rejects(querySource('test-token','source',async()=>new Response('',{status:404})),e=>e.publicMessage.includes('연결 권한'));
});

test('랭킹 시작일을 바꾸면 해당 날짜부터 오늘까지의 점수로 순위를 다시 계산한다',()=>{
  const students=[
    {id:'20201',number:1,loaded:true,attendanceDates:['2026-10-01','2026-10-02'],roleAwards:[]},
    {id:'20202',number:2,loaded:true,attendanceDates:['2026-11-02'],roleAwards:[{date:'2026-11-02',points:3}]}
  ];
  const full=api.rankStudents(students,'2026-10-01','2026-11-08');
  assert.deepEqual(full.map(s=>[s.id,s.total,s.rank]),[['20202',4,1],['20201',2,2]]);
  const narrow=api.rankStudents(students,'2026-11-03','2026-11-08');
  assert.deepEqual(narrow.map(s=>[s.id,s.total,s.rank]),[['20201',0,1],['20202',0,1]]);
});

test('출석 달력은 출석 동그라미와 출결 글씨를 구분하고 휴일·미래 날짜를 제외한다',()=>{
  const student={attendanceDates:['2026-10-01'],excludedDates:['2026-10-05'],attendanceEvents:[{date:'2026-10-02',status:'조퇴'},{date:'2026-10-06',status:'결석'},{date:'2026-10-06',status:'지각'}]};
  const calendar=api.attendanceCalendar(student,'2026-10','2026-10-01','2026-10-06');
  const day=value=>calendar.cells.find(cell=>cell?.day===value);
  assert.equal(calendar.cells.slice(0,4).every(cell=>cell===null),true);
  assert.equal(calendar.attendance,1);
  assert.equal(day(1).kind,'present');
  assert.equal(day(2).label,'조퇴');
  assert.equal(day(3).kind,'weekend');
  assert.equal(day(5).kind,'holiday');
  assert.equal(day(6).label,'결석·지각');
  assert.equal(day(7).kind,'inactive');
  assert.equal(api.attendanceCalendar(student,'2028-02','2028-02-01','2028-02-29').cells.filter(Boolean).length,29);
});

test('출석이 0일인 달도 달력으로 열 수 있으며 출결 사유는 정규화 응답에서 제거한다',async()=>{
  const {buildStudents}=await import('../src/lib/points/notion-data.mjs');
  const f=fixture();
  f.attendance=[page({학생이름:title('학생가'),날짜:dated('2026-10-01','2026-10-02'),상태:{select:{name:'결석'}},사유:{select:{name:'비공개 사유'}}})];
  const student=buildStudents(f,'2026-10-02')[0];
  assert.equal(student.attendanceDates.length,0);
  assert.deepEqual(student.attendanceEvents,[{date:'2026-10-01',status:'결석'},{date:'2026-10-02',status:'결석'}]);
  assert.equal(JSON.stringify(student).includes('비공개 사유'),false);
  const records=api.periodRecords(student,'2026-10-01','2026-10-02');
  assert.equal(records[0].month,'2026-10');assert.equal(records[0].points,0);
});

test('담당 학생 관계를 우선 사용하고 기존 이름·학번 기록도 계속 읽는다',async()=>{
  const {buildStudents}=await import('../src/lib/points/notion-data.mjs');
  const f=fixture();f.roster[0].id='aaa-bbb';f.roster[1].id='ccc-ddd';
  const record=role('2026-10-01','기록 제목','분리수거');
  record.properties['담당 학생']={relation:[{id:'aaabbb'}]};
  record.properties['학번']=text('20202');f.roles=[record];
  const students=buildStudents(f,'2026-10-02');
  assert.equal(students[0].roleAwards[0].points,3);
  assert.equal(students[1].roleAwards.length,0);
  record.properties['담당 학생'].relation.push({id:'cccddd'});
  assert.throws(()=>buildStudents(f,'2026-10-02'));
});

test('역할 달력은 수행일과 지급 점수를 표시하고 주말 수행도 표시한다',()=>{
  const student={roleRecords:[{role:'분리수거',dates:['2026-10-03','2026-10-07','2026-11-02']}],roleAwards:[{role:'분리수거',date:'2026-10-03',points:3},{role:'분리수거',date:'2026-10-07',points:3},{role:'분리수거',date:'2026-11-02',points:3}]};
  const c=api.roleCalendar(student,'분리수거','2026-10','2026-10-01','2026-11-08');
  assert.equal(c.count,2);
  assert.equal(c.points,6);
  assert.equal(c.cells.find(d=>d?.day===3).kind,'present');
  assert.equal(c.cells.find(d=>d?.day===3).label,'+3점');
  assert.equal(c.cells.find(d=>d?.day===2).kind,'unmarked');
  assert.equal(api.periodRecords(student,'2026-10-01','2026-11-08').find(r=>r.calendarRole).calendarRole,'분리수거');
});

test('5회 지급 역할은 다섯 번째 수행일에만 점수를 표시하며 조회 시작일 이전 횟수도 유지한다',async()=>{
  const {buildStudents}=await import('../src/lib/points/notion-data.mjs');
  const f=fixture();f.roles=['2026-10-01','2026-10-02','2026-10-06','2026-10-07','2026-10-08'].map(date=>role(date));
  const student=buildStudents(f,'2026-10-09')[0];
  const c=api.roleCalendar(student,'핸드폰 담당','2026-10','2026-10-07','2026-10-09');
  assert.equal(c.count,2);assert.equal(c.points,3);
  assert.equal(c.cells.find(d=>d?.day===7).label,'');
  assert.equal(c.cells.find(d=>d?.day===8).label,'+3점');
});

test('학생 조회 시작일은 점수·월별 내역·달력에 동일하게 적용한다',()=>{
  const student={loaded:true,attendanceDates:['2026-10-01','2026-11-02','2026-11-03'],roleRecords:[{role:'분리수거',dates:['2026-10-07','2026-11-02']}],roleAwards:[{role:'분리수거',date:'2026-10-07',points:3},{role:'분리수거',date:'2026-11-02',points:3}]};
  const start='2026-11-02',end='2026-11-08';
  assert.equal(api.calculate(student,start,end).total,5);
  const records=api.periodRecords(student,start,end);
  assert.deepEqual(records.filter(r=>r.month).map(r=>r.month),['2026-11']);
  assert.equal(records.find(r=>r.calendarRole).count,1);
  const calendar=api.attendanceCalendar(student,'2026-11',start,end);
  assert.equal(calendar.cells.find(d=>d?.day===1).kind,'inactive');
  assert.equal(calendar.attendance,2);
});
