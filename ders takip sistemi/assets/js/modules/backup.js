/* Yedekle / Geri Yükle / Sıfırla */
(function () {
  const LABELS = {
    schedule: "Ders programı kaydı",
    tasks: "Ödev / proje",
    grades_courses: "Not kaydı",
    attendance: "Devamsızlık dersi",
    exams: "Sınav kaydı",
    pomodoro_log: "Pomodoro seansı",
    decks: "Flashcard destesi",
    notes: "Ders notu",
    resources: "Kaynak",
    snippets: "Kod parçacığı",
    quiz_banks: "Soru bankası",
    quiz_results: "Quiz sonucu",
    citations: "Kaynakça girişi",
    ai_chats: "AI sohbeti",
  };

  function download() {
    const payload = App.store.exportAll();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "bote-ders-merkezi-yedek-" + App.ui.todayISO() + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    App.ui.toast("Yedek indirildi", "success");
  }

  function pickFile() {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "application/json,.json";
    inp.onchange = () => {
      const f = inp.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        let payload;
        try { payload = JSON.parse(reader.result); }
        catch (e) { App.ui.toast("Dosya okunamadı (geçersiz JSON)", "error"); return; }
        if (!payload || typeof payload.data !== "object" || !payload.data) { App.ui.toast("Geçersiz yedek dosyası", "error"); return; }
        App.ui.modal({
          title: "Geri yükleme",
          body: App.ui.el("div", {}, [
            App.ui.el("p", { text: "Yedek tarihi: " + (payload.exportedAt ? App.ui.fmtDateTime(payload.exportedAt) : "bilinmiyor") }),
            App.ui.el("p", { class: "muted", text: "'Birleştir' mevcut verinin üzerine ekler, 'Değiştir' her şeyi siler ve yedekten kurar." }),
          ]),
          actions: [
            { label: "Vazgeç", kind: "ghost" },
            { label: "Birleştir", kind: "primary", onClick: () => doImport(payload, "merge") },
            { label: "Değiştir", kind: "danger", onClick: () => doImport(payload, "replace") },
          ],
        });
      };
      reader.readAsText(f);
    };
    inp.click();
  }

  async function doImport(payload, mode) {
    if (mode === "replace" && !(await App.ui.confirm("Tüm mevcut veri silinecek. Emin misin?"))) return;
    try {
      App.store.importAll(payload, mode);
      App.ui.toast("Geri yükleme tamam", "success");
      App.refresh();
    } catch (e) {
      App.ui.toast("Hata: " + e.message, "error");
    }
  }

  async function wipe() {
    if (!(await App.ui.confirm("BÜTÜN veriler kalıcı olarak silinecek. Bu geri alınamaz!", "Her şeyi sil"))) return;
    App.store.keys().forEach((k) => { if (k[0] !== "_") App.store.remove(k); });
    App.ui.toast("Tüm veriler silindi", "info");
    App.refresh();
  }

  function usage() {
    let bytes = 0;
    App.store.keys().forEach((k) => { bytes += (localStorage.getItem("bdm:" + k) || "").length; });
    return (bytes / 1024).toFixed(1);
  }

  function render(view) {
    view.appendChild(App.ui.pageHeader("Yedekle & Geri Yükle", "Verilerin bu tarayıcıda saklanır — düzenli yedek al", []));

    view.appendChild(App.ui.card([
      App.ui.el("h3", { text: "Veri özeti" }),
      App.ui.el("div", { class: "table-wrap" }, App.ui.el("table", { class: "data" }, [
        App.ui.el("thead", {}, App.ui.el("tr", {}, [App.ui.el("th", { text: "Tür" }), App.ui.el("th", { text: "Kayıt" })])),
        App.ui.el("tbody", {}, Object.entries(LABELS).map(([k, label]) => {
          const v = App.store.get(k, []);
          const n = Array.isArray(v) ? (k === "decks" ? v.reduce((a, d) => a + (d.cards ? d.cards.length : 0), 0) + " kart / " + v.length + " deste" : v.length) : 0;
          return App.ui.el("tr", {}, [App.ui.el("td", { text: label }), App.ui.el("td", { text: n })]);
        })),
      ])),
      App.ui.el("small", { class: "hint", text: "Toplam kullanım: ~" + usage() + " KB" }),
    ]));

    view.appendChild(App.ui.card([
      App.ui.el("h3", { text: "Yedekleme" }),
      App.ui.el("p", { class: "muted", text: "Tüm modüllerin verisini tek bir JSON dosyasına indir. Başka bilgisayara taşımak veya güvence için kullan." }),
      App.ui.el("div", { style: "display:flex;gap:8px;flex-wrap:wrap" }, [
        App.ui.el("button", { class: "btn primary", text: "⬇ Yedek indir", onClick: download }),
        App.ui.el("button", { class: "btn", text: "⬆ Yedekten geri yükle", onClick: pickFile }),
      ]),
    ]));

    view.appendChild(App.ui.card([
      App.ui.el("h3", { text: "Tehlikeli bölge" }),
      App.ui.el("p", { class: "muted", text: "Tüm modüllerdeki bütün kayıtları siler. Tema ayarı korunur." }),
      App.ui.el("button", { class: "btn danger", text: "Tüm verileri sil", onClick: wipe }),
    ]));
  }

  App.registerModule({ id: "backup", title: "Yedekle & Geri Yükle", icon: "💽", group: "Sistem", render });
  App.registerCommand({ label: "Yedek indir (tüm veri)", icon: "💽", group: "İşlem", run: () => download() });
})();
