/* Kod Parçacıkları — programlama derslerinde işine yarayacak kod arşivi */
(function () {
  const KEY = "snippets";
  const LANGS = ["Python", "JavaScript", "C", "C#", "Java", "HTML", "CSS", "SQL", "PHP", "Kotlin", "Dart", "Pseudocode", "Diğer"];

  function load() { return App.store.get(KEY, []); }
  function save(l) { App.store.set(KEY, l); }

  async function edit(existing) {
    const list = load();
    const data = await App.ui.formModal(existing ? "Parçacığı düzenle" : "Kod parçacığı ekle", [
      { name: "title", label: "Başlık", required: true },
      { name: "lang", label: "Dil", type: "select", options: LANGS, default: "Python" },
      { name: "code", label: "Kod", type: "textarea", rows: 10, required: true },
      { name: "tags", label: "Etiketler (virgülle)" },
      { name: "note", label: "Açıklama", type: "textarea" },
    ], existing || {});
    if (!data) return;
    if (existing) {
      const item = list.find((s) => s.id === existing.id);
      if (item) Object.assign(item, data);
    } else {
      list.push(Object.assign({ id: App.ui.uid(), added: App.ui.todayISO() }, data));
    }
    save(list);
    App.refresh();
  }

  async function remove(id) {
    if (!(await App.ui.confirm("Parçacık silinsin mi?"))) return;
    save(load().filter((s) => s.id !== id));
    App.refresh();
  }

  const copy = App.ui.copyText;

  /* ---------- Kod çalıştırma ---------- */
  const PYODIDE_VER = "0.26.4";
  let pyLoading = null;
  async function getPyodide(onStatus) {
    if (window._pyodide) return window._pyodide;
    if (pyLoading) return pyLoading;
    pyLoading = (async () => {
      onStatus && onStatus("Pyodide indiriliyor (~6 MB, yalnızca ilk sefer)…");
      if (!window.loadPyodide) {
        await App.ui.loadScript("https://cdn.jsdelivr.net/pyodide/v" + PYODIDE_VER + "/full/pyodide.js");
      }
      onStatus && onStatus("Python başlatılıyor…");
      window._pyodide = await window.loadPyodide({ indexURL: "https://cdn.jsdelivr.net/pyodide/v" + PYODIDE_VER + "/full/" });
      return window._pyodide;
    })();
    return pyLoading;
  }

  async function runPython(code, out) {
    out.textContent = "Hazırlanıyor…";
    let py;
    try { py = await getPyodide((s) => (out.textContent = s)); }
    catch (e) { out.textContent = "Pyodide yüklenemedi (internet gerekir): " + e.message; return; }
    let buf = "";
    py.setStdout({ batched: (s) => (buf += s + "\n") });
    py.setStderr({ batched: (s) => (buf += s + "\n") });
    out.textContent = "Çalışıyor…";
    try {
      const res = await py.runPythonAsync(code);
      if (res !== undefined && res !== null) buf += "\n=> " + String(res);
      out.textContent = buf.trim() || "(çıktı yok)";
    } catch (e) {
      out.textContent = buf + "\n" + String(e.message || e);
    }
  }

  function runJS(code, out) {
    out.textContent = "Çalışıyor…";
    const src = `
      const _log = [];
      const console = { log:(...a)=>_log.push(a.map(String).join(' ')), error:(...a)=>_log.push('HATA: '+a.map(String).join(' ')), warn:(...a)=>_log.push(a.map(String).join(' ')), info:(...a)=>_log.push(a.map(String).join(' ')) };
      self.onmessage = () => {
        try {
          const r = (function(){ ${code} \n})();
          if (r !== undefined) _log.push('=> ' + String(r));
          self.postMessage({ ok:true, out:_log.join('\\n') });
        } catch (e) { self.postMessage({ ok:false, out:_log.join('\\n') + '\\n' + String(e && e.message || e) }); }
      };`;
    let w;
    try { w = new Worker(URL.createObjectURL(new Blob([src], { type: "application/javascript" }))); }
    catch (e) { out.textContent = "Worker oluşturulamadı: " + e.message; return; }
    const to = setTimeout(() => { w.terminate(); out.textContent = "⏱ Zaman aşımı (3 sn)"; }, 3000);
    w.onmessage = (e) => { clearTimeout(to); w.terminate(); out.textContent = (e.data.out || "(çıktı yok)"); };
    w.onerror = (e) => { clearTimeout(to); w.terminate(); out.textContent = "Hata: " + e.message; };
    w.postMessage(1);
  }

  function runnable(langName) {
    return /^python$/i.test(langName) || /^javascript$/i.test(langName);
  }

  let lang = "Hepsi", q = "";

  function render(view) {
    const all = load();
    view.appendChild(App.ui.pageHeader("Kod Parçacıkları", all.length + " parçacık", [
      App.ui.el("button", { class: "btn primary", text: "+ Parçacık ekle", onClick: () => edit(null) }),
    ]));

    if (!all.length) {
      view.appendChild(App.ui.emptyState("Kod parçacığı yok.", "+ Parçacık ekle", () => edit(null)));
      return;
    }

    view.appendChild(App.ui.el("input", { type: "text", value: q, placeholder: "Ara…", style: "margin-bottom:10px", onInput: (e) => { q = e.target.value; draw(); } }));

    const usedLangs = [...new Set(all.map((s) => s.lang))];
    const chips = App.ui.el("div", { class: "chip-row", style: "margin-bottom:14px" });
    ["Hepsi", ...usedLangs].forEach((c) => chips.appendChild(App.ui.el("span", {
      class: "chip" + (lang === c ? " active" : ""), text: c, onClick: () => { lang = c; draw(); },
    })));
    view.appendChild(chips);

    const wrap = App.ui.el("div", {});
    view.appendChild(wrap);

    function draw() {
      document.querySelectorAll(".chip-row .chip").forEach((el) => el.classList.toggle("active", el.textContent === lang));
      App.ui.clear(wrap);
      const ql = q.toLowerCase();
      all
        .filter((s) => lang === "Hepsi" || s.lang === lang)
        .filter((s) => !ql || (s.title + " " + (s.tags || "") + " " + s.code + " " + (s.note || "")).toLowerCase().includes(ql))
        .sort((a, b) => (a.added < b.added ? 1 : -1))
        .forEach((s) => {
          const runOut = App.ui.el("div", { class: "run-out", hidden: true });
          wrap.appendChild(App.ui.el("div", { class: "card snippet" }, [
            App.ui.el("div", { class: "page-head" }, [
              App.ui.el("div", {}, [
                App.ui.el("h3", { text: s.title }),
                App.ui.el("span", { class: "badge purple", text: s.lang }),
                s.note ? App.ui.el("p", { class: "muted", style: "margin-top:6px", text: s.note }) : null,
              ]),
              App.ui.el("div", { class: "page-head-actions" }, [
                runnable(s.lang) ? App.ui.el("button", { class: "btn sm primary", text: "▶ Çalıştır", onClick: () => runSnippet(s, runOut) }) : null,
                App.ui.el("button", { class: "btn sm", text: "📋 Kopyala", onClick: () => copy(s.code) }),
                App.ui.el("button", { class: "btn sm ghost", text: "✎", onClick: () => edit(s) }),
                App.ui.el("button", { class: "btn sm ghost", text: "🗑", onClick: () => remove(s.id) }),
              ]),
            ]),
            App.ui.el("pre", {}, App.ui.el("code", { text: s.code })),
            runOut,
            App.ui.el("div", { class: "chip-row", style: "margin-top:8px" }, (s.tags || "").split(",").map((t) => t.trim()).filter(Boolean).map((t) => App.ui.el("span", { class: "badge", text: t }))),
          ]));
        });
    }
    draw();
  }

  function runSnippet(s, out) {
    if (!out) return;
    out.hidden = false;
    if (/^python$/i.test(s.lang)) runPython(s.code, out);
    else runJS(s.code, out);
  }

  App.registerModule({ id: "snippets", title: "Kod Parçacıkları", icon: "💾", group: "Araçlar", render });
  App.registerCommand({ label: "Yeni kod parçacığı", icon: "💾", group: "Ekle", run: () => edit(null) });
  App.registerSearch((query) =>
    load().filter((s) => (s.title + " " + (s.tags || "") + " " + s.code).toLowerCase().includes(query))
      .slice(0, 5)
      .map((s) => ({ label: s.title + " · " + s.lang, group: "Kod", icon: "💾", run: () => App.ui.copyText(s.code) }))
  );
})();
