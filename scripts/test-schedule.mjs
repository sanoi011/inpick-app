const BASE = 'http://localhost:3000';
const CONTRACTOR_ID = 'b86cffa5-9e17-44ff-9a03-9ae68a0a4a12';

async function test() {
  // 1. 프로젝트 목록 조회
  console.log('=== 1. 사업자 프로젝트 목록 ===');
  const projRes = await fetch(BASE + '/api/contractor/projects?contractorId=' + CONTRACTOR_ID);
  const projData = await projRes.json();
  const projects = projData.projects || [];
  console.log('프로젝트 수:', projects.length);

  if (projects.length === 0) {
    console.log('프로젝트 없음');
    return;
  }

  const pid = projects[0].id;
  console.log('프로젝트:', projects[0].name, '| ID:', pid);

  // 2. 공정표 재생성 (RLS 수정 후)
  console.log('\n=== 2. 공정표 재생성 ===');
  const genRes = await fetch(BASE + '/api/contractor/projects/' + pid, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'generateSchedule' }),
  });
  const genData = await genRes.json();
  console.log('Status:', genRes.status);

  if (genData.error) {
    console.error('Error:', genData.error);
    return;
  }

  if (genData.schedule) {
    console.log('공정표 생성 성공!');
    printSchedule(genData.schedule);
  }

  // 3. DB에서 재조회 (tasks 확인)
  console.log('\n=== 3. DB에서 재조회 ===');
  const schedRes = await fetch(BASE + '/api/contractor/projects/' + pid + '/schedule');
  const schedData = await schedRes.json();
  console.log('generated:', schedData.generated);
  if (schedData.schedule) {
    printSchedule(schedData.schedule);
    const totalTasks = schedData.schedule.phases.reduce((sum, p) => sum + p.tasks.length, 0);
    console.log('\n총 sub-tasks:', totalTasks);
  }

  // 4. 공정 상태 변경 테스트
  console.log('\n=== 4. 공정 상태 변경: 철거 → completed ===');
  const detail = await (await fetch(BASE + '/api/contractor/projects/' + pid)).json();
  const phases = (detail.project?.project_phases || []).sort((a, b) => a.phase_order - b.phase_order);
  if (phases.length > 0) {
    const statusRes = await fetch(BASE + '/api/contractor/projects/' + pid, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'updatePhase', phaseId: phases[0].id, status: 'completed' }),
    });
    console.log('결과:', (await statusRes.json()).success ? 'OK' : 'FAIL');

    // 기초/설비 배관 → in_progress
    console.log('기초/설비 배관 → in_progress');
    const statusRes2 = await fetch(BASE + '/api/contractor/projects/' + pid, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'updatePhase', phaseId: phases[1].id, status: 'in_progress' }),
    });
    console.log('결과:', (await statusRes2.json()).success ? 'OK' : 'FAIL');
  }

  // 5. 최종 공정표 확인
  console.log('\n=== 5. 최종 공정표 확인 ===');
  const finalRes = await fetch(BASE + '/api/contractor/projects/' + pid + '/schedule');
  const finalData = await finalRes.json();
  if (finalData.schedule) {
    for (const ph of finalData.schedule.phases) {
      const status = ph.status === 'COMPLETED' ? '✓' : ph.status === 'IN_PROGRESS' ? '▶' : '○';
      console.log(`  ${status} ${ph.phaseOrder}. ${ph.name}: ${ph.startDate} ~ ${ph.endDate} (${ph.durationDays}일) tasks:${ph.tasks.length}`);
    }
  }

  console.log('\n=== 모든 테스트 완료 ===');
}

function printSchedule(s) {
  console.log(`프로젝트: ${s.projectName} | ${s.startDate} ~ ${s.endDate} | ${s.totalDays}일`);
  for (const ph of s.phases) {
    console.log(`  ${ph.phaseOrder}. ${ph.name}: ${ph.startDate} ~ ${ph.endDate} (${ph.durationDays}일) [${ph.color}] tasks:${ph.tasks.length}`);
    for (const t of ph.tasks) {
      console.log(`      - ${t.name}: ${t.startDate} ~ ${t.endDate} (${t.durationDays}일)`);
    }
  }
}

test().catch(e => console.error('Error:', e.message));
