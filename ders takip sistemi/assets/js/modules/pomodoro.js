/* Pomodoro Zamanlayıcı + çalışma günlüğü */
(function () {
  const SET_KEY = "pomodoro_settings";
  const LOG_KEY = "pomodoro_log";

  const DEFAULTS = { work: 25, short: 5, long: 15, rounds: 4, dailyGoal: 120 };

  let timer = null;
  let remaining = 0;
  let running = false;
  let mode = "work"; // work | short | long
  let completedRounds = 0;
  let tag = "";

  function settings() { return Object.assign({}, DEFAULTS, App.store.get(SET_KEY, {})); }
  function log() { return App.store.get(LOG_KEY, []); }
  function addLog(minutes) {
    const l = log();
    l.push({ date: App.ui.todayISO(), minutes, tag: tag || "Genel", at: new Date().toISOString() });
    App.store.set(LOG_KEY, l);
  }

  function beep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = "sine"; o.frequency.value = 660;
      g.gain.setValueAtTime(0.001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.9);
      o.start(); o.stop(ctx.currentTime + 0.9);
    } catch (e) { /* sessiz geç */ }
  }

  function fmt(s) {
    return App.ui.pad(Math.floor(s / 60)) + ":" + App.ui.pad(s % 60);
  }

  function modeMinutes(m) {
    const s = settings();
    return m === "work" ? s.work : m === "short" ? s.short : s.long;
  }

  function setMode(m, render) {
    mode = m;
    remaining = modeMinutes(m) * 60;
    running = false;
    stopTick();
    render();
  }

  function stopTick() {
    if (timer) { clearInterval(timer); timer = null; }
  }

  function tick(render) {
    remaining--;
    if (remaining <= 0) {
      stopTick();
      running = false;
      beep();
      const pn = App.notifPrefs && App.notifPrefs().pomodoro;
      if (mode === "work") {
        addLog(modeMinutes("work"));
        completedRounds++;
        const next = completedRounds % settings().rounds === 0 ? "long" : "short";
        const msg = "Sıra: " + (next === "long" ? "uzun mola" : "kısa mola");
        if (pn) App.notify("Pomodoro tamam ✔", msg); else App.ui.toast("Pomodoro tamam! " + msg, "success");
        setMode(next, render);
      } else {
        if (pn) App.notify("Mola bitti 💪", "Çalışmaya dön"); else App.ui.toast("Mola bitti — çalışmaya dön 💪", "info");
        setMode("work", render);
      }
      return;
    }
    updateClock();
  }

  function updateClock() {
    const c = document.querySelector(".pomo-clock");
    if (c) c.textContent = fmt(remaining);
    document.title = running ? fmt(remaining) + " · Pomodoro" : "BÖTE Ders Merkezi";
  }

  function toggleRun(render) {
    if (running) {
      running = false;
      stopTick();
    } else {
      if (remaining <= 0) remaining = modeMinutes(mode) * 60;
      running = true;
      timer = setInterval(() => tick(render), 1000);
    }
    render();
  }

  function reset(render) {
    running = false;
    stopTick();
    remaining = modeMinutes(mode) * 60;
    render();
  }

  async function openSettings(render) {
    const s = settings();
    const data = await App.ui.formModal("Pomodoro ayarları", [
      { name: "work", label: "Çalışma (dk)", type: "number", default: s.work },
      { name: "short", label: "Kısa mola (dk)", type: "number", default: s.short },
      { name: "long", label: "Uzun mola (dk)", type: "number", default: s.long },
      { name: "rounds", label: "Uzun moladan önce tur", type: "number", default: s.rounds },
      { name: "dailyGoal", label: "Günlük çalışma hedefi (dk)", type: "number", default: s.dailyGoal },
    ]);
    if (!data) return;
    ["work", "short", "long", "rounds", "dailyGoal"].forEach((k) => (data[k] = Math.max(1, Number(data[k]))));
    App.store.set(SET_KEY, data);
    if (!running) setMode(mode, render);
    else render();
  }

  function streak() {
    const days = new Set(log().filter((e) => e.minutes > 0).map((e) => e.date));
    let n = 0;
    const d = new Date();
    if (!days.has(App.ui.isoOf(d))) d.setDate(d.getDate() - 1); // bugün henüz çalışılmadıysa dünden say
    while (days.has(App.ui.isoOf(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  function weekStats() {
    const l = log();
    const byDay = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = `${d.getFullYear()}-${App.ui.pad(d.getMonth() + 1)}-${App.ui.pad(d.getDate())}`;
      byDay[iso] = 0;
    }
    l.forEach((e) => { if (e.date in byDay) byDay[e.date] += e.minutes; });
    return byDay;
  }

  function render(view) {
    App.ui.clear(view);
    if (remaining <= 0 && !running) remaining = modeMinutes(mode) * 60;
    const s = settings();

    view.appendChild(
      App.ui.pageHeader("Pomodoro", "Odaklan, dinlen, tekrarla — seanslar günlüğe kaydedilir", [
        App.ui.el("button", { class: "btn ghost", text: "⚙ Ayarlar", onClick: () => openSettings(() => render(view)) }),
      ])
    );

    const modeRow = App.ui.el("div", { class: "pomo-mode-row" });
    [["work", "Çalışma"], ["short", "Kısa mola"], ["long", "Uzun mola"]].forEach(([m, label]) => {
      modeRow.appendChild(App.ui.el("button", {
        class: "btn sm" + (mode === m ? " primary" : " ghost"), text: label,
        onClick: () => setMode(m, () => render(view)),
      }));
    });

    const card = App.ui.card([
      modeRow,
      App.ui.el("div", { class: "pomo-clock", text: fmt(remaining) }),
      App.ui.el("div", { class: "pomo-controls" }, [
        App.ui.el("button", { class: "btn primary", text: running ? "⏸ Duraklat" : "▶ Başlat", onClick: () => toggleRun(() => render(view)) }),
        App.ui.el("button", { class: "btn ghost", text: "↺ Sıfırla", onClick: () => reset(() => render(view)) }),
      ]),
      App.ui.el("div", { class: "form-row", style: "margin-top:16px;max-width:320px;margin-left:auto;margin-right:auto" }, [
        App.ui.el("label", { text: "Bu seansın konusu / dersi" }),
        App.ui.el("input", { type: "text", value: tag, placeholder: "örn. Programlama I – döngüler", onInput: (e) => (tag = e.target.value) }),
      ]),
      App.ui.el("p", { class: "muted", style: "text-align:center;margin-top:12px", text: `Tamamlanan tur: ${completedRounds}  ·  ${s.work}/${s.short}/${s.long} dk` }),
    ]);
    view.appendChild(card);

    // istatistik
    const today = weekStats()[App.ui.todayISO()] || 0;
    const total = log().reduce((a, e) => a + e.minutes, 0);
    const goalPct = Math.min(100, (today / (s.dailyGoal || 120)) * 100);
    view.appendChild(App.ui.el("div", { class: "grid cols-4" }, [
      stat("Bugün", today + " dk", "accent"),
      stat("Günlük hedef", Math.round(goalPct) + "%", goalPct >= 100 ? "green" : "amber"),
      stat("Seri 🔥", streak() + " gün", "green"),
      stat("Toplam", (total / 60).toFixed(1) + " sa", ""),
    ]));
    view.appendChild(App.ui.el("div", { class: "progress " + (goalPct >= 100 ? "green" : "amber"), style: "margin-bottom:16px" },
      App.ui.el("span", { style: "width:" + goalPct + "%" })));

    const wk = weekStats();
    const max = Math.max(60, ...Object.values(wk));
    const bars = App.ui.el("div", { style: "display:flex;gap:8px;align-items:flex-end;height:120px;margin-top:8px" });
    Object.entries(wk).forEach(([iso, min]) => {
      const d = new Date(iso + "T00:00:00");
      bars.appendChild(App.ui.el("div", { style: "flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;height:100%;justify-content:flex-end" }, [
        App.ui.el("div", { style: `width:70%;background:var(--accent);border-radius:4px;height:${(min / max) * 100}%;min-height:2px`, title: min + " dk" }),
        App.ui.el("small", { class: "muted", text: d.toLocaleDateString("tr-TR", { weekday: "short" }) }),
      ]));
    });
    view.appendChild(App.ui.card([App.ui.el("h3", { text: "Son 7 gün" }), bars]));
  }

  function stat(label, value, cls) {
    return App.ui.el("div", { class: "stat " + cls }, [
      App.ui.el("div", { class: "stat-label", text: label }),
      App.ui.el("div", { class: "stat-value", text: value }),
    ]);
  }

  App.registerModule({
    id: "pomodoro",
    title: "Pomodoro",
    icon: "⏱️",
    group: "Çalışma",
    render,
    unmount() {
      stopTick();
      running = false;
      document.title = "BÖTE Ders Merkezi";
    },
  });
})();
