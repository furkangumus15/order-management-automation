 # Sipariş Takip & Finansal Yönetim Sistemi

Yerel işletmeler için özel olarak geliştirilmiş, gerçek zamanlı veri senkronizasyonuna sahip, yüksek güvenlikli ve modern bir SaaS tipi yönetim paneli.

Bu proje, **Sofuoğlu Baklava** işletmesinin manuel (kağıt/kalem) sipariş süreçlerini; hatasız hesaplama, gelişmiş raporlama ve güvenli kullanıcı yönetimi ile dijital bir ekosisteme dönüştürmek amacıyla geliştirilmiştir.

## Öne Çıkan Özellikler

### Akıllı Dashboard & İmalat Yönetimi

- **3-Sütunlu Dinamik Izgara:** Geniş ekranlarda optimize edilmiş 3'lü kart yapısı ile operasyonel verimlilik.
- **İmalat Özeti:** Hangi üründen kaç tepsi ve kaç kg hazırlanması gerektiğini anlık gösteren "Yapılacak Sipariş Özeti".
- **Yufka Entegrasyonu:** Standart baklava ürünlerinden farklı olarak sadece kg bazlı hesaplanan ve raporlanan özel ürün modülü.
- **Merkezi Hizalama:** Tüm kart içeriklerinin ve verilerin simetrik (center) hizalandığı profesyonel UI.

## Güvenlik ve Yetkilendirme (RBAC)

- **Admin & Personel Ayrımı:** Firebase Firestore Rules ile kurgulanmış, sunucu taraflı yetki kontrolü.
- **Aktif/Pasif Kullanıcı Kontrolü:** İşten ayrılan veya yetkisi alınan personelin tek tıkla sistem erişiminin kesilmesi.
- **Korumalı Alanlar:** Finansal raporlar ve fiyat ayarları sadece Admin yetkisine sahip kullanıcılar tarafından görüntülenebilir/değiştirilebilir.

## Sipariş ve Finans Yönetimi

- **Dinamik Fiyatlandırma:** Baklava Tepsisi ve Zini Tepsisi için ayrı depozito bedelleri; Yufka için ayrı kg birim fiyatı yönetimi.
- **Finansal Raporlama:** Tarih aralığına göre dinamik olarak oluşturulan Ürün Bazlı Satış Analizi tablosu.
- **Soft-Delete (Çöp Kutusu):** Silinen siparişlerin 120 gün boyunca saklandığı ve geri yüklenebildiği veri güvenliği katmanı.
- **WhatsApp Entegrasyonu:** Hazır şablonlarla müşterilere tek tıkla sipariş onayı veya tepsi iade hatırlatması gönderimi.

## Teknolojik Yığın (Tech Stack)

- **Frontend:** HTML5, Vanilla JavaScript (ES6+), Tailwind CSS v3.
- **Backend:** Firebase Firestore (Real-time NoSQL).
- **Kimlik Doğrulama:** Firebase Authentication.
- **Veri Yönetimi:** Offline persistence (internet kesintilerinde veri kaybını önler).

## Güvenlik Politikası (Firestore Rules)

Sistem, yetkisiz erişimleri önlemek için gelişmiş Firestore güvenlik kurallarıyla korunmaktadır. Örnek kural yapısı:

```js
// Örnek Kural Yapısı
match /orders/{orderId} {
  allow read, create, update, delete: if isActiveUser(); // Sadece aktif personel işlem yapabilir
}

match /settings/{doc} {
  allow read: if isActiveUser();
  allow write: if isAdmin(); // Fiyatları sadece Admin değiştirebilir
}
```

## Kurulum ve Çalıştırma

1. Projeyi klonlayın:

```bash
git clone <repo-adresi>
```

2. `admin.html` ve ilgili JS dosyalarındaki Firebase Config alanına kendi Firebase bilgilerinizi girin.

3. VS Code üzerinden Live Server eklentisi ile `index.html` (Giriş Ekranı) üzerinden sistemi başlatın.

4. Giriş yaptıktan sonra Admin yetkisi ile Dashboard'a yönlendirileceksiniz.

## Geliştirici

**Furkan Gümüş**  
Computer Engineering Student @ Burdur Mehmet Akif Ersoy University (MAKÜ)

Full-stack uygulama geliştirme tutkunu. AI destekli yazılım araçları (Cursor, Copilot) ve mikrodenetleyici sistemler üzerine projeler geliştirmektedir.

Bu proje, yerel esnafın dijital dönüşüm yolculuğunda profesyonel bir çözüm sunmak amacıyla **Mühendislik Etiği ve Titizliğiyle** geliştirilmiştir.