/* Araç Kutusu — BÖTE / bilgisayar bilimleri yardımcı araçları */
(function () {
  const TABS = [
    ["base", "Sayı tabanı"],
    ["bytes", "Bit / Byte"],
    ["color", "Renk & kontrast"],
    ["truth", "Doğruluk tablosu"],
    ["text", "Metin araçları"],
    ["hash", "Hash"],
    ["regex", "Regex"],
    ["json", "JSON"],
    ["diff", "Diff"],
    ["time", "Zaman"],
  ];
  let tab = "base";

  function render(view) {
    view.appendChild(App.ui.pageHeader("Araç Kutusu", "Derslerde ihtiyaç duyacağın küçük hesaplayıcılar", []));
    const chips = App.ui.el("div", { class: "chip-row", style: "margin-bottom:16px" });
    TABS.forEach(([id, label]) => chips.appendChild(App.ui.el("span", {
      class: "chip" + (tab === id ? " active" : ""), text: label, onClick: () => { tab = id; App.refresh(); },
    })));
    view.appendChild(chips);
    ({ base, bytes, color, truth, text: textTool, hash, regex: regexTool, json: jsonTool, diff: diffTool, time: timeTool }[tab] || base)(view);
  }

  function row(label, node) {
    return App.ui.el("div", { class: "form-row", style: "margin-bottom:12px" }, [App.ui.el("label", { text: label }), node]);
  }

  /* ---- Sayı tabanı ---- */
  function base(view) {
    const card = App.ui.el("div", {});
    const inp = App.ui.el("input", { type: "text", placeholder: "sayı", value: "255" });
    const from = sel([2, 8, 10, 16].map((b) => ({ value: b, label: "Taban " + b })), 10);
    const out = App.ui.el("div", { class: "tool-out" });
    const calc = () => {
      const v = parseInt(inp.value.trim(), Number(from.value));
      if (isNaN(v)) { out.textContent = "Geçersiz sayı"; return; }
      out.textContent =
        "2  (ikili)   : " + v.toString(2) +
        "\n8  (sekizli) : " + v.toString(8) +
        "\n10 (onlu)    : " + v.toString(10) +
        "\n16 (onaltılı): " + v.toString(16).toUpperCase() +
        "\nkarakter     : " + (v >= 32 && v < 1114112 ? String.fromCodePoint(v) : "—");
    };
    inp.addEventListener("input", calc);
    from.addEventListener("change", calc);
    card.appendChild(row("Sayı", inp));
    card.appendChild(row("Girdi tabanı", from));
    card.appendChild(out);
    view.appendChild(App.ui.card(card));
    calc();
  }

  /* ---- Bit / Byte ---- */
  function bytes(view) {
    const card = App.ui.el("div", {});
    const inp = App.ui.el("input", { type: "number", value: "1", step: "any" });
    const unit = sel(["bit", "byte", "KB", "MB", "GB", "TB"].map((u) => ({ value: u, label: u })), "MB");
    const out = App.ui.el("div", { class: "tool-out" });
    const F = { bit: 1 / 8, byte: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4 };
    const calc = () => {
      const b = (Number(inp.value) || 0) * F[unit.value];
      out.textContent = Object.entries(F).map(([u, f]) => u.padEnd(4) + ": " + (b / f).toLocaleString("tr-TR", { maximumFractionDigits: 6 })).join("\n") +
        "\n(1 KB = 1024 byte kabul edilir)";
    };
    inp.addEventListener("input", calc);
    unit.addEventListener("change", calc);
    card.appendChild(row("Değer", inp));
    card.appendChild(row("Birim", unit));
    card.appendChild(out);
    view.appendChild(App.ui.card(card));
    calc();
  }

  /* ---- Renk & kontrast ---- */
  function color(view) {
    const card = App.ui.el("div", {});
    const inp = App.ui.el("input", { type: "text", value: "#5b8cff" });
    const picker = App.ui.el("input", { type: "color", value: "#5b8cff", style: "width:60px;padding:2px;height:38px" });
    const sw = App.ui.el("div", { class: "swatch" });
    const out = App.ui.el("div", { class: "tool-out" });
    const parse = (s) => {
      s = s.trim();
      let m = s.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
      if (m) {
        let h = m[1];
        if (h.length === 3) h = h.split("").map((c) => c + c).join("");
        return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
      }
      m = s.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
      if (m) return [+m[1], +m[2], +m[3]];
      return null;
    };
    const toHex = (r, g, b) => "#" + [r, g, b].map((x) => App.ui.pad(Math.round(x).toString(16))).join("").toUpperCase();
    const lum = (r, g, b) => {
      const a = [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
      return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
    };
    const rgbToHsl = (r, g, b) => {
      r /= 255; g /= 255; b /= 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      let h, s, l = (max + min) / 2;
      if (max === min) { h = s = 0; }
      else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
        h /= 6;
      }
      return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
    };
    const calc = () => {
      const rgb = parse(inp.value);
      if (!rgb) { out.textContent = "Geçersiz renk (#hex veya rgb)"; return; }
      const [r, g, b] = rgb;
      sw.style.background = toHex(r, g, b);
      const L = lum(r, g, b);
      const cw = (Math.max(L, 1) + 0.05) / (Math.min(L, 1) + 0.05);
      const cWhite = (1 + 0.05) / (L + 0.05);
      const cBlack = (L + 0.05) / (0 + 0.05);
      const [h, s, l] = rgbToHsl(r, g, b);
      out.textContent =
        "HEX : " + toHex(r, g, b) +
        "\nRGB : rgb(" + r + ", " + g + ", " + b + ")" +
        "\nHSL : hsl(" + h + ", " + s + "%, " + l + "%)" +
        "\n\nBeyaz zemine kontrast : " + cWhite.toFixed(2) + ":1  " + wcag(cWhite) +
        "\nSiyah zemine kontrast : " + cBlack.toFixed(2) + ":1  " + wcag(cBlack);
      if (/^#[0-9a-f]{6}$/i.test(toHex(r, g, b))) picker.value = toHex(r, g, b).toLowerCase();
    };
    const wcag = (c) => (c >= 7 ? "AAA ✓" : c >= 4.5 ? "AA ✓" : c >= 3 ? "AA (büyük yazı)" : "✗ yetersiz");
    inp.addEventListener("input", calc);
    picker.addEventListener("input", () => { inp.value = picker.value; calc(); });
    card.appendChild(row("Renk", App.ui.el("div", { style: "display:flex;gap:8px" }, [inp, picker])));
    card.appendChild(App.ui.el("div", { style: "margin:10px 0" }, sw));
    card.appendChild(out);
    view.appendChild(App.ui.card(card));
    calc();
  }

  /* ---- Doğruluk tablosu ---- */
  function truth(view) {
    const card = App.ui.el("div", {});
    const inp = App.ui.el("input", { type: "text", value: "A AND (B OR NOT C)", placeholder: "örn: A AND B, (A OR B) XOR C" });
    const out = App.ui.el("div", {});
    const calc = () => {
      App.ui.clear(out);
      const raw = inp.value.trim();
      if (!raw) return;
      if (!/^[A-Za-z()&|!^~ \t]+$/.test(raw)) {
        out.appendChild(App.ui.el("p", { class: "muted", text: "Yalnızca A-Z değişkenleri ve AND OR NOT XOR ( ) & | ! ^ kullan." }));
        return;
      }
      const words = raw.toUpperCase().match(/[A-Z]+/g) || [];
      const ops = new Set(["AND", "OR", "NOT", "XOR"]);
      const vars = [...new Set(words.filter((w) => !ops.has(w)))].sort();
      if (!vars.length) { out.appendChild(App.ui.el("p", { class: "muted", text: "En az bir değişken girin (A, B…)." })); return; }
      if (vars.some((v) => v.length !== 1)) { out.appendChild(App.ui.el("p", { class: "muted", text: "Değişkenler tek harf olmalı (A, B, C…)." })); return; }
      if (vars.length > 4) { out.appendChild(App.ui.el("p", { class: "muted", text: "En fazla 4 değişken." })); return; }
      let js = raw
        .replace(/\bAND\b|&&?/gi, " && ")
        .replace(/\bOR\b|\|\|?/gi, " || ")
        .replace(/\bXOR\b|\^/gi, " ^ ")
        .replace(/\bNOT\b|~|!/gi, " ! ");
      vars.forEach((v) => { js = js.replace(new RegExp("\\b" + v + "\\b", "g"), "v." + v); });
      let fn;
      try { fn = new Function("v", "return !!(" + js + ");"); fn({ A: true, B: true, C: true, D: true }); }
      catch (e) { out.appendChild(App.ui.el("p", { class: "muted", text: "İfade çözümlenemedi." })); return; }
      const rows = [];
      const n = vars.length;
      for (let i = 0; i < (1 << n); i++) {
        const env = {};
        vars.forEach((v, j) => { env[v] = !!(i & (1 << (n - 1 - j))); });
        let r;
        try { r = fn(env); } catch (e) { r = "?"; }
        rows.push([...vars.map((v) => (env[v] ? "1" : "0")), r ? "1" : "0"]);
      }
      const table = App.ui.el("table", { class: "data truth-table" }, [
        App.ui.el("thead", {}, App.ui.el("tr", {}, [...vars, "Sonuç"].map((h) => App.ui.el("th", { text: h })))),
        App.ui.el("tbody", {}, rows.map((r) => App.ui.el("tr", {}, r.map((c, i) =>
          App.ui.el("td", { text: c, style: i === r.length - 1 ? "font-weight:700;color:var(--" + (c === "1" ? "green" : "red") + ")" : null })
        )))),
      ]);
      out.appendChild(App.ui.el("div", { class: "table-wrap" }, table));
    };
    inp.addEventListener("input", calc);
    card.appendChild(row("Mantıksal ifade", inp));
    card.appendChild(out);
    view.appendChild(App.ui.card(card));
    calc();
  }

  /* ---- Metin araçları ---- */
  function textTool(view) {
    const card = App.ui.el("div", {});
    const ta = App.ui.el("textarea", { rows: 6, placeholder: "Metni buraya yaz…" });
    const stats = App.ui.el("p", { class: "muted" });
    const out = App.ui.el("textarea", { rows: 4, readonly: true });
    const upd = () => {
      const t = ta.value;
      const words = (t.trim().match(/\S+/g) || []).length;
      stats.textContent = `${t.length} karakter · ${words} kelime · ${t ? t.split(/\n/).length : 0} satır`;
    };
    ta.addEventListener("input", upd);
    const apply = (fn) => { out.value = fn(ta.value); };
    const slug = (s) => s.toLowerCase()
      .replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const title = (s) => s.replace(/\S+/g, (w) => w[0].toLocaleUpperCase("tr") + w.slice(1).toLocaleLowerCase("tr"));
    card.appendChild(row("Metin", ta));
    card.appendChild(stats);
    card.appendChild(App.ui.el("div", { class: "chip-row", style: "margin:6px 0 12px" }, [
      ["BÜYÜK", (s) => s.toLocaleUpperCase("tr")], ["küçük", (s) => s.toLocaleLowerCase("tr")],
      ["Başlık", title], ["slug", slug], ["ters", (s) => s.split("").reverse().join("")],
      ["Base64 →", (s) => { try { return btoa(unescape(encodeURIComponent(s))); } catch (e) { return "hata"; } }],
      ["← Base64", (s) => { try { return decodeURIComponent(escape(atob(s.trim()))); } catch (e) { return "hata"; } }],
      ["boşlukları temizle", (s) => s.replace(/\s+/g, " ").trim()],
    ].map(([label, fn]) => App.ui.el("span", { class: "chip", text: label, onClick: () => apply(fn) }))));
    card.appendChild(row("Sonuç", out));
    card.appendChild(App.ui.el("button", { class: "btn sm", text: "📋 Sonucu kopyala", onClick: () => App.ui.copyText(out.value) }));
    view.appendChild(App.ui.card(card));
    upd();
  }

  /* ---- Hash ---- */
  function hash(view) {
    const card = App.ui.el("div", {});
    const ta = App.ui.el("textarea", { rows: 4, placeholder: "Metin…" });
    const out = App.ui.el("div", { class: "tool-out", text: "SHA-256 buraya gelir" });
    const calc = async () => {
      if (!ta.value) { out.textContent = "—"; return; }
      if (!(crypto && crypto.subtle)) { out.textContent = "Bu tarayıcıda kullanılamıyor (güvenli bağlam gerekir)"; return; }
      try {
        const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ta.value));
        out.textContent = "SHA-256:\n" + [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
      } catch (e) { out.textContent = "Hesaplanamadı"; }
    };
    ta.addEventListener("input", calc);
    card.appendChild(row("Girdi", ta));
    card.appendChild(out);
    card.appendChild(App.ui.el("small", { class: "hint", text: "Basit SHA-1/MD5 güvensizdir; burada yalnızca SHA-256 var." }));
    view.appendChild(App.ui.card(card));
  }

  /* ---- Regex ---- */
  function regexTool(view) {
    const card = App.ui.el("div", {});
    const pat = App.ui.el("input", { type: "text", value: "\\b\\w+@\\w+\\.\\w+\\b", placeholder: "desen" });
    const flags = ["g", "i", "m", "s", "u"].map((f) => {
      const cb = App.ui.el("input", { type: "checkbox", checked: f === "g" });
      cb._f = f;
      return App.ui.el("label", { style: "display:inline-flex;gap:4px;margin-right:10px" }, [cb, App.ui.el("span", { text: f })]);
    });
    const test = App.ui.el("textarea", { rows: 5, value: "iletişim: ali@ornek.com, veli@site.net" });
    const out = App.ui.el("div", {});
    const calc = () => {
      App.ui.clear(out);
      const fl = flags.map((l) => l.firstChild).filter((c) => c.checked).map((c) => c._f).join("");
      let re;
      try { re = new RegExp(pat.value, fl); } catch (e) { out.appendChild(App.ui.el("p", { class: "muted", text: "Geçersiz desen: " + e.message })); return; }
      const s = test.value;
      const matches = [];
      if (fl.includes("g")) { let m; const rr = new RegExp(re.source, fl); while ((m = rr.exec(s))) { matches.push(m); if (m.index === rr.lastIndex) rr.lastIndex++; } }
      else { const m = re.exec(s); if (m) matches.push(m); }
      // vurgula
      let html = "", last = 0;
      matches.forEach((m) => {
        html += App.ui.escapeHtml(s.slice(last, m.index)) + '<mark>' + App.ui.escapeHtml(m[0]) + '</mark>';
        last = m.index + m[0].length;
      });
      html += App.ui.escapeHtml(s.slice(last));
      out.appendChild(App.ui.el("div", { class: "tool-out", html: html || "(eşleşme yok)" }));
      out.appendChild(App.ui.el("p", { class: "muted", text: matches.length + " eşleşme" }));
      if (matches[0] && matches[0].length > 1) {
        out.appendChild(App.ui.el("div", { class: "tool-out", text: "İlk eşleşmenin grupları:\n" + matches[0].slice(1).map((g, i) => (i + 1) + ": " + g).join("\n") }));
      }
    };
    [pat, test].forEach((n) => n.addEventListener("input", calc));
    flags.forEach((l) => l.firstChild.addEventListener("change", calc));
    card.appendChild(row("Desen", pat));
    card.appendChild(App.ui.el("div", { style: "margin-bottom:12px" }, flags));
    card.appendChild(row("Test metni", test));
    card.appendChild(out);
    view.appendChild(App.ui.card(card));
    calc();
  }

  /* ---- JSON ---- */
  function jsonTool(view) {
    const card = App.ui.el("div", {});
    const ta = App.ui.el("textarea", { rows: 8, value: '{"ad":"Ali","notlar":[85,90],"gecti":true}' });
    const out = App.ui.el("div", { class: "tool-out" });
    const parse = () => { try { return { ok: true, v: JSON.parse(ta.value) }; } catch (e) { return { ok: false, e: e.message }; } };
    const show = (fmt) => {
      const r = parse();
      if (!r.ok) { out.textContent = "❌ " + r.e; return; }
      out.textContent = fmt === "min" ? JSON.stringify(r.v) : JSON.stringify(r.v, null, 2);
    };
    card.appendChild(row("JSON", ta));
    card.appendChild(App.ui.el("div", { class: "chip-row", style: "margin:6px 0 12px" }, [
      App.ui.el("span", { class: "chip", text: "Biçimlendir", onClick: () => show("pretty") }),
      App.ui.el("span", { class: "chip", text: "Küçült", onClick: () => show("min") }),
      App.ui.el("span", { class: "chip", text: "Doğrula", onClick: () => { const r = parse(); out.textContent = r.ok ? "✅ Geçerli JSON" : "❌ " + r.e; } }),
      App.ui.el("span", { class: "chip", text: "Sonucu kopyala", onClick: () => App.ui.copyText(out.textContent) }),
    ]));
    card.appendChild(out);
    view.appendChild(App.ui.card(card));
    show("pretty");
  }

  /* ---- Diff ---- */
  function diffTool(view) {
    const card = App.ui.el("div", {});
    const a = App.ui.el("textarea", { rows: 8, value: "satır 1\nsatır 2\nsatır 3" });
    const b = App.ui.el("textarea", { rows: 8, value: "satır 1\nsatır 2 değişti\nsatır 3\nsatır 4" });
    const out = App.ui.el("div", { class: "tool-out" });
    const calc = () => {
      const A = a.value.split("\n"), B = b.value.split("\n");
      const n = A.length, m = B.length;
      const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
      for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
        dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      const rows = [];
      let i = 0, j = 0;
      while (i < n && j < m) {
        if (A[i] === B[j]) { rows.push("  " + A[i]); i++; j++; }
        else if (dp[i + 1][j] >= dp[i][j + 1]) { rows.push("- " + A[i]); i++; }
        else { rows.push("+ " + B[j]); j++; }
      }
      while (i < n) rows.push("- " + A[i++]);
      while (j < m) rows.push("+ " + B[j++]);
      out.innerHTML = rows.map((r) => {
        const c = r[0] === "-" ? "var(--red)" : r[0] === "+" ? "var(--green)" : "var(--text-dim)";
        return '<div style="color:' + c + '">' + App.ui.escapeHtml(r) + "</div>";
      }).join("");
    };
    [a, b].forEach((n) => n.addEventListener("input", calc));
    card.appendChild(App.ui.el("div", { class: "editor-split" }, [
      App.ui.el("div", {}, [App.ui.el("label", { text: "A (eski)" }), a]),
      App.ui.el("div", {}, [App.ui.el("label", { text: "B (yeni)" }), b]),
    ]));
    card.appendChild(App.ui.el("div", { style: "margin-top:12px" }, out));
    view.appendChild(App.ui.card(card));
    calc();
  }

  /* ---- Zaman ---- */
  function timeTool(view) {
    const card = App.ui.el("div", {});
    const ts = App.ui.el("input", { type: "text", value: String(Math.floor(Date.now() / 1000)) });
    const tsOut = App.ui.el("div", { class: "tool-out" });
    const calcTs = () => {
      const raw = ts.value.trim();
      if (raw === "" || isNaN(Number(raw))) { tsOut.textContent = "—"; return; }
      let v = Number(raw);
      if (Math.abs(v) < 1e12) v *= 1000;
      const d = new Date(v);
      tsOut.textContent = isNaN(d) ? "Geçersiz" : "ISO : " + d.toISOString() + "\nYerel: " + d.toLocaleString("tr-TR");
    };
    ts.addEventListener("input", calcTs);

    const d1 = App.ui.el("input", { type: "date", value: App.ui.todayISO() });
    const d2 = App.ui.el("input", { type: "date", value: App.ui.todayISO() });
    const dOut = App.ui.el("div", { class: "tool-out" });
    const calcD = () => {
      const n = App.ui.daysBetween(d1.value, d2.value);
      dOut.textContent = n + " gün (" + (n / 7).toFixed(1) + " hafta)";
    };
    [d1, d2].forEach((n) => n.addEventListener("input", calcD));

    const base = App.ui.el("input", { type: "date", value: App.ui.todayISO() });
    const off = App.ui.el("input", { type: "number", value: 30 });
    const offOut = App.ui.el("div", { class: "tool-out" });
    const calcOff = () => {
      const d = new Date(base.value + "T00:00:00");
      d.setDate(d.getDate() + (Number(off.value) || 0));
      offOut.textContent = App.ui.isoOf(d) + "  (" + d.toLocaleDateString("tr-TR", { weekday: "long" }) + ")";
    };
    [base, off].forEach((n) => n.addEventListener("input", calcOff));

    card.appendChild(App.ui.el("h4", { class: "form-heading", text: "Unix timestamp → tarih" }));
    card.appendChild(row("Timestamp (sn veya ms)", ts));
    card.appendChild(tsOut);
    card.appendChild(App.ui.el("h4", { class: "form-heading", style: "margin-top:16px", text: "İki tarih arası" }));
    card.appendChild(App.ui.el("div", { class: "field-inline" }, [d1, d2]));
    card.appendChild(dOut);
    card.appendChild(App.ui.el("h4", { class: "form-heading", style: "margin-top:16px", text: "X gün sonra / önce" }));
    card.appendChild(App.ui.el("div", { class: "field-inline" }, [base, off]));
    card.appendChild(offOut);
    view.appendChild(App.ui.card(card));
    calcTs(); calcD(); calcOff();
  }

  function sel(options, def) {
    const s = App.ui.el("select");
    options.forEach((o) => s.appendChild(App.ui.el("option", { value: o.value, text: o.label, selected: String(o.value) === String(def) })));
    return s;
  }

  App.registerModule({ id: "toolbox", title: "Araç Kutusu", icon: "🧰", group: "Araçlar", render });
})();
