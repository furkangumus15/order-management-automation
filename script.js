// Kullanıcı sayfayı kapatmaya veya yenilemeye çalıştığında uyarı ver
window.addEventListener('beforeunload', function (e) {
    // Çoğu modern tarayıcı kendi standart güvenlik mesajını gösterir
    e.preventDefault();
    e.returnValue = ''; // Bu satır uyarının çıkmasını tetikler
});

// Veri Yapısı
let orders = JSON.parse(localStorage.getItem('orders')) || [];
let deliveredOrders = JSON.parse(localStorage.getItem('deliveredOrders')) || [];
let activeOrderSearchTerm = '';

// Sayfa yüklendiğinde
document.addEventListener('DOMContentLoaded', function () {
    loadOrders();
    loadDeliveredOrders();
    updateStatistics();
    updateGeneralSummary();

    // Form gönderme
    document.getElementById('orderForm').addEventListener('submit', addOrder);
    document.getElementById('editForm').addEventListener('submit', updateOrder);
    document.getElementById('orderSearchInput').addEventListener('input', function (e) {
        activeOrderSearchTerm = e.target.value.trim();
        loadOrders();
    });

    // Modal kapatma
    document.querySelector('.close').addEventListener('click', closeModal);
    window.addEventListener('click', function (event) {
        const modal = document.getElementById('editModal');
        if (event.target === modal) {
            closeModal();
        }
    });
});

// Yeni sipariş ekleme
function addOrder(e) {
    e.preventDefault();

    const order = {
        id: Date.now(),
        customerName: document.getElementById('customerName').value,
        phoneNumber: document.getElementById('phoneNumber').value,
        kareBaklava: parseInt(document.getElementById('kareBaklava').value) || 0,
        kareBaklavaKg: parseFloat(document.getElementById('kareBaklavaKg').value) || 0,
        evBaklavasi: parseInt(document.getElementById('evBaklavasi').value) || 0,
        evBaklavasiKg: parseFloat(document.getElementById('evBaklavasiKg').value) || 0,
        sariBurma: parseInt(document.getElementById('sariBurma').value) || 0,
        sariBurmaKg: parseFloat(document.getElementById('sariBurmaKg').value) || 0,
        suBoregi: parseInt(document.getElementById('suBoregi').value) || 0,
        suBoregiKg: parseFloat(document.getElementById('suBoregiKg').value) || 0,
        deliveryDate: document.getElementById('deliveryDate').value,
        tepsiParasi: document.getElementById('tepsiParasi').value,
        createdDate: new Date().toISOString().split('T')[0]
    };

    orders.push(order);
    saveOrders();
    loadOrders();
    updateStatistics();
    updateGeneralSummary();

    // Formu temizle
    document.getElementById('orderForm').reset();

    // Başarı mesajı
    showNotification('Sipariş başarıyla eklendi!', 'success');
}

