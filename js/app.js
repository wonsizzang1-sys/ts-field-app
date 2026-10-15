/* TS 현장 앱 — 화면 S0~S9(설계서 5-4), 기록(5-5), 저장(5-6), 앱 자료(5-7), 보내기(5-8, 5-9 · D93 반입 확인 코드 화면 없음), 디자인(5-12)
   화면 글자는 한국어만(D61). 등급은 항상 뜻을 붙인다(D74). 현장 등급은 판단 기록이며 확정값이 아니다(D8). */
(function (G) {
  'use strict';
  const TSF = G.TSF;
  const { esc, isoLocal, hm, gradeText, GRADE_WORD, GRADE_DEF, fmtMB } = TSF;
  const $ = (s, r = document) => r.querySelector(s);
  const SINGLE = document.documentElement.dataset.build === 'single';

  /* 자산 경로는 문자열 그대로 둔다(build_single.py 가 data URI 로 바꾼다) */
  const IMG = {
    icon: 'assets/app_icon_192.png',
    analyst: 'assets/char_analyst_default.png', analystAlert: 'assets/char_analyst_alert.png',
    planner: 'assets/char_planner_default.png', reporter: 'assets/char_reporter_done.png', reviewer: 'assets/char_reviewer_alert.png',
    empty: 'assets/empty_norecord.png',
    camera: 'assets/icon_camera.png', memo: 'assets/icon_memo.png', mail: 'assets/icon_mail.png',
    warning: 'assets/icon_warning.png', approve: 'assets/icon_approve.png', import: 'assets/icon_import.png',
  };
  const NAMES = { analyst: '분석 agent 루키', planner: '기획 agent 플래니', reporter: '보고 agent 리포', reviewer: '검수 agent 체키' };
  const SVG = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
  const ICO = {
    place: SVG('<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>'),
    list: SVG('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'),
    camera: SVG('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
    send: SVG('<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>'),
    gear: SVG('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
    video: SVG('<rect x="2" y="6" width="14" height="12" rx="2"/><path d="m16 10 6-3v10l-6-3z"/>'),
    mic: SVG('<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v4"/>'),
    memo: SVG('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13 7 4 4"/>'),
    retake: SVG('<path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 21v-5h5"/>'),
    unc: SVG('<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6M12 17h.01"/>'),
  };
  const KIND = { photo: '사진', video: '동영상', audio: '음성', memo: '메모' };
  const QUICK_TAGS = ['#야간', '#개방', '#미기록', '#미착용', '#수기', '#사각'];

  /* ── 상태 ── */
  const S = {
    db: null, ad: null, dev: null, alias: '', recs: [], by: null, sc: null, settings: {},
    entries: new Map(), marks: new Map(), media: new Map(), sends: [],
    view: 'boot', prevView: null, place: null, seq: null, outView: false, s3f: 'all', s6f: 'time', pick: new Set(), mine: false,
    free: null, lastLayout: null, locked: false, idleAt: Date.now(), building: null, built: null, heicWarned: false,
    gOpen: {}, // 현장 가이드 접는 칸 열림(등급 기준·사례·물어볼 것·받을 서류)
    // D95 기록 보호: 저장 상태 줄·영구 저장 여부·자동 백업(bkCfg = meta.backup, bk = 미리 만든 백업 파일)
    persisted: null, lastSaveAt: null, bkCfg: { every: 10, at: null, lastId: null, mediaIds: [], n: 0 }, bk: null, bkBusy: false,
  };
  /* D95 ② 설치 주소: 앱 자료 installUrl(https)이 있으면 그것, 없으면 기본 B안 주소 */
  const INSTALL_URL = 'https://wonsizzang1-sys.github.io/ts-field-app/';
  const installUrl = () => (S.ad && /^https:\/\//.test(S.ad.installUrl || '') ? S.ad.installUrl : INSTALL_URL);
  const pref = (k, v) => { try { if (v === undefined) return localStorage.getItem('tsf_' + k); localStorage.setItem('tsf_' + k, v); } catch (e) { return null; } return null; };
  /* 글자 크게(사용자 결정 10/15): 이 기기에 기억, html[data-big] → app.css 에서 화면 전체 확대 */
  const bigText = (on) => { if (on !== undefined) pref('big', on ? '1' : ''); document.documentElement.toggleAttribute('data-big', pref('big') === '1'); };
  bigText();
  const bigCard = (i) => `<div class="card rise" style="--i:${i}"><div class="toggle"><b>글자 크게 <small class="muted">글자·버튼을 크게 보입니다</small></b><button class="switch ${pref('big') === '1' ? 'on' : ''}" data-act="bigText" aria-label="글자 크게" aria-pressed="${pref('big') === '1'}"></button></div></div>`;

  /* ── 앱 자료 ── */
  function validAppData(d) {
    return d && d.format === 'ts-field-app-data/1' && d.project && /^P\d{2}-\d{3}$/.test(d.project.id) && d.round && Array.isArray(d.places) && Array.isArray(d.questions);
  }
  function readEmbedded() {
    const el = document.getElementById('ts-app-data');
    const t = el && el.textContent.trim();
    if (!t) return null;
    try { const d = JSON.parse(t); return validAppData(d) ? d : null; } catch (e) { return null; }
  }
  /* 내부 ID → 사람이 읽는 이름(화면 글 전용, 원래 ID 는 title 로). 웹 TS.ui.refLabel 과 같은 규칙 */
  const SITE = { DS: '생산시설형', DX: '오피스·거점형', ALL: '통합' };
  function refLabel(id) {
    const s = String(id == null ? '' : id); let m;
    if ((m = /^FR-[A-Z0-9]+-(\d+)/.exec(s))) return '현장 기록 #' + Number(m[1]);
    if ((m = /^FB-[A-Z0-9]+-(\d+)$/.exec(s))) return '현장 묶음 #' + Number(m[1]);
    if ((m = /^RT-(\d+)$/.exec(s))) return '재촬영 요청 #' + Number(m[1]);
    if ((m = /^QM-[A-Z0-9]+-(\d+)/.exec(s))) return '현장 등급 · 문항 ' + m[1];
    return s;
  }
  const etId = () => S.settings.evalType || S.ad.evalTypes[0].id;
  const curEt = () => S.ad.evalTypes.find((e) => e.id === etId()) || S.ad.evalTypes[0];
  /* 차수 ID 는 {평가종류}-{n}(2-5). 앱 자료 round 와 다른 평가 종류는 같은 회차 번호를 붙인다(확인 필요, README 참고) */
  function roundId() { const [et0, n] = S.ad.round.id.split('-'); return etId() === et0 ? S.ad.round.id : `${etId()}-${n}`; }
  function questions() {
    const et = curEt();
    if (et.bank === 'custom') return (et.items || []).map((i) => ({ seq: i.n, area: et.name, sub: '', zone: '', text: i.text, point: '', methods: ['현장'] }));
    return S.ad.questions;
  }
  const qOf = (seq) => questions().find((q) => q.seq === seq);
  /* 직전 차수 정보·재촬영 요청은 앱 자료 round 의 평가 종류에만 붙는다 */
  const baseEt = () => etId() === S.ad.round.id.split('-')[0];
  const opt = () => (baseEt() && S.ad.optional) || {};
  const OTHER = { id: 'PL-99', name: '장소 밖 기록(기타)', line: '', order: 999, seqs: [] };
  const places = () => [...S.ad.places].sort((a, b) => a.order - b.order);
  const placeOf = (id) => (id === 'PL-99' ? OTHER : S.ad.places.find((p) => p.id === id)) || OTHER;
  function seqsOf(pl) { if (pl.id === 'PL-99') return []; return curEt().bank === 'custom' ? questions().map((q) => q.seq) : pl.seqs.filter((s) => qOf(s)); }
  const teamColor = (ini) => ((S.ad.team || []).find((t) => t.initials === ini) || {}).color || 'var(--muted)';
  const expired = () => S.ad.expiresAt && new Date() > new Date(S.ad.expiresAt + 'T23:59:59');

  /* ── 기록 조회 ── */
  const live = () => [...S.entries.values()].filter((e) => !e.deleted);
  const inRound = (e) => e.round === roundId();
  const entriesAt = (place, seq) => live().filter((e) => inRound(e) && e.seq === seq && (place == null || e.place === place)).sort((a, b) => (a.at < b.at ? -1 : 1));
  /* D79: 미분류(seq 없음, 아직 정하지 않음)와 문항 외 참고(seq 없음 + outsideQuestion, 맞는 문항 없음으로 확인·점수 제외)를 나눈다.
     예전 기록은 표시가 없으므로 미분류로 남는다 */
  const isOut = (e) => e.seq == null && !!e.outsideQuestion;
  const isUnc = (e) => e.seq == null && !e.outsideQuestion;
  const outAt = (place) => live().filter((e) => inRound(e) && isOut(e) && e.place === place).sort((a, b) => (a.at < b.at ? -1 : 1));
  const seqLabel = (e) => (isOut(e) ? '문항 외 참고' : e.seq == null ? '미분류' : qOf(e.seq) ? '문항 ' + e.seq : '범위 밖 문항 ' + e.seq);
  const markOf = (seq, by = S.by) => S.marks.get(TSF.markId(S.dev, seq, by, roundId()));
  const marked = (m) => m && (m.grade != null || m.na || (m.memo || '').trim() || (m.guideChecks || []).length || m.docsSeen);
  /* 현장 가이드(D80): 앱 자료 guide.items["seq"]. 회사 문항집 평가 종류에만 붙는다 */
  const guideOf = (seq) => (curEt().bank !== 'custom' && S.ad.guide && S.ad.guide.items && S.ad.guide.items[String(seq)]) || null;
  /* 제안 등급: 핵심 볼 것 충족(전부·일부·없음) × 서류 확인 → guide.suggest 표. 판단은 컨설턴트가 한다 */
  function guideSuggest(gd, m) {
    const keys = (gd.checklist || []).filter((c) => c.key);
    const on = new Set((m && m.guideChecks) || []);
    const met = keys.filter((c) => on.has(c.id)).length;
    const keyMet = met === keys.length ? 'all' : met === 0 ? 'none' : 'some';
    const docs = !!(m && m.docsSeen);
    const rule = (gd.suggest || []).find((s) => s.keyMet === keyMet && !!s.docs === docs);
    return { grade: rule ? +rule.grade : null, met, total: keys.length, docs, touched: !!(m && (Array.isArray(m.guideChecks) || m.docsSeen != null)) };
  }
  function doneSeqs(pl) {
    const set = new Set();
    for (const s of seqsOf(pl)) if (live().some((e) => inRound(e) && e.seq === s && e.place === pl.id) || [...S.marks.values()].some((m) => m.round === roundId() && m.seq === s && marked(m))) set.add(s);
    return set;
  }
  const unsentEntries = () => [...S.entries.values()].filter((e) => (e._sentRev || 0) < e.rev);
  const unsentMarks = () => [...S.marks.values()].filter((m) => (m._sentRev || 0) < m.rev);
  const unsentN = () => unsentEntries().length + unsentMarks().length;
  /* 메모리 저장소(IndexedDB 실패): 닫거나 새로 고치면 기록·보내기 이력이 모두 사라진다 */
  const MEM = () => TSF.storageMode === 'memory';
  const memRisk = () => MEM() && S.ad && (unsentN() > 0 || S.sends.some((x) => x.parts.some((p) => !p.shared)));
  const retakeFor = (seq, place) => (baseEt() ? S.ad.retakes || [] : []).find((r) => r.seq === seq && r.place === place);
  const retakeDone = (r) => live().some((e) => e.retakeOf === r.id);

  /* ── 공통 화면 부품 ── */
  function say(who, text, img) {
    return `<div class="say rise"><img src="${img || IMG[who]}" alt=""><div class="bub"><b>${esc(NAMES[who])}</b>${esc(text)}</div></div>`;
  }
  function gchip(g, na) { return na ? '<span class="g gna">해당없음</span>' : g == null ? '' : `<span class="g g${g}">${esc(gradeText(g))}</span>`; }
  /* 저장 직후: 상태 줄을 새로 그리고(D95 ①) 백업할 때가 되었으면 백업 파일을 미리 만든다(D95 ③) */
  function flashSaved() { S.lastSaveAt = isoLocal(); S.pulseAt = Date.now(); updateSaveBar(true); bkSchedule(); }
  function toast(msg, opt = {}) {
    const layer = $('#layer');
    const old = layer.querySelector('.toast'); if (old) old.remove();
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `${opt.img ? `<img src="${opt.img}" alt="">` : ''}<div class="grow">${esc(msg)}</div>${opt.action ? `<button type="button">${esc(opt.action)}</button>` : ''}`;
    if (opt.action) el.querySelector('button').onclick = () => { el.remove(); opt.onAction(); };
    layer.appendChild(el);
    setTimeout(() => el.remove(), opt.ms || 3200);
  }
  function sheet(html, onMount) {
    closeSheet();
    const el = document.createElement('div');
    el.className = 'scrim'; el.id = 'scrim';
    el.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
    el.addEventListener('click', (e) => { if (e.target === el) closeSheet(); });
    $('#layer').appendChild(el);
    if (onMount) onMount(el.firstElementChild);
    return el.firstElementChild;
  }
  function closeSheet() { const s = $('#scrim'); if (s) s.remove(); }
  function confirmSheet(title, body, okText, onOk, danger) {
    const sh = sheet(`<h3>${esc(title)}</h3><p class="muted">${esc(body)}</p><div class="acts"><button class="btn line" data-x>그만두기</button><button class="btn ${danger ? 'danger' : ''}" data-ok>${esc(okText)}</button></div>`);
    sh.querySelector('[data-x]').onclick = closeSheet;
    sh.querySelector('[data-ok]').onclick = () => { closeSheet(); onOk(); };
  }
  /* ② 저장되는 방식으로 다시 열기 안내. 앱 자료 installUrl(선택 키)이 있으면 B안 주소를 함께 보인다 */
  function reopenHtml() {
    const u = S.ad && /^https:\/\//.test(S.ad.installUrl || '') ? S.ad.installUrl : '';
    return `<ol class="steps">${TSF.selfCheck.REOPEN.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>
      ${u ? `<p class="small" style="margin:12px 0 0"><b>설치형(B안) 주소가 있습니다.</b> 이 주소로 열면 기록이 저장됩니다: <a href="${esc(u)}" target="_blank" rel="noopener">${esc(u)}</a></p>` : '<p class="hint">설치형(B안) 주소를 받았다면 그 주소로 여는 것이 가장 안전합니다.</p>'}`;
  }
  /* D95 ② 설치 안내(크롬·삼성 인터넷·사파리). 설치형은 기록을 폰 안에 저장하고 영구 저장을 받기 쉽다 */
  function installHtml() {
    const u = installUrl();
    return `<div class="instUrl"><span>설치 주소</span><b>${esc(u)}</b><button class="btn ghost" data-act="copyUrl">주소 복사</button></div>
      <details class="inst" open><summary>갤럭시 · 크롬</summary><ol class="steps"><li>크롬을 열고 위 주소를 넣습니다</li><li>오른쪽 위 ⋮ 를 누릅니다</li><li>「홈 화면에 추가」 또는 「앱 설치」를 누릅니다</li><li>홈 화면의 TS현장 아이콘으로 엽니다</li></ol></details>
      <details class="inst"><summary>갤럭시 · 삼성 인터넷</summary><ol class="steps"><li>삼성 인터넷을 열고 위 주소를 넣습니다</li><li>주소창의 「설치」 아이콘(아래 화살표가 든 상자)을 누릅니다</li><li>안 보이면 아래 ≡ → 「현재 페이지 추가」 → 「홈 화면」</li><li>홈 화면의 TS현장 아이콘으로 엽니다</li></ol></details>
      <details class="inst"><summary>아이폰 · 사파리</summary><ol class="steps"><li>사파리를 열고 위 주소를 넣습니다</li><li>아래쪽 공유 단추(네모에 위 화살표)를 누릅니다</li><li>「홈 화면에 추가」를 누릅니다</li><li>홈 화면의 TS현장 아이콘으로 엽니다</li></ol></details>
      <p class="hint">설치한 앱에서 메일로 받은 프로젝트 자료(.tspack)를 「프로젝트 불러오기」로 넣으면 시작할 수 있습니다.</p>`;
  }
  /* D95 ② 메모리 저장소(IndexedDB 실패·content:// 파일 등): 새 기록은 시작하지 못하게 막고 설치를 안내한다.
     이미 메모리에 있는 기록은 「지금 바로 보내기·내려받기」만 할 수 있다. 바깥을 눌러도 닫히지 않는다 */
  function memDialog() {
    if ($('#memDlg')) return;
    closeSheet();
    const el = document.createElement('div');
    el.className = 'scrim'; el.id = 'scrim';
    const has = S.ad && memRisk();
    el.innerHTML = `<div class="sheet memdlg" id="memDlg" role="alertdialog" aria-modal="true" aria-labelledby="memDlgT">
      <h3 id="memDlgT">여기서는 기록을 남길 수 없습니다</h3>
      <p class="lead">이렇게 연 앱은 기록을 폰에 저장하지 못합니다. 닫으면 모두 사라지므로 새 기록은 막았습니다. 아래 주소로 앱을 설치해 주세요.</p>
      ${has ? `<div class="band coral" style="display:block"><b>보내지 않은 기록 ${unsentN()}건이 이 화면에만 있습니다.</b> 닫기 전에 「지금 바로 보내기」로 메일 보내기나 내려받기를 마쳐 주세요.</div><button class="btn wide big danger" data-m="send">지금 바로 보내기</button>` : ''}
      ${installHtml()}
      <details class="inst"><summary>메일로 받은 앱 파일(.html)로 여는 경우</summary>${reopenHtml()}</details>
      <div class="acts1"><button class="btn line" data-m="close">닫고 둘러보기(기록 안 됨)</button></div></div>`;
    $('#layer').appendChild(el);
    el.querySelectorAll('[data-m]').forEach((b) => (b.onclick = () => { el.remove(); if (b.dataset.m === 'send') { S.built = null; go('s7'); } }));
  }
  const urlCache = new Map();
  function thumbUrl(mid) {
    if (urlCache.has(mid)) return urlCache.get(mid);
    const m = S.media.get(mid);
    const b = m && (m.thumb || (m.blob && /^image\/(jpeg|png|webp)/.test(m.mime) ? m.blob : null));
    const u = b ? URL.createObjectURL(b) : '';
    urlCache.set(mid, u);
    return u;
  }
  function thumbHtml(e) {
    const mid = e.media && e.media[0] && e.media[0].id;
    const u = mid ? thumbUrl(mid) : '';
    if (u) return `<img src="${u}" alt="" loading="lazy">`;
    return e.kind === 'audio' ? ICO.mic : e.kind === 'video' ? ICO.video : e.kind === 'memo' ? ICO.memo : ICO.camera;
  }

  /* ── 저장(5-6): entries·media 를 한 트랜잭션으로 ── */
  async function log(act, id, extra) { try { await S.db.tx(['log'], (t) => t.log.add(Object.assign({ at: isoLocal(), act, id, by: S.by, device: S.dev }, extra || {}))); } catch (e) { /* 기록 실패는 무시 */ } }
  function blocked() {
    if (MEM()) { memDialog(); return true; } // D95 ②: 메모리 저장소에서는 새 기록·등급·고치기를 받지 않는다
    if (expired()) { toast('이 현장 앱은 만료되었습니다. 남은 기록을 보내고 정리해 주세요.', { img: IMG.warning }); return true; }
    return false;
  }
  async function addEntry(o) {
    if (blocked()) return null;
    const files = o.files || [];
    const prepared = [];
    for (const f of files) {
      const mime = f.blob.type || f.mime || 'application/octet-stream';
      let info = { w: null, h: null, thumb: null, durationSec: null };
      if (mime.startsWith('image/')) info = await TSF.photoInfo(f.blob);
      else if (mime.startsWith('video/')) info = await TSF.videoInfo(f.blob);
      else if (mime.startsWith('audio/')) info.durationSec = f.durationSec || (await TSF.audioDuration(f.blob));
      if (/heic|heif/i.test(mime) && !S.heicWarned) { S.heicWarned = true; S.db.setMeta('heicWarned', true); setTimeout(() => toast('고효율(HEIC) 사진으로 저장되었습니다. 카메라 설정에서 고효율 사진을 꺼 주세요.', { img: IMG.warning, ms: 6000 }), 1500); }
      prepared.push({ f, mime, info, sha256: await TSF.sha256Hex(f.blob) });
    }
    const now = isoLocal();
    const hold = {};
    try {
      await S.db.tx(['meta', 'entries', 'media', 'log'], (t) => {
        const r = t.meta.get('seq');
        r.onsuccess = () => {
          const n = ((r.result && r.result.value) || 0) + 1;
          t.meta.put({ key: 'seq', value: n });
          const id = TSF.entryId(S.dev, n);
          const media = prepared.map((p, i) => ({ id: `${id}-m${i + 1}`, name: p.f.name || `${id}-m${i + 1}`, mime: p.mime, size: p.f.blob.size, sha256: p.sha256, w: p.info.w, h: p.info.h, takenAt: p.f.takenAt || now, source: p.f.source || 'camera', pii: !!o.pii }));
          const dur = o.durationSec != null ? o.durationSec : (prepared[0] && prepared[0].info.durationSec) || null;
          const isAudio = o.kind === 'audio';
          const transcript = isAudio && o.transcript ? o.transcript : null;
          const e = {
            id, type: 'entry', project: S.ad.project.id, round: roundId(), evalType: etId(), place: o.place || 'PL-99', seq: o.seq == null ? null : o.seq, ...(o.outside && o.seq == null ? { outsideQuestion: true } : {}),
            bankVersion: S.ad.bank.bankVersion, by: S.by, device: S.dev, at: now, kind: o.kind, memo: (o.memo || '').slice(0, 2000), tags: TSF.tagsOf(o.memo),
            media, durationSec: dur, transcript, transcriptStatus: isAudio ? (transcript ? 'draft' : 'waiting') : 'none', transcriptBy: transcript ? 'tool:keyboard' : null,
            retakeOf: o.retakeOf || null, rev: 1, updatedAt: now, deleted: false, _sentRev: 0,
          };
          t.entries.put(e);
          prepared.forEach((p, i) => t.media.put({ id: media[i].id, entryId: id, blob: p.f.blob, thumb: p.info.thumb, sha256: p.sha256, size: p.f.blob.size, mime: p.mime, sentIn: null, sentVariant: null, purged: false }));
          t.log.add({ at: now, act: 'entry.add', id, by: S.by, device: S.dev, kind: o.kind });
          hold.e = e;
          prepared.forEach((p, i) => (hold['m' + i] = { id: media[i].id, entryId: id, blob: p.f.blob, thumb: p.info.thumb, sha256: p.sha256, size: p.f.blob.size, mime: p.mime, sentIn: null, sentVariant: null, purged: false }));
        };
      });
    } catch (err) {
      toast(o.kind === 'memo' ? '메모를 저장하지 못했습니다. 저장 공간을 정리한 뒤 다시 적어 주세요.' : `${KIND[o.kind] || '기록'}을 저장하지 못했습니다. 저장 공간을 정리한 뒤 다시 찍어 주세요.`, { img: IMG.warning, ms: 6000 });
      return null;
    }
    S.entries.set(hold.e.id, hold.e);
    prepared.forEach((_, i) => S.media.set(hold['m' + i].id, hold['m' + i]));
    if (hold.e.seq != null) await relinkMark(hold.e.seq);
    flashSaved(); refreshFree();
    return hold.e;
  }
  async function updateEntry(e, patch, act = 'entry.edit') {
    if (MEM()) { memDialog(); return e; }
    const n = Object.assign({}, e, patch, { rev: e.rev + 1, updatedAt: isoLocal() });
    if ('memo' in patch) n.tags = TSF.tagsOf(n.memo);
    if (n.seq != null && n.outsideQuestion) n.outsideQuestion = false; // 문항을 붙이면 문항 외 참고에서 빠진다(D79)
    if (!n.outsideQuestion && n.outsideReason) n.outsideReason = null;
    await S.db.tx(['entries', 'log'], (t) => { t.entries.put(n); t.log.add({ at: n.updatedAt, act, id: n.id, by: S.by, device: S.dev }); });
    S.entries.set(n.id, n);
    const seqs = new Set([e.seq, n.seq].filter((s) => s != null));
    for (const s of seqs) await relinkMark(s);
    flashSaved();
    return n;
  }
  /* 문항 표시(field mark): 기록자·차수·문항마다 1건(5-4) */
  async function setMark(seq, patch) {
    if (blocked()) return null;
    const id = TSF.markId(S.dev, seq, S.by, roundId());
    const old = S.marks.get(id);
    const now = isoLocal();
    const m = Object.assign(old ? Object.assign({}, old) : { id, type: 'mark', project: S.ad.project.id, round: roundId(), evalType: etId(), seq, bankVersion: S.ad.bank.bankVersion, by: S.by, device: S.dev, grade: null, na: false, naReason: '', memo: '', entryIds: [], rev: 0, _sentRev: 0 }, patch);
    if (m.na) m.grade = null;
    m.entryIds = entriesAt(null, seq).filter((e) => e.by === S.by).map((e) => e.id);
    m.rev = (old ? old.rev : 0) + 1; m.updatedAt = now;
    await S.db.tx(['marks', 'log'], (t) => { t.marks.put(m); t.log.add({ at: now, act: 'mark.set', id, by: S.by, device: S.dev }); });
    S.marks.set(id, m);
    flashSaved();
    return m;
  }
  async function relinkMark(seq) {
    const m = markOf(seq);
    if (!m) return;
    const ids = entriesAt(null, seq).filter((e) => e.by === S.by).map((e) => e.id);
    if (ids.join() !== (m.entryIds || []).join()) await setMark(seq, {});
  }

  /* ── 열기·불러오기 ── */
  async function boot() {
    if (!SINGLE && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});
    const emb = readEmbedded();
    if (emb) return openWithData(emb);
    const list = await TSF.listProjects();
    let pid = pref('project');
    if (!list.includes(pid)) pid = list[0];
    if (pid) return openProject(pid);
    S.view = 'welcome'; render();
  }
  async function openWithData(d, announce) {
    if (S.db && S.db.pid !== d.project.id) S.db.idb.close();
    S.db = S.db && S.db.pid === d.project.id ? S.db : await TSF.openProject(d.project.id);
    const have = await S.db.get('appData', d.dataRev);
    if (d.seed) { S.seed = d.seed; d = Object.assign({}, d); delete d.seed; } // 시연판: 처음 기록 세트는 DB에 따로 넣는다
    if (!have) {
      await S.db.put('appData', d); await log('appData', String(d.dataRev));
      if (announce) toast(`${d.project.codeName} 자료(${d.round.label}, 자료 번호 ${d.dataRev})를 불러왔습니다. 기존 기록은 그대로 둡니다.`, { img: IMG.approve, ms: 4500 });
    } else if (announce) toast('이미 불러온 자료입니다. 그대로 엽니다.');
    return openProject(d.project.id);
  }
  async function openProject(pid) {
    if (!S.db || S.db.pid !== pid) { if (S.db) S.db.idb.close(); S.db = await TSF.openProject(pid); }
    const all = await S.db.all('appData');
    if (!all.length) { S.view = 'welcome'; render(); return; }
    S.ad = all.sort((a, b) => b.dataRev - a.dataRev)[0];
    let dev = await S.db.meta('device');
    if (!dev) {
      dev = { id: pref('device') || TSF.randomId(4), alias: pref('alias') || '' };
      await S.db.setMeta('device', dev); pref('device', dev.id);
    }
    S.dev = dev.id; S.alias = dev.alias || '';
    const seeded = S.seed ? await importSeed(S.seed) : false;
    S.seed = null;
    const rec = (await S.db.meta('recorders')) || { list: (S.ad.team || []).map((t) => t.initials), cur: null };
    S.recs = rec.list; S.by = rec.cur;
    S.sc = await S.db.meta('selfCheck', null);
    S.settings = (await S.db.meta('settings')) || {};
    S.heicWarned = await S.db.meta('heicWarned', false);
    S.entries = new Map((await S.db.all('entries')).map((e) => [e.id, e]));
    S.marks = new Map((await S.db.all('marks')).map((m) => [m.id, m]));
    S.media = new Map((await S.db.all('media')).map((m) => [m.id, m]));
    S.sends = (await S.db.all('sends')).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    pref('project', pid);
    document.title = SINGLE ? `TS현장 ${S.ad.project.codeName}` : 'TS현장';
    S.bkCfg = Object.assign({ every: 10, at: null, lastId: null, mediaIds: [], n: 0 }, await S.db.meta('backup', {}));
    S.bk = null;
    S.lastSaveAt = [...S.entries.values(), ...S.marks.values()].map((x) => x.updatedAt).sort().pop() || null;
    const lock = await S.db.meta('lock', null);
    S.locked = !!lock;
    S.view = (S.sc || seeded) && S.by ? 's1' : 's0';
    render(); refreshFree();
    if (!S.sc) runSelfCheck();
    if (MEM()) memDialog();
    else protectInit();
  }
  /* 시연판 seed(ts-field-seed/1): 프로젝트 DB가 비어 있을 때 한 번만, 사용자가 만든 기록과 같은 형식으로 넣는다.
     ago 는 지금부터 몇 분 전. 보낸 묶음 1건(사내 반입 확인됨) 이전 기록은 보냄, 이후 기록은 보내지 않음으로 둔다 */
  async function importSeed(sd) {
    if ((await S.db.meta('seeded', false)) || (await S.db.all('entries')).length || (await S.db.all('marks')).length) return false;
    const now = Date.now(), at = (ago) => isoLocal(new Date(now - ago * 60000));
    const by0 = sd.recorder || (S.ad.team[0] || {}).initials;
    const rid = S.ad.round.id, et = rid.split('-')[0];
    const send = sd.send || null, sendAgo = send ? send.ago : -1;
    const bid = send ? TSF.bundleId(S.dev, 1) : null;
    const bytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const entries = [], media = [], logs = [];
    const list = [...sd.entries].sort((a, b) => b.ago - a.ago);
    let n = 0;
    for (const x of list) {
      n++;
      const id = TSF.entryId(S.dev, n), when = at(x.ago), by = x.by || by0, sent = x.ago > sendAgo;
      const ms = [];
      if (x.photo && sd.files && sd.files[x.photo]) {
        const blob = new Blob([bytes(sd.files[x.photo])], { type: 'image/jpeg' });
        const info = await TSF.photoInfo(blob), sha = await TSF.sha256Hex(blob), mid = `${id}-m1`;
        const name = `${TSF.stamp(new Date(now - x.ago * 60000)).replace('-', '_')}.jpg`;
        ms.push({ id: mid, name, mime: 'image/jpeg', size: blob.size, sha256: sha, w: info.w, h: info.h, takenAt: when, source: 'camera', pii: false });
        media.push({ id: mid, entryId: id, blob, thumb: info.thumb, sha256: sha, size: blob.size, mime: 'image/jpeg', sentIn: sent ? bid : null, sentVariant: sent ? 'original' : null, purged: false });
      }
      const e = { id, type: 'entry', project: S.ad.project.id, round: rid, evalType: et, place: x.place || 'PL-99', seq: x.seq == null ? null : x.seq, ...(x.outside && x.seq == null ? { outsideQuestion: true, outsideReason: x.outsideReason || null } : {}),
        bankVersion: S.ad.bank.bankVersion, by, device: S.dev, at: when, kind: x.kind, memo: x.memo || '', tags: TSF.tagsOf(x.memo),
        media: ms, durationSec: null, transcript: null, transcriptStatus: 'none', transcriptBy: null,
        retakeOf: x.retakeOf || null, rev: 1, updatedAt: when, deleted: false, _sentRev: sent ? 1 : 0 };
      logs.push({ at: when, act: 'entry.add', id, by, device: S.dev, kind: x.kind });
      if (x.editMemo) { e.memo = x.editMemo; e.tags = TSF.tagsOf(x.editMemo); e.rev = 2; e.updatedAt = at(x.editAgo); logs.push({ at: e.updatedAt, act: 'entry.edit', id, by, device: S.dev }); }
      entries.push(e);
    }
    const marks = (sd.marks || []).map((x) => {
      const by = x.by || by0, when = at(x.ago);
      const ids = entries.filter((e) => e.seq === x.seq && e.by === by).map((e) => e.id);
      logs.push({ at: when, act: 'mark.set', id: TSF.markId(S.dev, x.seq, by, rid), by, device: S.dev });
      return { id: TSF.markId(S.dev, x.seq, by, rid), type: 'mark', project: S.ad.project.id, round: rid, evalType: et, seq: x.seq, bankVersion: S.ad.bank.bankVersion, by, device: S.dev,
        grade: x.na ? null : x.grade == null ? null : x.grade, na: !!x.na, naReason: x.naReason || '', memo: x.memo || '', entryIds: ids, rev: 1, updatedAt: when, _sentRev: x.ago > sendAgo ? 1 : 0 };
    });
    let sendRec = null;
    if (send) {
      const sentMedia = media.filter((m) => m.sentIn), sentE = entries.filter((e) => e._sentRev), created = new Date(now - send.ago * 60000);
      const size = sentMedia.reduce((a, m) => a + m.size, 0) + sentMedia.reduce((a, m) => a + ((m.thumb && m.thumb.size) || 0), 0) + 24576;
      const sha = await TSF.sha256Hex(`${bid}:${size}`);
      const code = send.receiptCode || (await TSF.receiptOf(bid, [sha]));
      sendRec = { bundleId: bid, createdAt: isoLocal(created), mode: send.mode || 'daily', light: false, receiptCode: code, encrypted: false,
        confirmed: send.confirmedAgo != null, confirmedAt: send.confirmedAgo != null ? at(send.confirmedAgo) : null,
        counts: { entries: sentE.length, marks: marks.filter((m) => m._sentRev).length, deleted: 0, mediaInBundle: sentMedia.length }, mediaIds: sentMedia.map((m) => m.id),
        parts: [{ n: 1, name: `TS현장_${String(S.ad.project.codeName).replace(/\s+/g, '')}_${by0}_${TSF.stamp(created)}_1of1.zip`, size, sha256: sha, shared: 'share', blob: null }] };
      logs.push({ at: sendRec.createdAt, act: 'bundle', id: bid, by: by0, device: S.dev, parts: 1 });
      if (sendRec.confirmed) logs.push({ at: sendRec.confirmedAt, act: 'confirm', id: bid, by: by0, device: S.dev });
    }
    logs.sort((a, b) => (a.at < b.at ? -1 : 1));
    const team = (S.ad.team || []).map((t) => t.initials);
    await S.db.tx(['meta', 'entries', 'marks', 'media', 'sends', 'log'], (t) => {
      entries.forEach((e) => t.entries.put(e)); marks.forEach((m) => t.marks.put(m)); media.forEach((m) => t.media.put(m));
      if (sendRec) { t.sends.put(sendRec); t.meta.put({ key: 'bundleSeq', value: 1 }); }
      t.meta.put({ key: 'seq', value: n });
      t.meta.put({ key: 'recorders', value: { list: team.includes(by0) ? team : team.concat(by0), cur: by0 } });
      t.meta.put({ key: 'seeded', value: isoLocal() });
      logs.forEach((l) => t.log.add(l));
    });
    return true;
  }
  async function importPack(file) {
    try {
      const d = JSON.parse(await file.text());
      if (!validAppData(d)) throw new Error('format');
      await openWithData(d, true);
    } catch (e) {
      const nm = (file && file.name) || '';
      const why = e && e.message === 'format' ? '' : ' (' + ((e && e.message) || '읽기 실패') + ')';
      toast('「' + nm + '」은(는) 불러올 수 없습니다. 사내에서 받은 프로젝트 자료(.tspack)인지 확인해 주세요.' + why, { img: IMG.warning, ms: 7000 });
    }
  }
  async function refreshFree() {
    const now = Date.now();
    if (refreshFree.t && now - refreshFree.t < 20000) return;
    refreshFree.t = now;
    try { const e = await navigator.storage.estimate(); S.free = (e.quota || 0) - (e.usage || 0); } catch (e) { S.free = null; }
  }
  const lowSpace = () => S.free != null && S.free < 500 * 1048576;

  /* ── D95 기록 보호 ── */
  /* 영구 저장(persist) 여부를 확인하고, 허용되지 않았으면 한 번 더 요청한다(설치형은 대개 바로 허용) */
  async function protectInit() {
    try {
      let p = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : false;
      if (!p && navigator.storage && navigator.storage.persist) p = await navigator.storage.persist();
      S.persisted = !!p;
    } catch (e) { S.persisted = false; }
    updateSaveBar(); bkSchedule();
  }
  function saveFile(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  }
  /* ③ 자동 백업. 모바일 브라우저는 누르지 않은 내려받기를 막거나 매번 묻는다. 그래서 백업할 때가 되면(백업 뒤 기록 n건)
     파일을 뒤에서 미리 만들어 두고, 상태 줄의 큰 「백업 파일 저장」 단추를 한 번 누르면 그 누름 안에서 바로 내려받는다.
     형식은 보내기 묶음(ts-field-bundle/1, mode "backup")과 같아 사내 웹 반입·앱 「백업 불러오기」 모두 된다.
     사진·동영상은 앞선 백업에 없던 것만 담고, 기록·등급(records.json)은 매번 전부 담는다. */
  const bkSig = () => `${S.lastSaveAt}|${bkPending()}|${S.entries.size}|${S.marks.size}|${S.media.size}`;
  function bkSchedule() {
    clearTimeout(bkSchedule.t);
    if (!bkDue()) return;
    bkSchedule.t = setTimeout(() => bkBuild(), 1500);
  }
  async function bkBuild() {
    if (S.bkBusy || MEM() || !S.db || !S.ad) return S.bk;
    const sig = bkSig();
    if (S.bk && S.bk.sig === sig) return S.bk;
    S.bkBusy = true; updateSaveBar();
    try {
      const done = new Set(S.bkCfg.mediaIds || []);
      const ms = [...S.media.values()].filter((m) => m.blob && !m.purged && !done.has(m.id) && !(S.entries.get(m.entryId) || {}).deleted);
      const media = ms.map((m) => {
        const e = S.entries.get(m.entryId), meta = (e && e.media.find((x) => x.id === m.id)) || {};
        return { id: m.id, name: meta.name || m.id, mime: m.mime, size: m.blob.size, sha256: m.sha256, variant: 'original', blob: m.blob };
      });
      const seq = ((await S.db.meta('bundleSeq', 0)) || 0) + 1, at = isoLocal();
      const r = await TSF.buildBundle({
        appData: S.ad, device: { id: S.dev, alias: S.alias }, by: S.by || S.recs[0] || 'NA', selfCheck: TSF.selfCheck.toManifest(S.sc), mode: 'backup', bundleSeq: seq,
        prevBundleId: S.bkCfg.lastId || null, entries: [...S.entries.values()], marks: [...S.marks.values()], media, thumbs: ms.filter((m) => m.thumb).map((m) => ({ id: m.id, blob: m.thumb })), log: await S.db.all('log'),
      });
      S.bk = { sig, seq, at, bundleId: r.bundleId, mediaIds: media.map((m) => m.id), entries: live().length, photos: photoN(),
        parts: r.parts.map((p) => ({ n: p.n, name: p.name.replace(/^TS현장_/, 'TS현장백업_'), blob: p.blob, size: p.size, saved: false })) };
    } catch (e) { console.error(e); S.bk = null; }
    finally { S.bkBusy = false; updateSaveBar(); if (S.bk && S.bk.sig !== bkSig()) bkSchedule(); }
    return S.bk;
  }
  /* 상태 줄·설정의 「백업 파일 저장」. 미리 만든 파일이 지금 기록과 같고 한 개면 누른 그 자리에서 바로 내려받는다 */
  async function saveBackup() {
    if (MEM()) { memDialog(); return; }
    if (S.bk && S.bk.sig === bkSig() && S.bk.parts.length === 1) { const bk = S.bk; saveFile(bk.parts[0].blob, bk.parts[0].name); bk.parts[0].saved = true; await bkCommit(bk); return; }
    S.bk = null;
    const bk = await bkBuild();
    if (!bk) { toast('백업 파일을 만들지 못했습니다. 기록은 폰에 그대로 있습니다. 저장 공간을 확인한 뒤 다시 눌러 주세요.', { img: IMG.warning, ms: 6000 }); return; }
    backupSheet(bk);
  }
  function backupSheet(bk) {
    const m = bk.parts.length;
    const sh = sheet(`<h3>백업 파일 저장</h3><p style="margin:0 0 8px">기록 ${bk.entries}건 · 사진 ${bk.photos}장을 담았습니다(이번에 새로 담은 사진·동영상 ${bk.mediaIds.length}개). ${m > 1 ? `파일이 ${m}개라 하나씩 눌러 저장합니다.` : '아래 단추를 누르면 저장됩니다.'}</p>
      ${bk.parts.map((p) => `<div class="part"><div><b>백업 파일 ${p.n} / ${m}</b><small>${esc(p.name)} · ${fmtMB(p.size)}</small></div><button class="btn" data-bp="${p.n}">${p.saved ? '저장함' : `저장 ${p.n}/${m}`}</button></div>`).join('')}
      <p class="hint">「내 파일 → 다운로드」에 저장됩니다. 폰을 잃거나 앱이 지워지면 새로 설치한 앱의 「설정 → 백업 불러오기」에서 이 파일들을 고르면 되살아납니다. 백업 파일은 지우지 말고 모두 두세요.</p>
      <div class="acts"><button class="btn line" data-x>나중에</button></div>`);
    sh.querySelector('[data-x]').onclick = closeSheet;
    sh.querySelectorAll('[data-bp]').forEach((b) => (b.onclick = async () => {
      const p = bk.parts.find((x) => x.n === +b.dataset.bp);
      saveFile(p.blob, p.name); p.saved = true; b.textContent = '저장함'; b.classList.add('ghost');
      if (bk.parts.every((x) => x.saved)) { closeSheet(); await bkCommit(bk); }
    }));
  }
  async function bkCommit(bk) {
    const cfg = Object.assign({}, S.bkCfg, { at: bk.at, lastId: bk.bundleId, mediaIds: [...new Set([...(S.bkCfg.mediaIds || []), ...bk.mediaIds])], n: (S.bkCfg.n || 0) + 1, lastName: bk.parts[0].name });
    const seq = Math.max((await S.db.meta('bundleSeq', 0)) || 0, bk.seq);
    await S.db.tx(['meta', 'log'], (t) => { t.meta.put({ key: 'backup', value: cfg }); t.meta.put({ key: 'bundleSeq', value: seq }); t.log.add({ at: isoLocal(), act: 'backup', id: bk.bundleId, by: S.by, device: S.dev, parts: bk.parts.length }); });
    S.bkCfg = cfg; S.bk = null;
    render();
    toast('백업 파일을 저장했습니다. 「내 파일 → 다운로드」의 TS현장백업 파일은 지우지 마세요.', { img: IMG.approve, ms: 5000 });
  }
  /* 상태 줄을 누르면: 저장 방식·영구 저장·백업 안내 */
  function protectSheet() {
    const p = S.persisted, c = S.bkCfg;
    const sh = sheet(`<h3>기록 보관 상태</h3>
      <p class="lead" style="margin:0 0 10px"><b>입력은 누르는 즉시 이 폰 안에 저장됩니다.</b> 인터넷이 없어도, 앱이 꺼져도 남아 있습니다.</p>
      <p style="margin:0 0 10px">기록 ${live().length}건 · 사진 ${photoN()}장 · 마지막 저장 ${esc(ago(S.lastSaveAt))}</p>
      ${p ? '<div class="band blue">영구 저장이 허용되었습니다. 폰 공간이 부족해도 브라우저가 기록을 지우지 않습니다.</div>'
        : `<div class="band coral" style="display:block"><b>영구 저장이 허용되지 않았습니다.</b> 폰 공간이 부족하면 브라우저가 기록을 지울 수 있습니다. 홈 화면에 설치하면 대개 허용됩니다. 그 전까지는 백업 파일을 자주 저장하고 매일 보내기를 해 주세요.</div>${SINGLE ? installHtml() : `<details class="inst"><summary>설치하는 방법</summary>${installHtml()}</details>`}`}
      <h4 style="margin:14px 0 4px">백업 파일</h4>
      <p class="small" style="margin:0">마지막 백업 ${esc(ago(c.at))} · 백업 뒤 기록 ${bkPending()}건 · ${c.every ? `${c.every}건마다 알림` : '알림 꺼짐'}</p>
      <div class="acts"><button class="btn line" data-act="pickBackup">백업 불러오기</button><button class="btn" data-act="saveBackup">백업 파일 저장</button></div>`);
    sh.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => closeSheet()));
  }
  /* 백업 불러오기: 백업 파일(또는 보내기 조각)을 골라 기록·사진을 되살린다. 같은 기록은 rev 가 큰 것을 남긴다 */
  async function restoreFiles(files) {
    toast('백업 파일을 읽는 중입니다.', { ms: 8000 });
    let res;
    try { res = await TSF.readBundles(files); } catch (e) { res = { bundles: [], errors: [String(e && e.message)] }; }
    const mine = res.bundles.filter((b) => b.project === S.ad.project.id);
    if (!mine.length) { toast(res.bundles.length ? '다른 프로젝트의 백업 파일입니다. 이 프로젝트의 TS현장백업 파일을 골라 주세요.' : `백업 파일을 읽지 못했습니다. ${res.errors[0] || ''}`, { img: IMG.warning, ms: 7000 }); return; }
    const devs = new Set(mine.map((b) => b.device));
    if (devs.size > 1) { toast('여러 폰의 백업이 섞여 있습니다. 한 폰에서 만든 백업 파일만 골라 주세요.', { img: IMG.warning, ms: 7000 }); return; }
    const dev = mine[0].device;
    if ([...S.entries.values(), ...S.marks.values()].some((x) => x.device !== dev)) { toast('이 폰에 이미 다른 기록이 있어 백업을 합칠 수 없습니다. 새로 설치한 앱에서는 기록을 남기기 전에 백업을 불러와 주세요.', { img: IMG.warning, ms: 8000 }); return; }
    const E = new Map(), M = new Map(), media = new Map(), thumbs = new Map();
    for (const b of mine) {
      const sent = b.mode !== 'backup', orig = new Set((b.manifest.media || []).filter((d) => d.variant === 'original').map((d) => d.id));
      for (const e of b.records.entries || []) if (!E.has(e.id) || E.get(e.id).rev <= e.rev) E.set(e.id, Object.assign({}, e, { _sentRev: sent ? e.rev : 0 }));
      for (const m of b.records.marks || []) if (!M.has(m.id) || M.get(m.id).rev <= m.rev) M.set(m.id, Object.assign({}, m, { _sentRev: sent ? m.rev : 0 }));
      b.media.forEach((blob, id) => { if (orig.has(id)) media.set(id, { blob, bid: sent ? b.bundleId : null }); });
      b.thumbs.forEach((blob, id) => thumbs.set(id, blob));
    }
    const ref = new Map();
    E.forEach((e) => (e.media || []).forEach((mm) => ref.set(mm.id, Object.assign({ entryId: e.id }, mm))));
    const missing = [...ref.keys()].filter((id) => !media.has(id) && !(S.media.get(id) || {}).blob).length;
    const last = mine[mine.length - 1];
    confirmSheet('백업 불러오기', `${hm(last.createdAt)} 백업에서 기록 ${[...E.values()].filter((e) => !e.deleted).length}건 · 등급·메모 ${M.size}건 · 사진·동영상 ${media.size}개를 이 폰에 되살립니다. 이 폰에 같은 기록이 있으면 더 새것을 남깁니다.${missing ? ` 사진·동영상 ${missing}개는 고른 파일에 없습니다. 앞선 백업 파일도 함께 고르면 되살아납니다.` : ''}`, '되살리기', () => restoreApply({ mine, dev, E, M, media, thumbs, ref }));
  }
  async function restoreApply({ mine, dev, E, M, media, thumbs, ref }) {
    try {
      const puts = { e: [], m: [], md: [] };
      E.forEach((e) => { const l = S.entries.get(e.id); if (!l || l.rev < e.rev) puts.e.push(e); });
      M.forEach((m) => { const l = S.marks.get(m.id); if (!l || l.rev < m.rev) puts.m.push(m); });
      for (const [id, r] of ref) {
        const l = S.media.get(id), x = media.get(id), th = thumbs.get(id);
        if (l && (l.blob || !x)) continue;
        const blob = x ? new Blob([x.blob], { type: r.mime }) : null;
        let thumb = th ? new Blob([th], { type: 'image/jpeg' }) : (l && l.thumb) || null;
        if (!thumb && blob && (r.mime || '').startsWith('image/')) { try { thumb = (await TSF.photoInfo(blob)).thumb; } catch (e) { thumb = null; } }
        if (!blob && !thumb) continue;
        puts.md.push({ id, entryId: r.entryId, blob, thumb, sha256: r.sha256, size: r.size, mime: r.mime, sentIn: x && x.bid, sentVariant: x && x.bid ? 'original' : null, purged: !blob });
      }
      const num = (id) => +(String(id).split('-')[2] || 0);
      const seq = Math.max((await S.db.meta('seq', 0)) || 0, ...[...E.keys()].map(num));
      const bseq = Math.max((await S.db.meta('bundleSeq', 0)) || 0, ...mine.map((b) => num(b.bundleId)));
      const bks = mine.filter((b) => b.mode === 'backup');
      const cfg = bks.length ? Object.assign({}, S.bkCfg, { at: bks[bks.length - 1].createdAt, lastId: bks[bks.length - 1].bundleId, mediaIds: [...new Set([...(S.bkCfg.mediaIds || []), ...bks.flatMap((b) => [...b.media.keys()])])] }) : S.bkCfg;
      const recs = [...new Set([...S.recs, ...[...E.values(), ...M.values()].map((x) => x.by)])];
      await S.db.tx(['meta', 'entries', 'marks', 'media', 'log'], (t) => {
        puts.e.forEach((e) => t.entries.put(e)); puts.m.forEach((m) => t.marks.put(m)); puts.md.forEach((m) => t.media.put(m));
        t.meta.put({ key: 'seq', value: seq }); t.meta.put({ key: 'bundleSeq', value: bseq }); t.meta.put({ key: 'backup', value: cfg });
        t.meta.put({ key: 'device', value: { id: dev, alias: S.alias } });
        t.meta.put({ key: 'recorders', value: { list: recs, cur: S.by || recs[0] || null } });
        t.log.add({ at: isoLocal(), act: 'restore', id: mine.map((b) => b.bundleId).join(','), by: S.by, device: dev, entries: puts.e.length, media: puts.md.length });
      });
      pref('device', dev);
      await openProject(S.ad.project.id);
      go('s1');
      toast(`백업을 되살렸습니다. 기록 ${puts.e.length}건 · 등급·메모 ${puts.m.length}건 · 사진·동영상 ${puts.md.filter((m) => m.blob).length}개.`, { img: IMG.approve, ms: 6000 });
    } catch (e) {
      console.error(e);
      toast('백업을 되살리지 못했습니다. 기존 기록은 그대로입니다. 저장 공간을 확인한 뒤 다시 해 주세요.', { img: IMG.warning, ms: 7000 });
    }
  }

  /* ── 자가 진단(S0, S9) ── */
  async function runSelfCheck() {
    const prev = S.sc || {};
    const r = await TSF.selfCheck.auto();
    if (prev.C4 && prev.C4.s !== 'todo') r.C4 = prev.C4;
    S.sc = r; S.scAt = isoLocal();
    if (S.db) await S.db.setMeta('selfCheck', r);
    render();
  }
  async function saveSc() { if (S.db) await S.db.setMeta('selfCheck', S.sc); render(); }

  /* ── 화면 그리기 ── */
  function layout() { const w = innerWidth; return w >= 1024 ? 'three' : w >= 600 ? 'two' : 'phone'; }
  const WORK = ['s2', 's3', 's4'];
  function go(view, o = {}) {
    if (o.place !== undefined) S.place = o.place;
    if (o.seq !== undefined) S.seq = o.seq;
    if (view !== 's6') S.pick.clear();
    S.prevView = S.view; S.view = view; render(true); scrollTo(0, 0);
  }
  function render(enter) {
    const main = $('#main'), top = $('#top'), tabs = $('#tabs');
    const v = S.view;
    S.lastLayout = layout();
    const wide = WORK.includes(v) && S.lastLayout !== 'phone' && S.ad;
    main.className = (wide ? 'wide ' : '') + (enter ? 'enter' : '');
    top.innerHTML = (S.ad && !['welcome', 'boot'].includes(v) ? topHtml() : `<div class="home"><img src="${IMG.icon}" alt=""><div><b>TS현장</b><small>보안컨설팅 현장 기록</small></div></div>`) + memBandHtml();
    top.classList.toggle('wrap', MEM() || !!S.ad);
    const showTabs = S.ad && !['welcome', 'boot', 's0'].includes(v);
    tabs.hidden = !showTabs;
    if (showTabs) tabs.innerHTML = tabsHtml();
    const fab = $('#fab'); if (fab) fab.remove();
    if (showTabs) $('#app').insertAdjacentHTML('beforeend', `<button class="fab" id="fab" data-act="shoot" data-long="shootMenu" aria-label="찍기">${ICO.camera}찍기</button>`);
    const R = { welcome: vWelcome, s0: vS0, s1: vS1, s2: vWork, s3: vWork, s4: vWork, s6: vS6, s7: vS7, s8: vS7, s9: vS9 }[v];
    main.innerHTML = R ? R() : '';
    if (S.locked) lockScreen();
    afterRender(enter);
  }
  function afterRender(enter) {
    $('#main').querySelectorAll('textarea[data-draft]').forEach(async (ta) => {
      const d = await S.db.get('draft', ta.dataset.draft);
      if (d && d.value !== ta.value) ta.value = d.value;
    });
    if (enter && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      $('#main').querySelectorAll('[data-count]').forEach((el) => {
        const end = +el.dataset.count; let t0 = null;
        const step = (ts) => { t0 = t0 || ts; const k = Math.min(1, (ts - t0) / 800); el.textContent = Math.round(end * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); };
        requestAnimationFrame(step);
      });
    }
  }
  function topHtml() {
    const et = curEt();
    return `<button class="home" data-act="home"><img src="${IMG.icon}" alt=""><div><b>${esc(S.ad.project.codeName)}</b><small>${esc(S.ad.round.label)} · ${esc(et.name)}${MEM() ? '' : ' · 인터넷 없이 저장'}</small></div></button>
      ${S.by ? `<button class="chip-me" data-act="recSheet" style="background:${teamColor(S.by)}" aria-label="기록자 바꾸기">${esc(S.by)}</button>` : ''}
      <button class="gear" data-act="go" data-v="s9" aria-label="설정">${ICO.gear}</button>`;
  }
  /* 메모리 저장소일 때 항상 보이는 빨간 띠(보낼 기록이 있으면 보내기, 없으면 설치 안내). 정상 모드에서는 D95 ① 저장 상태 줄 */
  function memBandHtml() {
    if (!MEM()) return S.ad ? `<div class="savebar ${bkDue() ? 'due' : ''} ${Date.now() - (S.pulseAt || 0) < 900 ? 'pulse' : ''}" id="saveBar" role="status">${saveBarInner()}</div>` : '';
    return `<button class="memband" id="memBand" role="alert" ${S.ad && memRisk() ? 'data-act="go" data-v="s7"' : 'data-act="memDlg"'}><span>저장 안 됨 · 새 기록 막음 · 설치 주소로 여세요</span>${S.ad ? `<span class="n">보내지 않은 기록 ${unsentN()}건</span>` : ''}</button>`;
  }
  /* ── D95 ① 저장 상태 줄: 「저장됨 ✓ 기록 n건 · 사진 n장 · 방금」 + 영구 저장 여부, 백업할 때가 되면 「백업 파일 저장」 ── */
  function ago(iso) {
    if (!iso) return '아직 없음';
    const s = (Date.now() - new Date(iso)) / 1000;
    return s < 60 ? '방금' : s < 3600 ? `${Math.floor(s / 60)}분 전` : new Date(iso).toDateString() === new Date().toDateString() ? `오늘 ${hm(iso).slice(6)}` : hm(iso);
  }
  const photoN = () => [...S.media.values()].filter((m) => (m.mime || '').startsWith('image/') && !(S.entries.get(m.entryId) || {}).deleted).length;
  /* 백업 뒤 새로 생기거나 바뀐 기록·등급 수(마지막 백업 시각 뒤 updatedAt) */
  const bkPending = () => { const at = S.bkCfg.at; return [...S.entries.values(), ...S.marks.values()].filter((x) => !at || x.updatedAt > at).length; };
  const bkDue = () => !MEM() && S.bkCfg.every > 0 && bkPending() >= S.bkCfg.every;
  function saveBarInner() {
    const due = bkDue(), p = S.persisted;
    const sub = due ? `<small class="due">백업 뒤 기록 ${bkPending()}건 · 백업 파일을 저장해 두세요</small>`
      : p ? '<small>영구 저장 허용됨 · 폰이 지우지 않습니다</small>'
      : `<small class="warn">영구 저장 허용 안 됨 · 폰 공간이 부족하면 지울 수 있음 → 설치하세요</small>`;
    return `<button class="sb-main" data-act="protectSheet"><b><i aria-hidden="true">✓</i>저장됨 · 기록 ${live().length}건 · 사진 ${photoN()}장 · ${esc(ago(S.lastSaveAt))}</b>${sub}</button>
      ${due ? `<button class="btn sb-bk" data-act="saveBackup" ${S.bkBusy ? 'disabled' : ''}>${S.bkBusy ? '만드는 중' : '백업 파일 저장'}</button>` : ''}`;
  }
  function updateSaveBar(pulse) {
    const el = $('#saveBar');
    if (!el) return;
    el.innerHTML = saveBarInner();
    el.classList.toggle('due', bkDue());
    if (pulse) { el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse'); }
  }
  function tabsHtml() {
    const on = (vs) => (vs.includes(S.view) ? 'on' : '');
    const n = unsentEntries().length + unsentMarks().length;
    return `<button class="${on(WORK)}" data-act="go" data-v="s2">${ICO.place}장소</button>
      <button class="${on(['s6'])}" data-act="go" data-v="s6">${ICO.list}기록</button>
      <button class="shoot" data-act="shoot" data-long="shootMenu" aria-label="찍기">${ICO.camera}찍기</button>
      <button class="${on(['s7', 's8'])}" data-act="go" data-v="s7">${ICO.send}<span>보내기${n ? `<span class="tag t-amber">${n}</span>` : ''}</span></button>`;
  }

  /* B안 첫 화면: 프로젝트 자료 불러오기 */
  function vWelcome() {
    return `<div class="card rise" style="--i:0;text-align:center">
        <img src="${IMG.icon}" alt="" style="width:88px;border-radius:22px;margin:8px auto 4px;display:block">
        <h2 style="justify-content:center;font-size:20px">TS현장</h2>
        <p class="muted">사내에서 메일로 받은 프로젝트 자료 파일(.tspack)을 불러와 시작합니다. 이 앱에는 고객 정보가 들어 있지 않습니다.</p>
        <button class="btn wide" data-act="pickPack"><img src="${IMG.import}" alt="" width="26">프로젝트 불러오기</button>
      </div>
      ${say('analyst', '현장에서는 사진과 메모만 남기셔도 됩니다. 문항은 돌아가서 같이 붙이겠습니다.')}
      <div class="card rise" style="--i:2"><h2>불러오는 방법</h2><ol class="steps"><li>개인 메일에서 .tspack 첨부를 내려받습니다</li><li>[프로젝트 불러오기]를 누릅니다</li><li>「내 파일 → 다운로드」에서 그 파일을 고릅니다</li></ol><p class="hint">앱을 다시 설치했다면 프로젝트를 불러온 뒤 「설정 → 백업 불러오기」로 TS현장백업 파일을 고르면 기록이 되살아납니다.</p></div>`;
  }

  /* S0 첫 실행·기기 점검 */
  function vS0() {
    const sc = S.sc;
    const rows = TSF.selfCheck.ITEMS.map(([k, name, what]) => {
      const r = sc && sc[k];
      const st = r ? r.s : 'todo';
      const label = { ok: '통과', warn: '경고', fail: '실패', fallback: '대체', todo: '확인 전' }[st];
      const btn = k === 'C4' ? `<button class="btn ghost" style="min-height:40px;margin-top:6px" data-act="testCam">시험 촬영</button>` : '';
      return `<tr><td>${k}</td><td><b>${esc(name)}</b><div class="hint">${esc(r ? r.msg : what)}</div>${btn}</td><td style="text-align:right"><span class="st ${st}">${label}</span></td></tr>`;
    }).join('');
    const c1fail = sc && sc.C1 && sc.C1.s === 'fail';
    const samsung = TSF.selfCheck.isSamsung();
    return `${say('analyst', '현장에서는 사진과 메모만 남기셔도 됩니다. 문항은 돌아가서 같이 붙이겠습니다.')}
      ${bigCard(1)}
      <div class="card rise" style="--i:1"><h2>기기 점검 <small>${sc ? '자동 점검 완료' : '점검 중…'}</small></h2>
        <table class="check">${rows}</table>
        <p class="hint">열기 방식: ${esc(SINGLE ? '파일 하나(A안)' : '설치형(B안)')} · ${esc(location.protocol.replace(':', ''))}</p>
        <p class="hint">음성은 메모·문항 메모 칸에서 키보드 마이크(받아쓰기)로 남깁니다. 앱 안 녹음은 쓰지 않습니다.</p>
        ${c1fail ? (MEM() ? `<div class="band coral" style="margin-top:10px;display:block">여기서는 기록을 남길 수 없습니다. 이렇게 연 앱은 기록을 폰에 저장하지 못해 새 기록을 막았습니다. 아래 주소로 앱을 설치해 주세요.</div>${installHtml()}` : '<div class="band coral" style="margin-top:10px">이 방식으로는 기록을 저장할 수 없습니다. 기록 버튼을 잠갔습니다. 설치형(B안) 주소로 열어 주세요.</div>') : ''}
      </div>
      <div class="card rise" style="--i:2"><h2>기록자 고르기</h2>
        <div class="chips">${S.recs.map((i) => `<button class="chip ${S.by === i ? 'on' : ''}" data-act="setBy" data-i="${esc(i)}">${esc(i)}</button>`).join('')}
          <button class="chip" data-act="addRec">다른 사람 추가</button></div>
        <p class="hint">기록마다 고른 이니셜이 붙습니다. 나중에 오른쪽 위에서 바꿀 수 있습니다.</p>
      </div>
      <div class="card rise" style="--i:3"><h2>홈 화면에 추가</h2>
        <ol class="steps">${/iPhone|iPad|iPod/i.test(navigator.userAgent)
          ? '<li>사파리 아래쪽 공유 단추(네모에 위 화살표)를 누릅니다</li><li>「홈 화면에 추가」를 누릅니다</li><li>홈 화면 아이콘으로만 실행합니다(사파리에서 바로 쓰면 오래 안 쓸 때 기록이 지워질 수 있습니다)</li>'
          : samsung
          ? '<li>주소창 오른쪽의 「설치」 아이콘(아래 화살표가 든 상자)을 누릅니다. 안 보이면 새로 고침 뒤 몇 초 기다립니다</li><li>「설치」를 누르면 홈 화면에 아이콘이 생깁니다</li><li>아이콘이 계속 안 보이면 아래 메뉴 ≡ → 「페이지 추가」 → 「홈 화면」</li>'
          : '<li>오른쪽 위 메뉴 ⋮ 를 누릅니다</li><li>「홈 화면에 추가」(또는 「앱 설치」)를 누릅니다</li><li>아이콘 이름을 확인하고 추가합니다</li>'}</ol>
        <p class="hint">아이콘 이름: TS현장 ${esc(SINGLE ? S.ad.project.codeName : '')}</p>
      </div>
      <button class="btn wide rise" style="--i:4" data-act="start" ${(c1fail && !MEM()) || !S.by || !sc ? 'disabled' : ''}>${MEM() ? '둘러보기(기록 안 됨)' : '시작하기'}</button>`;
  }

  /* S1 프로젝트 홈 */
  function vS1() {
    const today = new Date().toDateString();
    const todayN = live().filter((e) => new Date(e.at).toDateString() === today).length;
    const unc = live().filter(isUnc).length;
    const uns = unsentEntries().length + unsentMarks().length;
    const last = S.sends[0];
    const bands = [];
    if (expired()) bands.push(`<div class="band coral"><img src="${IMG.warning}" alt="">이 현장 앱은 만료되었습니다. 남은 기록을 보내고 정리해 주세요. 새 기록은 막았습니다.</div>`);
    const oldest = unsentEntries().map((e) => e.updatedAt).sort()[0];
    const since = last ? new Date(last.createdAt) : oldest ? new Date(oldest) : null;
    if (uns && since && Date.now() - since > 86400000) bands.push(`<div class="band amber"><img src="${IMG.warning}" alt="">24시간 넘게 보내지 않은 기록이 ${uns}건 있습니다. 오늘 저녁 「보내기」를 해 주세요.</div>`);
    if (S.free != null && S.free < 2 * 1073741824) bands.push(`<div class="band coral"><img src="${IMG.warning}" alt="">남은 저장 공간이 약 ${fmtMB(S.free)}입니다. ${lowSpace() ? '동영상은 막고 사진만 받습니다. ' : ''}보내기 후 「설정 → 저장 공간」에서 정리해 주세요.</div>`);
    const rts = (baseEt() ? S.ad.retakes || [] : []).filter((r) => !retakeDone(r));
    const pls = places();
    const ets = S.ad.evalTypes;
    return `${bands.join('')}
      ${live().length === 0 ? say('planner', '첫 장소를 골라 시작해 보세요.') : unc >= 10 ? say('analyst', `미분류 기록 ${unc}건은 사내에 들어가면 제가 문항 후보를 붙여 드립니다.`, IMG.analystAlert) : ''}
      ${ets.length > 1 ? `<div class="chips rise" style="--i:0;margin-bottom:12px">${ets.map((e) => `<button class="chip ${e.id === etId() ? 'on' : ''}" data-act="setEt" data-et="${esc(e.id)}">${esc(e.name)}</button>`).join('')}</div>` : ''}
      <div class="card rise" style="--i:1"><h2>오늘 요약 <small>${esc(S.ad.round.label)} · ${esc(curEt().name)}</small></h2>
        <div class="kpis">
          <div class="kpi"><b data-count="${todayN}">${todayN}</b><span>오늘 기록</span></div>
          <div class="kpi ${unc ? 'warn' : ''}"><b data-count="${unc}">${unc}</b><span>미분류</span></div>
          <div class="kpi ${uns ? 'warn' : ''}"><b data-count="${uns}">${uns}</b><span>보내지 않음</span></div>
          <div class="kpi"><b style="font-size:15px;line-height:36px">${last ? esc(hm(last.createdAt)) : '없음'}</b><span>마지막 보냄</span></div>
        </div>
      </div>
      ${rts.length ? `<div class="card rise" style="--i:2"><h2>${ICO.retake.replace('<svg', '<svg width="20" height="20"')}재촬영 요청 ${rts.length}건</h2>${rts.map((r) => { const q = qOf(r.seq); return `<button class="qc" data-act="openQ" data-place="${esc(r.place)}" data-seq="${r.seq}"><div class="meta" title="${esc(r.id)}">${esc(refLabel(r.id))} · ${esc(placeOf(r.place).name)} · 문항 ${r.seq}</div><div class="q">${esc(q ? q.text : '문항 ' + r.seq)}</div>${S.ad.optional && S.ad.optional.whereText && S.ad.optional.whereText[r.id] ? `<div class="foot">${esc(S.ad.optional.whereText[r.id])}</div>` : ''}</button>`; }).join('')}</div>` : ''}
      <div class="card rise" style="--i:3"><h2>장소별 진행 <small>기록한 문항 / 문항 수</small></h2>
        ${pls.map((p) => { const n = seqsOf(p).length, d = doneSeqs(p).size; return `<div class="plbar" data-act="openPlace" data-place="${esc(p.id)}"><b>${esc(p.name)}</b><span class="num muted">${d} / ${n}</span><div class="bar"><i style="width:${n ? (d / n) * 100 : 0}%"></i></div></div>`; }).join('')}
      </div>
      <button class="btn wide ghost rise" style="--i:4" data-act="go" data-v="s2">장소 고르기</button>`;
  }

  /* S2 장소 선택 */
  function vPlaces(compact) {
    const pls = places().filter((p) => !S.mine || p.ownerInitials === S.by);
    return `<div class="toggle rise" style="--i:0"><b>${compact ? '장소' : '장소 고르기'}</b><span class="row small muted">내 담당만<button class="switch ${S.mine ? 'on' : ''}" data-act="mine" aria-label="내 담당만 보기" aria-pressed="${S.mine}"></button></span></div>
      <div class="pls ${compact ? '' : 'grid2'}">${pls.map((p, i) => { const n = seqsOf(p).length, d = doneSeqs(p).size; return `<button class="pl rise ${S.place === p.id ? 'on' : ''}" style="--i:${i + 1}" data-act="openPlace" data-place="${esc(p.id)}">
          <span class="ord">${p.order}번째 · ${esc(p.line || '')}</span><b>${esc(p.name)}</b><small>문항 ${n}개 · ${d}개 기록</small>
          ${p.ownerInitials ? `<span class="own" style="background:${teamColor(p.ownerInitials)}">${esc(p.ownerInitials)}</span>` : ''}
          <div class="bar"><i style="width:${n ? (d / n) * 100 : 0}%"></i></div></button>`; }).join('')}
        ${pls.length ? '' : '<p class="muted">내가 담당한 장소가 없습니다.</p>'}
        <button class="pl other rise ${S.place === 'PL-99' ? 'on' : ''}" style="--i:${pls.length + 1}" data-act="openPlace" data-place="PL-99"><b>장소 밖 기록(기타)</b><small>문항 없이 바로 남기기</small></button>
      </div>`;
  }

  /* S3 장소의 문항 */
  function vQuestions(withPicker) {
    const pl = placeOf(S.place);
    const picker = withPicker ? `<select data-change="place" aria-label="장소" style="margin-bottom:10px">${places().map((p) => `<option value="${esc(p.id)}" ${p.id === pl.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}<option value="PL-99" ${pl.id === 'PL-99' ? 'selected' : ''}>장소 밖 기록(기타)</option></select>` : '';
    if (pl.id === 'PL-99') {
      const list = live().filter((e) => inRound(e) && e.place === 'PL-99');
      return `${picker}<div class="qhead"><h1>장소 밖 기록</h1></div><p class="muted small">어느 장소에도 속하지 않는 기록입니다. 문항은 사내에서 붙입니다.</p>
        ${toolsHtml()}<div class="evs">${list.map(evHtml).join('')}</div>`;
    }
    const seqs = seqsOf(pl), done = doneSeqs(pl), op = opt();
    const f = S.s3f;
    const shown = seqs.filter((s) => {
      const m = markOf(s);
      if (f === 'todo') return !done.has(s);
      if (f === 'nograde') return !(m && (m.grade != null || m.na));
      if (f === 'retake') return !!retakeFor(s, pl.id);
      return true;
    });
    const chips = [['all', '전체'], ['todo', '아직 안 함'], ['nograde', '등급 미입력'], ['retake', '재촬영 요청']].map(([k, t]) => `<button class="chip ${f === k ? 'on' : ''}" data-act="s3f" data-f="${k}">${t}</button>`).join('');
    return `${picker}<div class="qhead rise" style="--i:0"><h1>${esc(pl.name)}</h1>${layout() !== 'phone' ? '' : `<button class="btn line" style="min-height:40px" data-act="go" data-v="s2">장소</button>`}</div>
      <p class="rise" style="--i:1;margin:0 0 10px">이 장소 문항 <b>${seqs.length}개</b> 중 <b>${done.size}개</b> 기록</p>
      <div class="chips rise" style="--i:2;margin-bottom:12px">${chips}</div>
      ${shown.map((s, i) => {
        const q = qOf(s), m = markOf(s), n = entriesAt(pl.id, s).length, rt = retakeFor(s, pl.id), pg = op.prevGrades ? op.prevGrades[String(s)] : null;
        return `<button class="qc rise ${S.seq === s && S.view === 's4' ? 'on' : ''}" style="--i:${Math.min(i + 3, 12)}" data-act="openQ" data-seq="${s}" data-place="${esc(pl.id)}" data-long="naSheet">
          <div class="meta"><span>${s}</span><span>${esc(q.sub || q.area)}</span>${rt ? `<span class="tag t-amber ${retakeDone(rt) ? '' : 'ping'}">재촬영 요청</span>` : ''}</div>
          <div class="q">${esc(q.text)}</div>
          <div class="foot"><span>기록 ${n}건</span>${m ? gchip(m.grade, m.na) : ''}${pg != null ? `<span class="g gprev">이전 ${esc(gradeText(pg))}</span>` : ''}</div></button>`;
      }).join('') || '<p class="muted">조건에 맞는 문항이 없습니다.</p>'}
      <button class="qc out rise ${S.outView && S.view === 's4' ? 'on' : ''}" style="--i:12" data-act="openOut" data-place="${esc(pl.id)}">
        <div class="meta"><span>맞는 문항 없음</span><span>점수 제외</span></div>
        <div class="q">문항 외 참고사항 (${outAt(pl.id).length})</div>
        <div class="foot">이 장소에서 본 것 중 맞는 문항이 없는 관찰을 남깁니다. 사내에서 발견사항 근거로 씁니다.</div></button>
      <p class="hint">문항 카드를 길게 누르면 「해당없음」으로 표시할 수 있습니다.</p>`;
  }
  function toolsHtml() {
    const vidOff = lowSpace();
    return `<div class="tools4" style="grid-template-columns:repeat(3,1fr)">
      <button class="tool" data-act="cap" data-k="photo"><img src="${IMG.camera}" alt="">사진</button>
      <button class="tool" data-act="cap" data-k="video" ${vidOff ? 'disabled' : ''}>${ICO.video}동영상</button>
      <button class="tool" data-act="memoSheet"><img src="${IMG.memo}" alt="">메모</button></div>
      <div class="row small muted" style="justify-content:space-between;margin-bottom:12px"><span>음성은 메모·문항 메모 칸에서 키보드 마이크(받아쓰기)로 남깁니다.</span><button class="btn line" style="min-height:40px;font-size:13px;white-space:nowrap" data-act="cap" data-k="gallery">갤러리에서</button></div>
      ${vidOff ? '<div class="band coral">남은 공간이 500MB 미만이라 동영상을 막았습니다. 사진은 찍을 수 있습니다.</div>' : ''}`;
  }
  function evHtml(e) {
    const st = e.kind === 'audio' && e.transcriptStatus === 'waiting' ? '받아쓰기 전' : '';
    return `<button class="ev" data-act="entrySheet" data-id="${esc(e.id)}"><div class="th">${thumbHtml(e)}</div><div class="cap">${esc(KIND[e.kind])} · ${esc(hm(e.at).slice(6))} · ${esc(e.by)}${st ? ' · ' + st : ''}${e.memo ? ' · ' + esc(e.memo) : ''}</div></button>`;
  }

  /* S4 문항 기록 */
  function vRecord() {
    const pl = placeOf(S.place);
    if (S.outView && pl.id !== 'PL-99') return vOut(pl);
    if (S.seq == null || !qOf(S.seq) || pl.id === 'PL-99') {
      return `<div class="empty"><img src="${IMG.planner}" alt="">왼쪽에서 문항을 골라 주세요.</div>`;
    }
    const q = qOf(S.seq), m = markOf(S.seq), list = entriesAt(pl.id, S.seq), op = opt();
    const rt = retakeFor(S.seq, pl.id);
    const pg = op.prevGrades ? op.prevGrades[String(S.seq)] : null, ps = op.prevSummary ? op.prevSummary[String(S.seq)] : null;
    const where = rt && op.whereText ? op.whereText[rt.id] : null;
    const seqs = seqsOf(pl), idx = seqs.indexOf(S.seq);
    const field = (q.methods || []).includes('현장');
    const draftKey = `mark:${TSF.markId(S.dev, S.seq, S.by, roundId())}`;
    return `<div class="qtop rise" style="--i:0"><div class="path">${esc(pl.name)} · ${idx + 1} / ${seqs.length} · 문항 ${S.seq}</div>
        <div class="path">${esc([q.area, q.sub, q.zone].filter(Boolean).join(' · '))}</div>
        <div class="qq">${esc(q.text)}</div>
        ${field ? '<span class="tag t-blue" style="margin:0">현장 확인 문항: 사진 근거 권장</span>' : ''}
        ${q.point ? `<details><summary>점검포인트 보기</summary><p style="margin:0 0 6px">${esc(q.point)}</p><p class="hint">방법: ${esc((q.methods || []).join(', '))}</p></details>` : ''}
      </div>
      ${pg != null || ps || rt ? `<div class="band blue rise" style="--i:1">${ICO.retake.replace('<svg', '<svg width="22" height="22" style="flex:none"')}<div>${rt ? `<b title="${esc(rt.id)}">${esc(refLabel(rt.id))}</b>${retakeDone(rt) ? ' · 찍음' : ' · 이 화면에서 찍으면 요청에 연결됩니다'}<br>` : ''}${where ? `촬영 위치: ${esc(where)}<br>` : ''}${pg != null ? `직전 차수 등급 ${esc(gradeText(pg))}` : ''}${ps ? ` · ${esc(ps)}` : ''}</div></div>` : ''}
      <div class="rise" style="--i:2">${toolsHtml()}</div>
      <div class="card rise" style="--i:3"><h2>이번 기록 <small>${list.length}건</small></h2>${list.length ? `<div class="evs">${list.map(evHtml).join('')}</div>` : '<p class="muted small" style="margin:0">아직 기록이 없습니다. 사진·동영상·음성·메모 중 편한 것으로 남겨 주세요.</p>'}</div>
      ${guideHtml(S.seq, m)}
      <div class="card rise" style="--i:4"><h2>현장 등급 <small>${m && (m.grade != null || m.na) ? '판단 기록(확정은 사내에서)' : '등급은 나중에 agent가 제안합니다'}</small></h2>
        <div class="grades">${[1, 2, 3, 4, 5].map((g) => `<button class="gb k${g} ${m && m.grade === g ? 'on' : ''}" data-act="grade" data-g="${g}"><i>${g}</i>${GRADE_WORD[g]}</button>`).join('')}
          <button class="gb na ${m && m.na ? 'on' : ''}" data-act="naSheet"><i>해당없음</i>${m && m.na ? '사유: ' + esc(m.naReason.slice(0, 20)) : '사유 필수'}</button></div>
        <ul class="gdefs">${[1, 2, 3, 4, 5].map((g) => `<li>${esc(gradeText(g))} — ${esc(GRADE_DEF[g])}</li>`).join('')}</ul>
      </div>
      <div class="card rise" style="--i:5"><h2>문항 메모</h2>
        <textarea data-draft="${esc(draftKey)}" data-commit="markMemo" maxlength="2000" placeholder="본 것을 그대로 적어 주세요. 숫자는 단위와 함께 적어 주세요. 예: 차량 입문 시간당 2대, 출입문 7개">${esc(m ? m.memo : '')}</textarea>
        <div class="chips" style="margin-top:8px">${QUICK_TAGS.map((t) => `<button class="chip" data-act="tagMark" data-t="${t}">${t}</button>`).join('')}</div>
        <p class="hint">음성은 메모·문항 메모 칸에서 키보드 마이크(받아쓰기)로 남깁니다. 고객 실명·연락처는 말하지 말아 주세요.</p>
      </div>
      <div class="navq"><button class="btn line" data-act="stepQ" data-d="-1" ${idx <= 0 ? 'disabled' : ''}>이전 문항</button><button class="btn" data-act="stepQ" data-d="1" ${idx >= seqs.length - 1 ? 'disabled' : ''}>다음 문항</button></div>`;
  }
  /* D85 되돌려 주기: guide.cases(승인 사례, 고객명 없음)·guide.drift(현장 등급 ↔ 최종 등급 차이). 앱 자료에 없으면 안 보인다 */
  const approvedCases = (seq) => ((S.ad.guide && S.ad.guide.cases && S.ad.guide.cases.items) || {})[String(seq)] || [];
  function driftWarn(seq) {
    const ds = ((S.ad.guide && S.ad.guide.drift && S.ad.guide.drift.items) || {})[String(seq)] || [];
    if (!ds.length) return '';
    const down = ds.filter((d) => +d.finalGrade < +d.fieldGrade).length, d0 = ds[0];
    const how = down * 2 >= ds.length ? '현장에서 높게 주고 사무실에서 낮춘' : '현장에서 낮게 주고 사무실에서 높인';
    const many = ds.length > 1 ? `경우가 많습니다(${ds.length}건)` : `경우가 있습니다(현장 ${gradeText(+d0.fieldGrade)} → 최종 ${gradeText(+d0.finalGrade)}${d0.finalConfirmed === false ? ', 최종 확정 전' : ''})`;
    return `이 문항은 ${how} ${many}. ${down * 2 >= ds.length ? '기록 보존을 꼭 확인하세요.' : '근거 서류·운영 기록까지 꼭 확인하세요.'}`;
  }
  function photoSheet(i, j) {
    const c = approvedCases(S.seq)[+i], ph = c && (c.photos || [])[+j];
    if (!ph) return;
    const sh = sheet(`<h3>사례 사진</h3><img class="gbig" src="${esc(ph.src)}" alt="${esc(ph.caption || '사례 사진')}">${ph.caption ? `<p class="muted small">${esc(ph.caption)}</p>` : ''}<p class="hint">다른 현장 사례 · 사내 참고용입니다. 고객에게 보이지 않습니다.</p><div class="acts"><button class="btn line" data-x>닫기</button></div>`);
    sh.querySelector('[data-x]').onclick = closeSheet;
  }
  /* 현장 가이드 패널(D80): 볼 것 체크 → 서류 확인 → 제안 등급(한 번 눌러 쓰기). 접는 칸의 열림 상태는 S.gOpen 에 둔다 */
  function guideHtml(seq, m) {
    const gd = guideOf(seq);
    if (!gd) return '';
    const on = new Set((m && m.guideChecks) || []), sg = guideSuggest(gd, m);
    const open = (k) => (S.gOpen[k] ? 'open' : '');
    const draft = gd.status !== 'confirmed' ? `<span class="tag t-grey" title="${esc(gd.needsReview ? '선임 확인 전 · ' + gd.needsReview : '선임 확인 전 초안')}">agent 초안</span>` : '';
    const sgTxt = sg.grade ? `제안 등급: ${gradeText(sg.grade)} (핵심 ${sg.met}/${sg.total} 충족, 서류 ${sg.docs ? '있음' : '없음'})` : '';
    const same = m && m.grade === sg.grade && !m.na;
    const li = (arr) => `<ul class="glist">${arr.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`;
    const ac = approvedCases(seq), dw = driftWarn(seq);
    return `<div class="card guide rise" style="--i:3">${dw ? `<p class="gdrift" role="note">${esc(dw)}</p>` : ''}<h2>현장 가이드 ${draft}<small>볼 것 ${on.size}/${(gd.checklist || []).length}</small></h2>
      <div class="gchks">${(gd.checklist || []).map((c) => `<button class="gchk ${on.has(c.id) ? 'on' : ''}" data-act="gChk" data-id="${esc(c.id)}" aria-pressed="${on.has(c.id)}"><i aria-hidden="true"></i><span>${esc(c.text)}</span>${c.key ? '<em>핵심</em>' : ''}</button>`).join('')}</div>
      <div class="toggle gdocs"><b>서류 확인함 <small class="muted">절차서·일지 등</small></b><button class="switch ${m && m.docsSeen ? 'on' : ''}" data-act="gDocs" aria-label="서류 확인" aria-pressed="${!!(m && m.docsSeen)}"></button></div>
      ${sg.touched && sg.grade ? `<div class="gsug"><div class="t"><span class="g g${sg.grade}">${esc(gradeText(sg.grade))}</span><b>${esc(sgTxt)}</b></div>
        <button class="btn ${same ? 'line' : ''}" data-act="gUse" data-g="${sg.grade}" ${same ? 'disabled' : ''}>${same ? '지금 등급과 같음' : '이 등급 쓰기'}</button>
        <p class="hint">제안일 뿐입니다. 현장 등급은 컨설턴트가 정합니다.</p></div>` : '<p class="hint">볼 것을 체크하거나 서류 확인을 정하면 제안 등급이 나옵니다.</p>'}
      <details data-gd="grade" ${open('grade')}><summary>등급 기준 5줄</summary><ul class="glist">${['1', '2', '3', '4', '5', 'NA'].filter((k) => gd.gradeGuide && gd.gradeGuide[k]).map((k) => `<li>${esc(gd.gradeGuide[k])}</li>`).join('')}</ul></details>
      ${ac.length + (gd.cases || []).length ? `<details data-gd="cases" ${open('cases')}><summary>비슷한 사례 ${ac.length + (gd.cases || []).length}건</summary>
        ${ac.length ? `<p class="ghead">${esc(S.ad.guide.cases.label || '다른 현장 사례 · 사내 참고용')}</p>${ac.map((c, i) => `<div class="gcase ok"><div><span class="g g${esc(c.grade)}">${esc(gradeText(+c.grade))}</span> <small class="muted">${esc(GRADE_DEF[c.grade] || '')}${c.area ? ' · ' + esc(c.area) : ''}</small></div><p>${esc(c.text)}</p>${c.laterGrade ? `<p class="hint">개선 뒤 ${esc(gradeText(+c.laterGrade))}</p>` : ''}${(c.photos || []).filter((ph) => ph.src).slice(0, 2).map((ph, j) => `<button class="gph" data-act="gPhoto" data-i="${i}" data-j="${j}" aria-label="사진 크게 보기"><img src="${esc(ph.src)}" alt="${esc(ph.caption || '사례 사진')}" loading="lazy"></button>`).join('')}</div>`).join('')}` : ''}
        ${(gd.cases || []).length ? `${ac.length ? '<p class="ghead">일반 사례(agent 초안)</p>' : ''}${gd.cases.map((c) => `<div class="gcase"><div><span class="g g${esc(c.grade)}">${esc(gradeText(+c.grade))}</span> <b>${esc(c.title)}</b></div><p>${esc(c.situation)}</p>${c.findingSentence ? `<p class="hint">발견사항 문장 예: ${esc(c.findingSentence)}</p>` : ''}</div>`).join('')}` : ''}</details>` : ''}
      ${(gd.askClient || []).length ? `<details data-gd="ask" ${open('ask')}><summary>물어볼 것 ${gd.askClient.length}개</summary>${li(gd.askClient)}</details>` : ''}
      ${(gd.requestDocs || []).length ? `<details data-gd="docs" ${open('docs')}><summary>받을 서류 ${gd.requestDocs.length}개</summary>${li(gd.requestDocs)}</details>` : ''}
    </div>`;
  }
  async function guideCheck(id) {
    const m = markOf(S.seq), on = new Set((m && m.guideChecks) || []);
    on.has(id) ? on.delete(id) : on.add(id);
    const order = ((guideOf(S.seq) || {}).checklist || []).map((c) => c.id);
    await setMark(S.seq, { guideChecks: order.filter((x) => on.has(x)) });
    render();
  }
  /* 문항 외 참고사항(D79): 사진·메모만 남기고 등급은 받지 않는다 */
  function vOut(pl) {
    const list = outAt(pl.id);
    return `<div class="qtop rise" style="--i:0"><div class="path">${esc(pl.name)} · 문항 외 참고사항</div>
        <div class="qq">맞는 문항이 없는 관찰</div>
        <span class="tag t-blue" style="margin:0">점수에 넣지 않습니다 · 발견사항 근거·보고서 참고로 씁니다</span></div>
      <div class="rise" style="--i:1">${toolsHtml()}</div>
      <div class="card rise" style="--i:2"><h2>문항 외 참고 기록 <small>${list.length}건</small></h2>${list.length ? `<div class="evs">${list.map(evHtml).join('')}</div>` : '<p class="muted small" style="margin:0">아직 기록이 없습니다. 이 장소에서 본 위험 중 맞는 문항이 없는 것을 사진·메모로 남겨 주세요.</p>'}</div>
      <p class="hint">나중에 맞는 문항이 생기면 「기록」에서 길게 눌러 문항을 붙일 수 있습니다.</p>`;
  }
  function vWork() {
    const L = layout();
    if (L === 'phone') return S.view === 's2' ? vPlaces() : S.view === 's3' ? vQuestions() : vRecord();
    if (!S.place) S.place = places()[0].id;
    if (L === 'two') return `<div class="cols two"><section class="col q">${vQuestions(true)}</section><section class="col r">${vRecord()}</section></div>`;
    return `<div class="cols three"><section class="col p">${vPlaces(true)}</section><section class="col q">${vQuestions()}</section><section class="col r">${vRecord()}</section></div>`;
  }

  /* S6 기록 모아보기 */
  function vS6() {
    const f = S.s6f;
    let list = live().sort((a, b) => (a.at < b.at ? 1 : -1));
    if (f === 'unc') list = list.filter(isUnc);
    if (f === 'out') list = list.filter(isOut);
    if (f === 'unsent') list = list.filter((e) => (e._sentRev || 0) < e.rev);
    const card = (e) => {
      const q = e.seq == null ? null : qOf(e.seq);
      const qText = isOut(e) ? '<span class="tag t-blue" style="margin:0">문항 외 참고</span>' : e.seq == null ? '<span class="tag t-amber" style="margin:0">미분류</span>' : q ? `문항 ${e.seq} · ${esc(q.text)}` : `<span class="tag t-grey" style="margin:0">범위 밖 문항 ${e.seq}</span>`;
      const sent = (e._sentRev || 0) >= e.rev;
      return `<button class="rec ${S.pick.has(e.id) ? 'picked' : ''}" data-act="${S.pick.size ? 'pickRec' : 'entrySheet'}" data-long="pickRec" data-id="${esc(e.id)}">
        <div class="th">${thumbHtml(e)}</div>
        <div><b>${qText}</b><small>${esc(hm(e.at))} · ${esc(placeOf(e.place).name)} · ${esc(KIND[e.kind])} · ${esc(e.by)}${e.round !== roundId() ? ' · ' + esc(e.round) : ''}</small>
        <small>${sent ? '<span class="tag t-mint" style="margin:0">보냄</span>' : '<span class="tag t-amber" style="margin:0">보내지 않음</span>'}${e.memo ? ' ' + esc(e.memo.slice(0, 40)) : ''}</small>${isOut(e) && e.outsideReason ? `<small>이유: ${esc(e.outsideReason)}</small>` : ''}</div></button>`;
    };
    let body;
    if (!list.length) body = `<div class="empty"><img src="${IMG.empty}" alt="">${f === 'all' || f === 'time' ? '아직 기록이 없습니다. 아래 「찍기」로 시작해 보세요.' : '조건에 맞는 기록이 없습니다.'}</div>`;
    else if (f === 'place') {
      const groups = {};
      list.forEach((e) => (groups[e.place] = groups[e.place] || []).push(e));
      body = [...places(), OTHER].filter((p) => groups[p.id]).map((p) => `<div class="grp">${esc(p.name)} · ${groups[p.id].length}건</div>${groups[p.id].map(card).join('')}`).join('');
    } else body = list.map(card).join('');
    const chips = [['time', '시간순'], ['place', '장소별'], ['unc', '미분류만'], ['out', '문항 외 참고'], ['unsent', '보내지 않은 것']].map(([k, t]) => `<button class="chip ${f === k ? 'on' : ''}" data-act="s6f" data-f="${k}">${t}</button>`).join('');
    return `<div class="qhead"><h1>기록 모아보기</h1><span class="muted small">${live().length}건</span></div>
      <div class="chips" style="margin-bottom:12px">${chips}</div>
      <p class="hint" style="margin:-4px 0 10px">기록을 길게 누르면 여러 개를 골라 문항 붙이기·장소 바꾸기·지우기를 할 수 있습니다.</p>
      ${body}
      ${S.pick.size ? `<div class="selbar"><button class="btn ghost" data-act="bulkSeq">문항 붙이기</button><button class="btn ghost" data-act="bulkPlace">장소 바꾸기</button><button class="btn danger" data-act="bulkDel">지우기</button><button class="btn line" data-act="pickClear">${S.pick.size}개 해제</button></div>` : ''}`;
  }

  /* S7 보내기(5-9) */
  function selection(mode, light) {
    const out = [], skip = [];
    for (const m of S.media.values()) {
      if (m.purged || !m.blob) continue;
      const e = S.entries.get(m.entryId);
      if (e && e.deleted) continue;
      const isVid = (m.mime || '').startsWith('video/'), isImg = (m.mime || '').startsWith('image/');
      if (mode === 'daily' && m.sentVariant == null) {
        if (light && isVid) skip.push(m); else out.push({ m, e, variant: light && isImg ? 'light' : 'original' });
      } else if (mode === 'original' && (m.sentVariant === 'light' || m.sentVariant === 'thumb')) out.push({ m, e, variant: 'original' });
      else if (mode === 'all') out.push({ m, e, variant: 'original' });
    }
    return { out, skip };
  }
  function vS7() {
    const mode = S.settings.sendMode || 'daily';
    const light = !!S.settings.light && mode === 'daily';
    const ue = unsentEntries();
    const newE = ue.filter((e) => !e._sentRev && !e.deleted).length, chE = ue.filter((e) => e._sentRev && !e.deleted).length, del = ue.filter((e) => e.deleted).length;
    const gm = unsentMarks().filter((m) => m.grade != null || m.na).length;
    const sel = selection(mode, light);
    const cnt = (p) => sel.out.filter((x) => (x.m.mime || '').startsWith(p)).length;
    const origDaily = selection('daily', false).out.reduce((s, x) => s + x.m.size, 0);
    const sizes = sel.out.map((x) => (x.variant === 'light' ? Math.min(x.m.size, 1.2 * 1048576) : x.m.size));
    const thumbs = sel.out.concat(sel.skip.map((m) => ({ m }))).reduce((s, x) => s + ((x.m.thumb && x.m.thumb.size) || 0), 0);
    const est = TSF.estimateBundle(S.ad, sizes, thumbs);
    const encOn = S.ad.encrypt && S.ad.encrypt.enabled && S.sc && S.sc.C5 && S.sc.C5.s === 'ok';
    const shareFallback = !(S.sc && S.sc.C6 && S.sc.C6.s === 'ok');
    const b = S.built;
    const modes = [['daily', '매일 보내기', '새 기록과 새 사진·동영상·음성을 보냅니다(기본).'], ['original', '원본 보내기', '가볍게 보냈던 사진과 동영상의 원본을 보냅니다.'], ['all', '전부 다시 보내기', '모든 원본을 다시 보냅니다. 사내에서 중복은 걸러 냅니다.']];
    const mem = MEM();
    return `<div class="qhead"><h1>보내기</h1></div>
      ${mem && !b ? `<div class="band coral"><img src="${IMG.warning}" alt=""><div>이 열기 방식에서는 기록이 저장되지 않습니다. 닫기 전에 아래 <b>「묶음 만들기·보내기」</b>를 누르고 조각을 모두 <b>「메일로 보내기」</b>까지 마쳐 주세요.</div></div>` : ''}
      ${b ? builtHtml(b, shareFallback) : `
      <div class="card rise" style="--i:0"><h2>보낼 내용</h2>
        <div class="sum">
          <div class="kpi"><b data-count="${newE}">${newE}</b><span>새 기록</span></div>
          <div class="kpi"><b data-count="${chE}">${chE}</b><span>바뀐 기록</span></div>
          <div class="kpi"><b data-count="${gm}">${gm}</b><span>등급</span></div>
          <div class="kpi"><b data-count="${cnt('image/')}">${cnt('image/')}</b><span>사진</span></div>
          <div class="kpi"><b data-count="${cnt('video/')}">${cnt('video/')}</b><span>동영상</span></div>
          <div class="kpi"><b data-count="${cnt('audio/')}">${cnt('audio/')}</b><span>음성</span></div>
        </div>
        ${del ? `<p class="hint">삭제 표시 ${del}건도 함께 보냅니다(사내에서 영구 삭제하지 않습니다).</p>` : ''}
        <p style="margin:12px 0 0"><b>약 ${fmtMB(est.total + 200 * 1024)}, 메일 ${est.parts}통으로 나뉩니다.</b> <span class="muted small">(조각 1개 ${S.ad.limits.partMB || 20}MB 이하)</span></p>
      </div>
      <div class="card rise" style="--i:1"><h2>보내는 방식</h2><div class="mode">${modes.map(([k, t, d]) => `<label class="${mode === k ? 'on' : ''}"><input type="radio" name="mode" value="${k}" data-change="mode" ${mode === k ? 'checked' : ''}><span><b>${t}</b><small>${d}</small></span></label>`).join('')}</div>
        ${mode === 'daily' && origDaily > 100 * 1048576 ? `<div class="band amber" style="margin:12px 0 0"><img src="${IMG.warning}" alt=""><div>원본 합계가 약 ${fmtMB(origDaily)}입니다. 「가벼운 보내기」(사진 긴 변 2560px, 동영상은 썸네일만)를 권합니다. 원본은 나중에 「원본 보내기」로 보냅니다.
          <div class="toggle"><span>가벼운 보내기</span><button class="switch ${light ? 'on' : ''}" data-act="light" aria-pressed="${light}" aria-label="가벼운 보내기"></button></div></div></div>` : ''}
      </div>
      ${encOn ? `<div class="card rise" style="--i:2"><h2>암호화(선택 기능)</h2><label class="field"><span>출국 전에 전화·대면으로 정한 암호문(6자리 이상)</span><input type="password" id="encPass" autocomplete="off"></label><p class="hint">암호문은 이 기기에 저장하지 않습니다. 비워 두면 암호화하지 않습니다.</p></div>` : ''}
      <div class="card rise" style="--i:3"><h2>받는 사람</h2><p class="muted small" style="margin:0">메일 주소는 앱에 넣지 않습니다. 메일 앱에서 국내 담당 컨설턴트 회사 메일을 골라 주세요.</p></div>
      ${S.building ? `<div class="card"><b>${esc(S.building)}</b><div class="prog"><i style="width:${S.buildPct || 5}%"></i></div></div>` : `<button class="btn wide ${mem ? 'big danger' : ''}" data-act="build" ${sel.out.length + ue.length + unsentMarks().length === 0 && mode === 'daily' ? 'disabled' : ''}>${mem ? '묶음 만들기·보내기' : '묶음 만들기'}</button>`}`}
      ${S.sends.length ? `<div class="card" style="margin-top:12px"><h2>보낸 묶음</h2>${S.sends.slice(0, 10).map((s) => `<div class="part"><div><b class="num" title="${esc(s.bundleId)}">${esc(refLabel(s.bundleId))}</b><small>${esc(hm(s.createdAt))} · 조각 ${s.parts.length}개 · 공유 ${s.parts.filter((p) => p.shared).length}/${s.parts.length}</small></div>${isSent(s) ? '<span class="tag t-mint">보냄</span>' : `<button class="btn ghost" style="min-height:40px" data-act="reopenSend" data-id="${esc(s.bundleId)}">조각 보기</button>`}</div>`).join('')}</div>` : ''}`;
  }
  function builtHtml(b, shareFallback) {
    const memDone = isSent(b)
      ? `<div class="card sentdone rise" style="--i:0" role="status"><h2>보냈습니다</h2><p style="margin:0">메일로 보낸 뒤에 앱을 닫아도 됩니다.</p></div>`
      : MEM() ? `<div class="band coral"><img src="${IMG.warning}" alt="">조각을 모두 「메일로 보내기」 하기 전에 닫으면 기록이 사라집니다.</div>` : '';
    return `${memDone}${say('reporter', '보낸 기록은 주간보고 재료로 모아 두겠습니다.')}
      <div class="card rise" style="--i:1"><h2 title="${esc(b.bundleId)}">${esc(refLabel(b.bundleId))} <small>조각 ${b.parts.length}개${b.light ? ' · 가벼운 보내기' : ''}</small></h2>
        ${b.parts.map((p) => `<div class="part"><div><b>조각 ${p.n} / ${b.parts.length}</b><small>${esc(p.name)} · ${fmtMB(p.size)}</small>${p.shared ? `<span class="tag t-mint" style="margin:0">${p.shared === 'download' ? '내려받음' : '공유함'}</span>` : ''}</div>
          <div class="pbtns"><button class="btn ${p.shared ? 'ghost' : ''}" data-act="sharePart" data-n="${p.n}"><img src="${IMG.mail}" alt="" width="22">메일로 보내기 ${p.n}/${b.parts.length}</button>${MEM() ? `<button class="btn line" data-act="dlPart" data-n="${p.n}">내려받기 ${p.n}/${b.parts.length}</button>` : ''}</div></div>`).join('')}
        <p class="hint">공유 화면을 연 것만으로는 실제 발송을 알 수 없어 「공유함」까지만 표시합니다. 조각을 모두 공유하면 「보냄」으로 표시합니다.</p>
      </div>
      ${shareFallback ? `<div class="card rise" style="--i:2"><h2>공유가 안 될 때</h2><p class="muted small">조각 파일을 다운로드 폴더에 저장합니다. 그다음:</p><ol class="steps"><li>「내 파일」 앱 → 다운로드</li><li>조각 파일을 길게 누르기</li><li>공유 → 메일 앱</li><li>국내 담당 컨설턴트에게 보내기</li></ol></div>` : ''}
      <div class="row"><button class="btn line grow" data-act="closeBuilt">닫기</button></div>`;
  }
  /* 보냄 = 조각을 모두 공유했거나 내려받음(D93: 반입 확인 코드 단계 없음) */
  function isSent(s) { return !!(s && s.parts.length && s.parts.every((p) => p.shared)); }
  function sentPurge() {
    const ids = new Set(S.sends.filter(isSent).map((s) => s.bundleId));
    const ms = [...S.media.values()].filter((m) => m.blob && ids.has(m.sentIn) && m.sentVariant === 'original');
    const ss = S.sends.filter((s) => ids.has(s.bundleId) && s.parts.some((p) => p.blob));
    const size = ms.reduce((a, m) => a + m.blob.size, 0) + ss.reduce((a, s) => a + s.parts.reduce((b, p) => b + ((p.blob && p.blob.size) || 0), 0), 0);
    return { ms, ss, size };
  }

  /* S9 설정 */
  function vS9() {
    const sizes = { image: 0, video: 0, audio: 0, thumb: 0, parts: 0 }, pg = sentPurge();
    for (const m of S.media.values()) {
      const k = (m.mime || '').split('/')[0];
      if (m.blob && sizes[k] != null) sizes[k] += m.blob.size;
      if (m.thumb) sizes.thumb += m.thumb.size;
    }
    S.sends.forEach((s) => s.parts.forEach((p) => { if (p.blob) sizes.parts += p.blob.size; }));
    const sc = S.sc || {};
    return `${bigCard(0)}<div class="card rise" style="--i:0"><h2>기록자</h2><div class="chips">${S.recs.map((i) => `<button class="chip ${S.by === i ? 'on' : ''}" data-act="setBy" data-i="${esc(i)}">${esc(i)}</button>`).join('')}<button class="chip" data-act="addRec">다른 사람 추가</button></div></div>
      <div class="card rise" style="--i:1"><h2>기기 정보</h2>
        <p style="margin:0">기기 ID <b class="num">${esc(S.dev)}</b></p>
        <label class="field"><span>기기 별명</span><input type="text" data-commit="alias" value="${esc(S.alias)}" placeholder="예: ${esc(S.by || 'KJ')} 갤럭시" maxlength="20"></label>
        <p class="small muted">자가 진단: ${TSF.selfCheck.ITEMS.map(([k]) => `${k} ${({ ok: '통과', warn: '경고', fail: '실패', fallback: '대체', todo: '확인 전' })[(sc[k] || {}).s || 'todo']}`).join(' · ')}</p>
        <button class="btn ghost wide" data-act="go" data-v="s0">기기 점검 다시 하기</button></div>
      <div class="card rise" style="--i:2"><h2>저장 공간 <small>${S.free != null ? '남은 공간 약 ' + fmtMB(S.free) : ''}</small></h2>
        <p class="small" style="margin:0">사진 ${fmtMB(sizes.image)} · 동영상 ${fmtMB(sizes.video)} · 음성 ${fmtMB(sizes.audio)} · 썸네일 ${fmtMB(sizes.thumb)} · 보낸 조각 ${fmtMB(sizes.parts)}</p>
        <button class="btn line wide" style="margin-top:10px" data-act="purge" ${pg.size ? '' : 'disabled'}>보낸 묶음의 원본 정리(${pg.ms.length}개, ${fmtMB(pg.size)})</button>
        <p class="hint">「보냄」으로 표시된 묶음의 원본과 조각 파일만 지웁니다. 사무실 반입 전이라면 남겨 두세요. 썸네일과 기록은 프로젝트가 끝날 때까지 남깁니다.</p></div>
      <div class="card rise" style="--i:3"><h2>기록 보호 <small>마지막 백업 ${esc(ago(S.bkCfg.at))}</small></h2>
        <p style="margin:0 0 8px">입력은 누르는 즉시 폰 안에 저장됩니다. 폰을 잃거나 앱이 지워질 때를 대비해 기록이 쌓이면 백업 파일을 저장하라고 알려 드립니다.</p>
        <div class="toggle"><b>백업 알림</b><span class="chips">${[5, 10, 20].map((k) => `<button class="chip ${S.bkCfg.every === k ? 'on' : ''}" data-act="bkEvery" data-k="${k}">${k}건마다</button>`).join('')}</span></div>
        <p class="small muted" style="margin:6px 0 10px">백업 뒤 기록 ${bkPending()}건 · 영구 저장 ${S.persisted ? '허용됨' : '허용 안 됨(설치 권장)'}</p>
        <div class="row"><button class="btn grow" data-act="saveBackup">백업 파일 저장</button><button class="btn line grow" data-act="pickBackup">백업 불러오기</button></div>
        <p class="hint">백업 불러오기: 새로 설치한 앱에서 프로젝트 자료(.tspack)를 먼저 불러온 뒤, 「내 파일 → 다운로드」의 TS현장백업 파일을 모두 고릅니다. 보내기 조각 파일도 됩니다.</p></div>
      <div class="card rise" style="--i:3"><h2>잠금</h2><p class="small muted" style="margin:0 0 8px">숫자 4~6자리. 5분 동안 쓰지 않으면 다시 잠깁니다.</p>
        <div class="row"><button class="btn ghost grow" data-act="setLock">잠금 번호 정하기</button><button class="btn line grow" data-act="clearLock">잠금 끄기</button></div></div>
      <div class="card rise" style="--i:4"><h2>카메라 권장 설정</h2><ul class="small" style="margin:0;padding-left:18px"><li>사진 12MP(4:3), 고효율 사진(HEIF) 끄기</li><li>동영상 FHD 30fps, 한 번에 30초 이하</li><li>위치 태그 끄기 권장</li><li>얼굴·번호판·사원증이 보이면 기록에서 「개인정보 포함」을 켜 주세요</li></ul></div>
      <div class="card rise" style="--i:5"><h2>프로젝트</h2><p class="small" style="margin:0">${esc(S.ad.project.codeName)} · ${esc(S.ad.round.label)} · 사업장 유형 ${esc(SITE[S.ad.project.siteType] || S.ad.project.siteType)}</p>
        <div class="row" style="margin-top:10px"><button class="btn ghost grow" data-act="pickPack">프로젝트 불러오기</button>${SINGLE ? '' : '<button class="btn line grow" data-act="switchProj">다른 프로젝트</button>'}</div>
        <p class="hint">같은 프로젝트의 새 자료(자료 번호가 더 큰 파일)를 불러오면 기존 기록은 그대로 두고 문항·장소만 바꿉니다.</p></div>
      <div class="card rise" style="--i:6"><h2>앱 정보</h2><p class="small num" style="margin:0">앱 버전 ${TSF.APP_VERSION} · ${SINGLE ? '파일 하나(A안)' : '설치형(B안)'}<br>자료 번호(dataRev) ${S.ad.dataRev} · 자료 판 v${S.ad.version || 1}<br>문항집 버전 ${esc(S.ad.bank.bankVersion)}<br>만료일 ${esc(S.ad.expiresAt || '-')}${expired() ? ' (만료됨)' : ''}</p></div>`;
  }

  /* ── 잠금 ── */
  async function pinHash(pin, salt) { return TSF.sha256Hex(salt + ':' + pin); }
  function lockScreen() {
    if ($('#lock')) return;
    const el = document.createElement('div');
    el.className = 'lock'; el.id = 'lock';
    el.innerHTML = `<img src="${IMG.icon}" alt=""><b>잠금 번호를 넣어 주세요</b><input type="password" inputmode="numeric" maxlength="6" id="pin" autocomplete="off"><button class="btn" id="pinOk">열기</button><p class="hint" id="pinMsg"></p>`;
    document.body.appendChild(el);
    const tryOpen = async () => {
      const lock = await S.db.meta('lock');
      const v = $('#pin').value;
      if (lock && (await pinHash(v, lock.salt)) === lock.hash) { S.locked = false; S.idleAt = Date.now(); el.remove(); }
      else { $('#pinMsg').textContent = '번호가 맞지 않습니다. 다시 넣어 주세요.'; $('#pin').value = ''; }
    };
    $('#pinOk').onclick = tryOpen;
    $('#pin').onkeydown = (e) => e.key === 'Enter' && tryOpen();
    setTimeout(() => $('#pin') && $('#pin').focus(), 100);
  }
  setInterval(async () => {
    if (!S.db || S.locked || Date.now() - S.idleAt < 5 * 60000) return;
    if (await S.db.meta('lock', null)) { S.locked = true; lockScreen(); }
  }, 15000);
  ['pointerdown', 'keydown'].forEach((t) => addEventListener(t, () => (S.idleAt = Date.now()), true));

  /* ── 촬영 ── */
  const CAP = { ctx: null };
  function capture(kind, ctx) {
    if (blocked()) return;
    if (S.sc && S.sc.C1 && S.sc.C1.s === 'fail' && TSF.storageMode !== 'memory') { toast('이 방식으로는 기록을 저장할 수 없습니다. 설치형(B안) 주소로 열어 주세요.', { img: IMG.warning }); return; }
    if (kind === 'video' && lowSpace()) { toast('남은 공간이 500MB 미만이라 동영상을 막았습니다. 사진은 찍을 수 있습니다.', { img: IMG.warning }); return; }
    CAP.ctx = Object.assign({ kind }, ctx);
    const inp = { photo: '#inPhoto', video: '#inVideo', gallery: '#inGallery' }[kind];
    $(inp).value = ''; $(inp).click();
  }
  function ctxHere(quick) {
    const pl = WORK.includes(S.view) && S.place ? S.place : 'PL-99';
    if (quick || S.view !== 's4' && !(S.lastLayout !== 'phone' && WORK.includes(S.view) && (S.seq != null || S.outView))) return { place: pl, seq: null, quick: true };
    if (S.outView && S.place !== 'PL-99') return { place: S.place, seq: null, outside: true };
    const rt = retakeFor(S.seq, S.place);
    return { place: S.place, seq: S.seq, retakeOf: rt ? rt.id : null };
  }
  async function onFiles(input) {
    const ctx = CAP.ctx; const files = [...input.files];
    if (!ctx || !files.length) return;
    let last = null;
    for (const f of files) {
      const t = f.type || '';
      if (t.startsWith('audio/')) continue; // 음성 기록은 새로 만들지 않는다(D77)
      const kind = t.startsWith('video/') ? 'video' : 'photo';
      const source = ctx.kind === 'gallery' ? 'gallery' : 'camera';
      const takenAt = source === 'gallery' && f.lastModified ? isoLocal(new Date(f.lastModified)) : isoLocal();
      if (kind === 'video' && lowSpace()) continue;
      last = await addEntry({ kind, files: [{ blob: f, name: f.name, source, takenAt }], place: ctx.place, seq: ctx.seq, outside: ctx.outside, retakeOf: kind === 'photo' ? ctx.retakeOf : null });
    }
    if (!last) return;
    if (ctx.quick) { render(); quickSheet(last); return; }
    render();
    if (last.kind === 'photo' && ctx.kind === 'photo') moreOne();
  }
  function moreOne() {
    const old = $('#more1'); if (old) old.remove();
    const b = document.createElement('button');
    b.className = 'btn more1'; b.id = 'more1'; b.innerHTML = `${ICO.camera.replace('<svg', '<svg width="22" height="22"')}한 장 더`;
    b.onclick = () => { b.remove(); capture('photo', CAP.ctx); };
    $('#layer').appendChild(b);
    setTimeout(() => b.remove(), 3000);
  }
  /* S5 빠른 기록: 촬영 뒤 장소·한 줄 메모·음성 덧붙이기만 받는다(문항은 고르지 않음) */
  function quickSheet(e) {
    const sh = sheet(`<h3>빠른 기록</h3><p class="muted small" style="margin:0 0 8px">${esc(KIND[e.kind])}을 저장했습니다. 문항은 사내에서 붙입니다.</p>
      ${e.media[0] && thumbUrl(e.media[0].id) ? `<img class="preview" src="${thumbUrl(e.media[0].id)}" alt="">` : ''}
      <label class="field"><span>장소</span><select id="qPlace">${places().map((p) => `<option value="${esc(p.id)}" ${p.id === e.place ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}<option value="PL-99" ${e.place === 'PL-99' ? 'selected' : ''}>장소 밖 기록(기타)</option></select></label>
      <label class="field"><span>한 줄 메모</span><input type="text" id="qMemo" maxlength="200" placeholder="본 것을 그대로. 숫자는 단위와 함께"></label>
      <div class="toggle"><span>개인정보 포함(얼굴·번호판·사원증)</span><button class="switch" id="qPii" aria-pressed="false"></button></div>
      <p class="hint">음성은 메모·문항 메모 칸에서 키보드 마이크(받아쓰기)로 남깁니다.</p>
      <div class="acts"><button class="btn" id="qDone">마치기</button></div>`);
    const save = async () => {
      const cur = S.entries.get(e.id);
      const patch = {};
      const pl = sh.querySelector('#qPlace').value, memo = sh.querySelector('#qMemo').value.trim(), pii = sh.querySelector('#qPii').classList.contains('on');
      if (pl !== cur.place) patch.place = pl;
      if (memo !== (cur.memo || '')) patch.memo = memo;
      if (pii !== !!(cur.media[0] && cur.media[0].pii)) patch.media = cur.media.map((m) => Object.assign({}, m, { pii }));
      if (Object.keys(patch).length) await updateEntry(cur, patch);
      if (memo && TSF.looksLikeContact(memo)) toast('개인 연락처가 들어간 것 같습니다. 꼭 필요한 내용인지 확인해 주세요.', { img: IMG.warning });
    };
    sh.querySelector('#qPii').onclick = (ev) => { ev.currentTarget.classList.toggle('on'); save(); };
    sh.querySelector('#qMemo').onchange = save;
    sh.querySelector('#qDone').onclick = async () => { await save(); closeSheet(); render(); };
    sh.querySelector('#qPlace').onchange = save;
  }
  /* 음성 기록(D76)은 D77로 새로 만들지 않는다. 받은 음성 기록은 상세 시트에서 읽고 받아쓰기만 고칠 수 있다 */

  /* ── 기록 상세·메모·해당없음 시트 ── */
  function memoSheet() {
    const ctx = ctxHere(false);
    const sh = sheet(`<h3>메모 남기기</h3><textarea id="mm" maxlength="2000" data-draft="memo:new" placeholder="본 것을 그대로 적어 주세요. 숫자는 단위와 함께"></textarea>
      <div class="chips" style="margin-top:8px">${QUICK_TAGS.map((t) => `<button class="chip" data-tag="${t}">${t}</button>`).join('')}</div>
      <div class="acts"><button class="btn line" id="mmX">닫기</button><button class="btn" id="mmOk">남기기</button></div>`);
    const ta = sh.querySelector('#mm');
    S.db.get('draft', 'memo:new').then((d) => { if (d && !ta.value) ta.value = d.value; });
    ta.addEventListener('input', () => draftSave('memo:new', ta.value));
    sh.querySelectorAll('[data-tag]').forEach((b) => (b.onclick = () => { ta.value = (ta.value.trim() + ' ' + b.dataset.tag).trim(); draftSave('memo:new', ta.value); }));
    sh.querySelector('#mmX').onclick = closeSheet;
    sh.querySelector('#mmOk').onclick = async () => {
      const v = ta.value.trim(); if (!v) { ta.focus(); return; }
      if (TSF.looksLikeContact(v)) toast('개인 연락처가 들어간 것 같습니다. 꼭 필요한 내용인지 확인해 주세요.', { img: IMG.warning });
      await addEntry({ kind: 'memo', memo: v, place: ctx.place, seq: ctx.seq, outside: ctx.outside });
      await S.db.del('draft', 'memo:new'); closeSheet(); render();
    };
    setTimeout(() => ta.focus(), 200);
  }
  function entrySheet(id) {
    const e = S.entries.get(id); if (!e) return;
    const m0 = e.media[0], rec = m0 && S.media.get(m0.id);
    let prev = '';
    if (rec && rec.blob) {
      const u = URL.createObjectURL(rec.blob);
      prev = e.kind === 'photo' ? `<img class="preview" src="${u}" alt="">` : e.kind === 'video' ? `<video class="preview" src="${u}" controls playsinline></video>` : `<audio src="${u}" controls style="width:100%"></audio>`;
    } else if (m0) prev = rec && rec.thumb ? `<img class="preview" src="${thumbUrl(m0.id)}" alt=""><p class="hint">원본은 사내 반입 확인 후 정리했습니다.</p>` : '';
    const q = e.seq == null ? null : qOf(e.seq);
    const sh = sheet(`<h3>${esc(KIND[e.kind])} 기록 <span class="muted small num" title="${esc(e.id)}">${esc(refLabel(e.id))}</span></h3>${prev}
      <p class="small muted">${esc(hm(e.at))} · ${esc(placeOf(e.place).name)} · ${seqLabel(e)}${isOut(e) && e.outsideReason ? ' (' + esc(e.outsideReason) + ')' : ''} · ${esc(e.by)}${e.retakeOf ? ' · ' + esc(e.retakeOf) : ''}${m0 && m0.source === 'gallery' ? ' · 갤러리' : ''}</p>
      ${e.kind === 'audio' ? `<label class="field"><span>받아쓰기 ${e.transcriptStatus === 'draft' ? '(초안)' : '(아직 없음)'}</span><textarea id="esTr" maxlength="2000" placeholder="키보드 마이크 단추로 받아쓰기">${esc(e.transcript || '')}</textarea></label>` : ''}
      <label class="field"><span>메모</span><textarea id="esMemo" maxlength="2000" placeholder="본 것을 그대로. 숫자는 단위와 함께">${esc(e.memo || '')}</textarea></label>
      ${m0 && e.kind !== 'memo' ? `<div class="toggle"><span>개인정보 포함(얼굴·번호판·사원증)</span><button class="switch ${m0.pii ? 'on' : ''}" id="esPii"></button></div>` : ''}
      <div class="acts"><button class="btn danger" id="esDel">지우기</button><button class="btn" id="esOk">저장</button></div>`);
    const pii = sh.querySelector('#esPii'); if (pii) pii.onclick = () => pii.classList.toggle('on');
    sh.querySelector('#esOk').onclick = async () => {
      const patch = {};
      const memo = sh.querySelector('#esMemo').value.trim();
      if (memo !== (e.memo || '')) patch.memo = memo;
      const tr = sh.querySelector('#esTr');
      if (tr && tr.value.trim() !== (e.transcript || '')) Object.assign(patch, tr.value.trim() ? { transcript: tr.value.trim(), transcriptStatus: 'draft', transcriptBy: 'tool:keyboard' } : { transcript: null, transcriptStatus: 'waiting', transcriptBy: null });
      if (pii && pii.classList.contains('on') !== !!m0.pii) patch.media = e.media.map((m) => Object.assign({}, m, { pii: pii.classList.contains('on') }));
      if (Object.keys(patch).length) await updateEntry(e, patch);
      if (memo && TSF.looksLikeContact(memo)) toast('개인 연락처가 들어간 것 같습니다. 꼭 필요한 내용인지 확인해 주세요.', { img: IMG.warning });
      closeSheet(); render();
    };
    sh.querySelector('#esDel').onclick = () => { closeSheet(); deleteEntries([e.id]); };
  }
  /* 문항 외 참고로 옮길 때 이유 한 줄은 필수(D79 보완) */
  function outReasonSheet(onOk) {
    const sh = sheet(`<h3>문항 외 참고로 옮기기</h3><p class="muted small">고른 기록 ${S.pick.size}건에 맞는 문항이 없는 이유를 한 줄로 적어 주세요. 점수에는 넣지 않고 사내에서 발견사항 근거로 씁니다.</p>
      <label class="field"><span>이유(필수)</span><input type="text" id="orR" maxlength="200" placeholder="예: 357문항에 해당 항목 없음 — 볼라드 시설"></label>
      <div class="acts"><button class="btn line" id="orX">그만두기</button><button class="btn" id="orOk">옮기기</button></div>`);
    sh.querySelector('#orX').onclick = closeSheet;
    sh.querySelector('#orOk').onclick = () => {
      const r = sh.querySelector('#orR').value.trim();
      if (!r) { sh.querySelector('#orR').focus(); toast('문항 외 참고는 이유를 적어야 옮겨집니다.'); return; }
      onOk(r);
    };
    setTimeout(() => sh.querySelector('#orR').focus(), 200);
  }
  /* 삭제는 묘비 표시(deleted:true)와 5초 되돌리기 */
  async function deleteEntries(ids) {
    const olds = ids.map((i) => S.entries.get(i)).filter(Boolean);
    for (const e of olds) await updateEntry(e, { deleted: true }, 'entry.delete');
    S.pick.clear(); render();
    toast(`기록 ${olds.length}건을 지웠습니다.`, { img: IMG.approve, action: '되돌리기', ms: 5000, onAction: async () => { for (const e of olds) await updateEntry(S.entries.get(e.id), { deleted: false }, 'entry.restore'); render(); } });
  }
  function naSheet(seq) {
    const m = markOf(seq);
    const sh = sheet(`<h3>해당없음으로 표시</h3><p class="muted small">문항 ${seq} · ${esc((qOf(seq) || {}).text || '')}</p>
      <label class="field"><span>사유(필수)</span><input type="text" id="naR" maxlength="200" value="${esc(m && m.na ? m.naReason : '')}" placeholder="예: 이 사업장에는 시료센터가 없음"></label>
      <div class="acts">${m && m.na ? '<button class="btn line" id="naOff">해당없음 풀기</button>' : '<button class="btn line" id="naX">그만두기</button>'}<button class="btn" id="naOk">표시하기</button></div>`);
    const x = sh.querySelector('#naX'); if (x) x.onclick = closeSheet;
    const off = sh.querySelector('#naOff'); if (off) off.onclick = async () => { await setMark(seq, { na: false, naReason: '' }); closeSheet(); render(); };
    sh.querySelector('#naOk').onclick = async () => {
      const r = sh.querySelector('#naR').value.trim();
      if (!r) { sh.querySelector('#naR').focus(); toast('해당없음은 사유를 적어야 표시됩니다.'); return; }
      await setMark(seq, { na: true, naReason: r, grade: null }); closeSheet(); render();
    };
    setTimeout(() => sh.querySelector('#naR').focus(), 200);
  }
  async function setGrade(g) {
    const seq = S.seq, m = markOf(seq);
    if (m && m.grade === g) {
      confirmSheet('등급 지우기', `${gradeText(g)} 표시를 지웁니다. 등급은 나중에 agent가 제안합니다.`, '지우기', async () => { await setMark(seq, { grade: null }); render(); }, true);
      return;
    }
    if (!(await setMark(seq, { grade: g, na: false, naReason: '' }))) return; // 막힘(메모리 저장소·만료)
    const hasEv = entriesAt(null, seq).some((e) => e.by === S.by) || (markOf(seq).memo || '').trim();
    render();
    if (!hasEv) toast('근거(사진·메모)가 없는 등급입니다. 사진이나 메모를 하나 남겨 주시면 좋겠습니다.', { img: IMG.reviewer, ms: 4500 });
  }

  /* ── 묶음 만들기·공유 ── */
  async function build() {
    if (S.building) return;
    const mode = S.settings.sendMode || 'daily', light = !!S.settings.light && mode === 'daily';
    const passEl = $('#encPass'); const pass = passEl ? passEl.value : '';
    if (pass && pass.length < 6) { toast('암호문은 6자리 이상이어야 합니다.'); return; }
    S.building = '보낼 자료를 모으는 중'; S.buildPct = 5; render();
    try {
      const sel = selection(mode, light);
      const media = [];
      for (const x of sel.out) {
        let blob = x.m.blob, sha = x.m.sha256, variant = x.variant;
        if (variant === 'light') {
          try { const lb = await TSF.lightPhoto(blob); if (lb !== blob) { blob = lb; sha = await TSF.sha256Hex(lb); } } catch (e) { variant = 'original'; }
        }
        const meta = (x.e && x.e.media.find((mm) => mm.id === x.m.id)) || {};
        media.push({ id: x.m.id, name: variant === 'light' ? x.m.id + '.jpg' : meta.name || x.m.id, mime: variant === 'light' ? 'image/jpeg' : x.m.mime, size: blob.size, sha256: sha, variant, blob });
      }
      const thumbs = sel.out.map((x) => x.m).concat(sel.skip).filter((m) => m.thumb).map((m) => ({ id: m.id, blob: m.thumb }));
      const seq = ((await S.db.meta('bundleSeq', 0)) || 0) + 1;
      const logs = await S.db.all('log');
      const r = await TSF.buildBundle({
        appData: S.ad, device: { id: S.dev, alias: S.alias }, by: S.by, selfCheck: TSF.selfCheck.toManifest(S.sc), mode, bundleSeq: seq,
        prevBundleId: S.sends[0] ? S.sends[0].bundleId : null, entries: [...S.entries.values()], marks: [...S.marks.values()], media, thumbs, log: logs, passphrase: pass,
        onProgress: (n, m) => { S.building = `조각 ${n} / ${m} 만드는 중`; S.buildPct = Math.round((n / m) * 90); render(); },
      });
      const send = { bundleId: r.bundleId, createdAt: r.createdAt, mode, light, receiptCode: r.receiptCode, encrypted: r.encrypted, confirmed: false, confirmedAt: null, counts: r.manifest.counts, mediaIds: media.map((m) => m.id), parts: r.parts.map((p) => ({ n: p.n, name: p.name, size: p.size, sha256: p.sha256, shared: false, blob: p.blob })) };
      const now = isoLocal();
      const touchedE = [...S.entries.values()].map((e) => Object.assign({}, e, { _sentRev: e.rev }));
      const touchedM = [...S.marks.values()].map((m) => Object.assign({}, m, { _sentRev: m.rev }));
      const sentVar = new Map(media.map((m) => [m.id, m.variant]));
      const touchedMedia = [];
      for (const m of S.media.values()) {
        if (sentVar.has(m.id)) touchedMedia.push(Object.assign({}, m, { sentIn: r.bundleId, sentVariant: sentVar.get(m.id) }));
        else if (sel.skip.includes(m)) touchedMedia.push(Object.assign({}, m, { sentIn: r.bundleId, sentVariant: 'thumb' }));
      }
      await S.db.tx(['sends', 'entries', 'marks', 'media', 'meta', 'log'], (t) => {
        t.sends.put(send); t.meta.put({ key: 'bundleSeq', value: seq });
        touchedE.forEach((e) => t.entries.put(e)); touchedM.forEach((m) => t.marks.put(m)); touchedMedia.forEach((m) => t.media.put(m));
        t.log.add({ at: now, act: 'bundle', id: r.bundleId, by: S.by, device: S.dev, parts: r.parts.length });
      });
      touchedE.forEach((e) => S.entries.set(e.id, e)); touchedM.forEach((m) => S.marks.set(m.id, m)); touchedMedia.forEach((m) => S.media.set(m.id, m));
      S.sends.unshift(send);
      S.built = send;
      S.bk = null; bkSchedule(); // 미리 만든 백업은 묶음 번호가 겹치므로 다시 만든다
      S.building = null; render(true);
    } catch (err) {
      S.building = null; render();
      toast('묶음을 만들지 못했습니다. 기록은 그대로 남아 있습니다. 저장 공간을 확인한 뒤 다시 눌러 주세요.', { img: IMG.warning, ms: 6000 });
      console.error(err);
    }
  }
  async function sharePart(n) {
    const b = S.built; const p = b && b.parts.find((x) => x.n === n);
    if (!p || !p.blob) { toast('조각 파일이 정리되어 다시 보낼 수 없습니다. 「전부 다시 보내기」로 새 묶음을 만들어 주세요.'); return; }
    const file = new File([p.blob], p.name, { type: 'application/zip' });
    const text = `TS현장 ${String(S.ad.project.codeName).replace(/\s+/g, '')} ${S.by} ${hm(b.createdAt)} 묶음 ${n}/${b.parts.length}`;
    let how = null;
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: p.name, text }); how = 'share'; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    if (!how) {
      saveFile(file, p.name);
      how = 'download';
      toast('조각을 다운로드 폴더에 저장했습니다. 「내 파일」에서 길게 눌러 메일로 공유해 주세요.', { img: IMG.mail, ms: 5000 });
    }
    p.shared = how;
    await S.db.put('sends', b);
    render();
  }
  /* 메모리 저장소: 공유 대신 바로 내려받기(D95 ②) */
  async function dlPart(n) {
    const b = S.built, p = b && b.parts.find((x) => x.n === n);
    if (!p || !p.blob) return;
    saveFile(new File([p.blob], p.name, { type: 'application/zip' }), p.name);
    p.shared = 'download'; await S.db.put('sends', b); render();
    toast('조각을 다운로드 폴더에 저장했습니다. 「내 파일」에서 길게 눌러 메일로 보내 주세요.', { img: IMG.mail, ms: 5000 });
  }
  async function purge() {
    const pg = sentPurge();
    confirmSheet('원본 정리', `보낸 묶음에 들어간 원본 ${pg.ms.length}개를 폰에서 지웁니다. 사무실 반입 전이라면 남겨 두세요.`, '정리하기', async () => {
      const cur = sentPurge();
      const ms = cur.ms.map((m) => Object.assign({}, m, { blob: null, purged: true }));
      const ss = cur.ss.map((s) => Object.assign({}, s, { parts: s.parts.map((p) => Object.assign({}, p, { blob: null })) }));
      await S.db.tx(['media', 'sends', 'log'], (t) => { ms.forEach((m) => t.media.put(m)); ss.forEach((s) => t.sends.put(s)); t.log.add({ at: isoLocal(), act: 'purge', id: String(ms.length), by: S.by, device: S.dev }); });
      ms.forEach((m) => S.media.set(m.id, m));
      S.sends = S.sends.map((s) => ss.find((x) => x.bundleId === s.bundleId) || s);
      toast(`원본 ${ms.length}개를 정리했습니다.`, { img: IMG.approve });
      refreshFree.t = 0; await refreshFree(); render();
    }, true);
  }

  /* ── 기록자 ── */
  function recSheet() {
    const sh = sheet(`<h3>기록자 바꾸기</h3><p class="muted small">같은 기기에서 기록자를 바꾸면 그 기록자의 등급·메모 칸이 따로 열립니다.</p>
      <div class="chips">${S.recs.map((i) => `<button class="chip ${S.by === i ? 'on' : ''}" data-i="${esc(i)}">${esc(i)}</button>`).join('')}</div>
      <div class="acts"><button class="btn line" id="rsAdd">다른 사람 추가</button><button class="btn" id="rsX">닫기</button></div>`);
    sh.querySelectorAll('[data-i]').forEach((b) => (b.onclick = async () => { await setBy(b.dataset.i); closeSheet(); }));
    sh.querySelector('#rsAdd').onclick = () => { closeSheet(); addRec(); };
    sh.querySelector('#rsX').onclick = closeSheet;
  }
  async function setBy(i) { S.by = i; await S.db.setMeta('recorders', { list: S.recs, cur: i }); render(); }
  function addRec() {
    const sh = sheet(`<h3>다른 사람 추가</h3><label class="field"><span>이니셜 2~3자(영문 대문자)</span><input type="text" id="ini" maxlength="3" autocapitalize="characters" placeholder="예: PH"></label><div class="acts"><button class="btn line" id="iniX">그만두기</button><button class="btn" id="iniOk">추가하기</button></div>`);
    sh.querySelector('#iniX').onclick = closeSheet;
    sh.querySelector('#iniOk').onclick = async () => {
      const v = sh.querySelector('#ini').value.trim().toUpperCase();
      if (!/^[A-Z]{2,3}$/.test(v)) { toast('이니셜은 영문 대문자 2~3자로 넣어 주세요.'); return; }
      if (!S.recs.includes(v)) S.recs.push(v);
      closeSheet(); await setBy(v);
    };
    setTimeout(() => sh.querySelector('#ini').focus(), 200);
  }

  /* ── 입력 임시 저장(300ms, 5-4-9) ── */
  const draftTimers = {};
  function draftSave(key, value) {
    clearTimeout(draftTimers[key]);
    draftTimers[key] = setTimeout(() => S.db.put('draft', { key, value, at: isoLocal() }), 300);
  }

  /* ── 동작 연결 ── */
  const ACT = {
    home: () => go('s1'),
    bigText: () => { bigText(pref('big') !== '1'); render(); },
    go: (el) => { if (el.dataset.v === 's7') S.built = null; if (el.dataset.v === 's0') runSelfCheck(); go(el.dataset.v); },
    start: () => go('s1'),
    pickPack: () => { $('#inPack').value = ''; $('#inPack').click(); },
    switchProj: async () => {
      const list = await TSF.listProjects();
      const sh = sheet(`<h3>다른 프로젝트</h3>${list.map((p) => `<button class="qc" data-p="${esc(p)}"><div class="q">${esc(p)}</div></button>`).join('')}<button class="btn ghost wide" id="spNew">프로젝트 불러오기</button>`);
      sh.querySelectorAll('[data-p]').forEach((b) => (b.onclick = () => { closeSheet(); openProject(b.dataset.p); }));
      sh.querySelector('#spNew').onclick = () => { closeSheet(); ACT.pickPack(); };
    },
    testCam: () => { $('#inTest').value = ''; $('#inTest').click(); },
    setBy: (el) => setBy(el.dataset.i),
    addRec: () => addRec(),
    recSheet: () => recSheet(),
    setEt: async (el) => { S.settings.evalType = el.dataset.et; await S.db.setMeta('settings', S.settings); S.seq = null; S.outView = false; render(true); },
    openPlace: (el) => { S.place = el.dataset.place; S.seq = null; S.outView = false; go('s3'); },
    openQ: (el) => { S.place = el.dataset.place || S.place; S.seq = +el.dataset.seq; S.outView = false; go('s4'); },
    openOut: (el) => { S.place = el.dataset.place || S.place; S.seq = null; S.outView = true; go('s4'); },
    mine: () => { S.mine = !S.mine; render(); },
    s3f: (el) => { S.s3f = el.dataset.f; render(); },
    s6f: (el) => { S.s6f = el.dataset.f; render(); },
    stepQ: (el) => { const seqs = seqsOf(placeOf(S.place)); const i = seqs.indexOf(S.seq) + +el.dataset.d; if (seqs[i] != null) go('s4', { seq: seqs[i] }); },
    cap: (el) => capture(el.dataset.k, ctxHere(false)),
    shoot: () => capture('photo', ctxHere(true)),
    shootMenu: () => {
      const sh = sheet(`<h3>빠른 기록</h3><div class="tools4" style="grid-template-columns:repeat(2,1fr)"><button class="tool" data-k="video">${ICO.video}동영상</button><button class="tool" data-k="gallery">${ICO.list}갤러리</button></div>`);
      sh.querySelectorAll('[data-k]').forEach((b) => (b.onclick = () => { closeSheet(); capture(b.dataset.k, ctxHere(true)); }));
    },
    memoSheet: () => (blocked() ? null : memoSheet()),
    entrySheet: (el) => entrySheet(el.dataset.id),
    naSheet: (el) => naSheet(el.dataset.seq != null ? +el.dataset.seq : S.seq),
    grade: (el) => setGrade(+el.dataset.g),
    gChk: (el) => guideCheck(el.dataset.id),
    gPhoto: (el) => photoSheet(el.dataset.i, el.dataset.j),
    gDocs: async () => { const m = markOf(S.seq); await setMark(S.seq, { docsSeen: !(m && m.docsSeen) }); render(); },
    gUse: async (el) => { const g = +el.dataset.g; if (await setMark(S.seq, { grade: g, na: false, naReason: '' })) { render(); toast(`제안 등급 ${gradeText(g)}을 현장 등급으로 썼습니다. 바꾸려면 아래 등급을 누르세요.`, { img: IMG.approve }); } },
    tagMark: async (el) => { const m = markOf(S.seq); const v = ((m ? m.memo : '') + ' ' + el.dataset.t).trim(); await setMark(S.seq, { memo: v }); render(); },
    pickRec: (el) => { const id = el.dataset.id; S.pick.has(id) ? S.pick.delete(id) : S.pick.add(id); render(); },
    pickClear: () => { S.pick.clear(); render(); },
    bulkDel: () => confirmSheet('기록 지우기', `고른 기록 ${S.pick.size}건을 지웁니다. 5초 안에 되돌릴 수 있고, 사내에는 삭제 표시로만 갑니다.`, '지우기', () => deleteEntries([...S.pick]), true),
    bulkPlace: () => {
      const sh = sheet(`<h3>장소 바꾸기</h3>${[...places(), OTHER].map((p) => `<button class="qc" data-p="${esc(p.id)}"><div class="q">${esc(p.name)}</div></button>`).join('')}`);
      sh.querySelectorAll('[data-p]').forEach((b) => (b.onclick = async () => { for (const id of S.pick) { const e = S.entries.get(id); if (e.place !== b.dataset.p) await updateEntry(e, { place: b.dataset.p }); } S.pick.clear(); closeSheet(); render(); }));
    },
    bulkSeq: () => {
      const first = S.entries.get([...S.pick][0]);
      const pl = placeOf(first.place);
      const seqs = pl.id === 'PL-99' ? questions().map((q) => q.seq) : seqsOf(pl);
      const sh = sheet(`<h3>문항 붙이기</h3><p class="muted small">${esc(pl.name)}의 문항입니다. 고른 기록 ${S.pick.size}건에 붙입니다.</p><button class="qc out" data-s="out"><div class="meta">맞는 문항 없음 · 점수 제외</div><div class="q">문항 외 참고사항</div></button>${seqs.map((s) => `<button class="qc" data-s="${s}"><div class="meta">${s} · ${esc(qOf(s).sub || qOf(s).area)}</div><div class="q">${esc(qOf(s).text)}</div></button>`).join('')}<button class="qc" data-s="none"><div class="q">문항 떼기(미분류로)</div></button>`);
      const apply = async (k, reason) => { const s = k === 'none' || k === 'out' ? null : +k, out = k === 'out'; for (const id of S.pick) { const e = S.entries.get(id); if (e.seq !== s || !!e.outsideQuestion !== out || (out && e.outsideReason !== reason)) await updateEntry(e, s == null ? { seq: null, outsideQuestion: out, outsideReason: out ? reason : null } : { seq: s }); } S.pick.clear(); closeSheet(); render(); };
      sh.querySelectorAll('[data-s]').forEach((b) => (b.onclick = () => (b.dataset.s === 'out' ? outReasonSheet((r) => apply('out', r)) : apply(b.dataset.s))));
    },
    light: async () => { S.settings.light = !S.settings.light; await S.db.setMeta('settings', S.settings); render(); },
    build: () => build(),
    sharePart: (el) => sharePart(+el.dataset.n),
    closeBuilt: () => { S.built = null; render(); },
    reopenSend: (el) => { S.built = S.sends.find((s) => s.bundleId === el.dataset.id); render(true); },
    purge: () => purge(),
    dlPart: (el) => dlPart(+el.dataset.n),
    memDlg: () => memDialog(),
    protectSheet: () => protectSheet(),
    saveBackup: () => saveBackup(),
    pickBackup: () => { if (blocked()) return; $('#inBackup').value = ''; $('#inBackup').click(); },
    bkEvery: async (el) => { S.bkCfg = Object.assign({}, S.bkCfg, { every: +el.dataset.k }); await S.db.setMeta('backup', S.bkCfg); render(); bkSchedule(); },
    copyUrl: async () => { const u = installUrl(); try { await navigator.clipboard.writeText(u); toast('설치 주소를 복사했습니다. 크롬·삼성 인터넷·사파리 주소창에 붙여 넣으세요.', { img: IMG.approve, ms: 5000 }); } catch (e) { toast('복사하지 못했습니다. 주소를 직접 적어 주세요: ' + u, { ms: 8000 }); } },
    setLock: () => {
      const sh = sheet(`<h3>잠금 번호 정하기</h3><label class="field"><span>숫자 4~6자리</span><input type="password" inputmode="numeric" maxlength="6" id="lp1" autocomplete="off"></label><label class="field"><span>한 번 더</span><input type="password" inputmode="numeric" maxlength="6" id="lp2" autocomplete="off"></label><div class="acts"><button class="btn line" id="lpX">그만두기</button><button class="btn" id="lpOk">정하기</button></div>`);
      sh.querySelector('#lpX').onclick = closeSheet;
      sh.querySelector('#lpOk').onclick = async () => {
        const a = sh.querySelector('#lp1').value, b = sh.querySelector('#lp2').value;
        if (!/^\d{4,6}$/.test(a)) { toast('숫자 4~6자리로 넣어 주세요.'); return; }
        if (a !== b) { toast('두 번 넣은 번호가 다릅니다. 다시 넣어 주세요.'); return; }
        const salt = TSF.randomId(8);
        await S.db.setMeta('lock', { salt, hash: await pinHash(a, salt) });
        closeSheet(); toast('잠금 번호를 정했습니다. 5분 동안 쓰지 않으면 잠깁니다.', { img: IMG.approve });
      };
    },
    clearLock: () => confirmSheet('잠금 끄기', '잠금 번호를 지웁니다.', '끄기', async () => { await S.db.del('meta', 'lock'); toast('잠금을 껐습니다.'); }),
  };
  const COMMIT = {
    markMemo: async (el) => {
      const v = el.value.trim(), m = markOf(S.seq);
      if (v === ((m && m.memo) || '')) return;
      await setMark(S.seq, { memo: v });
      await S.db.del('draft', el.dataset.draft);
      if (TSF.looksLikeContact(v)) toast('개인 연락처가 들어간 것 같습니다. 꼭 필요한 내용인지 확인해 주세요.', { img: IMG.warning });
    },
    alias: async (el) => { S.alias = el.value.trim(); pref('alias', S.alias); await S.db.setMeta('device', { id: S.dev, alias: S.alias }); flashSaved(); },
  };

  let longFired = false, longTimer = null;
  document.addEventListener('click', (ev) => {
    if (longFired) { longFired = false; ev.preventDefault(); return; }
    const el = ev.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const f = ACT[el.dataset.act];
    if (f) { ev.preventDefault(); f(el, ev); }
  });
  document.addEventListener('pointerdown', (ev) => {
    const el = ev.target.closest('[data-long]');
    if (!el) return;
    longFired = false; clearTimeout(longTimer);
    const x = ev.clientX, y = ev.clientY;
    longTimer = setTimeout(() => { longFired = true; if (navigator.vibrate) navigator.vibrate(20); const f = ACT[el.dataset.long]; if (f) f(el, ev); }, 600);
    const cancel = (e2) => { if (e2.type === 'pointermove' && Math.hypot(e2.clientX - x, e2.clientY - y) < 10) return; clearTimeout(longTimer); removeEventListener('pointerup', cancel); removeEventListener('pointermove', cancel); removeEventListener('pointercancel', cancel); };
    addEventListener('pointerup', cancel); addEventListener('pointermove', cancel); addEventListener('pointercancel', cancel);
  });
  document.addEventListener('toggle', (ev) => { const d = ev.target; if (d && d.dataset && d.dataset.gd) S.gOpen[d.dataset.gd] = d.open; }, true);
  document.addEventListener('contextmenu', (ev) => { if (ev.target.closest('[data-long]')) ev.preventDefault(); });
  document.addEventListener('input', (ev) => { const t = ev.target; if (t.dataset && t.dataset.draft && t.closest('#main')) draftSave(t.dataset.draft, t.value); if (t.id === 'code') t.value = t.value.toUpperCase(); });
  document.addEventListener('change', async (ev) => {
    const t = ev.target;
    if (t.dataset.commit && COMMIT[t.dataset.commit]) return COMMIT[t.dataset.commit](t);
    if (t.dataset.change === 'place') { S.place = t.value; S.seq = null; S.outView = false; render(); }
    if (t.dataset.change === 'mode') { S.settings.sendMode = t.value; await S.db.setMeta('settings', S.settings); render(); }
  });
  ['#inPhoto', '#inVideo', '#inGallery'].forEach((s) => $(s).addEventListener('change', (e) => onFiles(e.target)));
  $('#inPack').addEventListener('change', (e) => e.target.files[0] && importPack(e.target.files[0]));
  $('#inBackup').addEventListener('change', (e) => e.target.files.length && restoreFiles([...e.target.files]));
  setInterval(() => updateSaveBar(), 30000); // 「방금 → n분 전」
  $('#inTest').addEventListener('change', (e) => {
    const ok = e.target.files && e.target.files[0];
    S.sc.C4 = ok ? { s: 'ok', msg: '카메라로 바로 찍을 수 있습니다(시험 사진은 저장하지 않았습니다).' } : { s: 'fallback', msg: '카메라를 바로 열 수 없습니다. 「갤러리에서 고르기」로 붙여 주세요.' };
    saveSc();
  });
  let rz = null;
  addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (S.ad && layout() !== S.lastLayout) render(); }, 150); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.db) refreshFree(); });
  /* 메모리 저장소에서 보내지 않은 기록(또는 아직 공유하지 않은 조각)이 있으면 닫기·새로 고침 전에 묻는다 */
  addEventListener('beforeunload', (ev) => { if (memRisk()) { ev.preventDefault(); ev.returnValue = ''; return ''; } });

  TSF.app = { S, go, render };
  boot().catch((e) => {
    console.error(e);
    $('#main').innerHTML = `<div class="band coral">앱을 열지 못했습니다. 이 방식으로는 기록을 저장할 수 없을 수 있습니다. 설치형(B안) 주소로 열어 주세요.<br><small>${esc(e && e.message)}</small></div>`;
  });
})(window);
