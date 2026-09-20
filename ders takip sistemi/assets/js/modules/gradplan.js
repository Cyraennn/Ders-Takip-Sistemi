/* Mezuniyet & AKTS Takibi */
(function () {
  const KEY = "gradplan";
  const FAIL = ["FF", "FD", "DZ", ""];

  function cfg() { return Object.assign({ goalEcts: 240, goalGpa: 3.0, startYear: new Date().getFullYear() - 1 }, App.store.get(KEY, {})); }
  function setCfg(c) { App.store.set(KEY, c); }

  function courseData() {
    const list = App.store.get("grades_courses", []) || [];
    let passed = 0, attempted = 0, pts = 0, gpaCr = 0;
    list.forEach((c) => {
      const cr = Number(c.credit || 0);
      attempted += cr;
      if (!FAIL.includes(c.grade)) passed += cr;
      const G = { AA: 4, BA: 3.5, BB: 3, CB: 2.5, CC: 2, DC: 1.5, DD: 1, FD: 0.5, FF: 0, DZ: 0 }[c.grade];
      if (G != null) { pts += G * cr; gpaCr += cr; }
    });
    return { passed, attempted, gpa: gpaCr ? pts / gpaCr : null, terms: [...new Set(list.map((c) => c.term))].length };
  }

  async function editCfg() {
    const c = cfg();
    const data = await App.ui.formModal("Mezuniyet hedefleri", [
      { name: "goalEcts", label: "Mezuniyet için gereken AKTS", type: "number", default: c.goalEcts },
      { name: "goalGpa", label: "Hedef GANO", type: "number", step: "0.01", default: c.goalGpa },
      { name: "startYear", label: "Kayıt yılı", type: "number", default: c.startYear },
    ]);
    if (!data) return;
    setCfg({ goalEcts: Number(data.goalEcts), goalGpa: Number(data.goalGpa), startYear: Number(data.startYear) });
    App.refresh();
  }

  function render(view) {
    const c = cfg();
    const d = courseData();
    const pct = Math.min(100, (d.passed / c.goalEcts) * 100);
    const remain = Math.max(0, c.goalEcts - d.passed);

    view.appendChild(App.ui.pageHeader("Mezuniyet & AKTS Takibi", "İlerlemeni hedeflerine göre izle", [
      App.ui.el("button", { class: "btn ghost", text: "⚙ Hedefler", onClick: editCfg }),
    ]));

    view.appendChild(App.ui.card([
      App.ui.el("div", { class: "page-head" }, [
        App.ui.el("h3", { text: "AKTS ilerlemesi" }),
        App.ui.el("span", { class: "badge accent", text: d.passed + " / " + c.goalEcts + " AKTS" }),
      ]),
      App.ui.el("div", { class: "progress green" }, App.ui.el("span", { style: "width:" + pct + "%" })),
      App.ui.el("p", { class: "muted", style: "margin-top:8px", text: `%${pct.toFixed(1)} tamamlandı · ${remain} AKTS kaldı` }),
    ]));

    view.appendChild(App.ui.el("div", { class: "grid cols-3" }, [
      stat("Tamamlanan AKTS", d.passed, "green"),
      stat("Alınan (denenen) AKTS", d.attempted, ""),
      stat("Tamamlanan yarıyıl", d.terms, "accent"),
    ]));

    const gpaOk = d.gpa != null && d.gpa >= c.goalGpa;
    view.appendChild(App.ui.card([
      App.ui.el("h3", { text: "GANO hedefi" }),
      App.ui.el("p", {}, [
        "Güncel GANO: ",
        App.ui.el("strong", { text: d.gpa != null ? d.gpa.toFixed(2) : "—" }),
        "  ·  hedef: ",
        App.ui.el("strong", { text: c.goalGpa.toFixed(2) }),
        "  ",
        App.ui.el("span", { class: "badge " + (gpaOk ? "green" : "amber"), text: gpaOk ? "hedefin üstünde" : "hedefin altında" }),
      ]),
      d.gpa != null && !gpaOk
        ? App.ui.el("small", { class: "hint", text: "Notlar & GPA modülündeki 'Hedef GANO hesaplayıcı' ile kaç AKTS'de toparlayabileceğini görebilirsin." })
        : null,
    ]));

    // kaba yarıyıl tahmini
    const perTerm = 30;
    const termsLeft = Math.ceil(remain / perTerm);
    view.appendChild(App.ui.card([
      App.ui.el("h3", { text: "Kaba tahmin" }),
      App.ui.el("p", { class: "muted", text:
        remain === 0
          ? "Gerekli AKTS'yi tamamladın 🎓"
          : `Yarıyıl başına ~${perTerm} AKTS ile tahmini ${termsLeft} yarıyıl (${(termsLeft / 2).toFixed(1)} yıl) kaldı.` }),
      App.ui.el("small", { class: "hint", text: "Bu tahmin yalnızca Notlar & GPA modülüne girdiğin derslere dayanır." }),
    ]));
  }

  function stat(label, value, cls) {
    return App.ui.el("div", { class: "stat " + cls }, [
      App.ui.el("div", { class: "stat-label", text: label }),
      App.ui.el("div", { class: "stat-value", text: value }),
    ]);
  }

  App.registerModule({ id: "gradplan", title: "Mezuniyet Takibi", icon: "🎯", group: "Akademik", render });
})();
