import { initializeApp as initializeModularApp, getApps as getModularApps } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore as getModularFirestore, doc as modularDoc, deleteDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// ─── Firebase Config ─────────────────
const firebaseConfig = {
  apiKey: "AIzaSyAMMDGqvO0LUrPa95CcNuhB3cbGEG_MJeo",
  authDomain: "ordersystem-1056b.firebaseapp.com",
  projectId: "ordersystem-1056b",
  storageBucket: "ordersystem-1056b.firebasestorage.app",
  messagingSenderId: "1079412134709",
  appId: "1:1079412134709:web:32ee9ea5d3ef70bb16f27c",
  measurementId: "G-TMSHELWJ5D"
};

try { firebase.initializeApp(firebaseConfig); } catch (e) { /* zaten init edildi */ }
const db = firebase.firestore();
const auth = firebase.auth();
const hardDeleteApp = getModularApps().find(app => app.name === 'hard-delete-helper')
  || initializeModularApp(firebaseConfig, 'hard-delete-helper');
const hardDeleteDb = getModularFirestore(hardDeleteApp);

// Ana modüler app'i başlat (eğer başlatılmadıysa) ve Firestore instance'ını al
const modularApp = getModularApps().find(app => app.name === '[DEFAULT]') || initializeModularApp(firebaseConfig);
const modularDb = getModularFirestore(modularApp);

// ─── Global User Management Functions ────────────────
function showUserStatusSecurityWarning() {
  const message = 'Güvenlik nedeniyle kendi hesabınızı pasif duruma getiremezsiniz!';
  if (window.Swal && typeof window.Swal.fire === 'function') {
    return window.Swal.fire({
      icon: 'warning',
      title: 'İşlem engellendi',
      text: message,
      confirmButtonText: 'Tamam'
    });
  }

  alert(message);
  return Promise.resolve();
}

function restoreUserStatusControl(userId, currentStatus) {
  const selector = `input[data-user-id="${String(userId)}"]`;
  const control = document.querySelector(selector);
  if (!control) return;

  if (control.type === 'checkbox') {
    control.checked = !!currentStatus;
  }
}

window.toggleUserStatus = async function (userId, currentStatus) {
  if (!userId) {
    alert("Hata: Kullanıcı ID bulunamadı!");
    return;
  }

  const currentAuthUser = auth.currentUser;
  if (!currentAuthUser) {
    alert('Hata: Oturum bilgisi alınamadı!');
    return;
  }

  try {
    const targetSnap = await db.collection('users').doc(String(userId)).get();
    const targetData = targetSnap.exists ? targetSnap.data() : null;
    const currentEmail = String(currentAuthUser.email || '').toLowerCase();
    const targetEmail = String(targetData?.email || '').toLowerCase();

    const isSelfById = String(userId) === String(currentAuthUser.uid || '');
    const isSelfByEmail = !!currentEmail && currentEmail === targetEmail;

    if (isSelfById || isSelfByEmail) {
      await showUserStatusSecurityWarning();
      restoreUserStatusControl(userId, currentStatus);
      return;
    }

    await db.collection('users').doc(String(userId)).update({
      isActive: !currentStatus
    });
    toast('✅ Kullanıcı durumu güncellendi', 'success');
    // Yenileme yerine sadece user listesi yeniden yüklenebilir
    if (typeof loadUserSettingsPage === 'function') loadUserSettingsPage();
  } catch (error) {
    console.error("Veritabanı Hatası:", error);
    toast('❌ İşlem başarısız oldu: ' + error.message, 'error');
  }
};

window.deleteUser = async function (userId) {
  if (!userId) {
    alert("Hata: Kullanıcı ID bulunamadı!");
    return;
  }
  if (!window.Swal || typeof window.Swal.fire !== 'function') {
    toast('❌ SweetAlert2 bulunamadı. Kullanıcı silme onayı gösterilemiyor.', 'error');
    return;
  }

  const result = await window.Swal.fire({
    title: 'Kullanıcıyı Sil?',
    text: 'Bu hesabı silmek istediğinize emin misiniz? (Bu işlem geri alınamaz)',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#6b7280',
    confirmButtonText: 'Evet, Sil',
    cancelButtonText: 'İptal'
  });

  if (!result?.isConfirmed) {
    return;
  }

  try {
    await db.collection('users').doc(String(userId)).delete();
    // Remove any matching desktop table row(s)
    try {
      const buttons = Array.from(document.querySelectorAll(`button[onclick="deleteUser('${userId}')"]`));
      buttons.forEach(btn => {
        const tr = btn.closest('tr');
        if (tr) tr.remove();
        else {
          // mobile cards may reference original button; rebuild mobile cards if available
          if (typeof buildMobileCards === 'function') buildMobileCards();
        }
      });
    } catch (e) {
      // ignore DOM removal errors
    }
    toast('✅ Kullanıcı başarıyla silindi', 'success');
    // Refresh list as fallback
    if (typeof loadUserSettingsPage === 'function') setTimeout(loadUserSettingsPage, 400);
  } catch (error) {
    console.error("Veritabanı Hatası:", error);
    alert("Silme işlemi başarısız: " + error.message);
  }
};

// ─── Global Loader Fonksiyonları ───────────────────
window.showLoader = () => {
  const loader = document.getElementById('global-loader');
  if (loader) {
    loader.classList.remove('hidden');
    loader.classList.add('flex');
  }
};
window.hideLoader = () => {
  const loader = document.getElementById('global-loader');
  if (loader) {
    loader.classList.add('hidden');
    loader.classList.remove('flex');
  }
};

let globalPriceSettings = {
  karetepsi: 0, karekg: 0, evtepsi: 0, evkg: 0,
  saritepsi: 0, sarikg: 0, sutepsi: 0, sukg: 0,
  fistiktepsi: 0, fistikkg: 0, yufkatepsi: 0, yufkaKg: 0, baklavaDepozito: 0, ziniDepozito: 0, tray: 0
};

let currentPanel = 'active';

function getPanelTheme(panel = currentPanel) {
  if (panel === 'deleted') {
    return {
      headerBgClass: 'bg-red-600 hover:bg-red-700',
      panelBadgeClass: 'bg-red-100 text-red-700',
      panelBadgeLabel: '🗑️ Silinen',
    };
  }

  return {
    headerBgClass: 'bg-slate-700 hover:bg-slate-800',
    panelBadgeClass: 'bg-slate-100 text-slate-700',
    panelBadgeLabel: '📋 Aktif',
  };
}

// ─── Güvenlik Global Değişkenleri ────────────────────────────────────────
let currentUserDoc = null;     // Firestore users/{uid} belgesi
let afterHoursAccess = false;  // Erişim kodu ile kilit açıldı mı?
let timeWatcherInterval = null; // setInterval referansı

async function loadSettings() {
  try {
    // ✅ DÜZELTME: Doğru veritabanı adresi (settings > prices)
    const priceDoc = await db.collection('settings').doc('prices').get();

    if (priceDoc.exists) {
      globalPriceSettings = priceDoc.data();
      window.currentPrices = globalPriceSettings; // Eskiden kalan yapı ile entegre et
      console.log('✅ Doğru Fiyat ayarları yüklendi:', globalPriceSettings);

      // HTML input'larını doldur (varsa)
      if (document.getElementById('karetepsi')) document.getElementById('karetepsi').value = globalPriceSettings.karetepsi || 0;
      if (document.getElementById('karekg')) document.getElementById('karekg').value = globalPriceSettings.karekg || 0;
      if (document.getElementById('evtepsi')) document.getElementById('evtepsi').value = globalPriceSettings.evtepsi || 0;
      if (document.getElementById('evkg')) document.getElementById('evkg').value = globalPriceSettings.evkg || 0;
      if (document.getElementById('saritepsi')) document.getElementById('saritepsi').value = globalPriceSettings.saritepsi || 0;
      if (document.getElementById('sarikg')) document.getElementById('sarikg').value = globalPriceSettings.sarikg || 0;
      if (document.getElementById('sutepsi')) document.getElementById('sutepsi').value = globalPriceSettings.sutepsi || 0;
      if (document.getElementById('sukg')) document.getElementById('sukg').value = globalPriceSettings.sukg || 0;
      if (document.getElementById('fistiktepsi')) document.getElementById('fistiktepsi').value = globalPriceSettings.fistiktepsi || 0;
      if (document.getElementById('fistikkg')) document.getElementById('fistikkg').value = globalPriceSettings.fistikkg || 0;
      if (document.getElementById('yufkaKgFiyat')) document.getElementById('yufkaKgFiyat').value = globalPriceSettings.yufkaKg || 0;
      if (document.getElementById('baklavaDepozitoFiyat')) document.getElementById('baklavaDepozitoFiyat').value = globalPriceSettings.baklavaDepozito || 0;
      if (document.getElementById('ziniDepozitoFiyat')) document.getElementById('ziniDepozitoFiyat').value = globalPriceSettings.ziniDepozito || 0;

      // Mevcut Fiyatlar tablosunu doldur
      const tbody = document.getElementById('current-prices-tbody');
      if (tbody) {
        tbody.innerHTML = `
          <tr class="hover:bg-gray-50 transition-colors">
            <td class="px-4 py-2 font-medium text-gray-800 flex items-center gap-2">Kare Baklava</td>
            <td class="px-4 py-2 text-gray-600">₺${globalPriceSettings.karetepsi || 0}</td>
            <td class="px-4 py-2 text-gray-600">₺${globalPriceSettings.karekg || 0}</td>
          </tr>
          <tr class="hover:bg-gray-50 transition-colors">
            <td class="px-4 py-2 font-medium text-gray-800 flex items-center gap-2">Ev Baklavası</td>
            <td class="px-4 py-2 text-gray-600">₺${globalPriceSettings.evtepsi || 0}</td>
            <td class="px-4 py-2 text-gray-600">₺${globalPriceSettings.evkg || 0}</td>
          </tr>
          <tr class="hover:bg-gray-50 transition-colors">
            <td class="px-4 py-2 font-medium text-gray-800 flex items-center gap-2">Sarı Burma</td>
            <td class="px-4 py-2 text-gray-600">₺${globalPriceSettings.saritepsi || 0}</td>
            <td class="px-4 py-2 text-gray-600">₺${globalPriceSettings.sarikg || 0}</td>
          </tr>
          <tr class="hover:bg-gray-50 transition-colors">
            <td class="px-4 py-2 font-medium text-gray-800 flex items-center gap-2">Su Böreği</td>
            <td class="px-4 py-2 text-gray-600">₺${globalPriceSettings.sutepsi || 0}</td>
            <td class="px-4 py-2 text-gray-600">₺${globalPriceSettings.sukg || 0}</td>
          </tr>
          <tr class="hover:bg-gray-50 transition-colors">
            <td class="px-4 py-2 font-medium text-gray-800 flex items-center gap-2">A. Fıstıklı</td>
            <td class="px-4 py-2 text-gray-600">₺${globalPriceSettings.fistiktepsi || 0}</td>
            <td class="px-4 py-2 text-gray-600">₺${globalPriceSettings.fistikkg || 0}</td>
          </tr>
          <tr class="hover:bg-gray-50 transition-colors">
            <td class="px-4 py-2 font-medium text-gray-800 flex items-center gap-2">Yufka</td>
            <td class="px-4 py-2 text-gray-600">-</td>
            <td class="px-4 py-2 text-gray-600">₺${globalPriceSettings.yufkaKg || 0}</td>
          </tr>
          <tr class="bg-orange-50/50">
            <td class="px-4 py-2 font-bold text-orange-800 flex items-center gap-2">Baklava Tepsisi</td>
            <td class="px-4 py-2 font-bold text-orange-700" colspan="2">₺${globalPriceSettings.baklavaDepozito || 0}</td>
          </tr>
          <tr class="bg-orange-50/50">
            <td class="px-4 py-2 font-bold text-orange-800 flex items-center gap-2">Zini Depozitosu</td>
            <td class="px-4 py-2 font-bold text-orange-700" colspan="2">₺${globalPriceSettings.ziniDepozito || 0}</td>
          </tr>
        `;
      }

      // ✅ YENİ: Güncel Birim Fiyatları kartını doldur (Dashboard Panelinde)
      // 🟨 Kare Baklava
      const kareTrayCont = document.getElementById('price-kare-tray');
      const kareKgCont = document.getElementById('price-kare-kg');
      if (kareTrayCont) kareTrayCont.textContent = `₺${globalPriceSettings.karetepsi || '...'}`;
      if (kareKgCont) kareKgCont.textContent = `₺${globalPriceSettings.karekg || '...'}`;

      // 🏠 Ev Baklavası
      const evTrayCont = document.getElementById('price-ev-tray');
      const evKgCont = document.getElementById('price-ev-kg');
      if (evTrayCont) evTrayCont.textContent = `₺${globalPriceSettings.evtepsi || '...'}`;
      if (evKgCont) evKgCont.textContent = `₺${globalPriceSettings.evkg || '...'}`;

      // 📀 Sarı Burma
      const sariTrayCont = document.getElementById('price-sari-tray');
      const sariKgCont = document.getElementById('price-sari-kg');
      if (sariTrayCont) sariTrayCont.textContent = `₺${globalPriceSettings.saritepsi || '...'}`;
      if (sariKgCont) sariKgCont.textContent = `₺${globalPriceSettings.sarikg || '...'}`;

      // 💧 Su Böreği
      const suTrayCont = document.getElementById('price-su-tray');
      const suKgCont = document.getElementById('price-su-kg');
      if (suTrayCont) suTrayCont.textContent = `₺${globalPriceSettings.sutepsi || '...'}`;
      if (suKgCont) suKgCont.textContent = `₺${globalPriceSettings.sukg || '...'}`;

      // ❇️ Fıstıklı Baklava
      const fistikTrayCont = document.getElementById('price-fistik-tray');
      const fistikKgCont = document.getElementById('price-fistik-kg');
      if (fistikTrayCont) fistikTrayCont.textContent = `₺${globalPriceSettings.fistiktepsi || '...'}`;
      if (fistikKgCont) fistikKgCont.textContent = `₺${globalPriceSettings.fistikkg || '...'}`;

      // 🥘 Yufka
      const yufkaKgCont = document.getElementById('dashYufkaKg');
      if (yufkaKgCont) yufkaKgCont.textContent = `₺${globalPriceSettings.yufkaKg || 0}`;

      // Depozitolar
      const dashBaklavaDepozito = document.getElementById('dashBaklavaDepozito');
      const dashZiniDepozito = document.getElementById('dashZiniDepozito');
      if (dashBaklavaDepozito) dashBaklavaDepozito.textContent = `₺${globalPriceSettings.baklavaDepozito || 0}`;
      if (dashZiniDepozito) dashZiniDepozito.textContent = `₺${globalPriceSettings.ziniDepozito || 0}`;

      // Güvence Bedeli (Tepsi Depozitosu)
      const trayDepositElem = document.getElementById('tray-deposit-cost');
      if (trayDepositElem) {
        trayDepositElem.textContent = globalPriceSettings.tray ? `₺${globalPriceSettings.tray}` : '...';
      }

      console.log('✅ Güncel Birim Fiyatları kartı güncellendi');

      // ✅ Fiyatlar yüklendikten sonra tabloları güncel fiyatlarla yenile (Race Condition Çözümü)
      if (typeof renderActiveTable === 'function') renderActiveTable();
      if (typeof renderHistoryTable === 'function') renderHistoryTable();
      if (typeof renderTrayReturns === 'function') renderTrayReturns();
      if (typeof renderDeletedPanel === 'function') renderDeletedPanel();
    } else {
      // ⚠️ Veri bulunamadı, placeholder'lar göster
      const placeholderElem = [
        'price-kare-tray', 'price-kare-kg', 'price-ev-tray', 'price-ev-kg',
        'price-sari-tray', 'price-sari-kg', 'price-su-tray', 'price-su-kg',
        'price-fistik-tray', 'price-fistik-kg', 'avg-tray-cost', 'tray-deposit-cost'
      ];
      placeholderElem.forEach(id => {
        const elem = document.getElementById(id);
        if (elem) elem.textContent = '...';
      });
      console.warn('⚠️ Fiyat ayarları bulunamadı, placeholder gösteriliyor');
    }
  } catch (err) {
    console.error('❌ Fiyat ayarları yüklemesi başarısız:', err);
    // Hata durumunda placeholder'lar göster
    const placeholderElem = [
      'price-kare-tray', 'price-kare-kg', 'price-ev-tray', 'price-ev-kg',
      'price-sari-tray', 'price-sari-kg', 'price-su-tray', 'price-su-kg',
      'price-fistik-tray', 'price-fistik-kg', 'avg-tray-cost', 'tray-deposit-cost'
    ];
    placeholderElem.forEach(id => {
      const elem = document.getElementById(id);
      if (elem) elem.textContent = '0₺';
    });
  }
}

// Firebase'ye fiyat ayarlarını kaydet
async function saveSettings(e) {
  if (e) e.preventDefault();

  try {
    const priceData = {
      karetepsi: parseFloat(document.getElementById('karetepsi')?.value || 0),
      karekg: parseFloat(document.getElementById('karekg')?.value || 0),
      evtepsi: parseFloat(document.getElementById('evtepsi')?.value || 0),
      evkg: parseFloat(document.getElementById('evkg')?.value || 0),
      saritepsi: parseFloat(document.getElementById('saritepsi')?.value || 0),
      sarikg: parseFloat(document.getElementById('sarikg')?.value || 0),
      sutepsi: parseFloat(document.getElementById('sutepsi')?.value || 0),
      sukg: parseFloat(document.getElementById('sukg')?.value || 0),
      fistiktepsi: parseFloat(document.getElementById('fistiktepsi')?.value || 0),
      fistikkg: parseFloat(document.getElementById('fistikkg')?.value || 0),
      yufkaKg: parseFloat(document.getElementById('yufkaKgFiyat')?.value || 0),
      baklavaDepozito: parseFloat(document.getElementById('baklavaDepozitoFiyat')?.value || 0),
      ziniDepozito: parseFloat(document.getElementById('ziniDepozitoFiyat')?.value || 0),
      updatedAt: new Date().toISOString(),
      updatedBy: auth.currentUser?.email || 'unknown'
    };

    // ✅ DÜZELTME: Doğru veritabanı adresi ve merge işlemi (settings > prices)
    await db.collection('settings').doc('prices').set(priceData, { merge: true });
    globalPriceSettings = priceData;
    window.currentPrices = globalPriceSettings;

    toast('✅ Fiyat ayarları kaydedildi!', 'success');
    location.reload();
  } catch (err) {
    console.error('❌ Kayıt hatası:', err);
    toast('Fiyat ayarları kaydedilemedi!', 'error');
  }
}

// Siparişteki toplam tepsi adedini hesapla (tüm ürünlerin tepsi miktarları toplamı)
function getTotalTrayCount(order) {
  return [
    order.kareBaklava, order.evBaklavasi, order.sariBurma,
    order.suBoregi, order.fistikliBaklava
  ].reduce((sum, val) => sum + (Number(val) || 0), 0);
}

function getProductValue(order, productKey) {
  if (!order) return 0;

  const normalizedTargetKey = String(productKey || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (order[productKey] !== undefined && order[productKey] !== null) {
    return Number(order[productKey]) || 0;
  }

  for (const key of Object.keys(order)) {
    const normalizedCurrentKey = String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normalizedCurrentKey === normalizedTargetKey) {
      return Number(order[key]) || 0;
    }
  }

  return 0;
}

function getYufkaKgPrice(prices) {
  const yufkaKgPrice = Number(prices?.yufkaKg ?? prices?.yufkakg ?? 0);
  if (!yufkaKgPrice) {
    console.warn('⚠️ Yufka kg fiyatı bulunamadı:', prices);
  }
  return yufkaKgPrice;
}

// Sipariş toplam fiyatını hesapla (yeni mimari çizime göre)
function calculateOrderTotal(order) {
  let total = 0;
  const p = globalPriceSettings || {}; // ✅ Fiyat tablosu

  // ✅ YENİ: Fiyatları veritabanından çek (artık sabit değil)
  const baklavaTepsiFiyat = p.baklavaDepozito || 0;   // Baklava Tepsisi
  const ziniFiyat = p.ziniDepozito || 0;              // Zini (Su Böreği)

  // ═══════════════════════════════════════════════════════════════════
  // 1. ÜRÜN BEDELLERİ (tüm ürünlerin tepsi ve kg bedelleri)
  // ═══════════════════════════════════════════════════════════════════
  total += (order.kareBaklava || 0) * (p.karetepsi || 0);
  total += (order.kareBaklavaKg || 0) * (p.karekg || 0);
  total += (order.evBaklavasi || 0) * (p.evtepsi || 0);
  total += (order.evBaklavasiKg || 0) * (p.evkg || 0);
  total += (order.sariBurma || 0) * (p.saritepsi || 0);
  total += (order.sariBurmaKg || 0) * (p.sarikg || 0);
  total += (order.suBoregi || 0) * (p.sutepsi || 0);
  total += (order.suBoregiKg || 0) * (p.sukg || 0);
  total += (order.fistikliBaklava || 0) * (p.fistiktepsi || 0);
  total += (order.fistikliBaklavaKg || 0) * (p.fistikkg || 0);
  total += getProductValue(order, 'yufka') * (p.yufkatepsi || 0);
  total += getProductValue(order, 'yufkaKg') * getYufkaKgPrice(p);

  // ═══════════════════════════════════════════════════════════════════
  // 2. BAKLAVA TEPSİSİ PARASI
  // Kare, Ev, Sarı Burma, Fıstıklı (Su Böreği ve Yufka HARİÇ) tepsileri × baklavaTepsiFiyat
  // ═══════════════════════════════════════════════════════════════════
  const baklavaTepsiCount =
    (order.kareBaklava || 0) +
    (order.evBaklavasi || 0) +
    (order.sariBurma || 0) +
    (order.fistikliBaklava || 0);

  total += baklavaTepsiCount * baklavaTepsiFiyat;

  // Zini (Su Böreği) sipariş anında fiyata kaydedilmez, gösterimde dinamik olarak eklenir.

  return Math.round(total * 100) / 100;
}

// Modal'da canlı fiyat hesapla
function updatePricePreview() {
  const orderData = {
    kareBaklava: parseInt(document.getElementById('f_kareBaklava')?.value || 0),
    kareBaklavaKg: parseFloat(document.getElementById('f_kareBaklavaKg')?.value || 0),
    evBaklavasi: parseInt(document.getElementById('f_evBaklavasi')?.value || 0),
    evBaklavasiKg: parseFloat(document.getElementById('f_evBaklavasiKg')?.value || 0),
    sariBurma: parseInt(document.getElementById('f_sariBurma')?.value || 0),
    sariBurmaKg: parseFloat(document.getElementById('f_sariBurmaKg')?.value || 0),
    suBoregi: parseInt(document.getElementById('f_suBoregi')?.value || 0),
    suBoregiKg: parseFloat(document.getElementById('f_suBoregiKg')?.value || 0),
    fistikliBaklava: parseInt(document.getElementById('f_fistikliBaklava')?.value || 0),
    fistikliBaklavaKg: parseFloat(document.getElementById('f_fistikliBaklavaKg')?.value || 0),
    yufka: parseInt(document.getElementById('f_yufka')?.value || 0),
    yufkaKg: parseFloat(document.getElementById('f_yufkaKg')?.value || 0)
  };

  let total = calculateOrderTotal(orderData);

  const priceEl = document.getElementById('pricePreview');
  if (priceEl) {
    priceEl.textContent = total > 0 ? '₺' + total.toLocaleString('tr-TR') : '-';
  }
}
// ─── Offline Persistence ─────────────────────────────────────────
// NOT: enablePersistence() async'tir; auth listener bu tamamlanmadan kurulabilir.
// Bu kasıtlı tasarımdır — persistence isteğe bağlı bir iyileştirmedir.
db.enablePersistence({ synchronizeTabs: true }).catch(err => {
  if (err.code === 'failed-precondition') {
    console.warn('Offline mod: Birden fazla sekme açık — tek sekmede çalışır.');
  } else if (err.code === 'unimplemented') {
    console.warn('Bu tarayıcı offline persistence desteklemiyor.');
  }
});

// ─── Ürün Tanımları ──────────────────────────────────────────────
const PRODUCTS = [
  { key: 'kareBaklava', kgKey: 'kareBaklavaKg', label: 'Kare Baklava', emoji: '' },
  { key: 'evBaklavasi', kgKey: 'evBaklavasiKg', label: 'Ev Baklavası', emoji: '' },
  { key: 'sariBurma', kgKey: 'sariBurmaKg', label: 'Sarı Burma', emoji: '' },
  { key: 'suBoregi', kgKey: 'suBoregiKg', label: 'Su Böreği', emoji: '' },
  { key: 'fistikliBaklava', kgKey: 'fistikliBaklavaKg', label: 'Antep Fıstıklı ', emoji: '' },
  { key: 'yufka', kgKey: 'yufkaKg', label: 'Yufka', emoji: '' },
];
const PRODUCT_COLORS = ['violet', 'amber', 'emerald', 'sky', 'rose', 'orange'];
// ─── GLOBAL HAFIZA VE FİLTRE DEĞİŞKENLERİ ────────────────────────
let ordersCache = [];
let deliveredCache = [];
let searchActive = '';
let searchHistory = '';
let dateFilterValue = '';
let dateFilterValueDelivered = '';
let dateFilterValueTray = '';
let historyTrayFilterValue = 'all';
let editingId = null;
let hasModalChanges = false;

