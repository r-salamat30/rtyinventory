// RTY MOTOPARPS - Mobile Inventory System
// Optimized for touch interaction and mobile devices

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

function updateDateTime() {
    const options = { 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit'
    };
    document.getElementById('inventoryDate').textContent = new Date().toLocaleDateString('en-US', options);
}

// ==================== SERVER STORAGE ====================

async function loadInventory() {
    showToast('Loading...', 'info');
    
    const formData = new FormData();
    formData.append('action', 'load');
    
    try {
        const response = await fetch('storage.php', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (Array.isArray(data)) {
            inventory = data;
        } else {
            inventory = [];
        }
    } catch (error) {
        console.error('Error loading:', error);
        // Fallback to localStorage if server fails
        const saved = localStorage.getItem('rtyInventory');
        inventory = saved ? JSON.parse(saved) : [];
        showToast('Using offline mode', 'warning');
    }
    
    updateUI();
}

async function saveInventory() {
    const formData = new FormData();
    formData.append('action', 'save');
    formData.append('data', JSON.stringify(inventory));
    
    try {
        const response = await fetch('storage.php', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Also save locally as backup
            localStorage.setItem('rtyInventory', JSON.stringify(inventory));
            document.getElementById('syncStatus').innerHTML = '📡 Synced';
            setTimeout(() => {
                document.getElementById('syncStatus').innerHTML = '📡 Live';
            }, 2000);
        } else {
            showToast('Save failed', 'error');
        }
    } catch (error) {
        console.error('Error saving:', error);
        // Save locally if server fails
        localStorage.setItem('rtyInventory', JSON.stringify(inventory));
        showToast('Saved offline', 'warning');
    }
    
    updateUI();
}

// ==================== UI UPDATES ====================

function updateUI() {
    const hasItems = inventory.length > 0;
    
    document.getElementById('emptyState').style.display = hasItems ? 'none' : 'flex';
    document.getElementById('dashboardContent').style.display = hasItems ? 'block' : 'none';
    
    if (hasItems) {
        updateStats();
        filterInventory();
        checkLowStock();
    }
}

function updateStats() {
    const totalParts = inventory.length;
    const lowStock = inventory.filter(item => item.quantity <= (item.minStock || 5)).length;
    const totalValue = inventory.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    
    document.getElementById('totalParts').textContent = totalParts;
    document.getElementById('lowStockCount').textContent = lowStock;
    document.getElementById('totalValue').textContent = '₱' + formatNumber(totalValue);
}

function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// ==================== FILTERING ====================

function filterInventory() {
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const category = document.getElementById('categoryFilter')?.value || '';
    
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
    
    renderCards(filtered);
}

// ==================== MOBILE CARD RENDERING ====================

function renderCards(items) {
    const container = document.getElementById('inventoryCards');
    
    if (items.length === 0) {
        container.innerHTML = '<div class="no-results">No matching parts</div>';
        return;
    }
    
    container.innerHTML = items.map(item => {
        const totalValue = item.quantity * item.price;
        const status = getStockStatus(item);
        
        return `
            <div class="part-card" onclick="openCardMenu(${item.id})">
                <div class="card-header">
                    <div>
                        <h3 class="part-name">${escapeHtml(item.name)}</h3>
                        <span class="part-category">${item.category}</span>
                    </div>
                    <span class="part-status status-${status.class}">${status.text}</span>
                </div>
                
                <div class="card-details">
                    <div class="detail-row">
                        <span>Stock:</span>
                        <strong class="stock-${status.class}">${item.quantity} units</strong>
                    </div>
                    <div class="detail-row">
                        <span>Price:</span>
                        <strong>₱${formatNumber(item.price)}</strong>
                    </div>
                    <div class="detail-row">
                        <span>Total:</span>
                        <strong>₱${formatNumber(totalValue)}</strong>
                    </div>
                    ${item.compatibleModels ? `
                        <div class="detail-row">
                            <span>Models:</span>
                            <span>${escapeHtml(item.compatibleModels)}</span>
                        </div>
                    ` : ''}
                    ${item.location ? `
                        <div class="detail-row">
                            <span>Location:</span>
                            <span>${escapeHtml(item.location)}</span>
                        </div>
                    ` : ''}
                </div>
                
                <div class="card-actions" id="actions-${item.id}" style="display: none;">
                    <button onclick="editItem(${item.id}); event.stopPropagation()" class="card-action edit">✎ Edit</button>
                    <button onclick="openStockModal(${item.id}); event.stopPropagation()" class="card-action stock">📦 Stock</button>
                    <button onclick="confirmDelete(${item.id}, '${escapeHtml(item.name)}'); event.stopPropagation()" class="card-action delete">🗑️ Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

function openCardMenu(id) {
    const actions = document.getElementById(`actions-${id}`);
    if (actions) {
        if (actions.style.display === 'none') {
            actions.style.display = 'flex';
            // Auto-hide after 5 seconds
            setTimeout(() => {
                actions.style.display = 'none';
            }, 5000);
        } else {
            actions.style.display = 'none';
        }
    }
}

function getStockStatus(item) {
    const minStock = item.minStock || 5;
    if (item.quantity <= 0) return { text: 'Out', class: 'out' };
    if (item.quantity <= minStock) return { text: 'Low', class: 'low' };
    return { text: 'Good', class: 'good' };
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
        showToast('Part updated');
    } else {
        const newId = inventory.length > 0 ? Math.max(...inventory.map(i => i.id)) + 1 : 1;
        inventory.push({ id: newId, ...itemData });
        showToast('Part added');
    }
    
    saveInventory();
    closeModal();
}

function confirmDelete(id, name) {
    pendingDeleteId = id;
    document.getElementById('confirmMessage').textContent = `Delete "${name}"?`;
    document.getElementById('confirmModal').style.display = 'flex';
}

function executeDelete() {
    if (pendingDeleteId) {
        inventory = inventory.filter(i => i.id !== pendingDeleteId);
        saveInventory();
        showToast('Part deleted');
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
        showToast('Not enough stock', 'error');
        return;
    }
    
    updateStockQuantity(newQuantity);
}

function applyCustomAdjustment() {
    const input = document.getElementById('customAdjustment');
    const value = parseInt(input.value);
    
    if (isNaN(value) || value === 0) {
        showToast('Enter valid number', 'error');
        return;
    }
    
    const newQuantity = currentStockItem.quantity + value;
    if (newQuantity < 0) {
        showToast('Not enough stock', 'error');
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
    showToast(`Stock: ${newQuantity}`);
    
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
        
        if (outOfStock.length > 0) messages.push(`${outOfStock.length} out`);
        if (lowStock.length > 0) messages.push(`${lowStock.length} low`);
        
        document.getElementById('lowStockMessage').textContent = messages.join(' • ');
        banner.style.display = 'flex';
    } else {
        document.getElementById('lowStockBanner').style.display = 'none';
    }
}

// ==================== EXPORT ====================

function exportInventory() {
    if (inventory.length === 0) {
        showToast('No data to export', 'error');
        return;
    }
    
    let text = "RTY MOTOPARPS INVENTORY\n";
    text += "=".repeat(40) + "\n\n";
    
    inventory.forEach(item => {
        text += `Part: ${item.name}\n`;
        text += `Category: ${item.category}\n`;
        text += `Stock: ${item.quantity}\n`;
        text += `Price: ₱${item.price}\n`;
        text += `Value: ₱${item.quantity * item.price}\n`;
        if (item.compatibleModels) text += `Models: ${item.compatibleModels}\n`;
        if (item.location) text += `Location: ${item.location}\n`;
        text += "-".repeat(30) + "\n\n";
    });
    
    text += `Total Parts: ${inventory.length}\n`;
    text += `Total Value: ₱${inventory.reduce((sum, item) => sum + (item.quantity * item.price), 0)}\n`;
    text += `Exported: ${new Date().toLocaleString()}`;
    
    const blob = new Blob([text], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `RTY-inventory-${new Date().toISOString().split('T')[0]}.txt`;
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
    }, 2000);
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
    // Close modals when tapping outside
    window.onclick = function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
            if (event.target.id === 'stockModal') currentStockItem = null;
            if (event.target.id === 'confirmModal') pendingDeleteId = null;
        }
    };
    
    // Handle back button on Android
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            closeModal();
            closeStockModal();
            closeConfirmModal();
        }
    });
}
