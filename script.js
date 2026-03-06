// ==================== RTY MOTOPARTS - MAIN APPLICATION ====================

// Global variables
let inventory = [];
let currentStockItem = null;
let pendingDeleteId = null;
let stockAdjustmentHistory = [];

// Initialize on load
document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    initializeInventory();
    displayUserInfo();
    setupEventListeners();
    updateDateTime();
    setInterval(updateDateTime, 1000);
});

// Check authentication
function checkAuth() {
    const user = JSON.parse(localStorage.getItem('rtyCurrentUser'));
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    
    // Update UI with user info
    document.getElementById('welcomeName').textContent = user.name;
    document.getElementById('displayName').textContent = user.name;
    document.getElementById('userRole').textContent = user.role.toUpperCase();
    
    // Set avatar
    document.getElementById('userAvatar').textContent = user.name.charAt(0);
}

// Initialize empty inventory
function initializeInventory() {
    const saved = localStorage.getItem('rtyInventory');
    if (saved) {
        inventory = JSON.parse(saved);
        // Load stock history
        const history = localStorage.getItem('rtyStockHistory');
        if (history) {
            stockAdjustmentHistory = JSON.parse(history);
        }
    } else {
        inventory = []; // Start completely empty
        stockAdjustmentHistory = [];
        saveToStorage();
    }
    updateUI();
}

// Save to localStorage
function saveToStorage() {
    localStorage.setItem('rtyInventory', JSON.stringify(inventory));
    localStorage.setItem('rtyStockHistory', JSON.stringify(stockAdjustmentHistory));
    updateUI();
}

// Update date and time
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

// Display user info
function displayUserInfo() {
    const user = JSON.parse(localStorage.getItem('rtyCurrentUser'));
    if (user) {
        document.getElementById('displayName').textContent = user.name;
        document.getElementById('userRole').textContent = user.role.toUpperCase();
    }
}

// ==================== UI UPDATE FUNCTIONS ====================

function updateUI() {
    const hasItems = inventory.length > 0;
    
    document.getElementById('emptyState').style.display = hasItems ? 'none' : 'flex';
    document.getElementById('dashboardContent').style.display = hasItems ? 'block' : 'none';
    
    if (hasItems) {
        updateStats();
        filterInventory();
        checkLowStock();
        updateFooterStats();
    }
}

function updateStats() {
    const totalParts = inventory.length;
    const lowStock = inventory.filter(item => item.quantity <= (item.minStock || 5)).length;
    const totalValue = inventory.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    const categories = new Set(inventory.map(item => item.category)).size;
    
    animateNumber('totalParts', totalParts);
    animateNumber('lowStockCount', lowStock);
    document.getElementById('totalValue').textContent = '₱' + formatNumber(totalValue);
    document.getElementById('categoryCount').textContent = categories;
}

function animateNumber(elementId, newValue) {
    const element = document.getElementById(elementId);
    const oldValue = parseInt(element.textContent) || 0;
    
    if (oldValue !== newValue) {
        element.style.transform = 'scale(1.2)';
        setTimeout(() => {
            element.textContent = newValue;
            element.style.transform = 'scale(1)';
        }, 150);
    }
}

function updateFooterStats() {
    const totalItems = inventory.length;
    const totalStock = inventory.reduce((sum, item) => sum + item.quantity, 0);
    document.getElementById('footerStats').textContent = 
        `${totalItems} parts • ${totalStock} total units in stock`;
}

function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// ==================== INVENTORY FILTERING ====================

function filterInventory() {
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const category = document.getElementById('categoryFilter')?.value || '';
    
    // Show/hide clear button
    document.getElementById('clearSearch').style.display = searchTerm ? 'block' : 'none';
    
    let filtered = inventory;
    
    if (searchTerm) {
        filtered = filtered.filter(item => 
            item.name.toLowerCase().includes(searchTerm) ||
            item.sku.toLowerCase().includes(searchTerm) ||
            (item.compatibleModels && item.compatibleModels.toLowerCase().includes(searchTerm)) ||
            (item.oemNumber && item.oemNumber.toLowerCase().includes(searchTerm))
        );
    }
    
    if (category) {
        filtered = filtered.filter(item => item.category === category);
    }
    
    filtered.sort((a, b) => a.name.localeCompare(b.name));
    
    renderTableView(filtered);
    renderCardView(filtered);
}