// ─── Tarih Formatlama (Timestamps) ──────────────────────────────
function formatDateTime(isoString) {
  if (!isoString) return '-';
  const date = new Date(isoString);
  return date.toLocaleString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── GLOBAL FONKSİYONLAR - HTML İÇİNDEN ERİŞİLEBİLMESİ İÇİN ──────
// ─── Müşteri İletişimi (WhatsApp) ──────────────────────────────
function openWhatsApp(phone, message) {
  if (!phone) return toast('Telefon numarası kayıtlı değil!', 'error');
  // Telefon numarasını temizle (boşlukları sil, başına 90 ekle)
  let cleanPhone = phone.toString().replace(/\D/g, '');
  if (cleanPhone.startsWith('0')) cleanPhone = cleanPhone.substring(1);
  if (cleanPhone.length === 10) cleanPhone = '90' + cleanPhone;

  const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
}
window.openWhatsApp = openWhatsApp;

window.toggleInfo = function (elementId) {
  const el = document.getElementById(elementId);
  if (el) el.classList.toggle('hidden');
};

window.revertToActive = async function (orderId) {
  if (!window.Swal || typeof window.Swal.fire !== 'function') {
    toast('❌ SweetAlert2 bulunamadı. Geri al onayı gösterilemiyor.', 'error');
    return;
  }

  const result = await window.Swal.fire({
    title: 'Teslimatı Geri Al?',
    text: 'Bu siparişi henüz teslim edilmedi olarak işaretleyip Aktif Siparişlere geri almak istediğinize emin misiniz?',
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#3b82f6',
    cancelButtonColor: '#6b7280',
    confirmButtonText: '<i class="fas fa-undo"></i> Evet, Geri Al',
    cancelButtonText: 'İptal'
  });
  if (!result?.isConfirmed) return;

  showLoader();
  try {
    const deliveredOrder = deliveredCache.find(o => o.id === orderId);
    if (!deliveredOrder) throw new Error('Siparişi bulunamadı');
    let orderToRevert;
    // Eğer preDeliverySnapshot varsa, orijinal verileri geri yükle
    if (deliveredOrder.preDeliverySnapshot && typeof deliveredOrder.preDeliverySnapshot === 'object') {
      orderToRevert = JSON.parse(JSON.stringify(deliveredOrder.preDeliverySnapshot));
      // Temizlik: snapshot içinde tekrar preDeliverySnapshot olmasın
      if (orderToRevert.preDeliverySnapshot) delete orderToRevert.preDeliverySnapshot;
    } else {
      orderToRevert = { ...deliveredOrder };
    }
    // Remove delivered metadata
    delete orderToRevert.id;
    delete orderToRevert.deliveredAt;
    // Ensure no preDeliverySnapshot stays in active orders
    if (orderToRevert.preDeliverySnapshot) delete orderToRevert.preDeliverySnapshot;

    const batch = db.batch();
    batch.delete(db.collection('deliveredOrders').doc(orderId));
    batch.set(db.collection('orders').doc(orderId), orderToRevert);
    await batch.commit();
    toast('↩️ Sipariş Aktif Listeye geri alındı!', 'success');
    console.log('✅ Sipariş Aktif Listeye geri alındı:', orderId);
  } catch (err) {
    console.error('❌ revertToActive hatası:', err);
    toast('Hata: ' + err.message, 'error');
  } finally {
    hideLoader();
  }
};

// =========================================================================
// ─── AUTH (GİRİŞ) VE FİREBASE DİNLEYİCİLERİ — TAMİR EDİLMİŞ KUSURSUZ SÜRÜM ───
// =========================================================================

let dashboardInitialized = false;
let authTimeout;
let redirectTimer;

function initAuthGuard() {
  // ✅ DÜZELTME: HTML'deki gerçek ID 'adminLoading' kullanılıyor
  const loadingEl = document.getElementById('adminLoading');
  const appEl = document.getElementById('dashboardApp');

  console.log('🏁 Auth Guard başlatıldı, kullanıcı bekleniyor...');
  showLoader(); // Ana yükleme başlangıcı

  auth.onAuthStateChanged(async (user) => {
    if (window.authTimeout) clearTimeout(window.authTimeout);

    try {
      if (user) {
        // ✅ KULLANICI GİRİŞ YAPTI
        if (dashboardInitialized) {
          console.log('ℹ️ Dashboard zaten başlatıldı, init atlandı.');
          return;
        }
        dashboardInitialized = true;
        console.log('✅ Auth: Kullanıcı doğrulandı:', user.email);

        const canAccessManagement = isPrivilegedUser(user.email);
        setManagementMenuVisibility(canAccessManagement);

        // ✅ Ana uygulama div'ini göster
        if (appEl) {
          appEl.classList.remove('hidden');
          appEl.style.display = '';
        }

        // Kullanıcı e-mailini göster
        const logoutUserNameEl = document.getElementById('logoutUserName');
        if (logoutUserNameEl) logoutUserNameEl.textContent = user.email;

        // Sistem Bakım ve Veri Yedeklemesi butonlarını admin/developer kullanıcıya göster/gizle
        // (updateManagementMenuVisibility ile checkUserDocument sonra çalışacak)

        // Logout butonu bağlantısı
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
          const freshBtn = logoutBtn.cloneNode(true);
          logoutBtn.parentNode.replaceChild(freshBtn, logoutBtn);
          freshBtn.addEventListener('click', logoutAdmin);
        }

        // ─── Dashboard Temel UI Verilerini Yükle ───
        try {
          console.log('⏳ UI Temelleri yükleniyor...');
          setCurrentDate();
          buildProductRows();
          setupMobileMenu();
          bindSidebar();
          bindSearch();
          if (typeof loadSettings === 'function') await loadSettings();

          // ─── GÜVENLİK: Kullanıcı dokümanını kontrol et ───────────────
          await checkUserDocument(user);

          // Excel export butonlarını role göre göster/gizle
          updateExcelExportButtonsVisibility(currentUserDoc);

          // ─── MENU VİSİBİLİTY: Sistem Bakım ve Veri Yedeklemesi menülerini göster/gizle ───
          updateManagementMenuVisibility(user);

          // Varsayılan Tab
          setDefaultTab(canAccessManagement ? 'dashboard' : 'active');

          // Modal buton bağlantıları
          bindModalEventListeners();
          bindUserManagementListeners();

          // ✅ EN KRİTİK ADIM: Firestore dinleyicilerini başlat
          console.log('⏳ Firestore verileri dinlenmeye başlanıyor...');
          listenOrders();
          listenDelivered();
          listenDeleted();

          // ✅ ZAMANLANMıŞ YEDEKLEME SİSTEMİNİ BAŞLAT
          // Başlatma rol kontrolüne bağlandı: Firestore users dokümanındaki role === 'admin' olmalı
          if (currentUserDoc && String(currentUserDoc.role || '').toLowerCase() === 'admin') {
            startScheduledBackupSystem();
          }

          // Loading ekranını gizle
          console.log('✅ Dashboard UI hazır, loading gizleniyor.');
          if (loadingEl) loadingEl.classList.add('hidden');
          hideLoader(); // Ana yükleme bitti

        } catch (dashErr) {
          console.error('❌ Dashboard UI yüklemesi patladı:', dashErr);
          showFatalError(loadingEl, 'Dashboard UI Yükleme Hatası', dashErr);
        }

      } else {
        // ❌ KULLANICI YOK
        console.warn('⚠️ Auth: Kullanıcı yok. index.html\'e yönlendiriliyor...');

        // Zamanlanmış yedekleme sistemini durdur
        stopScheduledBackupSystem();

        if (loadingEl) {
          loadingEl.innerHTML = '<div class="text-center text-blue-400"><div class="text-4xl mb-3">🔄</div><p class="text-sm">Giriş sayfasına yönlendiriliyor...</p></div>';
          loadingEl.classList.remove('hidden');
        }

        if (window.redirectTimer) clearTimeout(window.redirectTimer);
        window.redirectTimer = setTimeout(() => {
          if (!dashboardInitialized) {
            hideLoader();
            window.location.href = 'index.html';
          }
        }, 1500);
      }
    } catch (err) {
      console.error('❌ Ana Auth kontrol döngüsü patladı:', err);
      showFatalError(loadingEl, 'Kritik Sistem Hatası', err);
    }
  }, (listenerErr) => {
    console.error('❌ Auth listener patladı (Bağlantı sorunu?):', listenerErr);
    showFatalError(loadingEl, 'Bağlantı Hatası', listenerErr);
  });
}

// ─── Firestore Dinleyicileri (Hata Yakalaması Tamir Edilmiş) ──────
function listenOrders() {
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setDate(threeMonthsAgo.getDate() - 90);
  const threeMonthsAgoStr = threeMonthsAgo.toISOString().split('T')[0];

  db.collection('orders')
    .where('deliveryDate', '>=', threeMonthsAgoStr)
    .onSnapshot(snap => {
      console.log(`✅ Firestore: ${snap.docs.length} aktif sipariş güncellendi.`);
      ordersCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderStats();
      renderSummaryGrid();
      renderActiveTable();
    }, err => {
      console.error('❌❌❌ Firestore "orders" yetki hatası veya bağlantı koptu:', err);
      if (err.code === 'permission-denied') {
        handlePermissionDenied();
      } else {
        toast('Sipariş dinleme hatası: ' + err.message, 'error');
      }
    });
}

function listenDelivered() {
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setDate(threeMonthsAgo.getDate() - 90);
  const threeMonthsAgoStr = threeMonthsAgo.toISOString().split('T')[0];

  db.collection('deliveredOrders')
    .where('deliveryDate', '>=', threeMonthsAgoStr)
    .onSnapshot(snap => {
      console.log(`✅ Firestore: ${snap.docs.length} teslim sipariş güncellendi.`);
      deliveredCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderStats();
      renderHistoryTable();
      if (document.getElementById('tray-returns-panel')?.classList.contains('active')) {
        renderTrayReturns();
      }
    }, err => {
      console.error('❌❌❌ Firestore "deliveredOrders" yetki hatası:', err);
      if (err.code === 'permission-denied') {
        handlePermissionDenied();
      }
    });
}

// ─── Silinenler (deletedOrders) Firestore Dinleyicisi ────────────────
let deletedCache = [];
function listenDeleted() {
  db.collection('deletedOrders')
    .orderBy('deletedAt', 'desc')
    .onSnapshot(snap => {
      console.log(`✅ Firestore: ${snap.docs.length} silinmiş sipariş güncellendi.`);
      deletedCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Silinenler paneli açıksa anlık güncelle
      const panel = document.getElementById('deleted-orders-panel');
      if (panel && panel.classList.contains('active')) {
        renderDeletedPanel();
      }
    }, err => {
      console.warn('⚠️ deletedOrders dinleme hatası (normal olabilir, rules kontrol et):', err.message);
    });
}

// ─── Silinenler Panelini Render Et (Akordeon) ─────────────────
function renderDeletedPanel() {
  currentPanel = 'deleted';
  const container = document.getElementById('deleted-list');
  if (!container) return;
  const { headerBgClass, panelBadgeClass, panelBadgeLabel } = getPanelTheme('deleted');

  if (!deletedCache.length) {
    container.innerHTML = `<div class="text-center py-16 text-gray-400">
      <div class="text-5xl mb-3">🗑️</div>
      <p class="text-sm font-medium">Çöp kutusu boş.</p>
      <p class="text-xs mt-1 text-gray-300">Silinen siparişler burada görünür.</p>
    </div>`;
    return;
  }

  // Silinme tarihine (deletedAt) göre gün bazında grupla
  const grouped = {};
  deletedCache.forEach(o => {
    const dayKey = o.deletedAt ? o.deletedAt.split('T')[0] : 'bilinmiyor';
    if (!grouped[dayKey]) grouped[dayKey] = [];
    grouped[dayKey].push(o);
  });

  let html = '';

  Object.keys(grouped).sort().reverse().forEach(dateKey => {
    const safeDateId = 'deleted-date-' + dateKey.replace(/[^a-zA-Z0-9-]/g, '-');
    const dateStr = dateKey === 'bilinmiyor'
      ? 'Bilinmeyen Tarih'
      : new Date(dateKey + 'T00:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' });

    let cardsHtml = '';

    grouped[dateKey].forEach(o => {
      const fromLabel = o.deletedFrom === 'deliveredOrders' ? '✅ Teslim' : '📋 Aktif';
      const fromColor = o.deletedFrom === 'deliveredOrders'
        ? 'bg-emerald-100 text-emerald-700'
        : 'bg-blue-100 text-blue-700';
      const deletedTime = o.deletedAt
        ? new Date(o.deletedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
        : '—';
      const productsHtml = generateProductsHtml(o);

      cardsHtml += `
        <div class="w-full block p-0 border-b border-rose-100">
          <div class="flex justify-between items-center w-full py-3 px-4 font-bold text-gray-800 cursor-pointer bg-rose-50 hover:bg-rose-100 transition-colors" onclick="toggleDetails('del-${o.id}')">
            <div class="flex items-center gap-2 flex-wrap">
              <span>${escHtml(o.customerName)}</span>
              <span class="text-xs px-2 py-0.5 rounded-full font-medium ${panelBadgeClass}">${panelBadgeLabel}</span>
              <span class="text-xs px-2 py-0.5 rounded-full font-medium ${fromColor}">${fromLabel}</span>
              <span class="text-xs text-gray-400 font-normal">${deletedTime}</span>
            </div>
            <span class="toggle-arrow" style="transform: rotate(0deg); transition: transform 0.3s ease;">▼</span>
          </div>
          <div id="details-del-${o.id}" class="details-panel hidden w-full p-4 bg-white">
            <div class="flex flex-col md:flex-row md:justify-between gap-4 w-full">
              <div class="flex-1">
                <div class="flex flex-wrap gap-6 mb-4">
                  <div><span class="text-gray-500 block text-xs">Telefon:</span> ${escHtml(o.phoneNumber || '—')}</div>
                  <div><span class="text-gray-500 block text-xs">Teslim:</span> ${fmtDate(o.deliveryDate)}</div>
                  <div><span class="text-gray-500 block text-xs">👤 İşlemi Yapan:</span> <span class="font-semibold text-indigo-600 capitalize">${escHtml(o.addedBy || 'Sistem')}</span></div>
                </div>
                ${o.note ? `<div class="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-2 text-sm mb-3 rounded"><strong>📝 Not/Kapora:</strong> ${escHtml(o.note)}</div>` : ''}
                <div class="text-xs text-gray-600 mb-3">
                  <span class="text-gray-500 block text-xs mb-2">ÜRÜNLER:</span>
                  <div class="space-y-1">${productsHtml || '<span class="text-gray-400">Ürün bilgisi yok</span>'}</div>
                </div>
                <div class="text-xs text-gray-400 mt-2">
                  🗑️ Silinme: ${o.deletedAt ? new Date(o.deletedAt).toLocaleString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                </div>
              </div>
                <div class="flex flex-col shrink-0 w-full md:w-40 gap-2 justify-start mt-2 md:mt-0">
                <button onclick="restoreDeletedOrder('${o.id}')"
                  class="w-full px-4 py-2 bg-blue-50 text-blue-600 border border-blue-200 rounded-md hover:bg-blue-100 flex items-center justify-center gap-2 font-semibold text-sm transition-colors cursor-pointer">
                  🔄 Geri Yükle
                </button>
                ${(currentUserDoc && (currentUserDoc.role === 'admin' || currentUserDoc.isDeveloper === true)) ? `
                <button onclick="hardDeleteOrder('${o.id}')"
                  class="w-full px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-md hover:bg-red-100 flex items-center justify-center gap-2 font-semibold text-sm transition-colors cursor-pointer">
                  ⚠️ Kalıcı Sil
                </button>
                ` : ''}
              </div>
            </div>
          </div>
        </div>`;
    });

    html += `
      <div class="w-full shadow-sm rounded-lg overflow-hidden border border-gray-100 mb-1 animate-fade-up">
        <div class="px-4 py-3 text-white text-xs font-bold uppercase tracking-wide ${headerBgClass} w-full cursor-pointer flex justify-between items-center transition-colors hover:brightness-110" onclick="toggleDateGroup('${safeDateId}')">
          <span>📅 ${dateStr} — 🗑️ SİLİNENLER</span>
          <span class="transition-transform duration-300" id="date-arrow-${safeDateId}" style="transform: rotate(-90deg);">▼</span>
        </div>
        <div id="date-group-${safeDateId}" class="hidden bg-white border border-t-0 border-gray-200">
          ${cardsHtml}
        </div>
      </div>`;
  });

  container.innerHTML = html;
}

