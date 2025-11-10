const API = "/api/partners";

// ======== REGISTRATION / LOGIN ========
if (document.querySelector("#register-form")) {
  const regForm = document.getElementById("register-form");
  const loginForm = document.getElementById("login-form");
  const msg = document.getElementById("auth-message");

  const tabRegister = document.getElementById("tab-register");
  const tabLogin = document.getElementById("tab-login");
  const registerBtn = regForm.querySelector("button[type='submit']");
  const loginBtn = loginForm.querySelector("button[type='submit']");

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

  regForm.onsubmit = async (e) => {
    e.preventDefault();
    const name = document.getElementById("reg-name").value.trim();
    const password = document.getElementById("reg-password").value;

    setMessage(null, "Создаём кабинет...");
    registerBtn.disabled = true;

    try {
      const res = await fetch(`${API}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, password }),
      });

      const data = await res.json();
      if (data.status === "success") {
        setMessage("success", "Кабинет готов! Перенаправляем...");
        localStorage.setItem("partnerToken", data.token);
        localStorage.setItem("partnerId", data.partner.id);
        localStorage.setItem("partnerPromo", data.partner.promo);
        localStorage.setItem("partnerName", data.partner.name);
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
    const name = document.getElementById("login-name").value.trim();
    const password = document.getElementById("login-password").value;

    setMessage(null, "Проверяем данные...");
    loginBtn.disabled = true;

    try {
      const res = await fetch(`${API}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, password }),
      });

      const data = await res.json();
      if (data.status === "success") {
        setMessage("success", "Готово! Загружаем кабинет...");
        localStorage.setItem("partnerToken", data.token);
        localStorage.setItem("partnerId", data.partner.id);
        localStorage.setItem("partnerPromo", data.partner.promo);
        localStorage.setItem("partnerName", data.partner.name);
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
  const REFERRAL_PERCENT = 0.05; // 5%

  if (!token) window.location.href = "index.html";

  const promoEl = document.getElementById("promo-code");
  const qrEl = document.getElementById("qr-code");
  const totalEl = document.getElementById("total-earnings");
  const totalRequestsEl = document.getElementById("total-requests");
  const closedRequestsEl = document.getElementById("closed-requests");
  const nameEl = document.getElementById("partner-name");

  if (promoEl) promoEl.textContent = promo;
  if (qrEl) qrEl.src = `/api/ref/${promo}/qrcode`;
  if (nameEl && partnerName) nameEl.textContent = partnerName;

  async function loadRequests() {
    const res = await fetch(`${API}/${partnerId}/requests`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();
    const tbody = document.querySelector("#requests-table tbody");
    tbody.innerHTML = "";
    let total = 0;
    let closedCount = 0;

    if (data.requests && data.requests.length > 0) {
      if (totalRequestsEl) totalRequestsEl.textContent = data.requests.length;
      data.requests.forEach((r) => {
        const tr = document.createElement("tr");
        const earning = (r.status === "закрыта" && r.contractAmount)
          ? Math.floor(Number(r.contractAmount) * REFERRAL_PERCENT)
          : 0;
        if (earning) total += earning;
        if (r.status === "закрыта") closedCount += 1;
        tr.innerHTML = `
          <td>${r.name}</td>
          <td>${r.phone}</td>
          <td>${r.type}</td>
          <td>${r.estimatedPrice || "-"}</td>
          <td>${r.contractAmount != null ? Number(r.contractAmount).toLocaleString('ru-RU') + " ₽" : "-"}</td>
          <td>${new Date(r.createdAt).toLocaleDateString()}</td>
          <td>${r.status || "новая"}</td>
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