function clearSearch() {
    document.getElementById('searchInput').value = '';
    filterInventory();
}

// ==================== TABLE RENDERING ====================

function renderTableView(items) {
    const tbody = document.getElementById('inventoryBody');
    
    if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="no-results">No matching parts found</td></tr>`;
        return;
    }
    
    tbody.innerHTML = items.map(item => {
        const totalValue = item.quantity * item.price;
        const status = getStockStatus(item);
        
        return `
            <tr class="item-row ${status.class}" data-id="${item.id}">
                <td><span class="sku-badge">${escapeHtml(item.sku)}</span></td>
                <td>
                    <strong>${escapeHtml(item.name)}</strong>
                    ${item.oemNumber ? `<br><small class="oem">OEM: ${escapeHtml(item.oemNumber)}</small>` : ''}
                </td>
                <td><span class="category-tag">${item.category}</span></td>
                <td>${escapeHtml(item.compatibleModels || '-')}</td>
                <td class="stock-cell ${status.class}">
                    <span class="stock-number">${item.quantity}</span>
                    ${item.location ? `<br><small class="location">📍 ${escapeHtml(item.location)}</small>` : ''}
                </td>
                <td>₱${formatNumber(item.price)}</td>
                <td>₱${formatNumber(totalValue)}</td>
                <td><span class="status-badge ${status.class}">${status.text}</span></td>
                <td class="action-cell">
                    <button onclick="editItem(${item.id})" class="icon-btn edit" title="Edit">✏️</button>
                    <button onclick="openStockModal(${item.id})" class="icon-btn stock" title="Adjust Stock">📦</button>
                    <button onclick="confirmDelete(${item.id}, '${escapeHtml(item.name)}')" class="icon-btn delete" title="Delete">🗑️</button>
                </td>
            </tr>
        `;
    }).join('');
}

function renderCardView(items) {
    const container = document.getElementById('inventoryCards');
    
    if (items.length === 0) {
        container.innerHTML = `<div class="no-results-card">No matching parts found</div>`;
        return;
    }
    
    container.innerHTML = items.map(item => {
        const totalValue = item.quantity * item.price;
        const status = getStockStatus(item);
        
        return `
            <div class="inventory-card ${status.class}" data-id="${item.id}">
                <div class="card-header">
                    <div>
                        <span class="card-sku">${item.sku}</span>
                        <h3 class="card-title">${escapeHtml(item.name)}</h3>
                        ${item.oemNumber ? `<span class="card-oem">OEM: ${escapeHtml(item.oemNumber)}</span>` : ''}
                    </div>
                    <span class="category-tag">${item.category}</span>
                </div>
                
                <div class="card-details">
                    <div class="detail-row">
                        <span class="detail-label">Models:</span>
                        <span class="detail-value">${escapeHtml(item.compatibleModels || 'Universal')}</span>
                    </div>
                    
                    <div class="detail-row">
                        <span class="detail-label">Stock:</span>
                        <span class="detail-value stock-value ${status.class}">
                            <strong>${item.quantity}</strong> units
                            ${item.location ? `<br><small>📍 ${escapeHtml(item.location)}</small>` : ''}
                        </span>
                    </div>
                    
                    <div class="detail-row">
                        <span class="detail-label">Price:</span>
                        <span class="detail-value">₱${formatNumber(item.price)}</span>
                    </div>
                    
                    <div class="detail-row">
                        <span class="detail-label">Total:</span>
                        <span class="detail-value">₱${formatNumber(totalValue)}</span>
                    </div>
                    
                    ${item.supplier ? `
                        <div class="detail-row">
                            <span class="detail-label">Supplier:</span>
                            <span class="detail-value">${escapeHtml(item.supplier)}</span>
                        </div>
                    ` : ''}
                    
                    <div class="detail-row">
                        <span class="detail-label">Status:</span>
                        <span class="status-badge ${status.class}">${status.text}</span>
                    </div>
                </div>
                
                <div class="card-actions">
                    <button onclick="editItem(${item.id})" class="card-btn edit">✏️ Edit</button>
                    <button onclick="openStockModal(${item.id})" class="card-btn stock">📦 Stock</button>
                    <button onclick="confirmDelete(${item.id}, '${escapeHtml(item.name)}')" class="card-btn delete">🗑️ Delete</button>
                </div>
            </div>
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
    document.getElementById('modalTitle').textContent = 'Add New Part - RTY MOTOPARTS';
    document.getElementById('itemForm').reset();
    document.getElementById('itemId').value = '';
    document.getElementById('itemModal').style.display = 'flex';
}

