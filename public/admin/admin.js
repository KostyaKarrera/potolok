const API = "/api/admin";
let adminToken = null;

// Проверка авторизации
function checkAuth() {
  const token = localStorage.getItem("adminToken");
  if (token) {
    adminToken = token;
    document.getElementById("login-container").style.display = "none";
    document.getElementById("admin-container").style.display = "block";
    initTabs();
    loadRequests();
    loadContracts();
    initRatingForm();
    loadPhoneClicks(); // ДОБАВЛЕНО
    loadPrices(); // Загружаем цены при входе
  }
}

// Вход
document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const password = document.getElementById("admin-password").value;
  const errorEl = document.getElementById("login-error");

  try {
    const res = await fetch(`${API}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });

    const data = await res.json();
    if (data.status === "success") {
      adminToken = data.token;
      localStorage.setItem("adminToken", adminToken);
      document.getElementById("login-container").style.display = "none";
      document.getElementById("admin-container").style.display = "block";
      initTabs();
      loadRequests();
      loadContracts();
      initRatingForm(); // ДОБАВЛЕНО
      loadPrices(); // Загружаем цены при входе
    } else {
      errorEl.textContent = data.message || "Ошибка входа";
    }
  } catch (err) {
    errorEl.textContent = "Ошибка подключения к серверу";
  }
});

// Выход
document.getElementById("logout-btn").addEventListener("click", () => {
  localStorage.removeItem("adminToken");
  adminToken = null;
  document.getElementById("login-container").style.display = "block";
  document.getElementById("admin-container").style.display = "none";
  document.getElementById("admin-password").value = "";
});

// Загрузка заявок
async function loadRequests() {
  try {
    const res = await fetch(`${API}/requests`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    const data = await res.json();
    if (data.status === "success") {
      renderRequests(data.requests);
      updateStats(data.requests);
    } else {
      if (data.message === "Неверный токен") {
        localStorage.removeItem("adminToken");
        location.reload();
      }
    }
  } catch (err) {
    console.error("Ошибка загрузки заявок:", err);
  }
}

// Обновление статистики
function updateStats(requests) {
  const total = requests.length;
  const newCount = requests.filter(r => r.status === "новая").length;
  const closedCount = requests.filter(r => r.status === "закрыта").length;

  document.getElementById("total-requests").textContent = total;
  document.getElementById("new-requests").textContent = newCount;
  document.getElementById("closed-requests").textContent = closedCount;
}

// Рендер таблицы с кнопками удаления
function renderRequests(requests) {
  const tbody = document.querySelector("#requests-table tbody");
  tbody.innerHTML = "";

  if (requests.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;padding:40px;">Заявок пока нет</td></tr>`;
    return;
  }

  const isMobile = window.innerWidth <= 768;
  const table = document.querySelector("#requests-table");

  requests.forEach(req => {
    const tr = document.createElement("tr");
    if (isMobile) {
      tr.className = "mobile-card-view";
    }
    tr.innerHTML = `
      <td data-label="ID">${req.id}</td>
      <td data-label="Имя">${req.name}</td>
      <td data-label="Телефон">${req.phone}</td>
      <td data-label="Тип">${req.type || "-"}</td>
      <td data-label="Ориентировочная стоимость">
        <input type="number" 
               id="estimated-${req.id}" 
               value="${req.estimatedPrice || ""}" 
               placeholder="0"
               min="0"
               style="width:100%;max-width:120px;padding:6px;border:1px solid #ddd;border-radius:6px;">
      </td>
      <td data-label="Партнёр" class="partner-info">
        ${req.partnerName ? `<strong>${req.partnerName}</strong><br><small>${req.partnerPromo}</small>` : "-"}
      </td>
      <td data-label="Статус">
        <span class="status-badge status-${req.status || "новая"}">${req.status || "новая"}</span>
      </td>
      <td data-label="Сумма договора">
        <input type="number" 
               id="amount-${req.id}" 
               value="${req.contractAmount || ""}" 
               placeholder="0"
               min="0"
               style="width:100%;max-width:120px;padding:6px;border:1px solid #ddd;border-radius:6px;">
      </td>
      <td data-label="Дата">${new Date(req.createdAt).toLocaleDateString("ru-RU")}</td>
      <td data-label="Действия">
        <div class="edit-form">
          <select id="status-${req.id}" style="width:100%;max-width:140px;padding:6px;border:1px solid #ddd;border-radius:6px;">
            <option value="новая" ${req.status === "новая" ? "selected" : ""}>Новая</option>
            <option value="в_работе" ${req.status === "в_работе" ? "selected" : ""}>В работе</option>
            <option value="закрыта" ${req.status === "закрыта" ? "selected" : ""}>Закрыта</option>
            <option value="отменена" ${req.status === "отменена" ? "selected" : ""}>Отменена</option>
          </select>
          <button class="save-btn" onclick="saveRequest(${req.id})" style="width:100%;margin-top:5px;">Сохранить</button>
        </div>
      </td>
      <td data-label="Управление">
        <div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap;justify-content:center;">
          <button class="edit-btn" onclick="editRequest(${req.id})" title="Редактировать заявку"><i class="fas fa-edit"></i></button>
          <button class="delete-btn" onclick="deleteRequest(${req.id})" title="Удалить заявку"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Сохранение заявки
async function saveRequest(id) {
  const estimatedInput = document.getElementById(`estimated-${id}`);
  const amountInput = document.getElementById(`amount-${id}`);
  const statusSelect = document.getElementById(`status-${id}`);
  const saveBtn = statusSelect.nextElementSibling;

  const estimatedPrice = estimatedInput.value ? parseInt(estimatedInput.value) : null;
  const contractAmount = amountInput.value ? parseInt(amountInput.value) : null;
  const status = statusSelect.value;

  saveBtn.disabled = true;
  saveBtn.textContent = "Сохранение...";

  try {
    const res = await fetch(`${API}/requests/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ contractAmount, status, estimatedPrice })
    });

    const data = await res.json();
    if (data.status === "success") {
      saveBtn.textContent = "✓ Сохранено";
      saveBtn.style.background = "#27ae60";
      setTimeout(() => {
        saveBtn.textContent = "Сохранить";
        saveBtn.style.background = "";
        saveBtn.disabled = false;
      }, 2000);
      loadRequests();
    } else {
      alert("Ошибка: " + data.message);
      saveBtn.disabled = false;
      saveBtn.textContent = "Сохранить";
    }
  } catch (err) {
    alert("Ошибка сохранения");
    saveBtn.disabled = false;
    saveBtn.textContent = "Сохранить";
  }
}

// Удаление заявки
async function deleteRequest(id) {
  if (!confirm("Вы уверены, что хотите удалить эту заявку? Это действие нельзя отменить.")) {
    return;
  }

  try {
    const res = await fetch(`${API}/requests/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${adminToken}`
      }
    });

    const data = await res.json();
    if (data.status === "success") {
      showNotification("Заявка успешно удалена", "success");
      loadRequests();
    } else {
      showNotification("Ошибка при удалении: " + data.message, "error");
    }
  } catch (err) {
    showNotification("Ошибка подключения к серверу", "error");
  }
}

async function loadPhoneClicks() {
  const body = document.getElementById("clicks-table-body");

  body.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:20px;">Загрузка...</td></tr>`;

  const res = await fetch("/api/admin/phone-clicks", {
    headers: { Authorization: `Bearer ${adminToken}` }
  });

  const data = await res.json();
  if (data.status !== "success") {
    body.innerHTML = `<tr><td colspan="4" style="text-align:center;color:red;padding:20px;">Ошибка загрузки</td></tr>`;
    return;
  }

  const rows = data.stats;

  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:20px;">Нет данных</td></tr>`;
    return;
  }

  body.innerHTML = "";
  rows.forEach(r => {
    body.innerHTML += `
      <tr>
        <td>${r.phone}</td>
        <td>${r.total}</td>
        <td>${new Date(r.firstClick).toLocaleString()}</td>
        <td>${new Date(r.lastClick).toLocaleString()}</td>
      </tr>
    `;
  });
}