// Render deleted panel for a provided filtered list
function renderDeletedPanelFiltered(list) {
  currentPanel = 'deleted';
  const container = document.getElementById('deleted-list');
  if (!container) return;
  const { headerBgClass, panelBadgeClass, panelBadgeLabel } = getPanelTheme('deleted');

  const data = Array.isArray(list) ? list : [];

  if (!data.length) {
    container.innerHTML = `<div class="text-center py-16 text-gray-400">
      <div class="text-5xl mb-3">🗑️</div>
      <p class="text-sm font-medium">Çöp kutusu boş veya aramanıza uygun sonuç bulunamadı.</p>
    </div>`;
    return;
  }

  // group by deletedAt date (day)
  const grouped = {};
  data.forEach(o => {
    const dayKey = o.deletedAt ? o.deletedAt.split('T')[0] : 'bilinmiyor';
    if (!grouped[dayKey]) grouped[dayKey] = [];
    grouped[dayKey].push(o);
  });

  let html = '';

  Object.keys(grouped).sort().reverse().forEach(dateKey => {
    const safeDateId = 'deleted-date-' + dateKey.replace(/[^a-zA-Z0-9-]/g, '-');
    const dateStr = dateKey === 'bilinmiyor'
      ? 'Bilinmeyen Tarih'
      : new Date(dateKey + 'T00:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' });

    let cardsHtml = '';
    grouped[dateKey].forEach(o => {
      const fromLabel = o.deletedFrom === 'deliveredOrders' ? '✅ Teslim' : '📋 Aktif';
      const fromColor = o.deletedFrom === 'deliveredOrders'
        ? 'bg-emerald-100 text-emerald-700'
        : 'bg-blue-100 text-blue-700';
      const deletedTime = o.deletedAt
        ? new Date(o.deletedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
        : '—';
      const productsHtml = generateProductsHtml(o);

      cardsHtml += `
        <div class="w-full block p-0 border-b border-rose-100">
          <div class="flex justify-between items-center w-full py-3 px-4 font-bold text-gray-800 cursor-pointer bg-rose-50 hover:bg-rose-100 transition-colors" onclick="toggleDetails('del-${o.id}')">
            <div class="flex items-center gap-2 flex-wrap">
              <span>${escHtml(o.customerName)}</span>
              <span class="text-xs px-2 py-0.5 rounded-full font-medium ${panelBadgeClass}">${panelBadgeLabel}</span>
              <span class="text-xs px-2 py-0.5 rounded-full font-medium ${fromColor}">${fromLabel}</span>
              <span class="text-xs text-gray-400 font-normal">${deletedTime}</span>
            </div>
            <span class="toggle-arrow" style="transform: rotate(0deg); transition: transform 0.3s ease;">▼</span>
          </div>
          <div id="details-del-${o.id}" class="details-panel hidden w-full p-4 bg-white">
            <div class="flex flex-col md:flex-row md:justify-between gap-4 w-full">
              <div class="flex-1">
                <div class="flex flex-wrap gap-6 mb-4">
                  <div><span class="text-gray-500 block text-xs">Telefon:</span> ${escHtml(o.phoneNumber || '—')}</div>
                  <div><span class="text-gray-500 block text-xs">Teslim:</span> ${fmtDate(o.deliveryDate)}</div>
                  <div><span class="text-gray-500 block text-xs">👤 İşlemi Yapan:</span> <span class="font-semibold text-indigo-600 capitalize">${escHtml(o.addedBy || 'Sistem')}</span></div>
                </div>
                ${o.note ? `<div class="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-2 text-sm mb-3 rounded"><strong>📝 Not/Kapora:</strong> ${escHtml(o.note)}</div>` : ''}
                <div class="text-xs text-gray-600 mb-3">
                  <span class="text-gray-500 block text-xs mb-2">ÜRÜNLER:</span>
                  <div class="space-y-1">${productsHtml || '<span class="text-gray-400">Ürün bilgisi yok</span>'}</div>
                </div>
                <div class="text-xs text-gray-400 mt-2">
                  🗑️ Silinme: ${o.deletedAt ? new Date(o.deletedAt).toLocaleString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                </div>
              </div>
                <div class="flex flex-col shrink-0 w-full md:w-40 gap-2 justify-start mt-2 md:mt-0">
                <button onclick="restoreDeletedOrder('${o.id}')"
                  class="w-full px-4 py-2 bg-blue-50 text-blue-600 border border-blue-200 rounded-md hover:bg-blue-100 flex items-center justify-center gap-2 font-semibold text-sm transition-colors cursor-pointer">
                  🔄 Geri Yükle
                </button>
                ${(currentUserDoc && (currentUserDoc.role === 'admin' || currentUserDoc.isDeveloper === true)) ? `
                <button onclick="hardDeleteOrder('${o.id}')"
                  class="w-full px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-md hover:bg-red-100 flex items-center justify-center gap-2 font-semibold text-sm transition-colors cursor-pointer">` : ''}
              </div>
            </div>
          </div>
        </div>`;
    });

    html += `
      <div class="w-full shadow-sm rounded-lg overflow-hidden border border-gray-100 mb-1 animate-fade-up">
        <div class="px-4 py-3 text-white text-xs font-bold uppercase tracking-wide ${headerBgClass} w-full cursor-pointer flex justify-between items-center transition-colors hover:brightness-110" onclick="toggleDateGroup('${safeDateId}')">
          <span>📅 ${dateStr} - 🔄 İADE ALINDI</span>
          <span class="transition-transform duration-300" id="date-arrow-${safeDateId}" style="transform: rotate(-90deg);">▼</span>
        </div>
        <div id="date-group-${safeDateId}" class="hidden bg-white border border-t-0 border-gray-200">
          ${cardsHtml}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  // Re-attach event listeners
  setTimeout(() => {
    container.querySelectorAll('button[data-action]').forEach(btn => {
      btn.removeEventListener('click', handleButtonClick);
      btn.addEventListener('click', handleButtonClick);
    });
  }, 0);
}

// ─── Modal Buton Bağlantı Yardımcısı ────────────────────────────
function bindModalEventListeners() {
  const closeModal = window.closeModal; // dashboard.js'de tanımlı
  const submitOrder = window.submitOrder; // dashboard.js'de tanımlı

  const openAddBtn = document.getElementById('openAddModal');
  if (openAddBtn) openAddBtn.addEventListener('click', () => openModal(null));

  const openAddBtnGreen = document.getElementById('openAddModalFromTab');
  if (openAddBtnGreen) openAddBtnGreen.addEventListener('click', () => openModal(null));

  const closeModalBtn = document.getElementById('closeModalBtn');
  if (closeModalBtn && typeof closeModal === 'function') closeModalBtn.addEventListener('click', closeModal);

  const cancelOrderBtn = document.getElementById('cancelOrderBtn');
  if (cancelOrderBtn && typeof closeModal === 'function') cancelOrderBtn.addEventListener('click', closeModal);

  const saveOrderBtn = document.getElementById('saveOrderBtn');
  if (saveOrderBtn && typeof submitOrder === 'function') saveOrderBtn.addEventListener('click', submitOrder);

  // Canlı fiyat önizlemesi için input event'lerini bağla (number + checkbox)
  const modalInputs = document.querySelectorAll('#orderModal input[type="number"], #orderModal input[type="checkbox"]');
  modalInputs.forEach(input => {
    input.addEventListener('input', () => {
      if (typeof updatePricePreview === 'function') updatePricePreview();
    });
    input.addEventListener('change', () => {
      if (typeof updatePricePreview === 'function') updatePricePreview();
    });
  });
}

// ─── Ölümcül Hata Gösterici ──────────────────────────────────────
function showFatalError(loadingEl, title, err) {
  if (!loadingEl) return;
  loadingEl.innerHTML = `
    <div class="text-center text-red-400 px-6 py-10 bg-gray-900 rounded-3xl shadow-2xl border-2 border-red-900">
      <div class="text-5xl mb-4">🔒</div>
      <h2 class="text-xl font-bold mb-3 text-red-100">${escHtml(title)}</h2>
      <p class="text-sm mb-5 text-gray-300 max-w-md break-words">${escHtml(err.message)}</p>
      <p class="text-xs text-red-300 mb-6 p-3 bg-red-950 rounded">Hata Kodu: ${escHtml(err.code || 'Bilinmiyor')}</p>
      <button onclick="window.location.href='index.html'" class="bg-red-700 hover:bg-red-800 px-5 py-2 rounded-lg text-white font-semibold transition-colors">
        ← Giriş Sayfasına Dön
      </button>
    </div>
  `;
  loadingEl.classList.remove('hidden');
}

// ─── Başlatma (Tek, Birleşik DOMContentLoaded) ───────────────────
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Sayfa yüklendi, sistem başlatılıyor...');

  // ✅ Önce SESSION persistence'ı ayarla, SONRA auth guard'ı başlat
  auth.setPersistence(firebase.auth.Auth.Persistence.SESSION)
    .then(() => {
      console.log('✅ Auth persistence SESSION olarak ayarlandı.');
      initAuthGuard();
    })
    .catch((err) => {
      console.warn('⚠️ setPersistence başarısız, devam ediliyor:', err.message);
      initAuthGuard();
    });
});

// ─── Mobil Menü Toggle Sistemi ─────────────────────────────────
function setupMobileMenu() {
  const sidebar = document.getElementById('sidebar');
  const mobileMenuOverlay = document.getElementById('mobileMenuOverlay');
  const openMenuBtn = document.getElementById('openMobileMenu');
  const closeMenuBtn = document.getElementById('closeMobileMenu');
  const sidebarLinks = document.querySelectorAll('[data-tab]');

  if (!sidebar || !openMenuBtn) return;

  // Menüyü aç
  function openMenu() {
    sidebar.classList.remove('-translate-x-full');
    sidebar.classList.add('translate-x-0');
    if (mobileMenuOverlay) {
      mobileMenuOverlay.style.display = 'block';
    }
  }

  // Menüyü kapat
  function closeMenu() {
    sidebar.classList.add('-translate-x-full');
    sidebar.classList.remove('translate-x-0');
    if (mobileMenuOverlay) {
      mobileMenuOverlay.style.display = 'none';
    }
  }

  // Hamburger buton
  openMenuBtn.addEventListener('click', openMenu);

  // Sidebar içindeki kapı buton
  if (closeMenuBtn) {
    closeMenuBtn.addEventListener('click', closeMenu);
  }

  // Overlay'e tıklandığında kapat
  if (mobileMenuOverlay) {
    mobileMenuOverlay.addEventListener('click', closeMenu);
  }

  // Sidebar linklerine tıklandığında kapat
  sidebarLinks.forEach(link => {
    link.addEventListener('click', closeMenu);
  });

  // Pencere boyutu değiştiğinde desktop ise açık tut
  window.addEventListener('resize', () => {
    if (window.innerWidth >= 768) {
      sidebar.classList.remove('-translate-x-full');
      sidebar.classList.remove('translate-x-0');
      if (mobileMenuOverlay) {
        mobileMenuOverlay.style.display = 'none';
      }
    }
  });
}

// ─── NOT: listenOrders ve listenDelivered yukarıda (satır ~191) tek kez tanımlandı ───

// ─── ARŞIV ARAMA: 90 Günden Eski Veriler ────────────────────────────
/**
 * Aktif sipariş listesinde bulunamayan ve 90 günden eski olan siparişleri araştırır
 * Kullanım: Arama sonucunda eski kayıtları bulmak için
 */
async function searchArchiveOrders(term) {
  if (!term || term.length < 2) return [];

  try {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setDate(threeMonthsAgo.getDate() - 90);
    const threeMonthsAgoStr = threeMonthsAgo.toISOString().split('T')[0];

    // 90 günden eski TÜM siparişleri çek (limit: performans)
    const snap = await db.collection('orders')
      .where('deliveryDate', '<', threeMonthsAgoStr)
      .orderBy('deliveryDate', 'desc')
      .limit(50)
      .get();

    const archived = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return filterOrders(archived, term);
  } catch (err) {
    console.error('❌ Arşiv sipariş arama hatası:', err);
    // ℹ️ Firestore Index oluşturmak gerekebilir
    return [];
  }
}

/**
 * Teslim siparişlerinde 90 günden eski kayıtları araştırır
 * Kullanım: Eski teslim siparişlerini bulmak için
 */
async function searchArchiveDelivered(term) {
  if (!term || term.length < 2) return [];

  try {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setDate(threeMonthsAgo.getDate() - 120);
    const threeMonthsAgoStr = threeMonthsAgo.toISOString().split('T')[0];

    // 90 günden eski TÜM teslim siparişlerini çek (limit: performans)
    const snap = await db.collection('deliveredOrders')
      .where('deliveryDate', '<', threeMonthsAgoStr)
      .orderBy('deliveryDate', 'desc')
      .limit(50)
      .get();

    const archived = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return filterOrders(archived, term);
  } catch (err) {
    console.error('❌ Arşiv teslim arama hatası:', err);
    return [];
  }
}

// ─── Firestore CRUD ──────────────────────────────────────────────
async function addOrderFS(data) {
  try {
    const result = await db.collection('orders').add({ ...data, createdDate: new Date().toISOString().split('T')[0], orderCreatedAt: new Date().toISOString() });
    console.log('✅ Sipariş eklendi:', result.id);
    return result;
  } catch (err) {
    console.error('❌ addOrderFS hatası:', err);
    throw err;
  }
}

async function updateOrderFS(id, data) {
  try {
    if (!id) throw new Error('Sipariş ID geçersiz');
    await db.collection('orders').doc(id).update(data);
    console.log('✅ Sipariş güncellendi:', id);
  } catch (err) {
    console.error('❌ updateOrderFS hatası:', err);
    throw err;
  }
}

async function deleteOrderFS(id) {
  showLoader();
  try {
    if (!id) throw new Error('Sipariş ID geçersiz');
    const orderDoc = await db.collection('orders').doc(id).get();
    if (!orderDoc.exists) throw new Error('Sipariş bulunamadı');
    const orderData = { ...orderDoc.data(), deletedAt: new Date().toISOString(), deletedFrom: 'orders' };
    const batch = db.batch();
    batch.set(db.collection('deletedOrders').doc(id), orderData);
    batch.delete(db.collection('orders').doc(id));
    await batch.commit();
    console.log('✅ Sipariş çöp kutusuna taşındı:', id);
  } catch (err) {
    console.error('❌ deleteOrderFS hatası:', err);
    throw err;
  } finally {
    hideLoader();
  }
}

async function deliverOrderFS(id) {
  try {
    if (!id) throw new Error('Sipariş ID geçersiz');
    const order = ordersCache.find(o => o.id === id);
    if (!order) throw new Error('Sipariş bulunamadı');

    // Create a deep copy of the original order to store as preDeliverySnapshot
    const originalSnapshot = JSON.parse(JSON.stringify(order || {}));

    const delivered = {
      ...order,
      deliveredAt: new Date().toISOString(),
      trayReturned: false,
      trayReturnedDate: null
    };

    // Attach snapshot for undo/restore purposes
    try {
      delivered.preDeliverySnapshot = originalSnapshot;
    } catch (e) {
      console.warn('preDeliverySnapshot eklenemedi (deliverOrderFS):', e);
    }

    delete delivered.id;

    const batch = db.batch();
    batch.delete(db.collection('orders').doc(id));
    batch.set(db.collection('deliveredOrders').doc(), delivered);
    await batch.commit();
    console.log('✅ Sipariş teslim edildi:', id);
  } catch (err) {
    console.error('❌ deliverOrderFS hatası:', err);
    throw err;
  }
}

async function deleteDeliveredFS(id) {
  showLoader();
  try {
    if (!id) throw new Error('Sipariş ID geçersiz');
    const orderDoc = await db.collection('deliveredOrders').doc(id).get();
    if (!orderDoc.exists) throw new Error('Teslim siparişi bulunamadı');
    const orderData = { ...orderDoc.data(), deletedAt: new Date().toISOString(), deletedFrom: 'deliveredOrders' };
    const batch = db.batch();
    batch.set(db.collection('deletedOrders').doc(id), orderData);
    batch.delete(db.collection('deliveredOrders').doc(id));
    await batch.commit();
    console.log('✅ Teslim siparişi çöp kutusuna taşındı:', id);
  } catch (err) {
    console.error('❌ deleteDeliveredFS hatası:', err);
    throw err;
  } finally {
    hideLoader();
  }
}

// ─── Geri Yükle: deletedOrders → orijinal koleksiyona ────────────
async function restoreDeletedOrderFS(id) {
  showLoader();
  try {
    if (!id) throw new Error('Sipariş ID geçersiz');
    const deletedDoc = await db.collection('deletedOrders').doc(id).get();
    if (!deletedDoc.exists) throw new Error('Silinmiş sipariş bulunamadı');
    const data = { ...deletedDoc.data() };
    const targetCollection = data.deletedFrom === 'deliveredOrders' ? 'deliveredOrders' : 'orders';
    delete data.deletedAt;
    delete data.deletedFrom;
    const batch = db.batch();
    batch.set(db.collection(targetCollection).doc(id), data);
    batch.delete(db.collection('deletedOrders').doc(id));
    await batch.commit();
    console.log(`✅ Sipariş geri yüklendi (${targetCollection}):`, id);
  } catch (err) {
    console.error('❌ restoreDeletedOrderFS hatası:', err);
    throw err;
  } finally {
    hideLoader();
  }
}

// ─── Kalıcı Sil: deletedOrders'den tamamen yok et ────────────────
async function hardDeleteOrderFS(id) {
  showLoader();
  try {
    if (!id) throw new Error('Sipariş ID geçersiz');
    await db.collection('deletedOrders').doc(id).delete();
    console.log('✅ Sipariş kalıcı olarak silindi:', id);
  } catch (err) {
    console.error('❌ hardDeleteOrderFS hatası:', err);
    throw err;
  } finally {
    hideLoader();
  }
}

// ✅ Tepsi İade Alındı - deliveredOrders'de trayReturned = true yap
async function updateTrayReturnedFS(id) {
  try {
    if (!id) throw new Error('Sipariş ID geçersiz');
    await db.collection('deliveredOrders').doc(id).update({
      trayReturned: true,
      trayReturnedAt: new Date().toISOString(),
      tepsiDurumu: 'Alındı'
    });
    console.log('✅ Tepsi iade alındı işaretlendi:', id);
  } catch (err) {
    console.error('❌ updateTrayReturnedFS hatası:', err);
    throw err;
  }
}

// ✅ Tepsi İadesini Geri Al - trayReturned = false yap
async function revertTrayReturnFS(id) {
  try {
    if (!id) throw new Error('Sipariş ID geçersiz');
    await db.collection('deliveredOrders').doc(id).update({ trayReturned: false });
    console.log('✅ Tepsi iadesi geri alındı:', id);
  } catch (err) {
    console.error('❌ revertTrayReturnFS hatası:', err);
    throw err;
  }
}

// ─── Tarih ───────────────────────────────────────────────────────
function setCurrentDate() {
  document.getElementById('currentDate').textContent =
    new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function todayStr() { return new Date().toISOString().split('T')[0]; }

const ADMIN_EMAILS = ['admin@sofuoglu.com', 'patron@sofuoglu.com'];
function isPrivilegedUser(email) {
  const normalizedEmail = String(email || '').toLowerCase();

  // Öncelik: Firestore rol kontrolü
  if (currentUserDoc) {
    const normalizedRole = String(currentUserDoc.role || '').toLowerCase();
    if (normalizedRole === 'admin' || currentUserDoc.isDeveloper === true) {
      return true;
    }
  }

  // Fallback: admin e-posta listesi
  if (normalizedEmail && ADMIN_EMAILS.includes(normalizedEmail)) {
    return true;
  }

  return false;
}

function updateExcelExportButtonsVisibility(userData) {
  const exportButtons = [
    document.getElementById('exportActiveCSVBtn'),
    document.getElementById('exportHistoryCSVBtn'),
  ].filter(Boolean);

  if (!exportButtons.length) return;

  const role = String(userData?.role || '').toLowerCase();
  const canSee = role === 'admin' || role === 'developer';

  exportButtons.forEach((button) => {
    if (canSee) {
      button.classList.remove('hidden');
    } else {
      button.classList.add('hidden');
    }
  });
}

function setManagementMenuVisibility(isVisible) {
  const group = document.getElementById('managementMenuGroup');
  if (group) group.style.display = isVisible ? '' : 'none';
}

/**
 * Sistem Bakım ve Veri Yedeklemesi menülerini göster/gizle
 * (currentUserDoc yüklendikten sonra çağrılmalı)
 */
function updateManagementMenuVisibility(user) {
  try {
    const sistemBakimButonu = document.getElementById('nav-system-maintenance');
    const veriYedeklemeButonu = document.getElementById('nav-data-backup');

    if (user && user.email) {
      const userEmail = user.email.toLowerCase();

      // YETKİ KONTROLLERİ
      const isDeveloper = userEmail === 'admin@sofuoglu.com' || currentUserDoc?.isDeveloper === true;
      const isAdmin = isDeveloper || userEmail === 'patron@sofuoglu.com' || currentUserDoc?.role === 'admin';

      // 1. Sistem Bakım Visibility (SADECE Developer)
      if (isDeveloper) {
        if (sistemBakimButonu) sistemBakimButonu.classList.remove('hidden');
      } else {
        if (sistemBakimButonu) sistemBakimButonu.classList.add('hidden');
      }

      // 2. Veri Yedeklemesi Visibility (Developer + Admin)
      if (isAdmin) {
        if (veriYedeklemeButonu) veriYedeklemeButonu.classList.remove('hidden');
      } else {
        if (veriYedeklemeButonu) veriYedeklemeButonu.classList.add('hidden');
      }

      if (isAdmin || isDeveloper) {
        console.log(`✅ Yönetim menüleri yetkilendirildi (${userEmail})`);
      }
    }
  } catch (e) {
    // Hata olursa sessizce devam et (UI diğer parçaları etkilenmesin)
    console.warn('Sistem bakım / veri yedeklemesi butonu kontrolü sırasında hata:', e);
  }
}

window.toggleManagementMenu = function () {
  const items = document.getElementById('managementMenuItems');
  const arrow = document.getElementById('managementMenuArrow');
  if (!items) return;

  const willOpen = items.classList.contains('hidden');
  items.classList.toggle('hidden');
  items.classList.toggle('block');
  if (arrow) arrow.style.transform = willOpen ? 'rotate(180deg)' : 'rotate(0deg)';
};

function denyManagementAccess() {
  alert('Bu bölüme erişim yetkiniz yok. Sipariş ekranına yönlendiriliyorsunuz.');
  window.location.href = 'index.html';
}

window.openManagementSection = function (action) {
  if (!isPrivilegedUser(auth.currentUser?.email)) {
    denyManagementAccess();
    return;
  }

  if (action === 'dashboard') {
    setDefaultTab('dashboard');
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 50);
    return;
  }

  if (action === 'finance') {
    window.showPage('finance');
    return;
  }

  if (action === 'settings') {
    setDefaultTab('settings');
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 50);
    return;
  }

  if (action === 'maintenance') {
    window.showPage('maintenance');
    return;
  }

  if (action === 'backup') {
    window.showPage('backup');
    return;
  }

  if (action === 'user-settings') {
    setDefaultTab('user-settings');
    loadUserSettingsPage();
    return;
  }
};

// ─── Sidebar Navigation ──────────────────────────────────────────
const PAGE_META = {
  dashboard: { title: 'Ana Dashboard', sub: 'Güncel sipariş özeti' },
  active: { title: 'Aktif Siparişler', sub: 'Bekleyen ve hazırlanacak siparişler' },
  history: { title: 'Teslim Edilenler', sub: 'Tamamlanan siparişler arşivi' },
  'tray-returns': { title: 'Tepsi İadeleri', sub: 'Tepsi parası iade alınmış siparişler' },
  'deleted': { title: '🗑️ Silinenler (Çöp Kutusu)', sub: 'Geçici olarak silinen siparişler' },
  'finance': { title: '💼 Finansal Özet', sub: 'Ciro, tahsilat ve ödeme raporları' },
  'maintenance': { title: '🧰 Sistem Bakım', sub: 'Veri onarım, bağlantı testi ve sistem günlükleri' },
  'backup': { title: '💾 Veri Yedeklemesi', sub: 'Sistem verilerini indirin veya Telegram grubuna gönderin' },
  'user-settings': { title: '👥 Kullanıcı Ayarları', sub: 'Sisteme erişimi olan kullanıcıları yönetin' },
};

// ─── Panel ID Haritası ───────────────────────────────────────────
const PANEL_MAP = {
  'dashboard': 'dashboard-panel',
  'active': 'active-orders-panel',
  'history': 'delivered-panel',
  'tray-returns': 'tray-returns-panel',
  'settings': 'settings-panel',
  'deleted': 'deleted-orders-panel',
  'finance': 'financial-summary-panel',
  'maintenance': 'system-maintenance-section',
  'backup': 'data-backup-panel',
  'user-settings': 'user-settings-panel'
};

// ─── Varsayılan Tab Ayarlayıcı ───────────────────────────────────
window.setDefaultTab = function (tabName) {
  const userEmail = auth.currentUser?.email?.toLowerCase();

  // 🛡️ SİSTEM BAKIM ERİŞİM KORUMASI
  if (tabName === 'maintenance') {
    const isDeveloper = userEmail === 'admin@sofuoglu.com' || currentUserDoc?.isDeveloper === true;
    if (!isDeveloper) {
      alert('Bu alana erişim yetkiniz yok!');
      window.setDefaultTab('dashboard'); // Dashboard'a yönlendir
      return;
    }
  }

  if (['dashboard', 'settings', 'finance', 'maintenance', 'backup', 'user-settings'].includes(tabName) && !isPrivilegedUser(auth.currentUser?.email)) {
    denyManagementAccess();
    return;
  }

  const link = document.querySelector(`[data-tab="${tabName}"]`) || document.querySelector(`[data-admin-action="${tabName}"]`);
  if (!link) return;

  // ✅ ADIM 1: Tüm sidebar linklerini inaktif yap
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
  link.classList.add('active');

  // ✅ ADIM 2: Sınıfı tab-panel olan TÜM elementleri seç → hepsine active'i kaldır (hidden kalır)
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.remove('active');
  });

  // ✅ ADIM 3: Sadece hedef paneli göster
  const targetPanelId = PANEL_MAP[tabName];
  if (targetPanelId) {
    const targetPanel = document.getElementById(targetPanelId);
    if (targetPanel) targetPanel.classList.add('active');
  }

  // ✅ ADIM 4: Başlık güncelle
  const m = PAGE_META[tabName];
  if (m) {
    document.getElementById('pageTitle').textContent = m.title;
    if (document.getElementById('pageSubtitle')) {
      document.getElementById('pageSubtitle').textContent = m.sub;
    }
  }
};

// ─── Sayfa Gösterici (Scroll + Tab + Render) ─────────────────────
window.showPage = function (pageName) {
  // Tab'ı ayarla
  setDefaultTab(pageName);
  setTimeout(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, 50);

  // Finansal sayfaysa verileri yenile
  // Do not auto-initialize or fetch data for finance page — wait for user to click 'Raporu Güncelle'
  if (pageName === 'finance') {
    // leave date inputs empty by default; user will choose and click update
  }
};

function bindSidebar() {
  const managementToggle = document.getElementById('managementMenuToggle');
  if (managementToggle) {
    managementToggle.addEventListener('click', () => window.toggleManagementMenu());
  }

  document.querySelectorAll('.sidebar-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const tab = link.dataset.tab;
      const targetPanelId = PANEL_MAP[tab];

      if (!targetPanelId) return;

      // ✅ ADIM 1: Tüm sidebar linklerini inaktif yap
      document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');

      // ✅ ADIM 2: Sınıfı tab-panel olan TÜM elementleri seç → hepsine active'i kaldır
      document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.classList.remove('active');
      });

      // ✅ ADIM 3: Sadece tıklanan panelin ID'sini seç → active ekle
      const targetPanel = document.getElementById(targetPanelId);
      if (targetPanel) targetPanel.classList.add('active');

      // ✅ ADIM 4: Başlık güncelle
      const m = PAGE_META[tab];
      if (m) {
        document.getElementById('pageTitle').textContent = m.title;
        if (document.getElementById('pageSubtitle')) {
          document.getElementById('pageSubtitle').textContent = m.sub;
        }
      }

      // ✅ ADIM 5: Tepsi İadeleri açılırsa yenile
      if (tab === 'tray-returns') {
        const textTray = document.getElementById('search-text-tray');
        if (textTray) textTray.value = '';
        const dateTray = document.getElementById('filter-date-tray');
        if (dateTray) dateTray.value = '';

        dateFilterValueTray = ''; // Global filtreyi sıfırla
        renderTrayReturns();
      }

      // ✅ ADIM 6: Silinenler açılırsa yenile
      if (tab === 'deleted') {
        renderDeletedPanel();
      }

      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 50);
    });
  });

  document.querySelectorAll('[data-admin-action]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      window.openManagementSection?.(link.dataset.adminAction);
      if (window.innerWidth < 768) {
        document.getElementById('closeMobileMenu')?.click();
      }
    });
  });
}

function bindSearch() {
  const searchActiveEl = document.getElementById('searchActive');
  if (searchActiveEl) {
    searchActiveEl.addEventListener('input', e => {
      searchActive = e.target.value.trim(); renderActiveTable();
    });
    // Clear (X) button for quick clearing of the search field
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    if (clearSearchBtn) {
      // initialize visibility based on current value
      if (searchActiveEl.value && searchActiveEl.value.trim() !== '') {
        clearSearchBtn.classList.remove('hidden');
      } else {
        clearSearchBtn.classList.add('hidden');
      }

      // toggle visibility on input
      searchActiveEl.addEventListener('input', () => {
        if (searchActiveEl.value && searchActiveEl.value.trim() !== '') {
          clearSearchBtn.classList.remove('hidden');
        } else {
          clearSearchBtn.classList.add('hidden');
        }
      });

      // clear action
      clearSearchBtn.addEventListener('click', (e) => {
        e.preventDefault();
        searchActiveEl.value = '';
        clearSearchBtn.classList.add('hidden');
        // trigger existing input listeners to re-render list
        searchActiveEl.dispatchEvent(new Event('input'));
        searchActiveEl.focus();
      });
    }
  }

  const searchHistoryEl = document.getElementById('searchHistory');
  if (searchHistoryEl) {
    searchHistoryEl.addEventListener('input', e => {
      searchHistory = e.target.value.trim(); renderHistoryTable();
    });
  }

  const dateFilterEl = document.getElementById('dateFilter');
  if (dateFilterEl) {
    dateFilterEl.addEventListener('change', e => {
      dateFilterValue = e.target.value;
      renderActiveTable();
    });
  }
  const clearDateBtn = document.getElementById('clearDateBtn');
  if (clearDateBtn) {
    clearDateBtn.addEventListener('click', () => {
      if (dateFilterEl) dateFilterEl.value = '';
      dateFilterValue = '';
      renderActiveTable();
    });
  }

  // ─── TESLİM EDİLENLER & TEPSİ İADELERİ - Metin + Tarih Filtreleme ──────
  // Teslim Edilenlerin Metin Araması
  const searchTextDeliveredEl = document.getElementById('search-text-delivered');
  if (searchTextDeliveredEl) {
    searchTextDeliveredEl.addEventListener('input', () => window.filterDeliveredOrders?.());
    const clearSearchDeliveredBtn = document.getElementById('clearSearchDeliveredBtn');
    if (clearSearchDeliveredBtn) {
      if (searchTextDeliveredEl.value && searchTextDeliveredEl.value.trim() !== '') {
        clearSearchDeliveredBtn.classList.remove('hidden');
      } else {
        clearSearchDeliveredBtn.classList.add('hidden');
      }
      searchTextDeliveredEl.addEventListener('input', () => {
        if (searchTextDeliveredEl.value && searchTextDeliveredEl.value.trim() !== '') {
          clearSearchDeliveredBtn.classList.remove('hidden');
        } else {
          clearSearchDeliveredBtn.classList.add('hidden');
        }
      });
      clearSearchDeliveredBtn.addEventListener('click', (e) => {
        e.preventDefault();
        searchTextDeliveredEl.value = '';
        clearSearchDeliveredBtn.classList.add('hidden');
        searchTextDeliveredEl.dispatchEvent(new Event('input'));
        searchTextDeliveredEl.focus();
      });
    }
  }

  // Teslim Edilenlerin Tarih Filtresi
  const dateFilterDeliveredEl = document.getElementById('filter-date-delivered');
  if (dateFilterDeliveredEl) {
    dateFilterDeliveredEl.addEventListener('change', () => window.filterDeliveredOrders?.());
  }

  // Teslim Edilenler - Hızlı Tepsi Filtresi Butonları
  document.querySelectorAll('.history-tray-filter').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget;
      // Aktif stili kaldır
      document.querySelectorAll('.history-tray-filter').forEach(b => {
        b.classList.remove('bg-white', 'shadow-sm', 'text-gray-800');
        b.classList.add('text-gray-500', 'hover:text-gray-700', 'hover:bg-gray-50');
      });
      // Tıklanana aktif stili ekle
      target.classList.add('bg-white', 'shadow-sm', 'text-gray-800');
      target.classList.remove('text-gray-500', 'hover:text-gray-700', 'hover:bg-gray-50');

      historyTrayFilterValue = target.getAttribute('data-filter');
      window.filterDeliveredOrders?.();
    });
  });

  // Tepsi İadelerinin Metin Araması
  const searchTextTrayEl = document.getElementById('search-text-tray');
  if (searchTextTrayEl) {
    searchTextTrayEl.addEventListener('input', () => window.filterTrayReturns?.());
    const clearSearchTrayBtn = document.getElementById('clearSearchTrayBtn');
    if (clearSearchTrayBtn) {
      if (searchTextTrayEl.value && searchTextTrayEl.value.trim() !== '') {
        clearSearchTrayBtn.classList.remove('hidden');
      } else {
        clearSearchTrayBtn.classList.add('hidden');
      }
      searchTextTrayEl.addEventListener('input', () => {
        if (searchTextTrayEl.value && searchTextTrayEl.value.trim() !== '') {
          clearSearchTrayBtn.classList.remove('hidden');
        } else {
          clearSearchTrayBtn.classList.add('hidden');
        }
      });
      clearSearchTrayBtn.addEventListener('click', (e) => {
        e.preventDefault();
        searchTextTrayEl.value = '';
        clearSearchTrayBtn.classList.add('hidden');
        searchTextTrayEl.dispatchEvent(new Event('input'));
        searchTextTrayEl.focus();
      });
    }
  }

  // Tepsi İadelerinin Tarih Filtresi
  const dateFilterTrayEl = document.getElementById('filter-date-tray');
  if (dateFilterTrayEl) {
    dateFilterTrayEl.addEventListener('change', () => window.filterTrayReturns?.());
  }

  // Silinenler - Metin Araması (Çöp Kutusu) - buton göster/gizle ve temizle
  const searchTextDeletedEl = document.getElementById('search-text-deleted');
  if (searchTextDeletedEl) {
    // if there's a global filter function use it, otherwise dispatching input is harmless
    searchTextDeletedEl.addEventListener('input', () => window.filterDeletedOrders?.());
    const clearSearchDeletedBtn = document.getElementById('clearSearchDeletedBtn');
    if (clearSearchDeletedBtn) {
      if (searchTextDeletedEl.value && searchTextDeletedEl.value.trim() !== '') {
        clearSearchDeletedBtn.classList.remove('hidden');
      } else {
        clearSearchDeletedBtn.classList.add('hidden');
      }
      searchTextDeletedEl.addEventListener('input', () => {
        if (searchTextDeletedEl.value && searchTextDeletedEl.value.trim() !== '') {
          clearSearchDeletedBtn.classList.remove('hidden');
        } else {
          clearSearchDeletedBtn.classList.add('hidden');
        }
      });
      clearSearchDeletedBtn.addEventListener('click', (e) => {
        e.preventDefault();
        searchTextDeletedEl.value = '';
        clearSearchDeletedBtn.classList.add('hidden');
        searchTextDeletedEl.dispatchEvent(new Event('input'));
        searchTextDeletedEl.focus();
      });
    }
  }

  // ─── FİNANSAL ANALIZ PANELİ SEÇICILER ────────────────────────────────
  const updateFinanceReportBtn = document.getElementById('updateFinanceReportBtn');
  if (updateFinanceReportBtn) {
    updateFinanceReportBtn.addEventListener('click', () => {
      window.updateFinancialSummary?.();
      toast('📊 Rapor güncellendi', 'success');
    });
  }

  const resetFinanceDatesBtn = document.getElementById('resetFinanceDatesBtn');
  if (resetFinanceDatesBtn) {
    resetFinanceDatesBtn.addEventListener('click', () => {
      // Clear both date inputs and clear UI (do not auto-fetch)
      const s = document.getElementById('financeStartDate'); if (s) s.value = '';
      const e = document.getElementById('financeEndDate'); if (e) e.value = '';
      window.clearFinancialUI?.();
    });
  }
  // Date inputs intentionally do NOT auto-trigger update; user must click 'Raporu Güncelle'
}

// ─── TESLİM EDİLENLER FİLTRELEME ─────────────────────────────────
window.filterDeliveredOrders = function () {
  const textTerm = (document.getElementById('search-text-delivered')?.value || '').toLowerCase().trim();
  const dateTerm = document.getElementById('filter-date-delivered')?.value || '';

  const filtered = deliveredCache.filter(order => {
    const matchText = !textTerm ||
      (order.customerName?.toLowerCase().includes(textTerm)) ||
      (order.phoneNumber?.toString().includes(textTerm)) ||
      (order.addedBy?.toLowerCase().includes(textTerm));
    const matchDate = !dateTerm || order.deliveryDate === dateTerm;

    let matchTray = true;
    if (historyTrayFilterValue === 'pending') {
      const isTrayTaken = order.tepsiParasi === 'Alındı' ||
        order.trayDepositAdded === true ||
        (Number(order.trayDepositAmount) > 0) ||
        (Number(order.tepsiDepozito) > 0) ||
        (Number(order.trayDeposit) > 0);
      matchTray = isTrayTaken && order.trayReturned !== true;
    } else if (historyTrayFilterValue === 'done') {
      const isTrayTaken = order.tepsiParasi === 'Alındı' ||
        order.trayDepositAdded === true ||
        (Number(order.trayDepositAmount) > 0) ||
        (Number(order.tepsiDepozito) > 0) ||
        (Number(order.trayDeposit) > 0);
      matchTray = !(isTrayTaken && order.trayReturned !== true);
    }

    return matchText && matchDate && matchTray;
  });

  renderHistoryTable(filtered);
};

// ─── TEPSİ İADELERİ FİLTRELEME ──────────────────────────────────
window.filterTrayReturns = function () {
  const textTerm = (document.getElementById('search-text-tray')?.value || '').toLowerCase().trim();
  const dateTerm = document.getElementById('filter-date-tray')?.value || '';

  const trayReturnedOrders = deliveredCache.filter(o => o.trayReturned === true);
  const filtered = trayReturnedOrders.filter(order => {
    const matchText = !textTerm ||
      (order.customerName?.toLowerCase().includes(textTerm)) ||
      (order.phoneNumber?.toString().includes(textTerm));
    const matchDate = !dateTerm || order.deliveryDate === dateTerm;
    return matchText && matchDate;
  });

  renderTrayReturnsFiltered(filtered);
};

// ─── SİLİNENLER (ÇÖP KUTUSU) FİLTRELEME ─────────────────────────
window.filterDeletedOrders = function () {
  const textTerm = (document.getElementById('search-text-deleted')?.value || '').toLowerCase().trim();

  const filtered = deletedCache.filter(order => {
    const matchText = !textTerm ||
      (order.customerName?.toLowerCase().includes(textTerm)) ||
      (order.phoneNumber?.toString().includes(textTerm)) ||
      (order.addedBy?.toLowerCase().includes(textTerm));
    return matchText;
  });

  renderDeletedPanelFiltered(filtered);
};

window.deleteDeliveredOrder = async function (id) {
  if (!id) {
    console.error('❌ deleteDeliveredOrder: ID boş');
    toast('❌ Kayıt ID bulunamadı', 'error');
    return;
  }

  if (!window.Swal || typeof window.Swal.fire !== 'function') {
    toast('❌ SweetAlert2 bulunamadı. Silme onayı gösterilemiyor.', 'error');
    return;
  }

  const result = await window.Swal.fire({
    title: 'Çöp Kutusuna Taşı?',
    text: 'Bu kayıt Silinenler (Çöp Kutusu) bölümüne taşınacaktır. Emin misiniz?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#6b7280',
    confirmButtonText: '<i class="fas fa-trash-alt"></i> Evet, Çöpe Taşı',
    cancelButtonText: 'İptal'
  });
  if (!result?.isConfirmed) return;

  showLoader();
  try {
    await deleteDeliveredFS(id);
    toast('✅ Kayıt silindi.', 'success');
  } catch (err) {
    console.error('❌ deleteDeliveredOrder hatası:', err);
    toast('❌ Hata: ' + (err.message || 'Bilinmeyen hata'), 'error');
  } finally {
    hideLoader();
  }
}

// ─── Finansal Analiz Paneli ──────────────────────────────────────
window.updateFinancialSummary = function () {
  const startDateEl = document.getElementById('financeStartDate');
  const endDateEl = document.getElementById('financeEndDate');
  // Do not auto-default to today; require user to select dates
  const today = todayStr();

  // Tarih aralığını al (zorunlu)
  let startDate = startDateEl?.value || '';
  let endDate = endDateEl?.value || '';

  // Eğer tarihlerden biri boşsa, uyar ve UI'yi temizle
  if (!startDate || !endDate) {
    toast('Lütfen Başlangıç ve Bitiş tarihlerini seçiniz.', 'warning');
    window.clearFinancialUI?.();
    return;
  }

  // Başlangıç tarihi bitiş tarihinden büyükse değiştir (kullanıcı hatası için düzeltme)
  if (startDate > endDate) {
    [startDate, endDate] = [endDate, startDate];
  }

  // Helper: Sipariş toplam fiyatını hesapla (tepsi depozitosu adet × ücret dahil)
  const getOrderTotal = (o) => {
    if (o.totalPrice !== undefined) return Number(o.totalPrice);
    const trayFee = o.tepsiParasi === 'Alındı'
      ? (Number(globalPriceSettings.tray || 0) * Math.max(getTotalTrayCount(o), 1))
      : 0;
    return calculateOrderTotal(o) + trayFee;
  };

  // 1️⃣ Seçili tarih aralığında teslim edilen siparişler
  const deliveredInRange = deliveredCache.filter(o =>
    o.deliveryDate && o.deliveryDate >= startDate && o.deliveryDate <= endDate
  );

  // 2️⃣ Toplam Ciro (teslim edilen siparişler)
  const totalRevenue = deliveredInRange.reduce((sum, o) => sum + getOrderTotal(o), 0);

  // 3️⃣ Bekleyen Tahsilat (aktif siparişlerin gözlemleme - burada henüz ödenmeyen tutar)
  // Seçili tarih aralığında "delivery date" <= endDate olan aktif siparişler
  const activePending = ordersCache.filter(o =>
    o.deliveryDate && o.deliveryDate <= endDate
  );
  const pendingCollection = activePending.reduce((sum, o) => sum + getOrderTotal(o), 0);

  // 4️⃣ Net Nakit (tam ödenen + kapora alınan siparişler)
  const netCash = totalRevenue + pendingCollection;

  // 5️⃣ Ürün bazlı analiz
  const productAnalysis = {};
  let totalYufkaKg = 0;

  // Basit mapping: ürün key -> fiyat tablosundaki base anahtar
  const PRICE_BASE = {
    kareBaklava: 'kare',
    evBaklavasi: 'ev',
    sariBurma: 'sari',
    suBoregi: 'su',
    fistikliBaklava: 'fistik'
  };

  // Teslim edilen siparişlerden ürünleri topla (PRODUCTS array'ini kullan)
  deliveredInRange.forEach(order => {
    PRODUCTS.forEach(p => {
      const tepsiKey = p.key;     // örn: 'kareBaklava'
      const kgKey = p.kgKey;      // örn: 'kareBaklavaKg'

      // Siparişlerde ürün miktarları, diğer akışlarla aynı şekilde normalize edilmiş anahtar ile okunur
      const trays = Number(getProductValue(order, tepsiKey)) || 0;
      const kg = Number(getProductValue(order, kgKey)) || 0;

      if ((p.key || '').toLowerCase().includes('yufka')) {
        totalYufkaKg += kg;
        return;
      }

      if (trays > 0 || kg > 0) {
        const displayName = p.label || p.name || tepsiKey;
        if (!productAnalysis[displayName]) {
          productAnalysis[displayName] = { trays: 0, kg: 0, revenue: 0 };
        }

        productAnalysis[displayName].trays += trays;
        productAnalysis[displayName].kg += kg;

        // Fiyat anahtarını PRICE_BASE kullanarak oluştur
        const base = PRICE_BASE[tepsiKey] || tepsiKey.replace(/(Baklava|Baklavası|Burma|Böreği|li)/gi, '').toLowerCase();
        const trayPrice = Number(globalPriceSettings[base + 'tepsi']) || 0;
        const kgPrice = Number(globalPriceSettings[base + 'kg']) || 0;

        productAnalysis[displayName].revenue += (trays * trayPrice) + (kg * kgPrice);
      }
    });
  });

  const yufkaCiro = totalYufkaKg * Number(globalPriceSettings.yufkaKg || 0);

  // 📊 Arayüzü güncelle

  // Özet kartları
  document.getElementById('finance-total-revenue').textContent =
    `₺ ${totalRevenue.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  document.getElementById('finance-total-orders').textContent =
    `${deliveredInRange.length} sipariş`;

  document.getElementById('finance-pending-collection').textContent =
    `₺ ${pendingCollection.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  document.getElementById('finance-pending-orders').textContent =
    `${activePending.length} sipariş`;

  document.getElementById('finance-net-cash').textContent =
    `₺ ${netCash.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  document.getElementById('finance-net-orders').textContent =
    `${deliveredInRange.length + activePending.length} toplam`;

  // Ürün tablosu doldur
  const tableBody = document.getElementById('productAnalysisTableBody');
  if (!tableBody) return;

  const productRowsHtml = Object.entries(productAnalysis)
    .sort((a, b) => b[1].revenue - a[1].revenue) // En yüksek ciroya göre sırala
    .map(([productName, data]) => `
      <tr class="border-b border-gray-200 hover:bg-gray-50 transition">
        <td class="px-4 py-3 text-sm font-medium text-gray-800">${productName}</td>
        <td class="px-4 py-3 text-center">
          ${data.trays > 0 ? `<span class="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-bold">${data.trays} Tepsi</span>` : '-'}
        </td>
        <td class="px-4 py-3 text-center">
          ${data.kg > 0 ? `<span class="inline-block bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-bold">${data.kg} Kg</span>` : '-'}
        </td>
        <td class="px-4 py-3 text-right font-bold text-gray-900">
          ₺ ${data.revenue.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
        </td>
      </tr>
    `)
    .join('');

  const yufkaRowHtml = `
    <tr class="border-b border-gray-200 hover:bg-gray-50 transition">
      <td class="px-4 py-3 text-sm font-medium text-gray-800">Yufka</td>
      <td class="px-4 py-3 text-center">-</td>
      <td class="px-4 py-3 text-center">
        <span id="tableYufkaKg" class="inline-block bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-bold">${totalYufkaKg} Kg</span>
      </td>
      <td class="px-4 py-3 text-right font-bold text-gray-900">
        <span id="tableYufkaCiro">₺ ${yufkaCiro.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
      </td>
    </tr>`;

  if (!productRowsHtml && totalYufkaKg === 0) {
    tableBody.innerHTML = `<tr><td colspan="4" class="px-4 py-8 text-center text-gray-400 text-xs font-medium">Seçili dönemde satış kaydı yok</td></tr>`;
    return;
  }

  tableBody.innerHTML = `${productRowsHtml}${yufkaRowHtml}`;
};

// Finansal UI temizleme yardımcı fonksiyonu
window.clearFinancialUI = function () {
  const zero = '₺ 0';
  const zeroCount = '0 sipariş';
  try {
    const elTotal = document.getElementById('finance-total-revenue'); if (elTotal) elTotal.textContent = zero;
    const elTotalOrders = document.getElementById('finance-total-orders'); if (elTotalOrders) elTotalOrders.textContent = zeroCount;
    const elPending = document.getElementById('finance-pending-collection'); if (elPending) elPending.textContent = zero;
    const elPendingOrders = document.getElementById('finance-pending-orders'); if (elPendingOrders) elPendingOrders.textContent = zeroCount;
    const elNet = document.getElementById('finance-net-cash'); if (elNet) elNet.textContent = zero;
    const elNetOrders = document.getElementById('finance-net-orders'); if (elNetOrders) elNetOrders.textContent = '0 toplam';
    const tableBody = document.getElementById('productAnalysisTableBody');
    if (tableBody) tableBody.innerHTML = `<tr><td colspan="4" class="px-4 py-8 text-center text-gray-400 text-xs font-medium">Lütfen tarih seçip 'Raporu Güncelle' butonuna basın.</td></tr>`;
  } catch (e) { console.warn('clearFinancialUI hata:', e); }
};

// ─── İstatistikler ───────────────────────────────────────────────
function renderStats() {
  const today = todayStr();
  document.getElementById('stat-active').textContent = ordersCache.length;
  document.getElementById('stat-today').textContent = ordersCache.filter(o => o.deliveryDate === today).length;
  document.getElementById('stat-delivered').textContent = deliveredCache.length;

  // Finansal özeti hesapla ve yetkiye göre göster/gizle
  calculateFinance();
}

function calculateFinance() {
  const financeSection = document.getElementById('finance-summary-section');
  if (!financeSection) return;

  const email = auth.currentUser?.email;
  if (email !== 'admin@sofuoglu.com' && email !== 'patron@sofuoglu.com') {
    financeSection.style.display = 'none';
    return;
  }

  // Admin veya patron ise göster
  financeSection.style.display = 'block';

  const today = todayStr();
  const thisMonth = today.substring(0, 7); // yyyy-mm format

  // Helper: Sipariş toplam fiyatını hesapla (tepsi depozitosu adet × ücret dahil)
  const getOrderTotal = (o) => {
    if (o.totalPrice !== undefined) return Number(o.totalPrice);
    const trayFee = o.tepsiParasi === 'Alındı'
      ? (Number(globalPriceSettings.tray || 0) * Math.max(getTotalTrayCount(o), 1))
      : 0;
    return calculateOrderTotal(o) + trayFee;
  };

  // Bugünkü ciro (deliveredOrders içinde)
  const todayDelivered = deliveredCache.filter(o => o.deliveryDate === today);
  const todayRevenue = todayDelivered.reduce((sum, o) => sum + getOrderTotal(o), 0);

  // Bu haftaki ciro (Pazartesiden bugüne)
  const now = new Date();
  const day = now.getDay(); // 0 (Pazar) - 6 (Cumartesi)
  const diff = now.getDate() - (day === 0 ? 6 : day - 1); // Pazartesiye git
  const monday = new Date(now.setDate(diff));
  const mondayStr = monday.toISOString().split('T')[0];

  const weekDelivered = deliveredCache.filter(o => o.deliveryDate >= mondayStr && o.deliveryDate <= today);
  const weekRevenue = weekDelivered.reduce((sum, o) => sum + getOrderTotal(o), 0);

  // Bu ayki toplam (deliveredOrders içinde)
  const monthDelivered = deliveredCache.filter(o => o.deliveryDate && o.deliveryDate.startsWith(thisMonth));
  const monthRevenue = monthDelivered.reduce((sum, o) => sum + getOrderTotal(o), 0);

  // Bekleyen tahsilat (aktif ordersCache)
  const pendingRevenue = ordersCache.reduce((sum, o) => sum + getOrderTotal(o), 0);

  // Rakamları formatlama ve yazdırma
  document.getElementById('finance-today').textContent = `₺ ${todayRevenue.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  const financeWeekEl = document.getElementById('finance-week');
  if (financeWeekEl) financeWeekEl.textContent = `₺ ${weekRevenue.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  document.getElementById('finance-month').textContent = `₺ ${monthRevenue.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  document.getElementById('finance-pending').textContent = `₺ ${pendingRevenue.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

// ─── Dashboard Özet Grid ─────────────────────────────────────────
function renderSummaryGrid() {
  const totals = calcTotals(ordersCache);
  document.getElementById('summaryGrid').innerHTML = PRODUCTS.map((p, i) => {
    const adet = totals[p.key] || 0;
    const kg = totals[p.kgKey] || 0;
    const c = PRODUCT_COLORS[i];
    return `<div class="rounded-xl border border-${c}-100 bg-${c}-50 p-3 w-full shadow-sm animate-fade-up text-center">
      <div class="flex flex-col items-center mb-3">
        <div class="font-bold text-gray-800 text-sm truncate">${p.label}</div>
      </div>
      <div class="flex flex-wrap items-center gap-2 w-full justify-center">
        <div class="flex-1 min-w-[100px] flex items-center justify-center gap-4 bg-white px-2 py-1.5 rounded-lg border border-${c}-200/50">
          <span class="text-gray-500 text-xs">Tepsi:</span>
          <span class="font-bold text-${c}-600 text-sm truncate">${adet > 0 ? adet : '—'}</span>
        </div>
        <div class="flex-1 min-w-[100px] flex items-center justify-center gap-4 bg-white px-2 py-1.5 rounded-lg border border-${c}-200/50">
          <span class="text-gray-500 text-xs">Kg:</span>
          <span class="font-bold text-${c}-600 text-sm truncate">${kg > 0 ? fmtKg(kg) : '—'}</span>
        </div>
      </div>
    </div>`;
  }).join('');
}


// ─── Aktif Siparişler Tablosu (Accordion Mobile) ──────────────────
function renderActiveTable() {
  currentPanel = 'active';
  const tbody = document.getElementById('activeTableBody');
  let filtered = filterOrders(ordersCache, searchActive);
  if (dateFilterValue) {
    filtered = filtered.filter(o => o.deliveryDate === dateFilterValue);
  }

  if (!filtered.length) {
    if (searchActive && !dateFilterValue) {
      tbody.innerHTML = emptyRow(9, '⏳ Arşiv araştırılıyor...');

      searchArchiveOrders(searchActive).then(archiveResults => {
        if (archiveResults.length) {
          let archiveHtml = `
            <tr>
              <td colspan="9" class="p-4 text-center">
                <div class="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <div class="text-gray-700 font-semibold text-sm">📦 ARŞIV: Son 90 günden eski siparişler</div>
                  <div class="text-gray-500 text-xs mt-1">${archiveResults.length} kayıt bulundu</div>
                </div>
              </td>
            </tr>
          `;

          archiveResults.forEach(o => {
            archiveHtml += `
              <tr>
                <td colspan="9" class="p-0">
                  <div class="w-full block p-0 border-b border-emerald-100 mb-1">
                    <div class="flex justify-between items-center w-full py-3 px-4 font-bold text-gray-800 cursor-pointer bg-emerald-50 hover:bg-emerald-100 transition-colors" onclick="toggleDetails('act-arch-${o.id}')">
                      <span>${escHtml(o.customerName)}</span>
                      <span class="toggle-arrow" style="transform: rotate(0deg); transition: transform 0.3s ease;">▼</span>
                    </div>
                    <div id="details-act-arch-${o.id}" class="details-panel hidden w-full p-4 bg-white">
                      <div class="flex flex-col md:flex-row md:justify-between gap-4 w-full">
                        <div class="flex-1">
                          <div class="flex flex-wrap gap-6 mb-4">
                            <div><span class="text-gray-500 block text-xs">Telefon:</span> <a href="tel:${escHtml(o.phoneNumber || '')}" class="text-blue-600 hover:underline">${escHtml(o.phoneNumber || '—')}</a></div>
                            <div><span class="text-gray-500 block text-xs">Teslim Tarihi:</span> ${fmtDate(o.deliveryDate)}</div>
                            <div><span class="text-gray-500 block text-xs">👤 İşlemi Yapan:</span> <span class="font-semibold text-indigo-600 capitalize">${escHtml(o.addedBy || 'Sistem')}</span></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            `;
          });

          tbody.innerHTML = archiveHtml;
        } else {
          tbody.innerHTML = emptyRow(9, 'Aramanıza uygun sipariş bulunamadı.');
        }
      }).catch(err => {
        console.error('Arşiv arama hatası:', err);
        tbody.innerHTML = emptyRow(9, 'Arşiv araması başarısız oldu.');
      });
      return;
    }

    tbody.innerHTML = emptyRow(9, searchActive || dateFilterValue ? 'Aramanıza uygun sipariş bulunamadı.' : 'Henüz aktif sipariş bulunmuyor.');
    return;
  }

  const grouped = groupByDate(filtered.slice().sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate)));
  let html = '';

  Object.keys(grouped).sort().forEach(dateKey => {
    const safeDateId = 'active-date-' + dateKey.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();

    const dc = getDateClass(dateKey);
    const hdrBg = { past: 'bg-red-600', today: 'bg-green-600', future: 'bg-blue-600' }[dc] || 'bg-gray-600';
    const label = { past: '⚠️ GEÇMİŞ', today: '🟢 BUGÜN', future: '🔵 GELECEK' }[dc] || '';
    const dateStr = new Date(dateKey + 'T00:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' });

    let cardsHtml = '';
    grouped[dateKey].sort((a, b) => a.customerName.localeCompare(b.customerName, 'tr')).forEach(o => {
      const productsHtml = generateProductsHtml(o);

      cardsHtml += `
        <div class="w-full block p-0 border-b border-blue-100">
          <div class="flex justify-between items-center w-full py-3 px-4 font-bold text-gray-800 cursor-pointer bg-blue-50 hover:bg-blue-100 transition-colors" onclick="toggleDetails('act-${o.id}')">
            <span>${escHtml(o.customerName)}</span>
            <span class="toggle-arrow" style="transform: rotate(0deg); transition: transform 0.3s ease;">▼</span>
          </div>

          <div id="details-act-${o.id}" class="details-panel hidden w-full p-4 bg-white">
            <div class="flex flex-col md:flex-row md:justify-between gap-4 w-full">
              
              <div class="flex-1">
                <div class="flex flex-wrap gap-6 mb-4">
                  <div><span class="text-gray-500 block text-xs">Telefon:</span> <a href="tel:${escHtml(o.phoneNumber || '')}" class="text-blue-600 hover:underline">${escHtml(o.phoneNumber || '—')}</a></div>
                  <div><span class="text-gray-500 block text-xs">Teslim Tarihi:</span> ${fmtDate(o.deliveryDate)}</div>
                  <div><span class="text-gray-500 block text-xs">👤 İşlemi Yapan:</span> <span class="font-semibold text-indigo-600 capitalize">${escHtml(o.addedBy || 'Sistem')}</span></div>
                </div>
                
                ${o.note ? `<div class="bg-yellow-50 border-l-4 border-yellow-400 text-yellow-700 p-2 text-xs mb-3 rounded"><strong>📝 Not/Kapora:</strong> ${escHtml(o.note)}</div>` : ''}
                
                <div class="text-xs text-gray-600 mb-3">
                  <span class="text-gray-500 block text-xs mb-2">ÜRÜNLER:</span>
                  <div class="space-y-1">${productsHtml || '<span class="text-gray-400">Ürün bilgisi yok</span>'}</div>
                </div>

                <div class="flex flex-col gap-1 mt-2 text-xs text-gray-400 border-t border-gray-100 pt-2">
                  ${o.orderCreatedAt ? `<div>⏰ Alındı: ${formatDateTime(o.orderCreatedAt)}</div>` : ''}
                </div>
              </div>

              <div class="flex flex-col shrink-0 w-full md:w-40 gap-1 justify-start mt-2 md:mt-0">
                <button type="button" class="w-full px-3 py-1.5 bg-green-500 text-white rounded-md hover:bg-green-600 flex items-center justify-center gap-2 font-semibold text-sm transition-all duration-200 transform hover:scale-105 active:scale-95 hover:shadow-md cursor-pointer" data-action="whatsapp" data-order-id="${o.id}" data-msg-type="reminder">
                  📱 Hatırlat
                </button>
                <button type="button" class="w-full px-3 py-1.5 bg-slate-700 text-white rounded-md hover:bg-slate-800 flex items-center justify-center gap-2 font-semibold text-sm transition-all duration-200 transform hover:scale-105 active:scale-95 hover:shadow-md cursor-pointer" data-action="printReceipt" data-order-id="${o.id}">🖨️ Fiş Çıkar</button>
                <button class="w-full px-4 py-2 bg-blue-50 text-blue-600 border border-blue-200 rounded-md hover:bg-blue-100 flex items-center justify-center gap-2 font-semibold text-sm transition-all duration-200 transform hover:scale-105 active:scale-95 hover:shadow-md cursor-pointer" data-action="edit" data-order-id="${o.id}">✏️ Güncelle</button>
                <button class="w-full px-4 py-2 bg-green-50 text-green-600 border border-green-200 rounded-md hover:bg-green-100 flex items-center justify-center gap-2 font-semibold text-sm transition-all duration-200 transform hover:scale-105 active:scale-95 hover:shadow-md cursor-pointer" data-action="deliver" data-order-id="${o.id}">✅ Teslim Et</button>
                <button class="w-full px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-md hover:bg-red-100 flex items-center justify-center gap-2 font-semibold text-sm transition-all duration-200 transform hover:scale-105 active:scale-95 hover:shadow-md cursor-pointer" data-action="delete" data-order-id="${o.id}">🗑️ Sil</button>
              </div>
            </div>
          </div>
        </div>`;
    });

    html += `
      <tr>
        <td colspan="10" class="p-0">
          <div class="w-full shadow-sm rounded-lg overflow-hidden border border-gray-100 mb-1 animate-fade-up">
            <div class="px-4 py-3 text-white text-xs font-bold uppercase tracking-wide ${hdrBg} w-full cursor-pointer flex justify-between items-center transition-colors hover:brightness-110" onclick="toggleDateGroup('${safeDateId}')">
              <span>📅 ${dateStr} ${label ? '- ' + label : ''}</span>
              <span class="transition-transform duration-300" id="date-arrow-${safeDateId}" style="transform: rotate(-90deg);">▼</span>
            </div>
            <div id="date-group-${safeDateId}" class="hidden bg-white border border-t-0 border-gray-200">
              ${cardsHtml}
            </div>
          </div>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;

  // Event Listeners Attach
  setTimeout(() => {
    tbody.querySelectorAll('button[data-action]').forEach(btn => {
      btn.removeEventListener('click', handleButtonClick);
      btn.addEventListener('click', handleButtonClick);
    });
  }, 0);
}

// ─── Button Click Handler ─────────────────────────────────────────
function handleButtonClick(e) {
  const action = this.dataset.action;
  const orderId = this.dataset.orderId;

  if (action === 'edit') openModal(orderId);
  else if (action === 'deliver') deliverOrder(orderId);
  else if (action === 'delete') deleteOrder(orderId);
  else if (action === 'deleteDelivered') deleteDeliveredOrder(orderId);
  else if (action === 'markTrayReturned') markTrayReturned(orderId);
  else if (action === 'revertTrayReturn') revertTrayReturn(orderId);
  else if (action === 'printReceipt') printReceipt(orderId);
  else if (action === 'whatsapp') {
    const msgType = this.dataset.msgType;
    handleWhatsAppClick(orderId, msgType);
  }
}

// ─── Geçmiş Tablosu (Accordion Mobile) ─────────────────────────────
function renderHistoryTable(filteredData = null) {
  currentPanel = 'history';
  const container = document.getElementById('history-list') || document.getElementById('historyTableBody');
  if (!container) return;

  let filtered = filteredData !== null ? filteredData : filterOrders(deliveredCache, searchHistory);
  if (filteredData === null && dateFilterValueDelivered) {
    filtered = filtered.filter(o => o.deliveryDate === dateFilterValueDelivered);
  }

  if (!filtered.length) {
    if (searchHistory && !dateFilterValueDelivered) {
      container.innerHTML = `<div class="text-center py-16 text-gray-500"><p>⏳ Arşiv araştırılıyor...</p></div>`;
      searchArchiveDelivered(searchHistory).then(archiveResults => {
        if (archiveResults.length) {
          let archiveHtml = `
            <div class="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center mb-4 mx-2">
              <div class="text-gray-700 font-semibold text-sm">📦 ARŞIV: Son 90 günden eski teslim siparişleri</div>
              <div class="text-gray-500 text-xs mt-1">${archiveResults.length} kayıt bulundu</div>
            </div>
          `;

          archiveResults.forEach(o => {
            archiveHtml += `
              <div class="w-full block p-0 border-b border-emerald-100 mb-1">
                <div class="flex justify-between items-center w-full py-3 px-4 font-bold text-gray-800 cursor-pointer bg-emerald-50 hover:bg-emerald-100 transition-colors" onclick="toggleDetails('hist-${o.id}')">
                  <span>${escHtml(o.customerName)}</span>
                  <span class="toggle-arrow" style="transform: rotate(0deg); transition: transform 0.3s ease;">▼</span>
                </div>
                <div id="details-hist-${o.id}" class="details-panel hidden w-full p-4 bg-white">
                  <div class="text-xs text-gray-600 space-y-1">
                    <div>📞 <a href="tel:${escHtml(o.phoneNumber || '')}" class="text-blue-600 hover:underline">${escHtml(o.phoneNumber || '')}</a></div>
                    <div>📅 ${fmtDate(o.deliveryDate)}</div>
                    <div><span class="text-gray-500 block text-xs mt-1">👤 İşlemi Yapan:</span> <span class="font-semibold text-indigo-600 capitalize">${escHtml(o.addedBy || 'Sistem')}</span></div>
                    ${o.trayReturned ? '<div class="text-green-700 font-semibold mt-1">🔄 ✅ İade Edildi</div>' : ''}
                  </div>
                </div>
              </div>
            `;
          });
          container.innerHTML = archiveHtml;
        } else {
          container.innerHTML = `<div class="text-center py-16 text-gray-500"><p>Aramanıza uygun kayıt bulunamadı.</p></div>`;
        }
      }).catch(err => {
        container.innerHTML = `<div class="text-center py-16 text-red-500"><p>Arşiv araması başarısız oldu.</p></div>`;
      });
      return;
    }

    container.innerHTML = `<div class="text-center py-16 text-gray-400">
      <div class="text-5xl mb-3">📦</div>
      <p class="text-sm font-medium">Teslim edilen sipariş bulunamadı.</p>
    </div>`;
    return;
  }

  // Tarihe göre grupla
  const grouped = groupByDate(filtered.slice().sort((a, b) => b.deliveryDate.localeCompare(a.deliveryDate)));
  let html = '';

  Object.keys(grouped).sort().reverse().forEach(dateKey => {
    const safeDateId = 'history-date-' + dateKey.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
    const dateStr = new Date(dateKey + 'T00:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' });

    let cardsHtml = '';
    grouped[dateKey].forEach(o => {
      const productsHtml = generateProductsHtml(o);

      cardsHtml += `
        <div class="w-full block p-0 border-b border-emerald-100">
          <div class="flex justify-between items-center w-full py-3 px-4 font-bold text-gray-800 cursor-pointer bg-emerald-50 hover:bg-emerald-100 transition-colors" onclick="toggleDetails('hist-${o.id}')">
            <span>${escHtml(o.customerName)}</span>
            <span class="toggle-arrow" style="transform: rotate(0deg); transition: transform 0.3s ease;">▼</span>
          </div>

          <div id="details-hist-${o.id}" class="details-panel hidden w-full p-4 bg-white">
            <div class="flex flex-col md:flex-row md:justify-between gap-4 w-full">
              
              <div class="flex-1">
                <div class="flex flex-wrap gap-6 mb-4">
                  <div><span class="text-gray-500 block text-xs">Telefon:</span> <a href="tel:${escHtml(o.phoneNumber || '')}" class="text-blue-600 hover:underline">${escHtml(o.phoneNumber || '—')}</a></div>
                  <div><span class="text-gray-500 block text-xs">Teslim Tarihi:</span> ${fmtDate(o.deliveryDate)}</div>
                  <div><span class="text-gray-500 block text-xs">👤 İşlemi Yapan:</span> <span class="font-semibold text-indigo-600 capitalize">${escHtml(o.addedBy || 'Sistem')}</span></div>
                </div>
                
                ${o.note ? `<div class="bg-yellow-50 border-l-4 border-yellow-400 text-yellow-700 p-2 text-xs mb-3 rounded"><strong>📝 Not/Kapora:</strong> ${escHtml(o.note)}</div>` : ''}
                
                <div class="text-xs text-gray-600 mb-3">
                  <span class="text-gray-500 block text-xs mb-2">ÜRÜNLER:</span>
                  <div class="space-y-1">${productsHtml || '<span class="text-gray-400">Ürün bilgisi yok</span>'}</div>
                </div>

                <div class="flex flex-col gap-1 mt-2 text-xs text-gray-400 border-t border-gray-100 pt-2">
                  ${o.orderCreatedAt ? `<div>⏰ Alındı: ${formatDateTime(o.orderCreatedAt)}</div>` : ''}
                  ${o.deliveredAt ? `<div>✅ Teslim Edildi: ${formatDateTime(o.deliveredAt)}</div>` : ''}
                </div>
              </div>

              <div class="flex flex-col shrink-0 w-full md:w-40 gap-1 justify-start mt-2 md:mt-0">
                <button type="button" class="w-full px-3 py-1.5 bg-green-500 text-white rounded-md hover:bg-green-600 flex items-center justify-center gap-2 font-semibold text-sm transition-all duration-200 transform hover:scale-105 active:scale-95 hover:shadow-md cursor-pointer" data-action="whatsapp" data-order-id="${o.id}" data-msg-type="thankyou">
                  <i class="fas fa-thumbs-up"></i> Teşekkür Et
                </button>
                ${(o.tepsiParasi !== 'Alındı' && !o.trayReturned) ? `
                <button type="button" class="w-full px-3 py-1.5 bg-orange-500 text-white rounded-md hover:bg-orange-600 flex items-center justify-center gap-2 font-semibold text-sm transition-all duration-200 transform hover:scale-105 active:scale-95 hover:shadow-md cursor-pointer" data-action="whatsapp" data-order-id="${o.id}" data-msg-type="tray-request">
                  <i class="fas fa-bell"></i> Tepsi İste
                </button>
                ` : ''}
                <button type="button" class="w-full px-3 py-1.5 bg-slate-700 text-white rounded-md hover:bg-slate-800 flex items-center justify-center gap-2 font-semibold text-sm transition-all duration-200 transform hover:scale-105 active:scale-95 hover:shadow-md cursor-pointer" data-action="printReceipt" data-order-id="${o.id}">
                  🖨️ Fiş Çıkar
                </button>
                <button onclick="revertToActive('${o.id}')" class="w-full px-4 py-2 bg-orange-50 text-orange-600 border border-orange-200 rounded-md hover:bg-orange-100 flex items-center justify-center gap-2 font-semibold text-sm transition-all duration-200 transform hover:scale-105 active:scale-95 hover:shadow-md cursor-pointer">
                  ↩️ Geri Al
                </button>
                ${!o.trayReturned ? `
                <button class="w-full px-4 py-2 bg-green-50 text-green-600 border border-green-200 rounded-md hover:bg-green-100 flex items-center justify-center gap-2 font-semibold text-sm transition-all duration-200 transform hover:scale-105 active:scale-95 hover:shadow-md cursor-pointer" data-action="markTrayReturned" data-order-id="${o.id}">
                  🔄 Tepsi İade
                </button>
                ` : `
                <div class="w-full px-4 py-2 bg-green-100 text-green-700 border border-green-200 rounded-md flex items-center justify-center gap-2 font-semibold text-sm cursor-default">
                  ✅ İade Alındı
                </div>
                `}
                <button class="w-full px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-md hover:bg-red-100 flex items-center justify-center gap-2 font-semibold text-sm transition-all duration-200 transform hover:scale-105 active:scale-95 hover:shadow-md cursor-pointer" data-action="deleteDelivered" data-order-id="${o.id}">
                  🗑️ Sil
                </button>
              </div>
            </div>
          </div>
        </div>`;
    });

    html += `
      <div class="w-full shadow-sm rounded-lg overflow-hidden border border-gray-100 mb-1 animate-fade-up">
        <div class="px-4 py-3 text-white text-xs font-bold uppercase tracking-wide bg-emerald-600 w-full cursor-pointer flex justify-between items-center transition-colors hover:brightness-110" onclick="toggleDateGroup('${safeDateId}')">
          <span>📅 ${dateStr} - ✅ TESLİM EDİLDİ</span>
          <span class="transition-transform duration-300" id="date-arrow-${safeDateId}" style="transform: rotate(-90deg);">▼</span>
        </div>
        <div id="date-group-${safeDateId}" class="hidden bg-white border border-t-0 border-gray-200">
          ${cardsHtml}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  // Event Listeners Attach
  setTimeout(() => {
    container.querySelectorAll('button[data-action]').forEach(btn => {
      btn.removeEventListener('click', handleButtonClick);
      btn.addEventListener('click', handleButtonClick);
    });
  }, 0);
}
// ─── Toggle Details (Accordion Toggle Fonksiyonu) ─────────────────
window.toggleDetails = function (orderId) {
  const detailEl = document.getElementById(`details-${orderId}`);
  if (!detailEl) return;

  const isHidden = detailEl.classList.contains('hidden');
  detailEl.classList.toggle('hidden');

  // Arrow animasyonu
  const headerDiv = detailEl.previousElementSibling;
  if (headerDiv) {
    const arrow = headerDiv.querySelector('.toggle-arrow');
    if (arrow) {
      arrow.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
    }
  }
};

// ─── Global Date Group Accordion Handler ──────────────────────────
window.toggleDateGroup = function (groupId) {
  const groupEl = document.getElementById(`date-group-${groupId}`);
  const arrowEl = document.getElementById(`date-arrow-${groupId}`);
  if (!groupEl) return;

  const isHidden = groupEl.classList.contains('hidden');
  if (isHidden) {
    groupEl.classList.remove('hidden');
    groupEl.classList.add('block');
    if (arrowEl) arrowEl.style.transform = 'rotate(0deg)';
  } else {
    groupEl.classList.remove('block');
    groupEl.classList.add('hidden');
    if (arrowEl) arrowEl.style.transform = 'rotate(-90deg)';
  }
};

// ─── Modal ───────────────────────────────────────────────────────
function buildProductRows() {
  document.getElementById('productRows').innerHTML = PRODUCTS.map(p => {
    // Yufka için Tepsi input'u disabled
    const tepsiBoundClass = p.key === 'yufka' ? 'bg-gray-100 opacity-50 cursor-not-allowed' : '';
    const tepsiBoundDisabled = p.key === 'yufka' ? 'disabled' : '';

    return `
      <div class="prod-row grid grid-cols-5 items-center px-4 py-3">
        <div class="col-span-2 flex flex-col items-start">
          <div class="text-sm font-medium text-gray-700">${p.label}</div>
        </div>
        <div><input type="number" id="f_${p.key}" min="0" step="1" placeholder="0" ${tepsiBoundDisabled}
          class="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center transition ${tepsiBoundClass}"></div>
        <div><input type="number" id="f_${p.kgKey}" min="0" step="0.5" placeholder="0.0"
          class="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center transition"></div>
        <div></div>
      </div>`;
  }).join('');
}

function openModal(orderId) {
  editingId = orderId;
  const isNew = orderId === null;
  document.getElementById('modalTitle').textContent = isNew ? 'Yeni Sipariş Ekle' : 'Siparişi Güncelle';

  if (isNew) {
    document.getElementById('fName').value = '';
    document.getElementById('fPhone').value = '';
    document.getElementById('fDate').value = '';
    document.getElementById('order-note').value = '';
    PRODUCTS.forEach(p => { document.getElementById('f_' + p.key).value = ''; document.getElementById('f_' + p.kgKey).value = ''; });
  } else {
    const o = ordersCache.find(x => x.id === orderId);
    if (!o) return;
    document.getElementById('fName').value = o.customerName;
    document.getElementById('fPhone').value = o.phoneNumber;
    document.getElementById('fDate').value = o.deliveryDate;
    document.getElementById('order-note').value = o.note || '';
    PRODUCTS.forEach(p => {
      document.getElementById('f_' + p.key).value = getProductValue(o, p.key) || '';
      document.getElementById('f_' + p.kgKey).value = getProductValue(o, p.kgKey) || '';
    });
  }

  // HTML tarafında geçmiş tarih seçimini engellemek için min özniteliğini ayarla
  const fDateEl = document.getElementById('fDate');
  if (fDateEl) {
    fDateEl.setAttribute('min', todayStr());
  }

  // ✅ Form değişikliklerini izlemek için listener ekle
  const formInputs = document.querySelectorAll('#fName, #fPhone, #fDate, #order-note, [id^="f_"]');
  formInputs.forEach(input => {
    input.addEventListener('change', () => { hasModalChanges = true; });
    input.addEventListener('input', () => { hasModalChanges = true; });
  });

  hasModalChanges = false;
  document.getElementById('orderModal').classList.add('open');
}

function closeModal() {
  // ✅ Kaydedilmemiş değişiklik varsa uyarı ver
  if (hasModalChanges) {
    if (!window.Swal || typeof window.Swal.fire !== 'function') {
      toast('❌ SweetAlert2 bulunamadı. Çıkış onayı gösterilemiyor.', 'error');
      return;
    }

    window.Swal.fire({
      title: 'Değişiklikler Kaydedilmedi',
      text: 'Kaydedilmemiş değişiklikleriniz var! Çıkmak istediğinize emin misiniz?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#3b82f6',
      cancelButtonColor: '#6b7280',
      confirmButtonText: '<i class="fas fa-undo"></i> Evet, Çık',
      cancelButtonText: 'İptal'
    }).then((result) => {
      if (!result?.isConfirmed) return;
      document.getElementById('orderModal').classList.remove('open');
      editingId = null;
      hasModalChanges = false;
    });
    return;
  }
  document.getElementById('orderModal').classList.remove('open');
  editingId = null;
}

async function submitOrder() {
  const name = document.getElementById('fName').value.trim();
  const phone = document.getElementById('fPhone').value.trim();
  const date = document.getElementById('fDate').value;

  if (!name) { toast('Müşteri adı zorunludur!', 'error'); return; }
  if (!phone) { toast('Telefon numarası zorunludur!', 'error'); return; }
  if (!date) { toast('Teslim tarihi zorunludur!', 'error'); return; }

  // Geçmiş tarih kontrolü
  const todayDateStr = todayStr();
  if (date < todayDateStr) {
    toast('Geçmiş bir tarih seçilemez!', 'error');
    return;
  }

  let hasNegative = false;
  let hasInvalidFormat = false;
  let totalAdet = 0;
  let totalKg = 0;
  const productData = {};

  PRODUCTS.forEach(p => {
    const adetVal = document.getElementById('f_' + p.key).value;
    const kgVal = document.getElementById('f_' + p.kgKey).value;

    if (adetVal !== '' && Number(adetVal) < 0) hasNegative = true;
    if (kgVal !== '' && Number(kgVal) < 0) hasNegative = true;

    if (adetVal !== '' && Number(adetVal) > 0) {
      if (!Number.isInteger(Number(adetVal)) || Number(adetVal) < 0) hasInvalidFormat = true;
    }
    if (kgVal !== '' && Number(kgVal) > 0) {
      if (Number(kgVal) < 0) hasInvalidFormat = true;
    }

    const adet = parseInt(adetVal) || 0;
    const kg = parseFloat(kgVal) || 0;
    totalAdet += adet;
    totalKg += kg;
    productData[p.key] = adet;
    productData[p.kgKey] = kg;
  });

  if (hasNegative) {
    toast('Tepsi ve Kg değerleri 0 veya daha büyük olmalıdır!', 'error');
    return;
  }
  if (hasInvalidFormat) {
    toast('Lütfen tepsi için tam sayı, Kg için geçerli bir miktar giriniz!', 'error');
    return;
  }
  if (totalAdet === 0 && totalKg === 0) {
    toast('Lütfen en az bir ürün için geçerli bir miktar (Tepsi veya Kg) giriniz!', 'error');
    return;
  }

  showLoader(); // ✅ Tüm doğrulamalar bittikten sonra loader aç

  let calculatedTotal = calculateOrderTotal(productData);

  const payload = {
    customerName: name,
    phoneNumber: phone,
    deliveryDate: date,
    note: document.getElementById('order-note').value.trim(),
    totalPrice: calculatedTotal,
    addedBy: auth.currentUser ? auth.currentUser.email.split('@')[0] : 'Bilinmiyor',
    ...productData,
  };

  const saveBtn = document.getElementById('saveOrderBtn');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = 'Kaydediliyor...';
  }

  try {
    if (editingId === null) {
      await addOrderFS(payload);
      toast('✅ Sipariş başarıyla eklendi!', 'success');
    } else {
      await updateOrderFS(editingId, payload);
      toast('✏️ Sipariş güncellendi!', 'success');
    }
    hasModalChanges = false;
    document.getElementById('fName').value = '';
    document.getElementById('fPhone').value = '';
    document.getElementById('fDate').value = '';
    document.getElementById('order-note').value = '';
    PRODUCTS.forEach(p => {
      document.getElementById('f_' + p.key).value = '';
      document.getElementById('f_' + p.kgKey).value = '';
    });
  } catch (err) {
    console.error('❌ Sipariş kaydetme hatası:', err);
    toast('❌ Hata: ' + (err.message || 'Bilinmeyen hata'), 'error');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = 'Kaydet';
    }
    // ✅ KESİNLİKLE modal kapanır
    closeModal();
    hideLoader();
  }
}

// ─── İşlemler ────────────────────────────────────────────────────
async function deliverOrder(id) {
  if (!id) {
    console.error('❌ deliverOrder: ID boş');
    toast('❌ Sipariş ID bulunamadı', 'error');
    return;
  }

  // Siparişi cache'den bul
  const order = ordersCache.find(o => o.id === id);
  if (!order) {
    console.error('❌ deliverOrder: Sipariş bulunamadı', id);
    toast('❌ Sipariş bulunamadı', 'error');
    return;
  }

  // Kasa özetini aç
  await openCheckoutModal(id, order);
}

// ─── Kasa Özeti Modalini Aç ────────────────────────────────────
async function openCheckoutModal(orderId, order) {
  try {
    // Temel bilgileri doldur
    document.getElementById('deliveryModalCustomerName').textContent = order.customerName || '—';
    document.getElementById('deliveryModalDeliveryDate').textContent = fmtDate(order.deliveryDate) || '—';

    // ════════════════════════════════════════════════════════════
    // 1. ÜRÜN LİSTESİNİ BİNA
    // ════════════════════════════════════════════════════════════
    const productList = document.getElementById('deliveryProductList');
    productList.innerHTML = '';

    let subtotal = 0;
    const prices = globalPriceSettings || {};

    PRODUCTS.forEach(product => {
      const trays = Number(getProductValue(order, product.key)) || 0;
      const kgs = Number(getProductValue(order, product.kgKey)) || 0;

      // Her iki miktar da 0 ise atla
      if (trays === 0 && kgs === 0) return;

      // Fiyatları al
      let trayPrice = 0, kgPrice = 0;
      if (product.key === 'kareBaklava') {
        trayPrice = prices.karetepsi || 0;
        kgPrice = prices.karekg || 0;
      } else if (product.key === 'evBaklavasi') {
        trayPrice = prices.evtepsi || 0;
        kgPrice = prices.evkg || 0;
      } else if (product.key === 'sariBurma') {
        trayPrice = prices.saritepsi || 0;
        kgPrice = prices.sarikg || 0;
      } else if (product.key === 'suBoregi') {
        trayPrice = prices.sutepsi || 0;
        kgPrice = prices.sukg || 0;
      } else if (product.key === 'fistikliBaklava') {
        trayPrice = prices.fistiktepsi || 0;
        kgPrice = prices.fistikkg || 0;
      } else if (product.key === 'yufka') {
        trayPrice = prices.yufkatepsi || 0;
        kgPrice = getYufkaKgPrice(prices) || 0;
      }

      // Satır toplamı
      const trayTotal = trays * trayPrice;
      const kgTotal = kgs * kgPrice;
      const lineTotal = trayTotal + kgTotal;
      subtotal += lineTotal;

      // Ürün adını temizle
      const cleanLabel = stripEmojis(product.label || product.key || 'Ürün');

      // Satırı oluştur
      const row = document.createElement('div');
      row.className = 'px-3 py-2.5 grid grid-cols-12 gap-2 text-sm items-center bg-white hover:bg-gray-50';
      row.innerHTML = `
        <div class="col-span-5 font-medium text-gray-700">${escHtml(cleanLabel)}</div>
        <div class="col-span-3 text-center text-gray-600">
          ${trays > 0 ? `<div class="text-xs">${trays} Tepsi</div>` : ''}
          ${kgs > 0 ? `<div class="text-xs">${fmtKg(kgs)} Kg</div>` : ''}
        </div>
        <div class="col-span-4 text-right font-semibold text-gray-800">${lineTotal.toLocaleString('tr-TR')} ₺</div>
      `;
      productList.appendChild(row);
    });

    // Tepsi ve zini depozitolarını ekle
    const baklavaTepsiCount =
      (Number(order.kareBaklava) || 0) +
      (Number(order.evBaklavasi) || 0) +
      (Number(order.sariBurma) || 0) +
      (Number(order.fistikliBaklava) || 0);

    const baklavaTepsiDeposit = baklavaTepsiCount * (prices.baklavaDepozito || 0);
    if (baklavaTepsiDeposit > 0) {
      const row = document.createElement('div');
      row.className = 'px-3 py-2.5 grid grid-cols-12 gap-2 text-sm bg-gray-50 border-t border-gray-200 items-center';
      row.innerHTML = `
        <div class="col-span-5 font-medium text-gray-700">Baklava Tepsi Deposutu</div>
        <div class="col-span-3 text-center text-gray-600">${baklavaTepsiCount} × ${(prices.baklavaDepozito || 0).toLocaleString('tr-TR')}</div>
        <div class="col-span-4 text-right font-semibold text-gray-800">+ ${baklavaTepsiDeposit.toLocaleString('tr-TR')} ₺</div>
      `;
      productList.appendChild(row);
      subtotal += baklavaTepsiDeposit;
    }

    // Su Böreği tepsi sayısını alıyoruz ve depozitoyu (Zaten fiyatın içinde) gösteriyoruz
    const suBoregiCount = Number(order.suBoregi) || 0;
    const ziniDeposit = suBoregiCount * 400;

    if (ziniDeposit > 0) {
      const row = document.createElement('div');
      row.className = 'px-3 py-2.5 grid grid-cols-12 gap-2 text-sm bg-gray-50 border-t border-gray-200 items-center';
      row.innerHTML = `
        <div class="col-span-5 font-medium text-gray-700">Zini (Su Böreği) Depozitosu (Peşin)</div>
        <div class="col-span-3 text-center text-gray-600">${suBoregiCount} × 400</div>
        <div class="col-span-4 text-right font-semibold text-gray-800">+ ${ziniDeposit.toLocaleString('tr-TR')} ₺</div>
      `;
      productList.appendChild(row);
      subtotal += ziniDeposit;
    }

    // ════════════════════════════════════════════════════════════
    // 2. KAPORA HESAPLA
    // ════════════════════════════════════════════════════════════
    const deposit = Number(order.deposit || order.kapora || 0) || 0;
    const depositDeductionContainer = document.getElementById('depositDeductionContainer');
    if (deposit > 0) {
      document.getElementById('deliveryDepositAmount').textContent = '- ₺' + deposit.toLocaleString('tr-TR');
      depositDeductionContainer.classList.remove('hidden');
    } else {
      depositDeductionContainer.classList.add('hidden');
    }

    // ════════════════════════════════════════════════════════════
    // 3. ARA TOPLAM (Subtotal)
    // ════════════════════════════════════════════════════════════
    document.getElementById('deliverySubtotal').textContent = '₺' + subtotal.toLocaleString('tr-TR');

    // ════════════════════════════════════════════════════════════
    // 4. TEPSİ SORUSU
    // ════════════════════════════════════════════════════════════
    // ════════════════════════════════════════════════════════════
    // 4. TEPSİ BİLDİRİM PANELI (SADECE SU BÖREĞİ VARSA)
    // ════════════════════════════════════════════════════════════
    const tepsiBildirimPaneli = document.getElementById('tepsiBildirimPaneli');
    const radyoButonlari = document.getElementsByName('tepsiDurumu');
    let showTrayQuestion = false;
    let currentFinalAmount = subtotal - deposit;

    if (suBoregiCount > 0) {
      showTrayQuestion = true;
      tepsiBildirimPaneli.classList.remove('hidden');

      const tepsiAdetSpan = document.getElementById('tepsiAdet');
      if (tepsiAdetSpan) tepsiAdetSpan.textContent = suBoregiCount;

      const radioGetirdi = Array.from(radyoButonlari).find(r => r.value === 'getirdi');
      const radioGetirmedi = Array.from(radyoButonlari).find(r => r.value === 'getirmedi');

      if (radioGetirdi) radioGetirdi.checked = false;
      if (radioGetirmedi) radioGetirmedi.checked = false;

      const theExtraCharge = suBoregiCount * 400;


      const updateTraySelection = (e) => {
        if (e.target.value === 'getirdi') {
          // Müşteri tepsiyi getirdiği için depozitoyu iptal et (Fiyattan ÇIKAR)
          currentFinalAmount = subtotal - deposit - theExtraCharge;
          document.getElementById('deliveryModalFinalAmount').textContent = '₺' + currentFinalAmount.toLocaleString('tr-TR');
        } else if (e.target.value === 'getirmedi') {
          // Müşteri tepsiyi getirmediği için depozito yüksek halinde (varsayılan) kalır
          currentFinalAmount = subtotal - deposit;
          document.getElementById('deliveryModalFinalAmount').textContent = '₺' + currentFinalAmount.toLocaleString('tr-TR');
        }
      };

      if (radioGetirdi) radioGetirdi.onchange = updateTraySelection;
      if (radioGetirmedi) radioGetirmedi.onchange = updateTraySelection;
    } else {
      tepsiBildirimPaneli.classList.add('hidden');
      currentFinalAmount = subtotal - deposit;
    }

    // ════════════════════════════════════════════════════════════
    // 5. SON TUTAR GÖSTER
    // ════════════════════════════════════════════════════════════
    document.getElementById('deliveryModalFinalAmount').textContent = '₺' + currentFinalAmount.toLocaleString('tr-TR');

    // ════════════════════════════════════════════════════════════
    // 6. BUTON EVENT LISTENER'LARI
    // ════════════════════════════════════════════════════════════
    const closeBtn = document.getElementById('closeDeliveryModalBtn');
    const cancelBtn = document.getElementById('cancelDeliveryBtn');
    const confirmBtn = document.getElementById('confirmDeliveryBtn');

    closeBtn.onclick = closeCheckoutModal;
    cancelBtn.onclick = closeCheckoutModal;

    confirmBtn.onclick = async function () {
      // Eğer tepsi sorusu varsa ve seçim yapılmadıysa uyar
      const radioGetirdi = Array.from(document.getElementsByName('tepsiDurumu')).find(r => r.value === 'getirdi');
      const radioGetirmedi = Array.from(document.getElementsByName('tepsiDurumu')).find(r => r.value === 'getirmedi');

      if (showTrayQuestion && (!radioGetirdi || !radioGetirdi.checked) && (!radioGetirmedi || !radioGetirmedi.checked)) {
        alert('Lütfen Su Böreği tepsi durumunu seçiniz!');
        return false;
      }

      // Seçilen tepsi durumunu belirle
      let trayStatus = null;
      if (radioGetirdi && radioGetirdi.checked) {
        trayStatus = 'received';
      } else if (radioGetirmedi && radioGetirmedi.checked) {
        trayStatus = 'not_received';
      }

      await confirmCheckout(orderId, order, trayStatus, currentFinalAmount);
    };

    // Modal'ı aç
    document.getElementById('deliveryConfirmationModal').classList.add('open');

  } catch (err) {
    console.error('❌ openCheckoutModal hatası:', err);
    toast('❌ Hata: ' + (err.message || 'Bilinmeyen hata'), 'error');
  }
}

// ─── Kasa Modalini Kapat ─────────────────────────────────────
function closeCheckoutModal() {
  const modal = document.getElementById('deliveryConfirmationModal');
  if (modal) modal.classList.remove('open');
}

// ─── Kasayı Onayla ve Teslim Et ─────────────────────────────
async function confirmCheckout(orderId, order, trayStatus, finalAmount) {
  showLoader();
  try {
    // ════════════════════════════════════════════════════════════
    // ADIM 1: Siparişi Güncelle
    // - ÖNEMLİ: teslimat öncesi orijinal snapshot'ını kaydet (zaman makinesi)
    // ════════════════════════════════════════════════════════════
    // Deep clone the original order so later undo can restore it
    const originalSnapshot = JSON.parse(JSON.stringify(order || {}));
    let updatedOrder = { ...order };
    const prices = globalPriceSettings || {};

    updatedOrder.totalPrice = finalAmount; // Her halükarda yeni (ya da aynı) tutarı kaydet

    if (trayStatus === 'not_received') {
      const suBoregiCount = Number(order.suBoregi) || 0;
      const ziniDeposit = suBoregiCount * 400;

      updatedOrder.trayDepositAdded = true;
      updatedOrder.trayDepositAmount = ziniDeposit;

      console.log(`💰 Tepsi Deposutu (Peşin) Onaylandı: ${ziniDeposit} ₺ - Son Tutar: ${finalAmount} ₺`);
    } else if (trayStatus === 'received') {
      updatedOrder.trayDepositAdded = false;
      updatedOrder.trayDepositAmount = 0;
      console.log(`✅ Müşteri tepsisini getirdi, depozito düşüldü - Yeni Tutar: ${finalAmount} ₺`);
    }

    // ════════════════════════════════════════════════════════════
    // ADIM 2: Teslim Bilgisini Ekle
    // ════════════════════════════════════════════════════════════
    updatedOrder.deliveredAt = new Date().toISOString();
    updatedOrder.trayReturned = false;
    updatedOrder.trayReturnedDate = null;

    // Attach the pre-delivery snapshot so undo can restore the original state
    try {
      updatedOrder.preDeliverySnapshot = originalSnapshot;
    } catch (e) {
      // If snapshot cannot be serialized for any reason, continue without it
      console.warn('preDeliverySnapshot eklenemedi:', e);
    }

    delete updatedOrder.id;

    // ════════════════════════════════════════════════════════════
    // ADIM 3: Firestore'a Kaydet (Batch)
    // ════════════════════════════════════════════════════════════
    const batch = db.batch();
    batch.delete(db.collection('orders').doc(orderId));
    // Save delivered document including preDeliverySnapshot
    batch.set(db.collection('deliveredOrders').doc(), updatedOrder);
    await batch.commit();

    console.log('✅ Sipariş teslim edildi:', orderId);

    // Başarı mesajı
    let successMsg = '✅ Sipariş teslim edildi!';
    if (trayStatus === 'not_received') {
      successMsg += ' (Depozito eklendi)';
    }
    toast(successMsg, 'success');

    // Modal'ı kapat
    closeCheckoutModal();

  } catch (err) {
    console.error('❌ confirmCheckout hatası:', err);
    toast('❌ Hata: ' + (err.message || 'Bilinmeyen hata'), 'error');
  } finally {
    hideLoader();
  }
}

async function deleteOrder(id) {
  if (!id) {
    console.error('❌ deleteOrder: ID boş');
    toast('❌ Sipariş ID bulunamadı', 'error');
    return;
  }

  if (!window.Swal || typeof window.Swal.fire !== 'function') {
    toast('❌ SweetAlert2 bulunamadı. Silme onayı gösterilemiyor.', 'error');
    return;
  }

  const result = await window.Swal.fire({
    title: 'Siparişi Sil?',
    text: 'Bu kaydı silmek istediğinize emin misiniz? (Sipariş çöp kutusuna taşınacaktır)',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#6b7280',
    confirmButtonText: '<i class="fas fa-trash"></i> Evet, Sil',
    cancelButtonText: 'İptal'
  });
  if (!result?.isConfirmed) return;

  showLoader();
  try {
    await deleteOrderFS(id);
    toast('🗑️ Sipariş çöp kutusuna taşındı.', 'info');
  } catch (err) {
    console.error('❌ deleteOrder hatası:', err);
    toast('❌ Hata: ' + (err.message || 'Bilinmeyen hata'), 'error');
  } finally {
    hideLoader();
  }
}

async function logoutAdmin() {
  if (!window.Swal || typeof window.Swal.fire !== 'function') {
    toast('❌ SweetAlert2 bulunamadı. Çıkış onayı gösterilemiyor.', 'error');
    return;
  }

  const result = await window.Swal.fire({
    title: 'Sistemden Çıkış?',
    text: 'Sistemden çıkış yapmak istediğinize emin misiniz?',
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#3b82f6',
    cancelButtonColor: '#6b7280',
    confirmButtonText: '<i class="fas fa-right-from-bracket"></i> Evet, Çık',
    cancelButtonText: 'İptal'
  });
  if (!result?.isConfirmed) {
    return; // Kullanıcı iptal'e basarsa işlemi durdur
  }
  try {
    await firebase.auth().signOut();
    window.location.href = 'index.html';
  } catch (err) { toast('Çıkış hatası: ' + err.message, 'error'); }
}

function calculateTrayRefundBreakdown(order, settings = globalPriceSettings || {}) {
  let baklavaTepsiCount = 0;
  let ziniTepsiCount = 0;

  const orderOwnTray = Boolean(order?.kendiTepsisi);

  if (Array.isArray(order?.items) && order.items.length) {
    order.items.forEach(item => {
      const trayCount = Number(item?.tepsi ?? item?.tray ?? item?.adet ?? item?.quantity ?? item?.count ?? 0) || 0;
      if (trayCount <= 0) return;

      const itemOwnTray = Boolean(item?.kendiTepsisi ?? orderOwnTray);
      if (itemOwnTray) return;

      const itemName = String(item?.name ?? item?.label ?? item?.productKey ?? item?.key ?? '').toLowerCase();
      const isSuBoregi = itemName.includes('su') && itemName.includes('bore');
      const isYufka = itemName.includes('yufka');

      if (isSuBoregi) {
        ziniTepsiCount += trayCount;
      } else if (!isYufka) {
        baklavaTepsiCount += trayCount;
      }
    });
  } else {
    const suBoregiTepsi = Number(getProductValue(order, 'suBoregi')) || 0;
    const kareTepsi = Number(getProductValue(order, 'kareBaklava')) || 0;
    const evTepsi = Number(getProductValue(order, 'evBaklavasi')) || 0;
    const sariTepsi = Number(getProductValue(order, 'sariBurma')) || 0;
    const fistikTepsi = Number(getProductValue(order, 'fistikliBaklava')) || 0;

    if (!orderOwnTray) {
      ziniTepsiCount += suBoregiTepsi;
      baklavaTepsiCount += kareTepsi + evTepsi + sariTepsi + fistikTepsi;
    }
  }

  const baklavaDeposit = Number(settings?.baklavaTepsiDeposit ?? settings?.baklavaDepozito ?? 0);
  const ziniDeposit = Number(settings?.ziniTepsiDeposit ?? settings?.ziniDepozito ?? 0);
  const totalRefund = (baklavaTepsiCount * baklavaDeposit) + (ziniTepsiCount * ziniDeposit);

  return {
    baklavaTepsiCount,
    ziniTepsiCount,
    totalRefund
  };
}

async function askTrayReturnApproval(refundInfo) {
  const { baklavaTepsiCount, ziniTepsiCount, totalRefund } = refundInfo;

  if (!window.Swal || typeof window.Swal.fire !== 'function') {
    toast('❌ SweetAlert2 bulunamadı. Tepsi iade onayı gösterilemiyor.', 'error');
    return false;
  }

  if (totalRefund > 0) {
    return window.Swal.fire({
      title: 'Tepsi İadesi ve Geri Ödeme',
      icon: 'info',
      html: `
        <div class="mb-4 text-lg">Müşteriye ödenecek toplam tutar:</div>
        <div class="text-4xl font-bold text-red-600 mb-4">₺${Number(totalRefund).toLocaleString('tr-TR')}</div>
        <div class="text-sm text-gray-500">Kırılım: ${baklavaTepsiCount}x Baklava Tepsisi, ${ziniTepsiCount}x Zini</div>
      `,
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#6b7280',
      confirmButtonText: '<i class="fas fa-check"></i> Ödemeyi Yaptım, Onayla',
      cancelButtonText: 'İptal'
    }).then((result) => Boolean(result?.isConfirmed));
  }

  return window.Swal.fire({
    title: 'Tepsi İadesi ve Geri Ödeme',
    icon: 'info',
    html: `
      <div class="mb-2 text-base">İade edilecek depozito bulunmuyor. Tepsiler alındı olarak işaretlensin mi?</div>
      <div class="text-sm text-gray-500">Kırılım: ${baklavaTepsiCount}x Baklava Tepsisi, ${ziniTepsiCount}x Zini</div>
    `,
    showCancelButton: true,
    confirmButtonColor: '#10b981',
    cancelButtonColor: '#6b7280',
    confirmButtonText: '<i class="fas fa-check"></i> İadeyi Onayla',
    cancelButtonText: 'İptal'
  }).then((result) => Boolean(result?.isConfirmed));
}

// ✅ Tepsi İade Alındı - markTrayReturned
async function markTrayReturned(id) {
  if (!id) {
    console.error('❌ markTrayReturned: ID boş');
    toast('❌ Sipariş ID bulunamadı', 'error');
    return;
  }

  const order = deliveredCache.find(o => o.id === id);
  if (!order) {
    toast('❌ Sipariş bulunamadı', 'error');
    return;
  }

  const refundInfo = calculateTrayRefundBreakdown(order, globalPriceSettings || {});
  const approved = await askTrayReturnApproval(refundInfo);
  if (!approved) return;

  showLoader();
  try {
    await updateTrayReturnedFS(id);
    toast('✅ Tepsi iade alındı!', 'success');
  } catch (err) {
    console.error('❌ markTrayReturned hatası:', err);
    toast('❌ Hata: ' + (err.message || 'Bilinmeyen hata'), 'error');
  } finally {
    hideLoader();
  }
}

// ✅ Tepsi İadeleri Paneli - Akordeon Yapısı
function renderTrayReturns() {
  try {
    currentPanel = 'returned';
    const container = document.getElementById('tray-returns-list');
    if (!container) {
      console.warn('⚠️ tray-returns-list container bulunamadı');
      return;
    }

    let trayReturned = deliveredCache.filter(o => o.trayReturned === true);

    // Tarih filtrelemesi
    if (dateFilterValueTray) {
      trayReturned = trayReturned.filter(o => o.deliveryDate === dateFilterValueTray);
    }

    if (!trayReturned.length) {
      container.innerHTML = '<div class="text-center py-16 text-gray-500"><div class="text-5xl mb-3">🔄</div><p>Henüz tepsi iade edilmiş sipariş yok.</p></div>';
      return;
    }

    // Tarihe göre grupla
    const grouped = groupByDate(trayReturned.slice().sort((a, b) => b.deliveryDate.localeCompare(a.deliveryDate)));
    let html = '';

    Object.keys(grouped).sort().reverse().forEach(dateKey => {
      const safeDateId = 'tray-return-date-' + dateKey.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
      const dateStr = new Date(dateKey + 'T00:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' });
      const { headerBgClass, panelBadgeClass, panelBadgeLabel } = getPanelTheme('returned');

      // Her tarih için kart HTML biriktiricisi
      let cardsHtml = '';
      grouped[dateKey].forEach(o => {
        const productsHtml = generateProductsHtml(o);

        cardsHtml += `
          <div class="w-full block p-0 border-b border-slate-100">
            <div class="flex justify-between items-center w-full py-3 px-4 font-bold text-gray-800 cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors" onclick="toggleDetails('tray-${o.id}')">
              <div class="flex items-center gap-2 flex-wrap">
                <span>${escHtml(o.customerName)}</span>
                <span class="text-xs px-2 py-0.5 rounded-full font-medium ${panelBadgeClass}">${panelBadgeLabel}</span>
              </div>
              <span class="toggle-arrow" style="transform: rotate(0deg); transition: transform 0.3s ease;">▼</span>
            </div>

            <div id="details-tray-${o.id}" class="details-panel hidden w-full p-4 bg-white">
              <div class="flex flex-col md:flex-row md:justify-between gap-4 w-full">
                
                <div class="flex-1">
                  <div class="flex flex-wrap gap-6 mb-4">
                    <div><span class="text-gray-500 block text-xs">Telefon:</span> <a href="tel:${escHtml(o.phoneNumber || '')}" class="text-blue-600 hover:underline">${escHtml(o.phoneNumber || '—')}</a></div>
                    <div><span class="text-gray-500 block text-xs">Teslim Tarihi:</span> ${fmtDate(o.deliveryDate)}</div>
                    
                    <div><span class="text-gray-500 block text-xs">👤 İşlemi Yapan:</span> <span class="font-semibold text-indigo-600 capitalize">${escHtml(o.addedBy || 'Sistem')}</span></div>
                  </div>
                  
                  ${o.note ? `<div class="bg-yellow-50 border-l-4 border-yellow-400 text-yellow-700 p-2 text-xs mb-3 rounded"><strong>📝 Not/Kapora:</strong> ${escHtml(o.note)}</div>` : ''}
                  
                  <div class="text-xs text-gray-600 mb-3">
                    <span class="text-gray-500 block text-xs mb-2">ÜRÜNLER:</span>
                    <div class="space-y-1">${productsHtml || '<span class="text-gray-400">Ürün bilgisi yok</span>'}</div>
                  </div>

                  <div class="flex flex-col gap-1 mt-2 text-xs text-gray-400 border-t border-gray-100 pt-2">
                    ${o.orderCreatedAt ? `<div>⏰ Alındı: ${formatDateTime(o.orderCreatedAt)}</div>` : ''}
                    ${o.deliveredAt ? `<div>✅ Teslim Edildi: ${formatDateTime(o.deliveredAt)}</div>` : ''}
                    ${o.trayReturnedAt ? `<div>🔄 İade Alındı: ${formatDateTime(o.trayReturnedAt)}</div>` : ''}
                  </div>
                </div>

                <div class="flex flex-col shrink-0 w-full md:w-40 gap-2 justify-start mt-2 md:mt-0">
                  ${o.tepsiParasi === 'Alındı' && !o.trayReturned ? `
                  <button type="button" class="w-full px-3 py-1.5 bg-orange-500 text-white rounded-md hover:bg-orange-600 flex items-center justify-center gap-2 font-semibold text-sm transition-all duration-200 transform hover:scale-105 active:scale-95 hover:shadow-md cursor-pointer" data-action="whatsapp" data-order-id="${o.id}" data-msg-type="tray-request-short">
                    📱 Tepsi İste
                  </button>
                  ` : ''}
                  <button type="button" onclick="revertTrayReturn('${o.id}')" class="w-full px-4 py-2 bg-orange-50 text-orange-600 border border-orange-200 rounded-md hover:bg-orange-100 flex items-center justify-center gap-2 font-semibold text-sm transition-all duration-200 transform hover:scale-105 active:scale-95 hover:shadow-md cursor-pointer">↩️ Geri Al</button>
                  <button type="button" onclick="deleteDeliveredOrder('${o.id}')" class="w-full px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-md hover:bg-red-100 flex items-center justify-center gap-2 font-semibold text-sm transition-all duration-200 transform hover:scale-105 active:scale-95 hover:shadow-md cursor-pointer">🗑️ Sil</button>
                </div>
              </div>
            </div>
          </div>`;
      });

      html += `
        <div class="w-full shadow-sm rounded-lg overflow-hidden border border-gray-100 mb-1 animate-fade-up">
          <div class="px-4 py-3 text-white text-xs font-bold uppercase tracking-wide ${headerBgClass} w-full cursor-pointer flex justify-between items-center transition-colors hover:brightness-110" onclick="toggleDateGroup('${safeDateId}')">
            <span>📅 ${dateStr} - 🔄 İADE ALINDI</span>
            <span class="transition-transform duration-300" id="date-arrow-${safeDateId}" style="transform: rotate(-90deg);">▼</span>
          </div>
          <div id="date-group-${safeDateId}" class="hidden bg-white border border-t-0 border-gray-200">
            ${cardsHtml}
          </div>
        </div>
      `;
    });

    container.innerHTML = html;

    // Event Listeners
    setTimeout(() => {
      container.querySelectorAll('button[data-action]').forEach(btn => {
        btn.removeEventListener('click', handleButtonClick);
        btn.addEventListener('click', handleButtonClick);
      });
    }, 0);
  } catch (err) {
    console.error('❌ renderTrayReturns hatası:', err);
  }
}

// ─── Filtreli Tepsi İadeleri Render Fonksiyonu ────────────────────
window.renderTrayReturnsFiltered = function (filteredData) {
  try {
    currentPanel = 'returned';
    const container = document.getElementById('tray-returns-list');
    if (!container) {
      console.warn('⚠️ tray-returns-list container bulunamadı');
      return;
    }

    const trayReturned = filteredData;

    if (!trayReturned.length) {
      container.innerHTML = '<div class="text-center py-16 text-gray-500"><div class="text-5xl mb-3">🔄</div><p>Aramanıza uygun tepsi iade kaydı bulunamadı.</p></div>';
      return;
    }

    // Tarihe göre grupla
    const grouped = groupByDate(trayReturned.slice().sort((a, b) => b.deliveryDate.localeCompare(a.deliveryDate)));
    let html = '';

    Object.keys(grouped).sort().reverse().forEach(dateKey => {
      const safeDateId = 'tray-return-date-' + dateKey.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
      const dateStr = new Date(dateKey + 'T00:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' });
      const { headerBgClass, panelBadgeClass, panelBadgeLabel } = getPanelTheme('returned');

      // Her tarih için kart HTML biriktiricisi
      let cardsHtml = '';
      grouped[dateKey].forEach(o => {
        const productsHtml = generateProductsHtml(o);

        cardsHtml += `
          <div class="w-full block p-0 border-b border-slate-100">
            <div class="flex justify-between items-center w-full py-3 px-4 font-bold text-gray-800 cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors" onclick="toggleDetails('tray-${o.id}')">
              <div class="flex items-center gap-2 flex-wrap">
                <span>${escHtml(o.customerName)}</span>
                <span class="text-xs px-2 py-0.5 rounded-full font-medium ${panelBadgeClass}">${panelBadgeLabel}</span>
              </div>
              <span class="toggle-arrow" style="transform: rotate(0deg); transition: transform 0.3s ease;">▼</span>
            </div>

            <div id="details-tray-${o.id}" class="details-panel hidden w-full p-4 bg-white">
              <div class="flex flex-col md:flex-row md:justify-between gap-4 w-full">
                
                <div class="flex-1">
                  <div class="flex flex-wrap gap-6 mb-4">
                    <div><span class="text-gray-500 block text-xs">Telefon:</span> <a href="tel:${escHtml(o.phoneNumber || '')}" class="text-blue-600 hover:underline">${escHtml(o.phoneNumber || '—')}</a></div>
                    <div><span class="text-gray-500 block text-xs">Teslim Tarihi:</span> ${fmtDate(o.deliveryDate)}</div>
                    
                    <div><span class="text-gray-500 block text-xs">👤 İşlemi Yapan:</span> <span class="font-semibold text-indigo-600 capitalize">${escHtml(o.addedBy || 'Sistem')}</span></div>
                  </div>
                  
                  ${o.note ? `<div class="bg-yellow-50 border-l-4 border-yellow-400 text-yellow-700 p-2 text-xs mb-3 rounded"><strong>📝 Not/Kapora:</strong> ${escHtml(o.note)}</div>` : ''}
                  
                  <div class="text-xs text-gray-600 mb-3">
                    <span class="text-gray-500 block text-xs mb-2">ÜRÜNLER:</span>
                    <div class="space-y-1">${productsHtml || '<span class="text-gray-400">Ürün bilgisi yok</span>'}</div>
                  </div>

                  <div class="flex flex-col gap-1 mt-2 text-xs text-gray-400 border-t border-gray-100 pt-2">
                    ${o.orderCreatedAt ? `<div>⏰ Alındı: ${formatDateTime(o.orderCreatedAt)}</div>` : ''}
                    ${o.deliveredAt ? `<div>✅ Teslim Edildi: ${formatDateTime(o.deliveredAt)}</div>` : ''}
                    ${o.trayReturnedAt ? `<div>🔄 İade Alındı: ${formatDateTime(o.trayReturnedAt)}</div>` : ''}
                  </div>
                </div>

                <div class="flex flex-col shrink-0 w-full md:w-40 gap-2 justify-start mt-2 md:mt-0">
                  ${o.tepsiParasi === 'Alındı' && !o.trayReturned ? `
                  <button type="button" class="w-full px-3 py-1.5 bg-orange-500 text-white rounded-md hover:bg-orange-600 flex items-center justify-center gap-2 font-semibold text-sm transition-all duration-200 transform hover:scale-105 active:scale-95 hover:shadow-md cursor-pointer" data-action="whatsapp" data-order-id="${o.id}" data-msg-type="tray-request-short">
                    📱 Tepsi İste
                  </button>
                  ` : ''}
                  <button type="button" onclick="revertTrayReturn('${o.id}')" class="w-full px-4 py-2 bg-orange-50 text-orange-600 border border-orange-200 rounded-md hover:bg-orange-100 flex items-center justify-center gap-2 font-semibold text-sm transition-all duration-200 transform hover:scale-105 active:scale-95 hover:shadow-md cursor-pointer">↩️ Geri Al</button>
                  <button type="button" onclick="deleteDeliveredOrder('${o.id}')" class="w-full px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-md hover:bg-red-100 flex items-center justify-center gap-2 font-semibold text-sm transition-all duration-200 transform hover:scale-105 active:scale-95 hover:shadow-md cursor-pointer">🗑️ Sil</button>
                </div>
              </div>
            </div>
          </div>`;
      });

      html += `
        <div class="w-full shadow-sm rounded-lg overflow-hidden border border-gray-100 mb-1 animate-fade-up">
          <div class="px-4 py-3 text-white text-xs font-bold uppercase tracking-wide ${headerBgClass} w-full cursor-pointer flex justify-between items-center transition-colors hover:brightness-110" onclick="toggleDateGroup('${safeDateId}')">
            <span>📅 ${dateStr} - 🔄 İADE ALINDI</span>
            <span class="transition-transform duration-300" id="date-arrow-${safeDateId}" style="transform: rotate(-90deg);">▼</span>
          </div>
          <div id="date-group-${safeDateId}" class="hidden bg-white border border-t-0 border-gray-200">
            ${cardsHtml}
          </div>
        </div>
      `;
    });

    container.innerHTML = html;

    // Event Listeners
    setTimeout(() => {
      container.querySelectorAll('button[data-action]').forEach(btn => {
        btn.removeEventListener('click', handleButtonClick);
        btn.addEventListener('click', handleButtonClick);
      });
    }, 0);
  } catch (err) {
    console.error('❌ renderTrayReturnsFiltered hatası:', err);
  }
};

// ─── Global Scope Assignments ──────────────────────────────────────
// NOT: type="module" script'lerde onclick="" handler'ları için window ataması şarttır.
window.updateOrder = openModal;
window.openModal = openModal;
window.closeModal = closeModal;
window.submitOrder = submitOrder;
window.deliverOrder = deliverOrder;
window.openCheckoutModal = openCheckoutModal;
window.closeCheckoutModal = closeCheckoutModal;
window.confirmCheckout = confirmCheckout;
window.deleteOrder = deleteOrder;
window.revertTrayReturn = async function (id) {
  if (!id) { toast('❌ Sipariş ID bulunamadı', 'error'); return; }
  if (!window.Swal || typeof window.Swal.fire !== 'function') {
    toast('❌ SweetAlert2 bulunamadı. Geri alma onayı gösterilemiyor.', 'error');
    return;
  }

  const result = await window.Swal.fire({
    title: 'İşlemi Geri Al?',
    text: 'Bu kaydı önceki durumuna (Aktif/Teslim Edilen vb.) geri almak istediğinize emin misiniz?',
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#3b82f6',
    cancelButtonColor: '#6b7280',
    confirmButtonText: '<i class="fas fa-undo"></i> Evet, Geri Al',
    cancelButtonText: 'İptal'
  });
  if (!result?.isConfirmed) return;
  try {
    await revertTrayReturnFS(id);
    toast('↩️ Tepsi iadesi geri alındı!', 'success');
  } catch (err) {
    console.error('❌ revertTrayReturn hatası:', err);
    toast('❌ Hata: ' + (err.message || 'Bilinmeyen hata'), 'error');
  }
};
window.markTrayReturned = markTrayReturned;
window.deleteDeliveredOrder = deleteDeliveredOrder;
window.saveSettings = saveSettings;
window.loadSettings = loadSettings;
window.updatePricePreview = updatePricePreview;
window.calculateOrderTotal = calculateOrderTotal;
window.printReceipt = printReceipt;

// ─── Yedekleme Fonksiyonları Global Scope ───────────────────────
window.generateBackupData = generateBackupData;
window.downloadBackup = downloadBackup;
window.sendBackupToTelegram = sendBackupToTelegram;

// ─── Zamanlanmış Yedekleme Fonksiyonları Global Scope ───────────────
window.executeScheduledBackup = executeScheduledBackup;
window.checkScheduledBackup = checkScheduledBackup;
window.startScheduledBackupSystem = startScheduledBackupSystem;
window.stopScheduledBackupSystem = stopScheduledBackupSystem;

// ─── Çöp Kutusu (Silinenler) Global Handler'ları ─────────────────
window.restoreDeletedOrder = async function (id) {
  if (!id) { toast('❌ Sipariş ID bulunamadı', 'error'); return; }
  if (!window.Swal || typeof window.Swal.fire !== 'function') {
    toast('❌ SweetAlert2 bulunamadı. Geri yükleme onayı gösterilemiyor.', 'error');
    return;
  }

  const result = await window.Swal.fire({
    title: 'İşlemi Geri Al?',
    text: 'Bu kaydı önceki durumuna (Aktif/Teslim Edilen vb.) geri almak istediğinize emin misiniz?',
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#3b82f6',
    cancelButtonColor: '#6b7280',
    confirmButtonText: '<i class="fas fa-undo"></i> Evet, Geri Al',
    cancelButtonText: 'İptal'
  });
  if (!result?.isConfirmed) return;

  showLoader();
  try {
    await restoreDeletedOrderFS(id);
    toast('✅ Sipariş geri yüklendi!', 'success');
    renderDeletedPanel();
  } catch (err) {
    console.error('❌ restoreDeletedOrder hatası:', err);
    toast('❌ Hata: ' + (err.message || 'Bilinmeyen hata'), 'error');
  } finally {
    hideLoader();
  }
};

window.hardDeleteOrder = async function (id) {
  if (!id) { toast('❌ Sipariş ID bulunamadı', 'error'); return; }
  if (!window.Swal || typeof window.Swal.fire !== 'function') {
    toast('❌ SweetAlert2 bulunamadı. Kalıcı silme onayı gösterilemiyor.', 'error');
    return;
  }

  const result = await window.Swal.fire({
    title: 'Kalıcı Olarak Silinecek!',
    text: 'Bu işlem KESİNLİKLE geri alınamaz ve veritabanından tamamen silinir. Emin misiniz?',
    icon: 'error',
    showCancelButton: true,
    confirmButtonColor: '#dc2626',
    cancelButtonColor: '#6b7280',
    confirmButtonText: '<i class="fas fa-radiation"></i> Evet, Kalıcı Olarak Sil',
    cancelButtonText: 'İptal'
  });
  if (!result?.isConfirmed) return;

  showLoader();
  try {
    await hardDeleteOrderFS(id);
    toast('🗑️ Sipariş kalıcı olarak silindi.', 'info');
    renderDeletedPanel();
  } catch (err) {
    console.error('❌ hardDeleteOrder hatası:', err);
    toast('❌ Hata: ' + (err.message || 'Bilinmeyen hata'), 'error');
  } finally {
    hideLoader();
  }
};

// ─── CSV Export ───────────────────────────────────────────────────
window.exportCSV = exportCSV;
function exportCSV(type) {
  const source = type === 'active' ? ordersCache : deliveredCache;
  const rows = buildFinancialExportRows(source);
  if (!rows.length) { toast('Dışa aktarılacak veri yok!', 'info'); return; }

  const headers = Object.keys(rows[0]);
  const csvEscape = (value) => {
    const text = value === null || value === undefined ? '' : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };

  let csv = '\uFEFF';
  csv += headers.map(csvEscape).join(',') + '\n';

  rows.forEach(row => {
    csv += headers.map(header => csvEscape(row[header])).join(',') + '\n';
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), {
    href: url,
    download: (type === 'active' ? 'Siparis_Listesi_' : 'Teslim_Edilenler_') + formatExportDate(new Date()).replace(/\./g, '-') + '.csv'
  });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast('Rapor başarıyla indirildi', 'success');
}

// ─── Yardımcı Fonksiyonlar ────────────────────────────────────────
// Remove emoji / pictographic characters from text for clean labels
function stripEmojis(text) {
  if (!text) return text;
  try {
    return String(text).replace(/\p{Extended_Pictographic}/gu, '').trim();
  } catch (e) {
    // Fallback for environments without Unicode property escapes
    return String(text).replace(/[\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}]/gu, '').trim();
  }
}

function generateProductsHtml(o) {
  const html = PRODUCTS.map(p => {
    const adet = getProductValue(o, p.key);
    const kg = getProductValue(o, p.kgKey);
    // if both zero, still return a row? per existing behavior, skip if both zero
    if (!adet && !kg) return '';

    // Fiyatları doğru yerden al
    const prices = globalPriceSettings || window.currentPrices || {};
    let birimTepsi = 0; let birimKg = 0;

    if (p.key === 'kareBaklava') { birimTepsi = prices.karetepsi || 0; birimKg = prices.karekg || 0; }
    else if (p.key === 'evBaklavasi') { birimTepsi = prices.evtepsi || 0; birimKg = prices.evkg || 0; }
    else if (p.key === 'sariBurma') { birimTepsi = prices.saritepsi || 0; birimKg = prices.sarikg || 0; }
    else if (p.key === 'suBoregi') { birimTepsi = prices.sutepsi || 0; birimKg = prices.sukg || 0; }
    else if (p.key === 'fistikliBaklava') { birimTepsi = prices.fistiktepsi || 0; birimKg = prices.fistikkg || 0; }
    else if (p.key === 'yufka') { birimTepsi = prices.yufkatepsi || 0; birimKg = getYufkaKgPrice(prices); }

    const adetTutar = adet * birimTepsi;
    const kgTutar = kg * birimKg;
    const satirToplam = adetTutar + kgTutar;

    const urunAdi = stripEmojis(p.label || p.key || 'Ürün');
    const tepsiBadgeYadaBosString = adet > 0
      ? `<span class="inline-flex items-center justify-center bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-0.5 rounded-full">${adet} Tepsi</span>`
      : '<div class="w-full"></div>';
    const kgBadgeYadaBosString = kg > 0
      ? `<span class="inline-flex items-center justify-center bg-green-100 text-green-800 text-xs font-semibold px-2 py-0.5 rounded-full">${fmtKg(kg)} Kg</span>`
      : '<div class="w-full"></div>';

    return `
    <div class="flex items-center w-full py-2 border-b border-gray-100 justify-between">
      <div class="w-1/3 sm:w-2/5 font-medium text-gray-700 truncate">${escHtml(urunAdi)}</div>
      <div class="flex items-center gap-2 w-1/3 justify-start">
        <div class="w-16 flex justify-center">${tepsiBadgeYadaBosString}</div>
        <div class="w-16 flex justify-center">${kgBadgeYadaBosString}</div>
      </div>
      <div class="w-1/4 text-right font-bold text-gray-800">${satirToplam.toLocaleString('tr-TR')} ₺</div>
    </div>`;
  }).join('');

  const finalHtml = html || '<span class="text-gray-400">Ürün bilgisi yok</span>';

  // Genel toplam: kayıtlı totalPrice varsa onu kullan, yoksa ürün
  let finalTotal;
  if (o.totalPrice !== undefined) {
    finalTotal = Number(o.totalPrice);
  } else {
    finalTotal = calculateOrderTotal(o);
  }

  // Peşin Depozito Sistemi: Aktif siparişlerde (henüz teslim edilmemiş) Su Böreği varsa 400 TL ekle
  const isDelivered = Boolean(o.deliveredAt);
  const suBoregiTepsiAdedi = Number(o.suBoregi) || 0;
  if (!isDelivered && suBoregiTepsiAdedi > 0) {
    finalTotal += (suBoregiTepsiAdedi * 400);
  }

  // Sadece görsel bilgi: tepsi depozito kırılımı (totalPrice verisini değiştirmez)
  let baklavaTepsiCount = 0;
  let ziniTepsiCount = 0;

  PRODUCTS.forEach(p => {
    const adet = Number(getProductValue(o, p.key)) || 0;
    if (adet <= 0) return;

    if (p.key === 'suBoregi') {
      ziniTepsiCount += adet;
      return;
    }

    if (p.key === 'yufka') return;

    baklavaTepsiCount += adet;
  });

  const baklavaDepositUnit = Number(globalPriceSettings?.baklavaTepsiDeposit ?? globalPriceSettings?.baklavaDepozito ?? 0);
  const ziniDepositUnit = Number(globalPriceSettings?.ziniTepsiDeposit ?? globalPriceSettings?.ziniDepozito ?? 0);
  const totalDeposit = (baklavaTepsiCount * baklavaDepositUnit) + (ziniTepsiCount * ziniDepositUnit);

  const depositSummaryHtml = totalDeposit > 0
    ? `<div class="text-sm text-gray-500 text-right mb-2 border-b border-gray-100 pb-2">
  <div class="font-semibold text-gray-600 mb-1">Tepsi Depozito Ozeti:</div>
  <div class="${baklavaTepsiCount > 0 ? '' : 'hidden'}">Baklava Tepsisi (${baklavaTepsiCount}x): ₺${(baklavaTepsiCount * baklavaDepositUnit).toLocaleString('tr-TR')}</div>
  <div class="${ziniTepsiCount > 0 ? '' : 'hidden'}">Zini (${ziniTepsiCount}x): ₺${(ziniTepsiCount * ziniDepositUnit).toLocaleString('tr-TR')}</div>
  <div class="font-bold text-gray-700 mt-1">+ Toplam Depozito: ₺${totalDeposit.toLocaleString('tr-TR')}</div>
</div>`
    : '';

  const totalHtml = `<div class="mt-3 pt-2 border-t border-gray-300 text-right text-lg font-extrabold text-green-600">Genel Toplam: ${finalTotal.toLocaleString('tr-TR')} ₺</div>`;

  return finalHtml + depositSummaryHtml + totalHtml;
}

function calcTotals(list) {
  const t = {};
  PRODUCTS.forEach(p => { t[p.key] = 0; t[p.kgKey] = 0; });
  list.forEach(o => PRODUCTS.forEach(p => { t[p.key] += getProductValue(o, p.key); t[p.kgKey] += getProductValue(o, p.kgKey); }));
  return t;
}

function filterOrders(list, term) {
  if (!term) return list;
  const q = normalizeText(term);
  return list.filter(o => normalizeText([o.customerName, o.phoneNumber, o.tepsiParasi, ...PRODUCTS.map(p => (getProductValue(o, p.key) > 0 || getProductValue(o, p.kgKey) > 0) ? p.label : '')].join(' ')).includes(q));
}

function normalizeText(t) {
  return String(t || '').toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function groupByDate(list) {
  return list.reduce((acc, o) => { (acc[o.deliveryDate] = acc[o.deliveryDate] || []).push(o); return acc; }, {});
}

function getDateClass(ds) {
  const t = todayStr();
  return ds < t ? 'past' : ds === t ? 'today' : 'future';
}

function dateLabel(ds) {
  const d = new Date(ds + 'T00:00:00');
  const prefix = { past: '⚠️ GEÇMİŞ — ', today: '🟢 BUGÜN — ', future: '' }[getDateClass(ds)] || '';
  return prefix + d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' });
}

function fmtDate(str) {
  if (!str) return '—';
  return new Date(str + 'T00:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtKg(n) { return n % 1 === 0 ? String(n) : n.toFixed(2); }

function cellProd(adet, kg) {
  const parts = [];
  if (adet > 0) parts.push(adet + ' ad');
  if (kg > 0) parts.push(fmtKg(kg) + ' kg');
  return parts.length ? parts.join('<br>') : '<span class="text-gray-300">—</span>';
}

function emptyRow(cols, msg) {
  return `<tr><td colspan="${cols}" class="text-center py-16 text-gray-400">
    <div class="text-4xl mb-2">📭</div><p class="text-sm">${msg}</p></td></tr>`;
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/`/g, '&#96;');
}

function handleWhatsAppClick(orderId, msgType) {
  if (!orderId) return;
  const o = (ordersCache || []).find(x => x.id === orderId) || (deliveredCache || []).find(x => x.id === orderId);
  if (!o) {
    if (typeof toast === 'function') toast('Sipariş bulunamadı!', 'error');
    return;
  }

  const phone = o.phoneNumber || '';
  const customerName = o.customerName || '';

  let message = '';
  if (msgType === 'reminder') {
    message = `Merhaba ${customerName}, Sofuoğlu Baklava'dan ulaşıyoruz. Siparişiniz hazırdır. Uygun olduğunuz zaman teslim alabilirsiniz. Şimdiden afiyet olsun!`;
  } else if (msgType === 'thankyou') {
    message = `Merhaba ${customerName}, bizi tercih ettiğiniz için teşekkür ederiz. Umarım baklavalarımızı beğenmişsinizdir. Sofuoğlu Baklavaları olarak Google Haritalardan yorum yaparsanız seviniriz. Afiyet olsun!`;
  } else if (msgType === 'tray-request') {
    message = `Merhaba, Sofuoğlu Baklavaları'ndan siparişiniz için teşekkür ederiz. Siparişinize ait boş tepsi/zini sizde emanet görünmektedir. Müsait olduğunuzda tepsiyi dükkanımıza bırakarak depozito ücretinizi (varsa) teslim alabilirsiniz. Ayrıca 2 dakikanızı ayırıp Google Haritalardan bize yorum yaparsanız çok seviniriz. İyi günler dileriz.`;
  } else if (msgType === 'tray-request-short') {
    message = `Merhaba ${customerName}, Sofuoğlu Baklava'dan yazıyoruz. Siparişinizden kalan boş tepsiyi müsait bir zamanınızda iade etmenizi rica ederiz. İyi günler dileriz.`;
  }

  if (typeof openWhatsApp === 'function') {
    openWhatsApp(phone, message);
  } else {
    console.error('openWhatsApp function not found');
  }
}

function getOrderReceiptTotal(order) {
  if (!order) return 0;

  let total = order.totalPrice !== undefined
    ? Number(order.totalPrice)
    : Number(calculateOrderTotal(order));

  if (Number.isNaN(total)) total = 0;

  const isDelivered = Boolean(order.deliveredAt);
  const suBoregiTepsi = Number(order.suBoregi) || 0;
  if (!isDelivered && suBoregiTepsi > 0) {
    total += suBoregiTepsi * 400;
  }

  return Math.round(total * 100) / 100;
}

function getReceiptUnitPrices(productKey, prices) {
  if (productKey === 'kareBaklava') return { tray: Number(prices.karetepsi) || 0, kg: Number(prices.karekg) || 0 };
  if (productKey === 'evBaklavasi') return { tray: Number(prices.evtepsi) || 0, kg: Number(prices.evkg) || 0 };
  if (productKey === 'sariBurma') return { tray: Number(prices.saritepsi) || 0, kg: Number(prices.sarikg) || 0 };
  if (productKey === 'suBoregi') return { tray: Number(prices.sutepsi) || 0, kg: Number(prices.sukg) || 0 };
  if (productKey === 'fistikliBaklava') return { tray: Number(prices.fistiktepsi) || 0, kg: Number(prices.fistikkg) || 0 };
  if (productKey === 'yufka') return { tray: Number(prices.yufkatepsi) || 0, kg: Number(getYufkaKgPrice(prices)) || 0 };
  return { tray: 0, kg: 0 };
}

function buildReceiptItemRows(order) {
  const prices = globalPriceSettings || window.currentPrices || {};
  const rows = [];

  PRODUCTS.forEach(p => {
    const trays = Number(getProductValue(order, p.key)) || 0;
    const kg = Number(getProductValue(order, p.kgKey)) || 0;
    if (trays <= 0 && kg <= 0) return;

    const unit = getReceiptUnitPrices(p.key, prices);
    const lineTotal = (trays * unit.tray) + (kg * unit.kg);
    const qty = [];
    if (trays > 0) qty.push(`${trays} Tepsi`);
    if (kg > 0) qty.push(`${fmtKg(kg)} Kg`);

    rows.push({
      label: `${stripEmojis(p.label || p.key)} (${qty.join(' + ')})`,
      amount: Math.round(lineTotal * 100) / 100
    });
  });

  return rows;
}

function buildReceiptDepositSummary(order) {
  let baklavaTepsiCount = 0;
  let ziniTepsiCount = 0;

  PRODUCTS.forEach(p => {
    const trays = Number(getProductValue(order, p.key)) || 0;
    if (trays <= 0) return;

    if (p.key === 'suBoregi') {
      ziniTepsiCount += trays;
      return;
    }

    if (p.key === 'yufka') return;
    baklavaTepsiCount += trays;
  });

  const prices = globalPriceSettings || window.currentPrices || {};
  const baklavaDepositUnit = Number(prices.baklavaTepsiDeposit ?? prices.baklavaDepozito ?? 0);
  const ziniDepositUnit = Number(prices.ziniTepsiDeposit ?? prices.ziniDepozito ?? 0);
  const baklavaTotal = baklavaTepsiCount * baklavaDepositUnit;
  const ziniTotal = ziniTepsiCount * ziniDepositUnit;
  const totalDeposit = baklavaTotal + ziniTotal;

  return {
    baklavaTepsiCount,
    ziniTepsiCount,
    baklavaTotal,
    ziniTotal,
    totalDeposit
  };
}

function formatReceiptDateValue(value) {
  if (!value) return '-';

  let date = null;
  if (value instanceof Date) {
    date = value;
  } else if (value && typeof value.toDate === 'function') {
    date = value.toDate();
  } else if (typeof value === 'object' && typeof value.seconds === 'number') {
    date = new Date(value.seconds * 1000);
  } else {
    date = new Date(value);
  }

  if (!date || Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getReceiptOrderIdentifier(order, fallbackOrderId) {
  const explicitOrderNo = order?.orderNo || order?.orderNumber || order?.siparisNo;
  if (explicitOrderNo) return String(explicitOrderNo);

  const rawId = String(fallbackOrderId || order?.id || '');
  if (!rawId) return '-';
  return rawId.slice(-5).toUpperCase();
}

function printReceipt(orderId) {
  if (!orderId) return;

  const order = (ordersCache || []).find(o => o.id === orderId) || (deliveredCache || []).find(o => o.id === orderId);
  if (!order) {
    toast('Sipariş bulunamadı!', 'error');
    return;
  }

  const receiptEl = document.getElementById('pos-receipt');
  const orderIdEl = document.getElementById('r-order-id');
  const createdDateEl = document.getElementById('r-created-date');
  const deliveryDateEl = document.getElementById('r-delivery-date');
  const userEl = document.getElementById('r-user');
  const printDateEl = document.getElementById('r-print-date');
  const customerEl = document.getElementById('receipt-customer');
  const phoneEl = document.getElementById('r-phone');
  const noteContainerEl = document.getElementById('r-note-container');
  const noteEl = document.getElementById('r-note');
  const itemsEl = document.getElementById('r-items');
  const depositsEl = document.getElementById('r-deposits');
  const totalEl = document.getElementById('r-total');

  if (!receiptEl || !orderIdEl || !createdDateEl || !deliveryDateEl || !userEl || !printDateEl || !customerEl || !phoneEl || !noteContainerEl || !noteEl || !itemsEl || !depositsEl || !totalEl) {
    toast('Fiş şablonu bulunamadı!', 'error');
    return;
  }

  const printDateText = new Date().toLocaleString('tr-TR');
  const createdDateRaw = order?.orderCreatedAt ?? order?.createdAt ?? order?.createdDate ?? order?.createdByDate;
  const orderUser = order?.createdBy || order?.addedBy || order?.createdByEmail || auth?.currentUser?.email || '-';

  orderIdEl.textContent = getReceiptOrderIdentifier(order, orderId);
  createdDateEl.textContent = formatReceiptDateValue(createdDateRaw);
  deliveryDateEl.textContent = order?.deliveryDate ? fmtDate(order.deliveryDate) : '-';
  userEl.textContent = orderUser;
  printDateEl.textContent = printDateText;

  customerEl.textContent = order.customerName || '-';
  phoneEl.textContent = order.phoneNumber || '-';

  const noteValue = String(order.note || '').trim();
  if (noteValue) {
    noteContainerEl.classList.remove('hidden');
    noteEl.textContent = noteValue;
  } else {
    noteContainerEl.classList.add('hidden');
    noteEl.textContent = '';
  }

  const itemRows = buildReceiptItemRows(order);
  if (itemRows.length) {
    itemsEl.innerHTML = itemRows.map(row => `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:4px; margin-bottom:2px; line-height:1.15;">
        <div style="flex:1; min-width:0;">${escHtml(row.label)}</div>
        <div style="white-space:nowrap; font-weight:600;">${row.amount.toLocaleString('tr-TR')} ₺</div>
      </div>
    `).join('');
  } else {
    itemsEl.innerHTML = '<div>Urun bilgisi yok</div>';
  }

  const deposit = buildReceiptDepositSummary(order);
  if (deposit.totalDeposit > 0) {
    depositsEl.classList.remove('hidden');
    depositsEl.innerHTML = `
      <div style="font-weight:700; margin-bottom:1px; line-height:1.15;">Tepsi Depozito Özeti:</div>
      ${deposit.baklavaTepsiCount > 0 ? `<div>Baklava Tepsisi (${deposit.baklavaTepsiCount}x): ₺${deposit.baklavaTotal.toLocaleString('tr-TR')}</div>` : ''}
      ${deposit.ziniTepsiCount > 0 ? `<div>Zini (${deposit.ziniTepsiCount}x): ₺${deposit.ziniTotal.toLocaleString('tr-TR')}</div>` : ''}
    `;
  } else {
    depositsEl.classList.add('hidden');
    depositsEl.innerHTML = '';
  }

  totalEl.textContent = `${getOrderReceiptTotal(order).toLocaleString('tr-TR')} ₺`;

  window.print();
}


// ─── Toast ────────────────────────────────────────────────────────
function toast(msg, type = 'success') {
  const colors = { success: 'bg-green-500', error: 'bg-red-500', info: 'bg-blue-500' };
  const el = document.createElement('div');
  el.className = `pointer-events-auto px-5 py-3 rounded-2xl text-white text-sm font-semibold shadow-xl toast-in ${colors[type] || colors.success}`;
  el.textContent = msg;
  document.getElementById('toastContainer').appendChild(el);
  setTimeout(() => { el.classList.replace('toast-in', 'toast-out'); setTimeout(() => el.remove(), 320); }, 3000);
}

function formatExportDate(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

function formatExportMoney(value) {
  const amount = Number(value) || 0;
  return amount;
}

function formatOrderNumber(order) {
  if (order?.orderNo) return String(order.orderNo);
  if (order?.orderNumber) return String(order.orderNumber);
  if (order?.id) return `S-${String(order.id).replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase()}`;
  return 'S-000000';
}

function formatOrderContent(order) {
  const parts = [];
  PRODUCTS.forEach(p => {
    const trays = Number(order?.[p.key]) || 0;
    const kg = Number(order?.[p.kgKey]) || 0;
    if (trays > 0) parts.push(`${trays} Tepsi ${p.label}`);
    if (kg > 0) parts.push(`${kg} Kg ${p.label}`);
  });
  return parts.join(', ');
}

function getPaymentStatusText(order) {
  const total = Number(order?.totalPrice ?? calculateOrderTotal(order));
  const kapora = Number(order?.deposit || order?.kapora || 0);
  const kalan = Math.max(total - kapora, 0);
  return kalan > 0 ? `Kalan: ${kalan.toLocaleString('tr-TR')}₺` : 'Tamamlandı';
}

function buildFinancialExportRows(sourceOrders) {
  return (sourceOrders || []).map(order => {
    // Ürün bazlı toplam (hesap fonksiyonu kullanılır)
    const productTotal = Number(calculateOrderTotal(order));

    // Tepsi depozitosu: öncelik sırası => explicit numeric fieldler (tepsiDepozito, trayDeposit, tepsiAmount)
    // sonra order.tepsiParasi 'Alındı' ise → birim ücret × toplam tepsi adedi
    let tepsiDeposit = 0;
    if (order?.tepsiDepozito !== undefined) tepsiDeposit = Number(order.tepsiDepozito) || 0;
    else if (order?.trayDeposit !== undefined) tepsiDeposit = Number(order.trayDeposit) || 0;
    else if (order?.tepsiAmount !== undefined) tepsiDeposit = Number(order.tepsiAmount) || 0;
    else if (!isNaN(Number(order?.tepsiParasi))) tepsiDeposit = Number(order.tepsiParasi) || 0;
    else if (order?.tepsiParasi === 'Alındı') {
      // ✅ Tepsi adediyle çarp: Tepsi_Ücreti × Toplam_Tepsi_Adedi
      const trayCount = getTotalTrayCount(order);
      tepsiDeposit = Number(globalPriceSettings.tray || 0) * Math.max(trayCount, 1);
    } else tepsiDeposit = 0;

    // Genel toplam: eğer order.totalPrice varsa onu kullan, yoksa ürün toplamına tepsi deposunu ekle
    let rawTotal = order?.totalPrice !== undefined ? Number(order.totalPrice) : (productTotal + tepsiDeposit);

    // Peşin Depozito Sistemi (Aktif siparişlerde Zini dahil et)
    if (!order?.deliveredAt && (Number(order?.suBoregi) || 0) > 0) {
      rawTotal += (Number(order?.suBoregi) || 0) * 400;
    }

    const kapora = Number(order?.deposit || order?.kapora || 0);

    // Kalan hesaplama: Ödenecek Net Tutar = (ürün toplam + tepsi (eğer ayrı ise)) - kapora
    // Eğer order.totalPrice zaten tepsiyi içeriyorsa rawTotal yansıtacaktır.
    const kalan = Math.max(rawTotal - kapora, 0);

    // Tepsi durumu metni
    let tepsiDurum = 'Alınmadı';
    if (order?.tepsiParasi === 'Alındı' || tepsiDeposit > 0) {
      if (order?.trayReturned === true) tepsiDurum = 'İade Edildi';
      else tepsiDurum = 'Müşteride';
    } else if (order?.tepsiParasi && String(order.tepsiParasi).trim() !== '') {
      tepsiDurum = 'Depozito Alındı';
    }

    return {
      'Sipariş No': formatOrderNumber(order),
      'Müşteri Adı': order?.customerName || '',
      'Sipariş İçeriği': formatOrderContent(order),
      'Toplam Tutar': formatExportMoney(rawTotal),
      'Alınan Kapora': formatExportMoney(kapora),
      // Tepsi bilgileri: depozito tutarı ve durumu (sipariş notundan ÖNCE yerleştirilecek)
      'Tepsi Depozitosu (₺)': formatExportMoney(tepsiDeposit > 0 ? tepsiDeposit : (tepsiDeposit === 0 ? 0 : '')),
      'Tepsi Durumu': tepsiDurum,
      'Sipariş Tarihi': formatExportDate(order?.orderCreatedAt || order?.createdAt || order?.orderDate || order?.deliveryDate),
      'Teslim Tarihi': formatExportDate(order?.deliveredAt || order?.deliveryDate),
      'Sipariş Notu': order?.note || '',
      'Ödenecek Net Tutar': formatExportMoney(kalan)
    };
  });
}

function autoFitWorksheetColumns(ws, rows) {
  if (!rows || !rows.length) return;
  const headers = Object.keys(rows[0]);
  ws['!cols'] = headers.map(header => {
    const maxLength = Math.max(
      header.length,
      ...rows.map(row => String(row[header] ?? '').length)
    );
    return { wch: Math.min(Math.max(maxLength + 2, 12), 48) };
  });
}

// ─── Export to Excel (SheetJS) and Export Modal Wiring ────────────
window.exportToExcel = exportToExcel;
async function exportToExcel(mode = 'all') {
  // mode: 'all' | 'month' | 'detailed'
  try {
    showLoader();
    if (typeof XLSX === 'undefined') {
      throw new Error('SheetJS (XLSX) kütüphanesi yüklü değil');
    }

    const now = new Date();
    const monthPrefix = now.toISOString().slice(0, 7); // yyyy-mm

    const filterByMonth = (order) => {
      const dateValue = order?.deliveryDate || order?.orderDate || order?.createdAt || order?.orderCreatedAt || '';
      return String(dateValue).startsWith(monthPrefix);
    };

    const activeSource = mode === 'month' ? (ordersCache || []).filter(filterByMonth) : (ordersCache || []);
    const deliveredSource = mode === 'month' ? (deliveredCache || []).filter(filterByMonth) : (deliveredCache || []);

    const activeRows = buildFinancialExportRows(activeSource);
    const deliveredRows = buildFinancialExportRows(deliveredSource);

    if (!activeRows.length && !deliveredRows.length) {
      toast('Dışa aktarılacak veri bulunamadı.', 'info');
      return;
    }

    const wb = XLSX.utils.book_new();

    if (activeRows.length) {
      const wsActive = XLSX.utils.json_to_sheet(activeRows);
      // Make header row bold for readability
      try {
        const headers = Object.keys(activeRows[0]);
        for (let i = 0; i < headers.length; i++) {
          const cellAddr = XLSX.utils.encode_cell({ c: i, r: 0 });
          if (!wsActive[cellAddr]) wsActive[cellAddr] = { v: headers[i], t: 's' };
          wsActive[cellAddr].s = { font: { bold: true } };
        }
      } catch (e) {
        console.warn('Header styling failed (SheetJS may ignore styles):', e);
      }
      autoFitWorksheetColumns(wsActive, activeRows);
      XLSX.utils.book_append_sheet(wb, wsActive, 'Aktif_Siparisler');
    }

    if (deliveredRows.length) {
      const wsDelivered = XLSX.utils.json_to_sheet(deliveredRows);
      try {
        const headers = Object.keys(deliveredRows[0]);
        for (let i = 0; i < headers.length; i++) {
          const cellAddr = XLSX.utils.encode_cell({ c: i, r: 0 });
          if (!wsDelivered[cellAddr]) wsDelivered[cellAddr] = { v: headers[i], t: 's' };
          wsDelivered[cellAddr].s = { font: { bold: true } };
        }
      } catch (e) {
        console.warn('Header styling failed (SheetJS may ignore styles):', e);
      }
      autoFitWorksheetColumns(wsDelivered, deliveredRows);
      XLSX.utils.book_append_sheet(wb, wsDelivered, 'Teslim_Edilenler');
    }

    const summary = [
      { Metric: 'Aktif Sipariş Sayısı', Value: activeRows.length },
      { Metric: 'Teslim Edilen Sayısı', Value: deliveredRows.length },
      { Metric: 'Aktif Sipariş Toplamı', Value: formatExportMoney((activeSource || []).reduce((sum, o) => sum + Number(o.totalPrice ?? calculateOrderTotal(o)), 0)) },
      { Metric: 'Teslim Edilen Toplamı', Value: formatExportMoney((deliveredSource || []).reduce((sum, o) => sum + Number(o.totalPrice ?? calculateOrderTotal(o)), 0)) }
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summary);
    autoFitWorksheetColumns(wsSummary, summary);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Ozet');

    const todayStamp = formatExportDate(new Date()).replace(/\./g, '-');
    const fileName = `Sofuoglu_Rapor_${todayStamp}.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast('Rapor başarıyla indirildi', 'success');
  } catch (err) {
    console.error('exportToExcel hatası:', err);
    toast('Dışa aktarma başarısız: ' + (err.message || 'Bilinmeyen hata'), 'error');
  } finally {
    hideLoader();
  }
}

// Modal open/close helpers and wiring
function openExportModal() { const m = document.getElementById('exportModal'); if (m) m.classList.add('open'); }
function closeExportModal() { const m = document.getElementById('exportModal'); if (m) m.classList.remove('open'); }

document.addEventListener('DOMContentLoaded', () => {
  const exportActive = document.getElementById('exportActiveCSVBtn');
  const exportHistory = document.getElementById('exportHistoryCSVBtn');
  if (exportActive) exportActive.addEventListener('click', openExportModal);
  if (exportHistory) exportHistory.addEventListener('click', openExportModal);

  const idAll = document.getElementById('exportAllBtn');
  const idMonth = document.getElementById('exportMonthBtn');
  const idDetailed = document.getElementById('exportDetailedBtn');
  const idCancel = document.getElementById('exportCancelBtn');

  if (idAll) idAll.addEventListener('click', () => { exportToExcel('all'); closeExportModal(); });
  if (idMonth) idMonth.addEventListener('click', () => { exportToExcel('month'); closeExportModal(); });
  if (idDetailed) idDetailed.addEventListener('click', () => { exportToExcel('detailed'); closeExportModal(); });
  if (idCancel) idCancel.addEventListener('click', closeExportModal);

  const exportModalEl = document.getElementById('exportModal');
  if (exportModalEl) exportModalEl.addEventListener('click', (e) => { if (e.target === exportModalEl) closeExportModal(); });
  // Maintenance buttons binding (if present)
  const migrateBtn = document.getElementById('migrateDataBtn');
  const testConnBtn = document.getElementById('testConnectionBtn');
  const refreshLogsBtn = document.getElementById('refreshLogsBtn');
  if (migrateBtn) migrateBtn.addEventListener('click', async (e) => { e.preventDefault(); await runMigrateData(); });
  if (testConnBtn) testConnBtn.addEventListener('click', async (e) => { e.preventDefault(); await runConnectionTest(); });
  if (refreshLogsBtn) refreshLogsBtn.addEventListener('click', async (e) => { e.preventDefault(); await renderSystemLogs(); });

  // Backup buttons binding (if present)
  const backupDownloadBtn = document.getElementById('backupDownloadBtn');
  const backupTelegramBtn = document.getElementById('backupTelegramBtn');
  if (backupDownloadBtn) backupDownloadBtn.addEventListener('click', async (e) => { e.preventDefault(); await downloadBackup(); });
  if (backupTelegramBtn) {
    backupTelegramBtn.addEventListener('click', async (e) => {
      e.preventDefault();

      // Role tabanlı kontrol: yalnızca Firestore'da role === 'admin' olanlar manuel Telegram yedeği gönderebilir
      if (!currentUserDoc || String(currentUserDoc.role || '').toLowerCase() !== 'admin') {
        toast('🚫 Yalnızca Admin yetkili kullanıcılar bu işlemi yapabilir.', 'error');
        return;
      }

      const originalText = backupTelegramBtn.innerHTML;
      backupTelegramBtn.disabled = true;
      backupTelegramBtn.innerHTML = '<span>⏳</span> Gönderiliyor...';

      try {
        // Yedek verisini oluştur
        const backupData = await generateBackupData();

        // Dosya adı oluştur
        const now = new Date();
        const yil = now.getFullYear();
        const ay = String(now.getMonth() + 1).padStart(2, '0');
        const gun = String(now.getDate()).padStart(2, '0');
        const saat = String(now.getHours()).padStart(2, '0');
        const dakika = String(now.getMinutes()).padStart(2, '0');
        const filename = `Sofuoglu_Yedek_${yil}-${ay}-${gun}_${saat}.${dakika}.json`;

        // Telegram'a gönder
        await sendBackupToTelegram(backupData, filename);

        // Sistem logu
        await logSystemEvent('info', `Yedek Telegram'a gönderildi: ${filename}`, {});

        // Başarı bildirimi
        const reportDiv = document.getElementById('backupReport');
        if (reportDiv) {
          reportDiv.innerHTML = `<div class="text-sm text-green-700 bg-green-50 p-3 rounded-lg"><strong>✅ Yedek Telegram'a başarıyla iletildi!</strong><br/><span class="text-xs">Dosya: ${escHtml(filename)}</span></div>`;
        }
        toast(`✅ Yedek Telegram'a gönderildi!`, 'success');

      } catch (err) {
        console.error('❌ Telegram gönderim hatası:', err);

        // Hata logu
        await logSystemEvent('error', `Telegram gönderim başarısız: ${err.message || 'Bilinmeyen hata'}`, {});

        // Hata bildirimi
        const reportDiv = document.getElementById('backupReport');
        if (reportDiv) {
          reportDiv.innerHTML = `<div class="text-sm text-red-600 bg-red-50 p-3 rounded-lg"><strong>❌ Hata:</strong> ${escHtml(err.message || 'Telegram gönderimi başarısız')}</div>`;
        }
        toast(`❌ Hata: ${err.message || 'Telegram gönderimi başarısız'}`, 'error');

      } finally {
        // Buton eski haline dönsün
        backupTelegramBtn.disabled = false;
        backupTelegramBtn.innerHTML = originalText;
      }
    });
  }

  // Mobile user info button
  const mobileUserInfoBtn = document.getElementById('mobile-user-info-btn');
  if (mobileUserInfoBtn) {
    mobileUserInfoBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const email = auth.currentUser?.email || 'Kullanıcı bulunamadı';
      toast(`Aktif Hesap: ${email}`, 'info');
    });
  }

  // ═══════════════════════════ KASA ÖZETI MODALI ═══════════════════════════
  const checkoutModal = document.getElementById('deliveryConfirmationModal');
  if (checkoutModal) {
    // Modal dışına tıklayınca kapat
    checkoutModal.addEventListener('click', (e) => {
      if (e.target === checkoutModal) {
        closeCheckoutModal();
      }
    });
  }

});

