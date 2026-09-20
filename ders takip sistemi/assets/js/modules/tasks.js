/* Ödev & Proje Takibi */
(function () {
  const KEY = "tasks";
  const STATUS = ["Yapılacak", "Devam ediyor", "Tamamlandı"];
  const PRIO = ["Düşük", "Orta", "Yüksek"];
  const REPEAT = ["Yok", "Haftalık", "2 haftada bir", "Aylık"];

  function load() { return App.store.get(KEY, []); }
  function save(l) { App.store.set(KEY, l); }

  async function edit(existing) {
    const list = load();
    const data = await App.ui.formModal(
      existing ? "Ödevi düzenle" : "Yeni ödev / proje",
      [
        { name: "title", label: "Başlık", required: true },
        { name: "course", label: "Ders", list: App.data.courseNames() },
        { name: "due", label: "Teslim tarihi", type: "date" },
        { name: "priority", label: "Öncelik", type: "select", options: PRIO, default: "Orta" },
        { name: "status", label: "Durum", type: "select", options: STATUS, default: "Yapılacak" },
        { name: "repeat", label: "Tekrar", type: "select", options: REPEAT, default: "Yok", hint: "Tamamlanınca sonraki tarihe yeni görev oluşturulur" },
        { name: "notes", label: "Notlar", type: "textarea" },
      ],
      existing || {}
    );
    if (!data) return;
    if (existing) {
      const item = list.find((t) => t.id === existing.id);
      if (item) Object.assign(item, data);
    } else {
      list.push(Object.assign({ id: App.ui.uid(), created: App.ui.todayISO(), subtasks: [] }, data));
    }
    save(list);
    App.refresh();
  }

  async function remove(id) {
    if (!(await App.ui.confirm("Bu görev silinsin mi?"))) return;
    save(load().filter((t) => t.id !== id));
    App.refresh();
  }

  function nextDate(iso, repeat) {
    if (!iso || repeat === "Yok" || !repeat) return null;
    const d = new Date(iso + "T00:00:00");
    if (repeat === "Haftalık") d.setDate(d.getDate() + 7);
    else if (repeat === "2 haftada bir") d.setDate(d.getDate() + 14);
    else if (repeat === "Aylık") d.setMonth(d.getMonth() + 1);
    return App.ui.isoOf(d);
  }

  function cycleStatus(t) {
    const list = load();
    const item = list.find((x) => x.id === t.id);
    if (!item) return;
    const i = STATUS.indexOf(item.status);
    const wasOpen = item.status !== "Tamamlandı";
    item.status = STATUS[(i + 1) % STATUS.length];
    if (wasOpen && item.status === "Tamamlandı" && item.repeat && item.repeat !== "Yok") {
      const nd = nextDate(item.due, item.repeat);
      list.push(Object.assign({}, item, {
        id: App.ui.uid(), status: "Yapılacak", due: nd, created: App.ui.todayISO(),
        subtasks: (item.subtasks || []).map((s) => ({ id: App.ui.uid(), text: s.text, done: false })),
      }));
      App.ui.toast("Tekrar eden görev " + (nd ? App.ui.fmtDate(nd) : "") + " için oluşturuldu", "info");
    }
    save(list);
    App.refresh();
  }

  async function addSubtask(t) {
    const text = await App.ui.prompt({ title: "Alt görev", label: "Adım" });
    if (!text) return;
    const list = load();
    const item = list.find((x) => x.id === t.id);
    if (!item) return;
    item.subtasks = item.subtasks || [];
    item.subtasks.push({ id: App.ui.uid(), text, done: false });
    save(list);
    App.refresh();
  }

  function toggleSub(t, sid) {
    const list = load();
    const item = list.find((x) => x.id === t.id);
    const s = item && (item.subtasks || []).find((x) => x.id === sid);
    if (!s) return;
    s.done = !s.done;
    save(list);
    App.refresh();
  }

  function delSub(t, sid) {
    const list = load();
    const item = list.find((x) => x.id === t.id);
    if (item) item.subtasks = (item.subtasks || []).filter((x) => x.id !== sid);
    save(list);
    App.refresh();
  }

  function dueBadge(due) {
    if (!due) return null;
    const d = App.ui.daysBetween(App.ui.todayISO(), due);
    let cls = "green", txt = App.ui.fmtDate(due);
    if (d < 0) { cls = "red"; txt = Math.abs(d) + " gün gecikti"; }
    else if (d === 0) { cls = "red"; txt = "Bugün!"; }
    else if (d <= 3) { cls = "amber"; txt = d + " gün kaldı"; }
    else txt = d + " gün kaldı";
    return App.ui.el("span", { class: "badge " + cls, text: txt });
  }

  let filter = "Hepsi";

  function render(view) {
    const all = load();

    view.appendChild(
      App.ui.pageHeader("Ödev & Proje Takibi", all.length + " kayıt", [
        App.ui.el("button", { class: "btn ghost", text: "CSV", disabled: !all.length, onClick: () => exportCsv(all) }),
        App.ui.el("button", { class: "btn primary", text: "+ Ödev ekle", onClick: () => edit(null) }),
      ])
    );

    const today = App.ui.todayISO();
    const counts = {
      open: all.filter((t) => t.status !== "Tamamlandı").length,
      late: all.filter((t) => t.status !== "Tamamlandı" && t.due && App.ui.daysBetween(today, t.due) < 0).length,
      done: all.filter((t) => t.status === "Tamamlandı").length,
    };
    view.appendChild(App.ui.el("div", { class: "grid cols-3" }, [
      App.ui.stat("Açık görev", counts.open, "accent"),
      App.ui.stat("Geciken", counts.late, counts.late ? "red" : "green"),
      App.ui.stat("Tamamlanan", counts.done, "green"),
    ]));

    const filterRow = App.ui.el("div", { class: "chip-row", style: "margin:14px 0" });
    ["Hepsi", "Bugün", ...STATUS].forEach((s) => {
      filterRow.appendChild(App.ui.el("span", {
        class: "chip" + (filter === s ? " active" : ""), text: s,
        onClick: () => { filter = s; App.refresh(); },
      }));
    });
    view.appendChild(filterRow);

    let list = all.slice();
    if (filter === "Bugün") list = list.filter((t) => t.status !== "Tamamlandı" && t.due === today);
    else if (filter !== "Hepsi") list = list.filter((t) => t.status === filter);
    list.sort((a, b) => {
      const ax = a.status === "Tamamlandı" ? 1 : 0, bx = b.status === "Tamamlandı" ? 1 : 0;
      if (ax !== bx) return ax - bx;
      return (a.due || "9999") < (b.due || "9999") ? -1 : 1;
    });

    if (!list.length) {
      view.appendChild(App.ui.emptyState("Görev yok.", "+ Ödev ekle", () => edit(null)));
      return;
    }

    const wrap = App.ui.el("div", { class: "list" });
    list.forEach((t) => {
      const subs = t.subtasks || [];
      const doneSubs = subs.filter((s) => s.done).length;
      wrap.appendChild(App.ui.el("div", { class: "card", style: "margin-bottom:10px;padding:12px 14px" }, [
        App.ui.el("div", { style: "display:flex;gap:12px;align-items:flex-start" }, [
          App.ui.el("div", { class: "li-main" }, [
            App.ui.el("div", { class: "li-title" + (t.status === "Tamamlandı" ? " done" : ""), style: t.status === "Tamamlandı" ? "text-decoration:line-through;color:var(--text-mute)" : "", text: t.title }),
            App.ui.el("div", { class: "li-sub", style: "margin-top:4px" }, [
              t.course ? App.ui.badge(t.course, "accent") : null, " ",
              App.ui.badge(t.priority || "Orta", t.priority === "Yüksek" ? "red" : t.priority === "Orta" ? "amber" : ""), " ",
              t.status !== "Tamamlandı" ? dueBadge(t.due) : null, " ",
              t.repeat && t.repeat !== "Yok" ? App.ui.badge("↻ " + t.repeat, "purple") : null,
              subs.length ? App.ui.el("span", { class: "muted", text: "  ☑ " + doneSubs + "/" + subs.length }) : null,
            ]),
            t.notes ? App.ui.el("p", { class: "muted", style: "margin:6px 0 0", text: t.notes }) : null,
            subs.length ? App.ui.el("div", { class: "list", style: "margin-top:8px" }, subs.map((s) =>
              App.ui.el("div", { style: "display:flex;align-items:center;gap:8px" }, [
                App.ui.el("input", { type: "checkbox", checked: s.done, onChange: () => toggleSub(t, s.id) }),
                App.ui.el("span", { style: s.done ? "text-decoration:line-through;color:var(--text-mute);flex:1" : "flex:1", text: s.text }),
                App.ui.el("button", { class: "btn sm ghost", text: "✕", onClick: () => delSub(t, s.id) }),
              ])
            )) : null,
          ]),
          App.ui.el("div", { class: "li-actions", style: "flex-shrink:0" }, [
            App.ui.el("button", { class: "btn sm ghost", text: t.status, title: "Durumu değiştir", onClick: () => cycleStatus(t) }),
            App.ui.el("button", { class: "btn sm ghost", text: "＋☑", title: "Alt görev ekle", onClick: () => addSubtask(t) }),
            App.ui.el("button", { class: "btn sm ghost", text: "✎", onClick: () => edit(t) }),
            App.ui.el("button", { class: "btn sm ghost", text: "🗑", onClick: () => remove(t.id) }),
          ]),
        ]),
      ]));
    });
    view.appendChild(wrap);
  }

  function exportCsv(all) {
    const esc = (s) => '"' + String(s == null ? "" : s).replace(/"/g, '""') + '"';
    const rows = [["Başlık", "Ders", "Teslim", "Öncelik", "Durum", "Tekrar", "Notlar"].join(",")];
    all.forEach((t) => rows.push([t.title, t.course, t.due, t.priority, t.status, t.repeat, t.notes].map(esc).join(",")));
    App.ui.downloadFile("odevler.csv", "﻿" + rows.join("\r\n"), "text/csv");
  }

  App.registerModule({ id: "tasks", title: "Ödev & Proje", icon: "✅", group: "Planlama", render });
  App.registerCommand({ label: "Yeni ödev ekle", icon: "✅", group: "Ekle", run: () => edit(null) });
  App.registerSearch((q) =>
    load().filter((t) => (t.title + " " + (t.course || "") + " " + (t.notes || "")).toLowerCase().includes(q))
      .slice(0, 6)
      .map((t) => ({ label: t.title, group: "Ödev", icon: "✅", run: () => { App.go("tasks"); } }))
  );
})();