// Всплывающее уведомление
function showNotification(message, type = "info") {
  let notification = document.getElementById("admin-notification");
  if (!notification) {
    notification = document.createElement("div");
    notification.id = "admin-notification";
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 15px 20px;
      border-radius: 8px;
      color: white;
      font-weight: 500;
      z-index: 10000;
      transition: opacity 0.3s;
      max-width: 300px;
    `;
    document.body.appendChild(notification);
  }

  const colors = {
    success: "#27ae60",
    error: "#e74c3c",
    info: "#3498db"
  };

  notification.style.background = colors[type] || colors.info;
  notification.textContent = message;
  notification.style.opacity = "1";

  setTimeout(() => {
    notification.style.opacity = "0";
  }, 3000);
}

// ====== Вкладки ======
function initTabs() {
  const btns = document.querySelectorAll(".tab-btn");
  const leadsTable = document.querySelector(".table-container");
  const contractsTab = document.getElementById("contracts-tab");
  const partnersTab = document.getElementById("partners-tab");
  const productsTab = document.getElementById("products-tab");
  const pricesTab = document.getElementById("prices-tab");
  const ratingTab = document.getElementById("rating-tab"); // ДОБАВЛЕНО
  const stats = document.querySelector(".stats");
  const clicksTab = document.getElementById("clicks-tab");

  btns.forEach(btn => {
    btn.addEventListener("click", () => {
      btns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const tab = btn.dataset.tab;
      
      if (tab === "leads-tab") {
        leadsTable.style.display = "";
        stats.style.display = "";
        contractsTab.style.display = "none";
        partnersTab.style.display = "none";
        productsTab.style.display = "none";
        pricesTab.style.display = "none";
        ratingTab.style.display = "none";
        clicksTab.style.display = "none";
      } else if (tab === "contracts-tab") {
        leadsTable.style.display = "none";
        stats.style.display = "none";
        contractsTab.style.display = "";
        partnersTab.style.display = "none";
        productsTab.style.display = "none";
        pricesTab.style.display = "none";
        ratingTab.style.display = "none";
        clicksTab.style.display = "none";
      } else if (tab === "partners-tab") {
        leadsTable.style.display = "none";
        stats.style.display = "none";
        contractsTab.style.display = "none";
        partnersTab.style.display = "";
        productsTab.style.display = "none";
        pricesTab.style.display = "none";
        ratingTab.style.display = "none";
        clicksTab.style.display = "none";
        loadPartnersList();
      } else if (tab === "products-tab") {
        leadsTable.style.display = "none";
        stats.style.display = "none";
        contractsTab.style.display = "none";
        partnersTab.style.display = "none";
        productsTab.style.display = "";
        pricesTab.style.display = "none";
        ratingTab.style.display = "none";
        clicksTab.style.display = "none";
        loadProducts(); // Загружаем продукты при открытии вкладки
      } else if (tab === "prices-tab") {
        leadsTable.style.display = "none";
        stats.style.display = "none";
        contractsTab.style.display = "none";
        partnersTab.style.display = "none";
        productsTab.style.display = "none";
        pricesTab.style.display = "";
        ratingTab.style.display = "none";
        clicksTab.style.display = "none";
        loadPrices(); // Загружаем цены при открытии вкладки
      } else if (tab === "rating-tab") { // ДОБАВЛЕНО
        leadsTable.style.display = "none";
        stats.style.display = "none";
        contractsTab.style.display = "none";
        partnersTab.style.display = "none";
        productsTab.style.display = "none";
        pricesTab.style.display = "none";
        ratingTab.style.display = "";
        clicksTab.style.display = "none";
        loadCurrentRating(); // Загружаем текущие данные
      } else if (tab === "clicks-tab") {
        leadsTable.style.display = "none";
        stats.style.display = "none";
        contractsTab.style.display = "none";
        partnersTab.style.display = "none";
        productsTab.style.display = "none";
        pricesTab.style.display = "none";
        ratingTab.style.display = "none";
        clicksTab.style.display = "";
        loadPhoneClicks();
      
      }
      
    });
  });

  // Превью фото
  const photosInput = document.getElementById("contract-photos");
  const preview = document.getElementById("photos-preview");
  if (photosInput) {
    photosInput.addEventListener("change", () => {
      preview.innerHTML = "";
      Array.from(photosInput.files || []).forEach(file => {
        const url = URL.createObjectURL(file);
        const img = document.createElement("img");
        img.src = url;
        preview.appendChild(img);
      });
    });
  }

  // Загрузка партнёров в селект рефера
  loadPartners();

  // Сабмит формы контракта
  const contractForm = document.getElementById("contract-form");
  const formMsg = document.getElementById("contract-form-msg");
  const submitBtn = document.getElementById("contract-submit-btn");
  if (contractForm) {
    contractForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      formMsg.textContent = "";
      submitBtn.disabled = true;
      submitBtn.textContent = "Сохранение...";

      const fd = new FormData(contractForm);
      try {
        const res = await fetch(`${API}/contracts`, {
          method: "POST",
          headers: { Authorization: `Bearer ${adminToken}` },
          body: fd
        });
        const data = await res.json();
        if (data.status === "success") {
          formMsg.style.color = "#27ae60";
          formMsg.textContent = "Договор сохранен";
          contractForm.reset();
          preview.innerHTML = "";
          loadContracts();
        } else {
          formMsg.style.color = "#e74c3c";
          formMsg.textContent = data.message || "Ошибка сохранения";
        }
      } catch (err) {
        formMsg.style.color = "#e74c3c";
        formMsg.textContent = "Ошибка подключения";
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Сохранить договор";
      }
    });
  }
}

// ====== КОНТРАКТЫ ======
async function loadContracts() {
  try {
    const res = await fetch(`${API}/contracts`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const data = await res.json();
    if (data.status === "success") {
      renderContracts(data.contracts);
    }
  } catch (err) {
    console.error("Ошибка загрузки контрактов:", err);
  }
}

function renderContracts(contracts) {
  const tbody = document.querySelector("#contracts-table tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  if (!contracts || contracts.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;padding:40px;">Договоров пока нет</td></tr>`;
    return;
  }

  const isMobile = window.innerWidth <= 768;

  contracts.forEach(c => {
    const tr = document.createElement("tr");
    if (isMobile) {
      tr.className = "mobile-card-view";
    }
    const photosHtml = (c.photos || [])
      .map(src => `<a href="${src}" target="_blank"><img src="${src}" alt="" style="width:48px;height:48px;object-fit:cover;border-radius:4px;border:1px solid #eee;margin-right:4px;"></a>`)
      .join("");
    tr.innerHTML = `
      <td data-label="ID">${c.id}</td>
      <td data-label="Имя">${c.name}</td>
      <td data-label="Телефон">${c.phone}</td>
      <td data-label="Адрес">${c.address || "-"}</td>
      <td data-label="Сумма">${c.contractAmount || "-"}</td>
      <td data-label="Договор">${c.contractDate ? new Date(c.contractDate).toLocaleDateString("ru-RU") : "-"}</td>
      <td data-label="Монтаж">${c.installDate ? new Date(c.installDate).toLocaleDateString("ru-RU") : "-"}</td>
      <td data-label="Предоплата">${c.prepayment || "-"}</td>
      <td data-label="Партнёр" class="partner-info">${c.partnerName ? `<strong>${c.partnerName}</strong><br><small>${c.partnerPromo}</small>` : "-"}</td>
      <td data-label="Фото">${photosHtml || "-"}</td>
      <td data-label="Управление">
        <div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap;justify-content:center;">
          <button class="edit-btn" onclick="editContract(${c.id})" title="Редактировать договор"><i class="fas fa-edit"></i></button>
          <button class="delete-btn" onclick="deleteContract(${c.id})" title="Удалить договор"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Удаление договора
async function deleteContract(id) {
  if (!confirm("Вы уверены, что хотите удалить этот договор? Это действие нельзя отменить.")) {
    return;
  }

  try {
    const res = await fetch(`${API}/contracts/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${adminToken}`
      }
    });

    const data = await res.json();
    if (data.status === "success") {
      showNotification("Договор успешно удален", "success");
      loadContracts();
    } else {
      showNotification("Ошибка при удалении: " + data.message, "error");
    }
  } catch (err) {
    showNotification("Ошибка подключения к серверу", "error");
  }
}

// Загрузить партнёров в выпадающий список рефера
async function loadPartners() {
  const select = document.getElementById("partner-select");
  if (!select) return;
  select.innerHTML = `<option value="">— Без рефера —</option>`;
  try {
    const res = await fetch(`${API}/partners`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const data = await res.json();
    if (data.status === "success") {
      (data.partners || []).forEach(p => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = `${p.name} (${p.promo})`;
        select.appendChild(opt);
      });
    }
  } catch (e) {
    console.error("Ошибка загрузки партнёров:", e);
  }
}

// ====== СПИСОК ПАРТНЁРОВ ======
async function loadPartnersList() {
  try {
    const res = await fetch(`${API}/partners`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const data = await res.json();
    if (data.status === "success") {
      renderPartnersList(data.partners);
    }
  } catch (err) {
    console.error("Ошибка загрузки списка партнёров:", err);
  }
}

function renderPartnersList(partners) {
  const tbody = document.querySelector("#partners-table tbody");
  if (!tbody) return;
  
  tbody.innerHTML = "";
  if (!partners || partners.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;">Партнёров пока нет</td></tr>`;
    return;
  }

  partners.forEach(p => {
    const tr = document.createElement("tr");
    const formattedPhone = p.phone ? p.phone.replace(/^7(\d{3})(\d{3})(\d{2})(\d{2})$/, '+7 ($1) $2-$3-$4') : '-';
    
    tr.innerHTML = `
      <td>${p.id}</td>
      <td>${p.name}</td>
      <td>${formattedPhone}</td>
      <td><code>${p.promo}</code></td>
      <td>${new Date(p.createdAt).toLocaleDateString("ru-RU")}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ====== GOOGLE RATING MANAGEMENT ======

// Загрузка текущего рейтинга
async function loadCurrentRating() {
  try {
    const res = await fetch('/api/google-rating');
    const data = await res.json();
    
    if (data.status === 'success') {
      document.getElementById('google-rating').value = data.rating;
      document.getElementById('google-reviews').value = data.reviewsCount;
      updateCurrentRatingDisplay(data.rating, data.reviewsCount);
    }
  } catch (error) {
    console.error('Ошибка загрузки рейтинга:', error);
  }
}

// Обновление отображения текущего рейтинга
function updateCurrentRatingDisplay(rating, reviewsCount) {
  const ratingValue = document.getElementById('current-rating-value');
  const reviewsCountEl = document.getElementById('current-reviews-count');
  
  if (ratingValue) ratingValue.textContent = rating;
  if (reviewsCountEl) {
    const reviewsWord = getReviewsWord(reviewsCount);
    reviewsCountEl.textContent = `${reviewsCount} ${reviewsWord}`;
  }
}

// Функция для правильного склонения слова "отзыв"
function getReviewsWord(count) {
  if (count % 10 === 1 && count % 100 !== 11) return 'отзыв';
  if (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20)) return 'отзыва';
  return 'отзывов';
}

// Обновление рейтинга
async function updateGoogleRating() {
  const rating = document.getElementById('google-rating').value;
  const reviews = document.getElementById('google-reviews').value;
  const messageEl = document.getElementById('rating-form-msg');
  
  if (!rating || rating < 0 || rating > 5) {
    messageEl.textContent = 'Рейтинг должен быть от 0.0 до 5.0';
    messageEl.style.color = '#e74c3c';
    return;
  }
  
  try {
    const res = await fetch('/api/admin/update-rating', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ rating, reviewsCount: reviews })
    });
    
    const data = await res.json();
    if (data.status === 'success') {
      messageEl.textContent = '✅ Рейтинг успешно обновлен!';
      messageEl.style.color = '#27ae60';
      updateCurrentRatingDisplay(rating, reviews);
      
      setTimeout(() => {
        messageEl.textContent = '';
      }, 3000);
    } else {
      messageEl.textContent = '❌ Ошибка: ' + data.message;
      messageEl.style.color = '#e74c3c';
    }
  } catch (error) {
    messageEl.textContent = '❌ Ошибка подключения к серверу';
    messageEl.style.color = '#e74c3c';
  }
}

// Инициализация формы рейтинга
function initRatingForm() {
  const ratingForm = document.getElementById('rating-form');
  if (ratingForm) {
    ratingForm.addEventListener('submit', function(e) {
      e.preventDefault();
      updateGoogleRating();
    });
  }
}

// ====== РЕДАКТИРОВАНИЕ ЗАЯВКИ ======
let currentEditRequestId = null;

async function editRequest(id) {
  try {
    const res = await fetch(`${API}/requests`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const data = await res.json();
    if (data.status === "success") {
      const request = data.requests.find(r => r.id === id);
      if (request) {
        currentEditRequestId = id;
        document.getElementById("edit-request-name").value = request.name || "";
        document.getElementById("edit-request-phone").value = request.phone || "";
        document.getElementById("edit-request-type").value = request.type || "";
        document.getElementById("edit-request-estimated").value = request.estimatedPrice || "";
        document.getElementById("edit-request-amount").value = request.contractAmount || "";
        document.getElementById("edit-request-status").value = request.status || "новая";
        document.getElementById("edit-request-modal").style.display = "flex";
      }
    }
  } catch (err) {
    showNotification("Ошибка загрузки данных заявки", "error");
  }
}

function closeEditRequestModal() {
  document.getElementById("edit-request-modal").style.display = "none";
  currentEditRequestId = null;
}

document.getElementById("edit-request-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentEditRequestId) return;

  const name = document.getElementById("edit-request-name").value.trim();
  const phone = document.getElementById("edit-request-phone").value.trim();
  const type = document.getElementById("edit-request-type").value.trim();
  const estimatedPrice = document.getElementById("edit-request-estimated").value ? parseInt(document.getElementById("edit-request-estimated").value) : null;
  const contractAmount = document.getElementById("edit-request-amount").value ? parseInt(document.getElementById("edit-request-amount").value) : null;
  const status = document.getElementById("edit-request-status").value;

  if (!name || !phone || !type) {
    showNotification("Заполните все обязательные поля", "error");
    return;
  }

  try {
    const res = await fetch(`${API}/requests/${currentEditRequestId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ name, phone, type, estimatedPrice, contractAmount, status })
    });

    const data = await res.json();
    if (data.status === "success") {
      showNotification("Заявка успешно обновлена", "success");
      closeEditRequestModal();
      loadRequests();
    } else {
      showNotification("Ошибка: " + data.message, "error");
    }
  } catch (err) {
    showNotification("Ошибка сохранения", "error");
  }
});