function editItem(id) {
    const item = inventory.find(i => i.id === id);
    if (!item) return;
    
    document.getElementById('modalTitle').textContent = 'Edit Part - RTY MOTOPARTS';
    document.getElementById('itemId').value = item.id;
    document.getElementById('partName').value = item.name;
    document.getElementById('sku').value = item.sku;
    document.getElementById('category').value = item.category;
    document.getElementById('compatibleModels').value = item.compatibleModels || '';
    document.getElementById('quantity').value = item.quantity;
    document.getElementById('price').value = item.price;
    document.getElementById('supplier').value = item.supplier || '';
    document.getElementById('minStock').value = item.minStock || 5;
    document.getElementById('location').value = item.location || '';
    document.getElementById('oemNumber').value = item.oemNumber || '';
    document.getElementById('description').value = item.description || '';
    
    document.getElementById('itemModal').style.display = 'flex';
}

function saveItem(event) {
    event.preventDefault();
    
    const itemId = document.getElementById('itemId').value;
    const sku = document.getElementById('sku').value.trim().toUpperCase();
    
    // Check for duplicate SKU when adding new item
    if (!itemId) {
        const existingSku = inventory.find(i => i.sku === sku);
        if (existingSku) {
            showToast('SKU already exists! Please use a different SKU.', 'error');
            return;
        }
    }
    
    const itemData = {
        name: document.getElementById('partName').value.trim(),
        sku: sku,
        category: document.getElementById('category').value,
        compatibleModels: document.getElementById('compatibleModels').value.trim(),
        quantity: parseInt(document.getElementById('quantity').value) || 0,
        price: parseFloat(document.getElementById('price').value) || 0,
        supplier: document.getElementById('supplier').value.trim(),
        minStock: parseInt(document.getElementById('minStock').value) || 5,
        location: document.getElementById('location').value.trim(),
        oemNumber: document.getElementById('oemNumber').value.trim(),
        description: document.getElementById('description').value.trim(),
        lastUpdated: new Date().toISOString(),
        updatedBy: JSON.parse(localStorage.getItem('rtyCurrentUser')).name
    };
    
    if (itemId) {
        // Update existing
        const index = inventory.findIndex(i => i.id == itemId);
        const oldItem = inventory[index];
        inventory[index] = { ...inventory[index], ...itemData };
        showToast(`Part updated successfully by ${itemData.updatedBy}`, 'success');
    } else {
        // Add new
        const newId = inventory.length > 0 ? Math.max(...inventory.map(i => i.id)) + 1 : 1;
        inventory.push({ 
            id: newId, 
            ...itemData,
            createdDate: new Date().toISOString(),
            createdBy: JSON.parse(localStorage.getItem('rtyCurrentUser')).name
        });
        showToast('New part added to RTY inventory', 'success');
    }
    
    saveToStorage();
    closeModal();
}

function confirmDelete(id, name) {
    pendingDeleteId = id;
    document.getElementById('confirmMessage').textContent = `Delete "${name}"?`;
    document.getElementById('confirmDetails').textContent = 'This action cannot be undone.';
    document.getElementById('confirmModal').style.display = 'flex';
}

function executeDelete() {
    if (pendingDeleteId) {
        inventory = inventory.filter(i => i.id !== pendingDeleteId);
        saveToStorage();
        showToast('Part deleted successfully', 'success');
        closeConfirmModal();
        pendingDeleteId = null;
    }
}

// ==================== STOCK MANAGEMENT ====================

function openStockModal(id) {
    const item = inventory.find(i => i.id === id);
    if (!item) return;
    
    currentStockItem = item;
    
    // Get recent stock history for this item
    const itemHistory = stockAdjustmentHistory
        .filter(h => h.sku === item.sku)
        .slice(-5)
        .reverse();
    
    const historyHtml = itemHistory.length > 0 
        ? itemHistory.map(h => `
            <div class="history-item">
                <span class="history-change ${h.change > 0 ? 'positive' : 'negative'}">
                    ${h.change > 0 ? '+' : ''}${h.change}
                </span>
                <span class="history-details">${h.date} by ${h.user}</span>
            </div>
        `).join('')
        : '<p class="no-history">No recent adjustments</p>';
    
    document.getElementById('stockItemInfo').innerHTML = `
        <strong>${escapeHtml(item.name)}</strong><br>
        <small>SKU: ${item.sku} | Min Stock: ${item.minStock || 5}</small>
    `;
    document.getElementById('currentStockDisplay').textContent = item.quantity;
    document.getElementById('stockHistoryList').innerHTML = historyHtml;
    document.getElementById('stockHistory').style.display = itemHistory.length > 0 ? 'block' : 'none';
    
    document.getElementById('stockModal').style.display = 'flex';
}