// ================= System Maintenance Utilities =================
const _systemLogs = [];

function appendSystemLog(entry) {
  try {
    _systemLogs.unshift(entry);
    const container = document.getElementById('systemLogs');
    if (container) {
      const color = entry.type === 'error' ? 'text-red-600' : 'text-green-700';
      const time = new Date(entry.ts || Date.now()).toLocaleString('tr-TR');
      const html = `<div class="mb-2"><div class="text-xs ${color}"><strong>[${escHtml(entry.type.toUpperCase())}]</strong> ${escHtml(entry.message)}</div><div class="text-xs text-gray-400">${escHtml(time)} ${entry.meta ? '- ' + escHtml(JSON.stringify(entry.meta)) : ''}</div></div>`;
      container.insertAdjacentHTML('afterbegin', html);
    }
  } catch (e) { console.warn('appendSystemLog hata:', e); }
}

async function logSystemEvent(type, message, meta = {}) {
  const entry = { type: String(type || 'info'), message: String(message || ''), meta, ts: new Date().toISOString() };
  appendSystemLog(entry);
  try {
    if (isPrivilegedUser(auth.currentUser?.email)) {
      await db.collection('systemLogs').add(entry);
    }
  } catch (err) {
    console.warn('system log write failed:', err);
  }
}