// Закрытие модального окна при клике вне его
document.getElementById("edit-request-modal").addEventListener("click", (e) => {
  if (e.target.id === "edit-request-modal") {
    closeEditRequestModal();
  }
});

// ====== РЕДАКТИРОВАНИЕ ДОГОВОРА ======
let currentEditContractId = null;

async function editContract(id) {
  try {
    const res = await fetch(`${API}/contracts`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const data = await res.json();
    if (data.status === "success") {
      const contract = data.contracts.find(c => c.id === id);
      if (contract) {
        currentEditContractId = id;
        document.getElementById("edit-contract-name").value = contract.name || "";
        document.getElementById("edit-contract-phone").value = contract.phone || "";
        document.getElementById("edit-contract-address").value = contract.address || "";
        document.getElementById("edit-contract-amount").value = contract.contractAmount || "";
        document.getElementById("edit-contract-date").value = contract.contractDate ? contract.contractDate.split('T')[0] : "";
        document.getElementById("edit-contract-install-date").value = contract.installDate ? contract.installDate.split('T')[0] : "";
        document.getElementById("edit-contract-prepayment").value = contract.prepayment || "";
        document.getElementById("edit-contract-ref").value = contract.ref || "";
        
        // Отображаем текущие фото
        const currentPhotosDiv = document.getElementById("edit-contract-current-photos");
        if (contract.photos && contract.photos.length > 0) {
          currentPhotosDiv.innerHTML = contract.photos.map(photo => `
            <div style="position:relative;display:inline-block;">
              <img src="${photo}" alt="Фото" style="width:80px;height:80px;object-fit:cover;border-radius:6px;border:1px solid #eee;">
              <button type="button" onclick="removeContractPhoto('${photo}', ${id})" 
                      style="position:absolute;top:-5px;right:-5px;background:#e74c3c;color:white;border:none;border-radius:50%;width:20px;height:20px;cursor:pointer;font-size:12px;">×</button>
            </div>
          `).join("");
        } else {
          currentPhotosDiv.innerHTML = "<span style='color:#999;'>Нет фото</span>";
        }
        
        // Очищаем превью новых фото
        document.getElementById("edit-contract-photos-preview").innerHTML = "";
        document.getElementById("edit-contract-photos").value = "";
        
        // Загружаем партнёров в селект
        await loadPartnersForEdit();
        document.getElementById("edit-contract-modal").style.display = "flex";
      }
    }
  } catch (err) {
    showNotification("Ошибка загрузки данных договора", "error");
  }
}

// Удаление фото из договора
async function removeContractPhoto(photoPath, contractId) {
  if (!confirm("Удалить это фото?")) return;
  
  try {
    const res = await fetch(`${API}/contracts/${contractId}/photos`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ photoPath })
    });
    
    const data = await res.json();
    if (data.status === "success") {
      showNotification("Фото удалено", "success");
      editContract(contractId); // Перезагружаем данные
    } else {
      showNotification("Ошибка: " + data.message, "error");
    }
  } catch (err) {
    showNotification("Ошибка удаления фото", "error");
  }
}

