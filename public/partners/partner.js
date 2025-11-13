const API = "/api/partners";

// ======== PHONE MASK ========
function initPhoneMask(inputId) {
  const phoneInput = document.getElementById(inputId);
  if (!phoneInput) return;

  phoneInput.addEventListener('input', function (e) {
    let value = e.target.value.replace(/\D/g, '');
    
    if (value.startsWith('7') || value.startsWith('8')) {
      value = '7' + value.substring(1);
    }
    else if (value.startsWith('9') && value.length <= 10) {
      value = '7' + value;
    }
    else if (value.length === 0) {
      e.target.value = '';
      return;
    }

    let formattedValue = '+7';
    
    if (value.length > 1) {
      formattedValue += ' (' + value.substring(1, 4);
    }
    if (value.length >= 5) {
      formattedValue += ') ' + value.substring(4, 7);
    }
    if (value.length >= 8) {
      formattedValue += '-' + value.substring(7, 9);
    }
    if (value.length >= 10) {
      formattedValue += '-' + value.substring(9, 11);
    }

    e.target.value = formattedValue;
  });

  phoneInput.addEventListener('keydown', function (e) {
    if (e.key === 'Backspace' && phoneInput.value.length <= 4) {
      e.preventDefault();
      phoneInput.value = '';
    }
  });
}

// ======== REGISTRATION / LOGIN ========
if (document.querySelector("#register-form")) {
  const regForm = document.getElementById("register-form");
  const loginForm = document.getElementById("login-form");
  const msg = document.getElementById("auth-message");

  const tabRegister = document.getElementById("tab-register");
  const tabLogin = document.getElementById("tab-login");
  const registerBtn = regForm.querySelector("button[type='submit']");
  const loginBtn = loginForm.querySelector("button[type='submit']");

  // Инициализируем маски для обоих полей телефона
  initPhoneMask('reg-phone');
  initPhoneMask('login-phone');

  function setMessage(type, text) {
    msg.textContent = text || "";
    msg.classList.remove("error", "success");
    if (!text) return;
    msg.classList.add(type === "error" ? "error" : "success");
  }

  tabRegister.onclick = () => {
    tabRegister.classList.add("active");
    tabLogin.classList.remove("active");
    regForm.style.display = "block";
    loginForm.style.display = "none";
    setMessage(null, "");
  };

  tabLogin.onclick = () => {
    tabLogin.classList.add("active");
    tabRegister.classList.remove("active");
    regForm.style.display = "none";
    loginForm.style.display = "block";
    setMessage(null, "");
  };

  // Функция для очистки номера телефона от форматирования
  function cleanPhoneNumber(phone) {
    return phone.replace(/\D/g, '').replace(/^8/, '7').replace(/^7/, '7');
  }

  regForm.onsubmit = async (e) => {
    e.preventDefault();
    const name = document.getElementById("reg-name").value.trim();
    const phone = document.getElementById("reg-phone").value.trim();
    const password = document.getElementById("reg-password").value;

    // Валидация телефона на фронтенде
    const cleanPhone = cleanPhoneNumber(phone);
    if (cleanPhone.length !== 11 || !cleanPhone.startsWith('7')) {
      setMessage("error", "Введите корректный номер телефона");
      return;
    }

    setMessage(null, "Создаём кабинет...");
    registerBtn.disabled = true;

    try {
      const res = await fetch(`${API}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone: cleanPhone, password }),
      });

      const data = await res.json();
      if (data.status === "success") {
        setMessage("success", "Кабинет готов! Перенаправляем...");
        localStorage.setItem("partnerToken", data.token);
        localStorage.setItem("partnerId", data.partner.id);
        localStorage.setItem("partnerPromo", data.partner.promo);
        localStorage.setItem("partnerName", data.partner.name);
        localStorage.setItem("partnerPhone", data.partner.phone);
        setTimeout(() => {
          window.location.href = "dashboard.html";
        }, 600);
      } else {
        setMessage("error", data.message || "Не удалось зарегистрировать партнёра");
        registerBtn.disabled = false;
      }
    } catch (error) {
      setMessage("error", "Сервер недоступен, попробуйте позже");
      registerBtn.disabled = false;
    }
  };

  loginForm.onsubmit = async (e) => {
    e.preventDefault();
    const phone = document.getElementById("login-phone").value.trim();
    const password = document.getElementById("login-password").value;

    // Валидация телефона на фронтенде
    const cleanPhone = cleanPhoneNumber(phone);
    if (cleanPhone.length !== 11 || !cleanPhone.startsWith('7')) {
      setMessage("error", "Введите корректный номер телефона");
      return;
    }

    setMessage(null, "Проверяем данные...");
    loginBtn.disabled = true;

    try {
      const res = await fetch(`${API}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanPhone, password }),
      });

      const data = await res.json();
      if (data.status === "success") {
        setMessage("success", "Готово! Загружаем кабинет...");
        localStorage.setItem("partnerToken", data.token);
        localStorage.setItem("partnerId", data.partner.id);
        localStorage.setItem("partnerPromo", data.partner.promo);
        localStorage.setItem("partnerName", data.partner.name);
        localStorage.setItem("partnerPhone", data.partner.phone);
        window.location.href = "dashboard.html";
      } else {
        setMessage("error", data.message || "Не удалось войти");
        loginBtn.disabled = false;
      }
    } catch (error) {
      setMessage("error", "Сервер недоступен, попробуйте позже");
      loginBtn.disabled = false;
    }
  };
}