async function renderSystemLogs(limit = 100) {
  const container = document.getElementById('systemLogs');
  if (!container) return;
  container.innerHTML = '<div class="text-xs text-gray-400">Yükleniyor...</div>';
  try {
    const snap = await db.collection('systemLogs').orderBy('ts', 'desc').limit(limit).get();
    container.innerHTML = '';
    snap.docs.forEach(d => {
      const data = d.data();
      appendSystemLog({ type: data.type, message: data.message, meta: data.meta, ts: data.ts });
    });
  } catch (err) {
    container.innerHTML = `<div class="text-sm text-red-600">Loglar yüklenemedi: ${escHtml(err.message || '')}</div>`;
  }
}

async function runConnectionTest() {
  if (!isPrivilegedUser(auth.currentUser?.email)) { denyManagementAccess(); return; }
  showLoader();
  try {
    const doc = await db.collection('settings').doc('prices').get();
    if (doc.exists) {
      await logSystemEvent('info', 'Bağlantı testi başarılı: Firestore erişimi sağlandı', { doc: 'settings/prices' });
      document.getElementById('migrationReport').innerHTML = `<div class="text-sm text-green-700">Sistem Aktif/Çevrimiçi — Firestore erişimi var.</div>`;
    } else {
      await logSystemEvent('info', 'Bağlantı testi: settings/prices dokümanı yok (yine de bağlantı başarılı)');
      document.getElementById('migrationReport').innerHTML = `<div class="text-sm text-yellow-700">Bağlantı kuruldu ancak 'settings/prices' dokümanı bulunamadı.</div>`;
    }
  } catch (err) {
    await logSystemEvent('error', 'Bağlantı testi başarısız: ' + (err.message || ''), {});
    document.getElementById('migrationReport').innerHTML = `<div class="text-sm text-red-600">Bağlantı Hatası: ${escHtml(err.message || '')}</div>`;
  } finally { hideLoader(); }
}

