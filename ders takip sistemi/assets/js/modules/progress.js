/* İlerleme Panosu — çalışma ve akademik istatistikler */
(function () {
  const GRADES = { AA: 4, BA: 3.5, BB: 3, CB: 2.5, CC: 2, DC: 1.5, DD: 1, FD: 0.5, FF: 0, DZ: 0 };

  function weeklyStudy() {
    const log = App.store.get("pomodoro_log", []) || [];
    const weeks = [];
    for (let w = 7; w >= 0; w--) {
      const end = new Date();
      end.setDate(end.getDate() - w * 7);
      const start = new Date(end);
      start.setDate(end.getDate() - 6);
      const si = App.ui.isoOf(start), ei = App.ui.isoOf(end);
      const mins = log.filter((e) => e.date >= si && e.date <= ei).reduce((a, e) => a + e.minutes, 0);
      weeks.push({ label: si + " – " + ei, short: App.ui.pad(start.getDate()) + "/" + App.ui.pad(start.getMonth() + 1), value: Math.round(mins / 60 * 10) / 10 });
    }
    return weeks;
  }

  function gpaTrend() {
    const list = App.store.get("grades_courses", []) || [];
    const terms = [...new Set(list.map((c) => c.term))].sort((a, b) => (parseInt(a) || 99) - (parseInt(b) || 99));
    return terms.map((t) => {
      const cs = list.filter((c) => c.term === t && GRADES[c.grade] != null);
      let p = 0, cr = 0;
      cs.forEach((c) => { p += GRADES[c.grade] * Number(c.credit || 0); cr += Number(c.credit || 0); });
      return { label: t, short: (String(t).match(/\d+/) || [t])[0], value: cr ? Math.round((p / cr) * 100) / 100 : 0 };
    }).filter((x) => x.value > 0);
  }

  function studyByCourse() {
    const log = App.store.get("pomodoro_log", []) || [];
    const map = {};
    log.forEach((e) => { const k = e.tag || "Genel"; map[k] = (map[k] || 0) + e.minutes; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([k, v]) => ({ label: k, short: k.slice(0, 6), value: Math.round(v / 60 * 10) / 10 }));
  }

  function render(view) {
    view.appendChild(App.ui.pageHeader("İlerleme Panosu", "Çalışma alışkanlıkların ve akademik gidişatın", []));

    const log = App.store.get("pomodoro_log", []) || [];
    const totalH = log.reduce((a, e) => a + e.minutes, 0) / 60;
    const tasks = App.store.get("tasks", []) || [];
    const doneT = tasks.filter((t) => t.status === "Tamamlandı").length;
    const decks = App.store.get("decks", []) || [];
    const allCards = decks.reduce((a, d) => a + (d.cards ? d.cards.length : 0), 0);
    const mat = (c) => ((c.reps || 0) === 0 ? "new" : (c.interval || 0) < 21 ? "learning" : "mature");
    const masteredCards = decks.reduce((a, d) => a + (d.cards ? d.cards.filter((c) => mat(c) === "mature").length : 0), 0);

    view.appendChild(App.ui.el("div", { class: "grid cols-4" }, [
      App.ui.stat("Toplam çalışma", totalH.toFixed(1) + " sa", "accent"),
      App.ui.stat("Ödev tamamlama", tasks.length ? Math.round((doneT / tasks.length) * 100) + "%" : "—", "green", doneT + " / " + tasks.length),
      App.ui.stat("Kart hakimiyeti", allCards ? Math.round((masteredCards / allCards) * 100) + "%" : "—", "amber", masteredCards + " / " + allCards),
      App.ui.stat("Kayıtlı ders", App.data.courseNames().length, ""),
    ]));

    const ws = weeklyStudy();
    view.appendChild(App.ui.card([
      App.ui.el("h3", { text: "Haftalık çalışma (saat) — son 8 hafta" }),
      ws.some((w) => w.value) ? App.ui.barChart(ws) : App.ui.el("p", { class: "muted", text: "Pomodoro modülünde seans tamamladıkça burada görünür." }),
    ]));

    const gt = gpaTrend();
    view.appendChild(App.ui.card([
      App.ui.el("h3", { text: "GANO trendi (yarıyıl bazında)" }),
      gt.length >= 2 ? App.ui.lineChart(gt, { min: 0, max: 4 }) :
        gt.length === 1 ? App.ui.el("p", { class: "muted", text: gt[0].label + " YANO: " + gt[0].value.toFixed(2) + " (trend için en az 2 yarıyıl gerekir)" }) :
        App.ui.el("p", { class: "muted", text: "Notlar & GPA modülüne ders ekleyince trend oluşur." }),
    ]));

    const sc = studyByCourse();
    if (sc.length) {
      view.appendChild(App.ui.card([
        App.ui.el("h3", { text: "Konuya göre çalışma (saat)" }),
        App.ui.barChart(sc),
      ]));
    }

    if (allCards) {
      const c = { new: 0, learning: 0, mature: 0 };
      decks.forEach((d) => (d.cards || []).forEach((x) => c[mat(x)]++));
      view.appendChild(App.ui.card([
        App.ui.el("h3", { text: "Flashcard olgunluk dağılımı" }),
        App.ui.barChart([
          { label: "Yeni", short: "Yeni", value: c.new },
          { label: "Öğreniliyor", short: "Öğr.", value: c.learning },
          { label: "Olgun (≥21g)", short: "Olgun", value: c.mature },
        ]),
        App.ui.el("small", { class: "hint", text: "Olgun = tekrar aralığı 21 günü geçmiş kartlar (iyi öğrenilmiş)." }),
      ]));
    }
  }

  App.registerModule({ id: "progress", title: "İlerleme Panosu", icon: "📈", group: "Akademik", render });
})();
