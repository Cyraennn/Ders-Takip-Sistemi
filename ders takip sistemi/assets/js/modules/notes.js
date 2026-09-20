/* Ders Notları — Markdown destekli */
(function () {
  const KEY = "notes";

  function load() { return App.store.get(KEY, []); }
  function save(l) { App.store.set(KEY, l); }

  const md = App.ui.markdown;

  let openId = null;

  async function newNote() {
    const l = load();
    const note = { id: App.ui.uid(), title: "Yeni not", body: "", tags: "", updated: new Date().toISOString() };
    l.unshift(note);
    save(l);
    openId = note.id;
    App.refresh();
  }

  async function removeNote(id) {
    if (!(await App.ui.confirm("Not silinsin mi?"))) return;
    save(load().filter((n) => n.id !== id));
    if (openId === id) openId = null;
    App.refresh();
  }

  function renderEditor(view, note) {
    view.appendChild(App.ui.pageHeader("Not düzenle", "Son güncelleme: " + App.ui.fmtDateTime(note.updated), [
      App.ui.el("button", { class: "btn ghost", text: "← Listeye dön", onClick: () => { openId = null; App.refresh(); } }),
    ]));

    const titleI = App.ui.el("input", { type: "text", value: note.title, placeholder: "Başlık" });
    const tagsI = App.ui.el("input", { type: "text", value: note.tags || "", placeholder: "etiketler (virgülle)" });
    const bodyI = App.ui.el("textarea", { value: note.body, placeholder: "# Başlık\n\nMarkdown + $matematik$ yazabilirsin: **kalın**, `kod`, - liste, > alıntı, ```blok```, $E=mc^2$" });
    const preview = App.ui.el("div", { class: "md-out" });
    App.ui.renderRich(preview, note.body);

    let saveT;
    const persist = () => {
      note.title = titleI.value || "Başlıksız";
      note.tags = tagsI.value;
      note.body = bodyI.value;
      note.updated = new Date().toISOString();
      const l = load();
      const idx = l.findIndex((n) => n.id === note.id);
      if (idx > -1) l[idx] = note;
      save(l);
    };
    const onType = () => {
      App.ui.renderRich(preview, bodyI.value);
      clearTimeout(saveT);
      saveT = setTimeout(persist, 500);
    };
    bodyI.addEventListener("input", onType);
    titleI.addEventListener("input", () => { clearTimeout(saveT); saveT = setTimeout(persist, 500); });
    tagsI.addEventListener("input", () => { clearTimeout(saveT); saveT = setTimeout(persist, 500); });

    view.appendChild(App.ui.card([
      App.ui.el("div", { class: "field-inline", style: "margin-bottom:12px" }, [titleI, tagsI]),
      App.ui.el("div", { class: "editor-split" }, [bodyI, preview]),
      App.ui.el("div", { style: "margin-top:12px;display:flex;gap:8px;flex-wrap:wrap" }, [
        App.ui.el("button", { class: "btn primary", text: "Kaydet", onClick: () => { persist(); App.ui.toast("Kaydedildi", "success"); } }),
        App.ui.el("button", { class: "btn ghost", text: note.pinned ? "📌 Sabit (kaldır)" : "📌 Sabitle", onClick: () => { persist(); togglePin(note.id); } }),
        App.ui.el("button", { class: "btn ghost", text: "🃏 Karta dönüştür", onClick: () => { persist(); toCardsManual(note); } }),
        App.ai && App.ai.hasKey() ? App.ui.el("button", { class: "btn ghost", text: "🤖 AI ile üret", onClick: () => { persist(); aiGenerateMenu(note); } }) : null,
        App.ui.el("button", { class: "btn ghost", text: "⬇ .md", onClick: () => { persist(); App.ui.downloadFile((note.title || "not").replace(/[^\wğüşiöçİĞÜŞÖÇ -]/gi, "") + ".md", note.body || "", "text/markdown"); } }),
        App.ui.el("button", { class: "btn ghost", text: "🖨 Yazdır", onClick: () => { persist(); printNote(note); } }),
        App.ui.el("button", { class: "btn danger", text: "Sil", onClick: () => removeNote(note.id) }),
      ]),
    ]));
  }

  /* ---------- Notlardan kart / quiz üretimi ---------- */
  function parsePairs(text) {
    const items = [];
    (text || "").split("\n").forEach((line) => {
      const l = line.replace(/^\s*[-*]\s+/, "").trim();
      if (!l) return;
      let m = l.match(/^(.+?)\s*(?:\||—| - |::|:)\s*(.+)$/);
      if (m && m[1] && m[2]) items.push({ front: m[1].trim(), back: m[2].trim() });
    });
    return items;
  }

  async function deckPick() {
    const decks = (App.flashcards && App.flashcards.decks()) || [];
    const opts = decks.map((d) => ({ value: d.id, label: d.name + " (" + d.cards.length + ")" }));
    opts.push({ value: "__new__", label: "＋ Yeni deste" });
    const r = await App.ui.formModal("Hedef deste", [
      { name: "deck", label: "Deste", type: "select", options: opts, default: opts[0] && opts[0].value },
      { name: "newName", label: "Yeni deste adı (yeni seçtiysen)", default: "" },
    ]);
    if (!r) return null;
    if (r.deck === "__new__") return App.flashcards.ensureDeck(r.newName || "Notlardan");
    return r.deck;
  }

  async function toCardsManual(note) {
    const pre = parsePairs(note.body).map((p) => p.front + " | " + p.back).join("\n");
    const r = await App.ui.formModal("Karta dönüştür", [
      { name: "pairs", label: "Her satır: ön yüz | arka yüz", type: "textarea", rows: 10, default: pre || "", required: true },
    ]);
    if (!r) return;
    const items = parsePairs(r.pairs.replace(/\|/g, " | "));
    if (!items.length) { App.ui.toast("Ayrıştırılabilir satır yok (ön | arka)", "error"); return; }
    const deckId = await deckPick();
    if (!deckId) return;
    const n = App.flashcards.addCards(deckId, items);
    App.ui.toast(n + " kart eklendi", "success");
  }

  async function aiGenerateMenu(note) {
    const r = await App.ui.formModal("AI ile üret — " + (note.title || "not"), [
      { name: "kind", label: "Ne üretilsin?", type: "select", options: [{ value: "cards", label: "Flashcard" }, { value: "quiz", label: "Quiz sorusu" }], default: "cards" },
      { name: "count", label: "Adet", type: "number", default: 10 },
    ]);
    if (!r) return;
    const n = Math.max(1, Math.min(40, Number(r.count) || 10));
    const body = (note.body || "").slice(0, 8000);
    App.ui.toast("AI üretiyor…", "info");
    try {
      if (r.kind === "cards") {
        const arr = await App.ai.complete(
          `Aşağıdaki ders notundan ${n} adet flashcard üret. JSON dizi döndür: [{"front":"soru","back":"cevap"}]. Kısa ve net ol.\n\nNOT:\n${body}`,
          { json: true });
        const items = (Array.isArray(arr) ? arr : []).filter((x) => x && x.front && x.back).map((x) => ({ front: String(x.front), back: String(x.back) }));
        if (!items.length) { App.ui.toast("Model kart üretemedi", "error"); return; }
        await previewAndAdd(items, note);
      } else {
        const arr = await App.ai.complete(
          `Aşağıdaki ders notundan ${n} adet çoktan seçmeli soru üret. JSON dizi döndür: [{"text":"soru","options":["A","B","C","D"],"answer":0,"explain":"kısa açıklama"}]. answer doğru şıkkın indeksidir.\n\nNOT:\n${body}`,
          { json: true });
        const qs = (Array.isArray(arr) ? arr : []).filter((q) => q && q.text && Array.isArray(q.options) && q.options.length >= 2);
        if (!qs.length) { App.ui.toast("Model soru üretemedi", "error"); return; }
        const bankId = App.quiz.ensureBank((note.title || "Not") + " — quiz");
        const added = App.quiz.addQuestions(bankId, qs);
        App.ui.toast(added + " soru 'Deneme Sınavı'na eklendi", "success");
      }
    } catch (e) {
      App.ui.toast((App.ai.errText ? App.ai.errText(e) : "Hata: " + e.message), "error");
    }
  }

  async function previewAndAdd(items, note) {
    const checks = items.map(() => true);
    const list = App.ui.el("div", { class: "list" }, items.map((it, i) =>
      App.ui.el("label", { class: "list-item", style: "cursor:pointer" }, [
        App.ui.el("input", { type: "checkbox", checked: true, onChange: (e) => (checks[i] = e.target.checked) }),
        App.ui.el("div", { class: "li-main" }, [
          App.ui.el("div", { class: "li-title", text: it.front }),
          App.ui.el("div", { class: "li-sub", text: it.back }),
        ]),
      ])
    ));
    const m = App.ui.modal({
      title: items.length + " kart önerisi", wide: true, body: list,
      actions: [
        { label: "Vazgeç", kind: "ghost" },
        {
          label: "Deste seç & ekle", kind: "primary",
          onClick: () => {
            const chosen = items.filter((_, i) => checks[i]);
            if (!chosen.length) { App.ui.toast("Kart seçilmedi", "error"); return false; }
            m.close();
            (async () => {
              const deckId = await deckPick();
              if (!deckId) return;
              const n = App.flashcards.addCards(deckId, chosen);
              App.ui.toast(n + " kart eklendi", "success");
            })();
            return false;
          },
        },
      ],
    });
  }

  function togglePin(id) {
    const l = load();
    const n = l.find((x) => x.id === id);
    if (n) n.pinned = !n.pinned;
    save(l);
    App.refresh();
  }

  function printNote(note) {
    const w = window.open("", "_blank");
    if (!w) { App.ui.toast("Açılır pencere engellendi", "error"); return; }
    w.document.write("<title>" + App.ui.escapeHtml(note.title) + "</title><meta charset='utf-8'>" +
      "<style>body{font:15px/1.6 Georgia,serif;max-width:720px;margin:40px auto;padding:0 20px}code{background:#eee;padding:1px 4px}pre{background:#f4f4f4;padding:12px}</style>" +
      "<h1>" + App.ui.escapeHtml(note.title) + "</h1>" + md(note.body));
    w.document.close();
    setTimeout(() => w.print(), 300);
  }

  function render(view) {
    const notes = load();
    if (openId) {
      const n = notes.find((x) => x.id === openId);
      if (n) return renderEditor(view, n);
      openId = null;
    }

    view.appendChild(App.ui.pageHeader("Ders Notları", notes.length + " not", [
      App.ui.el("button", { class: "btn primary", text: "+ Yeni not", onClick: newNote }),
    ]));

    if (!notes.length) {
      view.appendChild(App.ui.emptyState("Not yok.", "+ Yeni not", newNote));
      return;
    }

    const search = App.ui.el("input", { type: "text", placeholder: "Notlarda ara…", style: "margin-bottom:14px" });
    const listWrap = App.ui.el("div", { class: "grid cols-2" });
    const draw = () => {
      App.ui.clear(listWrap);
      const q = search.value.toLowerCase();
      notes
        .filter((n) => !q || (n.title + n.body + n.tags).toLowerCase().includes(q))
        .sort((a, b) => (!!b.pinned - !!a.pinned) || (a.updated < b.updated ? 1 : -1))
        .forEach((n) => {
          listWrap.appendChild(App.ui.el("div", { class: "card", style: "cursor:pointer;margin:0", onClick: () => { openId = n.id; App.refresh(); } }, [
            App.ui.el("h3", { text: (n.pinned ? "📌 " : "") + n.title }),
            App.ui.el("p", { class: "muted", text: (n.body || "").replace(/[#*`>-]/g, "").slice(0, 120) || "boş" }),
            App.ui.el("div", { class: "chip-row" }, (n.tags || "").split(",").map((t) => t.trim()).filter(Boolean).map((t) => App.ui.el("span", { class: "badge accent", text: t }))),
            App.ui.el("small", { class: "muted", text: App.ui.fmtDateTime(n.updated) }),
          ]));
        });
    };
    search.addEventListener("input", draw);
    view.appendChild(search);
    view.appendChild(listWrap);
    draw();
  }

  App.registerModule({ id: "notes", title: "Ders Notları", icon: "📓", group: "Çalışma", render });
  App.registerCommand({ label: "Yeni not", icon: "📓", group: "Ekle", run: () => newNote() });
  App.registerSearch((q) =>
    load().filter((n) => (n.title + " " + n.body + " " + (n.tags || "")).toLowerCase().includes(q))
      .slice(0, 6)
      .map((n) => ({ label: n.title || "Başlıksız not", group: "Not", icon: "📓", run: () => { openId = n.id; App.go("notes"); App.refresh(); } }))
  );
})();
