/* Çalışma Takvimi — sınav + ödev + ders birleşik aylık görünüm */
(function () {
  const DOW = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
  let cursor = new Date();
  cursor.setDate(1);

  function eventsForMonth(year, month) {
    const map = {};
    const add = (iso, ev) => { (map[iso] = map[iso] || []).push(ev); };
    (App.store.get("exams", []) || []).forEach((e) => {
      if (!e.date) return;
      const d = new Date(e.date + "T00:00:00");
      if (d.getFullYear() === year && d.getMonth() === month)
        add(e.date, { type: "exam", label: e.type + ": " + e.course, done: e.done });
    });
    (App.store.get("tasks", []) || []).forEach((t) => {
      if (!t.due) return;
      const d = new Date(t.due + "T00:00:00");
      if (d.getFullYear() === year && d.getMonth() === month)
        add(t.due, { type: "task", label: "Ödev: " + t.title, done: t.status === "Tamamlandı" });
    });
    const rev = {};
    (App.store.get("decks", []) || []).forEach((deck) => (deck.cards || []).forEach((c) => {
      if (!c.due) return;
      const d = new Date(c.due + "T00:00:00");
      if (d.getFullYear() === year && d.getMonth() === month) rev[c.due] = (rev[c.due] || 0) + 1;
    }));
    Object.entries(rev).forEach(([iso, n]) => add(iso, { type: "review", label: "🔁 " + n + " kart tekrar" }));
    return map;
  }

  function dayDetail(iso) {
    const exams = (App.store.get("exams", []) || []).filter((e) => e.date === iso);
    const tasks = (App.store.get("tasks", []) || []).filter((t) => t.due === iso);
    const dow = (new Date(iso + "T00:00:00").getDay() + 6) % 7;
    const classes = (App.store.get("schedule", []) || []).filter((e) => e.day === dow).sort((a, b) => App.ui.hmMin(a.start) - App.ui.hmMin(b.start));
    const body = App.ui.el("div", { class: "list" });
    if (!exams.length && !tasks.length && !classes.length) body.appendChild(App.ui.el("p", { class: "muted", text: "Bu gün için kayıt yok." }));
    classes.forEach((c) => body.appendChild(item("🕘 " + App.ui.hm(c.start) + " " + (c.code ? c.code + " — " : "") + c.name, c.room || "", "class")));
    exams.forEach((e) => body.appendChild(item("📝 " + e.type + " — " + e.course, (e.time || "") + " " + (e.location || ""), "exam")));
    tasks.forEach((t) => body.appendChild(item("✅ " + t.title, t.course || "", "task")));
    let reviews = 0;
    (App.store.get("decks", []) || []).forEach((d) => (d.cards || []).forEach((c) => { if (c.due === iso) reviews++; }));
    if (reviews) {
      body.appendChild(App.ui.el("div", { class: "list-item" }, [
        App.ui.el("div", { class: "li-main" }, App.ui.el("div", { class: "li-title", text: "🔁 " + reviews + " kart tekrar" })),
        iso <= App.ui.todayISO() && App.flashcards ? App.ui.el("button", { class: "btn sm primary", text: "Çalış", onClick: () => App.flashcards.startMixedDue() }) : null,
      ]));
    }
    App.ui.modal({ title: App.ui.fmtDate(iso), body });
  }

  function item(title, sub, kind) {
    return App.ui.el("div", { class: "list-item" }, [
      App.ui.el("div", { class: "li-main" }, [
        App.ui.el("div", { class: "li-title", text: title }),
        sub ? App.ui.el("div", { class: "li-sub", text: sub }) : null,
      ]),
    ]);
  }

  function render(view) {
    const year = cursor.getFullYear(), month = cursor.getMonth();
    const monthName = cursor.toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
    const evMap = eventsForMonth(year, month);

    view.appendChild(App.ui.pageHeader("Çalışma Takvimi", "Sınavlar, ödev teslimleri ve dersler bir arada", [
      App.ui.el("button", { class: "btn ghost", text: "‹", onClick: () => { cursor.setMonth(month - 1); App.refresh(); } }),
      App.ui.el("button", { class: "btn ghost", text: "Bugün", onClick: () => { cursor = new Date(); cursor.setDate(1); App.refresh(); } }),
      App.ui.el("button", { class: "btn ghost", text: "›", onClick: () => { cursor.setMonth(month + 1); App.refresh(); } }),
    ]));

    view.appendChild(App.ui.el("h3", { text: monthName, style: "text-transform:capitalize" }));

    const grid = App.ui.el("div", { class: "cal-grid" });
    DOW.forEach((d) => grid.appendChild(App.ui.el("div", { class: "cal-head", text: d })));

    const first = new Date(year, month, 1);
    const startOffset = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayISO = App.ui.todayISO();

    for (let i = 0; i < startOffset; i++) {
      const d = new Date(year, month, 1 - (startOffset - i));
      grid.appendChild(cell(d, true, {}));
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      const iso = App.ui.isoOf(d);
      grid.appendChild(cell(d, false, evMap[iso] || [], iso === todayISO));
    }
    const total = startOffset + daysInMonth;
    for (let i = 0; i < (7 - (total % 7)) % 7; i++) {
      const d = new Date(year, month + 1, i + 1);
      grid.appendChild(cell(d, true, {}));
    }

    view.appendChild(App.ui.card(grid));

    // ay listesi
    const upcoming = [];
    Object.entries(evMap).sort().forEach(([iso, evs]) => evs.forEach((e) => upcoming.push({ iso, e })));
    if (upcoming.length) {
      view.appendChild(App.ui.card([
        App.ui.el("h3", { text: "Bu ay" }),
        App.ui.el("div", { class: "list" }, upcoming.map(({ iso, e }) =>
          App.ui.el("div", { class: "list-item" + (e.done ? " done" : "") }, [
            App.ui.el("span", { class: "badge " + (e.type === "exam" ? "red" : "amber"), text: App.ui.fmtDate(iso) }),
            App.ui.el("span", { class: "li-main", text: e.label, style: e.done ? "text-decoration:line-through;color:var(--text-mute)" : "" }),
          ])
        )),
      ]));
    }
  }

  function cell(date, other, evs, isToday) {
    evs = Array.isArray(evs) ? evs : [];
    const iso = App.ui.isoOf(date);
    return App.ui.el("div", {
      class: "cal-cell" + (other ? " other" : "") + (isToday ? " today" : ""),
      onClick: () => { if (!other) dayDetail(iso); },
    }, [
      App.ui.el("span", { class: "cal-daynum", text: date.getDate() }),
      ...evs.slice(0, 3).map((e) => App.ui.el("span", { class: "cal-ev " + e.type, text: e.label, title: e.label })),
      evs.length > 3 ? App.ui.el("span", { class: "muted", text: "+" + (evs.length - 3) }) : null,
    ]);
  }

  App.registerModule({ id: "calendar", title: "Çalışma Takvimi", icon: "🗓️", group: "Planlama", render });
})();
