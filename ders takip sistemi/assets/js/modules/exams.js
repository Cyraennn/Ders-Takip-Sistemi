/* Sınav Takvimi & Geri Sayım */
(function () {
  const KEY = "exams";
  const TYPES = ["Vize", "Final", "Bütünleme", "Quiz", "Proje teslimi", "Sunum"];

  function load() { return App.store.get(KEY, []); }
  function save(l) { App.store.set(KEY, l); }

  async function edit(existing) {
    const list = load();
    const data = await App.ui.formModal(
      existing ? "Sınavı düzenle" : "Sınav / teslim ekle",
      [
        { name: "course", label: "Ders", required: true, list: App.data.courseNames() },
        { name: "type", label: "Tür", type: "select", options: TYPES, default: "Vize" },
        { name: "date", label: "Tarih", type: "date", required: true },
        { name: "time", label: "Saat", type: "time" },
        { name: "location", label: "Yer / Derslik" },
        { name: "topics", label: "Çalışılacak konular (her satır bir madde)", type: "textarea", hint: "Konu listesi, aşağıda işaretlenebilir kontrol listesi olur" },
        { name: "done", label: "Tamamlandı", type: "checkbox" },
      ],
      existing || {}
    );
    if (!data) return;
    if (existing) {
      const item = list.find((e) => e.id === existing.id);
      if (item) { Object.assign(item, data); syncTopics(item); }
    } else {
      const it = Object.assign({ id: App.ui.uid(), topicDone: {} }, data);
      syncTopics(it);
      list.push(it);
    }
    save(list);
    App.refresh();
  }

  function syncTopics(item) {
    item.topicDone = item.topicDone || {};
    const cur = (item.topics || "").split("\n").map((s) => s.trim()).filter(Boolean);
    Object.keys(item.topicDone).forEach((k) => { if (!cur.includes(k)) delete item.topicDone[k]; });
  }

  async function remove(id) {
    if (!(await App.ui.confirm("Bu kayıt silinsin mi?"))) return;
    save(load().filter((e) => e.id !== id));
    App.refresh();
  }

  function toggle(e) {
    const list = load();
    const item = list.find((x) => x.id === e.id);
    if (!item) return;
    item.done = !item.done;
    save(list);
    App.refresh();
  }

  function toggleTopic(e, topic) {
    const list = load();
    const item = list.find((x) => x.id === e.id);
    if (!item) return;
    item.topicDone = item.topicDone || {};
    item.topicDone[topic] = !item.topicDone[topic];
    save(list);
    App.refresh();
  }

  function toICS(list) {
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//BOTE Ders Merkezi//TR"];
    list.forEach((e) => {
      const d = (e.date || "").replace(/-/g, "");
      const t = (e.time || "09:00").replace(":", "") + "00";
      lines.push(
        "BEGIN:VEVENT", "UID:" + e.id + "@bdm",
        "DTSTART:" + d + "T" + t,
        "SUMMARY:" + e.type + " - " + (e.course || "").replace(/[,;\n]/g, " "),
        "LOCATION:" + (e.location || "").replace(/[,;\n]/g, " "),
        "DESCRIPTION:" + (e.topics || "").replace(/\n/g, " · ").replace(/[,;]/g, " "),
        "END:VEVENT"
      );
    });
    lines.push("END:VCALENDAR");
    return lines.join("\r\n");
  }

  function render(view) {
    const list = load().slice().sort((a, b) => (a.date + (a.time || "")) < (b.date + (b.time || "")) ? -1 : 1);

    view.appendChild(
      App.ui.pageHeader("Sınav Takvimi", "Vize, final ve teslim tarihleri", [
        App.ui.el("button", { class: "btn ghost", text: "📆 .ics", disabled: !list.length, onClick: () => App.ui.downloadFile("sinavlar.ics", toICS(list), "text/calendar") }),
        App.ui.el("button", { class: "btn primary", text: "+ Ekle", onClick: () => edit(null) }),
      ])
    );

    const today = App.ui.todayISO();
    const upcoming = list.filter((e) => !e.done && App.ui.daysBetween(today, e.date) >= 0);
    if (upcoming.length) {
      const next = upcoming[0];
      const d = App.ui.daysBetween(today, next.date);
      view.appendChild(App.ui.card([
        App.ui.el("div", { class: "stat-label", text: "Sıradaki: " + next.type + " — " + next.course }),
        App.ui.el("div", { class: "stat-value", style: "font-size:2.4rem;color:var(--accent)", text: d === 0 ? "BUGÜN" : d + " gün" }),
        App.ui.el("div", { class: "stat-sub", text: App.ui.fmtDate(next.date) + (next.time ? " · " + next.time : "") + (next.location ? " · " + next.location : "") }),
      ]));
    }

    if (!list.length) {
      view.appendChild(App.ui.emptyState("Sınav kaydı yok.", "+ Ekle", () => edit(null)));
      return;
    }

    list.forEach((e) => {
      const d = App.ui.daysBetween(today, e.date);
      let cd;
      if (e.done) cd = App.ui.badge("bitti", "green");
      else if (d < 0) cd = App.ui.badge("geçmiş", "");
      else if (d === 0) cd = App.ui.badge("bugün", "red");
      else cd = App.ui.badge(d + " gün", d <= 3 ? "amber" : "accent");
      const topics = (e.topics || "").split("\n").map((s) => s.trim()).filter(Boolean);
      const td = e.topicDone || {};
      const doneCount = topics.filter((t) => td[t]).length;

      view.appendChild(App.ui.card([
        App.ui.el("div", { class: "page-head" }, [
          App.ui.el("div", {}, [
            App.ui.el("h3", { text: e.type + " — " + e.course }),
            App.ui.el("p", { class: "muted", text: App.ui.fmtDate(e.date) + (e.time ? " " + e.time : "") + (e.location ? " · " + e.location : "") }),
          ]),
          App.ui.el("div", { class: "page-head-actions" }, [
            cd,
            App.ui.el("button", { class: "btn sm ghost", text: e.done ? "↩ aç" : "✓ bitti", onClick: () => toggle(e) }),
            App.ui.el("button", { class: "btn sm ghost", text: "✎", onClick: () => edit(e) }),
            App.ui.el("button", { class: "btn sm ghost", text: "🗑", onClick: () => remove(e.id) }),
          ]),
        ]),
        topics.length ? App.ui.el("div", {}, [
          App.ui.el("div", { class: "progress " + (doneCount === topics.length ? "green" : "amber"), style: "margin:6px 0 10px" },
            App.ui.el("span", { style: "width:" + (doneCount / topics.length) * 100 + "%" })),
          App.ui.el("div", { class: "list" }, topics.map((t) =>
            App.ui.el("label", { style: "display:flex;gap:8px;align-items:center;cursor:pointer" }, [
              App.ui.el("input", { type: "checkbox", checked: !!td[t], onChange: () => toggleTopic(e, t) }),
              App.ui.el("span", { style: td[t] ? "text-decoration:line-through;color:var(--text-mute)" : "", text: t }),
            ])
          )),
        ]) : null,
      ]));
    });
  }

  App.registerModule({ id: "exams", title: "Sınav Takvimi", icon: "📝", group: "Planlama", render });
  App.registerCommand({ label: "Yeni sınav / teslim ekle", icon: "📝", group: "Ekle", run: () => edit(null) });
})();
