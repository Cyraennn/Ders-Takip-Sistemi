/* Deneme Sınavı / Quiz — soru bankası + test çözme */
(function () {
  const BANK_KEY = "quiz_banks";
  const RES_KEY = "quiz_results";

  function banks() { return App.store.get(BANK_KEY, []); }
  function saveBanks(l) { App.store.set(BANK_KEY, l); }
  function results() { return App.store.get(RES_KEY, []); }
  function saveResults(l) { App.store.set(RES_KEY, l); }

  let session = null; // { bankId, name, questions:[], idx, answers:[], startedAt, limitSec }
  let tickTimer = null;

  /* ---------- Banka yönetimi ---------- */
  async function newBank() {
    const data = await App.ui.formModal("Yeni soru bankası", [
      { name: "name", label: "Ad", required: true },
      { name: "course", label: "Ders", list: App.data.courseNames() },
    ]);
    if (!data) return;
    const l = banks();
    l.push({ id: App.ui.uid(), name: data.name, course: data.course, questions: [] });
    saveBanks(l);
    App.refresh();
  }

  async function renameBank(b) {
    const data = await App.ui.formModal("Bankayı düzenle", [
      { name: "name", label: "Ad", required: true },
      { name: "course", label: "Ders", list: App.data.courseNames() },
    ], b);
    if (!data) return;
    const l = banks();
    const it = l.find((x) => x.id === b.id);
    if (it) { it.name = data.name; it.course = data.course; }
    saveBanks(l);
    App.refresh();
  }

  async function removeBank(id) {
    if (!(await App.ui.confirm("Banka ve tüm soruları silinsin mi?"))) return;
    saveBanks(banks().filter((b) => b.id !== id));
    App.refresh();
  }

  /* ---------- Soru yönetimi ---------- */
  async function editQuestion(bank, q) {
    const isTF = q && q.type === "tf";
    const data = await App.ui.formModal(q ? "Soruyu düzenle" : "Soru ekle", [
      { name: "type", label: "Tür", type: "select", options: [{ value: "mc", label: "Çoktan seçmeli" }, { value: "tf", label: "Doğru / Yanlış" }], default: q ? q.type : "mc" },
      { name: "text", label: "Soru metni", type: "textarea", required: true },
      { name: "o0", label: "A şıkkı", default: q && q.options ? q.options[0] : "" },
      { name: "o1", label: "B şıkkı", default: q && q.options ? q.options[1] : "" },
      { name: "o2", label: "C şıkkı", default: q && q.options ? q.options[2] : "" },
      { name: "o3", label: "D şıkkı", default: q && q.options ? q.options[3] : "" },
      { name: "o4", label: "E şıkkı", default: q && q.options ? q.options[4] : "" },
      { name: "answer", label: "Doğru cevap", type: "select", options: [
        { value: "0", label: "A / Doğru" }, { value: "1", label: "B / Yanlış" },
        { value: "2", label: "C" }, { value: "3", label: "D" }, { value: "4", label: "E" },
      ], default: q ? String(q.answer) : "0", hint: "Doğru/Yanlış soruda: A=Doğru, B=Yanlış" },
      { name: "explain", label: "Açıklama (isteğe bağlı)", type: "textarea" },
    ], q ? Object.assign({}, q, { o0: (q.options || [])[0], o1: (q.options || [])[1], o2: (q.options || [])[2], o3: (q.options || [])[3], o4: (q.options || [])[4] }) : {});
    if (!data) return;
    const l = banks();
    const it = l.find((x) => x.id === bank.id);
    if (!it) return;
    let opts, ans = Number(data.answer);
    if (data.type === "tf") { opts = ["Doğru", "Yanlış"]; if (ans > 1) ans = 0; }
    else {
      opts = [data.o0, data.o1, data.o2, data.o3, data.o4].map((s) => (s || "").trim()).filter(Boolean);
      if (opts.length < 2) { App.ui.toast("En az 2 şık girin", "error"); return; }
      if (ans >= opts.length) ans = 0;
    }
    const obj = { id: q ? q.id : App.ui.uid(), type: data.type, text: data.text, options: opts, answer: ans, explain: data.explain };
    if (q) { const i = it.questions.findIndex((x) => x.id === q.id); it.questions[i] = obj; }
    else it.questions.push(obj);
    saveBanks(l);
    App.refresh();
  }

  function removeQuestion(bank, qid) {
    const l = banks();
    const it = l.find((x) => x.id === bank.id);
    if (it) it.questions = it.questions.filter((q) => q.id !== qid);
    saveBanks(l);
    App.refresh();
  }

  async function fromDeck(bank) {
    const decks = (App.store.get("decks", []) || []).filter((d) => d.cards && d.cards.length >= 4);
    if (!decks.length) { App.ui.toast("En az 4 kartlı bir flashcard destesi gerekli", "error"); return; }
    const data = await App.ui.formModal("Flashcard destesinden soru üret", [
      { name: "deck", label: "Deste", type: "select", options: decks.map((d) => ({ value: d.id, label: d.name + " (" + d.cards.length + ")" })) },
      { name: "count", label: "Kaç soru?", type: "number", default: Math.min(10, decks[0].cards.length) },
    ]);
    if (!data) return;
    const deck = decks.find((d) => d.id === data.deck);
    const cards = deck.cards.slice();
    shuffle(cards);
    const n = Math.min(Number(data.count) || 10, cards.length);
    const l = banks();
    const it = l.find((x) => x.id === bank.id);
    for (let i = 0; i < n; i++) {
      const c = cards[i];
      const distract = deck.cards.filter((x) => x.id !== c.id).map((x) => x.back);
      shuffle(distract);
      const opts = [c.back, ...distract.slice(0, 3)];
      shuffle(opts);
      it.questions.push({ id: App.ui.uid(), type: "mc", text: c.front, options: opts, answer: opts.indexOf(c.back), explain: "" });
    }
    saveBanks(l);
    App.ui.toast(n + " soru eklendi", "success");
    App.refresh();
  }

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  /* ---------- Sınav oturumu ---------- */
  async function startSession(bank) {
    if (!bank.questions.length) { App.ui.toast("Bu bankada soru yok", "info"); return; }
    const data = await App.ui.formModal("Sınavı başlat — " + bank.name, [
      { name: "count", label: "Soru sayısı", type: "number", default: bank.questions.length, hint: "En fazla " + bank.questions.length },
      { name: "shuffle", label: "Soruları karıştır", type: "checkbox", default: true },
      { name: "limit", label: "Süre (dakika, 0 = sınırsız)", type: "number", default: 0 },
    ]);
    if (!data) return;
    let qs = bank.questions.slice();
    if (data.shuffle) shuffle(qs);
    qs = qs.slice(0, Math.max(1, Math.min(Number(data.count) || qs.length, qs.length)));
    qs = qs.map((q) => {
      if (q.type !== "mc") return Object.assign({}, q, { _order: [0, 1] });
      const order = q.options.map((_, i) => i);
      shuffle(order);
      return Object.assign({}, q, { _order: order });
    });
    session = {
      bankId: bank.id, name: bank.name, questions: qs, idx: 0,
      answers: new Array(qs.length).fill(null),
      startedAt: Date.now(),
      limitSec: (Number(data.limit) || 0) * 60,
    };
    App.refresh();
  }

  function pick(optIdx) {
    session.answers[session.idx] = optIdx;
    App.refresh();
  }
  function nav(delta) {
    session.idx = Math.max(0, Math.min(session.questions.length - 1, session.idx + delta));
    App.refresh();
  }

  function finish() {
    stopTick();
    let correct = 0;
    session.questions.forEach((q, i) => {
      const a = session.answers[i];
      if (a == null) return;
      const chosenReal = q.type === "mc" ? q._order[a] : a;
      if (chosenReal === q.answer) correct++;
    });
    const durationSec = Math.round((Date.now() - session.startedAt) / 1000);
    const res = {
      id: App.ui.uid(), bankId: session.bankId, bankName: session.name,
      date: new Date().toISOString(), total: session.questions.length, correct, durationSec,
    };
    const rl = results();
    rl.push(res);
    saveResults(rl);
    session.finished = res;
    App.refresh();
  }

  async function quitSession() {
    if (session.finished || (await App.ui.confirm("Sınavdan çıkılsın mı? İlerleme kaydedilmez."))) {
      stopTick();
      session = null;
      App.refresh();
    }
  }

  function stopTick() { if (tickTimer) { clearInterval(tickTimer); tickTimer = null; } }

  /* ---------- Görünümler ---------- */
  function renderSession(view) {
    if (session.finished) return renderResult(view);
    const q = session.questions[session.idx];
    const answered = session.answers.filter((a) => a != null).length;

    view.appendChild(App.ui.pageHeader(session.name, "Soru " + (session.idx + 1) + " / " + session.questions.length + " · " + answered + " yanıtlandı", [
      session.limitSec ? App.ui.el("span", { class: "badge amber", id: "quiz-timer", text: fmtLeft() }) : null,
      App.ui.el("button", { class: "btn ghost", text: "Çık", onClick: quitSession }),
    ]));

    view.appendChild(App.ui.el("div", { class: "progress", style: "margin-bottom:18px" },
      App.ui.el("span", { style: "width:" + ((session.idx + 1) / session.questions.length) * 100 + "%" })));

    const qText = App.ui.el("div", { class: "quiz-q", style: "font-size:1.08rem;font-weight:600" });
    App.ui.renderRich(qText, q.text);
    const card = App.ui.card([
      qText,
      App.ui.el("div", { style: "margin-top:14px" }, q._order.map((realIdx, dispIdx) =>
        App.ui.el("button", {
          class: "quiz-opt" + (session.answers[session.idx] === dispIdx ? " chosen" : ""),
          onClick: () => pick(dispIdx),
        }, [String.fromCharCode(65 + dispIdx) + ") ", rq(q.options[realIdx])])
      )),
    ]);
    view.appendChild(card);

    view.appendChild(App.ui.el("div", { class: "pomo-controls", style: "justify-content:space-between;margin-top:16px" }, [
      App.ui.el("button", { class: "btn ghost", text: "‹ Önceki", disabled: session.idx === 0, onClick: () => nav(-1) }),
      session.idx === session.questions.length - 1
        ? App.ui.el("button", { class: "btn primary", text: "Bitir ve puanla", onClick: () => confirmFinish() })
        : App.ui.el("button", { class: "btn primary", text: "Sonraki ›", onClick: () => nav(1) }),
    ]));

    // navigasyon noktaları
    view.appendChild(App.ui.el("div", { class: "chip-row", style: "margin-top:14px;justify-content:center" },
      session.questions.map((_, i) => App.ui.el("span", {
        class: "chip" + (i === session.idx ? " active" : ""),
        style: session.answers[i] != null && i !== session.idx ? "border-color:var(--green)" : null,
        text: String(i + 1),
        onClick: () => { session.idx = i; App.refresh(); },
      }))
    ));

    if (session.limitSec && !tickTimer) {
      tickTimer = setInterval(() => {
        const left = session.limitSec - Math.round((Date.now() - session.startedAt) / 1000);
        const tEl = document.getElementById("quiz-timer");
        if (tEl) tEl.textContent = fmtLeft();
        if (left <= 0) { App.ui.toast("Süre doldu!", "info"); finish(); }
      }, 1000);
    }
  }

  function fmtLeft() {
    const left = Math.max(0, session.limitSec - Math.round((Date.now() - session.startedAt) / 1000));
    return "⏳ " + App.ui.pad(Math.floor(left / 60)) + ":" + App.ui.pad(left % 60);
  }

  async function confirmFinish() {
    const blank = session.answers.filter((a) => a == null).length;
    if (blank && !(await App.ui.confirm(blank + " soru boş. Yine de bitirilsin mi?"))) return;
    finish();
  }

  function renderResult(view) {
    const r = session.finished;
    const pct = Math.round((r.correct / r.total) * 100);
    view.appendChild(App.ui.pageHeader("Sonuç — " + session.name, "", [
      App.ui.el("button", { class: "btn primary", text: "Bitti", onClick: () => { session = null; App.refresh(); } }),
    ]));
    view.appendChild(App.ui.card([
      App.ui.el("div", { class: "stat-value", style: "font-size:2.6rem;color:var(--" + (pct >= 50 ? "green" : "red") + ")", text: r.correct + " / " + r.total }),
      App.ui.el("div", { class: "stat-sub", text: "%" + pct + " · süre " + Math.floor(r.durationSec / 60) + " dk " + (r.durationSec % 60) + " sn" }),
    ]));

    session.questions.forEach((q, i) => {
      const a = session.answers[i];
      const chosenReal = a == null ? null : (q.type === "mc" ? q._order[a] : a);
      const ok = chosenReal === q.answer;
      const qhead = App.ui.el("div", { style: "font-weight:600;display:flex;gap:8px;align-items:baseline;flex-wrap:wrap" }, [
        App.ui.badge(ok ? "Doğru" : a == null ? "Boş" : "Yanlış", ok ? "green" : a == null ? "" : "red"),
        rq(q.text),
      ]);
      view.appendChild(App.ui.card([
        qhead,
        App.ui.el("div", { style: "margin-top:8px" }, q._order.map((realIdx, dispIdx) => {
          let cls = "quiz-opt";
          if (realIdx === q.answer) cls += " correct";
          else if (a === dispIdx) cls += " wrong";
          return App.ui.el("div", { class: cls }, [String.fromCharCode(65 + dispIdx) + ") ", rq(q.options[realIdx])]);
        })),
        q.explain ? App.ui.el("p", { class: "muted", style: "margin-top:8px", text: "💡 " + q.explain }) : null,
      ]));
    });
  }

  function renderList(view) {
    const bl = banks();
    view.appendChild(App.ui.pageHeader("Deneme Sınavı", "Soru bankaları oluştur, test çöz, sonuçları takip et", [
      App.ui.el("button", { class: "btn primary", text: "+ Yeni banka", onClick: newBank }),
    ]));

    const rl = results();
    if (rl.length) {
      const last5 = rl.slice(-5).reverse();
      view.appendChild(App.ui.card([
        App.ui.el("h3", { text: "Son sonuçlar" }),
        App.ui.el("div", { class: "list" }, last5.map((r) =>
          App.ui.el("div", { class: "list-item" }, [
            App.ui.el("div", { class: "li-main" }, [
              App.ui.el("div", { class: "li-title", text: r.bankName }),
              App.ui.el("div", { class: "li-sub", text: App.ui.fmtDateTime(r.date) }),
            ]),
            App.ui.badge(r.correct + "/" + r.total + " (%" + Math.round((r.correct / r.total) * 100) + ")", r.correct / r.total >= 0.5 ? "green" : "red"),
          ])
        )),
      ]));
    }

    if (!bl.length) {
      view.appendChild(App.ui.emptyState("Soru bankası yok.", "+ Yeni banka", newBank));
      return;
    }

    bl.forEach((b) => {
      const bres = rl.filter((r) => r.bankId === b.id);
      const best = bres.length ? Math.max(...bres.map((r) => Math.round((r.correct / r.total) * 100))) : null;
      view.appendChild(App.ui.card([
        App.ui.el("div", { class: "page-head" }, [
          App.ui.el("div", {}, [
            App.ui.el("h3", { text: b.name }),
            App.ui.el("p", { class: "muted", text: b.questions.length + " soru" + (b.course ? " · " + b.course : "") + (best != null ? " · en iyi %" + best : "") }),
          ]),
          App.ui.el("div", { class: "page-head-actions" }, [
            App.ui.el("button", { class: "btn sm primary", text: "▶ Sınav", disabled: !b.questions.length, onClick: () => startSession(b) }),
            App.ui.el("button", { class: "btn sm ghost", text: "+ Soru", onClick: () => editQuestion(b, null) }),
            App.ui.el("button", { class: "btn sm ghost", text: "🃏→❓", title: "Flashcard destesinden üret", onClick: () => fromDeck(b) }),
            App.ui.el("button", { class: "btn sm ghost", text: "✎", onClick: () => renameBank(b) }),
            App.ui.el("button", { class: "btn sm ghost", text: "🗑", onClick: () => removeBank(b.id) }),
          ]),
        ]),
        b.questions.length ? App.ui.el("details", {}, [
          App.ui.el("summary", { class: "muted", text: "Soruları göster / düzenle" }),
          App.ui.el("div", { class: "list", style: "margin-top:10px" }, b.questions.map((q, i) =>
            App.ui.el("div", { class: "list-item" }, [
              App.ui.el("div", { class: "li-main" }, [
                App.ui.el("div", { class: "li-title", text: (i + 1) + ". " + q.text }),
                App.ui.el("div", { class: "li-sub", text: (q.type === "tf" ? "D/Y" : "ÇS") + " · doğru: " + String.fromCharCode(65 + q.answer) + ") " + q.options[q.answer] }),
              ]),
              App.ui.el("div", { class: "li-actions" }, [
                App.ui.el("button", { class: "btn sm ghost", text: "✎", onClick: () => editQuestion(b, q) }),
                App.ui.el("button", { class: "btn sm ghost", text: "🗑", onClick: () => removeQuestion(b, q.id) }),
              ]),
            ])
          )),
        ]) : null,
      ]));
    });
  }

  function rq(src) {
    const s = App.ui.el("span");
    s.textContent = src == null ? "" : String(src);
    App.ui.mathify(s);
    return s;
  }

  function render(view) {
    if (session) return renderSession(view);
    renderList(view);
  }

  /* ---------- Dışa açılan API ---------- */
  App.quiz = {
    banks: () => banks(),
    ensureBank(name, course) {
      const l = banks();
      let b = l.find((x) => (x.name || "").toLowerCase() === String(name || "").toLowerCase());
      if (!b) { b = { id: App.ui.uid(), name: name || "Yeni banka", course: course || "", questions: [] }; l.push(b); saveBanks(l); }
      return b.id;
    },
    addQuestions(bankId, qs) {
      const l = banks();
      const b = l.find((x) => x.id === bankId);
      if (!b) return 0;
      let n = 0;
      (qs || []).forEach((q) => {
        const opts = (q.options || []).map((s) => String(s).trim()).filter(Boolean);
        if (!q.text || opts.length < 2) return;
        let ans = Number(q.answer) || 0;
        if (ans < 0 || ans >= opts.length) ans = 0;
        b.questions.push({ id: App.ui.uid(), type: "mc", text: String(q.text), options: opts, answer: ans, explain: q.explain || "" });
        n++;
      });
      saveBanks(l);
      return n;
    },
  };

  App.registerModule({
    id: "quiz", title: "Deneme Sınavı", icon: "❓", group: "Çalışma", render,
    unmount() { stopTick(); },
  });
})();