function quickAdjust(action, amount) {
    if (!currentStockItem) return;
    
    let newQuantity;
    if (action === 'add') {
        newQuantity = currentStockItem.quantity + amount;
    } else {
        newQuantity = currentStockItem.quantity - amount;
    }
    
    if (newQuantity < 0) {
        showToast('Cannot have negative stock!', 'error');
        return;
    }
    
    recordStockAdjustment(currentStockItem, action === 'add' ? amount : -amount);
    updateStockQuantity(newQuantity);
}

function applyCustomAdjustment() {
    const input = document.getElementById('customAdjustment');
    const value = parseInt(input.value);
    
    if (isNaN(value) || value === 0) {
        showToast('Please enter a valid number', 'error');
        return;
    }
    
    const newQuantity = currentStockItem.quantity + value;
    if (newQuantity < 0) {
        showToast('Cannot have negative stock!', 'error');
        return;
    }
    
    recordStockAdjustment(currentStockItem, value);
    updateStockQuantity(newQuantity);
    input.value = '';
}

function recordStockAdjustment(item, change) {
    const user = JSON.parse(localStorage.getItem('rtyCurrentUser'));
    stockAdjustmentHistory.push({
        sku: item.sku,
        name: item.name,
        change: change,
        before: item.quantity,
        after: item.quantity + change,
        date: new Date().toLocaleString(),
        user: user.name
    });
    
    // Keep only last 100 records
    if (stockAdjustmentHistory.length > 100) {
        stockAdjustmentHistory = stockAdjustmentHistory.slice(-100);
    }
}

function updateStockQuantity(newQuantity) {
    const index = inventory.findIndex(i => i.id === currentStockItem.id);
    inventory[index].quantity = newQuantity;
    inventory[index].lastUpdated = new Date().toISOString();
    inventory[index].updatedBy = JSON.parse(localStorage.getItem('rtyCurrentUser')).name;
    
    saveToStorage();
    document.getElementById('currentStockDisplay').textContent = newQuantity;
    
    const change = newQuantity - currentStockItem.quantity;
    const action = change > 0 ? 'added to' : 'removed from';
    showToast(`${Math.abs(change)} units ${action} ${currentStockItem.name}`, 'success');
    
    currentStockItem = inventory[index];
}

// ==================== LOW STOCK ALERTS ====================

function checkLowStock() {
    const lowStockItems = inventory.filter(item => 
        item.quantity > 0 && item.quantity <= (item.minStock || 5)
    );
    
    const outOfStock = inventory.filter(item => item.quantity <= 0);
    
    if (lowStockItems.length > 0 || outOfStock.length > 0) {
        const banner = document.getElementById('lowStockBanner');
        const message = [];
        
        if (outOfStock.length > 0) {
            message.push(`${outOfStock.length} out of stock`);
        }
        if (lowStockItems.length > 0) {
            message.push(`${lowStockItems.length} low stock`);
        }
        
        document.getElementById('lowStockMessage').textContent = message.join(' • ');
        banner.style.display = 'flex';
    } else {
        document.getElementById('lowStockBanner').style.display = 'none';
    }
}

function scrollToLowStock() {
    const lowStockItems = inventory.filter(item => 
        item.quantity <= (item.minStock || 5)
    );
    
    if (lowStockItems.length > 0) {
        const firstItem = document.querySelector(`[data-id="${lowStockItems[0].id}"]`);
        if (firstItem) {
            firstItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
            firstItem.style.backgroundColor = '#fef3c7';
            setTimeout(() => {
                firstItem.style.backgroundColor = '';
            }, 2000);
        }
    }
}

// ==================== EXPORT & PRINT ====================

