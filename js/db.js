/* TS 현장 앱 — IndexedDB(설계서 5-6). DB 이름 ts_field_{프로젝트ID}, 버전 1, 프로젝트마다 나눈다. */
(function (G) {
  'use strict';
  const TSF = (G.TSF = G.TSF || {});
  const PREFIX = 'ts_field_';
  const PROBE = 'ts_field__probe';
  const STORES = {
    meta: { keyPath: 'key' },       // device, recorders, selfCheck, lock, seq, bundleSeq, settings
    appData: { keyPath: 'dataRev' },// 받은 앱 자료 원문(최신 dataRev 를 쓴다)
    entries: { keyPath: 'id' },     // 증거 기록
    marks: { keyPath: 'id' },       // 현장 등급·문항 메모
    media: { keyPath: 'id' },       // 원본 Blob·썸네일 Blob·sha256
    sends: { keyPath: 'bundleId' }, // 보낸 묶음
    draft: { keyPath: 'key' },      // 입력 중 임시 저장
    log: { autoIncrement: true },   // 기기 안 변경 기록
  };
  const req2p = (r) => new Promise((ok, no) => { r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });

  function openRaw(name, stores) {
    return new Promise((ok, no) => {
      let r;
      try { r = indexedDB.open(name, 1); } catch (e) { no(e); return; }
      r.onupgradeneeded = () => { const db = r.result; for (const [s, o] of Object.entries(stores)) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, o); };
      r.onsuccess = () => ok(r.result);
      r.onerror = () => no(r.error);
      r.onblocked = () => no(new Error('blocked'));
    });
  }

  class DB {
    constructor(idb, pid) { this.idb = idb; this.pid = pid; }
    get(s, k) { return req2p(this.idb.transaction(s).objectStore(s).get(k)); }
    all(s) { return req2p(this.idb.transaction(s).objectStore(s).getAll()); }
    put(s, v) { return this.tx([s], (t) => t[s].put(v)); }
    del(s, k) { return this.tx([s], (t) => t[s].delete(k)); }
    async meta(k, dflt) { const r = await this.get('meta', k); return r ? r.value : dflt; }
    setMeta(k, value) { return this.put('meta', { key: k, value }); }
    /* 여러 저장소를 한 트랜잭션으로. fn 안에서는 IDB 요청만 한다(await 금지) */
    tx(names, fn) {
      return new Promise((ok, no) => {
        let t;
        try { t = this.idb.transaction(names, 'readwrite'); } catch (e) { no(e); return; }
        const stores = {}; names.forEach((n) => (stores[n] = t.objectStore(n)));
        let out;
        try { out = fn(stores, t); } catch (e) { try { t.abort(); } catch (_) {} no(e); return; }
        t.oncomplete = () => ok(out);
        t.onerror = () => no(t.error);
        t.onabort = () => no(t.error || new Error('abort'));
      });
    }
  }

  /* IndexedDB 를 열 수 없는 열기 방식(예: 안드로이드 Chrome 의 content:// 파일)에서 쓰는 메모리 저장소.
     DB 와 같은 함수(get·all·put·del·meta·setMeta·tx)와 tx 안의 저장소 요청(get·getAll·put·add·delete·clear)을 흉내 낸다.
     앱을 닫으면 사라진다. TSF.storageMode 가 'memory' 이면 화면이 노란 띠로 알린다. */
  const memData = {};
  const clone = (v) => { try { return v === undefined ? v : structuredClone(v); } catch (e) { return v; } };
  class MemDB extends DB {
    constructor(pid) { super({ close() {} }, pid); this.mem = true; this.data = memData[pid] || (memData[pid] = {}); this.auto = 0; }
    st(s) { return this.data[s] || (this.data[s] = new Map()); }
    keyOf(s, v) { const kp = (STORES[s] || {}).keyPath; return kp ? v[kp] : ++this.auto; }
    async get(s, k) { return clone(this.st(s).get(k)); }
    async all(s) { return [...this.st(s).values()].map(clone); }
    async put(s, v) { this.st(s).set(this.keyOf(s, v), clone(v)); }
    async del(s, k) { this.st(s).delete(k); }
    tx(names, fn) {
      return new Promise((ok, no) => {
        let pending = 0, settled = false, out, failed = null;
        const finish = () => { if (settled || pending) return; settled = true; failed ? no(failed) : ok(out); };
        const req = (op) => {
          pending++;
          const r = { result: undefined, error: null, onsuccess: null, onerror: null };
          setTimeout(() => {
            try { r.result = op(); if (r.onsuccess) r.onsuccess({ target: r }); }
            catch (e) { r.error = e; failed = failed || e; if (r.onerror) r.onerror({ target: r }); }
            pending--; finish();
          }, 0);
          return r;
        };
        const stores = {};
        names.forEach((n) => {
          const m = this.st(n);
          const putOne = (v) => { const k = this.keyOf(n, v); m.set(k, clone(v)); return k; };
          stores[n] = { get: (k) => req(() => clone(m.get(k))), getAll: () => req(() => [...m.values()].map(clone)), put: (v) => req(() => putOne(v)), add: (v) => req(() => putOne(v)), delete: (k) => req(() => { m.delete(k); }), clear: () => req(() => { m.clear(); }) };
        });
        try { out = fn(stores, { abort() {} }); } catch (e) { no(e); return; }
        pending++; setTimeout(() => { pending--; finish(); }, 0); // 요청이 없어도 끝낸다
      });
    }
  }

  async function openProject(pid) {
    if (TSF.storageMode !== 'memory') {
      try { const db = new DB(await openRaw(PREFIX + pid, STORES), pid); TSF.storageMode = 'idb'; return db; }
      catch (e) { TSF.storageMode = 'memory'; TSF.storageError = String((e && e.message) || e); console.warn('[TS현장] IndexedDB 를 열 수 없어 메모리 저장소로 엽니다.', e); }
    }
    return new MemDB(pid);
  }

  /* 이 기기에 있는 프로젝트 DB 목록(B안 여러 프로젝트) */
  async function listProjects() {
    if (TSF.storageMode === 'memory') return Object.keys(memData);
    if (typeof indexedDB === 'undefined' || !indexedDB.databases) return [];
    try {
      const list = await indexedDB.databases();
      return list.map((d) => d.name).filter((n) => n && n.startsWith(PREFIX) && n !== PROBE).map((n) => n.slice(PREFIX.length));
    } catch (e) { return []; }
  }

  /* 자가 진단 C1: 1KB 쓰기·읽기·지우기와 출처 유지(다시 열었을 때 같은 DB) */
  async function probe() {
    const idb = await openRaw(PROBE, { kv: { keyPath: 'k' } });
    const db = new DB(idb, '');
    const data = 'x'.repeat(1024);
    await db.tx(['kv'], (t) => t.kv.put({ k: 'test', v: data }));
    const back = await db.get('kv', 'test');
    await db.del('kv', 'test');
    if (!back || back.v !== data) throw new Error('read-back');
    const seen = await db.get('kv', 'firstSeen');
    let opens = 1;
    if (seen) { opens = (seen.opens || 1) + 1; await db.put('kv', { k: 'firstSeen', at: seen.at, opens }); }
    else await db.put('kv', { k: 'firstSeen', at: new Date().toISOString(), opens: 1 });
    idb.close();
    return { reopened: !!seen, firstAt: seen ? seen.at : null, opens };
  }

  Object.assign(TSF, { openProject, listProjects, probeStorage: probe, DB_PREFIX: PREFIX });
})(typeof window !== 'undefined' ? window : globalThis);
