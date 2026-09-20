/* Notlar & GPA (GANO / YANO) — Türk not sistemi */
(function () {
  const KEY = "grades_courses";
  const GRADES = {
    "AA": 4.0, "BA": 3.5, "BB": 3.0, "CB": 2.5, "CC": 2.0,
    "DC": 1.5, "DD": 1.0, "FD": 0.5, "FF": 0.0, "DZ": 0.0,
  };
  const GRADE_KEYS = Object.keys(GRADES);

  function load() { return App.store.get(KEY, []); }
  function save(l) { App.store.set(KEY, l); }

  function terms(list) {
    return [...new Set(list.map((c) => c.term))].sort((a, b) => {
      const na = parseInt(a) || 99, nb = parseInt(b) || 99;
      return na - nb || a.localeCompare(b, "tr");
    });
  }

  function gpaOf(courses) {
    let pts = 0, cr = 0;
    courses.forEach((c) => {
      const g = GRADES[c.grade];
      if (g == null) return;
      pts += g * Number(c.credit || 0);
      cr += Number(c.credit || 0);
    });
    return cr ? { gpa: pts / cr, credits: cr } : { gpa: null, credits: 0 };
  }

  async function edit(existing) {
    const list = load();
    const knownTerms = terms(list);
    const data = await App.ui.formModal(
      existing ? "Dersi düzenle" : "Ders / not ekle",
      [
        { name: "term", label: "Yarıyıl", required: true, default: existing ? existing.term : (knownTerms[knownTerms.length - 1] || "1. Yarıyıl"), placeholder: "örn. 3. Yarıyıl", list: knownTerms },
        { name: "name", label: "Ders adı", required: true, list: App.data.courseNames() },
        { name: "credit", label: "Kredi (AKTS)", type: "number", step: "0.5", required: true, default: 5 },
        { name: "grade", label: "Harf notu", type: "select", options: ["", ...GRADE_KEYS], default: existing ? existing.grade : "" },
      ],
      existing || {}
    );
    if (!data) return;
    data.credit = Number(data.credit);
    if (existing) {
      const item = list.find((c) => c.id === existing.id);
      if (item) Object.assign(item, data);
    } else {
      list.push(Object.assign({ id: App.ui.uid() }, data));
    }
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
    const overall = gpaOf(list);

    view.appendChild(
      App.ui.pageHeader("Notlar & GPA", "Kredi (AKTS) ağırlıklı GANO / YANO hesabı", [
        App.ui.el("button", { class: "btn primary", text: "+ Ders ekle", onClick: () => edit(null) }),
      ])
    );

    view.appendChild(App.ui.el("div", { class: "grid cols-3" }, [
      bigStat("GANO", overall.gpa != null ? overall.gpa.toFixed(2) : "—", "accent", "Genel ağırlıklı ortalama"),
      bigStat("Toplam AKTS", overall.credits, "green", "Notu girilmiş dersler"),
      bigStat("Ders sayısı", list.length, "", terms(list).length + " yarıyıl"),
    ]));

    if (!list.length) {
      view.appendChild(App.ui.emptyState("Henüz ders eklenmedi.", "+ Ders ekle", () => edit(null)));
      view.appendChild(gradeLegend());
      return;
    }

    terms(list).forEach((term) => {
      const courses = list.filter((c) => c.term === term);
      const t = gpaOf(courses);
      const wrap = App.ui.el("div", { class: "table-wrap" });
      wrap.appendChild(App.ui.el("table", { class: "data" }, [
        App.ui.el("thead", {}, App.ui.el("tr", {}, ["Ders", "AKTS", "Harf", "Katsayı", ""].map((h) => App.ui.el("th", { text: h })))),
        App.ui.el("tbody", {}, courses.map((c) => App.ui.el("tr", {}, [
          App.ui.el("td", { text: c.name }),
          App.ui.el("td", { text: c.credit }),
          App.ui.el("td", {}, c.grade ? App.ui.el("span", { class: "badge " + gradeCls(c.grade), text: c.grade }) : App.ui.el("span", { class: "muted", text: "—" })),
          App.ui.el("td", { text: GRADES[c.grade] != null ? GRADES[c.grade].toFixed(1) : "—" }),
          App.ui.el("td", { class: "actions" }, [
            App.ui.el("button", { class: "btn sm ghost", text: "✎", onClick: () => edit(c) }),
            App.ui.el("button", { class: "btn sm ghost", text: "🗑", onClick: () => remove(c.id) }),
          ]),
        ]))),
      ]));
      view.appendChild(App.ui.card([
        App.ui.el("div", { class: "page-head" }, [
          App.ui.el("h3", { text: term }),
          App.ui.el("span", { class: "badge accent", text: "YANO: " + (t.gpa != null ? t.gpa.toFixed(2) : "—") + "  ·  " + t.credits + " AKTS" }),
        ]),
        wrap,
      ]));
    });

    view.appendChild(targetCalc(overall));
    view.appendChild(whatIf(overall));
    view.appendChild(gradeLegend());
  }

  let sim = [];
  function whatIf(overall) {
    const box = App.ui.el("div", {});
    box.appendChild(App.ui.el("h3", { text: "Ya olursa? (senaryo simülatörü)" }));
    box.appendChild(App.ui.el("p", { class: "muted", text: "Almayı planladığın dersleri ve tahmini notları ekle; GANO'nun nasıl değişeceğini gör." }));

    const rows = App.ui.el("div", { class: "list" });
    sim.forEach((s, i) => {
      rows.appendChild(App.ui.el("div", { style: "display:flex;gap:8px;align-items:center" }, [
        App.ui.el("input", { type: "number", value: s.credit, style: "width:90px", placeholder: "AKTS", onInput: (e) => { s.credit = Number(e.target.value); recalc(); } }),
        (function () {
          const sel = App.ui.el("select", { onChange: (e) => { s.grade = e.target.value; recalc(); } });
          GRADE_KEYS.forEach((k) => sel.appendChild(App.ui.el("option", { value: k, text: k + " (" + GRADES[k].toFixed(1) + ")", selected: k === s.grade })));
          return sel;
        })(),
        App.ui.el("button", { class: "btn sm ghost", text: "✕", onClick: () => { sim.splice(i, 1); App.refresh(); } }),
      ]));
    });
    box.appendChild(rows);

    const out = App.ui.el("p", { style: "margin-top:10px;font-size:1.05rem" });
    function recalc() {
      let pts = (overall.gpa || 0) * overall.credits, cr = overall.credits;
      sim.forEach((s) => { if (s.credit > 0 && GRADES[s.grade] != null) { pts += GRADES[s.grade] * s.credit; cr += s.credit; } });
      const projected = cr ? pts / cr : 0;
      const diff = projected - (overall.gpa || 0);
      App.ui.clear(out);
      out.appendChild(document.createTextNode("Tahmini GANO: "));
      out.appendChild(App.ui.el("strong", { text: projected.toFixed(2) }));
      out.appendChild(App.ui.el("span", { class: "badge " + (diff >= 0 ? "green" : "red"), text: (diff >= 0 ? "▲ +" : "▼ ") + diff.toFixed(2) }));
    }
    recalc();

    box.appendChild(App.ui.el("button", { class: "btn sm", style: "margin-top:8px", text: "+ Ders ekle", onClick: () => { sim.push({ credit: 5, grade: "BB" }); App.refresh(); } }));
    box.appendChild(out);
    return App.ui.card(box);
  }

  function targetCalc(overall) {
    const box = App.ui.el("div", {});
    const out = App.ui.el("p", { class: "muted" });
    const doCalc = () => {
      const target = Number(box.querySelector(".t-goal").value);
      const addCr = Number(box.querySelector(".t-cr").value);
      if (!target || !addCr) { out.textContent = ""; return; }
      const curPts = (overall.gpa || 0) * overall.credits;
      const need = (target * (overall.credits + addCr) - curPts) / addCr;
      out.textContent = need > 4
        ? `Bu hedef ${addCr} AKTS ile mümkün değil (gerekli ortalama ${need.toFixed(2)}).`
        : need < 0
        ? "Bu hedefe zaten ulaştın 🎉"
        : `Önümüzdeki ${addCr} AKTS'de ortalama ${need.toFixed(2)} yapman gerekiyor.`;
    };
    box.appendChild(App.ui.el("h3", { text: "Hedef GANO hesaplayıcı" }));
    box.appendChild(App.ui.el("div", { class: "field-inline" }, [
      field("Hedef GANO", App.ui.el("input", { class: "t-goal", type: "number", step: "0.01", placeholder: "3.00", onInput: doCalc })),
      field("Kalan AKTS", App.ui.el("input", { class: "t-cr", type: "number", placeholder: "60", onInput: doCalc })),
    ]));
    box.appendChild(out);
    return App.ui.card(box);
  }

  function field(label, input) {
    return App.ui.el("div", { class: "form-row" }, [App.ui.el("label", { text: label }), input]);
  }

  function gradeLegend() {
    return App.ui.card([
      App.ui.el("h3", { text: "Harf notu katsayıları" }),
      App.ui.el("div", { class: "chip-row" }, GRADE_KEYS.map((k) =>
        App.ui.el("span", { class: "badge " + gradeCls(k), text: k + " = " + GRADES[k].toFixed(1) })
      )),
      App.ui.el("small", { class: "hint", text: "Not: Katsayılar çoğu Türk üniversitesinde bu şekildedir; kendi yönetmeliğini kontrol et." }),
    ]);
  }

  function gradeCls(g) {
    const v = GRADES[g];
    if (v == null) return "";
    if (v >= 3) return "green";
    if (v >= 2) return "amber";
    return "red";
  }

  function bigStat(label, value, cls, sub) {
    return App.ui.el("div", { class: "stat " + (cls || "") }, [
      App.ui.el("div", { class: "stat-label", text: label }),
      App.ui.el("div", { class: "stat-value", text: value }),
      sub ? App.ui.el("div", { class: "stat-sub", text: sub }) : null,
    ]);
  }

  App.registerModule({ id: "gpa", title: "Notlar & GPA", icon: "📊", group: "Akademik", render });
  App.registerCommand({ label: "Not ekle (ders/harf)", icon: "📊", group: "Ekle", run: () => edit(null) });
})();