// Превью новых фото при выборе
document.getElementById("edit-contract-photos").addEventListener("change", function() {
  const preview = document.getElementById("edit-contract-photos-preview");
  preview.innerHTML = "";
  Array.from(this.files || []).forEach(file => {
    const url = URL.createObjectURL(file);
    const img = document.createElement("img");
    img.src = url;
    preview.appendChild(img);
  });
});

async function loadPartnersForEdit() {
  const select = document.getElementById("edit-contract-ref");
  if (!select) return;
  select.innerHTML = `<option value="">— Без рефера —</option>`;
  try {
    const res = await fetch(`${API}/partners`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const data = await res.json();
    if (data.status === "success") {
      (data.partners || []).forEach(p => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = `${p.name} (${p.promo})`;
        select.appendChild(opt);
      });
    }
  } catch (e) {
    console.error("Ошибка загрузки партнёров:", e);
  }
}

function closeEditContractModal() {
  document.getElementById("edit-contract-modal").style.display = "none";
  currentEditContractId = null;
}

document.getElementById("edit-contract-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentEditContractId) return;

  const name = document.getElementById("edit-contract-name").value.trim();
  const phone = document.getElementById("edit-contract-phone").value.trim();
  const address = document.getElementById("edit-contract-address").value.trim();
  const contractAmount = document.getElementById("edit-contract-amount").value ? parseInt(document.getElementById("edit-contract-amount").value) : null;
  const contractDate = document.getElementById("edit-contract-date").value || null;
  const installDate = document.getElementById("edit-contract-install-date").value || null;
  const prepayment = document.getElementById("edit-contract-prepayment").value ? parseInt(document.getElementById("edit-contract-prepayment").value) : null;
  const ref = document.getElementById("edit-contract-ref").value || null;
  const photosInput = document.getElementById("edit-contract-photos");
  const hasNewPhotos = photosInput.files && photosInput.files.length > 0;

  if (!name || !phone || !address) {
    showNotification("Заполните все обязательные поля", "error");
    return;
  }

  try {
    // Если есть новые фото, используем FormData, иначе JSON
    if (hasNewPhotos) {
      const formData = new FormData();
      formData.append("name", name);
      formData.append("phone", phone);
      formData.append("address", address);
      if (contractAmount) formData.append("contractAmount", contractAmount);
      if (contractDate) formData.append("contractDate", contractDate);
      if (installDate) formData.append("installDate", installDate);
      if (prepayment) formData.append("prepayment", prepayment);
      if (ref) formData.append("ref", ref);
      
      Array.from(photosInput.files).forEach(file => {
        formData.append("photos", file);
      });

      const res = await fetch(`${API}/contracts/${currentEditContractId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${adminToken}`
        },
        body: formData
      });

      const data = await res.json();
      if (data.status === "success") {
        showNotification("Договор успешно обновлен", "success");
        closeEditContractModal();
        loadContracts();
      } else {
        showNotification("Ошибка: " + data.message, "error");
      }
    } else {
      // Обновление без фото - используем JSON
      const res = await fetch(`${API}/contracts/${currentEditContractId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({ name, phone, address, contractAmount, contractDate, installDate, prepayment, ref })
      });

      const data = await res.json();
      if (data.status === "success") {
        showNotification("Договор успешно обновлен", "success");
        closeEditContractModal();
        loadContracts();
      } else {
        showNotification("Ошибка: " + data.message, "error");
      }
    }
  } catch (err) {
    showNotification("Ошибка сохранения", "error");
  }
});

// Закрытие модального окна при клике вне его
document.getElementById("edit-contract-modal").addEventListener("click", (e) => {
  if (e.target.id === "edit-contract-modal") {
    closeEditContractModal();
  }
});

// === Управление ценами ===
async function loadPrices() {
  try {
    const res = await fetch(`${API}/prices`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const data = await res.json();
    
    if (data.status === "success" && data.prices) {
      const p = data.prices;
      
      // Динамически рендерим цены для комнат
      renderPricesSection('rooms', p.rooms);
      
      // Динамически рендерим цены для квартир
      renderPricesSection('apartments', p.apartments);
      
      const msgEl = document.getElementById("prices-form-msg");
      if (msgEl) {
        msgEl.textContent = "Цены загружены";
        msgEl.style.color = "green";
        setTimeout(() => { msgEl.textContent = ""; }, 3000);
      }
    }
  } catch (err) {
    console.error("Ошибка загрузки цен:", err);
    const msgEl = document.getElementById("prices-form-msg");
    if (msgEl) {
      msgEl.textContent = "Ошибка загрузки цен";
      msgEl.style.color = "red";
    }
  }
}

function renderPricesSection(sectionType, sectionPrices) {
  if (!sectionPrices) return;
  
  const container = document.getElementById(`${sectionType}-prices-container`);
  if (!container) return;
  
  let html = '';
  
  // Полотно
  if (sectionPrices.fabric) {
    html += `
      <div style="margin-bottom: 25px;">
        <h4 style="margin-bottom: 15px; font-size: 16px;">Полотно (за м²)</h4>
        <div style="display: grid; gap: 10px;" id="${sectionType}-fabric-list">
    `;
    Object.keys(sectionPrices.fabric).forEach(fabricName => {
      const fabricId = `${sectionType}-fabric-${fabricName.replace(/\s+/g, '-').toLowerCase()}`;
      html += `
        <div style="display: flex; align-items: center; gap: 10px;">
          <label style="flex: 1; font-size: 14px;">${fabricName}:</label>
          <input type="number" id="${fabricId}" data-fabric="${fabricName}" min="0" step="1" 
                 value="${sectionPrices.fabric[fabricName].pricePerM2 || 0}" 
                 style="width: 120px; padding: 8px; border: 2px solid #ddd; border-radius: 6px;">
          <span style="font-size: 14px; color: #666;">₽/м²</span>
        </div>
      `;
    });
    html += `</div></div>`;
  }
  
  // Светильники
  if (sectionPrices.lights) {
    html += `
      <div style="margin-bottom: 25px;">
        <h4 style="margin-bottom: 15px; font-size: 16px;">Светильники (за шт)</h4>
        <div style="display: grid; gap: 10px;" id="${sectionType}-lights-list">
    `;
    Object.keys(sectionPrices.lights).forEach(lightName => {
      const lightId = `${sectionType}-lights-${lightName.replace(/\s+/g, '-').replace(/[^a-z0-9-]/gi, '').toLowerCase()}`;
      html += `
        <div style="display: flex; align-items: center; gap: 10px;">
          <label style="flex: 1; font-size: 14px;">${lightName}:</label>
          <input type="number" id="${lightId}" data-light="${lightName}" min="0" step="1" 
                 value="${sectionPrices.lights[lightName].pricePerUnit || 0}" 
                 style="width: 120px; padding: 8px; border: 2px solid #ddd; border-radius: 6px;">
          <span style="font-size: 14px; color: #666;">₽/шт</span>
        </div>
      `;
    });
    html += `</div></div>`;
  }
  
  // Гардины
  if (sectionPrices.curtains) {
    html += `
      <div style="margin-bottom: 25px;">
        <h4 style="margin-bottom: 15px; font-size: 16px;">Гардины (за м)</h4>
        <div style="display: grid; gap: 10px;" id="${sectionType}-curtains-list">
    `;
    Object.keys(sectionPrices.curtains).forEach(curtainName => {
      const curtainId = `${sectionType}-curtains-${curtainName.replace(/\s+/g, '-').toLowerCase()}`;
      html += `
        <div style="display: flex; align-items: center; gap: 10px;">
          <label style="flex: 1; font-size: 14px;">${curtainName}:</label>
          <input type="number" id="${curtainId}" data-curtain="${curtainName}" min="0" step="1" 
                 value="${sectionPrices.curtains[curtainName].pricePerM || 0}" 
                 style="width: 120px; padding: 8px; border: 2px solid #ddd; border-radius: 6px;">
          <span style="font-size: 14px; color: #666;">₽/м</span>
        </div>
      `;
    });
    html += `</div></div>`;
  }
  
  // Монтаж
  if (sectionPrices.installation) {
    html += `
      <div style="margin-bottom: 25px;">
        <h4 style="margin-bottom: 15px; font-size: 16px;">Монтаж</h4>
        <div style="display: grid; gap: 10px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <label style="flex: 1; font-size: 14px;">Базовая стоимость:</label>
            <input type="number" id="${sectionType}-install-base" min="0" step="1" 
                   value="${sectionPrices.installation.basePrice || 0}" 
                   style="width: 120px; padding: 8px; border: 2px solid #ddd; border-radius: 6px;">
            <span style="font-size: 14px; color: #666;">₽</span>
          </div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <label style="flex: 1; font-size: 14px;">За м²:</label>
            <input type="number" id="${sectionType}-install-m2" min="0" step="1" 
                   value="${sectionPrices.installation.pricePerM2 || 0}" 
                   style="width: 120px; padding: 8px; border: 2px solid #ddd; border-radius: 6px;">
            <span style="font-size: 14px; color: #666;">₽/м²</span>
          </div>
        </div>
      </div>
    `;
  }
  
  // Дополнительно (только для комнат)
  if (sectionType === 'rooms' && sectionPrices.extras) {
    html += `
      <div style="margin-bottom: 25px;">
        <h4 style="margin-bottom: 15px; font-size: 16px;">Дополнительно</h4>
        <div style="display: grid; gap: 10px;" id="${sectionType}-extras-list">
    `;
    Object.keys(sectionPrices.extras).forEach(extraName => {
      const extraId = `${sectionType}-extras-${extraName.replace(/\s+/g, '-').replace(/[^a-z0-9-]/gi, '').toLowerCase()}`;
      html += `
        <div style="display: flex; align-items: center; gap: 10px;">
          <label style="flex: 1; font-size: 14px;">${extraName}:</label>
          <input type="number" id="${extraId}" data-extra="${extraName}" min="0" step="1" 
                 value="${sectionPrices.extras[extraName].pricePerUnit || 0}" 
                 style="width: 120px; padding: 8px; border: 2px solid #ddd; border-radius: 6px;">
          <span style="font-size: 14px; color: #666;">₽/шт</span>
        </div>
      `;
    });
    html += `</div></div>`;
  }
  
  container.innerHTML = html;
}

async function savePrices() {
  try {
    // Сначала загружаем текущие цены, чтобы сохранить структуру
    const resLoad = await fetch(`${API}/prices`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const dataLoad = await resLoad.json();
    
    if (dataLoad.status !== "success" || !dataLoad.prices) {
      throw new Error("Не удалось загрузить текущие цены");
    }
    
    const prices = dataLoad.prices;
    
    // Обновляем цены для комнат
    if (prices.rooms) {
      // Полотно
      if (prices.rooms.fabric) {
        const fabricInputs = document.querySelectorAll(`[id^="rooms-fabric-"]`);
        fabricInputs.forEach(input => {
          const fabricName = input.getAttribute('data-fabric');
          if (fabricName && prices.rooms.fabric[fabricName]) {
            prices.rooms.fabric[fabricName].pricePerM2 = parseInt(input.value) || 0;
          }
        });
      }
      
      // Светильники
      if (prices.rooms.lights) {
        const lightsInputs = document.querySelectorAll(`[id^="rooms-lights-"]`);
        lightsInputs.forEach(input => {
          const lightName = input.getAttribute('data-light');
          if (lightName && prices.rooms.lights[lightName]) {
            prices.rooms.lights[lightName].pricePerUnit = parseInt(input.value) || 0;
          }
        });
      }
      
      // Гардины
      if (prices.rooms.curtains) {
        const curtainsInputs = document.querySelectorAll(`[id^="rooms-curtains-"]`);
        curtainsInputs.forEach(input => {
          const curtainName = input.getAttribute('data-curtain');
          if (curtainName && prices.rooms.curtains[curtainName]) {
            prices.rooms.curtains[curtainName].pricePerM = parseInt(input.value) || 0;
          }
        });
      }
      
      // Монтаж
      if (prices.rooms.installation) {
        const baseInput = document.getElementById("rooms-install-base");
        const m2Input = document.getElementById("rooms-install-m2");
        if (baseInput) prices.rooms.installation.basePrice = parseInt(baseInput.value) || 0;
        if (m2Input) prices.rooms.installation.pricePerM2 = parseInt(m2Input.value) || 0;
      }
      
      // Дополнительно
      if (prices.rooms.extras) {
        const extrasInputs = document.querySelectorAll(`[id^="rooms-extras-"]`);
        extrasInputs.forEach(input => {
          const extraName = input.getAttribute('data-extra');
          if (extraName && prices.rooms.extras[extraName]) {
            prices.rooms.extras[extraName].pricePerUnit = parseInt(input.value) || 0;
          }
        });
      }
    }
    
    // Обновляем цены для квартир
    if (prices.apartments) {
      // Полотно
      if (prices.apartments.fabric) {
        const fabricInputs = document.querySelectorAll(`[id^="apartments-fabric-"]`);
        fabricInputs.forEach(input => {
          const fabricName = input.getAttribute('data-fabric');
          if (fabricName && prices.apartments.fabric[fabricName]) {
            prices.apartments.fabric[fabricName].pricePerM2 = parseInt(input.value) || 0;
          }
        });
      }
      
      // Светильники
      if (prices.apartments.lights) {
        const lightsInputs = document.querySelectorAll(`[id^="apartments-lights-"]`);
        lightsInputs.forEach(input => {
          const lightName = input.getAttribute('data-light');
          if (lightName && prices.apartments.lights[lightName]) {
            prices.apartments.lights[lightName].pricePerUnit = parseInt(input.value) || 0;
          }
        });
      }
      
      // Гардины
      if (prices.apartments.curtains) {
        const curtainsInputs = document.querySelectorAll(`[id^="apartments-curtains-"]`);
        curtainsInputs.forEach(input => {
          const curtainName = input.getAttribute('data-curtain');
          if (curtainName && prices.apartments.curtains[curtainName]) {
            prices.apartments.curtains[curtainName].pricePerM = parseInt(input.value) || 0;
          }
        });
      }
      
      // Монтаж
      if (prices.apartments.installation) {
        const baseInput = document.getElementById("apartments-install-base");
        const m2Input = document.getElementById("apartments-install-m2");
        if (baseInput) prices.apartments.installation.basePrice = parseInt(baseInput.value) || 0;
        if (m2Input) prices.apartments.installation.pricePerM2 = parseInt(m2Input.value) || 0;
      }
    }
    
    const res = await fetch(`${API}/prices`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ prices })
    });
    
    const data = await res.json();
    const msgEl = document.getElementById("prices-form-msg");
    
    if (data.status === "success") {
      if (msgEl) {
        msgEl.textContent = "Цены успешно сохранены";
        msgEl.style.color = "green";
      }
      showNotification("Цены успешно сохранены", "success");
    } else {
      if (msgEl) {
        msgEl.textContent = "Ошибка: " + (data.message || "Неизвестная ошибка");
        msgEl.style.color = "red";
      }
      showNotification("Ошибка сохранения цен", "error");
    }
  } catch (err) {
    console.error("Ошибка сохранения цен:", err);
    const msgEl = document.getElementById("prices-form-msg");
    if (msgEl) {
      msgEl.textContent = "Ошибка сохранения цен";
      msgEl.style.color = "red";
    }
    showNotification("Ошибка сохранения цен", "error");
  }
}

// Глобальные функции для кнопок
window.loadCurrentRating = loadCurrentRating;
window.updateGoogleRating = updateGoogleRating;
window.loadPhoneClicks = loadPhoneClicks;
window.editRequest = editRequest;
window.editContract = editContract;
window.closeEditRequestModal = closeEditRequestModal;
window.closeEditContractModal = closeEditContractModal;
window.removeContractPhoto = removeContractPhoto;
window.loadPrices = loadPrices;
window.savePrices = savePrices;

// === Управление продуктами ===
let currentProductsData = null;

async function loadProducts() {
  try {
    const res = await fetch(`${API}/products`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const data = await res.json();
    
    if (data.status === "success" && data.products) {
      currentProductsData = data.products;
      renderProducts();
      const msgEl = document.getElementById("products-form-msg");
      if (msgEl) {
        msgEl.textContent = "Продукты загружены";
        msgEl.style.color = "green";
        setTimeout(() => { msgEl.textContent = ""; }, 3000);
      }
    }
  } catch (err) {
    console.error("Ошибка загрузки продуктов:", err);
    const msgEl = document.getElementById("products-form-msg");
    if (msgEl) {
      msgEl.textContent = "Ошибка загрузки продуктов";
      msgEl.style.color = "red";
    }
  }
}

async function saveProducts() {
  if (!currentProductsData) {
    showNotification("Нет данных для сохранения", "error");
    return;
  }
  
  try {
    const res = await fetch(`${API}/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ products: currentProductsData })
    });
    
    const data = await res.json();
    const msgEl = document.getElementById("products-form-msg");
    
    if (data.status === "success") {
      if (msgEl) {
        msgEl.textContent = "Продукты успешно сохранены. Новые атрибуты добавлены в раздел 'Цены'.";
        msgEl.style.color = "green";
      }
      showNotification("Продукты успешно сохранены", "success");
      // Перезагружаем цены, чтобы показать новые атрибуты
      if (document.getElementById("prices-tab").style.display !== "none") {
        loadPrices();
      }
    } else {
      if (msgEl) {
        msgEl.textContent = "Ошибка: " + (data.message || "Неизвестная ошибка");
        msgEl.style.color = "red";
      }
      showNotification("Ошибка сохранения продуктов", "error");
    }
  } catch (err) {
    console.error("Ошибка сохранения продуктов:", err);
    const msgEl = document.getElementById("products-form-msg");
    if (msgEl) {
      msgEl.textContent = "Ошибка сохранения продуктов";
      msgEl.style.color = "red";
    }
    showNotification("Ошибка сохранения продуктов", "error");
  }
}

