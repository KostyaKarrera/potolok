const API = "/api/admin";
let adminToken = null;
let currentTab = "leads-tab";

// Проверка авторизации
function checkAuth() {
  const token = localStorage.getItem("adminToken");
  if (token) {
    adminToken = token;
    showAdminPanel();
  }
}

// Показать админ-панель
function showAdminPanel() {
  document.getElementById("login-container").style.display = "none";
  document.getElementById("admin-container").style.display = "block";
  initTabs();
  loadRequests();
  loadContracts();
  initRatingForm();
  loadPhoneClicks();
  optimizeForMobile();
}

// Вход
document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const password = document.getElementById("admin-password").value;
  const errorEl = document.getElementById("login-error");
  const submitBtn = e.target.querySelector('button[type="submit"]');

  submitBtn.disabled = true;
  submitBtn.textContent = "Вход...";

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
      showAdminPanel();
    } else {
      errorEl.textContent = data.message || "Ошибка входа";
    }
  } catch (err) {
    errorEl.textContent = "Ошибка подключения к серверу";
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Войти";
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

// Оптимизация для мобильных
function optimizeForMobile() {
  // Добавляем класс для мобильных устройств
  if (window.innerWidth <= 768) {
    document.body.classList.add('mobile-view');
  }

  // Обработчик изменения ориентации
  window.addEventListener('resize', debounce(() => {
    if (window.innerWidth <= 768) {
      document.body.classList.add('mobile-view');
    } else {
      document.body.classList.remove('mobile-view');
    }
    optimizeTablesForMobile();
  }, 250));
}

// Дебаунс для оптимизации
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Оптимизация таблиц для мобильных
function optimizeTablesForMobile() {
  if (window.innerWidth > 768) {
    // На больших экранах показываем все колонки
    document.querySelectorAll('.mobile-hidden').forEach(el => {
      el.style.display = '';
    });
    return;
  }

  // На мобильных скрываем менее важные колонки
  const tables = document.querySelectorAll('table');
  tables.forEach(table => {
    const headers = table.querySelectorAll('th');
    headers.forEach((header, index) => {
      const headerText = header.textContent.toLowerCase();
      const isImportant = headerText.includes('имя') || 
                         headerText.includes('телефон') || 
                         headerText.includes('статус') ||
                         headerText.includes('действия') ||
                         headerText.includes('удалить');

      if (!isImportant) {
        header.style.display = 'none';
        const cells = table.querySelectorAll(`td:nth-child(${index + 1})`);
        cells.forEach(cell => cell.style.display = 'none');
      } else {
        header.style.display = '';
        const cells = table.querySelectorAll(`td:nth-child(${index + 1})`);
        cells.forEach(cell => cell.style.display = '');
      }
    });
  });
}

// Загрузка заявок
async function loadRequests() {
  showLoading('requests-table');
  
  try {
    const res = await fetch(`${API}/requests`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    const data = await res.json();
    if (data.status === "success") {
      renderRequests(data.requests);
      updateStats(data.requests);
      optimizeTablesForMobile();
    } else {
      if (data.message === "Неверный токен") {
        handleAuthError();
      } else {
        showError('requests-table', data.message);
      }
    }
  } catch (err) {
    console.error("Ошибка загрузки заявок:", err);
    showError('requests-table', "Ошибка подключения");
  }
}

// Показать загрузку
function showLoading(tableId) {
  const tbody = document.querySelector(`#${tableId} tbody`);
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;padding:20px;">⏳ Загрузка...</td></tr>`;
  }
}

// Показать ошибку
function showError(tableId, message) {
  const tbody = document.querySelector(`#${tableId} tbody`);
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;padding:20px;color:#e74c3c;">❌ ${message}</td></tr>`;
  }
}

