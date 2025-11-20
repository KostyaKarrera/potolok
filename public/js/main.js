// ==================== MAIN.JS ====================
// Поддержка: маска телефона, модальные окна, калькулятор, Telegram-заявки, lightbox
// + Реферальная система (запоминает ?ref=..., передаёт на сервер)
// =================================================

// ====== 1. Маска телефона ======
window.addEventListener("load", () => {
  if (typeof Inputmask !== "undefined") {
    Inputmask({
      mask: "+7 (999) 999-99-99",
      showMaskOnHover: false,
      clearIncomplete: true
    }).mask(document.querySelectorAll('input[type="tel"]'));
  } else {
    console.error("❌ Inputmask не загрузился!");
  }
});

// ====== 2. Реферальная система ======
function saveReferralCode() {
  const urlParams = new URLSearchParams(window.location.search);
  const ref = urlParams.get("ref");
  if (ref) {
    localStorage.setItem("refCode", ref);
    console.log(`💎 Реферальный код сохранён: ${ref}`);
  }
}
function getReferralCode() {
  return localStorage.getItem("refCode") || null;
}
saveReferralCode();

// ====== 3. Анимация числа ======
function animateNumber(element, start, end, duration) {
  let startTime = null;
  function animation(currentTime) {
    if (!startTime) startTime = currentTime;
    const progress = Math.min((currentTime - startTime) / duration, 1);
    const value = Math.floor(progress * (end - start) + start);
    element.textContent = `Ориентировочная стоимость: ${value.toLocaleString('ru-RU')} ₽`;
    if (progress < 1) requestAnimationFrame(animation);
  }
  requestAnimationFrame(animation);
}

// ====== 4. Отправка заявки на сервер ======
async function sendRequest(name, phone, type, estimatedPrice = null, promo = null) {
  try {
    const API_URL = "/api/request";
    const ref = getReferralCode();

    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, type, estimatedPrice, ref, promo })
    });

    return await res.json();
  } catch (err) {
    console.error("Ошибка отправки запроса:", err);
    return { status: "error", message: "Сервер недоступен" };
  }
}

// ====== 5. Утилита: универсальная обработка форм ======
function handleModalForm({ buttonId, modalId, formId, successId, type }) {
  const btn = document.getElementById(buttonId);
  const modal = document.getElementById(modalId);
  const form = document.getElementById(formId);
  const success = document.getElementById(successId);
  const close = modal.querySelector(".close");

  if (!btn || !modal || !form) return;

  btn.addEventListener("click", () => {
    modal.style.display = "block";
    form.style.display = "block";
    if (success) success.style.display = "none";
  });

  close.addEventListener("click", () => (modal.style.display = "none"));
  window.addEventListener("click", e => { if (e.target === modal) modal.style.display = "none"; });

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const name = form.querySelector('input[placeholder="Ваше имя"]').value.trim();
    const phone = form.querySelector('input[placeholder="Ваш телефон"]').value.trim();
    const promoEl = form.querySelector('input[placeholder="Промокод (если есть)"]');
    const promo = promoEl ? promoEl.value.trim() || null : null;
    if (!name || !phone) return alert("Заполните все поля");

    const result = await sendRequest(name, phone, type, null, promo);
    if (result.status === "success") {
      form.style.display = "none";
      if (success) success.style.display = "block";
    } else {
      alert("Ошибка: " + result.message);
    }
  });
}

// ====== 6. Калькулятор стоимости ======
const calculatorForm = document.getElementById("calculator-form");
const estimateModal = document.getElementById("estimateModal");
const estimateText = document.getElementById("estimateText");
const closeEstimate = estimateModal?.querySelector(".close");
const estimateForm = document.getElementById("estimateForm");
const successMessage = document.getElementById("successMessage");

if (calculatorForm) {
  calculatorForm.addEventListener("submit", e => {
    e.preventDefault();

    const area = Number(calculatorForm.querySelector('input[placeholder*="Площадь"]').value);
    const lamps = Number(calculatorForm.querySelector('input[placeholder*="Светильники"]').value);
    const chandeliers = Number(calculatorForm.querySelector('input[placeholder*="Люстры"]').value);

    if (area < 1) return alert("Введите корректную площадь");

    const price = area * 600 + lamps * 550 + chandeliers * 700;

    estimateModal.style.display = "block";
    successMessage.style.display = "none";
    estimateForm.style.display = "block";

    animateNumber(estimateText, 0, price, 600);
  });

  closeEstimate.addEventListener("click", () => (estimateModal.style.display = "none"));
  window.addEventListener("click", e => { if (e.target === estimateModal) estimateModal.style.display = "none"; });

  estimateForm.addEventListener("submit", async e => {
    e.preventDefault();
    const name = estimateForm.querySelector('input[placeholder="Ваше имя"]').value.trim();
    const phone = estimateForm.querySelector('input[placeholder="Ваш телефон"]').value.trim();
    const promoEl = estimateForm.querySelector('input[placeholder="Промокод (если есть)"]');
    const promo = promoEl ? promoEl.value.trim() || null : null;
    const estimatedPrice = estimateText.textContent.match(/\d+/g)?.join("") || null;
    if (!name || !phone) return alert("Заполните все поля");

    const result = await sendRequest(name, phone, "Калькулятор", estimatedPrice, promo);
    if (result.status === "success") {
      estimateForm.style.display = "none";
      successMessage.style.display = "block";
    } else {
      alert("Ошибка: " + result.message);
    }
  });
}