function renderProducts() {
  if (!currentProductsData) return;
  
  renderRooms();
  renderApartments();
}

function renderRooms() {
  const container = document.getElementById("rooms-list");
  if (!container || !currentProductsData.rooms) return;
  
  container.innerHTML = currentProductsData.rooms.map(room => `
    <div class="product-edit-card" style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); min-width: 0; overflow: hidden;">
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px; gap: 10px; flex-wrap: wrap;">
        <div style="flex: 1; min-width: 0;">
          <div style="margin-bottom: 10px;">
            <label style="font-size: 12px; color: #666; display: block; margin-bottom: 5px;"><strong>Название:</strong></label>
            <input type="text" value="${room.title || ''}" onchange="updateRoomField(${room.id}, 'title', this.value)" 
                   style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 16px; font-weight: bold; box-sizing: border-box;">
          </div>
          <div style="font-size: 14px; color: #666; margin-bottom: 10px;">
            <strong>Площадь:</strong> <input type="text" value="${room.area || ''}" onchange="updateRoomField(${room.id}, 'area', this.value)" style="padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px; width: 150px; max-width: 100%; box-sizing: border-box;">
          </div>
          ${room.note !== null ? `
          <div style="font-size: 14px; color: #666; margin-bottom: 10px;">
            <strong>Примечание:</strong> <input type="text" value="${room.note || ''}" onchange="updateRoomField(${room.id}, 'note', this.value)" style="padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px; width: 100%; margin-top: 5px; box-sizing: border-box;">
          </div>
          ` : ''}
        </div>
        <button onclick="deleteRoom(${room.id})" class="delete-btn" style="padding: 8px 12px; font-size: 14px; flex-shrink: 0; white-space: nowrap; min-width: 42px; height: 42px; display: flex; align-items: center; justify-content: center; z-index: 10; position: relative;"><i class="fas fa-trash"></i></button>
      </div>
      
      <div class="room-variants-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 15px; min-width: 0;">
        <!-- БАЗОВЫЙ вариант -->
        <div style="border: 2px solid #e0e0e0; border-radius: 8px; padding: 15px; min-width: 0; overflow: hidden;">
          <div style="font-weight: bold; margin-bottom: 10px; color: var(--primary-color);">БАЗОВЫЙ</div>
          ${renderVariantEditor(room.id, 'basic', room.basic, 'room')}
        </div>
        
        <!-- КОМФОРТ вариант -->
        <div style="border: 2px solid var(--accent-color); border-radius: 8px; padding: 15px; min-width: 0; overflow: hidden;">
          <div style="font-weight: bold; margin-bottom: 10px; color: var(--accent-color);">КОМФОРТ</div>
          ${renderVariantEditor(room.id, 'comfort', room.comfort, 'room')}
        </div>
      </div>
    </div>
  `).join('');
}

