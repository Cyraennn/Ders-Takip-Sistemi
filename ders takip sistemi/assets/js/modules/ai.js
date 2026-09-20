/* AI Asistan — Gemini tabanlı ders yardımcısı
   Soru çözer, konu anlatır, motive eder. API anahtarı kullanıcının kendisine ait
   ve yalnızca bu tarayıcının localStorage'ında saklanır. */
(function () {
  const SET_KEY = "_ai_settings";
  const CHAT_KEY = "ai_chats";
  const DEFAULT_MODEL = "gemini-2.5-flash";
  const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/";

  const MODES = {
    genel: { label: "💬 Genel", hint: "" },
    coz: { label: "❓ Soruyu çöz", hint: "Kullanıcı bir soru/problem veriyor. Adım adım, öğretici biçimde çöz; ara işlemleri göster ve sonucu net biçimde belirt. Sadece sonucu verme. Uygunsa alternatif bir yöntem de kısaca söyle." },
    anlat: { label: "📖 Konu anlat", hint: "Kullanıcı bir ders konusu soruyor. Konuyu üniversite öğrencisine ders anlatır gibi yapılandır: kısa tanım, neden önemli, temel kavramlar, somut bir örnek, sık yapılan hatalar ve 2-3 cümlelik özet. Başlık ve madde işareti kullan." },
    motive: { label: "💪 Motive et", hint: "Kullanıcının motivasyona ihtiyacı var. Samimi, gerçekçi ve enerjik ol; boş klişe kurma. Kullanıcının yaklaşan sınav/ödevlerine ve hedeflerine değin ve hemen yapabileceği küçük, somut bir sonraki adım öner. Kısa tut." },
    sina: { label: "📝 Beni sına", hint: "Kullanıcının verdiği konudan karışık zorlukta 5 kısa soru sor ve numaralandır. Cevapları şimdi verme; kullanıcı cevapladıktan sonra tek tek değerlendirip eksikleri açıkla." },
  };

  function settings() {
    return Object.assign({ apiKey: "", model: DEFAULT_MODEL, temperature: 0.7, persona: "" }, App.store.get(SET_KEY, {}));
  }
  function saveSettings(s) { App.store.set(SET_KEY, s); }
  function chats() { return App.store.get(CHAT_KEY, []); }
  function saveChats(l) { App.store.set(CHAT_KEY, l); }

  let activeId = null;
  let busy = false;
  let abort = null;
  let queued = null;

  /* ---------- Bağlam + sistem yönergesi ---------- */
  function contextBlock() {
    const today = App.ui.todayISO();
    const courses = App.data.courseNames();
    const exams = (App.store.get("exams", []) || [])
      .filter((e) => !e.done && e.date && App.ui.daysBetween(today, e.date) >= 0)
      .sort((a, b) => (a.date < b.date ? -1 : 1)).slice(0, 3)
      .map((e) => `${e.type} – ${e.course} (${App.ui.daysBetween(today, e.date)} gün sonra${e.topics ? "; konular: " + e.topics.replace(/\n/g, ", ") : ""})`);
    const tasks = (App.store.get("tasks", []) || [])
      .filter((t) => t.status !== "Tamamlandı" && t.due)
      .sort((a, b) => (a.due < b.due ? -1 : 1)).slice(0, 3)
      .map((t) => `${t.title}${t.course ? " (" + t.course + ")" : ""} – teslim ${App.ui.fmtDate(t.due)}`);
    const gp = App.store.get("gradplan", {}) || {};
    const lines = [];
    if (courses.length) lines.push("Aldığı dersler: " + courses.join(", "));
    if (exams.length) lines.push("Yaklaşan sınavlar: " + exams.join(" | "));
    if (tasks.length) lines.push("Yaklaşan ödevler: " + tasks.join(" | "));
    if (gp.goalGpa) lines.push("Hedef GANO: " + gp.goalGpa);
    return lines.length ? "\n\nÖğrenci bağlamı (gerektiğinde kullan, her yanıtta tekrar etme):\n- " + lines.join("\n- ") : "";
  }

  function systemPrompt(mode) {
    const s = settings();
    let p =
      "Sen 'BÖTE Ders Merkezi' uygulamasının içindeki yapay zekâ ders asistanısın. " +
      "Kullanıcı Türkiye'de Bilgisayar ve Öğretim Teknolojileri Eğitimi (BÖTE) okuyan bir üniversite öğrencisi. " +
      "Daima Türkçe, açık ve öğretici yanıt ver. Uzun yanıtlarda Markdown başlık ve madde işaretleri kullan; " +
      "kod için ``` blokları kullan. Matematiği düz metin/Markdown ile yaz. Bilmediğinde veya emin olmadığında bunu söyle. " +
      "Bugünün tarihi: " + App.ui.todayISO() + ".";
    if (MODES[mode] && MODES[mode].hint) p += "\n\nBu mesajdaki özel görevin: " + MODES[mode].hint;
    if (s.persona) p += "\n\nKullanıcının ek yönergesi: " + s.persona;
    p += contextBlock();
    return p;
  }

  /* ---------- Gemini çağrısı (SSE akış) ---------- */
  function textOf(obj) {
    try { return (obj.candidates[0].content.parts || []).map((x) => x.text || "").join(""); }
    catch (e) { return ""; }
  }

  async function stream(history, mode, onText) {
    const s = settings();
    if (!s.apiKey) throw new Error("NO_KEY");
    const model = (s.model || DEFAULT_MODEL).trim();
    const contents = history.map((m) => ({
      role: m.role === "model" ? "model" : "user",
      parts: [
        ...(m.image ? [{ inlineData: { mimeType: m.image.mime, data: m.image.data } }] : []),
        { text: m.text || "" },
      ],
    }));
    abort = new AbortController();
    const url = ENDPOINT + encodeURIComponent(model) + ":streamGenerateContent?alt=sse&key=" + encodeURIComponent(s.apiKey);
    let res;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          systemInstruction: { parts: [{ text: systemPrompt(mode) }] },
          generationConfig: { temperature: Number(s.temperature) || 0.7 },
        }),
        signal: abort.signal,
      });
    } catch (e) {
      if (e.name === "AbortError") throw e;
      throw new Error("NETWORK");
    }
    if (!res.ok) {
      let detail = "";
      try { const j = await res.json(); detail = (j.error && j.error.message) || ""; } catch (e) {}
      if (res.status === 400 && /api key|API_KEY/i.test(detail)) throw new Error("BAD_KEY");
      if (res.status === 401 || res.status === 403) throw new Error("BAD_KEY");
      if (res.status === 429) throw new Error("RATE");
      if (res.status === 404) throw new Error("MODEL:" + model);
      throw new Error("HTTP " + res.status + (detail ? ": " + detail : ""));
    }

    let full = "", blocked = null;
    const handle = (payload) => {
      if (!payload || payload === "[DONE]") return;
      try {
        const obj = JSON.parse(payload);
        full += textOf(obj);
        const fr = obj.candidates && obj.candidates[0] && obj.candidates[0].finishReason;
        if (fr && !["STOP", "MAX_TOKENS", "FINISH_REASON_UNSPECIFIED"].includes(fr)) blocked = fr;
        if (full) onText(full);
      } catch (e) { /* eksik satır — yok say */ }
    };

    if (res.body && res.body.getReader) {
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (line.startsWith("data:")) handle(line.slice(5).trim());
        }
      }
      if (buf.trim().startsWith("data:")) handle(buf.trim().slice(5).trim());
    } else {
      const txt = await res.text();
      txt.split(/\r?\n/).forEach((l) => { if (l.startsWith("data:")) handle(l.slice(5).trim()); });
    }

    if (!full && blocked) throw new Error("BLOCKED:" + blocked);
    if (!full) throw new Error("EMPTY");
    return full;
  }

  function errText(e) {
    const m = String((e && e.message) || e);
    const map = {
      NO_KEY: "⚠️ API anahtarı ayarlı değil. Yukarıdan **⚙ Ayarlar**'a gir.",
      BAD_KEY: "⚠️ API anahtarı geçersiz veya yetkisiz görünüyor. Ayarlardan kontrol et.",
      RATE: "⏳ İstek sınırına / kotaya takıldın. Biraz bekleyip tekrar dene.",
      NETWORK: "🌐 Bağlantı kurulamadı. İnterneti kontrol et; uygulamayı dosyadan (file://) açtıysan bir yerel sunucudan aç (tarayıcı isteği engelliyor olabilir).",
      EMPTY: "Model boş yanıt döndü. Tekrar dener misin?",
    };
    if (map[m]) return map[m];
    if (m.startsWith("MODEL:")) return "⚠️ '" + m.slice(6) + "' modeli bulunamadı. Ayarlardan geçerli bir model adı gir (örn. gemini-2.5-flash veya gemini-flash-latest).";
    if (m.startsWith("BLOCKED:")) return "🚫 Yanıt güvenlik filtresine takıldı (" + m.slice(8) + "). Soruyu farklı ifade etmeyi dene.";
    return "Hata: " + m;
  }

  /* ---------- Sohbet yönetimi ---------- */
  function ensureChat() {
    const l = chats();
    if (activeId) { const c = l.find((x) => x.id === activeId); if (c) return c; }
    if (l.length) { activeId = l[0].id; return l[0]; }
    const c = { id: App.ui.uid(), title: "Yeni sohbet", created: new Date().toISOString(), messages: [] };
    l.unshift(c);
    saveChats(l);
    activeId = c.id;
    return c;
  }

  function newChat() {
    const l = chats();
    if (l[0] && !l[0].messages.length) { activeId = l[0].id; App.refresh(); return; }
    const c = { id: App.ui.uid(), title: "Yeni sohbet", created: new Date().toISOString(), messages: [] };
    l.unshift(c);
    saveChats(l);
    activeId = c.id;
    App.refresh();
  }

  async function deleteChat(id) {
    if (!(await App.ui.confirm("Bu sohbet silinsin mi?"))) return;
    saveChats(chats().filter((c) => c.id !== id));
    if (activeId === id) activeId = null;
    App.refresh();
  }

  function refreshIfActive() {
    if (location.hash.replace(/^#\/?/, "") === "ai") App.refresh();
  }
  function scrollDown() {
    const box = document.querySelector(".ai-messages");
    if (box) box.scrollTop = box.scrollHeight;
  }

  async function send(text, mode, image) {
    if (busy) return;
    text = (text || "").trim();
    if (!text && !image) return;
    if (!settings().apiKey) { App.refresh(); App.ui.toast("Önce API anahtarını gir", "error"); return; }

    const l = chats();
    const chat = l.find((c) => c.id === activeId) || ensureChat();
    chat.messages.push({ role: "user", text, image: image || null, mode, at: new Date().toISOString() });
    if (chat.messages.filter((m) => m.role === "user").length === 1) {
      chat.title = (text || "Görsel soru").slice(0, 44);
    }
    const aiMsg = { role: "model", text: "", at: new Date().toISOString() };
    chat.messages.push(aiMsg);
    saveChats(l);
    busy = true;
    App.refresh();
    scrollDown();

    const history = chat.messages.slice(0, -1).map((m) => ({ role: m.role, text: m.text, image: m.image }));
    try {
      const full = await stream(history, mode, (t) => {
        aiMsg.text = t;
        const bub = document.getElementById("ai-streaming");
        if (bub) { bub.innerHTML = App.ui.markdown(t) + '<span class="ai-cursor">▋</span>'; scrollDown(); }
      });
      aiMsg.text = full;
    } catch (e) {
      if (e && e.name === "AbortError") {
        aiMsg.text = (aiMsg.text || "") + "\n\n_(durduruldu)_";
      } else {
        aiMsg.text = errText(e);
        aiMsg.error = true;
      }
    }
    busy = false;
    abort = null;
    saveChats(l);
    refreshIfActive();
    scrollDown();
  }

  function stop() { if (abort) abort.abort(); }

  /* ---------- Dışa açılan API (notlar modülü kart/quiz üretimi için) ---------- */
  async function complete(promptText, opts) {
    opts = opts || {};
    const s = settings();
    if (!s.apiKey) throw new Error("NO_KEY");
    const model = (s.model || DEFAULT_MODEL).trim();
    const url = ENDPOINT + encodeURIComponent(model) + ":generateContent?key=" + encodeURIComponent(s.apiKey);
    const sys = opts.json
      ? "Sen bir BÖTE ders içerik üreticisisin. SADECE istenen JSON'u döndür; kod çiti, yorum veya açıklama ekleme."
      : "Sen bir BÖTE ders asistanısın. Türkçe, öz ve öğretici yanıt ver.";
    let res;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: promptText }] }],
          systemInstruction: { parts: [{ text: sys }] },
          generationConfig: Object.assign({ temperature: opts.json ? 0.35 : 0.6 }, opts.json ? { responseMimeType: "application/json" } : {}),
        }),
      });
    } catch (e) { throw new Error("NETWORK"); }
    if (!res.ok) {
      let d = ""; try { d = ((await res.json()).error || {}).message || ""; } catch (e) {}
      throw new Error(res.status === 429 ? "RATE" : /api key|API_KEY/i.test(d) ? "BAD_KEY" : "HTTP " + res.status);
    }
    const j = await res.json();
    let txt = "";
    try { txt = (j.candidates[0].content.parts || []).map((p) => p.text || "").join(""); } catch (e) {}
    if (opts.json) {
      txt = txt.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
      return JSON.parse(txt);
    }
    return txt;
  }

  App.ai = {
    hasKey: () => !!settings().apiKey,
    complete,
    openSettings: () => openSettings(),
    errText,
  };

  /* ---------- Ayarlar ---------- */
  async function openSettings() {
    const s = settings();
    const data = await App.ui.formModal("AI Ayarları", [
      { name: "apiKey", label: "Google Gemini API anahtarı", type: "password", default: s.apiKey, hint: "aistudio.google.com/apikey adresinden ücretsiz alınır. Yalnızca bu tarayıcıda saklanır." },
      { name: "model", label: "Model", default: s.model, hint: "gemini-2.5-flash (hızlı) · gemini-2.5-pro (güçlü) · gemini-flash-latest" },
      { name: "temperature", label: "Yaratıcılık (0–1)", type: "number", step: "0.1", min: "0", max: "1", default: s.temperature },
      { name: "persona", label: "Ek yönerge (isteğe bağlı)", type: "textarea", default: s.persona, hint: "örn. “kısa ve öz yanıt ver” ya da “her açıklamaya günlük hayattan örnek ekle”" },
    ]);
    if (!data) return;
    saveSettings({
      apiKey: (data.apiKey || "").trim(),
      model: (data.model || DEFAULT_MODEL).trim(),
      temperature: Math.max(0, Math.min(1, Number(data.temperature) || 0.7)),
      persona: data.persona || "",
    });
    App.ui.toast("Kaydedildi", "success");
    App.refresh();
  }

  /* ---------- Görsel ---------- */
  function readImage(file, cb) {
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { App.ui.toast("Görsel çok büyük (en fazla 4 MB)", "error"); return; }
    const r = new FileReader();
    r.onload = () => {
      const m = String(r.result).match(/^data:([^;]+);base64,(.*)$/);
      if (m) cb({ mime: m[1], data: m[2] });
    };
    r.readAsDataURL(file);
  }

  /* ---------- Görünüm ---------- */
  function renderSetup(view) {
    view.appendChild(App.ui.pageHeader("AI Asistan", "Gemini tabanlı ders yardımcısı — soru çözer, konu anlatır, motive eder", []));
    view.appendChild(App.ui.card([
      App.ui.el("h3", { text: "Tek seferlik kurulum" }),
      App.ui.el("p", { text: "Bu modül Google'ın Gemini modeliyle çalışır ve ücretsiz bir API anahtarı ister:" }),
      App.ui.el("ol", { style: "line-height:1.9" }, [
        App.ui.el("li", {}, [App.ui.el("a", { href: "https://aistudio.google.com/apikey", target: "_blank", rel: "noopener", text: "aistudio.google.com/apikey" }), " → Google hesabınla gir"]),
        App.ui.el("li", { text: "“Create API key” ile anahtar oluştur ve kopyala" }),
        App.ui.el("li", { text: "Aşağıdaki düğmeyle yapıştır" }),
      ]),
      App.ui.el("button", { class: "btn primary", text: "🔑 API anahtarını gir", onClick: openSettings }),
      App.ui.el("p", { class: "hint", style: "margin-top:14px", text: "Gizlilik: anahtar ve sohbetler yalnızca senin tarayıcının localStorage'ında tutulur. İstekler doğrudan Google'a gider, başka bir sunucuya değil. En sağlıklısı uygulamayı bir yerel sunucudan açmandır (file:// ile tarayıcı isteği engelleyebilir)." }),
    ]));
  }

  function render(view) {
    if (!settings().apiKey) { renderSetup(view); return; }

    const chat = ensureChat();
    const s = settings();

    view.appendChild(App.ui.pageHeader("AI Asistan", null, [
      App.ui.badge(s.model, "purple"),
      App.ui.el("button", { class: "btn ghost", text: "＋ Yeni", onClick: newChat }),
      App.ui.el("button", { class: "btn ghost", text: "⚙", onClick: openSettings }),
    ]));

    // sohbet seçici
    const cs = chats();
    if (cs.length > 1) {
      const row = App.ui.el("div", { class: "chip-row", style: "margin-bottom:12px" });
      cs.forEach((c) => {
        row.appendChild(App.ui.el("span", {
          class: "chip" + (c.id === activeId ? " active" : ""),
          text: (c.title || "Sohbet").slice(0, 24),
          onClick: () => { activeId = c.id; App.refresh(); },
        }));
      });
      view.appendChild(row);
    }

    const msgs = App.ui.el("div", { class: "ai-messages" });
    if (!chat.messages.length) {
      msgs.appendChild(App.ui.el("div", { class: "empty" }, [
        App.ui.el("div", { class: "empty-emoji", text: "✨" }),
        App.ui.el("p", { text: "Bir soru sor, çözemediğin problemi (isterse fotoğrafıyla) yapıştır, konu anlattır ya da motivasyon iste." }),
      ]));
    }
    chat.messages.forEach((m, idx) => {
      const isLastAi = idx === chat.messages.length - 1 && m.role === "model";
      const bubble = App.ui.el("div", {
        class: "ai-bubble " + (m.role === "user" ? "user" : "ai") + (m.error ? " err" : ""),
        id: busy && isLastAi ? "ai-streaming" : null,
      });
      if (m.role === "model") {
        if (busy && isLastAi) {
          bubble.innerHTML = App.ui.markdown(m.text || "…") + '<span class="ai-cursor">▋</span>';
        } else {
          App.ui.renderRich(bubble, m.text || "…");
        }
      } else {
        if (m.image) bubble.appendChild(App.ui.el("img", { src: "data:" + m.image.mime + ";base64," + m.image.data, class: "ai-img" }));
        bubble.appendChild(App.ui.el("div", { text: m.text, style: "white-space:pre-wrap" }));
        if (m.mode && MODES[m.mode] && m.mode !== "genel") bubble.appendChild(App.ui.el("div", { class: "ai-modetag", text: MODES[m.mode].label }));
      }
      const wrap = App.ui.el("div", { class: "ai-row" + (m.role === "user" ? " user" : "") }, [bubble]);
      if (m.role === "model" && m.text && !(busy && isLastAi)) {
        wrap.appendChild(App.ui.el("button", { class: "btn sm ghost", text: "📋", title: "Kopyala", onClick: () => App.ui.copyText(m.text) }));
      }
      msgs.appendChild(wrap);
    });
    view.appendChild(msgs);

    // giriş alanı
    let pendingImage = null;
    const imgPreview = App.ui.el("div", {});
    const setImg = (obj) => {
      pendingImage = obj;
      App.ui.clear(imgPreview);
      if (obj) imgPreview.appendChild(App.ui.el("div", { style: "display:flex;align-items:center;gap:8px;margin-bottom:6px" }, [
        App.ui.el("img", { src: "data:" + obj.mime + ";base64," + obj.data, style: "height:46px;border-radius:6px" }),
        App.ui.el("button", { class: "btn sm ghost", text: "görseli kaldır", onClick: () => setImg(null) }),
      ]));
    };

    const ta = App.ui.el("textarea", { class: "ai-input", rows: 1, placeholder: "Sorunu yaz…  (Enter gönderir, Shift+Enter satır atlar)", disabled: busy });
    const fire = (text, mode) => {
      const img = pendingImage;
      ta.value = ""; ta.style.height = "auto"; setImg(null);
      send(text, mode || "genel", img);
    };
    ta.addEventListener("input", () => { ta.style.height = "auto"; ta.style.height = Math.min(170, ta.scrollHeight) + "px"; });
    ta.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (ta.value.trim() || pendingImage) fire(ta.value, "genel"); }
    });
    ta.addEventListener("paste", (e) => {
      const it = [...((e.clipboardData && e.clipboardData.items) || [])].find((x) => x.type && x.type.startsWith("image/"));
      if (it) { const f = it.getAsFile(); if (f) readImage(f, setImg); }
    });

    const quick = App.ui.el("div", { class: "chip-row", style: "margin:10px 0 8px" }, [
      qbtn("💪 Motive et", () => fire("Motivasyona ihtiyacım var, beni biraz toparla.", "motive")),
      qbtn("📖 Konu anlat", async () => {
        const t = ta.value.trim() || (await App.ui.prompt({ title: "Konu anlat", label: "Hangi konu?" }));
        if (t) fire(t, "anlat");
      }),
      qbtn("❓ Soruyu çöz", () => {
        if (ta.value.trim() || pendingImage) fire(ta.value, "coz");
        else App.ui.toast("Önce soruyu yaz veya görselini ekle", "info");
      }),
      qbtn("📝 Beni sına", async () => {
        const t = ta.value.trim() || (await App.ui.prompt({ title: "Beni sına", label: "Hangi konudan?" }));
        if (t) fire(t, "sina");
      }),
    ]);

    const sendBtn = busy
      ? App.ui.el("button", { class: "btn danger", text: "■ Durdur", onClick: stop })
      : App.ui.el("button", { class: "btn primary", text: "Gönder ➤", onClick: () => { if (ta.value.trim() || pendingImage) fire(ta.value, "genel"); } });

    const fileBtn = App.ui.el("button", {
      class: "btn ghost", text: "📎", title: "Görsel ekle", disabled: busy,
      onClick: () => {
        const inp = document.createElement("input");
        inp.type = "file"; inp.accept = "image/*";
        inp.onchange = () => { if (inp.files[0]) readImage(inp.files[0], setImg); };
        inp.click();
      },
    });

    view.appendChild(App.ui.card([
      quick,
      imgPreview,
      App.ui.el("div", { class: "ai-inputrow" }, [fileBtn, ta, sendBtn]),
      App.ui.el("small", { class: "hint", text: "Yanıtlar yapay zekâ tarafından üretilir; önemli bilgileri kaynaktan doğrula." }),
    ]));

    if (chat.messages.length && !busy) {
      view.appendChild(App.ui.el("div", { style: "text-align:center;margin-top:6px" },
        App.ui.el("button", { class: "btn sm ghost", text: "🗑 Bu sohbeti sil", onClick: () => deleteChat(chat.id) })));
    }

    scrollDown();

    if (queued && !busy) {
      const q = queued; queued = null;
      setTimeout(() => send(q.text, q.mode), 60);
    }
  }

  function qbtn(label, onClick) {
    return App.ui.el("span", { class: "chip", text: label, onClick });
  }

  App.registerModule({
    id: "ai", title: "AI Asistan", icon: "✨", group: "Çalışma", render,
    unmount() { /* akış arka planda tamamlanır ve kaydedilir */ },
  });
  App.registerCommand({ label: "AI Asistan'ı aç", icon: "✨", group: "AI", run: () => App.go("ai") });
  App.registerCommand({ label: "AI: beni motive et", icon: "💪", group: "AI", run: () => { queued = { text: "Motivasyona ihtiyacım var, beni biraz toparla.", mode: "motive" }; App.go("ai"); } });
})();
