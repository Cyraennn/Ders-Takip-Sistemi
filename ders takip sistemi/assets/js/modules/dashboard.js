/* Panel — genel bakış */
(function () {
  const DAYS = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];

  function todayIdx() {
    const d = new Date().getDay(); // 0=Pazar
    return d === 0 ? 6 : d - 1;
  }

  function gpa() {
    const list = App.store.get("grades_courses", []) || [];
    const G = { AA: 4, BA: 3.5, BB: 3, CB: 2.5, CC: 2, DC: 1.5, DD: 1, FD: 0.5, FF: 0, DZ: 0 };
    let p = 0, c = 0;
    list.forEach((x) => { const g = G[x.grade]; if (g != null) { p += g * Number(x.credit || 0); c += Number(x.credit || 0); } });
    return c ? (p / c).toFixed(2) : "—";
  }

  function pomoToday() {
    return (App.store.get("pomodoro_log", []) || [])
      .filter((e) => e.date === App.ui.todayISO())
      .reduce((a, e) => a + e.minutes, 0);
  }

  function render(view) {
    const now = new Date();
    const hour = now.getHours();
    const greet = hour < 6 ? "İyi geceler" : hour < 12 ? "Günaydın" : hour < 18 ? "İyi günler" : "İyi akşamlar";

    view.appendChild(App.ui.el("div", { class: "page-head" }, [
      App.ui.el("div", {}, [
        App.ui.el("h2", { text: greet + " 👋" }),
        App.ui.el("p", { class: "muted", text: now.toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) }),
      ]),
    ]));

    // ilk kullanım
    if (!App.store.keys().some((k) => k[0] !== "_")) {
      view.appendChild(onboarding());
      return;
    }

    // istatistik satırı
    const tasks = App.store.get("tasks", []) || [];
    const openTasks = tasks.filter((t) => t.status !== "Tamamlandı");
    const lateTasks = openTasks.filter((t) => t.due && App.ui.daysBetween(App.ui.todayISO(), t.due) < 0);
    const exams = (App.store.get("exams", []) || []).filter((e) => !e.done && App.ui.daysBetween(App.ui.todayISO(), e.date) >= 0)
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    const nextExam = exams[0];

    view.appendChild(App.ui.el("div", { class: "grid cols-4" }, [
      linkStat("GANO", gpa(), "accent", "gpa"),
      linkStat("Açık ödev", openTasks.length + (lateTasks.length ? " · " + lateTasks.length + " geç" : ""), lateTasks.length ? "red" : "green", "tasks"),
      linkStat("Sıradaki sınav", nextExam ? App.ui.daysBetween(App.ui.todayISO(), nextExam.date) + " gün" : "—", "amber", "exams"),
      linkStat("Bugün çalışma", pomoToday() + " dk", "", "pomodoro"),
    ]));

    const due = App.flashcards ? App.flashcards.dueCount() : 0;
    if (due) {
      view.appendChild(App.ui.card([
        App.ui.el("div", { class: "page-head", style: "align-items:center" }, [
          App.ui.el("div", {}, [
            App.ui.el("h3", { text: "🔁 Bugünün tekrarları", style: "margin:0" }),
            App.ui.el("p", { class: "muted", style: "margin:2px 0 0", text: due + " kart tekrar bekliyor" }),
          ]),
          App.ui.el("button", { class: "btn primary", text: "Hepsini çalış", onClick: () => App.flashcards.startMixedDue() }),
        ]),
      ]));
    }

    view.appendChild(App.ui.el("div", { class: "grid cols-2" }, [
      todayClasses(),
      upcomingTasks(openTasks),
    ]));

    view.appendChild(App.ui.el("div", { class: "grid cols-2" }, [
      examList(exams),
      attendanceWarn(),
    ]));

    view.appendChild(App.ui.el("p", { class: "muted", style: "text-align:center;margin-top:8px", text: "İpucu: her yerden Ctrl + K ile komut paletini aç · G ardından H ile panele dön · ? ile kısayollar" }));
  }

  function onboarding() {
    const go = (id) => () => App.go(id);
    return App.ui.card([
      App.ui.el("h3", { text: "Hoş geldin! 🎓" }),
      App.ui.el("p", { class: "muted", text: "BÖTE Ders Merkezi tüm ders çalışma araçlarını tek yerde toplar. Verilerin yalnızca bu tarayıcıda saklanır. Başlamak için birkaç öneri:" }),
      App.ui.el("div", { class: "grid cols-2", style: "margin-top:12px" }, [
        quickCard("📅", "Ders programını gir", "Haftalık çizelgeni oluştur", go("schedule")),
        quickCard("📊", "Notlarını ekle", "GANO / YANO otomatik hesaplansın", go("gpa")),
        quickCard("✅", "Ödevlerini yaz", "Teslim tarihi ve öncelikle takip et", go("tasks")),
        quickCard("📝", "Sınav tarihlerini ekle", "Geri sayım ve konu listesi", go("exams")),
        quickCard("⏱️", "Pomodoro ile çalış", "Seanslar günlüğe kaydedilir", go("pomodoro")),
        quickCard("🃏", "Flashcard destesi kur", "Aralıklı tekrarla ezberle", go("flashcards")),
      ]),
      App.ui.el("p", { class: "muted", style: "margin-top:12px", text: "İstersen deneme verisiyle keşfet:" }),
      App.ui.el("button", { class: "btn", text: "🧪 Örnek veri yükle", onClick: loadSample }),
    ]);
  }

  function quickCard(icon, title, sub, onClick) {
    return App.ui.el("div", { class: "card", style: "cursor:pointer;margin:0", onClick }, [
      App.ui.el("div", { style: "font-size:24px", text: icon }),
      App.ui.el("strong", { text: title }),
      App.ui.el("p", { class: "muted", style: "margin:2px 0 0", text: sub }),
    ]);
  }

  function loadSample() {
    const t = App.ui.todayISO();
    const plus = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return App.ui.isoOf(d); };
    App.store.set("schedule", [
      { id: App.ui.uid(), name: "Programlama I", day: 0, start: "09:25", end: "11:05", room: "B-201", instructor: "Dr. A. Yılmaz" },
      { id: App.ui.uid(), name: "Öğretim Teknolojileri", day: 2, start: "13:00", end: "14:40", room: "A-105" },
    ]);
    App.store.set("tasks", [
      { id: App.ui.uid(), title: "Ders planı ödevi", course: "Öğretim Tasarımı", due: plus(3), priority: "Yüksek", status: "Yapılacak", subtasks: [] },
      { id: App.ui.uid(), title: "Algoritma lab raporu", course: "Programlama I", due: plus(-1), priority: "Orta", status: "Devam ediyor", subtasks: [] },
    ]);
    App.store.set("grades_courses", [
      { id: App.ui.uid(), term: "1. Yarıyıl", name: "Programlama I", credit: 6, grade: "BA" },
      { id: App.ui.uid(), term: "1. Yarıyıl", name: "Eğitim Bilimine Giriş", credit: 4, grade: "AA" },
    ]);
    App.store.set("exams", [{ id: App.ui.uid(), course: "Programlama I", type: "Vize", date: plus(6), time: "10:00", location: "B-201", topics: "Döngüler\nDiziler\nFonksiyonlar", topicDone: {} }]);
    App.store.set("attendance", [{ id: App.ui.uid(), course: "Programlama I", weeklyHours: 3, weeks: 14, limitPct: 30, absences: 3 }]);
    App.ui.toast("Örnek veri yüklendi", "success");
    App.refresh();
  }

  App.registerCommand({ label: "Örnek veri yükle", icon: "🧪", group: "İşlem", run: loadSample });

  function todayClasses() {
    const idx = todayIdx();
    const list = (App.store.get("schedule", []) || []).filter((e) => e.day === idx).sort((a, b) => App.ui.hmMin(a.start) - App.ui.hmMin(b.start));
    return App.ui.card([
      App.ui.el("h3", { text: "Bugünün dersleri — " + DAYS[idx] }),
      list.length
        ? App.ui.el("div", { class: "list" }, list.map((e) => App.ui.el("div", { class: "list-item" }, [
            App.ui.el("div", { class: "li-main" }, [
              App.ui.el("div", { class: "li-title", text: (e.code ? e.code + " — " : "") + e.name }),
              App.ui.el("div", { class: "li-sub", text: App.ui.hm(e.start) + " – " + App.ui.hm(e.end) + (e.room ? " · " + e.room : "") }),
            ]),
          ])))
        : App.ui.el("p", { class: "muted", text: idx > 4 ? "Hafta sonu — ders yok 🎉" : "Bugün ders yok." }),
    ]);
  }

  function upcomingTasks(openTasks) {
    const list = openTasks.slice().sort((a, b) => (a.due || "9999") < (b.due || "9999") ? -1 : 1).slice(0, 6);
    return App.ui.card([
      App.ui.el("h3", { text: "Yaklaşan ödevler" }),
      list.length
        ? App.ui.el("div", { class: "list" }, list.map((t) => {
            const d = t.due ? App.ui.daysBetween(App.ui.todayISO(), t.due) : null;
            const cls = d == null ? "" : d < 0 ? "red" : d <= 3 ? "amber" : "green";
            return App.ui.el("div", { class: "list-item" }, [
              App.ui.el("div", { class: "li-main" }, [
                App.ui.el("div", { class: "li-title", text: t.title }),
                App.ui.el("div", { class: "li-sub", text: (t.course ? t.course + " · " : "") + (t.due ? App.ui.fmtDate(t.due) : "tarihsiz") }),
              ]),
              d != null ? App.ui.el("span", { class: "badge " + cls, text: d < 0 ? Math.abs(d) + "g geç" : d + "g" }) : null,
            ]);
          }))
        : App.ui.el("p", { class: "muted", text: "Bekleyen ödev yok 🎯" }),
    ]);
  }

  function examList(exams) {
    return App.ui.card([
      App.ui.el("h3", { text: "Yaklaşan sınavlar" }),
      exams.length
        ? App.ui.el("div", { class: "list" }, exams.slice(0, 6).map((e) => App.ui.el("div", { class: "list-item" }, [
            App.ui.el("div", { class: "li-main" }, [
              App.ui.el("div", { class: "li-title", text: e.type + " — " + e.course }),
              App.ui.el("div", { class: "li-sub", text: App.ui.fmtDate(e.date) + (e.time ? " " + e.time : "") + (e.location ? " · " + e.location : "") }),
            ]),
            App.ui.el("span", { class: "badge accent", text: App.ui.daysBetween(App.ui.todayISO(), e.date) + " gün" }),
          ])))
        : App.ui.el("p", { class: "muted", text: "Planlı sınav yok." }),
    ]);
  }

  function attendanceWarn() {
    const list = App.store.get("attendance", []) || [];
    const rows = list.map((c) => {
      const total = Number(c.weeklyHours || 0) * Number(c.weeks || 14);
      const allowed = Math.floor((total * Number(c.limitPct || 30)) / 100);
      const rem = allowed - Number(c.absences || 0);
      return { name: c.course, rem };
    }).sort((a, b) => a.rem - b.rem);
    return App.ui.card([
      App.ui.el("h3", { text: "Devamsızlık durumu" }),
      rows.length
        ? App.ui.el("div", { class: "list" }, rows.slice(0, 6).map((r) => App.ui.el("div", { class: "list-item" }, [
            App.ui.el("div", { class: "li-main" }, App.ui.el("div", { class: "li-title", text: r.name })),
            App.ui.el("span", { class: "badge " + (r.rem <= 0 ? "red" : r.rem <= 2 ? "amber" : "green"), text: r.rem > 0 ? r.rem + " saat hak" : "hak doldu" }),
          ])))
        : App.ui.el("p", { class: "muted", text: "Devamsızlık modülüne ders ekleyerek takip başlat." }),
    ]);
  }

  function linkStat(label, value, cls, route) {
    return App.ui.el("div", { class: "stat " + (cls || ""), style: "cursor:pointer", onClick: () => App.go(route) }, [
      App.ui.el("div", { class: "stat-label", text: label }),
      App.ui.el("div", { class: "stat-value", text: value }),
    ]);
  }

  App.registerModule({ id: "dashboard", title: "Panel", icon: "🏠", group: "", render });
})();
