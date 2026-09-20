/* Flashcard — SM-2 aralıklı tekrar + cloze + matematik */
(function () {
  const KEY = "decks";

  function migrate(c) {
    const box = c.box || 1;
    c.ease = 2.5;
    c.interval = ({ 1: 0, 2: 1, 3: 3, 4: 7, 5: 15 })[box] || 0;
    c.reps = Math.max(0, box - 1);
    c.lapses = c.lapses || 0;
    if (!c.due) c.due = App.ui.todayISO();
  }
  function load() {
    const l = App.store.get(KEY, []);
    let dirty = false;
    l.forEach((d) => (d.cards || []).forEach((c) => { if (c.ease == null) { migrate(c); dirty = true; } }));
    if (dirty) App.store.set(KEY, l);
    return l;
  }
  function save(l) { App.store.set(KEY, l); }

  function addDays(n) {
    const d = new Date();
    d.setDate(d.getDate() + Math.max(0, Math.round(n)));
    return App.ui.isoOf(d);
  }
  function dueCards(deck) {
    const t = App.ui.todayISO();
    return (deck.cards || []).filter((c) => !c.due || c.due <= t);
  }
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function newCard(front, back, extra) {
    return Object.assign({
      id: App.ui.uid(), front: front || "", back: back || "",
      ease: 2.5, interval: 0, reps: 0, lapses: 0,
      due: App.ui.todayISO(), created: App.ui.todayISO(),
    }, extra || {});
  }

  /* ---------- SM-2 ---------- */
  function schedule(card, q) {
    card.ease = card.ease || 2.5;
    card.reps = card.reps || 0;
    card.interval = card.interval || 0;
    if (q < 3) {
      card.reps = 0;
      card.interval = 1;
      card.lapses = (card.lapses || 0) + 1;
    } else {
      card.reps += 1;
      if (card.reps === 1) card.interval = 1;
      else if (card.reps === 2) card.interval = 6;
      else card.interval = Math.max(1, Math.round(card.interval * card.ease));
      if (q === 5) card.interval = Math.round(card.interval * 1.3);
    }
    card.ease = Math.max(1.3, card.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
    card.due = addDays(card.interval);
    card.lastReviewed = App.ui.todayISO();
  }
  function predict(card, q) {
    const c = Object.assign({}, card);
    schedule(c, q);
    return c.interval;
  }
  function maturity(c) {
    if ((c.reps || 0) === 0) return "new";
    return (c.interval || 0) < 21 ? "learning" : "mature";
  }

  /* ---------- Cloze ---------- */
  const CLOZE_RE = /\{\{c(\d+)::(.+?)\}\}/g;
  function clozeFace(text, n, showAnswer) {
    return String(text || "").replace(CLOZE_RE, (m, i, v) =>
      Number(i) === n ? (showAnswer ? "**" + v + "**" : "[ … ]") : v);
  }
  function cardFace(card, showAnswer) {
    if (card.type === "cloze") return clozeFace(card.text, card.clozeN, showAnswer);
    return showAnswer ? card.back : card.front;
  }
  function cardTitle(card) {
    if (card.type === "cloze") return card.text.replace(CLOZE_RE, "[$2]");
    return card.front;
  }

  /* ---------- Deste / kart yönetimi ---------- */
  async function newDeck() {
    const name = await App.ui.prompt({ title: "Yeni deste", label: "Deste adı", placeholder: "örn. İngilizce kelimeler" });
    if (!name) return;
    const l = load();
    l.push({ id: App.ui.uid(), name, created: App.ui.todayISO(), cards: [] });
    save(l);
    App.refresh();
  }
  async function renameDeck(deck) {
    const name = await App.ui.prompt({ title: "Deste adı", value: deck.name });
    if (!name) return;
    const l = load();
    const d = l.find((x) => x.id === deck.id);
    if (d) d.name = name;
    save(l);
    App.refresh();
  }
  async function removeDeck(id) {
    if (!(await App.ui.confirm("Deste ve tüm kartları silinsin mi?"))) return;
    save(load().filter((d) => d.id !== id));
    App.refresh();
  }

  async function editCard(deck, card) {
    const data = await App.ui.formModal(card ? "Kartı düzenle" : "Kart ekle", [
      { name: "front", label: "Ön yüz (soru) — Markdown ve $matematik$ olur", type: "textarea", required: true },
      { name: "back", label: "Arka yüz (cevap)", type: "textarea", required: true },
    ], card || {});
    if (!data) return;
    const l = load();
    const d = l.find((x) => x.id === deck.id);
    if (!d) return;
    if (card) {
      const c = d.cards.find((x) => x.id === card.id);
      if (c) { c.front = data.front; c.back = data.back; }
    } else {
      d.cards.push(newCard(data.front, data.back));
    }
    save(l);
    App.refresh();
  }

  async function editCloze(deck, group) {
    const existing = group ? group[0].text : "";
    const data = await App.ui.formModal(group ? "Cloze düzenle" : "Cloze kart", [
      { name: "text", label: "Metin — gizlenecek yerleri {{c1::...}} ile işaretle", type: "textarea", rows: 5, required: true,
        hint: "örn: Osmanlı {{c1::1299}} yılında kuruldu, ilk başkenti {{c2::Söğüt}} idi." },
    ], { text: existing });
    if (!data) return;
    const ns = [...new Set([...data.text.matchAll(CLOZE_RE)].map((s) => Number(s[1])))].sort((a, b) => a - b);
    if (!ns.length) { App.ui.toast("En az bir {{c1::...}} gerekli", "error"); return; }
    const l = load();
    const d = l.find((x) => x.id === deck.id);
    if (!d) return;
    const gid = group ? group[0].clozeGroup : App.ui.uid();
    if (group) d.cards = d.cards.filter((c) => c.clozeGroup !== gid);
    ns.forEach((n) => d.cards.push(newCard(null, null, { type: "cloze", clozeGroup: gid, clozeN: n, text: data.text })));
    save(l);
    App.refresh();
  }

  async function removeCard(deck, card) {
    if (!(await App.ui.confirm("Silinsin mi?"))) return;
    const l = load();
    const d = l.find((x) => x.id === deck.id);
    if (d) {
      d.cards = card.clozeGroup
        ? d.cards.filter((c) => c.clozeGroup !== card.clozeGroup)
        : d.cards.filter((c) => c.id !== card.id);
    }
    save(l);
    App.refresh();
  }

  async function bulkAdd(deck) {
    const txt = await App.ui.prompt({
      title: "Toplu kart ekle",
      label: "Her satır bir kart:  ön yüz | arka yüz   (veya tab ile ayır)",
      multiline: true, rows: 10,
      placeholder: "apple | elma\nbook | kitap\ncomputer\tbilgisayar",
    });
    if (!txt) return;
    const items = [];
    txt.split("\n").forEach((line) => {
      const parts = line.includes("|") ? line.split("|") : line.split("\t");
      if (parts.length < 2) return;
      const front = parts[0].trim(), back = parts.slice(1).join("|").trim();
      if (front && back) items.push({ front, back });
    });
    const n = api.addCards(deck.id, items);
    App.ui.toast(n + " kart eklendi", "success");
    App.refresh();
  }

  function exportCsv(deck) {
    const esc = (s) => '"' + String(s || "").replace(/\*\*/g, "").replace(/"/g, '""') + '"';
    const rows = deck.cards.map((c) => esc(cardFace(c, false)) + "," + esc(cardFace(c, true)));
    App.ui.downloadFile((deck.name || "deste").replace(/[^\wğüşiöçİĞÜŞÖÇ -]/gi, "") + ".csv", "﻿" + rows.join("\r\n"), "text/csv");
  }
  function importCsv(deck) {
    App.ui.pickFile(".csv,text/csv", (text) => {
      const items = [];
      text.split(/\r?\n/).forEach((line) => {
        if (!line.trim()) return;
        const m = line.match(/^\s*"?(.*?)"?\s*[,;]\s*"?(.*?)"?\s*$/);
        if (m && m[1] && m[2]) items.push({ front: m[1].replace(/""/g, '"'), back: m[2].replace(/""/g, '"') });
      });
      const n = api.addCards(deck.id, items);
      App.ui.toast(n + " kart içe aktarıldı", "success");
      App.refresh();
    });
  }

  /* ---------- Çalışma oturumu ---------- */
  let studyState = null; // { title, queue:[{deckId,cardId}], idx, flipped, tally }

  function getCard(ref) {
    const l = load();
    const d = l.find((x) => x.id === ref.deckId);
    const c = d && (d.cards || []).find((x) => x.id === ref.cardId);
    return { list: l, deck: d, card: c };
  }

  function startStudy(deck, onlyDue) {
    const pool = onlyDue ? dueCards(deck) : (deck.cards || []).slice();
    if (!pool.length) { App.ui.toast("Çalışılacak kart yok", "info"); return; }
    shuffle(pool);
    studyState = { title: deck.name, queue: pool.map((c) => ({ deckId: deck.id, cardId: c.id })), idx: 0, flipped: false, tally: {} };
    App.refresh();
  }

  function startMixedDue() {
    const l = load();
    const refs = [];
    l.forEach((d) => dueCards(d).forEach((c) => refs.push({ deckId: d.id, cardId: c.id })));
    if (!refs.length) { App.ui.toast("Bugün için tekrar yok 🎉", "info"); return; }
    shuffle(refs);
    studyState = { title: "Tüm desteler — bugün", queue: refs, idx: 0, flipped: false, tally: {} };
    if (location.hash.replace(/^#\/?/, "") !== "flashcards") App.go("flashcards");
    else App.refresh();
  }

  function grade(q) {
    const ref = studyState.queue[studyState.idx];
    const { list, card } = getCard(ref);
    if (card) {
      schedule(card, q);
      save(list);
      studyState.tally[q] = (studyState.tally[q] || 0) + 1;
    }
    if (q < 3) studyState.queue.push(ref);
    studyState.idx++;
    studyState.flipped = false;
    if (studyState.idx >= studyState.queue.length) {
      const t = studyState.tally;
      App.ui.toast(`Bitti! İyi/Kolay ${(t[4] || 0) + (t[5] || 0)} · Zor ${t[3] || 0} · Tekrar ${t[2] || 0}`, "success");
      studyState = null;
    }
    App.refresh();
  }

  function renderStudy(view) {
    const ref = studyState.queue[studyState.idx];
    const { card, deck } = getCard(ref);
    if (!card) { studyState = null; return render(view); }

    view.appendChild(App.ui.pageHeader(studyState.title,
      `Kart ${studyState.idx + 1} / ${studyState.queue.length}` + (deck && deck.name !== studyState.title ? " · " + deck.name : ""), [
      App.ui.el("button", { class: "btn ghost", text: "Bitir", onClick: () => { studyState = null; App.refresh(); } }),
    ]));

    view.appendChild(App.ui.el("div", { class: "progress", style: "margin-bottom:18px" },
      App.ui.el("span", { style: "width:" + (studyState.idx / studyState.queue.length) * 100 + "%" })));

    const front = App.ui.el("div", { class: "fc-face front" });
    App.ui.renderRich(front, cardFace(card, false));
    const back = App.ui.el("div", { class: "fc-face back" });
    App.ui.renderRich(back, cardFace(card, true));
    const inner = App.ui.el("div", {
      class: "fc-inner" + (studyState.flipped ? " flipped" : ""),
      onClick: () => { studyState.flipped = !studyState.flipped; App.refresh(); },
    }, [front, back]);
    view.appendChild(App.ui.el("div", { class: "fc-card" }, inner));

    const controls = App.ui.el("div", { class: "pomo-controls", style: "margin-top:20px;flex-wrap:wrap" });
    if (!studyState.flipped) {
      controls.appendChild(App.ui.el("button", { class: "btn primary", text: "Çevir", onClick: () => { studyState.flipped = true; App.refresh(); } }));
    } else {
      [[2, "Tekrar", "danger"], [3, "Zor", "ghost"], [4, "İyi", "primary"], [5, "Kolay", "ghost"]].forEach(([q, label, kind]) => {
        controls.appendChild(App.ui.el("button", {
          class: "btn " + kind,
          onClick: () => grade(q),
        }, [label + " ", App.ui.el("small", { class: "muted", text: predict(card, q) < 1 ? "<1g" : predict(card, q) + "g" })]));
      });
    }
    view.appendChild(controls);
    view.appendChild(App.ui.el("p", { class: "muted", style: "text-align:center;margin-top:14px",
      text: `KF ${(card.ease || 2.5).toFixed(2)} · aralık ${card.interval || 0}g · tekrar ${card.reps || 0}` + (card.type === "cloze" ? " · cloze" : "") }));
  }

  /* ---------- Liste görünümü ---------- */
  function deckStats(deck) {
    const s = { new: 0, learning: 0, mature: 0 };
    (deck.cards || []).forEach((c) => s[maturity(c)]++);
    return s;
  }
  function maturityBar(deck) {
    const s = deckStats(deck);
    const total = (deck.cards || []).length || 1;
    const seg = (n, v) => n ? App.ui.el("div", { style: `width:${(n / total) * 100}%;background:var(--${v})`, title: n }) : null;
    return App.ui.el("div", { style: "display:flex;height:8px;border-radius:999px;overflow:hidden;margin:4px 0 2px" },
      [seg(s.new, "amber"), seg(s.learning, "accent"), seg(s.mature, "green")]);
  }

  function render(view) {
    if (studyState) return renderStudy(view);
    const decks = load();

    view.appendChild(App.ui.pageHeader("Flashcard", "SM-2 aralıklı tekrar — Anki tarzı", [
      App.ui.el("button", { class: "btn ghost", text: "▶ Tüm tekrarlar", onClick: startMixedDue }),
      App.ui.el("button", { class: "btn primary", text: "+ Yeni deste", onClick: newDeck }),
    ]));

    if (!decks.length) {
      view.appendChild(App.ui.emptyState("Deste yok.", "+ Yeni deste", newDeck));
      return;
    }

    decks.forEach((deck) => {
      const due = dueCards(deck).length;
      const s = deckStats(deck);
      const groups = new Set();
      const listCards = (deck.cards || []).filter((c) => {
        if (c.clozeGroup) { if (groups.has(c.clozeGroup)) return false; groups.add(c.clozeGroup); }
        return true;
      });
      view.appendChild(App.ui.card([
        App.ui.el("div", { class: "page-head" }, [
          App.ui.el("div", {}, [
            App.ui.el("h3", { text: deck.name }),
            App.ui.el("p", { class: "muted", text: `${deck.cards.length} kart · bugün ${due} · yeni ${s.new} · öğreniliyor ${s.learning} · olgun ${s.mature}` }),
          ]),
          App.ui.el("div", { class: "page-head-actions" }, [
            App.ui.el("button", { class: "btn sm primary", text: "▶ Çalış (" + due + ")", disabled: !due, onClick: () => startStudy(deck, true) }),
            App.ui.el("button", { class: "btn sm ghost", text: "Tümü", disabled: !deck.cards.length, onClick: () => startStudy(deck, false) }),
            App.ui.el("button", { class: "btn sm ghost", text: "+ Kart", onClick: () => editCard(deck, null) }),
            App.ui.el("button", { class: "btn sm ghost", text: "+ Cloze", onClick: () => editCloze(deck, null) }),
            App.ui.el("button", { class: "btn sm ghost", text: "⨭", title: "Toplu ekle", onClick: () => bulkAdd(deck) }),
            App.ui.el("button", { class: "btn sm ghost", text: "CSV↑", onClick: () => importCsv(deck) }),
            App.ui.el("button", { class: "btn sm ghost", text: "CSV↓", disabled: !deck.cards.length, onClick: () => exportCsv(deck) }),
            App.ui.el("button", { class: "btn sm ghost", text: "✎", onClick: () => renameDeck(deck) }),
            App.ui.el("button", { class: "btn sm ghost", text: "🗑", onClick: () => removeDeck(deck.id) }),
          ]),
        ]),
        deck.cards.length ? maturityBar(deck) : null,
        deck.cards.length ? App.ui.el("details", {}, [
          App.ui.el("summary", { class: "muted", text: "Kartları göster (" + listCards.length + ")" }),
          App.ui.el("div", { class: "list", style: "margin-top:10px" }, listCards.map((c) => {
            const grp = c.clozeGroup ? deck.cards.filter((x) => x.clozeGroup === c.clozeGroup) : null;
            return App.ui.el("div", { class: "list-item" }, [
              App.ui.el("div", { class: "li-main" }, [
                App.ui.el("div", { class: "li-title", text: cardTitle(c) + (grp ? "  ·  cloze ×" + grp.length : "") }),
                App.ui.el("div", { class: "li-sub", text: (c.type === "cloze" ? "" : c.back + "  ·  ") + maturity(c) + "  ·  tekrar " + App.ui.fmtDate(c.due) }),
              ]),
              App.ui.el("div", { class: "li-actions" }, [
                App.ui.el("button", { class: "btn sm ghost", text: "✎", onClick: () => c.type === "cloze" ? editCloze(deck, grp) : editCard(deck, c) }),
                App.ui.el("button", { class: "btn sm ghost", text: "🗑", onClick: () => removeCard(deck, c) }),
              ]),
            ]);
          })),
        ]) : null,
      ]));
    });
  }

  /* ---------- Dışa açılan API ---------- */
  const api = {
    decks: () => load(),
    ensureDeck(name) {
      const l = load();
      let d = l.find((x) => (x.name || "").toLowerCase() === String(name || "").toLowerCase());
      if (!d) { d = { id: App.ui.uid(), name: name || "Yeni deste", created: App.ui.todayISO(), cards: [] }; l.push(d); save(l); }
      return d.id;
    },
    addCards(deckId, items) {
      const l = load();
      const d = l.find((x) => x.id === deckId);
      if (!d) return 0;
      let n = 0;
      (items || []).forEach((it) => {
        if (it.clozeText) {
          const ns = [...new Set([...String(it.clozeText).matchAll(CLOZE_RE)].map((s) => Number(s[1])))];
          if (!ns.length) return;
          const gid = App.ui.uid();
          ns.forEach((cn) => { d.cards.push(newCard(null, null, { type: "cloze", clozeGroup: gid, clozeN: cn, text: it.clozeText })); n++; });
        } else if (it.front && it.back) {
          d.cards.push(newCard(it.front, it.back)); n++;
        }
      });
      save(l);
      return n;
    },
    startMixedDue,
    dueCount() { return load().reduce((a, d) => a + dueCards(d).length, 0); },
  };
  App.flashcards = api;

  App.registerModule({ id: "flashcards", title: "Flashcard", icon: "🃏", group: "Çalışma", render, unmount() {} });
  App.registerCommand({ label: "Yeni flashcard destesi", icon: "🃏", group: "Ekle", run: () => newDeck() });
  App.registerCommand({ label: "Bugünkü tüm tekrarları çalış", icon: "🃏", group: "Çalışma", run: () => startMixedDue() });
})();
