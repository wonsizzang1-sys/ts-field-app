/* TS 현장 앱 — 사진·동영상 썸네일, 가벼운 본, 받은 음성 길이(설계서 5-5, 5-8-2 ③) */
(function (G) {
  'use strict';
  const TSF = (G.TSF = G.TSF || {});

  const toJpeg = (canvas, q) => new Promise((ok) => canvas.toBlob((b) => ok(b), 'image/jpeg', q));
  function draw(src, w, h, long) {
    const k = Math.min(1, long / Math.max(w, h));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    return c;
  }
  async function loadImage(blob) {
    if (G.createImageBitmap) { try { const b = await createImageBitmap(blob); return { src: b, w: b.width, h: b.height }; } catch (e) { /* 아래 */ } }
    const url = URL.createObjectURL(blob);
    try {
      const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
      return { src: img, w: img.naturalWidth, h: img.naturalHeight };
    } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
  }

  /* 사진: 긴 변 320px JPEG 썸네일. HEIC 처럼 못 여는 형식은 썸네일 없이 원본만 저장 */
  async function photoInfo(blob) {
    try { const im = await loadImage(blob); return { w: im.w, h: im.h, thumb: await toJpeg(draw(im.src, im.w, im.h, 320), 0.8) }; }
    catch (e) { return { w: null, h: null, thumb: null }; }
  }
  /* 동영상: 첫 프레임 썸네일과 길이 */
  function videoInfo(blob) {
    return new Promise((ok) => {
      const url = URL.createObjectURL(blob), v = document.createElement('video');
      let done = false;
      const fin = (r) => { if (done) return; done = true; URL.revokeObjectURL(url); ok(r); };
      v.muted = true; v.playsInline = true; v.preload = 'auto';
      v.onloadeddata = () => { try { v.currentTime = Math.min(0.1, (v.duration || 1) / 2); } catch (e) { fin({ w: v.videoWidth, h: v.videoHeight, durationSec: null, thumb: null }); } };
      v.onseeked = async () => {
        const dur = isFinite(v.duration) ? Math.round(v.duration) : null;
        try { fin({ w: v.videoWidth, h: v.videoHeight, durationSec: dur, thumb: await toJpeg(draw(v, v.videoWidth, v.videoHeight, 320), 0.75) }); }
        catch (e) { fin({ w: v.videoWidth, h: v.videoHeight, durationSec: dur, thumb: null }); }
      };
      v.onerror = () => fin({ w: null, h: null, durationSec: null, thumb: null });
      setTimeout(() => fin({ w: null, h: null, durationSec: null, thumb: null }), 6000);
      v.src = url;
    });
  }
  /* 음성: 길이(webm 녹음은 길이를 못 읽는 경우가 있어 녹음 시간을 우선 쓴다) */
  function audioDuration(blob) {
    return new Promise((ok) => {
      const url = URL.createObjectURL(blob), a = document.createElement('audio');
      const fin = (d) => { URL.revokeObjectURL(url); ok(d); };
      a.preload = 'metadata';
      a.onloadedmetadata = () => fin(isFinite(a.duration) ? Math.round(a.duration) : null);
      a.onerror = () => fin(null);
      setTimeout(() => fin(null), 4000);
      a.src = url;
    });
  }
  /* 가벼운 보내기: 사진 긴 변 2560px JPEG 0.85 */
  async function lightPhoto(blob) {
    const im = await loadImage(blob);
    if (Math.max(im.w, im.h) <= 2560 && blob.type === 'image/jpeg') return blob;
    return toJpeg(draw(im.src, im.w, im.h, 2560), 0.85);
  }

  Object.assign(TSF, { photoInfo, videoInfo, audioDuration, lightPhoto });
})(typeof window !== 'undefined' ? window : globalThis);
