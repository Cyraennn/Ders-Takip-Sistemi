# Bulut senkronizasyonu (Supabase) — kurulum

Uygulamayı çok kullanıcılı bir siteye dönüştürmek ve her kullanıcının verisinin
her cihazdan erişilebilir, kalıcı olması için **Supabase** (ücretsiz) kullanılır.
Yapılandırma boşsa uygulama eskisi gibi tek kullanıcılı, yerel modda çalışır.

## 1. Supabase projesi oluştur

1. <https://supabase.com> → **Start your project** → Google/GitHub ile giriş
2. **New project** → ad ver, güçlü bir veritabanı şifresi seç, bölge seç → **Create**
3. Proje hazır olunca (**~1 dk**) → sol menü **Project Settings → API**
   - **Project URL** (örn. `https://abcdefgh.supabase.co`)
   - **Project API keys → anon / public** anahtarı

## 2. Veritabanı tablosunu kur

Sol menü **SQL Editor → New query** → aşağıdakini yapıştır → **Run**:

```sql
create table if not exists public.user_data (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_data enable row level security;

create policy "kendi satirini oku"
  on public.user_data for select
  using (auth.uid() = user_id);

create policy "kendi satirini ekle"
  on public.user_data for insert
  with check (auth.uid() = user_id);

create policy "kendi satirini guncelle"
  on public.user_data for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

Bu politikalar (RLS) sayesinde **her kullanıcı yalnızca kendi verisine** erişebilir.

### 2b. "Çalışma Kayıtları" modülü için `ders_notlari` tablosu

Sol menüdeki **🗃️ Çalışma Kayıtları** modülü (ders adı + süre + not, satır bazlı) ayrı bir
tabloda tutulur. Aynı SQL Editor'de **[assets/sql/ders_notlari.sql](assets/sql/ders_notlari.sql)**
dosyasının içeriğini bir kez çalıştır. Bu da `user_id = auth.uid()` koşuluyla RLS ile korunur;
her kullanıcı yalnızca kendi kayıtlarını görür/düzenler/siler.

## 3. E-posta doğrulaması (isteğe bağlı ama önerilir)

- Sol menü **Authentication → Providers → Email**
- **Confirm email** açıksa: kayıt olan kişi e-postasındaki bağlantıya tıklayıp
  sonra giriş yapar (daha güvenli).
- Hızlı test için kapatabilirsin: kayıt anında giriş yapılır.
- **Authentication → URL Configuration → Site URL** alanına siteni yayınladığın
  adresi yaz (doğrulama bağlantıları oraya döner). Yerel test için `http://localhost:8000`.

## 4. Uygulamayı bağla

`assets/js/config.js` dosyasını aç ve doldur:

```js
window.BDM_CONFIG = {
  supabaseUrl: "https://abcdefgh.supabase.co",
  supabaseAnonKey: "eyJhbGciOi...",
  requireAuth: true,   // true → siteyi açan herkes önce giriş/kayıt yapar
};
```

> `anon` anahtarı **herkese açıktır**, güvenlik RLS ile sağlanır — dosyada durması güvenlidir.
> Veritabanı şifreni ve `service_role` anahtarını ASLA buraya koyma.

Kaydet. Artık `index.html` açıldığında giriş ekranı gelir; kayıt olan her kişi
kendi hesabıyla giriş yapıp kendi verilerine ulaşır.

## 5. Yayınlama (hosting)

Uygulama tamamen statik dosya olduğundan herhangi bir statik host çalışır:

| Seçenek | Nasıl |
|---|---|
| **Netlify Drop** (en kolay) | <https://app.netlify.com/drop> → `okul` klasörünü sürükle-bırak. Anında `https://...netlify.app` adresi. |
| **Vercel** | `vercel` CLI veya panelden klasörü içe aktar. Özel alan adı eklenebilir. |
| **GitHub Pages** | Repoyu GitHub'a it → Settings → Pages → branch seç. |
| **Cloudflare Pages** | Panelden klasör/repo bağla. |

`config.js` içindeki bilgilerle birlikte yayınlarsın. Supabase **Site URL**'ini
yayınladığın adrese güncellemeyi unutma.

## Nasıl çalışır (özet)

- Tüm veriler tarayıcıda (`localStorage`) tutulmaya devam eder → çevrimdışı çalışır.
- Giriş yapınca veriler Supabase'de **kullanıcı başına tek bir satırda** (JSON) saklanır.
- Her değişiklik ~3 sn sonra buluta yazılır; sekmeye dönünce buluttan çekilir.
- İki cihazda aynı anda düzenleme olursa **son yazan kazanır** (kişisel kullanımda nadir).
- İlk girişte cihazda + bulutta veri varsa hangisini tutacağın sorulur.
