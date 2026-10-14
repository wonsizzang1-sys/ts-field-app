/* TS 현장 앱 — 첫 실행 자가 진단 C1~C6(설계서 5-2, D77로 C7 앱 안 녹음 제거). 결과는 meta.selfCheck 에 남기고 묶음 manifest 에도 넣는다.
   상태: ok 통과 / warn 경고 / fail 실패 / fallback 대체 방법 사용 / todo 아직 시험 안 함 */
(function (G) {
  'use strict';
  const TSF = (G.TSF = G.TSF || {});
  const ITEMS = [
    ['C1', '저장소', '기록을 이 기기에 저장하고 다시 열어도 보이는지'],
    ['C2', '지속 저장', '브라우저가 기록을 임의로 지우지 않게 요청'],
    ['C3', '저장 공간', '남은 공간 2GB 이상'],
    ['C4', '촬영', '카메라 바로 열기(시험 촬영 1장)'],
    ['C5', '암호화', 'WebCrypto AES-GCM(선택 기능)'],
    ['C6', '공유', '묶음 파일을 메일 앱으로 공유'],
  ];

  /* 저장되는 방식으로 다시 열기(②). 안드로이드 Chrome 이 「내 파일」의 content:// 로 연 파일은 IndexedDB 가 안 될 수 있다(실제 사례) */
  const REOPEN = ['「내 파일」 앱 → 「다운로드」를 엽니다', '이 앱 파일(*.html)을 길게 누릅니다', '「다른 앱으로 열기」를 누릅니다', '「삼성 인터넷」을 고릅니다(없으면 Chrome)', '다시 열린 앱의 기기 점검에서 C1 저장소가 「통과」인지 확인합니다'];
  const REOPEN_SHORT = '내 파일 → 다운로드 → 파일 길게 누르기 → 다른 앱으로 열기 → 삼성 인터넷(없으면 Chrome)';

  async function auto() {
    const r = {};
    try {
      const p = await TSF.probeStorage();
      r.C1 = p.reopened
        ? { s: 'ok', msg: `다시 열어도 같은 저장소가 보입니다(${p.opens}번째 열기).` }
        : { s: 'ok', msg: '저장·읽기는 됩니다. 앱을 닫았다가 다시 열면 출처 유지까지 확인합니다.' };
    } catch (e) { r.C1 = { s: 'fail', msg: TSF.storageMode === 'memory' ? `이 열기 방식에서는 기록을 폰에 저장할 수 없어 임시 메모리에 둡니다. 앱을 닫거나 새로 고치면 기록이 모두 사라집니다. 고치는 방법: ${REOPEN_SHORT}. 설치형(B안) 주소를 받았다면 그 주소로 엽니다.` : '이 방식으로는 기록을 저장할 수 없습니다. 설치형(B안) 주소로 열어 주세요.' }; }
    try {
      const ok = navigator.storage && navigator.storage.persist ? await navigator.storage.persist() : false;
      r.C2 = ok ? { s: 'ok', msg: '지속 저장이 허용되었습니다.' } : { s: 'warn', msg: '지속 저장이 허용되지 않았습니다. 매일 보내기를 꼭 하세요.' };
    } catch (e) { r.C2 = { s: 'warn', msg: '지속 저장을 확인하지 못했습니다. 매일 보내기를 꼭 하세요.' }; }
    try {
      const est = await navigator.storage.estimate();
      const free = (est.quota || 0) - (est.usage || 0);
      r.C3 = free >= 2 * 1073741824 ? { s: 'ok', msg: `남은 공간 약 ${TSF.fmtMB(free)}입니다.`, free } : { s: 'warn', msg: `남은 공간이 약 ${TSF.fmtMB(free)}입니다. 2GB 미만이면 동영상을 줄여 주세요.`, free };
    } catch (e) { r.C3 = { s: 'warn', msg: '남은 공간을 알 수 없습니다.' }; }
    r.C4 = { s: 'todo', msg: '[시험 촬영]을 눌러 사진 1장을 찍어 주세요.' };
    try {
      const k = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, new TextEncoder().encode('ts'));
      const pt = new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, k, ct));
      r.C5 = pt === 'ts' ? { s: 'ok', msg: '암호화 선택 기능을 쓸 수 있습니다.' } : { s: 'fail', msg: '암호화 선택 기능을 끕니다.' };
    } catch (e) { r.C5 = { s: 'fail', msg: '이 열기 방식에서는 암호화를 쓸 수 없어 선택 기능을 끕니다.' }; }
    r.C6 = shareCheck();
    return r;
  }
  /* ZIP 파일 공유 가능 여부. Chrome 안드로이드는 공유 가능한 파일 형식이 정해져 있어 ZIP 이 막힐 수 있다 */
  function shareCheck() {
    try {
      if (!navigator.canShare) return { s: 'fallback', msg: '공유를 쓸 수 없습니다. 내려받은 뒤 「내 파일」에서 메일로 공유합니다.' };
      const zipOk = navigator.canShare({ files: [new File(['ts'], 'test.zip', { type: 'application/zip' })] });
      if (zipOk) return { s: 'ok', msg: '묶음 파일을 메일 앱으로 바로 공유할 수 있습니다.' };
      return { s: 'fallback', msg: '이 브라우저는 ZIP 파일 공유를 막습니다. 내려받은 뒤 「내 파일」에서 메일로 공유합니다.' };
    } catch (e) { return { s: 'fallback', msg: '공유를 확인하지 못했습니다. 내려받기로 보냅니다.' }; }
  }
  const toManifest = (r) => { const o = {}; ITEMS.forEach(([k]) => { if (r && r[k]) o[k] = r[k].s; }); return o; };
  const isSamsung = () => /SamsungBrowser/i.test(navigator.userAgent);

  TSF.selfCheck = { ITEMS, auto, toManifest, isSamsung, shareCheck, REOPEN, REOPEN_SHORT };
})(typeof window !== 'undefined' ? window : globalThis);
