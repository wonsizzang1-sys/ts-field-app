/* TS 현장 앱 — ZIP 쓰기(압축 없음 STORE)와 CRC32. 설계서 5-8-2 ⑤: 외부 라이브러리 없이 앱 안 코드로 만든다.
   조각은 20MB 안팎이라 ZIP64 는 쓰지 않는다(4GB 미만). 파일 이름은 UTF-8(일반 목적 비트 11). */
(function (G) {
  'use strict';
  const TSF = (G.TSF = G.TSF || {});

  const TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(u8, prev = 0) {
    let c = (prev ^ 0xffffffff) >>> 0;
    for (let i = 0; i < u8.length; i++) c = TABLE[(c ^ u8[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  /* 큰 Blob 은 4MB씩 읽어 메모리를 아낀다 */
  async function blobCrc(blob) {
    let crc = 0;
    for (let o = 0; o < blob.size; o += 4194304) crc = crc32(new Uint8Array(await blob.slice(o, o + 4194304).arrayBuffer()), crc);
    return crc;
  }
  function dosTime(d) {
    return {
      time: ((d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2)) & 0xffff,
      date: (((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff,
    };
  }
  const enc = new TextEncoder();
  const toBlob = (x) => (x instanceof Blob ? x : new Blob([typeof x === 'string' ? enc.encode(x) : x]));

  /* 머리글 크기(조각 나누기 계획에 쓴다) */
  const entryOverhead = (name) => 30 + 46 + 2 * enc.encode(name).length;
  const END_SIZE = 22;

  /* files: [{name, data: Blob|string|Uint8Array}] → Blob(application/zip) */
  async function makeZip(files, when = new Date()) {
    const { time, date } = dosTime(when);
    const chunks = [], central = [];
    let offset = 0;
    for (const f of files) {
      const name = enc.encode(f.name), blob = toBlob(f.data), crc = await blobCrc(blob), size = blob.size;
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(10, time, true); h.setUint16(12, date, true); h.setUint32(14, crc, true);
      h.setUint32(18, size, true); h.setUint32(22, size, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
      chunks.push(h.buffer, name, blob);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
      c.setUint16(12, time, true); c.setUint16(14, date, true); c.setUint32(16, crc, true); c.setUint32(20, size, true); c.setUint32(24, size, true);
      c.setUint16(28, name.length, true); c.setUint32(42, offset, true);
      central.push(c.buffer, name);
      offset += 30 + name.length + size;
    }
    const cdSize = central.reduce((s, x) => s + x.byteLength, 0);
    const e = new DataView(new ArrayBuffer(END_SIZE));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
    e.setUint32(12, cdSize, true); e.setUint32(16, offset, true);
    return new Blob([...chunks, ...central, e.buffer], { type: 'application/zip' });
  }

  Object.assign(TSF, { crc32, blobCrc, makeZip, zipEntryOverhead: entryOverhead, ZIP_END_SIZE: END_SIZE });
})(typeof window !== 'undefined' ? window : globalThis);