async function runMigrateData() {
  if (!isPrivilegedUser(auth.currentUser?.email)) { denyManagementAccess(); return; }
  showLoader();
  let fixedCount = 0;
  try {
    const targets = ['orders', 'deliveredOrders'];
    for (const col of targets) {
      const snap = await db.collection(col).get();
      for (const doc of snap.docs) {
        const data = doc.data();
        const updates = {};
        if (data.tepsiParasi === undefined) updates.tepsiParasi = 'Alınmadı';
        if (data.deposit === undefined && data.kapora === undefined) updates.deposit = 0;
        if (data.ozelFiyat === undefined) updates.ozelFiyat = 0;
        if (Object.keys(updates).length) {
          await db.collection(col).doc(doc.id).update(updates);
          fixedCount++;
          await logSystemEvent('info', `Veri onarıldı: ${col}/${doc.id}`, { updates });
        }
      }
    }
    const msg = `Onarım tamamlandı. Toplam ${fixedCount} kayıt güncellendi.`;
    document.getElementById('migrationReport').innerHTML = `<div class="text-sm text-green-700">${escHtml(msg)}</div>`;
    await logSystemEvent('info', msg, { fixedCount });
  } catch (err) {
    const errMsg = 'Onarım işlemi başarısız: ' + (err.message || '');
    document.getElementById('migrationReport').innerHTML = `<div class="text-sm text-red-600">${escHtml(errMsg)}</div>`;
    await logSystemEvent('error', errMsg, { stack: err.stack });
  } finally {
    hideLoader();
    setTimeout(() => renderSystemLogs(), 500);
  }
}