// Siparişleri yükleme
function loadOrders() {
    const tbody = document.getElementById('ordersTableBody');
    tbody.innerHTML = '';

    const filteredOrders = orders.filter(order => {
        if (!activeOrderSearchTerm) {
            return true;
        }

        const searchText = normalizeText(activeOrderSearchTerm);
        const orderText = normalizeText([
            order.customerName,
            order.phoneNumber,
            order.tepsiParasi,
            order.kareBaklava > 0 ? 'kare baklava' : '',
            order.evBaklavasi > 0 ? 'ev baklavasi' : '',
            order.sariBurma > 0 ? 'sari burma' : '',
            order.suBoregi > 0 ? 'su boregi' : ''
        ].join(' '));

        return orderText.includes(searchText);
    });

    if (filteredOrders.length === 0) {
        const emptyMessage = activeOrderSearchTerm
            ? 'Aramanıza uygun sipariş bulunamadı.'
            : 'Henüz sipariş bulunmamaktadır.';
        tbody.innerHTML = `<tr><td colspan="9" class="empty-message">${emptyMessage}</td></tr>`;
        return;
    }

    // Teslim tarihine göre sırala
    const sortedOrders = [...filteredOrders].sort((a, b) => new Date(a.deliveryDate) - new Date(b.deliveryDate));

    // Siparişleri tarihe göre grupla
    const ordersByDate = {};
    sortedOrders.forEach(order => {
        const dateKey = order.deliveryDate;
        if (!ordersByDate[dateKey]) {
            ordersByDate[dateKey] = [];
        }
        ordersByDate[dateKey].push(order);
    });

    // Her tarih grubu için siparişleri ve toplamları göster
    Object.keys(ordersByDate).sort().forEach(dateKey => {
        const dateOrders = ordersByDate[dateKey].sort((a, b) =>
            a.customerName.localeCompare(b.customerName, 'tr', { sensitivity: 'base' })
        );
        const deliveryDate = new Date(dateKey);
        const formattedDate = deliveryDate.toLocaleDateString('tr-TR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });

        // Bugünün tarihiyle karşılaştır
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        deliveryDate.setHours(0, 0, 0, 0);

        let dateColorClass = '';
        if (deliveryDate < today) {
            dateColorClass = 'date-past';
        } else if (deliveryDate.getTime() === today.getTime()) {
            dateColorClass = 'date-today';
        } else {
            dateColorClass = 'date-future';
        }

        // Tarih başlık satırı
        const dateHeaderRow = document.createElement('tr');
        dateHeaderRow.className = `date-header ${dateColorClass}`;
        dateHeaderRow.innerHTML = `
            <td colspan="11" style="text-align: left; font-weight: bold; font-size: 1.1rem; padding: 15px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                📅 ${formattedDate}
            </td>
        `;
        tbody.appendChild(dateHeaderRow);

        // Günlük toplamları hesapla
        let dailyTotals = {
            kareBaklava: 0, kareBaklavaKg: 0,
            evBaklavasi: 0, evBaklavasiKg: 0,
            sariBurma: 0, sariBurmaKg: 0,
            suBoregi: 0, suBoregiKg: 0
        };

        // O tarihteki tüm siparişleri göster
        dateOrders.forEach(order => {
            const row = document.createElement('tr');
            const kbKg = (order.kareBaklavaKg || 0);
            const ebKg = (order.evBaklavasiKg || 0);
            const sbKg = (order.sariBurmaKg || 0);
            const suKg = (order.suBoregiKg || 0);

            row.innerHTML = `
                <td>${escHtml(order.customerName)}</td>
                <td>${escHtml(order.phoneNumber)}</td>
                <td>${order.kareBaklava > 0 ? order.kareBaklava : '-'}</td>
                <td>${kbKg > 0 ? kbKg : '-'}</td>
                <td>${order.evBaklavasi > 0 ? order.evBaklavasi : '-'}</td>
                <td>${ebKg > 0 ? ebKg : '-'}</td>
                <td>${order.sariBurma > 0 ? order.sariBurma : '-'}</td>
                <td>${sbKg > 0 ? sbKg : '-'}</td>
                <td>${order.suBoregi > 0 ? order.suBoregi : '-'}</td>
                <td>${suKg > 0 ? suKg : '-'}</td>
                <td><span class="status-badge status-${order.tepsiParasi === 'Alındı' ? 'alindi' : 'alinmadi'}">${escHtml(order.tepsiParasi)}</span></td>
                <td>${order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString('tr-TR') : ''}</td>
                <td>
                    <button class="btn btn-update" onclick="editOrder(${order.id})">Güncelle</button>
                    <button class="btn btn-delete" onclick="deleteOrder(${order.id})">Sil</button>
                    <button class="btn btn-deliver" onclick="deliverOrder(${order.id})">Teslim Et</button>
                </td>
            `;

            tbody.appendChild(row);

            // Toplamları hesapla
            dailyTotals.kareBaklava += order.kareBaklava;
            dailyTotals.kareBaklavaKg += kbKg;
            dailyTotals.evBaklavasi += order.evBaklavasi;
            dailyTotals.evBaklavasiKg += ebKg;
            dailyTotals.sariBurma += order.sariBurma;
            dailyTotals.sariBurmaKg += sbKg;
            dailyTotals.suBoregi += order.suBoregi;
            dailyTotals.suBoregiKg += suKg;
        });

        // Günlük toplam satırı (aktif siparişler)
        const totalRow = document.createElement('tr');
        totalRow.className = 'daily-total-row';
        totalRow.innerHTML = `
            <td colspan="2" style="text-align: right; font-weight: bold; background: #f0f0f0; padding: 12px;">📊 GÜNLÜK TOPLAM:</td>
            <td style="font-weight: bold; background: #e8f5e9; color: #2e7d32;">${dailyTotals.kareBaklava > 0 ? dailyTotals.kareBaklava : '-'}</td>
            <td style="font-weight: bold; background: #e8f5e9; color: #2e7d32;">${dailyTotals.kareBaklavaKg > 0 ? dailyTotals.kareBaklavaKg : '-'}</td>
            <td style="font-weight: bold; background: #e8f5e9; color: #2e7d32;">${dailyTotals.evBaklavasi > 0 ? dailyTotals.evBaklavasi : '-'}</td>
            <td style="font-weight: bold; background: #e8f5e9; color: #2e7d32;">${dailyTotals.evBaklavasiKg > 0 ? dailyTotals.evBaklavasiKg : '-'}</td>
            <td style="font-weight: bold; background: #e8f5e9; color: #2e7d32;">${dailyTotals.sariBurma > 0 ? dailyTotals.sariBurma : '-'}</td>
            <td style="font-weight: bold; background: #e8f5e9; color: #2e7d32;">${dailyTotals.sariBurmaKg > 0 ? dailyTotals.sariBurmaKg : '-'}</td>
            <td style="font-weight: bold; background: #e8f5e9; color: #2e7d32;">${dailyTotals.suBoregi > 0 ? dailyTotals.suBoregi : '-'}</td>
            <td style="font-weight: bold; background: #e8f5e9; color: #2e7d32;">${dailyTotals.suBoregiKg > 0 ? dailyTotals.suBoregiKg : '-'}</td>
            <td colspan="3" style="background: #f0f0f0;"></td>
        `;
        tbody.appendChild(totalRow);
    });
}

function normalizeText(text) {
    return String(text || '')
        .toLocaleLowerCase('tr-TR')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

// Teslim edilenleri yükleme
function loadDeliveredOrders() {
    const tbody = document.getElementById('deliveredOrdersTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';
    let filteredDelivered = deliveredOrders;

    if (filteredDelivered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" class="empty-message">Henüz teslim edilen sipariş bulunmamaktadır.</td></tr>`;
        return;
    }

    filteredDelivered.forEach(order => {
        const row = document.createElement('tr');

        // ✅ TEPSİ İADE DURUMUNU KONTROL ET
        const trayStatus = order.trayReturned ? 'İade Alındı ✅' : 'Bekleniyor ⏳';
        const trayBadgeClass = order.trayReturned ? 'status-alindi' : 'status-alinmadi';

        row.innerHTML = `
            <td>${escHtml(order.customerName)}</td>
            <td>${escHtml(order.phoneNumber)}</td>
            <td>${order.kareBaklava > 0 ? order.kareBaklava : '-'}</td>
            <td>${order.evBaklavasi > 0 ? order.evBaklavasi : '-'}</td>
            <td>${order.sariBurma > 0 ? order.sariBurma : '-'}</td>
            <td>${order.suBoregi > 0 ? order.suBoregi : '-'}</td>
            <td><span class="status-badge status-${order.tepsiParasi === 'Alındı' ? 'alindi' : 'alinmadi'}">${escHtml(order.tepsiParasi)}</span></td>
            <td><span class="status-badge ${trayBadgeClass}">${trayStatus}</span></td>
            <td>${order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString('tr-TR') : ''}</td>
            <td>
                <button class="btn btn-deliver" onclick="markTrayReturned(${order.id})">
                    🔄 ${order.trayReturned ? 'İade Tamamlandı' : 'Tepsi İade Kaydet'}
                </button>
                <button class="btn btn-delete" onclick="deleteDeliveredOrder(${order.id})">Sil</button>
            </td>
        `;

        tbody.appendChild(row);
    });
}

function markTrayReturned(orderId) {
    const order = deliveredOrders.find(o => o.id === orderId);
    if (!order) {
        showNotification('Sipariş bulunamadı!', 'error');
        return;
    }

    // Tepsi iade durumunu tersine çevir
    order.trayReturned = !order.trayReturned;
    order.trayReturnedDate = order.trayReturned ? new Date().toISOString() : null;

    // Kaydet
    saveDeliveredOrders();
    loadDeliveredOrders();

    const message = order.trayReturned
        ? `✅ ${order.customerName} - Tepsi iade kaydedildi`
        : `⏳ ${order.customerName} - Tepsi iade kaydı silindi`;

    showNotification(message, 'success');
}
// Teslim tarihine göre sırala
deliveredOrders.sort((a, b) => new Date(b.deliveryDate) - new Date(a.deliveryDate));

// Siparişleri tarihe göre grupla
const ordersByDate = {};
deliveredOrders.forEach(order => {
    const dateKey = order.deliveryDate;
    if (!ordersByDate[dateKey]) {
        ordersByDate[dateKey] = [];
    }
    ordersByDate[dateKey].push(order);
});

// Her tarih grubu için siparişleri ve toplamları göster
Object.keys(ordersByDate).sort().reverse().forEach(dateKey => {
    const dateOrders = ordersByDate[dateKey];
    const deliveryDate = new Date(dateKey);
    const formattedDate = deliveryDate.toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    // Tarih başlık satırı
    const dateHeaderRow = document.createElement('tr');
    dateHeaderRow.className = 'date-header';
    dateHeaderRow.innerHTML = `
            <td colspan="13" style="text-align: left; font-weight: bold; font-size: 1.1rem; padding: 15px; background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); color: white;">
                📅 ${formattedDate}
            </td>
        `;
    tbody.appendChild(dateHeaderRow);

    // Günlük toplamları hesapla
    let dailyTotals = {
        kareBaklava: 0, kareBaklavaKg: 0,
        evBaklavasi: 0, evBaklavasiKg: 0,
        sariBurma: 0, sariBurmaKg: 0,
        suBoregi: 0, suBoregiKg: 0
    };

    // O tarihteki tüm siparişleri göster
    dateOrders.forEach(order => {
        const row = document.createElement('tr');
        const deliveredAt = new Date(order.deliveredAt).toLocaleString('tr-TR');
        const kbKg = (order.kareBaklavaKg || 0);
        const ebKg = (order.evBaklavasiKg || 0);
        const sbKg = (order.sariBurmaKg || 0);
        const suKg = (order.suBoregiKg || 0);

        row.innerHTML = `
                <td>${escHtml(order.customerName)}</td>
                <td>${escHtml(order.phoneNumber)}</td>
                <td>${order.kareBaklava > 0 ? order.kareBaklava : '-'}</td>
                <td>${kbKg > 0 ? kbKg : '-'}</td>
                <td>${order.evBaklavasi > 0 ? order.evBaklavasi : '-'}</td>
                <td>${ebKg > 0 ? ebKg : '-'}</td>
                <td>${order.sariBurma > 0 ? order.sariBurma : '-'}</td>
                <td>${sbKg > 0 ? sbKg : '-'}</td>
                <td>${order.suBoregi > 0 ? order.suBoregi : '-'}</td>
                <td>${suKg > 0 ? suKg : '-'}</td>
                <td><span class="status-badge status-${order.tepsiParasi === 'Alındı' ? 'alindi' : 'alinmadi'}">${escHtml(order.tepsiParasi)}</span></td>
                <td>${deliveredAt}</td>
                <td>
                    <button class="btn btn-update" onclick="editDeliveredOrder(${order.id})">Güncelle</button>
                    <button class="btn btn-delete" onclick="deleteDeliveredOrder(${order.id})">Sil</button>
                </td>
            `;

        tbody.appendChild(row);

        // Toplamları hesapla
        dailyTotals.kareBaklava += order.kareBaklava;
        dailyTotals.kareBaklavaKg += kbKg;
        dailyTotals.evBaklavasi += order.evBaklavasi;
        dailyTotals.evBaklavasiKg += ebKg;
        dailyTotals.sariBurma += order.sariBurma;
        dailyTotals.sariBurmaKg += sbKg;
        dailyTotals.suBoregi += order.suBoregi;
        dailyTotals.suBoregiKg += suKg;
    });

    // Günlük toplam satırı (teslim edilenler)
    const totalRow = document.createElement('tr');
    totalRow.className = 'daily-total-row';
    totalRow.innerHTML = `
            <td colspan="2" style="text-align: right; font-weight: bold; background: #f0f0f0; padding: 12px;">📊 GÜNLÜK TOPLAM:</td>
            <td style="font-weight: bold; background: #e8f5e9; color: #2e7d32;">${dailyTotals.kareBaklava > 0 ? dailyTotals.kareBaklava : '-'}</td>
            <td style="font-weight: bold; background: #e8f5e9; color: #2e7d32;">${dailyTotals.kareBaklavaKg > 0 ? dailyTotals.kareBaklavaKg : '-'}</td>
            <td style="font-weight: bold; background: #e8f5e9; color: #2e7d32;">${dailyTotals.evBaklavasi > 0 ? dailyTotals.evBaklavasi : '-'}</td>
            <td style="font-weight: bold; background: #e8f5e9; color: #2e7d32;">${dailyTotals.evBaklavasiKg > 0 ? dailyTotals.evBaklavasiKg : '-'}</td>
            <td style="font-weight: bold; background: #e8f5e9; color: #2e7d32;">${dailyTotals.sariBurma > 0 ? dailyTotals.sariBurma : '-'}</td>
            <td style="font-weight: bold; background: #e8f5e9; color: #2e7d32;">${dailyTotals.sariBurmaKg > 0 ? dailyTotals.sariBurmaKg : '-'}</td>
            <td style="font-weight: bold; background: #e8f5e9; color: #2e7d32;">${dailyTotals.suBoregi > 0 ? dailyTotals.suBoregi : '-'}</td>
            <td style="font-weight: bold; background: #e8f5e9; color: #2e7d32;">${dailyTotals.suBoregiKg > 0 ? dailyTotals.suBoregiKg : '-'}</td>
            <td colspan="3" style="background: #f0f0f0;"></td>
        `;
    tbody.appendChild(totalRow);
});


// Sipariş düzenleme
function editOrder(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    document.getElementById('editOrderId').value = order.id;
    document.getElementById('editCustomerName').value = order.customerName;
    document.getElementById('editPhoneNumber').value = order.phoneNumber;
    document.getElementById('editKareBaklava').value = order.kareBaklava;
    document.getElementById('editKareBaklavaKg').value = order.kareBaklavaKg || 0;
    document.getElementById('editEvBaklavasi').value = order.evBaklavasi;
    document.getElementById('editEvBaklavasiKg').value = order.evBaklavasiKg || 0;
    document.getElementById('editSariBurma').value = order.sariBurma;
    document.getElementById('editSariBurmaKg').value = order.sariBurmaKg || 0;
    document.getElementById('editSuBoregi').value = order.suBoregi;
    document.getElementById('editSuBoregiKg').value = order.suBoregiKg || 0;
    document.getElementById('editDeliveryDate').value = order.deliveryDate;
    document.getElementById('editTepsiParasi').value = order.tepsiParasi;

    // Modal'ı aktif sipariş için işaretle
    document.getElementById('editModal').setAttribute('data-type', 'active');
    document.getElementById('editModal').style.display = 'block';
}

// Sipariş güncelleme
function updateOrder(e) {
    e.preventDefault();

    const orderId = parseInt(document.getElementById('editOrderId').value);
    const modalType = document.getElementById('editModal').getAttribute('data-type');

    // Teslim edilen sipariş mi yoksa aktif sipariş mi kontrol et
    if (modalType === 'delivered') {
        const orderIndex = deliveredOrders.findIndex(o => o.id === orderId);
        if (orderIndex === -1) return;

        deliveredOrders[orderIndex] = {
            ...deliveredOrders[orderIndex],
            customerName: document.getElementById('editCustomerName').value,
            phoneNumber: document.getElementById('editPhoneNumber').value,
            kareBaklava: parseInt(document.getElementById('editKareBaklava').value) || 0,
            kareBaklavaKg: parseFloat(document.getElementById('editKareBaklavaKg').value) || 0,
            evBaklavasi: parseInt(document.getElementById('editEvBaklavasi').value) || 0,
            evBaklavasiKg: parseFloat(document.getElementById('editEvBaklavasiKg').value) || 0,
            sariBurma: parseInt(document.getElementById('editSariBurma').value) || 0,
            sariBurmaKg: parseFloat(document.getElementById('editSariBurmaKg').value) || 0,
            suBoregi: parseInt(document.getElementById('editSuBoregi').value) || 0,
            suBoregiKg: parseFloat(document.getElementById('editSuBoregiKg').value) || 0,
            deliveryDate: document.getElementById('editDeliveryDate').value,
            tepsiParasi: document.getElementById('editTepsiParasi').value
        };

        saveDeliveredOrders();
        loadDeliveredOrders();
    } else {
        const orderIndex = orders.findIndex(o => o.id === orderId);
        if (orderIndex === -1) return;

        orders[orderIndex] = {
            ...orders[orderIndex],
            customerName: document.getElementById('editCustomerName').value,
            phoneNumber: document.getElementById('editPhoneNumber').value,
            kareBaklava: parseInt(document.getElementById('editKareBaklava').value) || 0,
            kareBaklavaKg: parseFloat(document.getElementById('editKareBaklavaKg').value) || 0,
            evBaklavasi: parseInt(document.getElementById('editEvBaklavasi').value) || 0,
            evBaklavasiKg: parseFloat(document.getElementById('editEvBaklavasiKg').value) || 0,
            sariBurma: parseInt(document.getElementById('editSariBurma').value) || 0,
            sariBurmaKg: parseFloat(document.getElementById('editSariBurmaKg').value) || 0,
            suBoregi: parseInt(document.getElementById('editSuBoregi').value) || 0,
            suBoregiKg: parseFloat(document.getElementById('editSuBoregiKg').value) || 0,
            deliveryDate: document.getElementById('editDeliveryDate').value,
            tepsiParasi: document.getElementById('editTepsiParasi').value
        };

        saveOrders();
        loadOrders();
    }

    updateStatistics();
    updateGeneralSummary();
    closeModal();

    showNotification('Sipariş başarıyla güncellendi!', 'success');
}

// Sipariş silme
function deleteOrder(orderId) {
    if (!confirm('Bu siparişi silmek istediğinizden emin misiniz?')) {
        return;
    }

    orders = orders.filter(o => o.id !== orderId);
    saveOrders();
    loadOrders();
    updateStatistics();
    updateGeneralSummary();

    showNotification('Sipariş silindi!', 'info');
}

// Teslim edilen siparişi düzenleme
function editDeliveredOrder(orderId) {
    const order = deliveredOrders.find(o => o.id === orderId);
    if (!order) return;

    document.getElementById('editOrderId').value = order.id;
    document.getElementById('editCustomerName').value = order.customerName;
    document.getElementById('editPhoneNumber').value = order.phoneNumber;
    document.getElementById('editKareBaklava').value = order.kareBaklava;
    document.getElementById('editKareBaklavaKg').value = order.kareBaklavaKg || 0;
    document.getElementById('editEvBaklavasi').value = order.evBaklavasi;
    document.getElementById('editEvBaklavasiKg').value = order.evBaklavasiKg || 0;
    document.getElementById('editSariBurma').value = order.sariBurma;
    document.getElementById('editSariBurmaKg').value = order.sariBurmaKg || 0;
    document.getElementById('editSuBoregi').value = order.suBoregi;
    document.getElementById('editSuBoregiKg').value = order.suBoregiKg || 0;
    document.getElementById('editDeliveryDate').value = order.deliveryDate;
    document.getElementById('editTepsiParasi').value = order.tepsiParasi;

    // Modal'ı teslim edilen sipariş için işaretle
    document.getElementById('editModal').setAttribute('data-type', 'delivered');
    document.getElementById('editModal').style.display = 'block';
}

// Teslim edilen siparişi silme
function deleteDeliveredOrder(orderId) {
    if (!confirm('Bu teslim edilen siparişi silmek istediğinizden emin misiniz?')) {
        return;
    }

    deliveredOrders = deliveredOrders.filter(o => o.id !== orderId);
    saveDeliveredOrders();
    loadDeliveredOrders();
    updateStatistics();
    updateGeneralSummary();

    showNotification('Teslim edilen sipariş silindi!', 'info');
}

// Sipariş teslim etme
function deliverOrder(orderId) {
    if (!confirm('Bu siparişi teslim edilenler listesine taşımak istediğinizden emin misiniz?')) {
        return;
    }

    const orderIndex = orders.findIndex(o => o.id === orderId);
    if (orderIndex === -1) return;

    const order = orders[orderIndex];
    order.deliveredAt = new Date().toISOString();
    order.trayReturned = false;         // ✅ BAŞLANGIÇTA FALSE
    order.trayReturnedDate = null;      // ✅ NULL

    deliveredOrders.push(order);
    orders.splice(orderIndex, 1);

    saveOrders();
    saveDeliveredOrders();
    loadOrders();
    loadDeliveredOrders();
    updateStatistics();

    showNotification('Sipariş teslim edildi!', 'success');
}


// İstatistikleri güncelleme
function updateStatistics() {
    // Önceki istatistikler...

    // ✅ TEPSİ İADE ISTATISTIĞI EKLE
    const pendingTrayReturns = deliveredOrders.filter(o => !o.trayReturned).length;
    const pendingTrayEl = document.getElementById('pendingTrayReturns');
    if (pendingTrayEl) {
        pendingTrayEl.textContent = pendingTrayReturns;
    }
}
// Genel toplam güncelleme (sadece aktif siparişler)
function updateGeneralSummary() {
    let kareBaklava = 0, kareBaklavaKg = 0;
    let evBaklavasi = 0, evBaklavasiKg = 0;
    let sariBurma = 0, sariBurmaKg = 0;
    let suBoregi = 0, suBoregiKg = 0;

    // Sadece aktif siparişler
    orders.forEach(order => {
        kareBaklava += order.kareBaklava;
        kareBaklavaKg += (order.kareBaklavaKg || 0);
        evBaklavasi += order.evBaklavasi;
        evBaklavasiKg += (order.evBaklavasiKg || 0);
        sariBurma += order.sariBurma;
        sariBurmaKg += (order.sariBurmaKg || 0);
        suBoregi += order.suBoregi;
        suBoregiKg += (order.suBoregiKg || 0);
    });

    document.getElementById('totalKareBaklava').textContent = kareBaklava;
    document.getElementById('totalKareBaklavaKg').textContent = kareBaklavaKg % 1 === 0 ? kareBaklavaKg : kareBaklavaKg.toFixed(2);
    document.getElementById('totalEvBaklavasi').textContent = evBaklavasi;
    document.getElementById('totalEvBaklavasiKg').textContent = evBaklavasiKg % 1 === 0 ? evBaklavasiKg : evBaklavasiKg.toFixed(2);
    document.getElementById('totalSariBurma').textContent = sariBurma;
    document.getElementById('totalSariBurmaKg').textContent = sariBurmaKg % 1 === 0 ? sariBurmaKg : sariBurmaKg.toFixed(2);
    document.getElementById('totalSuBoregi').textContent = suBoregi;
    document.getElementById('totalSuBoregiKg').textContent = suBoregiKg % 1 === 0 ? suBoregiKg : suBoregiKg.toFixed(2);
}

// Modal kapatma
function closeModal() {
    document.getElementById('editModal').style.display = 'none';
}

// Veri kaydetme
function saveOrders() {
    localStorage.setItem('orders', JSON.stringify(orders));
}

function saveDeliveredOrders() {
    localStorage.setItem('deliveredOrders', JSON.stringify(deliveredOrders));
}

// Excel'e aktar
function exportToExcel(type) {
    const data = type === 'active' ? orders : deliveredOrders;

    if (data.length === 0) {
        showNotification('Dışa aktarılacak veri bulunmamaktadır!', 'info');
        return;
    }

    let csv = '\uFEFF';

    if (type === 'active') {
        csv += 'Adı Soyadı,Telefon,Kare Baklava,Ev Baklavası,Sarı Burma,Su Böreği,Teslim Tarihi,Tepsi Parası\n';
    } else {
        // ✅ BAŞLIĞA TEPSI İADE EKLE
        csv += 'Adı Soyadı,Telefon,Kare Baklava,Ev Baklavası,Sarı Burma,Su Böreği,Teslim Tarihi,Tepsi Parası,Tepsi İade,Teslim Zamanı\n';
    }

    data.forEach(order => {
        const deliveryDate = new Date(order.deliveryDate).toLocaleDateString('tr-TR');
        const row = [
            order.customerName,
            order.phoneNumber,
            order.kareBaklava,
            order.evBaklavasi,
            order.sariBurma,
            order.suBoregi,
            deliveryDate,
            order.tepsiParasi
        ];

        if (type === 'delivered') {
            // ✅ TEPSI İADE DURUMUNU EKLE
            const trayStatus = order.trayReturned ? 'İade Alındı' : 'Bekleniyor';
            row.push(trayStatus);

            const deliveredAt = new Date(order.deliveredAt).toLocaleString('tr-TR');
            row.push(deliveredAt);
        }

        csv += row.join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    const fileName = type === 'active'
        ? `Siparis_Listesi_${new Date().toLocaleDateString('tr-TR').replace(/\./g, '-')}.csv`
        : `Teslim_Edilenler_${new Date().toLocaleDateString('tr-TR').replace(/\./g, '-')}.csv`;

    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showNotification('Kayıt dosyası indirildi!', 'success');
}

// Bildirim gösterme
function showNotification(message, type) {
    // Basit alert yerine özel bildirim
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 25px;
        background: ${type === 'success' ? '#4CAF50' : type === 'info' ? '#2196F3' : '#f44336'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        animation: slideInRight 0.3s;
        font-weight: 600;
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// CSS animasyonları
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

function escHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/`/g, '&#96;');
}
