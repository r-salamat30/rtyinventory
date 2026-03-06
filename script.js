// RTY MOTOPARTS - Enterprise Inventory System
let inventory = [];
let currentStockItem = null;
let pendingDeleteId = null;

// ==================== INITIALIZATION ====================

document.addEventListener('DOMContentLoaded', function() {
    if (!checkAuth()) return;
    loadInventory();
    setupEventListeners();
    updateDateTime();
    setInterval(updateDateTime, 60000);
});

function checkAuth() {
    const user = JSON.parse(localStorage.getItem('rtyCurrentUser'));
    if (!user && window.location.pathname.includes('dashboard.html')) {
        window.location.href = 'index.html';
        return false;
    }
    
    if (user) {
        document.getElementById('displayName').textContent = user.name;
        document.getElementById('userAvatar').textContent = user.name.charAt(0);
    }
    return true;
}

function loadInventory() {
    const saved = localStorage.getItem('rtyInventory');
    inventory = saved ? JSON.parse(saved) : [];
    updateUI();
}

function saveInventory() {
    localStorage.setItem('rtyInventory', JSON.stringify(inventory));
    updateUI();
}

function updateDateTime() {
    const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    document.getElementById('inventoryDate').textContent = new Date().toLocaleDateString('en-US', options);
}

// ==================== UI UPDATES ====================

function updateUI() {
    const hasItems = inventory.length > 0;
    
    document.getElementById('emptyState').style.display = hasItems ? 'none' : 'flex';
    document.getElementById('dashboardContent').style.display = hasItems ? 'block' : 'none';
    
    if (hasItems) {
        updateKPIs();
        filterInventory();
        checkLowStock();
    }
}

function updateKPIs() {
    const totalParts = inventory.length;
    const lowStock = inventory.filter(item => item.quantity <= (item.minStock || 5)).length;
    const totalValue = inventory.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    const categories = new Set(inventory.map(item => item.category)).size;
    
    document.getElementById('totalParts').textContent = totalParts;
    document.getElementById('lowStockCount').textContent = lowStock;
    document.getElementById('totalValue').textContent = '₱' + formatNumber(totalValue);
    document.getElementById('categoryCount').textContent = categories;
}

function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// ==================== FILTERING ====================

function filterInventory() {
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const category = document.getElementById('categoryFilter')?.value || '';
    
    document.getElementById('clearSearch').style.display = searchTerm ? 'block' : 'none';
    
    let filtered = inventory;
    
    if (searchTerm) {
        filtered = filtered.filter(item => 
            item.name.toLowerCase().includes(searchTerm) ||
            (item.compatibleModels && item.compatibleModels.toLowerCase().includes(searchTerm))
        );
    }
    
    if (category) {
        filtered = filtered.filter(item => item.category === category);
    }
    
    renderTable(filtered);
}

function clearSearch() {
    document.getElementById('searchInput').value = '';
    filterInventory();
}

// ==================== TABLE RENDERING ====================

