# Ders Çalışma Sistemi  ·  v5

Ders Çalışma Sistemi, öğrenciler için **tek klasörde çalışan, kurulum gerektirmeyen** çok modüllü ders çalışma uygulaması. Tamamen tarayıcıda çalışır, internet gerektirmez, tüm veriler tarayıcının `localStorage` alanında saklanır. Çevrimdışı çalışır ve uygulama olarak yüklenebilir (PWA).

## Kullanım

`index.html` dosyasına çift tıkla. (Çok kullanıcılı site + bulut kaydı istiyorsan: **[SUPABASE_KURULUM.md](SUPABASE_KURULUM.md)**.)

> En sorunsuz deneyim (PWA kurulumu, çevrimdışı önbellek ve tüm tarayıcı özellikleri) için basit bir yerel sunucu kullan:
> ```
> cd okul
> python -m http.server 8000
> ```
> ve `http://localhost:8000` adresine git.

## Yeni (v5) — çok kullanıcılı site + bulut senkronizasyonu

- **Kayıt / giriş (e-posta + şifre)** ve **kullanıcı başına kalıcı, her cihazdan erişilebilir veri** — Supabase ile.
- Yapılandırma boşsa uygulama eskisi gibi **tek kullanıcılı yerel modda** çalışır (geriye uyumlu).
- Kurulum ve yayınlama: **[SUPABASE_KURULUM.md](SUPABASE_KURULUM.md)** (2 dk'lık ücretsiz Supabase projesi + tek SQL + `assets/js/config.js`).
- **Önerilen hosting**: [Netlify Drop](https://app.netlify.com/drop) — `okul` klasörünü sürükle-bırak, anında `https://...netlify.app` adresi. (Alternatif: Vercel, GitHub Pages, Cloudflare Pages.)
- Ayarlar → **Hesap & Bulut**: giriş durumu, "Şimdi senkronize et", çıkış.

## Yeni (v4)

- **SM-2 aralıklı tekrar** — Flashcard artık Anki tarzı SM-2 kullanıyor (Tekrar / Zor / İyi / Kolay), deste olgunluk istatistikleri, "Bugünkü tüm tekrarlar" karışık oturumu. Eski kartlar otomatik taşınır.
- **KaTeX matematik** — `$x^2$` ve `$$\int$$` ifadeleri notlarda, AI yanıtlarında ve quizlerde render edilir.
- **Cloze kartlar** — `{{c1::cevap}}` biçiminde yaz; her boşluk için ayrı tekrar kartı üretilir.
- **Notlardan kart/quiz** — Not editöründe "🃏 Karta dönüştür" (manuel `soru | cevap`) ve "🤖 AI ile üret" (Gemini ile flashcard/quiz).
- **Ayarlar modülü + bildirimler** — tarayıcı bildirimleri (bugün/yarın sınav & ödev), Pomodoro seansı bitişi. Yalnızca uygulama açıkken çalışır.
- **Pyodide** — Kod Parçacıkları'nda Python/JS "▶ Çalıştır" (Python ilk sefer ~6MB indirir).
- **Toolbox +4 araç** — Regex test edici, JSON biçimlendirici, metin diff, zaman/timestamp hesaplayıcı.

## Modüller (20)

**Planlama**
- 🏠 **Panel** — bugünkü dersler, yaklaşan ödev/sınavlar, GANO, günlük çalışma; ilk kullanımda hızlı başlangıç
- 📅 **Ders Programı** — haftalık ızgara, "şu an / sıradaki ders", `.ics` dışa aktarım
- 🗓️ **Çalışma Takvimi** — sınav + ödev + ders birleşik aylık takvim
- ✅ **Ödev & Proje** — teslim tarihi, öncelik, durum, **alt görevler**, **tekrar eden görevler**, CSV dışa aktarım
- 📝 **Sınav Takvimi** — geri sayım, **konu kontrol listesi**, `.ics` dışa aktarım

**Akademik**
- 📊 **Notlar & GPA** — AKTS ağırlıklı GANO/YANO, hedef hesaplayıcı, **"ya olursa" senaryo simülatörü**
- 📉 **Devamsızlık** — %30 kuralı, kalan saat hakkı
- 🎯 **Mezuniyet Takibi** — toplam AKTS ve GANO hedefine göre ilerleme
- 📈 **İlerleme Panosu** — haftalık çalışma grafiği, GANO trendi, kart hakimiyeti

**Çalışma**
- ✨ **AI Asistan** — Gemini tabanlı ders yardımcısı: çözemediğin soruları (isterse fotoğrafıyla) çözer, ders konularını anlatır, seni motive eder ve sınava hazırlar. Yaklaşan sınav/ödevlerini bağlam olarak kullanır. Ayrı sohbetler tutar. *(kendi ücretsiz Gemini API anahtarını girmen gerekir — aşağıya bak)*
- ⏱️ **Pomodoro** — ayarlanabilir döngü, **günlük hedef + seri (streak)**, 7 gün grafiği, seans bitince bildirim
- 🃏 **Flashcard** — **SM-2 aralıklı tekrar**, cloze kartlar, KaTeX matematik, toplu ekleme, CSV içe/dışa aktarım, olgunluk istatistikleri
- ❓ **Deneme Sınavı** — soru bankaları, çoktan seçmeli / doğru-yanlış, süreli test, sonuç geçmişi, **flashcard destesinden soru üretme**
- 📓 **Ders Notları** — Markdown + canlı önizleme, sabitleme, `.md` indirme, yazdırma
- 🗃️ **Çalışma Kayıtları** — Supabase `ders_notlari` tablosunda satır bazlı, kullanıcıya özel (RLS) ders/süre/not kaydı; bulut hesabı gerektirir ([kurulum](SUPABASE_KURULUM.md))

**Araçlar**
- 🔖 **Kaynaklar** — link/video/doküman arşivi, kategori + etiket
- 💾 **Kod Parçacıkları** — dile göre filtre, tek tıkla kopyala
- 🧰 **Araç Kutusu** — sayı tabanı çevirici, bit/byte, renk & WCAG kontrast, doğruluk tablosu üreteci, metin araçları (Base64, slug…), SHA-256
- 📚 **Kaynakça** — APA 7 kaynak oluşturucu (kitap, makale, web, tez, bildiri), alfabetik liste, toplu kopyala

**Sistem**
- ⚙️ **Ayarlar** — tema, bildirim izinleri ve tercihleri, AI anahtarı, veri kısayolu
- 💽 **Yedekle & Geri Yükle** — tüm veriyi JSON dışa/içe aktar, sıfırla

## Uygulama geneli

- **Komut paleti**: `Ctrl / ⌘ + K` — sayfa gezinme, hızlı ekleme, ödev/not/kod içinde arama
- **Kısayollar**: `G` sonra `H` (panel), `T` (ödev), `S` (program), `N` (not), `P` (pomodoro), `C` (takvim), `G` (GPA), `F` (flashcard); `?` yardım
- **Tema**: karanlık / açık, sol alttan
- **PWA**: sunucudan açıldığında "uygulama olarak yükle" + çevrimdışı çalışma

## AI Asistan kurulumu

1. [aistudio.google.com/apikey](https://aistudio.google.com/apikey) adresine gir, Google hesabınla giriş yap.
2. **Create API key** ile ücretsiz bir anahtar oluştur.
3. Uygulamada **AI Asistan → 🔑 API anahtarını gir** ile yapıştır.

- Anahtar ve sohbetler yalnızca senin tarayıcının `localStorage`'ında tutulur; istekler **doğrudan Google'a** gider.
- Anahtar `_` önekli anahtarda saklanır → JSON yedeğine **dahil edilmez**.
- Varsayılan model `gemini-2.5-flash`. Ayarlardan `gemini-2.5-pro` veya `gemini-flash-latest` seçebilirsin.
- `file://` ile açtığında tarayıcı isteği engelleyebilir; **yerel sunucudan** açman önerilir.

## Veri ve yedekleme

- Veriler yalnızca bu tarayıcıda, bu bilgisayarda tutulur.
- **Yedekle & Geri Yükle** modülünden düzenli JSON yedeği al.
- Tarayıcı site verilerini temizlersen kayıtlar silinir.

## Teknik

- Çekirdek tamamen saf HTML + CSS + JavaScript.
- Harici (yalnızca ilgili özellik kullanılınca yüklenen, CDN + SW önbellekli): **KaTeX** (matematik), **Pyodide** (Python), **Gemini API** (AI).
- `assets/js/core.js` — depolama, arayüz yardımcıları, yönlendirme, modül kaydı, komut paleti, kısayollar, grafik yardımcıları.
- `assets/js/modules/*.js` — her modül bağımsız; `App.registerModule({ id, title, icon, group, render })` ile kaydolur. İsteğe bağlı: `App.registerCommand(...)`, `App.registerSearch(fn)`.
- `sw.js` + `manifest.webmanifest` — çevrimdışı önbellek ve PWA.
- Yeni modül: `assets/js/modules/` altına dosya ekle, `index.html` ve `sw.js` içine `<script>` / önbellek satırını ekle.
