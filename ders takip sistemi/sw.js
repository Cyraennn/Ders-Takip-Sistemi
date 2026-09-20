/* Ders Takip Sistemi — çevrimdışı önbellek */
const CACHE = "bdm-v10";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./assets/icon.svg",
  "./assets/css/style.css",
  "./assets/js/config.js",
  "./assets/js/core.js",
  "./assets/js/auth.js",
  "./assets/js/boot.js",
  "./assets/js/modules/dashboard.js",
  "./assets/js/modules/schedule.js",
  "./assets/js/modules/calendar.js",
  "./assets/js/modules/tasks.js",
  "./assets/js/modules/exams.js",
  "./assets/js/modules/gpa.js",
  "./assets/js/modules/attendance.js",
  "./assets/js/modules/gradplan.js",
  "./assets/js/modules/progress.js",
  "./assets/js/modules/pomodoro.js",
  "./assets/js/modules/flashcards.js",
  "./assets/js/modules/quiz.js",
  "./assets/js/modules/ai.js",
  "./assets/js/modules/notes.js",
  "./assets/js/modules/studylog.js",
  "./assets/js/modules/resources.js",
  "./assets/js/modules/snippets.js",
  "./assets/js/modules/toolbox.js",
  "./assets/js/modules/citation.js",
  "./assets/js/modules/settings.js",
  "./assets/js/modules/backup.js",
  "./assets/js/modules/jarvis.js",
  "https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.11/katex.min.css",
  "https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.11/katex.min.js",
];

// büyük / önbelleğe alınmaması gereken kaynaklar (Pyodide vb.)
function skipCache(url) {
  return /pyodide/i.test(url) || /\.(wasm|data)(\?|$)/i.test(url) ||
    /supabase\.co\/(auth|rest|realtime)/i.test(url) || /\/api\/okul\//i.test(url);
}

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(ASSETS.map((u) => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = e.request.url;
  if (skipCache(url)) return; // tarayıcının normal ağ/HTTP önbelleğine bırak
  // Önce ağ, olmazsa (çevrimdışı) önbellek: dosya değişiklikleri (config.js dahil)
  // hep tazeden servis edilir; önbellek yalnızca ağ yokken yedek olarak devreye girer.
  e.respondWith(
    fetch(e.request).then((res) => {
      if (!res.ok) return res; // hatalı yanıt iyi önbelleği ezmesin
      const len = Number(res.headers.get("content-length") || 0);
      if (len < 1.5 * 1024 * 1024) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
      }
      return res;
    }).catch(() => caches.match(e.request).then((r) => r || (e.request.mode === "navigate" ? caches.match("./index.html") : Response.error())))
  );
});
