/* ============================================================
   Ders Çalışma Sistemi — dağıtım yapılandırması
   Siteyi yayınlamadan önce burayı doldur:
     1. supabase.com'da ücretsiz proje aç
     2. Project Settings → API → "Project URL" ve "anon public" anahtarını kopyala
     3. Aşağıya yapıştır ve dosyayı kaydet/yayınla
     4. SUPABASE_KURULUM.md içindeki SQL'i Supabase SQL Editor'de bir kez çalıştır
   Boş bırakırsan uygulama eskisi gibi tek kullanıcılı, yerel modda çalışır.
   anon anahtarı herkese açıktır (güvenlik RLS ile sağlanır) — burada durması güvenlidir.
   ============================================================ */
window.BDM_CONFIG = {
  supabaseUrl: "",
  supabaseAnonKey: "",
  requireAuth: true,     // true → siteyi açan herkes önce giriş/kayıt yapar

  /* JARVIS sesli asistan köprüsü (aynı ağdaki JARVIS'e bağlanır).
     host: JARVIS'in çalıştığı PC (aynı makinede "localhost"), port yazmazsan :8770.
     token: JARVIS .env → JARVIS_WEB_TOKEN.  enabled:false → kapalı.
     Buradaki değerler varsayılan; kullanıcı Ayarlar > JARVIS'ten değiştirebilir. */
  jarvis: {
    host: "localhost",
    token: "",
    enabled: true,
  },
};
