/* ============================================================
   Çalışma Kayıtları — Supabase "ders_notlari" tablosu üzerinden
   kullanıcıya özel (RLS ile izole) ders çalışma kayıtları.
   Şema + RLS: assets/sql/ders_notlari.sql
   Bu modül yalnızca bulut hesabıyla (giriş yapılmış) çalışır;
   diğer modüllerin aksine localStorage kullanmaz.
   ============================================================ */
(function () {
  const TABLE = "ders_notlari";

  function client() { return App.auth && App.auth.client; }
  function user() { return App.auth && App.auth.user; }

  async function fetchRecords() {
    const { data, error } = await client()
      .from(TABLE)
      .select("*")
      .eq("user_id", user().id)
      .order("created_at", { ascending: false });
    if (error) { App.ui.toast("Kayıtlar alınamadı: " + error.message, "error"); return []; }
    return data || [];
  }

  async function addRecord() {
    const data = await App.ui.formModal("Yeni çalışma kaydı", [
      { name: "ders_adi", label: "Ders adı", required: true, list: App.data.courseNames() },
      { name: "calisma_suresi", label: "Çalışma süresi (dakika)", type: "number", min: 0, default: 25 },
      { name: "not_icerigi", label: "Not", type: "textarea", rows: 5, placeholder: "Bu oturumda ne çalıştın?" },
    ]);
    if (!data) return;
    const { error } = await client().from(TABLE).insert({
      user_id: user().id,
      ders_adi: data.ders_adi,
      calisma_suresi: Number(data.calisma_suresi) || 0,
      not_icerigi: data.not_icerigi || null,
    });
    if (error) { App.ui.toast("Eklenemedi: " + error.message, "error"); return; }
    App.ui.toast("Kayıt eklendi", "success");
    App.refresh();
  }

  async function editRecord(rec) {
    const data = await App.ui.formModal("Kaydı düzenle", [
      { name: "ders_adi", label: "Ders adı", required: true, list: App.data.courseNames() },
      { name: "calisma_suresi", label: "Çalışma süresi (dakika)", type: "number", min: 0 },
      { name: "not_icerigi", label: "Not", type: "textarea", rows: 5 },
    ], rec);
    if (!data) return;
    const { error } = await client().from(TABLE)
      .update({
        ders_adi: data.ders_adi,
        calisma_suresi: Number(data.calisma_suresi) || 0,
        not_icerigi: data.not_icerigi || null,
      })
      .eq("id", rec.id).eq("user_id", user().id);
    if (error) { App.ui.toast("Güncellenemedi: " + error.message, "error"); return; }
    App.ui.toast("Güncellendi", "success");
    App.refresh();
  }

  async function removeRecord(rec) {
    if (!(await App.ui.confirm(`"${rec.ders_adi}" kaydı silinsin mi?`))) return;
    const { error } = await client().from(TABLE).delete().eq("id", rec.id).eq("user_id", user().id);
    if (error) { App.ui.toast("Silinemedi: " + error.message, "error"); return; }
    App.ui.toast("Silindi", "success");
    App.refresh();
  }

  function drawList(listWrap, records) {
    App.ui.clear(listWrap);
    if (!records.length) {
      listWrap.appendChild(App.ui.emptyState("Henüz çalışma kaydın yok.", "+ Yeni kayıt", addRecord));
      return;
    }
    records.forEach((r) => {
      listWrap.appendChild(App.ui.el("div", { class: "list-item" }, [
        App.ui.el("div", { class: "li-main" }, [
          App.ui.el("div", { class: "li-title", text: r.ders_adi }),
          App.ui.el("div", { class: "li-sub", text: (r.calisma_suresi || 0) + " dk · " + App.ui.fmtDateTime(r.created_at) }),
          r.not_icerigi ? App.ui.el("div", { class: "li-sub", text: r.not_icerigi }) : null,
        ]),
        App.ui.el("div", { class: "li-actions" }, [
          App.ui.el("button", { class: "btn ghost sm", type: "button", text: "Düzenle", onClick: () => editRecord(r) }),
          App.ui.el("button", { class: "btn danger sm", type: "button", text: "Sil", onClick: () => removeRecord(r) }),
        ]),
      ]));
    });
  }

  function render(view) {
    if (!App.auth || !App.auth.cloudAvailable()) {
      view.appendChild(App.ui.pageHeader("Çalışma Kayıtları", "Bulut senkronizasyonu gerekli"));
      view.appendChild(App.ui.card([
        App.ui.el("h3", { text: "Bulut yapılandırması eksik" }),
        App.ui.el("p", { class: "muted", text: "Bu modül Supabase bulut bağlantısı ister. assets/js/config.js içine Supabase URL/anon anahtarını gir ve assets/sql/ders_notlari.sql dosyasını Supabase SQL Editor'de bir kez çalıştır (bkz. SUPABASE_KURULUM.md)." }),
      ]));
      return;
    }
    if (!App.auth.user) {
      view.appendChild(App.ui.pageHeader("Çalışma Kayıtları", "Bulutta saklanan, yalnızca sana ait ders çalışma notların"));
      view.appendChild(App.ui.card([
        App.ui.el("p", { text: "Bu özelliği kullanmak için giriş yapmalısın." }),
        App.ui.el("button", { class: "btn primary", text: "Giriş / Kayıt", onClick: () => App.auth.showGate() }),
      ]));
      return;
    }

    view.appendChild(App.ui.pageHeader("Çalışma Kayıtları", user().email, [
      App.ui.el("button", { class: "btn primary", type: "button", text: "+ Yeni kayıt", onClick: addRecord }),
    ]));

    const listWrap = App.ui.el("div", { class: "list" }, [
      App.ui.el("p", { class: "muted", text: "Yükleniyor…" }),
    ]);
    view.appendChild(listWrap);
    fetchRecords().then((records) => drawList(listWrap, records));
  }

  App.registerModule({ id: "studylog", title: "Çalışma Kayıtları", icon: "🗃️", group: "Çalışma", render });
})();
