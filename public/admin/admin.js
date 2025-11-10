const API = "/api/admin";
let adminToken = null;

// Проверка авторизации
function checkAuth() {
  const token = localStorage.getItem("adminToken");
  if (token) {
    adminToken = token;
    document.getElementById("login-container").style.display = "none";
    document.getElementById("admin-container").style.display = "block";
    loadRequests();
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
      loadRequests();
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

// Рендер таблицы
function renderRequests(requests) {
  const tbody = document.querySelector("#requests-table tbody");
  tbody.innerHTML = "";

  if (requests.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:40px;">Заявок пока нет</td></tr>`;
    return;
  }

  requests.forEach(req => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${req.id}</td>
      <td>${req.name}</td>
      <td>${req.phone}</td>
      <td>${req.type || "-"}</td>
      <td>${req.estimatedPrice ? req.estimatedPrice.toLocaleString("ru-RU") + " ₽" : "-"}</td>
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
    `;
    tbody.appendChild(tr);
  });
}

// Сохранение заявки
async function saveRequest(id) {
  const amountInput = document.getElementById(`amount-${id}`);
  const statusSelect = document.getElementById(`status-${id}`);
  const saveBtn = statusSelect.nextElementSibling;

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
      body: JSON.stringify({ contractAmount, status })
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
      loadRequests(); // Обновить таблицу
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

// Инициализация
checkAuth();

