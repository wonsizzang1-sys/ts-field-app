/* TS 현장 앱 — 현장 묶음 ts-field-bundle/1 만들기(설계서 5-8, contracts\bundle_field.md)
   - 보내기 한 번 = 묶음 하나(FB-{기기}-{NNNN}), limits.partMB(기본 20MB) 조각으로 나눈다.
   - 모든 조각에 part.json·manifest.json·records.json, 조각 1에만 thumbs/·log.json.
   - 한도보다 큰 미디어는 media/{id}.{ext}.c{k}of{N} 로 나누고 manifest 에 part=chunks[0], chunks=[…].
   - receiptCode = sha256(bundleId + 조각1 sha256 + 조각2 sha256 …) 앞 6자 대문자.
     완성 ZIP 해시에서 나오므로 manifest 안에는 null 로 두고 앱 보내기 이력(sends)에 저장한다(계약 보완 1).
   이 파일은 화면·DB 를 모른다(노드 시험에서 그대로 부른다). */
(function (G) {
  'use strict';
  const TSF = (G.TSF = G.TSF || {});
  const MARGIN = 64 * 1024; // part.json·manifest 길이 변동 여유

  const clean = (o) => { const r = {}; for (const k of Object.keys(o)) if (k[0] !== '_') r[k] = o[k]; return r; };
  const extOf = (m) => {
    const n = (m.name || '').match(/\.([A-Za-z0-9]{1,5})$/);
    if (n) return n[1].toLowerCase();
    const t = (m.mime || '').split('/')[1] || 'bin';
    return { jpeg: 'jpg', quicktime: 'mov', 'x-m4a': 'm4a', mpeg: 'mp3' }[t.split(';')[0]] || t.split(';')[0];
  };
  const mediaName = (m) => `media/${m.id}.${extOf(m)}`;

  /* 미디어를 조각에 배정한다. 반환: {parts, assign:[{id, pieces:[{part, start, end}]}]} */
  function planParts(media, fixedBytes, firstExtra, partBytes) {
    const ov = TSF.zipEntryOverhead;
    const capAll = partBytes - fixedBytes - MARGIN;
    if (capAll < 256 * 1024) throw new Error('조각 크기가 너무 작습니다');
    let part = 1, left = capAll - firstExtra;
    const assign = [];
    for (const m of media) {
      const name = mediaName(m) + '.c99of99', o = ov(name);
      if (m.size + o <= left) { assign.push({ id: m.id, pieces: [{ part, start: 0, end: m.size }] }); left -= m.size + o; continue; }
      if (m.size + o <= capAll) { part++; left = capAll - m.size - o; assign.push({ id: m.id, pieces: [{ part, start: 0, end: m.size }] }); continue; }
      // 한 조각보다 큰 미디어: 남은 자리(64KB 이상)부터 채우며 나눈다
      if (left - o < 64 * 1024) { part++; left = capAll; }
      const pieces = []; let start = 0;
      while (start < m.size) {
        const take = Math.min(m.size - start, left - o);
        pieces.push({ part, start, end: start + take }); start += take; left -= take + o;
        if (start < m.size) { part++; left = capAll; }
      }
      assign.push({ id: m.id, pieces });
    }
    return { parts: part, assign };
  }

  const b64 = (u8) => { let s = ''; u8.forEach((x) => (s += String.fromCharCode(x))); return btoa(s); };
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  async function deriveKey(pass, salt, iterations) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }

  /* opt: {appData, device:{id, alias}, by, selfCheck, mode, bundleSeq, prevBundleId, entries, marks,
           media:[{id, name, mime, size, sha256, variant, blob}], thumbs:[{id, blob}], log, passphrase, now, onProgress} */
  async function buildBundle(opt) {
    const now = opt.now || new Date();
    const ad = opt.appData, pid = ad.project.id, dev = opt.device.id;
    const bid = TSF.bundleId(dev, opt.bundleSeq);
    const createdAt = TSF.isoLocal(now);
    const partBytes = Math.round((ad.limits && ad.limits.partMB ? ad.limits.partMB : 20) * 1048576);
    const entries = opt.entries.map(clean), marks = opt.marks.map(clean);
    const recordsJson = JSON.stringify({ format: 'ts-field-bundle/1', project: pid, entries, marks }, null, 0);
    const logJson = JSON.stringify(opt.log || []);
    const thumbs = (opt.thumbs || []).filter((t) => t.blob);
    const ov = TSF.zipEntryOverhead;
    const manifest = {
      bundleId: bid, project: pid, round: ad.round.id,
      device: { id: dev, alias: opt.device.alias || '', selfCheck: opt.selfCheck || {} },
      by: opt.by, createdAt, mode: opt.mode, mediaSince: opt.prevBundleId || null,
      counts: { entries: entries.filter((e) => !e.deleted).length, marks: marks.length, deleted: entries.filter((e) => e.deleted).length, mediaInBundle: opt.media.length },
      media: [], receiptCode: null,
    };
    // 계획: manifest 는 미디어 수만큼 늘어나므로 미디어당 200바이트를 미리 잡는다
    const bl = (s) => new TextEncoder().encode(s).length;
    const fixed = bl(recordsJson) + bl(JSON.stringify(manifest)) + opt.media.length * 200 + 2048 + ov('manifest.json') + ov('records.json') + ov('part.json') + TSF.ZIP_END_SIZE;
    const firstExtra = thumbs.reduce((s, t) => s + t.blob.size + ov(`thumbs/${t.id}.jpg`), 0) + bl(logJson) + ov('log.json');
    const plan = planParts(opt.media, fixed, firstExtra, partBytes);
    const byId = new Map(opt.media.map((m) => [m.id, m]));
    for (const a of plan.assign) {
      const m = byId.get(a.id);
      const row = { id: m.id, sha256: m.sha256, size: m.size, variant: m.variant || 'original', part: a.pieces[0].part };
      if (a.pieces.length > 1) row.chunks = a.pieces.map((p) => p.part);
      manifest.media.push(row);
    }
    const manifestJson = JSON.stringify(manifest);

    let enc = { alg: 'none' }, key = null, salt = null;
    const wantEnc = !!(opt.passphrase && ad.encrypt && ad.encrypt.enabled);
    if (wantEnc) {
      const iterations = ad.encrypt.iterations || 200000;
      salt = ad.encrypt.salt ? unb64(ad.encrypt.salt) : crypto.getRandomValues(new Uint8Array(16));
      key = await deriveKey(opt.passphrase, salt, iterations);
      enc = { alg: 'AES-GCM-256', kdf: ad.encrypt.kdf || 'PBKDF2-SHA256', iterations, salt: b64(salt) };
    }

    const codeName = String(ad.project.codeName || pid).replace(/\s+/g, '');
    const base = `TS현장_${codeName}_${opt.by}_${TSF.stamp(now)}`;
    const parts = [];
    for (let n = 1; n <= plan.parts; n++) {
      if (opt.onProgress) opt.onProgress(n, plan.parts);
      const inner = [{ name: 'manifest.json', data: manifestJson }, { name: 'records.json', data: recordsJson }];
      if (n === 1) {
        thumbs.forEach((t) => inner.push({ name: `thumbs/${t.id}.jpg`, data: t.blob }));
        inner.push({ name: 'log.json', data: logJson });
      }
      for (const a of plan.assign) {
        const m = byId.get(a.id);
        a.pieces.forEach((p, i) => {
          if (p.part !== n) return;
          const nm = a.pieces.length > 1 ? `${mediaName(m)}.c${i + 1}of${a.pieces.length}` : mediaName(m);
          inner.push({ name: nm, data: a.pieces.length > 1 ? m.blob.slice(p.start, p.end) : m.blob });
        });
      }
      const partJson = { format: 'ts-field-bundle/1', bundleId: bid, project: pid, device: dev, by: opt.by, createdAt, part: n, parts: plan.parts, mode: opt.mode, enc: { alg: 'none' }, appVersion: TSF.APP_VERSION, dataRev: ad.dataRev, bankVersion: ad.bank && ad.bank.bankVersion };
      let files;
      if (key) {
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const innerZip = await TSF.makeZip(inner, now);
        const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, await innerZip.arrayBuffer());
        partJson.enc = Object.assign({}, enc, { iv: b64(iv) });
        files = [{ name: 'part.json', data: JSON.stringify(partJson) }, { name: 'payload.bin', data: new Uint8Array(ct) }];
      } else {
        files = [{ name: 'part.json', data: JSON.stringify(partJson) }, ...inner];
      }
      const blob = await TSF.makeZip(files, now);
      parts.push({ n, name: `${base}_${n}of${plan.parts}.zip`, blob, size: blob.size, sha256: await TSF.sha256Hex(blob) });
    }
    const receiptCode = await receiptOf(bid, parts.map((p) => p.sha256));
    return { bundleId: bid, createdAt, parts, receiptCode, manifest, encrypted: !!key };
  }

  /* 반입 확인 코드(5-8-2 ⑥, 계약 보완 2): 소문자 64자 sha 를 조각 번호 순으로 구분자 없이 잇는다 */
  async function receiptOf(bid, shas) { return (await TSF.sha256Hex(bid + shas.join(''))).slice(0, 6).toUpperCase(); }

  /* 예상 크기·조각 수(S7 요약) */
  function estimate(appData, mediaSizes, thumbBytes) {
    const partBytes = Math.round(((appData.limits && appData.limits.partMB) || 20) * 1048576);
    const media = mediaSizes.map((size, i) => ({ id: 'FR-XXXX-00000-m' + i, name: 'x.jpg', size }));
    const total = mediaSizes.reduce((a, b) => a + b, 0) + thumbBytes;
    try { return { total, parts: planParts(media, 300 * 1024, thumbBytes, partBytes).parts }; } catch (e) { return { total, parts: 1 }; }
  }

  Object.assign(TSF, { buildBundle, planParts, receiptOf, estimateBundle: estimate, mediaFileName: mediaName });
})(typeof window !== 'undefined' ? window : globalThis);