function renderApartments() {
  const container = document.getElementById("apartments-list");
  if (!container || !currentProductsData.apartments) return;
  
  container.innerHTML = currentProductsData.apartments.map(apartment => `
    <div class="product-edit-card" style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); min-width: 0; overflow: hidden;">
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px; gap: 10px; flex-wrap: wrap;">
        <div style="flex: 1; min-width: 0;">
          <div style="margin-bottom: 10px;">
            <label style="font-size: 12px; color: #666; display: block; margin-bottom: 5px;"><strong>Название:</strong></label>
            <input type="text" value="${apartment.title || ''}" onchange="updateApartmentField(${apartment.id}, 'title', this.value)" 
                   style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 16px; font-weight: bold; box-sizing: border-box;">
          </div>
          <div style="font-size: 14px; color: #666; margin-bottom: 10px;">
            <strong>Площадь:</strong> <input type="text" value="${apartment.area || ''}" onchange="updateApartmentField(${apartment.id}, 'area', this.value)" style="padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px; width: 200px; max-width: 100%; box-sizing: border-box;">
          </div>
          ${apartment.note ? `
          <div style="font-size: 14px; color: #666; margin-bottom: 10px;">
            <strong>Примечание:</strong> <input type="text" value="${apartment.note || ''}" onchange="updateApartmentField(${apartment.id}, 'note', this.value)" style="padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px; width: 100%; margin-top: 5px; box-sizing: border-box;">
          </div>
          ` : ''}
        </div>
        <button onclick="deleteApartment(${apartment.id})" class="delete-btn" style="padding: 5px 10px; font-size: 12px; flex-shrink: 0;"><i class="fas fa-trash"></i></button>
      </div>
      
      <div style="margin-top: 15px; min-width: 0;">
        <strong style="margin-bottom: 10px; display: block;">Варианты:</strong>
        <div id="apartment-variants-${apartment.id}" style="display: grid; gap: 10px; min-width: 0;">
          ${apartment.variants.map((variant, idx) => renderApartmentVariant(apartment.id, idx, variant)).join('')}
        </div>
      </div>
    </div>
  `).join('');
}

