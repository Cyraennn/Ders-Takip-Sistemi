/* Ayarlar — görünüm, bildirimler, AI, veri */
(function () {
  function chip(label, active, onClick) {
    return App.ui.el("span", { class: "chip" + (active ? " active" : ""), text: label, onClick });
  }
  function toggle(label, val, onChange) {
    return App.ui.el("label", { style: "display:flex;gap:8px;align-items:center;margin:6px 0;cursor:pointer" }, [
      App.ui.el("input", { type: "checkbox", checked: !!val, onChange: (e) => onChange(e.target.checked) }),
      App.ui.el("span", { text: label }),
    ]);
  }
  function setPref(patch) { App.setNotifPrefs(patch); App.refresh(); }

  function render(view) {
    view.appendChild(App.ui.pageHeader("Ayarlar", "Hesap · görünüm · bildirimler · AI · veri", []));

    /* Hesap & bulut */
    if (App.auth && App.auth.renderAccountCard) view.appendChild(App.auth.renderAccountCard());

    /* Görünüm */
    const theme = App.getTheme();
    view.appendChild(App.ui.card([
      App.ui.el("h3", { text: "Görünüm" }),
      App.ui.el("div", { class: "chip-row" }, [
        chip("🌙 Koyu", theme !== "light", () => { App.setTheme("dark"); App.refresh(); }),
        chip("☀️ Açık", theme === "light", () => { App.setTheme("light"); App.refresh(); }),
      ]),
    ]));

    /* Bildirimler */
    const p = App.notifPrefs();
    const supported = typeof Notification !== "undefined";
    const perm = supported ? Notification.permission : "unsupported";
    const bell = [App.ui.el("h3", { text: "Bildirimler" })];
    if (!supported) {
      bell.push(App.ui.el("p", { class: "muted", text: "Bu tarayıcı bildirim desteklemiyor." }));
    } else if (perm !== "granted") {
      bell.push(App.ui.el("p", { class: "muted", text: perm === "denied" ? "İzin reddedilmiş — tarayıcı site ayarlarından açman gerekir." : "Bildirimleri açmak için izin ver." }));
      if (perm !== "denied") bell.push(App.ui.el("button", { class: "btn primary", text: "🔔 Bildirimlere izin ver", onClick: async () => { await App.requestNotifyPermission(); App.refresh(); } }));
    } else {
      bell.push(
        toggle("Bildirimler açık", p.enabled, (v) => setPref({ enabled: v })),
        toggle("Bugünkü sınav / ödevler", p.today, (v) => setPref({ today: v })),
        toggle("1 gün önceden hatırlat", p.dayBefore, (v) => setPref({ dayBefore: v })),
        toggle("Pomodoro seansı bitince", p.pomodoro, (v) => setPref({ pomodoro: v })),
        App.ui.el("div", { style: "display:flex;gap:8px;margin-top:8px" }, [
          App.ui.el("button", { class: "btn sm ghost", text: "Test bildirimi", onClick: () => App.notify("Test", "Bildirimler çalışıyor ✔") }),
          App.ui.el("button", { class: "btn sm ghost", text: "Şimdi kontrol et", onClick: () => { App.runReminders(); App.ui.toast("Hatırlatmalar kontrol edildi", "info"); } }),
        ]),
      );
    }
    bell.push(App.ui.el("small", { class: "hint", text: "Bildirimler yalnızca uygulama bir sekmede açıkken çalışır (sunucusuz sürüm). Sekme açıkken 30 dakikada bir kontrol edilir." }));
    view.appendChild(App.ui.card(bell));

    /* AI */
    view.appendChild(App.ui.card([
      App.ui.el("h3", { text: "AI Asistan" }),
      App.ui.el("p", { class: "muted", text: App.ai && App.ai.hasKey() ? "API anahtarı tanımlı." : "API anahtarı tanımlı değil." }),
      App.ui.el("button", { class: "btn", text: "AI ayarlarını aç", onClick: () => (App.ai ? App.ai.openSettings() : App.go("ai")) }),
    ]));

    /* Veri */
    view.appendChild(App.ui.card([
      App.ui.el("h3", { text: "Veri" }),
      App.ui.el("p", { class: "muted", text: "Verilerin bu tarayıcıda saklanır. Düzenli yedek al." }),
      App.ui.el("button", { class: "btn", text: "Yedekle & Geri Yükle →", onClick: () => App.go("backup") }),
    ]));

    /* JARVIS */
    view.appendChild(App.ui.card([
      App.ui.el("h3", { text: "JARVIS asistanı" }),
      App.ui.el("p", { class: "muted", text: "Aynı ağdaki JARVIS sesli asistanı sınav/ödev/programına erişip ekleme yapabilir." }),
      App.ui.el("button", { class: "btn", text: "JARVIS bağlantısı →", onClick: () => App.go("jarvis") }),
    ]));
  }

  App.registerModule({ id: "settings", title: "Ayarlar", icon: "⚙️", group: "Sistem", render });
  App.registerCommand({ label: "Ayarlar", icon: "⚙️", group: "Sayfa", run: () => App.go("settings") });
})();
