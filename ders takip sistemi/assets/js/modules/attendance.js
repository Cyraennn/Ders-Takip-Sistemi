/* Devamsızlık Takibi — %30 kuralı */
(function () {
  const KEY = "attendance";

  function load() { return App.store.get(KEY, []); }
  function save(l) { App.store.set(KEY, l); }

  function calc(c) {
    const total = Number(c.weeklyHours || 0) * Number(c.weeks || 14);
    const allowed = Math.floor((total * Number(c.limitPct || 30)) / 100);
    const used = Number(c.absences || 0);
    const remaining = allowed - used;
    return { total, allowed, used, remaining, pct: total ? (used / total) * 100 : 0 };
  }

  async function edit(existing) {
    const list = load();
    const data = await App.ui.formModal(
      existing ? "Dersi düzenle" : "Ders ekle",
      [
        { name: "course", label: "Ders adı", required: true, list: App.data.courseNames() },
        { name: "weeklyHours", label: "Haftalık ders saati", type: "number", default: 3, required: true },
        { name: "weeks", label: "Dönem hafta sayısı", type: "number", default: 14 },
        { name: "limitPct", label: "Devamsızlık sınırı (%)", type: "number", default: 30, hint: "Teorik ders genelde %30, uygulama/lab %20" },
        { name: "absences", label: "Mevcut devamsızlık (saat)", type: "number", default: 0 },
      ],
      existing || {}
    );
    if (!data) return;
    ["weeklyHours", "weeks", "limitPct", "absences"].forEach((k) => (data[k] = Number(data[k])));
    if (existing) {
      const item = list.find((c) => c.id === existing.id);
      if (item) Object.assign(item, data);
    } else {
      list.push(Object.assign({ id: App.ui.uid() }, data));
    }
    save(list);
    App.refresh();
  }

  function bump(c, delta) {
    const list = load();
    const item = list.find((x) => x.id === c.id);
    if (!item) return;
    item.absences = Math.max(0, Number(item.absences || 0) + delta);
    save(list);
    App.refresh();
  }

  async function remove(id) {
    if (!(await App.ui.confirm("Bu ders silinsin mi?"))) return;
    save(load().filter((c) => c.id !== id));
    App.refresh();
  }

  function render(view) {
    const list = load();

    view.appendChild(
      App.ui.pageHeader("Devamsızlık Takibi", "Her ders için kalan devamsızlık hakkın", [
        App.ui.el("button", { class: "btn primary", text: "+ Ders ekle", onClick: () => edit(null) }),
      ])
    );

    if (!list.length) {
      view.appendChild(App.ui.emptyState("Ders eklenmedi.", "+ Ders ekle", () => edit(null)));
      return;
    }

    const risk = list.filter((c) => calc(c).remaining <= 0).length;
    if (risk) {
      view.appendChild(App.ui.el("div", { class: "card", style: "border-color:var(--red)" }, [
        App.ui.el("strong", { text: "⚠️ " + risk + " derste devamsızlık hakkın doldu / aşıldı." }),
      ]));
    }

    view.appendChild(App.ui.el("div", { class: "grid cols-2" }, list.map((c) => {
      const r = calc(c);
      const cls = r.remaining <= 0 ? "red" : r.remaining <= 2 ? "amber" : "green";
      return App.ui.card([
        App.ui.el("div", { class: "page-head" }, [
          App.ui.el("h3", { text: c.course }),
          App.ui.el("span", { class: "badge " + cls, text: r.remaining > 0 ? r.remaining + " saat kaldı" : "hak doldu" }),
        ]),
        App.ui.el("div", { class: "progress " + cls }, App.ui.el("span", { style: "width:" + Math.min(100, (r.used / (r.allowed || 1)) * 100) + "%" })),
        App.ui.el("p", { class: "muted", style: "margin-top:8px", text:
          `Kullanılan ${r.used} / ${r.allowed} saat  ·  toplam ${r.total} saatlik ders  ·  sınır %${c.limitPct}` }),
        App.ui.el("div", { class: "li-actions" }, [
          App.ui.el("button", { class: "btn sm", text: "− 1 saat", onClick: () => bump(c, -1) }),
          App.ui.el("button", { class: "btn sm", text: "+ 1 saat", onClick: () => bump(c, 1) }),
          App.ui.el("button", { class: "btn sm", text: "+ " + (c.weeklyHours || 1) + " (1 hafta)", onClick: () => bump(c, Number(c.weeklyHours || 1)) }),
          App.ui.el("button", { class: "btn sm ghost", text: "✎", onClick: () => edit(c) }),
          App.ui.el("button", { class: "btn sm ghost", text: "🗑", onClick: () => remove(c.id) }),
        ]),
      ]);
    })));
  }

  App.registerModule({ id: "attendance", title: "Devamsızlık", icon: "📉", group: "Akademik", render });
})();