function renderVariantEditor(productId, variantType, variant, productType) {
  const isRoom = productType === 'room';
  const variantId = isRoom ? `${productId}-${variantType}` : `${productId}-${variantType}`;
  
  // Преобразуем старую структуру в новую (для обратной совместимости) - только если нет items
  if (!variant.items || !Array.isArray(variant.items)) {
    variant.items = [];
    if (variant.fabric && variant.fabric !== '—' && variant.fabric !== null) {
      variant.items.push({ name: 'Полотно', value: variant.fabric, unit: 'м²' });
    }
    if (variant.lights && variant.lights !== '—' && variant.lights !== null) {
      variant.items.push({ name: 'Светильники', value: variant.lights, unit: 'шт' });
    }
    if (variant.curtains && variant.curtains !== '—' && variant.curtains !== null) {
      variant.items.push({ name: 'Гардины', value: variant.curtains, unit: 'м' });
    }
    if (isRoom && variant.extras && variant.extras !== '—' && variant.extras !== null) {
      variant.items.push({ name: 'Дополнительно', value: variant.extras, unit: 'шт' });
    }
  }
  
  return `
    <div style="display: grid; gap: 10px; min-width: 0;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; flex-wrap: wrap; gap: 8px;">
        <strong style="font-size: 13px; white-space: nowrap;">Позиции в составе:</strong>
        <button onclick="addVariantItem('${variantId}', '${productType}')" class="save-btn" style="background: #34a853; padding: 4px 10px; font-size: 11px; white-space: nowrap; flex-shrink: 0;">
          ➕ Добавить позицию
        </button>
      </div>
      <div id="variant-items-${variantId}" style="display: grid; gap: 8px; min-width: 0;">
        ${variant.items.map((item, idx) => renderVariantItem(variantId, idx, item, productType)).join('')}
      </div>
    </div>
  `;
}

function renderVariantItem(variantId, itemIndex, item, productType) {
  return `
    <div class="variant-item-row" style="display: grid; grid-template-columns: minmax(100px, 1.5fr) minmax(120px, 2.5fr) minmax(60px, 0.8fr) auto; gap: 8px; align-items: center; padding: 8px; background: #f9f9f9; border-radius: 6px; border: 1px solid #e0e0e0;">
      <input type="text" value="${item.name || ''}" placeholder="Название" 
             onchange="updateVariantItem('${variantId}', ${itemIndex}, 'name', this.value, '${productType}')"
             style="padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; min-width: 0; width: 100%; box-sizing: border-box;">
      <input type="text" value="${item.value || ''}" placeholder="Значение" 
             onchange="updateVariantItem('${variantId}', ${itemIndex}, 'value', this.value, '${productType}')"
             style="padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; min-width: 0; width: 100%; box-sizing: border-box;">
      <select onchange="updateVariantItem('${variantId}', ${itemIndex}, 'unit', this.value, '${productType}')"
              style="padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; min-width: 0; width: 100%; box-sizing: border-box;">
        <option value="шт" ${item.unit === 'шт' ? 'selected' : ''}>шт</option>
        <option value="м" ${item.unit === 'м' ? 'selected' : ''}>м</option>
        <option value="м²" ${item.unit === 'м²' ? 'selected' : ''}>м²</option>
      </select>
      <button onclick="removeVariantItem('${variantId}', ${itemIndex}, '${productType}')" class="delete-btn" style="padding: 4px 8px; font-size: 11px; flex-shrink: 0;"><i class="fas fa-trash"></i></button>
    </div>
  `;
}

function renderApartmentVariant(apartmentId, variantIndex, variant) {
  // Преобразуем старую структуру в новую (для обратной совместимости)
  if (!variant.items || !Array.isArray(variant.items)) {
    variant.items = [];
    if (variant.fabric && variant.fabric !== '—' && variant.fabric !== null) {
      variant.items.push({ name: 'Полотно', value: variant.fabric, unit: 'м²' });
    }
    if (variant.lights && variant.lights !== '—' && variant.lights !== null) {
      variant.items.push({ name: 'Светильники', value: variant.lights, unit: 'шт' });
    }
    if (variant.curtains && variant.curtains !== '—' && variant.curtains !== null) {
      variant.items.push({ name: 'Гардины', value: variant.curtains, unit: 'м' });
    }
  }
  
  return `
    <div style="border: 1px solid #ddd; border-radius: 8px; padding: 15px; background: #f9f9f9;">
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
        <strong style="color: ${variant.type === 'comfort' ? 'var(--accent-color)' : 'var(--primary-color)'};">${variant.type === 'basic' ? 'БАЗОВЫЙ' : 'КОМФОРТ'}</strong>
        <button onclick="deleteApartmentVariant(${apartmentId}, ${variantIndex})" class="delete-btn" style="padding: 3px 8px; font-size: 11px;"><i class="fas fa-trash"></i></button>
      </div>
      <div style="margin-bottom: 10px;">
        <label style="font-size: 12px; color: #666; display: block; margin-bottom: 5px;">Площадь:</label>
        <input type="text" value="${variant.area || ''}" onchange="updateApartmentVariantField(${apartmentId}, ${variantIndex}, 'area', this.value)" 
               style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
      </div>
      ${renderVariantEditor(apartmentId, variantIndex, variant, 'apartment')}
    </div>
  `;
}