// Обработка ошибки авторизации
function handleAuthError() {
  localStorage.removeItem("adminToken");
  showNotification("Сессия истекла. Войдите снова.", "error");
  setTimeout(() => location.reload(), 2000);
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
    tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;padding:40px;">📝 Заявок пока нет</td></tr>`;
    return;
  }

  requests.forEach(req => {
    const tr = document.createElement("tr");
    const isMobile = window.innerWidth <= 768;
    
    tr.innerHTML = `
      <td>${req.id}</td>
      <td><strong>${req.name}</strong></td>
      <td>${formatPhone(req.phone)}</td>
      <td class="mobile-hidden">${req.type || "-"}</td>
      <td class="mobile-hidden">
        <input type="number" 
               id="estimated-${req.id}" 
               value="${req.estimatedPrice || ""}" 
               placeholder="0"
               min="0"
               class="number-input">
      </td>
      <td class="partner-info mobile-hidden">
        ${req.partnerName ? `<strong>${req.partnerName}</strong><br><small>${req.partnerPromo}</small>` : "-"}
      </td>
      <td>
        <span class="status-badge status-${req.status || "новая"}">${getStatusText(req.status)}</span>
      </td>
      <td class="mobile-hidden">
        <input type="number" 
               id="amount-${req.id}" 
               value="${req.contractAmount || ""}" 
               placeholder="0"
               min="0"
               class="number-input">
      </td>
      <td class="mobile-hidden">${new Date(req.createdAt).toLocaleDateString("ru-RU")}</td>
      <td>
        <div class="edit-form">
          <select id="status-${req.id}" class="status-select">
            <option value="новая" ${req.status === "новая" ? "selected" : ""}>Новая</option>
            <option value="в_работе" ${req.status === "в_работе" ? "selected" : ""}>В работе</option>
            <option value="закрыта" ${req.status === "закрыта" ? "selected" : ""}>Закрыта</option>
            <option value="отменена" ${req.status === "отменена" ? "selected" : ""}>Отменена</option>
          </select>
          <button class="save-btn mobile-wide" onclick="saveRequest(${req.id})">💾</button>
        </div>
      </td>
      <td>
        <button class="delete-btn" onclick="deleteRequest(${req.id})" title="Удалить заявку">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Форматирование телефона
function formatPhone(phone) {
  if (!phone) return '-';
  return phone.replace(/^7(\d{3})(\d{3})(\d{2})(\d{2})$/, '+7 $1 $2-$3-$4');
}

// Текст статуса для мобильных
function getStatusText(status) {
  if (window.innerWidth <= 768) {
    const statusMap = {
      'новая': '🆕',
      'в_работе': '⚡',
      'закрыта': '✅',
      'отменена': '❌'
    };
    return statusMap[status] || status;
  }
  return status;
}

// Сохранение заявки
async function saveRequest(id) {
  const estimatedInput = document.getElementById(`estimated-${id}`);
  const amountInput = document.getElementById(`amount-${id}`);
  const statusSelect = document.getElementById(`status-${id}`);
  const saveBtn = statusSelect.parentElement.querySelector('.save-btn');

  const estimatedPrice = estimatedInput?.value ? parseInt(estimatedInput.value) : null;
  const contractAmount = amountInput?.value ? parseInt(amountInput.value) : null;
  const status = statusSelect.value;

  const originalText = saveBtn.innerHTML;
  saveBtn.disabled = true;
  saveBtn.innerHTML = "⏳";

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
      saveBtn.innerHTML = "✅";
      saveBtn.style.background = "#27ae60";
      showNotification("Заявка обновлена", "success");
      
      setTimeout(() => {
        saveBtn.innerHTML = originalText;
        saveBtn.style.background = "";
        saveBtn.disabled = false;
      }, 1500);
      
      loadRequests();
    } else {
      throw new Error(data.message);
    }
  } catch (err) {
    saveBtn.innerHTML = "❌";
    saveBtn.style.background = "#e74c3c";
    showNotification("Ошибка сохранения: " + err.message, "error");
    
    setTimeout(() => {
      saveBtn.innerHTML = originalText;
      saveBtn.style.background = "";
      saveBtn.disabled = false;
    }, 2000);
  }
}

// Удаление заявки
async function deleteRequest(id) {
  if (!confirm("Вы уверены, что хотите удалить эту заявку?\nЭто действие нельзя отменить.")) {
    return;
  }

  const deleteBtn = event.target;
  const originalHTML = deleteBtn.innerHTML;
  deleteBtn.innerHTML = "⏳";
  deleteBtn.disabled = true;

  try {
    const res = await fetch(`${API}/requests/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${adminToken}`
      }
    });

    const data = await res.json();
    if (data.status === "success") {
      showNotification("Заявка удалена", "success");
      loadRequests();
    } else {
      throw new Error(data.message);
    }
  } catch (err) {
    showNotification("Ошибка удаления: " + err.message, "error");
    deleteBtn.innerHTML = originalHTML;
    deleteBtn.disabled = false;
  }
}

// Загрузка кликов по телефону
async function loadPhoneClicks() {
  const body = document.getElementById("clicks-table-body");

  body.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:20px;">⏳ Загрузка...</td></tr>`;

  try {
    const res = await fetch("/api/admin/phone-clicks", {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    const data = await res.json();
    if (data.status !== "success") {
      throw new Error(data.message);
    }

    const rows = data.stats;

    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:20px;">📊 Нет данных о кликах</td></tr>`;
      return;
    }

    body.innerHTML = "";
    rows.forEach(r => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td><strong>${formatPhone(r.phone)}</strong></td>
        <td><span class="click-count">${r.total}</span></td>
        <td class="mobile-hidden">${new Date(r.firstClick).toLocaleString("ru-RU")}</td>
        <td class="mobile-hidden">${new Date(r.lastClick).toLocaleString("ru-RU")}</td>
      `;
      body.appendChild(row);
    });
    
    optimizeTablesForMobile();
  } catch (err) {
    body.innerHTML = `<tr><td colspan="4" style="text-align:center;color:red;padding:20px;">❌ Ошибка загрузки</td></tr>`;
  }
}

// Всплывающее уведомление
function showNotification(message, type = "info") {
  // Удаляем старое уведомление если есть
  const oldNotification = document.getElementById("admin-notification");
  if (oldNotification) {
    oldNotification.remove();
  }

  const notification = document.createElement("div");
  notification.id = "admin-notification";
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    left: 20px;
    padding: 15px 20px;
    border-radius: 8px;
    color: white;
    font-weight: 500;
    z-index: 10000;
    transition: all 0.3s ease;
    max-width: 400px;
    margin: 0 auto;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    transform: translateY(-20px);
    opacity: 0;
  `;

  const colors = {
    success: "#27ae60",
    error: "#e74c3c",
    info: "#3498db"
  };

  notification.style.background = colors[type] || colors.info;
  notification.textContent = message;
  document.body.appendChild(notification);

  // Анимация появления
  setTimeout(() => {
    notification.style.transform = "translateY(0)";
    notification.style.opacity = "1";
  }, 100);

  // Авто-скрытие
  setTimeout(() => {
    notification.style.transform = "translateY(-20px)";
    notification.style.opacity = "0";
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 300);
  }, 3000);
}

// ====== ВКЛАДКИ ======
function initTabs() {
  const btns = document.querySelectorAll(".tab-btn");
  const leadsTable = document.querySelector(".table-container");
  const contractsTab = document.getElementById("contracts-tab");
  const partnersTab = document.getElementById("partners-tab");
  const ratingTab = document.getElementById("rating-tab");
  const stats = document.querySelector(".stats");
  const clicksTab = document.getElementById("clicks-tab");

  btns.forEach(btn => {
    btn.addEventListener("click", () => {
      currentTab = btn.dataset.tab;
      btns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      
      // Скрываем все вкладки
      leadsTable.style.display = "none";
      stats.style.display = "none";
      contractsTab.style.display = "none";
      partnersTab.style.display = "none";
      ratingTab.style.display = "none";
      clicksTab.style.display = "none";

      // Показываем активную вкладку
      switch(currentTab) {
        case "leads-tab":
          leadsTable.style.display = "";
          stats.style.display = "";
          loadRequests();
          break;
        case "contracts-tab":
          contractsTab.style.display = "";
          loadContracts();
          break;
        case "partners-tab":
          partnersTab.style.display = "";
          loadPartnersList();
          break;
        case "rating-tab":
          ratingTab.style.display = "";
          loadCurrentRating();
          break;
        case "clicks-tab":
          clicksTab.style.display = "";
          loadPhoneClicks();
          break;
      }
      
      optimizeTablesForMobile();
    });
  });

  // Превью фото
  const photosInput = document.getElementById("contract-photos");
  const preview = document.getElementById("photos-preview");
  if (photosInput) {
    photosInput.addEventListener("change", () => {
      preview.innerHTML = "";
      Array.from(photosInput.files || []).forEach(file => {
        if (file.type.startsWith('image/')) {
          const url = URL.createObjectURL(file);
          const img = document.createElement("img");
          img.src = url;
          preview.appendChild(img);
        }
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
      submitBtn.textContent = "⏳ Сохранение...";

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
          formMsg.textContent = "✅ Договор сохранен";
          contractForm.reset();
          preview.innerHTML = "";
          loadContracts();
        } else {
          throw new Error(data.message);
        }
      } catch (err) {
        formMsg.style.color = "#e74c3c";
        formMsg.textContent = "❌ " + (err.message || "Ошибка сохранения");
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "💾 Сохранить договор";
      }
    });
  }
}

// ====== КОНТРАКТЫ ======
async function loadContracts() {
  showLoading('contracts-table');
  
  try {
    const res = await fetch(`${API}/contracts`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const data = await res.json();
    if (data.status === "success") {
      renderContracts(data.contracts);
      optimizeTablesForMobile();
    } else {
      throw new Error(data.message);
    }
  } catch (err) {
    console.error("Ошибка загрузки контрактов:", err);
    showError('contracts-table', "Ошибка загрузки");
  }
}

function renderContracts(contracts) {
  const tbody = document.querySelector("#contracts-table tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  
  if (!contracts || contracts.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;padding:40px;">📄 Договоров пока нет</td></tr>`;
    return;
  }

  contracts.forEach(c => {
    const tr = document.createElement("tr");
    const photosHtml = (c.photos || [])
      .map(src => `<a href="${src}" target="_blank" title="Увеличить"><img src="${src}" alt="Фото договора" class="contract-photo"></a>`)
      .join("");
    
    tr.innerHTML = `
      <td>${c.id}</td>
      <td><strong>${c.name}</strong></td>
      <td>${formatPhone(c.phone)}</td>
      <td class="mobile-hidden">${c.address || "-"}</td>
      <td class="mobile-hidden">${c.contractAmount ? `${c.contractAmount} ₽` : "-"}</td>
      <td class="mobile-hidden">${c.contractDate ? new Date(c.contractDate).toLocaleDateString("ru-RU") : "-"}</td>
      <td class="mobile-hidden">${c.installDate ? new Date(c.installDate).toLocaleDateString("ru-RU") : "-"}</td>
      <td class="mobile-hidden">${c.prepayment ? `${c.prepayment} ₽` : "-"}</td>
      <td class="partner-info mobile-hidden">${c.partnerName ? `<strong>${c.partnerName}</strong><br><small>${c.partnerPromo}</small>` : "-"}</td>
      <td>${photosHtml || "-"}</td>
      <td>
        <button class="delete-btn" onclick="deleteContract(${c.id})" title="Удалить договор">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Удаление договора
async function deleteContract(id) {
  if (!confirm("Вы уверены, что хотите удалить этот договор?\nЭто действие нельзя отменить.")) {
    return;
  }

  const deleteBtn = event.target;
  const originalHTML = deleteBtn.innerHTML;
  deleteBtn.innerHTML = "⏳";
  deleteBtn.disabled = true;

  try {
    const res = await fetch(`${API}/contracts/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${adminToken}`
      }
    });

    const data = await res.json();
    if (data.status === "success") {
      showNotification("Договор удален", "success");
      loadContracts();
    } else {
      throw new Error(data.message);
    }
  } catch (err) {
    showNotification("Ошибка удаления: " + err.message, "error");
    deleteBtn.innerHTML = originalHTML;
    deleteBtn.disabled = false;
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
  showLoading('partners-table');
  
  try {
    const res = await fetch(`${API}/partners`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const data = await res.json();
    if (data.status === "success") {
      renderPartnersList(data.partners);
      optimizeTablesForMobile();
    } else {
      throw new Error(data.message);
    }
  } catch (err) {
    console.error("Ошибка загрузки списка партнёров:", err);
    showError('partners-table', "Ошибка загрузки");
  }
}

function renderPartnersList(partners) {
  const tbody = document.querySelector("#partners-table tbody");
  if (!tbody) return;
  
  tbody.innerHTML = "";
  if (!partners || partners.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;">👥 Партнёров пока нет</td></tr>`;
    return;
  }

  partners.forEach(p => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${p.id}</td>
      <td><strong>${p.name}</strong></td>
      <td>${formatPhone(p.phone)}</td>
      <td><code>${p.promo}</code></td>
      <td class="mobile-hidden">${new Date(p.createdAt).toLocaleDateString("ru-RU")}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ====== GOOGLE RATING MANAGEMENT ======
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
    showNotification('Ошибка загрузки рейтинга', 'error');
  }
}

function updateCurrentRatingDisplay(rating, reviewsCount) {
  const ratingValue = document.getElementById('current-rating-value');
  const reviewsCountEl = document.getElementById('current-reviews-count');
  
  if (ratingValue) ratingValue.textContent = rating;
  if (reviewsCountEl) {
    const reviewsWord = getReviewsWord(reviewsCount);
    reviewsCountEl.textContent = `${reviewsCount} ${reviewsWord}`;
  }
}

function getReviewsWord(count) {
  if (count % 10 === 1 && count % 100 !== 11) return 'отзыв';
  if (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20)) return 'отзыва';
  return 'отзывов';
}

async function updateGoogleRating() {
  const rating = parseFloat(document.getElementById('google-rating').value);
  const reviews = parseInt(document.getElementById('google-reviews').value);
  const messageEl = document.getElementById('rating-form-msg');
  const submitBtn = document.querySelector('#rating-form .save-btn');
  
  if (!rating || rating < 0 || rating > 5) {
    messageEl.textContent = '❌ Рейтинг должен быть от 0.0 до 5.0';
    messageEl.style.color = '#e74c3c';
    return;
  }
  
  const originalText = submitBtn.innerHTML;
  submitBtn.innerHTML = "⏳ Сохранение...";
  submitBtn.disabled = true;

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
      showNotification('Рейтинг Google обновлен', 'success');
    } else {
      throw new Error(data.message);
    }
  } catch (error) {
    messageEl.textContent = '❌ Ошибка: ' + error.message;
    messageEl.style.color = '#e74c3c';
  } finally {
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;
  }
}

function initRatingForm() {
  const ratingForm = document.getElementById('rating-form');
  if (ratingForm) {
    ratingForm.addEventListener('submit', function(e) {
      e.preventDefault();
      updateGoogleRating();
    });
  }
}

// Глобальные функции для кнопок
window.loadCurrentRating = loadCurrentRating;
window.updateGoogleRating = updateGoogleRating;
window.loadPhoneClicks = loadPhoneClicks;
window.saveRequest = saveRequest;
window.deleteRequest = deleteRequest;
window.deleteContract = deleteContract;

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
  checkAuth();
});