/* Ders Programı — haftalık ızgara (ders saatleri) */
(function () {
  const DAYS = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"];
  const KEY = "schedule";

  /* Üniversitenin resmî 45 dakikalık ders saatleri */
  const PERIODS = [
    ["08:30", "09:15"],
    ["09:25", "10:10"],
    ["10:20", "11:05"],
    ["11:15", "12:00"],
    ["13:00", "13:45"],
    ["13:55", "14:40"],
    ["14:50", "15:35"],
    ["15:45", "16:30"],
    ["16:40", "17:25"],
    ["17:35", "18:20"],
  ];

  const hm = (v) => App.ui.hm(v);
  const mins = (v) => App.ui.hmMin(v);

  /* Eski kayıtlarda start/end birer tamsayı saatti; "HH:MM" biçimine taşı. */
  function normalize(list) {
    let changed = false;
    list.forEach((e) => {
      const s = hm(e.start), n = hm(e.end);
      if (s !== e.start) { e.start = s; changed = true; }
      if (n !== e.end) { e.end = n; changed = true; }
    });
    return changed;
  }

  function load() {
    const list = App.store.get(KEY, []) || [];
    if (normalize(list)) App.store.set(KEY, list);
    return list;
  }
  function save(list) { App.store.set(KEY, list); }

  /* Bir dersin verilen ders saatiyle kesişip kesişmediği */
  function hits(e, period) {
    return mins(e.start) < mins(period[1]) && mins(e.end) > mins(period[0]);
  }
  function entryAt(list, dayIdx, period) {
    return list.find((e) => e.day === dayIdx && hits(e, period));
  }

  function fmtMin(m) { return App.ui.pad(Math.floor(m / 60)) + ":" + App.ui.pad(m % 60); }

  /* Izgara satırları: resmî saatler + gerekirse akşam saatleri */
  function gridRows(list) {
    const rows = PERIODS.slice();
    const max = list.reduce((m, e) => Math.max(m, mins(e.end)), 0);
    let last = mins(rows[rows.length - 1][1]);
    while (max > last && rows.length < 20) {
      const s = last + 10;
      rows.push([fmtMin(s), fmtMin(s + 45)]);
      last = s + 45;
    }
    return rows;
  }

  function label(e) { return (e.code ? e.code + " — " : "") + e.name; }

  async function editEntry(existing, dayIdx, period) {
    const list = load();
    const data = await App.ui.formModal(
      existing ? "Dersi düzenle" : "Ders ekle",
      [
        { name: "code", label: "Ders kodu", placeholder: "TEK 1003" },
        { name: "name", label: "Ders adı", required: true, list: App.data.courseNames() },
        { name: "kind", label: "Tür", type: "select", options: ["Teorik", "Uygulama", "Lab"], default: "Teorik" },
        { name: "day", label: "Gün", type: "select", options: DAYS.map((d, i) => ({ value: i, label: d })), default: dayIdx != null ? dayIdx : 0 },
        { name: "start", label: "Başlangıç", type: "time", default: period ? period[0] : PERIODS[0][0], hint: "Resmî saatler: " + PERIODS.slice(0, 8).map((p) => p[0]).join(" · ") },
        { name: "end", label: "Bitiş", type: "time", default: period ? period[1] : PERIODS[0][1] },
        { name: "room", label: "Derslik / Salon" },
        { name: "instructor", label: "Öğretim elemanı" },
      ],
      existing || {}
    );
    if (!data) return;
    data.day = Number(data.day);
    data.start = hm(data.start);
    data.end = hm(data.end);
    if (!data.start || !data.end) { App.ui.toast("Başlangıç ve bitiş saati gerekli", "error"); return; }
    if (mins(data.end) <= mins(data.start)) { App.ui.toast("Bitiş saati başlangıçtan sonra olmalı", "error"); return; }
    if (existing) {
      const item = list.find((e) => e.id === existing.id);
      if (item) Object.assign(item, data);
    } else {
      data.id = App.ui.uid();
      list.push(data);
    }
    save(list);
    App.refresh();
  }

  async function removeEntry(id) {
    if (!(await App.ui.confirm("Bu ders programdan silinsin mi?"))) return;
    save(load().filter((e) => e.id !== id));
    App.refresh();
  }

  async function resetAll() {
    if (!(await App.ui.confirm("Tüm ders programı silinsin mi? Bu işlem geri alınamaz."))) return;
    save([]);
    App.refresh();
    App.ui.toast("Ders programı sıfırlandı");
  }

  function nowInfo(list) {
    const d = new Date();
    const dayIdx = d.getDay() - 1;
    if (dayIdx < 0 || dayIdx > 4) return { weekend: true };
    const now = d.getHours() * 60 + d.getMinutes();
    const todays = list.filter((e) => e.day === dayIdx).sort((a, b) => mins(a.start) - mins(b.start));
    return {
      current: todays.find((e) => now >= mins(e.start) && now < mins(e.end)),
      next: todays.find((e) => mins(e.start) > now),
    };
  }

  function toICS(list) {
    const dayMap = ["MO", "TU", "WE", "TH", "FR"];
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const clean = (s) => String(s || "").replace(/[,;\n]/g, " ");
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//BOTE Ders Merkezi//TR", "CALSCALE:GREGORIAN"];
    list.forEach((e) => {
      const dt = (t) => {
        const x = new Date(monday);
        x.setDate(monday.getDate() + e.day);
        x.setHours(Math.floor(mins(t) / 60), mins(t) % 60, 0, 0);
        return x.getFullYear() + App.ui.pad(x.getMonth() + 1) + App.ui.pad(x.getDate()) + "T" +
          App.ui.pad(x.getHours()) + App.ui.pad(x.getMinutes()) + "00";
      };
      lines.push(
        "BEGIN:VEVENT",
        "UID:" + e.id + "@bdm",
        "DTSTART:" + dt(e.start),
        "DTEND:" + dt(e.end),
        "RRULE:FREQ=WEEKLY;COUNT=15;BYDAY=" + dayMap[e.day],
        "SUMMARY:" + clean(label(e) + (e.kind && e.kind !== "Teorik" ? " (" + e.kind + ")" : "")),
        "LOCATION:" + clean(e.room),
        "DESCRIPTION:" + clean(e.instructor),
        "END:VEVENT"
      );
    });
    lines.push("END:VCALENDAR");
    return lines.join("\r\n");
  }

  function render(view) {
    const list = load();
    const ni = nowInfo(list);

    view.appendChild(
      App.ui.pageHeader("Ders Programı", "Hücreye tıklayarak düzenle", [
        App.ui.el("button", { class: "btn ghost", text: "📆 .ics dışa aktar", disabled: !list.length, onClick: () => App.ui.downloadFile("ders-programi.ics", toICS(list), "text/calendar") }),
        App.ui.el("button", { class: "btn ghost", text: "🗑 Programı sıfırla", disabled: !list.length, onClick: resetAll }),
        App.ui.el("button", { class: "btn primary", text: "+ Ders ekle", onClick: () => editEntry(null) }),
      ])
    );

    if (!ni.weekend && (ni.current || ni.next)) {
      view.appendChild(App.ui.card([
        ni.current
          ? App.ui.el("div", {}, [App.ui.el("span", { class: "badge green", text: "ŞU AN" }), " ",
              App.ui.el("strong", { text: label(ni.current) }),
              App.ui.el("span", { class: "muted", text: "  " + hm(ni.current.start) + "–" + hm(ni.current.end) + (ni.current.room ? " · " + ni.current.room : "") })])
          : null,
        ni.next
          ? App.ui.el("div", { style: ni.current ? "margin-top:6px" : "" }, [App.ui.el("span", { class: "badge accent", text: "SIRADAKİ" }), " ",
              App.ui.el("strong", { text: label(ni.next) }),
              App.ui.el("span", { class: "muted", text: "  " + hm(ni.next.start) + (ni.next.room ? " · " + ni.next.room : "") })])
          : null,
      ]));
    }

    const rows = gridRows(list);
    const grid = App.ui.el("div", { class: "schedule-grid" });
    grid.appendChild(App.ui.el("div", { class: "sg-head" }));
    DAYS.forEach((d) => grid.appendChild(App.ui.el("div", { class: "sg-head", text: d })));

    rows.forEach((period, pi) => {
      grid.appendChild(App.ui.el("div", { class: "sg-time" }, [
        App.ui.el("span", { text: period[0] }),
        App.ui.el("span", { class: "sg-time-end", text: period[1] }),
      ]));
      for (let d = 0; d < DAYS.length; d++) {
        const e = entryAt(list, d, period);
        if (!e) {
          grid.appendChild(App.ui.el("div", { class: "sg-cell", onClick: () => editEntry(null, d, period) }));
        } else if (pi > 0 && hits(e, rows[pi - 1])) {
          grid.appendChild(App.ui.el("div", {
            class: "sg-cell filled cont",
            onClick: () => editEntry(e),
            title: label(e) + " (devam)",
          }, App.ui.el("span", { class: "sg-room", text: "↑ " + e.name })));
        } else {
          grid.appendChild(App.ui.el("div", {
            class: "sg-cell filled",
            onClick: () => editEntry(e),
            title: label(e) + "\n" + hm(e.start) + "–" + hm(e.end) + (e.room ? "\n" + e.room : "") + (e.instructor ? "\n" + e.instructor : ""),
          }, [
            e.code ? App.ui.el("span", { class: "sg-code", text: e.code }) : null,
            App.ui.el("span", { text: e.name }),
            e.kind && e.kind !== "Teorik" ? App.ui.el("span", { class: "sg-room", text: e.kind }) : null,
            e.room ? App.ui.el("span", { class: "sg-room", text: e.room }) : null,
          ]));
        }
      }
    });

    view.appendChild(App.ui.card(App.ui.el("div", { class: "table-wrap" }, grid)));

    if (list.length) {
      const wrap = App.ui.el("div", { class: "table-wrap" });
      const trs = list.slice().sort((a, b) => a.day - b.day || mins(a.start) - mins(b.start)).map((e) =>
        App.ui.el("tr", {}, [
          App.ui.el("td", { text: DAYS[e.day] }),
          App.ui.el("td", { text: hm(e.start) + " – " + hm(e.end) }),
          App.ui.el("td", { text: e.code || "—" }),
          App.ui.el("td", { text: e.name + (e.kind && e.kind !== "Teorik" ? " (" + e.kind + ")" : "") }),
          App.ui.el("td", { text: e.room || "—" }),
          App.ui.el("td", { text: e.instructor || "—" }),
          App.ui.el("td", { class: "actions" }, [
            App.ui.el("button", { class: "btn sm ghost", text: "Sil", onClick: () => removeEntry(e.id) }),
          ]),
        ])
      );
      wrap.appendChild(App.ui.el("table", { class: "data" }, [
        App.ui.el("thead", {}, App.ui.el("tr", {}, ["Gün", "Saat", "Kod", "Ders", "Derslik", "Öğr. elemanı", ""].map((h) => App.ui.el("th", { text: h })))),
        App.ui.el("tbody", {}, trs),
      ]));
      view.appendChild(App.ui.card([App.ui.el("h3", { text: "Liste görünümü" }), wrap]));
    }
  }

  App.schedule = { periods: () => PERIODS.slice(), list: load };

  App.registerModule({ id: "schedule", title: "Ders Programı", icon: "📅", group: "Planlama", render });
  App.registerCommand({ label: "Yeni ders (programa ekle)", icon: "📅", group: "Ekle", run: () => editEntry(null) });
})();
