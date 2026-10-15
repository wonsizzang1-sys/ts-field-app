/* TS 현장 앱 서비스워커(B안, D75): 설치할 때 앱 파일 전부를 저장하고 이후 네트워크 없이 연다.
   고객 자료(*.tspack, 기록)는 캐시하지 않는다(기록은 IndexedDB). 앱을 고치면 VERSION 을 올린다. */
const VERSION = 'tsf-1.0.0-r8'; // 10/15 D93 반입 확인 코드 화면 없앰(이전 r7: 디자인 시스템 A)
const FILES = [
  './', 'index.html', 'tokens.css', 'app.css', 'theme-a.css', 'manifest.webmanifest',
  'js/util.js', 'js/db.js', 'js/zip.js', 'js/bundle.js', 'js/media.js', 'js/selfcheck.js', 'js/app.js',
  'assets/app_icon_192.png', 'assets/app_icon_512.png',
  'assets/char_analyst_default.png', 'assets/char_analyst_alert.png', 'assets/char_planner_default.png', 'assets/char_reporter_done.png', 'assets/char_reviewer_alert.png',
  'assets/empty_norecord.png', 'assets/icon_camera.png', 'assets/icon_voice.png', 'assets/icon_memo.png', 'assets/icon_mail.png',
  'assets/icon_warning.png', 'assets/icon_approve.png', 'assets/icon_import.png',
];
self.addEventListener('install', (e) => e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((r) => r || fetch(e.request)));
});
