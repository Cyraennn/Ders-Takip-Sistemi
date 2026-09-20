/* JARVIS köprüsü — okul verisini aynı ağdaki JARVIS asistanına bağlar.
   okul → JARVIS: her değişiklikte tam durum POST edilir (/api/okul/push).
   JARVIS → okul: pencere odaklanınca bekleyen değişiklikler çekilir (/api/okul/pull).
   Yapılandırma boşsa hiçbir şey yapmaz; okul çevrimdışı çalışmaya devam eder. */
(function () {
  const CFG_KEY = "_jarvis_cfg";       // "_" öneki → yedeğe/buluta gitmez (cihaz ayarı)
  const PUSH_DEBOUNCE = 3000;
  const PULL_MIN_GAP = 4000;

  function cfg() {
    // Öncelik: config.js (window.BDM_CONFIG.jarvis) → sonra kullanıcının localStorage ayarı.
    const g = (window.BDM_CONFIG && window.BDM_CONFIG.jarvis) || {};
    const base = { host: g.host || "", token: g.token || "", enabled: g.enabled != null ? !!g.enabled : false };
    return Object.assign(base, App.store.get(CFG_KEY, {}) || {});
  }
  function saveCfg(patch) { App.store.set(CFG_KEY, Object.assign(cfg(), patch)); }

  let pushT = null, lastPull = 0, state = "idle", detail = "";

  function base() {
    let h = (cfg().host || "").trim().replace(/\/+$/, "");
    if (!h) return "";
    if (!/^https?:\/\//i.test(h)) h = "http://" + h;
    if (!/:\d+$/.test(h.replace(/^https?:\/\//i, ""))) h += ":8770";
    return h;
  }
  function url(path) {
    const t = cfg().token;
    return base() + path + (t ? "?key=" + encodeURIComponent(t) : "");
  }
  function setState(s, d) {
    state = s; detail = d || "";
    if (location.hash.replace(/^#\/?/, "") === "jarvis") App.refresh();
  }

  /* ---------- okul → JARVIS ---------- */
  async function push() {
    if (!cfg().enabled || !base()) return;
    try {
      const res = await fetch(url("/api/okul/push"), {
        method: "POST",
        body: JSON.stringify(App.store.exportAll()),   // text/plain → CORS preflight yok
      });
      setState(res.ok ? "ok" : "err", res.ok ? "" : "HTTP " + res.status);
    } catch (e) {
      setState("err", "bağlantı yok");
    }
  }
  function schedulePush() {
    if (!cfg().enabled) return;
    clearTimeout(pushT);
    pushT = setTimeout(push, PUSH_DEBOUNCE);
  }

  /* ---------- JARVIS → okul ---------- */
  async function pull(force) {
    if (!cfg().enabled || !base()) return;
    if (!force && Date.now() - lastPull < PULL_MIN_GAP) return;
    lastPull = Date.now();
    let ops = [];
    try {
      const res = await fetch(url("/api/okul/pull"));
      if (!res.ok) { setState("err", "HTTP " + res.status); return; }
      ops = (await res.json()).ops || [];
      setState("ok", "");
    } catch (e) { setState("err", "bağlantı yok"); return; }
    if (ops.length) applyOps(ops);
  }

  function applyOps(ops) {
    let n = 0;
    ops.forEach((entry) => {
      const p = entry.payload || {};
      if (entry.op === "add_task") {
        const l = App.store.get("tasks", []) || [];
        l.push(Object.assign({ id: App.ui.uid(), created: App.ui.todayISO(), subtasks: [] }, p));
        App.store.set("tasks", l); n++;
      } else if (entry.op === "add_exam") {
        const l = App.store.get("exams", []) || [];
        l.push(Object.assign({ id: App.ui.uid(), topicDone: {} }, p));
        App.store.set("exams", l); n++;
      }
    });
    if (n) {
      App.ui.toast("JARVIS " + n + " değişiklik ekledi", "success");
      App.refresh();
    }
  }

  /* ---------- ayar ekranı ---------- */
  async function configure() {
    const c = cfg();
    const data = await App.ui.formModal("JARVIS bağlantısı", [
      { name: "host", label: "JARVIS PC adresi", default: c.host, placeholder: "192.168.1.109", hint: "JARVIS açıkken konsol adresi loga yazılır. Port yazmazsan :8770 varsayılır. Aynı Wi-Fi ağında olmalısın." },
      { name: "token", label: "Erişim anahtarı (token)", type: "password", default: c.token, hint: "JARVIS .env dosyasındaki JARVIS_WEB_TOKEN değeri." },
      { name: "enabled", label: "Senkronizasyon açık", type: "checkbox", default: c.enabled },
    ]);
    if (!data) return;
    saveCfg({
      host: (data.host || "").trim(),
      token: (data.token || "").trim(),
      enabled: !!data.enabled,
    });
    App.ui.toast("Kaydedildi", "success");
    if (cfg().enabled) { push(); pull(true); }
    App.refresh();
  }

  async function testConn() {
    if (!base()) { App.ui.toast("Önce PC adresini gir", "error"); return; }
    try {
      const res = await fetch(url("/api/okul/pull"));
      if (res.ok) { App.ui.toast("Bağlantı başarılı ✔", "success"); setState("ok", ""); }
      else { App.ui.toast("Yanıt: HTTP " + res.status + (res.status === 401 ? " (token yanlış)" : ""), "error"); }
    } catch (e) {
      App.ui.toast("Ulaşılamadı — adres/port ve aynı ağ kontrolü", "error");
    }
  }

  /* ---------- modül görünümü ---------- */
  function render(view) {
    const c = cfg();
    view.appendChild(App.ui.pageHeader("JARVIS", "Sesli asistanı okul verisine bağla", [
      App.ui.el("button", { class: "btn ghost", text: "Bağlantıyı test et", onClick: testConn }),
      App.ui.el("button", { class: "btn primary", text: "⚙ Ayarla", onClick: configure }),
    ]));

    const statusText =
      !c.enabled ? "Senkronizasyon kapalı." :
      !base() ? "PC adresi girilmemiş." :
      "Aktif — " + base() + (state === "ok" ? " · bağlı ✔" : state === "err" ? " · " + (detail || "hata") : " · bekleniyor");

    view.appendChild(App.ui.card([
      App.ui.el("h3", { text: "Durum" }),
      App.ui.el("p", { class: "muted", text: statusText }),
      App.ui.el("ul", { style: "line-height:1.9;color:var(--text-mute)" }, [
        App.ui.el("li", { text: "Her değişiklik ~3 sn sonra JARVIS'e gönderilir." }),
        App.ui.el("li", { text: "Bu sekmeye döndüğünde JARVIS'in eklediği ödev/sınavlar çekilir." }),
        App.ui.el("li", { text: "JARVIS'e: “bugün ödevim var mı”, “yaklaşan sınavlar”, “X dersine yarına ödev ekle”." }),
        App.ui.el("li", { text: "Bağlantı yoksa okul normal çalışır; veri kaybı olmaz." }),
      ]),
    ]));

    if (c.enabled && base()) {
      view.appendChild(App.ui.el("div", { style: "text-align:center;margin-top:6px" },
        App.ui.el("button", { class: "btn sm ghost", text: "Şimdi eşitle", onClick: () => { push(); pull(true); App.ui.toast("Eşitlendi", "info"); } })));
    }
  }

  /* ---------- kayıt + kancalar ---------- */
  App.registerModule({ id: "jarvis", title: "JARVIS", icon: "🤖", group: "Sistem", render });
  App.registerCommand({ label: "JARVIS bağlantısı", icon: "🤖", group: "Sayfa", run: () => App.go("jarvis") });

  App.onWrite((key) => { if (key !== CFG_KEY) schedulePush(); });
  window.addEventListener("focus", () => pull(false));
  document.addEventListener("visibilitychange", () => { if (!document.hidden) pull(false); });
  document.addEventListener("DOMContentLoaded", () => {
    if (cfg().enabled && base()) setTimeout(() => { push(); pull(true); }, 1500);
  });
})();
