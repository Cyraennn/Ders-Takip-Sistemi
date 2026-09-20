/* ============================================================
   Ders Çalışma Sistemi — kimlik doğrulama + bulut senkronizasyonu (Supabase)
   Yapılandırma yoksa uygulama eskisi gibi tek kullanıcılı yerel modda çalışır.
   Her kullanıcının tüm verisi Supabase'de tek bir satırda (jsonb) tutulur;
   yerel localStorage çevrimdışı çalışma için önbellek olarak kalır.
   ============================================================ */
(function () {
  const SUPA_CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
  const CFG_KEY = "_supabase_config";
  const SYNC_KEY = "_last_sync";

  function cfg() {
    const g = window.BDM_CONFIG || {};
    const l = App.store.get(CFG_KEY, {}) || {};
    return {
      url: String(g.supabaseUrl || l.url || "").trim(),
      key: String(g.supabaseAnonKey || l.key || "").trim(),
      forceFromDeploy: !!(g.supabaseUrl && g.requireAuth !== false),
    };
  }

  const auth = {
    mode: "off",          // off | cloud | offline
    user: null,
    lastSync: App.store.get(SYNC_KEY) || null,
    _client: null,
    _forceGate: false,
    _firstSync: true,
    _pushT: null,

    required() {
      const c = cfg();
      return !!(c.url && c.key && (c.forceFromDeploy || this._forceGate));
    },
    cloudAvailable() {
      const c = cfg();
      return !!(c.url && c.key);
    },
    // Doğrudan Supabase sorgusu yazan modüller için (örn. ders_notlari tablosu)
    get client() { return this._client; },

    async init() {
      const c = cfg();
      if (!c.url || !c.key) { this.mode = "off"; return; }
      this.mode = "cloud";
      try {
        if (!window.supabase || !window.supabase.createClient) {
          await App.ui.loadScript(SUPA_CDN);
        }
        this._client = window.supabase.createClient(c.url, c.key, {
          auth: { persistSession: true, autoRefreshToken: true, storageKey: "bdm-auth" },
        });
        const { data } = await this._client.auth.getSession();
        if (data && data.session) this._setUser(data.session.user);
        this._client.auth.onAuthStateChange((_evt, session) => {
          this._setUser(session ? session.user : null);
        });
      } catch (e) {
        console.warn("Supabase başlatılamadı", e);
        this.mode = "offline";
      }
      // sekme yeniden odaklanınca buluttan çek
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden && this.user) this.pull().then((changed) => { if (changed) App.refresh(); });
      });
      App.onWrite(() => {
        if (!this.user) return;
        clearTimeout(this._pushT);
        this._pushT = setTimeout(() => this.push(), 2500);
      });
    },

    _setUser(u) {
      const wasNull = !this.user;
      this.user = u ? { id: u.id, email: u.email } : null;
      if (this.user && wasNull) {
        this._firstSync = true;
        this.pull().then(() => { this._forceGate = false; App.refresh(); });
      } else if (!this.user) {
        App.refresh();
      }
    },

    async signUp(email, password) {
      if (!this._client) throw new Error("Bağlantı yok");
      const { data, error } = await this._client.auth.signUp({ email, password });
      if (error) throw error;
      if (data.user && !data.session) return { pendingConfirm: true };
      return { pendingConfirm: false };
    },
    async signIn(email, password) {
      if (!this._client) throw new Error("Bağlantı yok");
      const { error } = await this._client.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    async signOut() {
      if (this._client) await this._client.auth.signOut();
      this.user = null;
      this._forceGate = false;
      App.refresh();
    },

    async push() {
      if (!this.user || !this._client) return false;
      const payload = {};
      App.store.keys().forEach((k) => { if (k[0] !== "_") payload[k] = App.store.get(k); });
      const now = new Date().toISOString();
      const { error } = await this._client.from("user_data")
        .upsert({ user_id: this.user.id, data: payload, updated_at: now }, { onConflict: "user_id" });
      if (error) { console.warn("push hata", error); this.mode = "offline"; return false; }
      App.store.set(SYNC_KEY, now);
      this.lastSync = now;
      this.mode = "cloud";
      return true;
    },

    // buluttan çek; DOM güncellemesi gerekiyorsa true döndürür
    async pull() {
      if (!this.user || !this._client) return false;
      const { data, error } = await this._client.from("user_data")
        .select("data, updated_at").eq("user_id", this.user.id).maybeSingle();
      if (error) { console.warn("pull hata", error); this.mode = "offline"; return false; }

      const localTs = App.store.get(SYNC_KEY) || "";
      const localHas = App.store.keys().some((k) => k[0] !== "_");
      const remoteData = (data && data.data) || {};
      const remoteHas = Object.keys(remoteData).length > 0;
      const remoteTs = (data && data.updated_at) || "";

      if (!remoteHas) { await this.push(); return false; }        // bulut boş → yerelden doldur
      if (!localHas) { this._applyRemote(remoteData, remoteTs); return true; }

      if (this._firstSync && localHas && remoteHas) {
        this._firstSync = false;
        return await this._resolveConflict(remoteData, remoteTs);
      }
      if (Date.parse(remoteTs) > (Date.parse(localTs) || 0)) { this._applyRemote(remoteData, remoteTs); return true; }
      return false;
    },

    _applyRemote(remoteData, ts) {
      App.store.keys().forEach((k) => { if (k[0] !== "_") App.store.remove(k); });
      Object.entries(remoteData).forEach(([k, v]) => {
        try { localStorage.setItem("bdm:" + k, JSON.stringify(v)); } catch (e) {}
      });
      App.store.set(SYNC_KEY, ts || new Date().toISOString());
      this.lastSync = ts;
    },

    _resolveConflict(remoteData, remoteTs) {
      return new Promise((resolve) => {
        App.ui.modal({
          title: "Veri çakışması",
          body: App.ui.el("div", {}, [
            App.ui.el("p", { text: "Bu cihazda kaydedilmiş veri var ve hesabında da buluta kayıtlı veri var. Hangisini tutmak istersin?" }),
            App.ui.el("p", { class: "muted", text: "Bulut son güncelleme: " + App.ui.fmtDateTime(remoteTs) }),
          ]),
          actions: [
            { label: "Buluttakini kullan", kind: "primary", onClick: () => { this._applyRemote(remoteData, remoteTs); resolve(true); } },
            { label: "Bu cihazdakini yükle", kind: "danger", onClick: () => { this.push().then(() => resolve(false)); } },
          ],
          onClose: () => resolve(false),
        });
      });
    },

    async syncNow() {
      const ch = await this.pull();
      await this.push();
      App.ui.toast("Senkronize edildi", "success");
      if (ch) App.refresh();
    },

    showGate() { this._forceGate = true; App.refresh(); },

    /* ---------- Üst bar: e-posta + çıkış (giriş yapılmışsa) ---------- */
    renderTopbarUser(container) {
      App.ui.clear(container);
      if (!this.user) return;
      container.appendChild(App.ui.el("span", { class: "topbar-user-email", title: this.user.email, text: this.user.email }));
      container.appendChild(App.ui.el("button", { class: "btn ghost sm", type: "button", text: "Çıkış", onClick: () => this.signOut() }));
    },

    /* ---------- Giriş / Kayıt ekranı ---------- */
    renderGate(container) {
      const c = cfg();
      App.ui.clear(container);
      if (!c.url || !c.key) {
        container.appendChild(App.ui.el("div", { class: "auth-wrap" }, App.ui.card([
          App.ui.el("h2", { text: "Yapılandırma eksik" }),
          App.ui.el("p", { class: "muted", text: "assets/js/config.js dosyasına Supabase Project URL ve anon anahtarını gir." }),
        ])));
        return;
      }
      let tab = "in";
      const box = App.ui.el("div", { class: "auth-wrap" });
      const render = () => {
        App.ui.clear(box);
        const email = App.ui.el("input", { type: "email", placeholder: "E-posta", autocomplete: "email" });
        const pass = App.ui.el("input", { type: "password", placeholder: "Şifre (en az 6 karakter)", autocomplete: tab === "in" ? "current-password" : "new-password" });
        const msg = App.ui.el("p", { class: "auth-msg" });
        const submit = App.ui.el("button", { class: "btn primary", style: "width:100%", text: tab === "in" ? "Giriş yap" : "Kayıt ol" });

        const go = async () => {
          msg.textContent = ""; msg.className = "auth-msg";
          const e = email.value.trim(), p = pass.value;
          if (!e || p.length < 6) { msg.textContent = "Geçerli e-posta ve en az 6 karakterlik şifre gir."; msg.className = "auth-msg err"; return; }
          submit.disabled = true; submit.textContent = "…";
          try {
            if (tab === "up") {
              const r = await auth.signUp(e, p);
              if (r.pendingConfirm) {
                msg.textContent = "Doğrulama e-postası gönderildi. Kutunu kontrol edip bağlantıya tıkla, sonra giriş yap.";
                msg.className = "auth-msg ok";
                tab = "in";
              }
            } else {
              await auth.signIn(e, p);
            }
          } catch (err) {
            msg.textContent = friendly(err);
            msg.className = "auth-msg err";
          } finally {
            submit.disabled = false; submit.textContent = tab === "in" ? "Giriş yap" : "Kayıt ol";
            if (submit.textContent === "…") submit.textContent = "Giriş yap";
          }
        };
        submit.addEventListener("click", go);
        pass.addEventListener("keydown", (ev) => { if (ev.key === "Enter") go(); });

        box.appendChild(App.ui.card([
          App.ui.el("div", { class: "auth-brand" }, [
            App.ui.el("span", { style: "font-size:34px", text: "🎓" }),
            App.ui.el("h2", { text: "BÖTE Ders Merkezi", style: "margin:6px 0 0" }),
            App.ui.el("p", { class: "muted", style: "margin:2px 0 0", text: "Devam etmek için giriş yap" }),
          ]),
          App.ui.el("div", { class: "auth-tabs" }, [
            App.ui.el("button", { class: "auth-tab" + (tab === "in" ? " active" : ""), text: "Giriş", onClick: () => { tab = "in"; render(); } }),
            App.ui.el("button", { class: "auth-tab" + (tab === "up" ? " active" : ""), text: "Kayıt ol", onClick: () => { tab = "up"; render(); } }),
          ]),
          App.ui.el("div", { class: "form-grid" }, [email, pass]),
          submit,
          msg,
          !c.forceFromDeploy ? App.ui.el("button", {
            class: "btn ghost sm", style: "width:100%;margin-top:6px", text: "Girişsiz devam et (yalnızca bu cihaz)",
            onClick: () => { auth._forceGate = false; App.refresh(); },
          }) : null,
        ]));
      };
      render();
      container.appendChild(box);
      setTimeout(() => { const i = box.querySelector("input"); if (i) i.focus(); }, 60);
    },

    /* ---------- Ayarlar kartı ---------- */
    renderAccountCard() {
      const c = cfg();
      const kids = [App.ui.el("h3", { text: "Hesap & Bulut" })];
      if (!c.url || !c.key) {
        const url = App.ui.el("input", { type: "text", placeholder: "Supabase Project URL" });
        const key = App.ui.el("input", { type: "text", placeholder: "anon public anahtar" });
        kids.push(
          App.ui.el("p", { class: "muted", text: "Bulut senkronizasyonu kapalı. Etkinleştirmek için Supabase bilgilerini gir. (Yayın için assets/js/config.js düzenlenir.)" }),
          App.ui.el("div", { class: "form-grid" }, [url, key]),
          App.ui.el("button", { class: "btn primary", text: "Kaydet ve yeniden başlat", onClick: () => {
            if (!url.value.trim() || !key.value.trim()) { App.ui.toast("İkisini de gir", "error"); return; }
            App.store.set(CFG_KEY, { url: url.value.trim(), key: key.value.trim() });
            location.reload();
          } }),
        );
      } else if (!this.user) {
        kids.push(
          App.ui.el("p", { class: "muted", text: this.mode === "offline" ? "Buluta bağlanılamadı (çevrimdışı)." : "Giriş yapılmadı — veriler yalnızca bu cihazda." }),
          App.ui.el("button", { class: "btn primary", text: "Giriş / Kayıt", onClick: () => this.showGate() }),
          App.store.get(CFG_KEY) ? App.ui.el("button", { class: "btn ghost sm", style: "margin-left:8px", text: "Yerel yapılandırmayı temizle", onClick: () => { App.store.remove(CFG_KEY); location.reload(); } }) : null,
        );
      } else {
        kids.push(
          App.ui.el("p", {}, ["Giriş: ", App.ui.el("strong", { text: this.user.email })]),
          App.ui.el("p", { class: "muted", text: "Son senkron: " + (this.lastSync ? App.ui.fmtDateTime(this.lastSync) : "—") + (this.mode === "offline" ? " · çevrimdışı" : "") }),
          App.ui.el("div", { style: "display:flex;gap:8px;flex-wrap:wrap" }, [
            App.ui.el("button", { class: "btn", text: "Şimdi senkronize et", onClick: () => this.syncNow() }),
            App.ui.el("button", { class: "btn ghost", text: "Çıkış yap", onClick: () => this.signOut() }),
          ]),
          App.ui.el("small", { class: "hint", text: "Verilerin Supabase hesabına kayıtlı; başka cihazdan aynı e-postayla giriş yaptığında gelir. Çakışmada 'son yazan kazanır'." }),
        );
      }
      return App.ui.card(kids);
    },
  };

  function friendly(err) {
    const m = String((err && err.message) || err).toLowerCase();
    if (m.includes("invalid login")) return "E-posta veya şifre hatalı.";
    if (m.includes("already registered") || m.includes("user already")) return "Bu e-posta zaten kayıtlı. Giriş yapmayı dene.";
    if (m.includes("email not confirmed")) return "E-posta henüz doğrulanmamış. Kutunu kontrol et.";
    if (m.includes("password")) return "Şifre çok kısa (en az 6 karakter).";
    if (m.includes("rate") || m.includes("too many")) return "Çok fazla deneme. Biraz bekle.";
    if (m.includes("fetch") || m.includes("network")) return "Bağlantı hatası.";
    return (err && err.message) || "Bir hata oluştu.";
  }

  App.auth = auth;
})();