function renderTable(items) {
    const tbody = document.getElementById('inventoryBody');
    
    if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="no-results">No matching parts found</td></tr>`;
        return;
    }
    
    tbody.innerHTML = items.map(item => {
        const totalValue = item.quantity * item.price;
        const status = getStockStatus(item);
        
        return `
            <tr>
                <td>
                    <div class="part-info">
                        <span class="part-name">${escapeHtml(item.name)}</span>
                        ${item.oemNumber ? `<span class="part-oem">OEM: ${escapeHtml(item.oemNumber)}</span>` : ''}
                    </div>
                </td>
                <td><span class="category">${item.category}</span></td>
                <td>${escapeHtml(item.compatibleModels) || '—'}</td>
                <td class="${status.class}">${item.quantity}</td>
                <td>₱${formatNumber(item.price)}</td>
                <td>₱${formatNumber(totalValue)}</td>
                <td><span class="status ${status.class}">${status.text}</span></td>
                <td>
                    <div class="row-actions">
                        <button onclick="editItem(${item.id})" class="row-action" title="Edit">✎</button>
                        <button onclick="openStockModal(${item.id})" class="row-action" title="Adjust Stock">📦</button>
                        <button onclick="confirmDelete(${item.id}, '${escapeHtml(item.name)}')" class="row-action delete" title="Delete">🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function getStockStatus(item) {
    const minStock = item.minStock || 5;
    if (item.quantity <= 0) return { text: 'Out of Stock', class: 'out' };
    if (item.quantity <= minStock) return { text: 'Low Stock', class: 'low' };
    return { text: 'In Stock', class: 'good' };
}

// ==================== CRUD OPERATIONS ====================

function showAddModal() {
    document.getElementById('modalTitle').textContent = 'Add New Part';
    document.getElementById('itemForm').reset();
    document.getElementById('itemId').value = '';
    document.getElementById('itemModal').style.display = 'flex';
}

function editItem(id) {
    const item = inventory.find(i => i.id === id);
    if (!item) return;
    
    document.getElementById('modalTitle').textContent = 'Edit Part';
    document.getElementById('itemId').value = item.id;
    document.getElementById('partName').value = item.name;
    document.getElementById('category').value = item.category;
    document.getElementById('compatibleModels').value = item.compatibleModels || '';
    document.getElementById('quantity').value = item.quantity;
    document.getElementById('price').value = item.price;
    document.getElementById('minStock').value = item.minStock || 5;
    document.getElementById('location').value = item.location || '';
    document.getElementById('supplier').value = item.supplier || '';
    document.getElementById('oemNumber').value = item.oemNumber || '';
    
    document.getElementById('itemModal').style.display = 'flex';
}

function saveItem(event) {
    event.preventDefault();
    
    const itemId = document.getElementById('itemId').value;
    
    const itemData = {
        name: document.getElementById('partName').value.trim(),
        category: document.getElementById('category').value,
        compatibleModels: document.getElementById('compatibleModels').value.trim(),
        quantity: parseInt(document.getElementById('quantity').value) || 0,
        price: parseFloat(document.getElementById('price').value) || 0,
        minStock: parseInt(document.getElementById('minStock').value) || 5,
        location: document.getElementById('location').value.trim(),
        supplier: document.getElementById('supplier').value.trim(),
        oemNumber: document.getElementById('oemNumber').value.trim(),
        lastUpdated: new Date().toISOString()
    };
    
    if (itemId) {
        const index = inventory.findIndex(i => i.id == itemId);
        inventory[index] = { ...inventory[index], ...itemData };
        showToast('Part updated successfully');
    } else {
        const newId = inventory.length > 0 ? Math.max(...inventory.map(i => i.id)) + 1 : 1;
        inventory.push({ id: newId, ...itemData });
        showToast('Part added successfully');
    }
    
    saveInventory();
    closeModal();
}

function confirmDelete(id, name) {
    pendingDeleteId = id;
    document.getElementById('confirmMessage').textContent = `Delete "${name}"? This action cannot be undone.`;
    document.getElementById('confirmModal').style.display = 'flex';
}

function executeDelete() {
    if (pendingDeleteId) {
        inventory = inventory.filter(i => i.id !== pendingDeleteId);
        saveInventory();
        showToast('Part deleted successfully');
        closeConfirmModal();
        pendingDeleteId = null;
    }
}

// ==================== STOCK MANAGEMENT ====================

function openStockModal(id) {
    const item = inventory.find(i => i.id === id);
    if (!item) return;
    
    currentStockItem = item;
    document.getElementById('stockItemInfo').innerHTML = `
        <strong>${escapeHtml(item.name)}</strong>
        ${item.location ? `<span>Location: ${escapeHtml(item.location)}</span>` : ''}
    `;
    document.getElementById('currentStockDisplay').textContent = item.quantity;
    document.getElementById('stockModal').style.display = 'flex';
}

function quickAdjust(action, amount) {
    if (!currentStockItem) return;
    
    const newQuantity = action === 'add' 
        ? currentStockItem.quantity + amount 
        : currentStockItem.quantity - amount;
    
    if (newQuantity < 0) {
        showToast('Insufficient stock', 'error');
        return;
    }
    
    updateStockQuantity(newQuantity);
}

function applyCustomAdjustment() {
    const input = document.getElementById('customAdjustment');
    const value = parseInt(input.value);
    
    if (isNaN(value) || value === 0) {
        showToast('Enter a valid number', 'error');
        return;
    }
    
    const newQuantity = currentStockItem.quantity + value;
    if (newQuantity < 0) {
        showToast('Insufficient stock', 'error');
        return;
    }
    
    updateStockQuantity(newQuantity);
    input.value = '';
}

function updateStockQuantity(newQuantity) {
    const index = inventory.findIndex(i => i.id === currentStockItem.id);
    inventory[index].quantity = newQuantity;
    inventory[index].lastUpdated = new Date().toISOString();
    
    saveInventory();
    document.getElementById('currentStockDisplay').textContent = newQuantity;
    showToast(`Stock updated to ${newQuantity}`);
    
    currentStockItem = inventory[index];
}

// ==================== ALERTS ====================

function checkLowStock() {
    const lowStock = inventory.filter(item => 
        item.quantity > 0 && item.quantity <= (item.minStock || 5)
    );
    
    const outOfStock = inventory.filter(item => item.quantity <= 0);
    
    if (lowStock.length > 0 || outOfStock.length > 0) {
        const banner = document.getElementById('lowStockBanner');
        const messages = [];
        
        if (outOfStock.length > 0) messages.push(`${outOfStock.length} out of stock`);
        if (lowStock.length > 0) messages.push(`${lowStock.length} low stock`);
        
        document.getElementById('lowStockMessage').textContent = messages.join(' • ');
        banner.style.display = 'flex';
    } else {
        document.getElementById('lowStockBanner').style.display = 'none';
    }
}

function scrollToLowStock() {
    const firstLow = document.querySelector('.status.low, .status.out');
    if (firstLow) {
        firstLow.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

// ==================== EXPORT ====================

function exportInventory() {
    if (inventory.length === 0) {
        showToast('No data to export', 'error');
        return;
    }
    
    const headers = ['Part Name', 'Category', 'Models', 'Quantity', 'Price', 'Total', 'Supplier', 'Location', 'OEM'];
    const rows = inventory.map(item => [
        item.name,
        item.category,
        item.compatibleModels || '',
        item.quantity,
        item.price,
        item.quantity * item.price,
        item.supplier || '',
        item.location || '',
        item.oemNumber || ''
    ]);
    
    const csv = [headers, ...rows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');
    
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `RTY-inventory-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    showToast('Inventory exported');
}

// ==================== UTILITIES ====================

function escapeHtml(text) {
    if (!text) return text;
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.style.display = 'block';
    
    setTimeout(() => {
        toast.style.display = 'none';
    }, 3000);
}

function closeModal() {
    document.getElementById('itemModal').style.display = 'none';
}

function closeStockModal() {
    document.getElementById('stockModal').style.display = 'none';
    currentStockItem = null;
}

function closeConfirmModal() {
    document.getElementById('confirmModal').style.display = 'none';
    pendingDeleteId = null;
}

function logout() {
    localStorage.removeItem('rtyCurrentUser');
    window.location.href = 'index.html';
}

function setupEventListeners() {
    window.onclick = function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
            if (event.target.id === 'stockModal') currentStockItem = null;
            if (event.target.id === 'confirmModal') pendingDeleteId = null;
        }
    };
    
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            closeModal();
            closeStockModal();
            closeConfirmModal();
        }
    });
}