function exportInventory() {
    if (inventory.length === 0) {
        showToast('No data to export', 'error');
        return;
    }
    
    const headers = ['SKU', 'Part Name', 'Category', 'Models', 'Quantity', 'Price', 'Total Value', 'Supplier', 'Location', 'Min Stock', 'OEM Number', 'Last Updated'];
    
    const rows = inventory.map(item => [
        item.sku,
        item.name,
        item.category,
        item.compatibleModels || '',
        item.quantity,
        item.price,
        item.quantity * item.price,
        item.supplier || '',
        item.location || '',
        item.minStock || 5,
        item.oemNumber || '',
        new Date(item.lastUpdated).toLocaleDateString()
    ]);
    
    const csv = [headers, ...rows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');
    
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `RTY-INVENTORY-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    showToast('Inventory exported successfully', 'success');
}

function printInventory() {
    if (inventory.length === 0) {
        showToast('No data to print', 'error');
        return;
    }
    
    const printWindow = window.open('', '_blank');
    const currentDate = new Date().toLocaleString();
    const user = JSON.parse(localStorage.getItem('rtyCurrentUser'));
    
    printWindow.document.write(`
        <html>
            <head>
                <title>RTY MOTOPARTS - Inventory Report</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    h1 { color: #2563eb; }
                    .header { display: flex; justify-content: space-between; margin-bottom: 20px; }
                    table { width: 100%; border-collapse: collapse; }
                    th { background: #2563eb; color: white; padding: 10px; text-align: left; }
                    td { padding: 8px; border-bottom: 1px solid #ddd; }
                    .low { color: #f59e0b; }
                    .out { color: #ef4444; }
                    .footer { margin-top: 20px; font-size: 12px; color: #666; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>RTY MOTOPARTS</h1>
                    <div>
                        <p>Date: ${currentDate}</p>
                        <p>Generated by: ${user.name}</p>
                    </div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>SKU</th>
                            <th>Part Name</th>
                            <th>Category</th>
                            <th>Stock</th>
                            <th>Price</th>
                            <th>Total</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${inventory.map(item => {
                            const status = item.quantity <= 0 ? 'OUT' : (item.quantity <= (item.minStock || 5) ? 'LOW' : 'OK');
                            const statusClass = item.quantity <= 0 ? 'out' : (item.quantity <= (item.minStock || 5) ? 'low' : '');
                            return `
                                <tr>
                                    <td>${item.sku}</td>
                                    <td>${item.name}</td>
                                    <td>${item.category}</td>
                                    <td class="${statusClass}">${item.quantity}</td>
                                    <td>₱${item.price.toLocaleString()}</td>
                                    <td>₱${(item.quantity * item.price).toLocaleString()}</td>
                                    <td class="${statusClass}">${status}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
                <div class="footer">
                    <p>Total Parts: ${inventory.length}</p>
                    <p>Total Value: ₱${inventory.reduce((sum, item) => sum + (item.quantity * item.price), 0).toLocaleString()}</p>
                    <p>Low Stock Items: ${inventory.filter(item => item.quantity <= (item.minStock || 5)).length}</p>
                </div>
            </body>
        </html>
    `);
    
    printWindow.document.close();
    printWindow.print();
}

// ==================== UTILITY FUNCTIONS ====================

function escapeHtml(text) {
    if (!text) return text;
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'info') {
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

// ==================== EVENT LISTENERS ====================

function setupEventListeners() {
    // Close modals when clicking outside
    window.onclick = function(event) {
        const modals = ['itemModal', 'stockModal', 'confirmModal'];
        modals.forEach(modalId => {
            const modal = document.getElementById(modalId);
            if (event.target === modal) {
                modal.style.display = 'none';
                if (modalId === 'stockModal') currentStockItem = null;
                if (modalId === 'confirmModal') pendingDeleteId = null;
            }
        });
    };
    
    // Handle ESC key
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            closeModal();
            closeStockModal();
            closeConfirmModal();
        }
    });
    
    // Real-time search
    document.getElementById('searchInput')?.addEventListener('input', filterInventory);
}

// Add custom CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
        20%, 40%, 60%, 80% { transform: translateX(5px); }
    }
    
    @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.05); }
        100% { transform: scale(1); }
    }
    
    .history-item {
        display: flex;
        justify-content: space-between;
        padding: 5px;
        border-bottom: 1px solid #eee;
        font-size: 12px;
    }
    
    .history-change.positive {
        color: #10b981;
    }
    
    .history-change.negative {
        color: #ef4444;
    }
`;
document.head.appendChild(style);