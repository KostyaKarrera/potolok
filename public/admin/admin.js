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
  const stats = document.querySelector(".stats");

  btns.forEach(btn => {
    btn.addEventListener("click", () => {
      btns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const tab = btn.dataset.tab;
      if (tab === "leads-tab") {
        leadsTable.style.display = "";
        stats.style.display = "";
        contractsTab.style.display = "none";
      } else {
        leadsTable.style.display = "none";
        stats.style.display = "none";
        contractsTab.style.display = "";
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

// Инициализация
checkAuth();