// ════════════════════════════════════════════════════════════════════════
// ─── VERİ YEDEKLEMESİ (JSON İNDİRME + TELEGRAM HAZIRLIĞI) ───
// ════════════════════════════════════════════════════════════════════════

/**
 * Firestore'daki tüm koleksiyonları çekip tek bir JSON dosyasında birleştir
 */
async function generateBackupData() {
  const collections = ['orders', 'deliveredOrders', 'deletedOrders', 'users', 'settings', 'systemLogs'];
  const backup = {
    version: '1.0',
    timestamp: new Date().toISOString(),
    data: {}
  };

  for (const colName of collections) {
    try {
      const snap = await db.collection(colName).get();
      backup.data[colName] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      console.log(`✅ ${colName}: ${snap.docs.length} belge yedeklendi`);
    } catch (err) {
      console.warn(`⚠️ ${colName} yedeklemesi başarısız:`, err.message);
      backup.data[colName] = [];
    }
  }

  return backup;
}

/**
 * JSON verisini Blob'a çevirip tarayıcı üzerinden indirt
 */
async function downloadBackup() {
  showLoader();
  try {
    const backupData = await generateBackupData();
    const now = new Date();
    const yil = now.getFullYear();
    const ay = String(now.getMonth() + 1).padStart(2, '0');
    const gun = String(now.getDate()).padStart(2, '0');
    const saat = String(now.getHours()).padStart(2, '0');
    const dakika = String(now.getMinutes()).padStart(2, '0');
    const filename = `Sofuoglu_Yedek_${yil}-${ay}-${gun}_${saat}.${dakika}.json`;

    const jsonString = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    await logSystemEvent('info', `Yedek indirildi: ${filename}`, { size: blob.size });
    const reportDiv = document.getElementById('backupReport');
    if (reportDiv) {
      reportDiv.innerHTML = `<div class="text-sm text-green-700"><strong>✅ Yedek başarıyla indirildi!</strong><br/>Dosya: ${escHtml(filename)}<br/>Boyut: ${(blob.size / 1024).toFixed(2)} KB</div>`;
    }
    toast(`✅ Yedek indirildi: ${filename}`, 'success');
  } catch (err) {
    console.error('❌ downloadBackup hatası:', err);
    await logSystemEvent('error', 'Yedek indirme başarısız: ' + (err.message || ''), {});
    const reportDiv = document.getElementById('backupReport');
    if (reportDiv) {
      reportDiv.innerHTML = `<div class="text-sm text-red-600"><strong>❌ Hata:</strong> ${escHtml(err.message || 'Bilinmeyen hata')}</div>`;
    }
    toast('❌ Yedek indirilemedi: ' + (err.message || ''), 'error');
  } finally {
    hideLoader();
  }
}

