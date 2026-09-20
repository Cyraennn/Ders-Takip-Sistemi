/* ============================================================
   Ders Çalışma Sistemi — Çekirdek (core)
   Depolama, arayüz yardımcıları, yönlendirme, modül kaydı,
   komut paleti, klavye kısayolları, ortak dışa aktarım.
   Saf tarayıcı JS — kurulum yok, internet yok. Veri: localStorage.
   ============================================================ */
window.App = (function () {
  "use strict";

  const LS_PREFIX = "bdm:";
  const GROUP_ORDER = ["", "Planlama", "Akademik", "Çalışma", "Araçlar", "Sistem"];

  /* ---------- Depolama ---------- */
  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(LS_PREFIX + key);
        if (raw === null) return fallback === undefined ? null : fallback;
        return JSON.parse(raw);
      } catch (e) {
        console.warn("store.get hata", key, e);
        return fallback === undefined ? null : fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
        if (key[0] !== "_") notifyWrite(key);
        return true;
      } catch (e) {
        console.error("store.set hata", key, e);
        ui.toast("Kaydedilemedi (depolama dolu olabilir)", "error");
        return false;
      }
    },
    remove(key) { localStorage.removeItem(LS_PREFIX + key); },
    keys() {
      const out = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(LS_PREFIX)) out.push(k.slice(LS_PREFIX.length));
      }
      return out;
    },
    exportAll() {
      // "_" önekli anahtarlar cihaza özel ayardır (tema, API anahtarı) — yedeğe dahil edilmez
      const data = {};
      this.keys().forEach((k) => { if (k[0] !== "_") data[k] = this.get(k); });
      return { app: "BÖTE Ders Merkezi", version: 1, exportedAt: new Date().toISOString(), data };
    },
    importAll(payload, mode) {
      if (!payload || typeof payload.data !== "object") throw new Error("Geçersiz yedek dosyası");
      // "_" önekli anahtarlar cihaza özeldir: 'değiştir' onları silmez, yedekten de yazılmaz
      if (mode === "replace") this.keys().forEach((k) => { if (k[0] !== "_") this.remove(k); });
      Object.entries(payload.data).forEach(([k, v]) => { if (k[0] !== "_") this.set(k, v); });
    },
  };

  /* ---------- Yazma kancaları (bulut senkronizasyonu için) ---------- */
  const writeHooks = [];
  function notifyWrite(key) {
    writeHooks.forEach((f) => { try { f(key); } catch (e) { console.warn(e); } });
  }
  function onWrite(fn) { if (typeof fn === "function") writeHooks.push(fn); }

  /* ---------- Küçük yardımcılar ---------- */
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function pad(n) { return String(n).padStart(2, "0"); }
  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function isoOf(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  /* Saat değerini "HH:MM" biçimine getirir (eski kayıtlarda saat bir sayıydı). */
  function hm(v) {
    if (v == null || v === "") return "";
    if (typeof v === "number") return pad(v) + ":00";
    const s = String(v).trim();
    if (/^\d{1,2}$/.test(s)) return pad(Number(s)) + ":00";
    const m = s.match(/^(\d{1,2})[:.](\d{2})/);
    return m ? pad(Number(m[1])) + ":" + m[2] : s;
  }
  /* "HH:MM" → gece yarısından beri geçen dakika (sıralama/karşılaştırma için). */
  function hmMin(v) {
    const m = hm(v).match(/^(\d{2}):(\d{2})$/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
  }
  function fmtDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso.length <= 10 ? iso + "T00:00:00" : iso);
    if (isNaN(d)) return iso;
    return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
  }
  function fmtDateTime(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleString("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  }
  function daysBetween(fromISO, toISO) {
    const a = new Date((fromISO || todayISO()) + "T00:00:00");
    const b = new Date((toISO || todayISO()) + "T00:00:00");
    return Math.round((b - a) / 86400000);
  }
  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /* ---------- DOM oluşturma ---------- */
  function el(tag, props, children) {
    const node = document.createElement(tag);
    if (props) {
      Object.entries(props).forEach(([k, v]) => {
        if (v == null) return;
        if (k === "class") node.className = v;
        else if (k === "html") node.innerHTML = v;
        else if (k === "text") node.textContent = v;
        else if (k === "dataset") Object.assign(node.dataset, v);
        else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k in node && k !== "list" && k !== "form") { try { node[k] = v; } catch (_) { node.setAttribute(k, v); } }
        else node.setAttribute(k, v);
      });
    }
    appendChildren(node, children);
    return node;
  }
  function appendChildren(node, children) {
    if (children == null) return;
    if (Array.isArray(children)) children.forEach((c) => appendChildren(node, c));
    else if (children instanceof Node) node.appendChild(children);
    else node.appendChild(document.createTextNode(String(children)));
  }
  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }

  /* ---------- Ortak dosya işlemleri ---------- */
  function downloadFile(name, content, mime) {
    const blob = new Blob([content], { type: mime || "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function pickFile(accept, onText) {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = accept || "";
    inp.onchange = () => {
      const f = inp.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => onText(r.result, f);
      r.readAsText(f);
    };
    inp.click();
  }
  function copyText(text) {
    const done = () => ui.toast("Kopyalandı", "success");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
    } else fallbackCopy(text, done);
  }
  function fallbackCopy(text, done) {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); done(); } catch (e) { ui.toast("Kopyalanamadı", "error"); }
    ta.remove();
  }

  /* ---------- Arayüz: toast / modal / confirm / formlar ---------- */
  const ui = {
    el, clear, escapeHtml, fmtDate, fmtDateTime, daysBetween, todayISO, isoOf, uid, pad, hm, hmMin,
    downloadFile, pickFile, copyText,

    toast(message, type) {
      const root = document.getElementById("toast-root");
      const t = el("div", { class: "toast " + (type || "info"), text: message });
      root.appendChild(t);
      requestAnimationFrame(() => t.classList.add("show"));
      setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, 3400);
    },

    modal(opts) {
      const root = document.getElementById("modal-root");
      // açık bir modal varsa önce onu kapat (dinleyicisi sızmasın, bekleyen promise'i çözülsün)
      if (root._modalClose) root._modalClose();
      clear(root);
      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        document.removeEventListener("keydown", onKey, true);
        // eylem içinde yeni modal açıldıysa (confirm vb.) onu silme
        if (root._modalClose === close) {
          root._modalClose = null;
          root.classList.remove("open");
          clear(root);
        }
        if (opts.onClose) opts.onClose();
      };
      root._modalClose = close;
      const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } };
      document.addEventListener("keydown", onKey, true);

      const bodyNode = typeof opts.body === "string" ? el("div", { html: opts.body }) : opts.body || el("div");
      const footer = el("div", { class: "modal-foot" });
      (opts.actions || [{ label: "Kapat", kind: "ghost" }]).forEach((a) => {
        footer.appendChild(el("button", {
          type: "button", class: "btn " + (a.kind || "ghost"), text: a.label,
          onClick: () => { const r = a.onClick ? a.onClick() : undefined; if (r !== false) close(); },
        }));
      });
      const box = el("div", { class: "modal-box" + (opts.wide ? " wide" : "") }, [
        el("div", { class: "modal-head" }, [
          el("h3", { text: opts.title || "" }),
          el("button", { type: "button", class: "modal-x", text: "✕", onClick: close }),
        ]),
        el("div", { class: "modal-body" }, bodyNode),
        footer,
      ]);
      root.appendChild(el("div", {
        class: "modal-backdrop",
        onClick: (e) => { if (e.target === e.currentTarget) close(); },
      }, box));
      root.classList.add("open");
      const first = box.querySelector("input,textarea,select,button");
      if (first) setTimeout(() => first.focus(), 50);
      return { close, box };
    },

    confirm(message, title) {
      return new Promise((resolve) => {
        this.modal({
          title: title || "Onay", body: el("p", { text: message }),
          actions: [
            { label: "Vazgeç", kind: "ghost", onClick: () => resolve(false) },
            { label: "Evet", kind: "danger", onClick: () => resolve(true) },
          ],
          onClose: () => resolve(false),
        });
      });
    },

    prompt(opts) {
      return new Promise((resolve) => {
        const input = opts.multiline
          ? el("textarea", { rows: opts.rows || 5, value: opts.value || "", placeholder: opts.placeholder || "" })
          : el("input", { type: "text", value: opts.value || "", placeholder: opts.placeholder || "" });
        const body = el("div", { class: "form-grid" }, [opts.label ? el("label", { text: opts.label }) : null, input]);
        const submit = () => resolve(input.value);
        if (!opts.multiline) input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); submitBtn.click(); } });
        let submitBtn;
        const m = this.modal({
          title: opts.title || "Giriş", body,
          actions: [
            { label: "Vazgeç", kind: "ghost", onClick: () => resolve(null) },
            { label: "Tamam", kind: "primary", onClick: submit },
          ],
          onClose: () => resolve(null),
        });
        submitBtn = m.box.querySelector(".modal-foot .btn.primary");
      });
    },

    formModal(title, fields, initial) {
      return new Promise((resolve) => {
        initial = initial || {};
        const inputs = {};
        const grid = el("div", { class: "form-grid" });
        let dlCount = 0;
        fields.forEach((f) => {
          if (f.type === "heading") { grid.appendChild(el("h4", { class: "form-heading", text: f.label })); return; }
          const id = "f_" + f.name;
          let input;
          const val = initial[f.name] != null ? initial[f.name] : (f.default != null ? f.default : "");
          if (f.type === "select") {
            input = el("select", { id });
            (f.options || []).forEach((o) => {
              const opt = typeof o === "string" ? { value: o, label: o } : o;
              input.appendChild(el("option", { value: opt.value, text: opt.label, selected: String(opt.value) === String(val) }));
            });
          } else if (f.type === "textarea") {
            input = el("textarea", { id, rows: f.rows || 4, value: val, placeholder: f.placeholder || "" });
          } else if (f.type === "checkbox") {
            input = el("input", { id, type: "checkbox", checked: !!val });
          } else {
            input = el("input", { id, type: f.type || "text", value: val, placeholder: f.placeholder || "", step: f.step, min: f.min, max: f.max });
            if (f.list && f.list.length) {
              const listId = "dl_" + (++dlCount) + "_" + id;
              input.setAttribute("list", listId);
              grid.appendChild(el("datalist", { id: listId }, f.list.map((o) => el("option", { value: o }))));
            }
          }
          inputs[f.name] = { input, field: f };
          grid.appendChild(el("div", { class: "form-row" + (f.type === "checkbox" ? " inline" : "") }, [
            el("label", { for: id, text: f.label || f.name }),
            input,
            f.hint ? el("small", { class: "hint", text: f.hint }) : null,
          ]));
        });
        this.modal({
          title, wide: fields.length > 6, body: grid,
          actions: [
            { label: "Vazgeç", kind: "ghost", onClick: () => resolve(null) },
            {
              label: "Kaydet", kind: "primary",
              onClick: () => {
                const out = {};
                let ok = true;
                Object.entries(inputs).forEach(([name, { input, field }]) => {
                  let v = field.type === "checkbox" ? input.checked : input.value.trim();
                  if (field.required && (v === "" || v == null)) { input.classList.add("invalid"); ok = false; }
                  else input.classList.remove("invalid");
                  if (field.type === "number" && v !== "") v = Number(v);
                  out[name] = v;
                });
                if (!ok) { ui.toast("Zorunlu alanları doldurun", "error"); return false; }
                resolve(out);
              },
            },
          ],
          onClose: () => resolve(null),
        });
      });
    },

    emptyState(text, actionLabel, onAction) {
      return el("div", { class: "empty" }, [
        el("div", { class: "empty-emoji", text: "🗂️" }),
        el("p", { text: text }),
        onAction ? el("button", { class: "btn primary", text: actionLabel, type: "button", onClick: onAction }) : null,
      ]);
    },
    pageHeader(title, subtitle, actions) {
      return el("div", { class: "page-head" }, [
        el("div", {}, [el("h2", { text: title }), subtitle ? el("p", { class: "muted", text: subtitle }) : null]),
        el("div", { class: "page-head-actions" }, actions || []),
      ]);
    },
    card(children, cls) { return el("div", { class: "card " + (cls || "") }, children); },

    /* Küçük ve güvenli Markdown → HTML */
    markdown(src) {
      const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const lines = esc(src || "").replace(/\r\n/g, "\n").split("\n");
      let html = "", i = 0;
      const linkFix = (t) => t.replace(/\[([^\]]+)\]\((https?:[^)\s"'<>]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
      const doInline = (t) => linkFix(t
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/\b_([^_]+)_\b/g, "<em>$1</em>")
        .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>"));
      while (i < lines.length) {
        let line = lines[i];
        if (/^```/.test(line)) {
          let code = "";
          i++;
          while (i < lines.length && !/^```/.test(lines[i])) { code += lines[i] + "\n"; i++; }
          i++;
          html += "<pre><code>" + code + "</code></pre>";
          continue;
        }
        if (/^#{1,6}\s/.test(line)) {
          const lvl = line.match(/^#+/)[0].length;
          html += `<h${lvl}>` + doInline(line.replace(/^#+\s/, "")) + `</h${lvl}>`;
          i++; continue;
        }
        if (/^\s*([-*])\s+/.test(line)) {
          html += "<ul>";
          while (i < lines.length && /^\s*([-*])\s+/.test(lines[i])) { html += "<li>" + doInline(lines[i].replace(/^\s*[-*]\s+/, "")) + "</li>"; i++; }
          html += "</ul>"; continue;
        }
        if (/^\s*\d+\.\s+/.test(line)) {
          html += "<ol>";
          while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { html += "<li>" + doInline(lines[i].replace(/^\s*\d+\.\s+/, "")) + "</li>"; i++; }
          html += "</ol>"; continue;
        }
        if (/^>\s?/.test(line)) {
          let q = "";
          while (i < lines.length && /^>\s?/.test(lines[i])) { q += lines[i].replace(/^>\s?/, "") + " "; i++; }
          html += "<blockquote>" + doInline(q) + "</blockquote>"; continue;
        }
        if (/^(-{3,}|\*{3,})$/.test(line.trim())) { html += "<hr>"; i++; continue; }
        if (line.trim() === "") { i++; continue; }
        let p = line;
        i++;
        while (i < lines.length && lines[i].trim() !== "" && !/^(#{1,6}\s|>\s?|```|\s*[-*]\s+|\s*\d+\.\s+)/.test(lines[i])) { p += " " + lines[i]; i++; }
        html += "<p>" + doInline(p) + "</p>";
      }
      return html;
    },

    /* Harici script'i bir kez yükle (KaTeX, Pyodide…) */
    loadScript(src) {
      window.__loadedScripts = window.__loadedScripts || {};
      if (window.__loadedScripts[src]) return window.__loadedScripts[src];
      const p = new Promise((resolve, reject) => {
        const existing = [...document.scripts].find((s) => s.src === src);
        if (existing && existing.dataset.loaded) return resolve();
        const s = document.createElement("script");
        s.src = src;
        s.onload = () => { s.dataset.loaded = "1"; resolve(); };
        s.onerror = () => reject(new Error("Yüklenemedi: " + src));
        document.head.appendChild(s);
      });
      window.__loadedScripts[src] = p;
      return p;
    },

    /* DOM düğümündeki $…$, $$…$$, \(…\), \[…\] ifadelerini KaTeX ile render et */
    mathify(root) {
      if (!root || !window.katex) return;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(n) {
          if (!n.nodeValue || !/[$\\]/.test(n.nodeValue)) return NodeFilter.FILTER_REJECT;
          let p = n.parentNode;
          while (p && p !== root) {
            const tag = (p.tagName || "").toLowerCase();
            if (tag === "code" || tag === "pre" || tag === "script" || tag === "style" || p.classList.contains("katex")) return NodeFilter.FILTER_REJECT;
            p = p.parentNode;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      });
      const targets = [];
      let t;
      while ((t = walker.nextNode())) targets.push(t);
      const re = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|(?<![\d$])\$(?!\s)([^$\n]+?)(?<!\s)\$(?![\d$])/g;
      targets.forEach((node) => {
        const text = node.nodeValue;
        re.lastIndex = 0;
        if (!re.test(text)) return;
        re.lastIndex = 0;
        const frag = document.createDocumentFragment();
        let last = 0, m;
        while ((m = re.exec(text))) {
          if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
          const display = m[1] != null || m[2] != null;
          const tex = m[1] ?? m[2] ?? m[3] ?? m[4] ?? "";
          const span = document.createElement("span");
          try {
            span.innerHTML = window.katex.renderToString(tex, { displayMode: display, throwOnError: false, output: "html" });
          } catch (e) {
            span.textContent = m[0];
          }
          frag.appendChild(span);
          last = m.index + m[0].length;
        }
        if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
        node.parentNode.replaceChild(frag, node);
      });
    },

    /* Markdown + matematik → container.innerHTML */
    renderRich(container, src) {
      container.innerHTML = this.markdown(src);
      this.mathify(container);
      return container;
    },

    stat(label, value, cls, sub, onClick) {
      return el("div", { class: "stat " + (cls || ""), style: onClick ? "cursor:pointer" : null, onClick: onClick || null }, [
        el("div", { class: "stat-label", text: label }),
        el("div", { class: "stat-value", text: value }),
        sub ? el("div", { class: "stat-sub", text: sub }) : null,
      ]);
    },
    badge(text, cls) { return el("span", { class: "badge " + (cls || ""), text }); },

    /* Basit SVG çizgi/sütun grafiği */
    barChart(data, opts) {
      opts = opts || {};
      const w = opts.width || 520, h = opts.height || 140, pad = 22;
      const max = Math.max(opts.max || 0, ...data.map((d) => d.value), 1);
      const bw = (w - pad * 2) / data.length;
      const svg = `<svg viewBox="0 0 ${w} ${h}" class="chart" preserveAspectRatio="none">` +
        data.map((d, i) => {
          const bh = ((h - pad - 14) * d.value) / max;
          const x = pad + i * bw + bw * 0.15;
          const y = h - 14 - bh;
          return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(bw * 0.7).toFixed(1)}" height="${Math.max(1, bh).toFixed(1)}" rx="2" class="bar"><title>${escapeHtml(d.label)}: ${escapeHtml(d.value)}</title></rect>` +
            `<text x="${(pad + i * bw + bw / 2).toFixed(1)}" y="${h - 3}" text-anchor="middle" class="chart-x">${escapeHtml(d.short || d.label)}</text>`;
        }).join("") + `</svg>`;
      return el("div", { class: "chart-wrap", html: svg });
    },
    lineChart(points, opts) {
      opts = opts || {};
      const w = opts.width || 520, h = opts.height || 150, pad = 26;
      if (!points.length) return el("div", { class: "muted", text: "Veri yok" });
      const xs = points.map((_, i) => i);
      const ys = points.map((p) => p.value);
      const minY = opts.min != null ? opts.min : Math.min(...ys);
      const maxY = opts.max != null ? opts.max : Math.max(...ys);
      const rangeY = maxY - minY || 1;
      const px = (i) => pad + (i / Math.max(1, xs.length - 1)) * (w - pad * 2);
      const py = (v) => h - pad - ((v - minY) / rangeY) * (h - pad * 2);
      const d = points.map((p, i) => (i ? "L" : "M") + px(i).toFixed(1) + " " + py(p.value).toFixed(1)).join(" ");
      const dots = points.map((p, i) => `<circle cx="${px(i).toFixed(1)}" cy="${py(p.value).toFixed(1)}" r="3" class="dot"><title>${escapeHtml(p.label)}: ${escapeHtml(p.value)}</title></circle>`).join("");
      const labels = points.map((p, i) => `<text x="${px(i).toFixed(1)}" y="${h - 6}" text-anchor="middle" class="chart-x">${escapeHtml(p.short || p.label)}</text>`).join("");
      return el("div", { class: "chart-wrap", html: `<svg viewBox="0 0 ${w} ${h}" class="chart"><path d="${d}" class="line" fill="none"/>${dots}${labels}</svg>` });
    },
  };

  /* ---------- Modül kaydı + yönlendirme ---------- */
  const modules = [];
  const commands = [];
  const searchers = [];
  let currentModule = null;

  function registerModule(mod) {
    if (!mod || !mod.id || typeof mod.render !== "function") { console.error("Geçersiz modül", mod); return; }
    mod.group = mod.group || "";
    modules.push(mod);
    commands.push({ label: "Git: " + mod.title, icon: mod.icon, group: "Sayfa", run: () => go(mod.id) });
  }
  function registerCommand(cmd) { commands.push(cmd); }
  function registerSearch(fn) { searchers.push(fn); }

  function buildNav() {
    const nav = document.getElementById("nav");
    clear(nav);
    GROUP_ORDER.forEach((g) => {
      const items = modules.filter((m) => (m.group || "") === g);
      if (!items.length) return;
      if (g) nav.appendChild(el("div", { class: "nav-group", text: g }));
      items.forEach((m) => {
        nav.appendChild(el("a", { href: "#/" + m.id, class: "nav-link", dataset: { id: m.id } }, [
          el("span", { class: "nav-icon", text: m.icon || "•" }),
          el("span", { class: "nav-label", text: m.title }),
        ]));
      });
    });
  }
  function setActiveNav(id) {
    document.querySelectorAll(".nav-link").forEach((a) => a.classList.toggle("active", a.dataset.id === id));
  }

  function renderRoute() {
    const view = document.getElementById("view");
    if (App.auth && ((App.auth.required && App.auth.required()) || App.auth._forceGate) && !App.auth.user) {
      document.body.classList.add("auth-gate");
      clear(view);
      document.getElementById("page-title").textContent = "Giriş";
      clear(document.getElementById("topbar-actions"));
      clear(document.getElementById("topbar-user"));
      try { App.auth.renderGate(view); } catch (e) { console.error(e); }
      return;
    }
    document.body.classList.remove("auth-gate");
    const hash = location.hash.replace(/^#\/?/, "");
    const id = hash || (modules[0] && modules[0].id);
    const mod = modules.find((m) => m.id === id) || modules[0];
    if (!mod) return;
    if (currentModule && typeof currentModule.unmount === "function") {
      try { currentModule.unmount(); } catch (e) { console.warn(e); }
    }
    currentModule = mod;
    clear(view);
    document.getElementById("page-title").textContent = mod.title;
    clear(document.getElementById("topbar-actions"));
    const topbarUser = document.getElementById("topbar-user");
    if (topbarUser && App.auth && App.auth.renderTopbarUser) App.auth.renderTopbarUser(topbarUser);
    setActiveNav(mod.id);
    document.body.classList.remove("nav-open");
    view.classList.remove("fade-in");
    void view.offsetWidth;
    view.classList.add("fade-in");
    try {
      mod.render(view, { store, ui });
    } catch (e) {
      console.error(e);
      view.appendChild(el("div", { class: "card" }, [
        el("h3", { text: "Bu modül yüklenirken hata oluştu" }),
        el("pre", { text: String((e && e.stack) || e) }),
      ]));
    }
    view.scrollTop = 0;
    if (window.innerWidth > 860) window.scrollTo(0, 0);
  }
  function go(id) { location.hash = "#/" + id; }
  function refresh() { renderRoute(); }

  /* ---------- Komut paleti ---------- */
  function openPalette() {
    const input = el("input", { type: "text", class: "palette-input", placeholder: "Komut ara veya bir şey yaz… (sayfalar, ödevler, notlar, kod)" });
    const listEl = el("div", { class: "palette-list" });
    let results = [], sel = 0;

    const run = (r) => { m.close(); setTimeout(() => r.run(), 0); };
    const draw = () => {
      const q = input.value.trim().toLowerCase();
      results = [];
      commands.forEach((c) => {
        const hay = (c.label + " " + (c.group || "")).toLowerCase();
        if (!q || hay.includes(q)) results.push(c);
      });
      if (q.length >= 2) searchers.forEach((fn) => { try { (fn(q) || []).forEach((r) => results.push(r)); } catch (e) {} });
      results = results.slice(0, 40);
      if (sel >= results.length) sel = 0;
      clear(listEl);
      if (!results.length) { listEl.appendChild(el("div", { class: "palette-empty", text: "Sonuç yok" })); return; }
      results.forEach((r, i) => {
        listEl.appendChild(el("div", {
          class: "palette-item" + (i === sel ? " sel" : ""),
          onClick: () => run(r),
          onMouseenter: () => { sel = i; [...listEl.children].forEach((c, j) => c.classList.toggle("sel", j === i)); },
        }, [
          el("span", { class: "palette-icon", text: r.icon || "›" }),
          el("span", { class: "palette-label", text: r.label }),
          r.group ? el("span", { class: "palette-group", text: r.group }) : null,
        ]));
      });
    };
    input.addEventListener("input", () => { sel = 0; draw(); });
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(results.length - 1, sel + 1); draw(); scrollSel(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(0, sel - 1); draw(); scrollSel(); }
      else if (e.key === "Enter") { e.preventDefault(); if (results[sel]) run(results[sel]); }
    });
    const scrollSel = () => { const s = listEl.querySelector(".sel"); if (s) s.scrollIntoView({ block: "nearest" }); };

    const m = ui.modal({ title: "Komut Paleti", wide: true, body: el("div", { class: "palette" }, [input, listEl]), actions: [] });
    draw();
    setTimeout(() => input.focus(), 60);
  }

  function showShortcuts() {
    ui.modal({
      title: "Klavye kısayolları",
      body: el("div", { class: "list" }, [
        ["Ctrl / ⌘ + K", "Komut paleti"],
        ["G ardından H", "Panele git"],
        ["?", "Bu yardım"],
        ["Esc", "Pencereyi kapat"],
      ].map(([k, d]) => el("div", { class: "list-item" }, [
        el("kbd", { text: k }), el("span", { class: "li-main", text: d }),
      ]))),
    });
  }

  let gPending = false;
  function initKeys() {
    document.addEventListener("keydown", (e) => {
      if (!e.key) return; // tarayıcı otomatik doldurma bazen key'siz keydown yollar
      const tag = (e.target.tagName || "").toLowerCase();
      const typing = tag === "input" || tag === "textarea" || tag === "select" || e.target.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openPalette(); return; }
      if (typing) return;
      if (e.key === "?") { e.preventDefault(); showShortcuts(); return; }
      if (e.key.toLowerCase() === "g") { gPending = true; setTimeout(() => (gPending = false), 800); return; }
      if (gPending) {
        gPending = false;
        const map = { h: "dashboard", d: "dashboard", t: "tasks", s: "schedule", n: "notes", p: "pomodoro", c: "calendar", g: "gpa", f: "flashcards" };
        if (map[e.key.toLowerCase()]) { go(map[e.key.toLowerCase()]); }
      }
    });
  }

  /* ---------- Tema ---------- */
  function applyTheme(t) { document.documentElement.dataset.theme = t; store.set("_theme", t); }
  function initTheme() {
    applyTheme(store.get("_theme") || "dark");
    document.getElementById("themeToggle").addEventListener("click", () => {
      applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
    });
  }

  /* ---------- PWA / çevrimdışı ---------- */
  function initPWA() {
    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }
  }

  /* ---------- Bildirimler ---------- */
  function notifPrefs() {
    return Object.assign({ enabled: false, today: true, dayBefore: true, pomodoro: true }, store.get("_notif_prefs", {}));
  }
  function canNotify() {
    return typeof Notification !== "undefined" && Notification.permission === "granted" && notifPrefs().enabled;
  }
  function notify(title, body, tag) {
    if (canNotify()) {
      try { new Notification(title, { body: body || "", tag: tag || undefined, icon: "assets/icon.svg" }); return true; }
      catch (e) { /* düşerek toast */ }
    }
    ui.toast((title ? title + " — " : "") + (body || ""), "info");
    return false;
  }

  function runReminders() {
    const prefs = notifPrefs();
    const t = todayISO();
    const tomorrow = isoOf(new Date(Date.now() + 86400000));
    const state = store.get("_notif_state", {}) || {};
    // eski günleri buda
    Object.keys(state).forEach((k) => { if (k < t) delete state[k]; });
    state[t] = state[t] || [];

    const fire = (key, title, body) => {
      if (state[t].includes(key)) return;
      state[t].push(key);
      notify(title, body, key);
    };

    const exams = store.get("exams", []) || [];
    const tasks = store.get("tasks", []) || [];

    if (prefs.today) {
      exams.filter((e) => !e.done && e.date === t).forEach((e) => fire("exam:" + e.id, "Bugün sınav", e.type + " — " + e.course + (e.time ? " · " + e.time : "")));
      tasks.filter((x) => x.status !== "Tamamlandı" && x.due === t).forEach((x) => fire("task:" + x.id, "Bugün teslim", x.title + (x.course ? " · " + x.course : "")));
    }
    if (prefs.dayBefore) {
      exams.filter((e) => !e.done && e.date === tomorrow).forEach((e) => fire("exam1:" + e.id, "Yarın sınav", e.type + " — " + e.course));
      tasks.filter((x) => x.status !== "Tamamlandı" && x.due === tomorrow).forEach((x) => fire("task1:" + x.id, "Yarın teslim", x.title));
    }

    // izin yoksa yine de tek bir özet toast at (eski davranış)
    if (!canNotify()) {
      const bits = [];
      const dt = tasks.filter((x) => x.status !== "Tamamlandı" && x.due === t).length;
      const de = exams.filter((x) => !x.done && x.date === t).length;
      if (dt) bits.push(dt + " ödev bugün teslim");
      if (de) bits.push(de + " sınav/teslim bugün");
      if (bits.length && !state[t].includes("_toast")) { state[t].push("_toast"); setTimeout(() => ui.toast("📌 " + bits.join(" · "), "info"), 800); }
    }

    store.set("_notif_state", state);
  }

  async function requestNotifyPermission() {
    if (typeof Notification === "undefined") { ui.toast("Bu tarayıcı bildirim desteklemiyor", "error"); return false; }
    let perm = Notification.permission;
    if (perm === "default") perm = await Notification.requestPermission();
    if (perm === "granted") {
      const p = notifPrefs(); p.enabled = true; store.set("_notif_prefs", p);
      ui.toast("Bildirimler açık", "success");
      runReminders();
      return true;
    }
    ui.toast("Bildirim izni verilmedi", "error");
    return false;
  }

  /* ---------- Ortak veri yardımcıları ---------- */
  const data = {
    courseNames() {
      const set = new Set();
      (store.get("schedule", []) || []).forEach((e) => e.name && set.add(e.name));
      (store.get("grades_courses", []) || []).forEach((c) => c.name && set.add(c.name));
      (store.get("attendance", []) || []).forEach((c) => c.course && set.add(c.course));
      (store.get("tasks", []) || []).forEach((c) => c.course && set.add(c.course));
      (store.get("exams", []) || []).forEach((c) => c.course && set.add(c.course));
      return [...set].filter(Boolean).sort((a, b) => a.localeCompare(b, "tr"));
    },
  };

  /* ---------- Başlatma ---------- */
  async function start() {
    initTheme();
    buildNav();
    initKeys();
    initPWA();
    document.getElementById("menuToggle").addEventListener("click", () => document.body.classList.toggle("nav-open"));
    const pb = document.getElementById("paletteBtn");
    if (pb) pb.addEventListener("click", openPalette);
    window.addEventListener("hashchange", renderRoute);
    if (!location.hash) location.hash = "#/" + modules[0].id;

    renderRoute(); // hızlı ilk çizim (gate veya yerel uygulama)
    if (App.auth && App.auth.init) {
      try { await App.auth.init(); } catch (e) { console.warn("auth init", e); }
      renderRoute();
    }
    runReminders();
    setInterval(runReminders, 30 * 60 * 1000);
  }

  return {
    store, ui, data, onWrite,
    registerModule, registerCommand, registerSearch,
    start, go, refresh, openPalette,
    notify, runReminders, requestNotifyPermission,
    notifPrefs: () => notifPrefs(),
    setNotifPrefs: (p) => store.set("_notif_prefs", Object.assign(notifPrefs(), p)),
    setTheme: applyTheme,
    getTheme: () => document.documentElement.dataset.theme,
    get modules() { return modules.slice(); },
  };
})();