// Функции обновления полей
window.updateRoomField = function(roomId, field, value) {
  if (!currentProductsData || !currentProductsData.rooms) return;
  const room = currentProductsData.rooms.find(r => r.id === roomId);
  if (room) {
    if (field === 'note' && value === '') {
      room.note = null;
    } else {
      room[field] = value;
    }
  }
};

window.updateApartmentField = function(apartmentId, field, value) {
  if (!currentProductsData || !currentProductsData.apartments) return;
  const apartment = currentProductsData.apartments.find(a => a.id === apartmentId);
  if (apartment) {
    if (field === 'note' && value === '') {
      apartment.note = null;
    } else {
      apartment[field] = value;
    }
  }
};

window.updateVariantItem = function(variantId, itemIndex, field, value, productType) {
  if (!currentProductsData) return;
  
  let variant = null;
  if (productType === 'room') {
    const [roomId, variantType] = variantId.split('-');
    const room = currentProductsData.rooms.find(r => r.id === parseInt(roomId));
    if (room && room[variantType]) {
      variant = room[variantType];
    }
  } else if (productType === 'apartment') {
    const [apartmentId, variantIndex] = variantId.split('-');
    const apartment = currentProductsData.apartments.find(a => a.id === parseInt(apartmentId));
    if (apartment && apartment.variants[parseInt(variantIndex)]) {
      variant = apartment.variants[parseInt(variantIndex)];
    }
  }
  
  if (variant && variant.items && variant.items[itemIndex]) {
    variant.items[itemIndex][field] = value;
  }
};

window.addVariantItem = function(variantId, productType) {
  if (!currentProductsData) return;
  
  let variant = null;
  if (productType === 'room') {
    const [roomId, variantType] = variantId.split('-');
    const room = currentProductsData.rooms.find(r => r.id === parseInt(roomId));
    if (room && room[variantType]) {
      variant = room[variantType];
    }
  } else if (productType === 'apartment') {
    const [apartmentId, variantIndex] = variantId.split('-');
    const apartment = currentProductsData.apartments.find(a => a.id === parseInt(apartmentId));
    if (apartment && apartment.variants[parseInt(variantIndex)]) {
      variant = apartment.variants[parseInt(variantIndex)];
    }
  }
  
  if (variant) {
    if (!variant.items) variant.items = [];
    variant.items.push({ name: 'Новая позиция', value: '', unit: 'шт' });
    renderProducts();
  }
};

window.removeVariantItem = function(variantId, itemIndex, productType) {
  if (!confirm("Вы уверены, что хотите удалить эту позицию?")) return;
  if (!currentProductsData) return;
  
  let variant = null;
  if (productType === 'room') {
    const [roomId, variantType] = variantId.split('-');
    const room = currentProductsData.rooms.find(r => r.id === parseInt(roomId));
    if (room && room[variantType]) {
      variant = room[variantType];
    }
  } else if (productType === 'apartment') {
    const [apartmentId, variantIndex] = variantId.split('-');
    const apartment = currentProductsData.apartments.find(a => a.id === parseInt(apartmentId));
    if (apartment && apartment.variants[parseInt(variantIndex)]) {
      variant = apartment.variants[parseInt(variantIndex)];
    }
  }
  
  if (variant && variant.items && variant.items[itemIndex]) {
    variant.items.splice(itemIndex, 1);
    renderProducts();
  }
};

window.updateApartmentVariantField = function(apartmentId, variantIndex, field, value) {
  if (!currentProductsData || !currentProductsData.apartments) return;
  const apartment = currentProductsData.apartments.find(a => a.id === apartmentId);
  if (apartment && apartment.variants[variantIndex]) {
    apartment.variants[variantIndex][field] = value;
  }
};

// Функции добавления/удаления
window.addNewRoom = function() {
  if (!currentProductsData) currentProductsData = { rooms: [], apartments: [] };
  if (!currentProductsData.rooms) currentProductsData.rooms = [];
  
  const newId = currentProductsData.rooms.length > 0 
    ? Math.max(...currentProductsData.rooms.map(r => r.id)) + 1 
    : 1;
  
  const newRoom = {
    id: newId,
    title: "Новая комната",
    area: "до 10 м²",
    note: null,
    basic: {
      items: [
        { name: "Полотно", value: "MSD Standard", unit: "м²" },
        { name: "Светильники", value: "4x GX53", unit: "шт" }
      ]
    },
    comfort: {
      items: [
        { name: "Полотно", value: "BAUF 205", unit: "м²" },
        { name: "Светильники", value: "6x IN HOME RLP VC", unit: "шт" }
      ]
    }
  };
  
  currentProductsData.rooms.push(newRoom);
  renderRooms();
};

window.addNewApartment = function() {
  if (!currentProductsData) currentProductsData = { rooms: [], apartments: [] };
  if (!currentProductsData.apartments) currentProductsData.apartments = [];
  
  const newId = currentProductsData.apartments.length > 0 
    ? Math.max(...currentProductsData.apartments.map(a => a.id)) + 1 
    : (currentProductsData.rooms.length > 0 ? Math.max(...currentProductsData.rooms.map(r => r.id)) + 1 : 1);
  
  const newApartment = {
    id: newId,
    title: "Новая квартира",
    area: "до 40 м² | до 50 м²",
    note: null,
    variants: [
      {
        type: "basic",
        area: "до 40 м²",
        items: [
          { name: "Полотно", value: "MSD Standard", unit: "м²" },
          { name: "Светильники", value: "21x GX53", unit: "шт" },
          { name: "Гардины", value: "2x на потолок", unit: "м" }
        ]
      },
      {
        type: "comfort",
        area: "до 40 м²",
        items: [
          { name: "Полотно", value: "BAUF 205", unit: "м²" },
          { name: "Светильники", value: "24x IN HOME RLP VC", unit: "шт" },
          { name: "Гардины", value: "2x скрытые", unit: "м" }
        ]
      }
    ]
  };
  
  currentProductsData.apartments.push(newApartment);
  renderApartments();
};

window.deleteRoom = async function(roomId) {
  if (!confirm("Вы уверены, что хотите удалить эту комнату?")) return;
  if (!currentProductsData || !currentProductsData.rooms) return;
  currentProductsData.rooms = currentProductsData.rooms.filter(r => r.id !== roomId);
  renderRooms();
  // Автоматически сохраняем изменения на сервер
  await saveProducts();
};

window.deleteApartment = async function(apartmentId) {
  if (!confirm("Вы уверены, что хотите удалить эту квартиру?")) return;
  if (!currentProductsData || !currentProductsData.apartments) return;
  currentProductsData.apartments = currentProductsData.apartments.filter(a => a.id !== apartmentId);
  renderApartments();
  // Автоматически сохраняем изменения на сервер
  await saveProducts();
};


window.deleteApartmentVariant = function(apartmentId, variantIndex) {
  if (!confirm("Вы уверены, что хотите удалить этот вариант?")) return;
  if (!currentProductsData || !currentProductsData.apartments) return;
  const apartment = currentProductsData.apartments.find(a => a.id === apartmentId);
  if (apartment && apartment.variants[variantIndex]) {
    apartment.variants.splice(variantIndex, 1);
    renderApartments();
  }
};

window.loadProducts = loadProducts;
window.saveProducts = saveProducts;

// Обработчик изменения размера окна для адаптивности
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    // Перерисовываем таблицы при изменении размера
    const leadsTable = document.querySelector(".table-container");
    if (leadsTable && leadsTable.style.display !== "none") {
      loadRequests();
    }
    const contractsTab = document.getElementById("contracts-tab");
    if (contractsTab && contractsTab.style.display !== "none") {
      loadContracts();
    }
  }, 250);
});

// Инициализация
checkAuth();