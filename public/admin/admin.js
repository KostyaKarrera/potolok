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

  requests.forEach(req => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${req.id}</td>
      <td>${req.name}</td>
      <td>${req.phone}</td>
      <td>${req.type || "-"}</td>
      <td>
        <input type="number" 
               id="estimated-${req.id}" 
               value="${req.estimatedPrice || ""}" 
               placeholder="0"
               min="0"
               style="width:120px;padding:6px;border:1px solid #ddd;border-radius:6px;">
      </td>
      <td class="partner-info">
        ${req.partnerName ? `<strong>${req.partnerName}</strong><br><small>${req.partnerPromo}</small>` : "-"}
      </td>
      <td>
        <span class="status-badge status-${req.status || "новая"}">${req.status || "новая"}</span>
      </td>
      <td>
        <input type="number" 
               id="amount-${req.id}" 
               value="${req.contractAmount || ""}" 
               placeholder="0"
               min="0"
               style="width:120px;padding:6px;border:1px solid #ddd;border-radius:6px;">
      </td>
      <td>${new Date(req.createdAt).toLocaleDateString("ru-RU")}</td>
      <td>
        <div class="edit-form">
          <select id="status-${req.id}" style="width:140px;padding:6px;border:1px solid #ddd;border-radius:6px;">
            <option value="новая" ${req.status === "новая" ? "selected" : ""}>Новая</option>
            <option value="в_работе" ${req.status === "в_работе" ? "selected" : ""}>В работе</option>
            <option value="закрыта" ${req.status === "закрыта" ? "selected" : ""}>Закрыта</option>
            <option value="отменена" ${req.status === "отменена" ? "selected" : ""}>Отменена</option>
          </select>
          <button class="save-btn" onclick="saveRequest(${req.id})">Сохранить</button>
        </div>
      </td>
      <td>
        <button class="delete-btn" onclick="deleteRequest(${req.id})" title="Удалить заявку">🗑️</button>
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
        ratingTab.style.display = "none";
        clicksTab.style.display = "none";
      } else if (tab === "contracts-tab") {
        leadsTable.style.display = "none";
        stats.style.display = "none";
        contractsTab.style.display = "";
        partnersTab.style.display = "none";
        ratingTab.style.display = "none";
        clicksTab.style.display = "none";
      } else if (tab === "partners-tab") {
        leadsTable.style.display = "none";
        stats.style.display = "none";
        contractsTab.style.display = "none";
        partnersTab.style.display = "";
        ratingTab.style.display = "none";
        clicksTab.style.display = "none";
        loadPartnersList();
      } else if (tab === "rating-tab") { // ДОБАВЛЕНО
        leadsTable.style.display = "none";
        stats.style.display = "none";
        contractsTab.style.display = "none";
        partnersTab.style.display = "none";
        ratingTab.style.display = "";
        clicksTab.style.display = "none";
        loadCurrentRating(); // Загружаем текущие данные
      } else if (tab === "clicks-tab") {
        leadsTable.style.display = "none";
        stats.style.display = "none";
        contractsTab.style.display = "none";
        partnersTab.style.display = "none";
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

  contracts.forEach(c => {
    const tr = document.createElement("tr");
    const photosHtml = (c.photos || [])
      .map(src => `<a href="${src}" target="_blank"><img src="${src}" alt="" style="width:48px;height:48px;object-fit:cover;border-radius:4px;border:1px solid #eee;margin-right:4px;"></a>`)
      .join("");
    tr.innerHTML = `
      <td>${c.id}</td>
      <td>${c.name}</td>
      <td>${c.phone}</td>
      <td>${c.address || "-"}</td>
      <td>${c.contractAmount || "-"}</td>
      <td>${c.contractDate ? new Date(c.contractDate).toLocaleDateString("ru-RU") : "-"}</td>
      <td>${c.installDate ? new Date(c.installDate).toLocaleDateString("ru-RU") : "-"}</td>
      <td>${c.prepayment || "-"}</td>
      <td class="partner-info">${c.partnerName ? `<strong>${c.partnerName}</strong><br><small>${c.partnerPromo}</small>` : "-"}</td>
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

// Глобальные функции для кнопок
window.loadCurrentRating = loadCurrentRating;
window.updateGoogleRating = updateGoogleRating;
window.loadPhoneClicks = loadPhoneClicks;

// Инициализация
checkAuth();