// ====== 7. Модалки ======
handleModalForm({
  buttonId: "callBtn",
  modalId: "callModal",
  formId: "callForm",
  successId: "callSuccess",
  type: "Заказ звонка"
});

handleModalForm({
  buttonId: "measureBtn",
  modalId: "measureModal",
  formId: "measureForm",
  successId: "measureSuccess",
  type: "Вызов специалиста"
});

// ====== 8. Лайтбокс ======
const lightbox = document.getElementById("lightbox");
if (lightbox) {
  const lightboxImg = document.querySelector(".lightbox-img");
  const lightboxClose = document.querySelector(".lightbox-close");
  const lightboxPrev = document.querySelector(".lightbox-prev");
  const lightboxNext = document.querySelector(".lightbox-next");
  const galleryImages = document.querySelectorAll(".gallery img");
  let currentIndex = 0;

  galleryImages.forEach((img, i) => {
    img.addEventListener("click", () => {
      lightbox.style.display = "flex";
      lightboxImg.src = img.src;
      currentIndex = i;
    });
  });

  lightboxClose.addEventListener("click", () => (lightbox.style.display = "none"));
  lightbox.addEventListener("click", e => { if (e.target === lightbox) lightbox.style.display = "none"; });
  lightboxPrev.addEventListener("click", () => {
    currentIndex = (currentIndex - 1 + galleryImages.length) % galleryImages.length;
    lightboxImg.src = galleryImages[currentIndex].src;
  });
  lightboxNext.addEventListener("click", () => {
    currentIndex = (currentIndex + 1) % galleryImages.length;
    lightboxImg.src = galleryImages[currentIndex].src;
  });
}
// ====== GOOGLE RATING ======

// Загрузка реального рейтинга
async function loadGoogleRating() {
  try {
    const response = await fetch('/api/google-rating');
    const data = await response.json();
    
    if (data.status === 'success') {
      // Обновляем рейтинг
      const ratingValue = document.getElementById('rating-value');
      const reviewsCount = document.getElementById('reviews-count');
      const companyName = document.getElementById('company-name');
      const ratingStars = document.getElementById('rating-stars');
      
      if (ratingValue) ratingValue.textContent = data.rating;
      if (reviewsCount) reviewsCount.textContent = `(${data.reviewsCount} ${getReviewsWord(data.reviewsCount)})`;
      if (companyName) companyName.textContent = data.name;
      if (ratingStars) ratingStars.innerHTML = getStars(data.rating);
    }
  } catch (error) {
    console.error('Ошибка загрузки рейтинга:', error);
  }
}

// Функция для генерации звезд
function getStars(rating) {
  const fullStars = Math.floor(rating);
  const decimal = rating % 1;
  let stars = '';
  
  for (let i = 1; i <= 5; i++) {
    if (i <= fullStars) {
      stars += '★';
    } else if (i === fullStars + 1 && decimal >= 0.5) {
      stars += '★';
    } else {
      stars += '☆';
    }
  }
  
  return stars;
}

// Функция для правильного склонения слова "отзыв"
function getReviewsWord(count) {
  if (count % 10 === 1 && count % 100 !== 11) return 'отзыв';
  if (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20)) return 'отзыва';
  return 'отзывов';
}
// Загружаем рейтинг Google при старте страницы
loadGoogleRating();


//Отслеживаем клики для статистики
document.addEventListener("DOMContentLoaded", () => {
  const phoneLinks = document.querySelectorAll('a[href^="tel:"]');

  phoneLinks.forEach(link => {
    link.addEventListener("click", async () => {
      const phone = link.getAttribute("href").replace("tel:", "");

      try {
        await fetch("/api/phone-click", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone })
        });
        console.log("Клик по телефону отправлен:", phone);
      } catch (err) {
        console.error("Ошибка отправки клика:", err);
      }
    });
  });
});