/**
 * JSON verisini Telegram'a gönder (şimdilik boş; API entegrasyonu için hazır)
 * @param {Object} backupData - Yedek JSON verisi
 * @param {string} filename - Dosya adı
 */

async function sendBackupToTelegram(jsonData, filename) {
  // Güvenlik: sadece Firestore users dokümanında role === 'admin' olan kullanıcılar Telegram'a yedek gönderebilir
  try {
    const role = String(currentUserDoc?.role || '').toLowerCase();
    if (role !== 'admin') {
      console.warn('Telegram yedek gönderimi iptal edildi: kullanıcı admin değil.', currentUserDoc?.email || auth.currentUser?.email);
      return;
    }
  } catch (e) {
    console.warn('Telegram rol kontrolü sırasında hata:', e);
    return;
  }

  const BOT_TOKEN = '8913566461:AAFuOk635M9yuBQfPtoQRkRYhbHjQpke8mo';
  const CHAT_ID = '-5111631522';

  // JSON verisini bir dosya (Blob) haline getiriyoruz
  const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
  const formData = new FormData();
  formData.append('chat_id', CHAT_ID);
  formData.append('document', blob, filename);
  formData.append('caption', `📁 Sofuoğlu Baklava Otomatik Yedek\n📅 Tarih: ${new Date().toLocaleString('tr-TR')}`);

  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Telegram API Hatası [${response.status}]: ${errorText}`);
    }

    const result = await response.json();
    console.log("✅ Yedek Telegram'a başarıyla gönderildi.", result);
    return result;

  } catch (error) {
    console.error("❌ Telegram bağlantı hatası:", error);
    throw error;
  }
}

/**
 * ═════════════════════════════════════════════════════════════════════════
 * ZAMANLANMıŞ YEDEKLEME SİSTEMİ (Automatic Backup Scheduler)
 * ═════════════════════════════════════════════════════════════════════════
 * Hedef Saatler: 00:00, 08:00, 12:00, 16:00, 20:00
 * Mükerrer Gönderim Engeli: localStorage ile kilit sistemi
 * Sessiz Gönderim: Arka planda, DownloadBackup olmadan sadece Telegram'a
 */

/**
 * Zamanlanmış yedeklemeyi sessizce gerçekleştir
 * (Kullanıcı etkileşimine ihtiyaç yok, arka planda çalışır)
 */
async function executeScheduledBackup() {
  try {
    // Yedek verisini oluştur
    const backupData = await generateBackupData();

    // Dosya adı oluştur
    const now = new Date();
    const yil = now.getFullYear();
    const ay = String(now.getMonth() + 1).padStart(2, '0');
    const gun = String(now.getDate()).padStart(2, '0');
    const saat = String(now.getHours()).padStart(2, '0');
    const dakika = String(now.getMinutes()).padStart(2, '0');
    const filename = `Sofuoglu_Yedek_${yil}-${ay}-${gun}_${saat}.${dakika}.json`;

    // Telegram'a gönder (sessiz, DownloadBackup vs açılmaz)
    await sendBackupToTelegram(backupData, filename);

    // Sistem logu (kimin ekranında tetiklendiğini kaydet)
    const userInfo = currentUserDoc?.displayName || auth.currentUser?.email || '(Bilinmeyen)';
    await logSystemEvent('info', `⏰ Otomatik Yedek Gönderildi: ${filename} (${userInfo})`, { userName: userInfo, role: currentUserDoc?.role });

    // localStorage'a saat bilgisini kaydet (mükerrer engeli)
    localStorage.setItem('lastBackupHour', saat);

    console.log(`✅ Zamanlanmış Yedek Başarıyla Gönderildi [${saat}:${dakika}] - ${userInfo}`);

  } catch (err) {
    console.error('❌ Zamanlanmış Yedek Hatası:', err);
    const userInfo = currentUserDoc?.displayName || auth.currentUser?.email || '(Bilinmeyen)';
    await logSystemEvent('error', `Zamanlanmış yedek hatası (${userInfo}): ${err.message || 'Bilinmeyen hata'}`, { userName: userInfo, error: err.message });
  }
}

/**
 * Her dakika çalışan yedekleme kontrol mekanizması
 * Hedef saatlerde otomatik yedekleme tetikle
 */
function checkScheduledBackup() {
  // Sadece Firestore users dokümanında role === 'admin' olan kullanıcılar için çalış
  if (!currentUserDoc || String(currentUserDoc.role || '').toLowerCase() !== 'admin') {
    return;
  }

  const SCHEDULED_HOURS = ['00', '01', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23'];
  const now = new Date();
  const currentHour = String(now.getHours()).padStart(2, '0');

  // Hedef saatlerden biri mi?
  if (!SCHEDULED_HOURS.includes(currentHour)) {
    return;
  }

  // Mükerrer gönderim kontrolü (bu saat için zaten gönderilmiş mi?)
  const lastBackupHour = localStorage.getItem('lastBackupHour');
  if (lastBackupHour === currentHour) {
    // Aynı saat dilimi içinde zaten yedek gönderilmiş
    return;
  }

  // Arka planda yedeklemeyi başlat
  executeScheduledBackup();
}

/**
 * Zamanlanmış yedekleme sistemini başlat
 * (Her 1 dakikada bir kontrol)
 */
function startScheduledBackupSystem() {
  // Sistem zaten çalışıyorsa, yeniden başlatma
  if (window._scheduledBackupInterval) {
    console.warn('⚠️ Zamanlanmış yedekleme sistemi zaten çalışıyor');
    return;
  }

  // Sadece Firestore users dokümanında role === 'admin' olan kullanıcılar için başlat
  if (!currentUserDoc || String(currentUserDoc.role || '').toLowerCase() !== 'admin') {
    console.warn('⚠️ Zamanlanmış yedekleme: Yetersiz yetki (sadece Admin)');
    return;
  }

  // Her 1 dakikada bir kontrol et
  window._scheduledBackupInterval = setInterval(checkScheduledBackup, 60000);

  // İlk kez hemen kontrol et
  checkScheduledBackup();

  const userInfo = currentUserDoc?.displayName || auth.currentUser?.email || '(Bilinmeyen)';
  console.log(`✅ Zamanlanmış Yedekleme Sistemi Başlatıldı - ${userInfo} (Her 1 dakikada bir kontrol)`);
}

/**
 * Zamanlanmış yedekleme sistemini durdur
 */
function stopScheduledBackupSystem() {
  if (window._scheduledBackupInterval) {
    clearInterval(window._scheduledBackupInterval);
    window._scheduledBackupInterval = null;
    console.log('⛔ Zamanlanmış Yedekleme Sistemi Durduruldu');
  }
}

// ════════════════════════════════════════════════════════════════════════
// ─── GÜVENLİK MODÜLü — Kullanıcı Belgesi, Kilit Ekranı, İzin Kontrolü ───
// ════════════════════════════════════════════════════════════════════════

/**
 * Firestore users/{uid} belgesini okur.
 * isActive: false → oturumu kapat, login'e yönlendir.
 * role: 'user' + mesai dışı → kilit ekranını göster.
 */
async function checkUserDocument(user) {
  try {
    const snap = await db.collection('users').doc(user.uid).get();

    if (!snap.exists) {
      // users/{uid} belgesi yok — eski kullanıcılar için uyarı ver ama engelleme
      console.warn('⚠️ users/' + user.uid + ' belgesi bulunamadı. Güvenlik kuralları tam çalışmayabilir.');
      // Fallback: e-posta listesinden kontrol
      currentUserDoc = { role: isPrivilegedUser(user.email) ? 'admin' : 'user', isActive: true };
      updateExcelExportButtonsVisibility(currentUserDoc);
      return;
    }

    currentUserDoc = snap.data();
    updateExcelExportButtonsVisibility(currentUserDoc);

    // İsActive kontrolü
    if (!currentUserDoc.isActive) {
      console.warn('🚫 Hesap devre dışı:', user.email);
      toast('Hesabınız devre dışı bırakılmıştır. Lütfen yöneticinizle iletişime geçin.', 'error');
      await firebase.auth().signOut();
      setTimeout(() => { window.location.href = 'index.html'; }, 2000);
      return;
    }

    console.log('✅ Kullanıcı belgesi yüklendi:', currentUserDoc.role, currentUserDoc.email);

  } catch (err) {
    console.error('❌ checkUserDocument hatası:', err);
    updateExcelExportButtonsVisibility({ role: 'user' });
    // permission-denied: Bu kullanıcı users koleksiyonuna erişemiyor
    if (err.code === 'permission-denied') {
      handlePermissionDenied();
    }
  }
}

/**
 * permission-denied hatalarını yakala ve kullanıcıyı çıkart.
 * Firestore listeners'larında çağrılır.
 */
function handlePermissionDenied() {
  console.error('🚫 Firestore permission-denied — oturum sonlandırılıyor.');
  toast('Oturum yetkiniz sona erdi. Lütfen tekrar giriş yapın.', 'error');
  if (timeWatcherInterval) clearInterval(timeWatcherInterval);
  setTimeout(async () => {
    try { await firebase.auth().signOut(); } catch (e) { /* sessiz */ }
    window.location.href = 'index.html';
  }, 2500);
}

// ════════════════════════════════════════════════════════════════════════
// ─── KULLANICI YÖNETİMİ MODÜLÜ — Liste, Ekle, Pasif Yap ────────────────
// ════════════════════════════════════════════════════════════════════════

/** Kullanıcı Ayarları sayfasını yükle ve listeyi çek */
async function loadUserSettingsPage() {
  const tbody = document.getElementById('users-list-body');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="5" class="text-center py-10 text-gray-400 text-sm">Yükleniyor...</td></tr>';

  try {
    const snap = await db.collection('users').get();
    const currentUid = auth.currentUser?.uid;
    let html = '';

    if (snap.empty) {
      html = '<tr><td colspan="5" class="text-center py-10 text-gray-400 text-sm">Hiç kullanıcı bulunamadı.</td></tr>';
    } else {
      snap.docs.forEach(doc => {
        const u = doc.data();
        const uid = doc.id;
        const isDeveloper = u.isDeveloper === true;
        const isSelf = currentUid === uid;
        const statusBadge = u.isActive
          ? '<span class="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-[10px] font-bold">AKTİF</span>'
          : '<span class="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-[10px] font-bold">PASİF</span>';

        const baseRoleBadge = u.role === 'admin'
          ? '<span class="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-[10px] font-bold">ADMIN</span>'
          : '<span class="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-[10px] font-bold">USER</span>';
        const roleBadge = isDeveloper
          ? `${baseRoleBadge} `
          : baseRoleBadge;

        // Action badge (styled) for toggling active/passive state
        const actionBtn = u.isActive
          ? `<button data-user-id="${uid}" data-current-status="active" onclick="toggleUserStatus('${uid}', true)" class="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap">Pasif Yap</button>`
          : `<button data-user-id="${uid}" data-current-status="inactive" onclick="toggleUserStatus('${uid}', false)" class="bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap">Aktif Yap</button>`;

        // Show permanent delete button for every user (no special protections)
        const hardDeleteBtn = `<button onclick="deleteUser('${uid}')" class="inline-flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white text-xs px-3 py-1 rounded font-semibold transition" title="Kullanıcıyı Sil">Kullanıcıyı Sil</button>`;

        // Her kullanıcı satırında toggle göster (developer dahil).
        // Sadece kendi hesabınız için buton devre dışı bırakılır (kendini kilitlemeyi önlemek için).
        const actionCell = actionBtn;

        html += `
          <tr class="border-b border-gray-100 hover:bg-gray-50 transition-colors">
            <td class="px-4 py-3 font-medium text-gray-700">
              <div class="flex items-center gap-2">
                ${hardDeleteBtn}
                <span>${u.displayName || '—'}</span>
              </div>
            </td>
            <td class="px-4 py-3 text-gray-500">${u.email}</td>
            <td class="px-4 py-3 text-center">${roleBadge}</td>
            <td class="px-4 py-3 text-center">${statusBadge}</td>
            <td class="px-4 py-3 text-center">
              <div class="flex items-center justify-center gap-2">
                ${actionCell}
              </div>
            </td>
          </tr>
        `;
      });
    }
    tbody.innerHTML = html;
  } catch (err) {
    console.error('❌ loadUserSettingsPage hatası:', err);
    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-10 text-red-500 text-sm">Yükleme hatası: ${err.message}</td></tr>`;
  }
}

/** Yeni kullanıcı ekleme modalını aç */
function openAddUserModal() {
  document.getElementById('newUserName').value = '';
  document.getElementById('newUserEmail').value = '';
  document.getElementById('newUserPassword').value = '';
  document.getElementById('newUserRole').value = 'user';
  document.getElementById('addUserError').classList.add('hidden');
  document.getElementById('addUserModal').classList.add('open');
}

/** Yeni kullanıcı ekleme modalını kapat */
function closeAddUserModal() {
  document.getElementById('addUserModal').classList.remove('open');
}

/** 
 * Yeni kullanıcıyı Auth'a ve Firestore'a kaydet.
 * Secondary App kullanarak admin oturumunun bozulmasını engeller.
 */
async function submitAddUser() {
  const name = document.getElementById('newUserName').value.trim();
  const email = document.getElementById('newUserEmail').value.trim();
  const password = document.getElementById('newUserPassword').value.trim();
  const role = document.getElementById('newUserRole').value;
  const errorEl = document.getElementById('addUserError');
  const btn = document.getElementById('submitAddUserBtn');

  if (!name || !email || !password) {
    errorEl.textContent = 'Lütfen tüm yıldızlı alanları doldurunuz.';
    errorEl.classList.remove('hidden');
    return;
  }

  if (password.length < 6) {
    errorEl.textContent = 'Şifre en az 6 karakter olmalıdır.';
    errorEl.classList.remove('hidden');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Oluşturuluyor...';
  errorEl.classList.add('hidden');

  let secondaryApp = null;
  try {
    // 1. İkinci bir Firebase uygulaması oluştur (Admin oturumunu korumak için)
    secondaryApp = firebase.initializeApp(firebaseConfig, "SecondaryApp");

    // 2. Auth kaydı yap
    const userCredential = await secondaryApp.auth().createUserWithEmailAndPassword(email, password);
    const uid = userCredential.user.uid;

    // 3. Firestore'a kullanıcı bilgilerini yaz (Ana uygulama ile)
    await db.collection('users').doc(uid).set({
      uid: uid,
      email: email,
      displayName: name,
      role: role,
      isDeveloper: false,
      isActive: true,
      createdAt: new Date().toISOString()
    });

    // 4. Secondary App'ten çıkış yap ve sil
    await secondaryApp.auth().signOut();
    await secondaryApp.delete();
    secondaryApp = null;

    toast('✅ Kullanıcı başarıyla oluşturuldu!', 'success');
    closeAddUserModal();
    loadUserSettingsPage();

  } catch (err) {
    console.error('❌ submitAddUser hatası:', err);
    errorEl.textContent = 'Hata: ' + (err.message || 'Bilinmeyen hata');
    errorEl.classList.remove('hidden');

    // Hata durumunda secondary app'i temizle
    if (secondaryApp) {
      try { await secondaryApp.delete(); } catch (e) { }
    }
  } finally {
    btn.disabled = false;
    btn.textContent = 'Oluştur';
  }
}


/** Event listener'ları bağla */
function bindUserManagementListeners() {
  const openBtn = document.getElementById('openAddUserModalBtn');
  const closeBtn = document.getElementById('closeAddUserModalBtn');
  const cancelBtn = document.getElementById('cancelAddUserBtn');
  const submitBtn = document.getElementById('submitAddUserBtn');

  if (openBtn) openBtn.addEventListener('click', openAddUserModal);
  if (closeBtn) closeBtn.addEventListener('click', closeAddUserModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeAddUserModal);
  if (submitBtn) submitBtn.addEventListener('click', submitAddUser);

  // Modal dışına tıklayınca kapat
  const modal = document.getElementById('addUserModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeAddUserModal();
    });
  }
}

// Global atamalar
window.loadUserSettingsPage = loadUserSettingsPage;

// Init çağrılarına ekle
document.addEventListener('DOMContentLoaded', () => {
  bindUserManagementListeners();
});
