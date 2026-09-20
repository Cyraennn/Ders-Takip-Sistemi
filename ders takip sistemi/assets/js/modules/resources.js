/* Kaynak Kütüphanesi — link, doküman, video arşivi */
(function () {
  const KEY = "resources";
  const CATS = ["Ders materyali", "Video / kurs", "Makale / kitap", "Araç / yazılım", "Kod örneği", "Diğer"];

  function load() { return App.store.get(KEY, []); }
  function save(l) { App.store.set(KEY, l); }

  async function edit(existing) {
    const list = load();
    const data = await App.ui.formModal(existing ? "Kaynağı düzenle" : "Kaynak ekle", [
      { name: "title", label: "Başlık", required: true },
      { name: "url", label: "Bağlantı (URL)", type: "url", placeholder: "https://" },
      { name: "category", label: "Kategori", type: "select", options: CATS, default: "Ders materyali" },
      { name: "course", label: "İlgili ders" },
      { name: "tags", label: "Etiketler (virgülle)" },
      { name: "note", label: "Not", type: "textarea" },
    ], existing || {});
    if (!data) return;
    if (existing) {
      const item = list.find((r) => r.id === existing.id);
      if (item) Object.assign(item, data);
    } else {
      list.push(Object.assign({ id: App.ui.uid(), added: App.ui.todayISO() }, data));
    }
    save(list);
    App.refresh();
  }

  async function remove(id) {
    if (!(await App.ui.confirm("Kaynak silinsin mi?"))) return;
    save(load().filter((r) => r.id !== id));
    App.refresh();
  }

  let cat = "Hepsi", q = "";

  function render(view) {
    const all = load();
    view.appendChild(App.ui.pageHeader("Kaynak Kütüphanesi", all.length + " kayıt", [
      App.ui.el("button", { class: "btn primary", text: "+ Kaynak ekle", onClick: () => edit(null) }),
    ]));

    if (!all.length) {
      view.appendChild(App.ui.emptyState("Kaynak yok.", "+ Kaynak ekle", () => edit(null)));
      return;
    }

    const search = App.ui.el("input", { type: "text", value: q, placeholder: "Ara…", style: "margin-bottom:10px", onInput: (e) => { q = e.target.value; draw(); } });
    view.appendChild(search);

    const chips = App.ui.el("div", { class: "chip-row", style: "margin-bottom:14px" });
    ["Hepsi", ...CATS].forEach((c) => chips.appendChild(App.ui.el("span", {
      class: "chip" + (cat === c ? " active" : ""), text: c, onClick: () => { cat = c; draw(); },
    })));
    view.appendChild(chips);

    const grid = App.ui.el("div", { class: "grid cols-2" });
    view.appendChild(grid);

    function draw() {
      document.querySelectorAll(".chip-row .chip").forEach((el) => el.classList.toggle("active", el.textContent === cat));
      App.ui.clear(grid);
      const ql = q.toLowerCase();
      all
        .filter((r) => cat === "Hepsi" || r.category === cat)
        .filter((r) => !ql || (r.title + " " + (r.tags || "") + " " + (r.note || "") + " " + (r.course || "")).toLowerCase().includes(ql))
        .sort((a, b) => (a.added < b.added ? 1 : -1))
        .forEach((r) => {
          grid.appendChild(App.ui.card([
            App.ui.el("div", { class: "page-head" }, [
              App.ui.el("h3", {}, r.url
                ? App.ui.el("a", { href: r.url, target: "_blank", rel: "noopener", text: r.title })
                : document.createTextNode(r.title)),
              App.ui.el("span", { class: "badge accent", text: r.category }),
            ]),
            r.course ? App.ui.el("p", { class: "muted", text: "📚 " + r.course }) : null,
            r.note ? App.ui.el("p", { text: r.note }) : null,
            App.ui.el("div", { class: "chip-row" }, (r.tags || "").split(",").map((t) => t.trim()).filter(Boolean).map((t) => App.ui.el("span", { class: "badge", text: t }))),
            App.ui.el("div", { class: "li-actions", style: "margin-top:8px" }, [
              App.ui.el("button", { class: "btn sm ghost", text: "✎", onClick: () => edit(r) }),
              App.ui.el("button", { class: "btn sm ghost", text: "🗑", onClick: () => remove(r.id) }),
            ]),
          ], "" ));
        });
    }
    draw();
  }

  App.registerModule({ id: "resources", title: "Kaynaklar", icon: "🔖", group: "Araçlar", render });
  App.registerCommand({ label: "Yeni kaynak ekle", icon: "🔖", group: "Ekle", run: () => edit(null) });
  App.registerSearch((q) =>
    load().filter((r) => (r.title + " " + (r.tags || "") + " " + (r.note || "")).toLowerCase().includes(q))
      .slice(0, 5)
      .map((r) => ({ label: r.title, group: "Kaynak", icon: "🔖", run: () => { if (r.url) window.open(r.url, "_blank"); else App.go("resources"); } }))
  );
})();
