/* Kaynakça — APA 7 kaynak oluşturucu */
(function () {
  const KEY = "citations";
  const TYPES = {
    book: "Kitap",
    chapter: "Kitap bölümü",
    journal: "Dergi makalesi",
    web: "Web sayfası",
    thesis: "Tez",
    conference: "Konferans bildirisi",
  };

  function load() { return App.store.get(KEY, []); }
  function save(l) { App.store.set(KEY, l); }

  function fmtAuthors(raw) {
    const list = (raw || "").split(";").map((s) => s.trim()).filter(Boolean);
    if (!list.length) return "";
    if (list.length === 1) return list[0];
    if (list.length === 2) return list[0] + " & " + list[1];
    return list.slice(0, -1).join(", ") + ", & " + list[list.length - 1];
  }

  function italic(s) { return s ? "<i>" + App.ui.escapeHtml(s) + "</i>" : ""; }
  function esc(s) { return App.ui.escapeHtml(s || ""); }

  function format(c) {
    const a = fmtAuthors(c.authors);
    const yr = c.year ? " (" + esc(c.year) + ")." : " (t.y.).";
    const A = a ? esc(a) + (a.endsWith(".") ? "" : ".") : "";
    switch (c.type) {
      case "book":
        return `${A}${yr} ${italic(c.title)}${c.edition ? " (" + esc(c.edition) + ". bs.)" : ""}. ${esc(c.publisher)}.`;
      case "chapter":
        return `${A}${yr} ${esc(c.title)}. ${c.editors ? esc(c.editors) + " (Ed.), " : ""}${italic(c.book)}${c.pages ? " (ss. " + esc(c.pages) + ")" : ""}. ${esc(c.publisher)}.`;
      case "journal":
        return `${A}${yr} ${esc(c.title)}. ${italic(c.journal)}, ${italic(c.volume)}${c.issue ? "(" + esc(c.issue) + ")" : ""}${c.pages ? ", " + esc(c.pages) : ""}.${c.doi ? " https://doi.org/" + esc(c.doi.replace(/^https?:\/\/doi\.org\//, "")) : ""}`;
      case "web":
        return `${A} (${esc(c.date || c.year || "t.y.")}). ${italic(c.title)}. ${esc(c.site)}. ${esc(c.url)}`;
      case "thesis":
        return `${A}${yr} ${italic(c.title)} [${esc(c.degree || "Yüksek lisans tezi")}, ${esc(c.university)}].${c.archive ? " " + esc(c.archive) + "." : ""}${c.url ? " " + esc(c.url) : ""}`;
      case "conference":
        return `${A} (${esc(c.date || c.year || "t.y.")}). ${italic(c.title)} [Bildiri]. ${esc(c.conference)}${c.location ? ", " + esc(c.location) : ""}.`;
      default:
        return A + yr + " " + italic(c.title) + ".";
    }
  }

  function fieldsFor(type) {
    const common = [
      { name: "authors", label: "Yazar(lar)", required: true, placeholder: "Yılmaz, A.; Demir, B. C.", hint: "APA biçiminde: Soyisim, A. — birden fazlaysa ; ile ayır" },
      { name: "year", label: "Yıl", placeholder: "2024" },
    ];
    const map = {
      book: [{ name: "title", label: "Kitap adı", required: true }, { name: "edition", label: "Baskı (sayı)" }, { name: "publisher", label: "Yayınevi", required: true }],
      chapter: [{ name: "title", label: "Bölüm başlığı", required: true }, { name: "editors", label: "Editör(ler)", placeholder: "E. Kaya" }, { name: "book", label: "Kitap adı", required: true }, { name: "pages", label: "Sayfa aralığı", placeholder: "45–68" }, { name: "publisher", label: "Yayınevi", required: true }],
      journal: [{ name: "title", label: "Makale başlığı", required: true }, { name: "journal", label: "Dergi adı", required: true }, { name: "volume", label: "Cilt" }, { name: "issue", label: "Sayı" }, { name: "pages", label: "Sayfalar", placeholder: "12–30" }, { name: "doi", label: "DOI" }],
      web: [{ name: "title", label: "Sayfa başlığı", required: true }, { name: "site", label: "Site adı" }, { name: "date", label: "Tarih", placeholder: "2024, 5 Mart" }, { name: "url", label: "URL", required: true }],
      thesis: [{ name: "title", label: "Tez başlığı", required: true }, { name: "degree", label: "Tez türü", type: "select", options: ["Yüksek lisans tezi", "Doktora tezi"], default: "Yüksek lisans tezi" }, { name: "university", label: "Üniversite", required: true }, { name: "archive", label: "Arşiv / veri tabanı" }, { name: "url", label: "URL" }],
      conference: [{ name: "title", label: "Bildiri başlığı", required: true }, { name: "conference", label: "Konferans adı", required: true }, { name: "date", label: "Tarih", placeholder: "2024, Ekim" }, { name: "location", label: "Yer" }],
    };
    return common.concat(map[type] || []);
  }

  async function add(existing) {
    let type = existing ? existing.type : null;
    if (!type) {
      const t = await App.ui.formModal("Kaynak türü", [
        { name: "type", label: "Tür", type: "select", options: Object.entries(TYPES).map(([v, l]) => ({ value: v, label: l })) },
      ]);
      if (!t) return;
      type = t.type;
    }
    const data = await App.ui.formModal(TYPES[type] + " — bilgiler", fieldsFor(type), existing || {});
    if (!data) return;
    data.type = type;
    const l = load();
    if (existing) {
      const it = l.find((x) => x.id === existing.id);
      if (it) Object.assign(it, data);
    } else {
      l.push(Object.assign({ id: App.ui.uid() }, data));
    }
    save(l);
    App.refresh();
  }

  async function remove(id) {
    if (!(await App.ui.confirm("Bu kaynak silinsin mi?"))) return;
    save(load().filter((c) => c.id !== id));
    App.refresh();
  }

  function plain(html) {
    return html.replace(/<[^>]+>/g, "").replace(/&#39;/g, "'").replace(/&quot;/g, '"')
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  }

  function render(view) {
    const list = load().slice().sort((a, b) => plain(format(a)).localeCompare(plain(format(b)), "tr"));

    view.appendChild(App.ui.pageHeader("Kaynakça (APA 7)", "Ödev ve raporların için kaynak listesi oluştur", [
      list.length ? App.ui.el("button", { class: "btn ghost", text: "📋 Hepsini kopyala", onClick: () => App.ui.copyText(list.map((c) => plain(format(c))).join("\n\n")) }) : null,
      list.length ? App.ui.el("button", { class: "btn ghost", text: "⬇ .txt", onClick: () => App.ui.downloadFile("kaynakca.txt", list.map((c) => plain(format(c))).join("\n\n"), "text/plain") }) : null,
      App.ui.el("button", { class: "btn primary", text: "+ Kaynak ekle", onClick: () => add(null) }),
    ]));

    if (!list.length) {
      view.appendChild(App.ui.emptyState("Kaynak yok.", "+ Kaynak ekle", () => add(null)));
      view.appendChild(App.ui.card([
        App.ui.el("h3", { text: "İpucu" }),
        App.ui.el("p", { class: "muted", text: "Yazarları APA biçiminde gir: “Soyisim, A. B.”. Birden fazla yazarı noktalı virgülle ayır. Kaynaklar otomatik olarak alfabetik sıralanır ve asılı girinti dışında APA 7'ye uygun üretilir." }),
      ]));
      return;
    }

    view.appendChild(App.ui.card([
      App.ui.el("h3", { text: "Kaynakça" }),
      App.ui.el("div", { class: "list" }, list.map((c) =>
        App.ui.el("div", { class: "list-item", style: "align-items:flex-start" }, [
          App.ui.el("div", { class: "li-main" }, [
            App.ui.el("div", { html: format(c), style: "line-height:1.6" }),
            App.ui.el("small", { class: "muted", text: TYPES[c.type] }),
          ]),
          App.ui.el("div", { class: "li-actions" }, [
            App.ui.el("button", { class: "btn sm ghost", text: "📋", title: "Kopyala", onClick: () => App.ui.copyText(plain(format(c))) }),
            App.ui.el("button", { class: "btn sm ghost", text: "✎", onClick: () => add(c) }),
            App.ui.el("button", { class: "btn sm ghost", text: "🗑", onClick: () => remove(c.id) }),
          ]),
        ])
      )),
    ]));
  }

  App.registerModule({ id: "citation", title: "Kaynakça", icon: "📚", group: "Araçlar", render });
  App.registerCommand({ label: "Yeni kaynak (APA)", icon: "📚", group: "Ekle", run: () => add(null) });
})();