// ======== DASHBOARD ========
if (document.querySelector("#requests-table")) {
  const token = localStorage.getItem("partnerToken");
  const partnerId = localStorage.getItem("partnerId");
  const promo = localStorage.getItem("partnerPromo");
  const partnerName = localStorage.getItem("partnerName");
  const partnerPhone = localStorage.getItem("partnerPhone");
  const REFERRAL_PERCENT = 0.05;

  if (!token) window.location.href = "index.html";

  const promoEl = document.getElementById("promo-code");
  const qrEl = document.getElementById("qr-code");
  const totalEl = document.getElementById("total-earnings");
  const totalRequestsEl = document.getElementById("total-requests");
  const closedRequestsEl = document.getElementById("closed-requests");
  const nameEl = document.getElementById("partner-name");
  const phoneEl = document.getElementById("partner-phone");

  if (promoEl) promoEl.textContent = promo;
  if (qrEl) qrEl.src = `/api/ref/${promo}/qrcode`;
  if (nameEl && partnerName) nameEl.textContent = partnerName;
  if (phoneEl && partnerPhone) {
    // Форматируем телефон для отображения
    const formattedPhone = partnerPhone.replace(/^7(\d{3})(\d{3})(\d{2})(\d{2})$/, '+7 ($1) $2-$3-$4');
    phoneEl.textContent = formattedPhone;
  }

  async function loadRequests() {
  const tbody = document.querySelector("#requests-table tbody");
  tbody.innerHTML = "";
  let total = 0;
  let closedCount = 0;

  try {
    // Загружаем заявки из requests
    const requestsRes = await fetch(`${API}/requests`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    
    const requestsData = await requestsRes.json();
    const requests = requestsData.requests || [];

    // Загружаем договоры из contracts
    const contractsRes = await fetch(`${API}/contracts`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    
    const contractsData = await contractsRes.json();
    const contracts = contractsData.contracts || [];

    // Объединяем заявки и договоры
    const allItems = [
      ...requests.map(r => ({ ...r, type: 'lead' })),
      ...contracts.map(c => ({ ...c, type: 'contract' }))
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (allItems.length > 0) {
      if (totalRequestsEl) totalRequestsEl.textContent = allItems.length;
      
      allItems.forEach((item) => {
        const tr = document.createElement("tr");
        
        let earning = 0;
        let status = item.status || (item.type === 'contract' ? 'договор' : 'новая');
        
        // Для договоров и закрытых заявок считаем earnings
        if ((item.status === "закрыта" && item.contractAmount) || item.type === 'contract') {
          const amount = item.contractAmount || item.amount || 0;
          earning = Math.floor(Number(amount) * REFERRAL_PERCENT);
        }
        
        if (item.status === "закрыта" || item.type === 'contract') closedCount += 1;
        if (earning) total += earning;
        
        tr.innerHTML = `
          <td>${item.name}</td>
          <td>${item.phone}</td>
          <td>${item.type === 'contract' ? 'Договор' : (item.type || '-')}</td>
          <td>${item.estimatedPrice || "-"}</td>
          <td>${(item.contractAmount || item.amount) != null ? Number(item.contractAmount || item.amount).toLocaleString('ru-RU') + " ₽" : "-"}</td>
          <td>${new Date(item.createdAt).toLocaleDateString()}</td>
          <td>${status}</td>
          <td data-role="earning">${earning ? earning.toLocaleString('ru-RU') + " ₽" : "-"}</td>
        `;
        tbody.appendChild(tr);
      });
      
      if (totalEl) totalEl.textContent = `${total.toLocaleString('ru-RU')} ₽`;
      if (closedRequestsEl) closedRequestsEl.textContent = closedCount;
    } else {
      tbody.innerHTML = `<tr><td colspan="8">Заявок пока нет</td></tr>`;
      if (totalRequestsEl) totalRequestsEl.textContent = "0";
      if (closedRequestsEl) closedRequestsEl.textContent = "0";
      if (totalEl) totalEl.textContent = `0 ₽`;
    }
  } catch (error) {
    console.error("Ошибка загрузки данных:", error);
    tbody.innerHTML = `<tr><td colspan="8" style="color: red;">Ошибка загрузки данных</td></tr>`;
  }
}

  loadRequests();

  // Копирование промокода и скачивание QR
  const copyBtn = document.getElementById("copy-promo");
  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(promo);
        copyBtn.textContent = "Скопировано!";
        setTimeout(() => (copyBtn.textContent = "Скопировать"), 1800);
      } catch {}
    });
  }
  const dl = document.getElementById("download-qr");
  if (dl) {
    dl.href = `/api/ref/${promo}/qrcode`;
  }

  document.getElementById("logout").onclick = () => {
    localStorage.clear();
    window.location.href = "index.html";
  };
}