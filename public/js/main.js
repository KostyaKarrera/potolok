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
async function sendRequest(name, phone, type, estimatedPrice = null, promo = null, giftPromo = false, cartItems = null) {
  try {
    const API_URL = "/api/request";
    const ref = getReferralCode();

    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, type, estimatedPrice, ref, promo, giftPromo, cartItems })
    });

    return await res.json();
  } catch (err) {
    console.error("Ошибка отправки запроса:", err);
    return { status: "error", message: "Сервер недоступен" };
  }
}

// ====== 4.1. Toast уведомления ======
function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => toast.classList.add("show"), 10);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ====== 4.2. Улучшенные модальные окна ======
function showModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = "flex";
    modal.classList.add("show");
    document.body.style.overflow = "hidden";
  }
}

function hideModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove("show");
    setTimeout(() => {
      modal.style.display = "none";
      document.body.style.overflow = "";
    }, 300);
  }
}

// ====== 5. Утилита: универсальная обработка форм ======
function handleModalForm({ buttonId, modalId, formId, successId, type }) {
  const btn = document.getElementById(buttonId);
  const modal = document.getElementById(modalId);
  const form = document.getElementById(formId);
  const success = document.getElementById(successId);
  const close = modal?.querySelector(".close");

  if (!btn || !modal || !form) return;

  btn.addEventListener("click", () => {
    showModal(modalId);
    form.style.display = "block";
    if (success) {
      success.style.display = "none";
      success.style.visibility = "hidden";
    }
  });

  if (close) {
    close.addEventListener("click", () => hideModal(modalId));
  }
  window.addEventListener("click", e => { if (e.target === modal) hideModal(modalId); });

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const name = form.querySelector('input[placeholder="Ваше имя"]').value.trim();
    const phone = form.querySelector('input[placeholder="Ваш телефон"]').value.trim();
    const promoEl = form.querySelector('input[placeholder="Промокод (если есть)"]');
    const promo = promoEl ? promoEl.value.trim() || null : null;
    
    // Проверяем, является ли это заявкой по акции "Подарок"
    const isGiftPromo = form.hasAttribute("data-gift-promo") && form.getAttribute("data-gift-promo") === "true";
    
    // Валидация
    if (!name || !phone) {
      showToast("Заполните все обязательные поля", "error");
      return;
    }
    
    if (phone.length < 10) {
      showToast("Введите корректный номер телефона", "error");
      return;
    }
    
    // Валидация промокода
    if (promo) {
      const validation = await validatePromo(promo);
      if (!validation.valid) {
        showToast(validation.message || "Неверный промокод", "error");
        if (promoEl) {
          promoEl.style.borderColor = "#e74c3c";
          promoEl.focus();
        }
        return;
      }
    }

    const result = await sendRequest(name, phone, type, null, promo, isGiftPromo);
    
    // Удаляем метку акции после отправки
    if (isGiftPromo) {
      form.removeAttribute("data-gift-promo");
    }
    if (result.status === "success") {
      form.reset();
      // Гарантируем, что success сообщение скрыто
      if (success) {
        success.style.display = "none";
        success.style.visibility = "hidden";
      }
      showToast("Заявка успешно отправлена!", "success");
      setTimeout(() => {
        hideModal(modalId);
      }, 500);
    } else {
      showToast("Ошибка: " + result.message, "error");
    }
  });
}

// ====== 6. Модалки ======
handleModalForm({
  buttonId: "callBtn",
  modalId: "callModal",
  formId: "callForm",
  successId: "callSuccess",
  type: "Заказ звонка"
});

// Кнопка "Подобрать готовое решение" - теперь это ссылка, обработчик не нужен
// Если кнопка все еще существует (для обратной совместимости), перенаправляем на новую страницу
document.addEventListener("DOMContentLoaded", () => {
  const solutionsBtn = document.getElementById("solutionsBtn");
  if (solutionsBtn && solutionsBtn.tagName === "BUTTON") {
    solutionsBtn.addEventListener("click", () => {
      window.location.href = "/ready-solutions/";
    });
  }
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


//Отслеживаем клики для статистики (улучшенная версия с делегированием событий)
document.addEventListener("DOMContentLoaded", () => {
  // Используем делегирование событий для отслеживания всех кликов по телефону
  // Это работает даже для динамически добавленных ссылок
  document.addEventListener("click", async (e) => {
    // Проверяем, является ли кликнутый элемент ссылкой на телефон
    const phoneLink = e.target.closest('a[href^="tel:"]');
    
    if (phoneLink) {
      const phone = phoneLink.getAttribute("href").replace("tel:", "");

      try {
        // Отправляем статистику асинхронно, не блокируя переход
        fetch("/api/phone-click", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone })
        }).then(() => {
          console.log("✅ Клик по телефону отправлен:", phone);
        }).catch((err) => {
          console.error("❌ Ошибка отправки клика:", err);
        });
      } catch (err) {
        console.error("❌ Ошибка отправки клика:", err);
      }
    }
  });
  
  // Дополнительно: отслеживаем клики по кнопке телефона в шапке
  const phoneBtn = document.getElementById("phoneBtn");
  if (phoneBtn) {
    phoneBtn.addEventListener("click", async () => {
      const phone = "+79003304656"; // Основной номер телефона
      try {
        fetch("/api/phone-click", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone })
        }).then(() => {
          console.log("✅ Клик по кнопке телефона отправлен:", phone);
        }).catch((err) => {
          console.error("❌ Ошибка отправки клика:", err);
        });
      } catch (err) {
        console.error("❌ Ошибка отправки клика:", err);
      }
    });
  }
});

// ====== 9. Sticky Header при скролле ======
window.addEventListener("scroll", () => {
  const topbar = document.querySelector(".topbar");
  if (window.scrollY > 50) {
    topbar.classList.add("scrolled");
  } else {
    topbar.classList.remove("scrolled");
  }
});

// ====== 10. Smooth Scroll ======
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener("click", function (e) {
    const href = this.getAttribute("href");
    if (href === "#" || !href) return;
    
    e.preventDefault();
    const target = document.querySelector(href);
    if (target) {
      const topbar = document.querySelector(".topbar");
      const topbarHeight = topbar ? topbar.offsetHeight : 80;
      const targetPosition = target.offsetTop - topbarHeight;
      
      window.scrollTo({
        top: targetPosition,
        behavior: "smooth"
      });
      
      // Закрываем мобильное меню после клика
      const hamburger = document.getElementById("hamburger");
      const mainNav = document.getElementById("mainNav");
      if (hamburger && mainNav) {
        hamburger.classList.remove("active");
        mainNav.classList.remove("active");
      }
    }
  });
});

// ====== 11. Навигационное меню (Гамбургер) ======
document.addEventListener("DOMContentLoaded", () => {
  const hamburger = document.getElementById("hamburger");
  const mainNav = document.getElementById("mainNav");
  const navLinks = document.querySelectorAll(".nav-link");
  
  if (hamburger && mainNav) {
    hamburger.addEventListener("click", () => {
      hamburger.classList.toggle("active");
      mainNav.classList.toggle("active");
      document.body.style.overflow = mainNav.classList.contains("active") ? "hidden" : "";
    });
    
    // Закрываем меню при клике на ссылку
    navLinks.forEach(link => {
      link.addEventListener("click", () => {
        hamburger.classList.remove("active");
        mainNav.classList.remove("active");
        document.body.style.overflow = "";
      });
    });
    
    // Закрываем меню при клике вне его
    document.addEventListener("click", (e) => {
      if (!hamburger.contains(e.target) && !mainNav.contains(e.target)) {
        hamburger.classList.remove("active");
        mainNav.classList.remove("active");
        document.body.style.overflow = "";
      }
    });
  }
  
  // Подсветка активного пункта меню при скролле
  const sections = document.querySelectorAll("section[id]");
  const navLinksArray = Array.from(document.querySelectorAll(".nav-link"));
  
  function highlightNav() {
    const scrollPos = window.scrollY + 150;
    
    sections.forEach(section => {
      const sectionTop = section.offsetTop;
      const sectionHeight = section.offsetHeight;
      const sectionId = section.getAttribute("id");
      
      if (scrollPos >= sectionTop && scrollPos < sectionTop + sectionHeight) {
        navLinksArray.forEach(link => {
          link.classList.remove("active");
          if (link.getAttribute("href") === `#${sectionId}`) {
            link.classList.add("active");
          }
        });
      }
    });
  }
  
  window.addEventListener("scroll", highlightNav);
  highlightNav(); // Вызываем сразу для начальной позиции
  
  // Модалка телефона
  const phoneBtn = document.getElementById("phoneBtn");
  const phoneModal = document.getElementById("phoneModal");
  
  if (phoneBtn && phoneModal) {
    phoneBtn.addEventListener("click", () => {
      showModal("phoneModal");
    });
    
    const closePhone = phoneModal.querySelector(".close");
    if (closePhone) {
      closePhone.addEventListener("click", () => hideModal("phoneModal"));
    }
    
    window.addEventListener("click", e => {
      if (e.target === phoneModal) hideModal("phoneModal");
    });
  }
});

// ====== 13. Валидация промокодов ======
async function validatePromo(promo) {
  if (!promo || !promo.trim()) {
    return { valid: true, message: "" }; // Пустой промокод - валиден (необязательное поле)
  }

  try {
    const res = await fetch(`/api/validate-promo/${encodeURIComponent(promo.trim())}`);
    const data = await res.json();
    return {
      valid: data.valid || false,
      message: data.message || ""
    };
  } catch (err) {
    console.error("Ошибка проверки промокода:", err);
    return { valid: false, message: "Ошибка проверки промокода" };
  }
}

// ====== 14. Валидация форм в реальном времени ======
document.addEventListener("DOMContentLoaded", () => {
  const inputs = document.querySelectorAll("input[type='tel'], input[type='text']");
  inputs.forEach(input => {
    // Валидация промокодов
    if (input.placeholder && input.placeholder.includes("Промокод")) {
      let validationTimeout;
      
      input.addEventListener("input", function() {
        clearTimeout(validationTimeout);
        const promo = this.value.trim();
        
        if (!promo) {
          this.style.borderColor = "";
          // Удаляем сообщение об ошибке, если есть
          const errorMsg = this.parentElement.querySelector(".promo-error");
          if (errorMsg) errorMsg.remove();
          return;
        }
        
        // Дебаунс - проверяем через 500ms после окончания ввода
        validationTimeout = setTimeout(async () => {
          const validation = await validatePromo(promo);
          
          if (validation.valid) {
            this.style.borderColor = "var(--success-color)";
            const errorMsg = this.parentElement.querySelector(".promo-error");
            if (errorMsg) errorMsg.remove();
          } else {
            this.style.borderColor = "#e74c3c";
            // Показываем сообщение об ошибке
            let errorMsg = this.parentElement.querySelector(".promo-error");
            if (!errorMsg) {
              errorMsg = document.createElement("div");
              errorMsg.className = "promo-error";
              errorMsg.style.cssText = "color: #e74c3c; font-size: 12px; margin-top: 4px;";
              this.parentElement.appendChild(errorMsg);
            }
            errorMsg.textContent = validation.message;
          }
        }, 500);
      });
      
      input.addEventListener("blur", async function() {
        clearTimeout(validationTimeout);
        const promo = this.value.trim();
        if (promo) {
          const validation = await validatePromo(promo);
          if (!validation.valid) {
            this.style.borderColor = "#e74c3c";
            let errorMsg = this.parentElement.querySelector(".promo-error");
            if (!errorMsg) {
              errorMsg = document.createElement("div");
              errorMsg.className = "promo-error";
              errorMsg.style.cssText = "color: #e74c3c; font-size: 12px; margin-top: 4px;";
              this.parentElement.appendChild(errorMsg);
            }
            errorMsg.textContent = validation.message;
          }
        }
      });
    } else {
      // Обычная валидация для других полей
      input.addEventListener("blur", function() {
        if (this.hasAttribute("required") && !this.value.trim()) {
          this.style.borderColor = "#e74c3c";
        } else if (this.type === "tel" && this.value.length > 0 && this.value.length < 10) {
          this.style.borderColor = "#e74c3c";
        } else if (this.value.trim()) {
          this.style.borderColor = "var(--success-color)";
        }
      });
      
      input.addEventListener("input", function() {
        if (this.style.borderColor === "rgb(231, 76, 60)" && this.value.trim()) {
          this.style.borderColor = "";
        }
      });
    }
  });
});

// ====== 14. Кнопка "Наверх" ======
const scrollTopBtn = document.createElement("button");
scrollTopBtn.innerHTML = "↑";
scrollTopBtn.className = "scroll-top-btn";
scrollTopBtn.setAttribute("aria-label", "Наверх");
document.body.appendChild(scrollTopBtn);

scrollTopBtn.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});

window.addEventListener("scroll", () => {
  if (window.scrollY > 300) {
    scrollTopBtn.classList.add("show");
  } else {
    scrollTopBtn.classList.remove("show");
  }
});

// ====== 15. Плавающая кнопка "Подарок" ======
document.addEventListener("DOMContentLoaded", () => {
  const saleBtn = document.getElementById("saleBtn");
  const saleModal = document.getElementById("saleModal");
  const saleOrderBtn = document.getElementById("saleOrderBtn");
  const saleClose = saleModal?.querySelector(".close");
  
  if (!saleBtn || !saleModal) return;
  
  // Открытие модального окна
  saleBtn.addEventListener("click", () => {
    showModal("saleModal");
  });
  
  // Закрытие модального окна
  if (saleClose) {
    saleClose.addEventListener("click", () => hideModal("saleModal"));
  }
  
  window.addEventListener("click", e => {
    if (e.target === saleModal) hideModal("saleModal");
  });
  
  // Кнопка "Оставить заявку" в модальном окне акции
  if (saleOrderBtn) {
    saleOrderBtn.addEventListener("click", () => {
      hideModal("saleModal");
      // Открываем форму заказа звонка и помечаем её как заявку по акции
      setTimeout(() => {
        const callBtn = document.getElementById("callBtn");
        if (callBtn) {
          // Помечаем форму как заявку по акции
          const callForm = document.getElementById("callForm");
          if (callForm) {
            callForm.setAttribute("data-gift-promo", "true");
          }
          callBtn.click();
        }
      }, 300);
    });
  }
});

// ====== 16. Корзина (Бета) ======
// Данные товаров - готовые решения (по умолчанию пустые, заполняются с сервера)
let productsData = {
  rooms: [],
  apartments: []
};

// Управление корзиной
const Cart = {
  getItems() {
    const cart = localStorage.getItem('cart');
    return cart ? JSON.parse(cart) : [];
  },

  addItem(product) {
    const items = this.getItems();
    // Проверяем, нет ли уже этого товара в корзине
    if (!items.find(item => item.id === product.id)) {
      items.push(product);
      localStorage.setItem('cart', JSON.stringify(items));
      this.updateBadge();
      return true;
    }
    return false;
  },

  removeItem(productId) {
    const items = this.getItems();
    const filtered = items.filter(item => String(item.id) !== String(productId));
    localStorage.setItem('cart', JSON.stringify(filtered));
    this.updateBadge();
    return filtered;
  },

  clear() {
    localStorage.removeItem('cart');
    this.updateBadge();
  },

  updateBadge() {
    const count = this.getItems().length;
    
    // Обновляем бейдж в шапке (мобильная версия)
    const badge = document.getElementById('cartBadge');
    if (badge) {
      badge.textContent = count > 0 ? count : '';
    }
    
    // Обновляем бейдж плавающей кнопки (десктоп)
    const floatingBadge = document.getElementById('floatingCartBadge');
    if (floatingBadge) {
      floatingBadge.textContent = count > 0 ? count : '';
    }
    
    // Скрываем/показываем кнопки корзины
    const cartBtn = document.getElementById('cartBtn');
    const floatingCartBtn = document.getElementById('floatingCartBtn');
    
    if (count > 0) {
      // Показываем кнопки, если есть товары
      if (cartBtn) cartBtn.style.display = 'flex';
      if (floatingCartBtn) {
        floatingCartBtn.classList.remove('hidden');
        // Удаляем inline стиль, чтобы CSS медиа-запрос мог работать
        floatingCartBtn.style.display = '';
      }
    } else {
      // Скрываем кнопки, если корзина пуста
      if (cartBtn) cartBtn.style.display = 'none';
      if (floatingCartBtn) {
        floatingCartBtn.classList.add('hidden');
        floatingCartBtn.style.display = '';
      }
    }
  },

  getItemsCount() {
    return this.getItems().length;
  }
};

// Функция для преобразования обозначений в понятный текст
const formatQuantity = (text) => {
    if (!text || text === '—') return text;
    
    // Обработка светильников: "4x GX53" → "GX53 - 4шт" или "8x IN HOME RLP VC" → "IN HOME RLP VC - 8шт"
    // Сначала обрабатываем "IN HOME RLP VC" (полное название с пробелами)
    text = text.replace(/(\d+)x\s+(IN HOME RLP VC)/g, (match, count, type) => {
      return `${type} - ${count}шт`;
    });
    // Затем обрабатываем GX53
    text = text.replace(/(\d+)x\s+(GX53)/g, (match, count, type) => {
      return `${type} - ${count}шт`;
    });
    
    // Обработка гардин: "2x на потолок" → "На потолок - 2шт"
    text = text.replace(/(\d+)x\s+на\s+потолок/g, (match, count) => {
      return `На потолок - ${count}шт`;
    });
    
    // Обработка скрытых гардин: "2x скрытые" → "Скрытые - 2шт"
    text = text.replace(/(\d+)x\s+скрытые/g, (match, count) => {
      return `Скрытые - ${count}шт`;
    });
    
    return text;
};

// Глобальная переменная для хранения цен
let pricesData = null;

// Функция загрузки цен с сервера
async function loadPrices() {
  try {
    const res = await fetch('/api/prices');
    const data = await res.json();
    if (data.status === 'success' && data.prices) {
      pricesData = data.prices;
      return true;
    }
    return false;
  } catch (err) {
    console.error('Ошибка загрузки цен:', err);
    return false;
  }
}

// Функция извлечения числа из строки (например, "до 14 м²" -> 14)
function extractNumber(str) {
  if (!str) return 0;
  const match = str.match(/(\d+)/);
  return match ? parseInt(match[1]) : 0;
}

// Функция расчета цены для варианта комнаты (возвращает объект с числом и строкой)
function calculateRoomPrice(variant, areaStr, prices) {
  if (!prices || !prices.rooms) return { numeric: 0, formatted: "—" };
  
  const area = extractNumber(areaStr);
  let total = 0;
  
  // Новая структура с items
  if (variant.items && Array.isArray(variant.items)) {
    variant.items.forEach(item => {
      if (!item.value || item.value === '—' || item.value === '') return;
      
      const unit = item.unit || 'шт';
      const itemName = item.name.trim();
      
      // Определяем категорию и ключ для поиска цены
      let category = 'extras';
      let priceKey = itemName;
      
      if (itemName.toLowerCase().includes('полотно') || itemName.toLowerCase().includes('fabric')) {
        category = 'fabric';
        priceKey = item.value.trim();
        if (prices.rooms.fabric && prices.rooms.fabric[priceKey]) {
          total += area * (prices.rooms.fabric[priceKey].pricePerM2 || 0);
        }
      } else if (itemName.toLowerCase().includes('светильник') || itemName.toLowerCase().includes('light')) {
        category = 'lights';
        const match = item.value.match(/(\d+)x\s+(.+)/);
        if (match) {
          const count = parseInt(match[1]);
          priceKey = match[2].trim();
          if (prices.rooms.lights && prices.rooms.lights[priceKey]) {
            total += count * (prices.rooms.lights[priceKey].pricePerUnit || 0);
          }
        }
      } else if (itemName.toLowerCase().includes('гардин') || itemName.toLowerCase().includes('curtain')) {
        category = 'curtains';
        const valueLower = item.value.toLowerCase();
        if (valueLower.includes('на потолок') || valueLower.includes('потолок')) priceKey = 'на потолок';
        else if (valueLower.includes('скрыт')) priceKey = 'скрытые';
        else priceKey = itemName;
        
        // Извлекаем метраж из разных форматов: "до 3 м", "3 м", "2x на потолок" (для квартир)
        let meters = 0;
        const metersMatch1 = item.value.match(/до\s+(\d+)\s*м/i); // "до 3 м" или "до 3м"
        const metersMatch2 = item.value.match(/(\d+)\s*м(?!²)/i); // "3 м" (но не "м²")
        const countMatch = item.value.match(/(\d+)x/); // "2x на потолок"
        
        if (metersMatch1) {
          meters = parseInt(metersMatch1[1]);
        } else if (metersMatch2) {
          meters = parseInt(metersMatch2[1]);
        } else if (countMatch) {
          // Для формата "2x на потолок" умножаем количество на средний метраж (3 м на гардину)
          meters = parseInt(countMatch[1]) * 3;
        } else if (unit === 'м') {
          // Если unit указан как "м", но метраж не найден, используем значение по умолчанию
          meters = 3;
        }
        
        if (meters > 0 && prices.rooms.curtains && prices.rooms.curtains[priceKey]) {
          total += meters * (prices.rooms.curtains[priceKey].pricePerM || 0);
        }
      } else {
        category = 'extras';
        priceKey = itemName;
        if (prices.rooms.extras && prices.rooms.extras[priceKey]) {
          total += prices.rooms.extras[priceKey].pricePerUnit || 0;
        }
      }
    });
  } else {
    // Обратная совместимость со старой структурой
    if (variant.fabric && variant.fabric !== '—' && prices.rooms.fabric && prices.rooms.fabric[variant.fabric]) {
      total += area * (prices.rooms.fabric[variant.fabric].pricePerM2 || 0);
    }
    if (variant.lights && variant.lights !== '—') {
      const lightsMatch = variant.lights.match(/(\d+)x\s+(.+)/);
      if (lightsMatch) {
        const count = parseInt(lightsMatch[1]);
        const lightType = lightsMatch[2].trim();
        if (prices.rooms.lights && prices.rooms.lights[lightType]) {
          total += count * (prices.rooms.lights[lightType].pricePerUnit || 0);
        }
      }
    }
    if (variant.curtains && variant.curtains !== '—') {
      // Извлекаем метраж из разных форматов: "до 3 м", "3 м", "2x на потолок"
      let meters = 0;
      const metersMatch1 = variant.curtains.match(/до\s+(\d+)\s*м/i); // "до 3 м" или "до 3м"
      const metersMatch2 = variant.curtains.match(/(\d+)\s*м(?!²)/i); // "3 м" (но не "м²")
      const countMatch = variant.curtains.match(/(\d+)x/); // "2x на потолок"
      
      if (metersMatch1) {
        meters = parseInt(metersMatch1[1]);
      } else if (metersMatch2) {
        meters = parseInt(metersMatch2[1]);
      } else if (countMatch) {
        // Для формата "2x на потолок" умножаем количество на средний метраж (3 м на гардину)
        meters = parseInt(countMatch[1]) * 3;
      }
      
      if (meters > 0) {
        const curtainsLower = variant.curtains.toLowerCase();
        if ((curtainsLower.includes('на потолок') || curtainsLower.includes('потолок')) && prices.rooms.curtains && prices.rooms.curtains['на потолок']) {
          total += meters * (prices.rooms.curtains['на потолок'].pricePerM || 0);
        } else if (curtainsLower.includes('скрыт') && prices.rooms.curtains && prices.rooms.curtains['скрытые']) {
          total += meters * (prices.rooms.curtains['скрытые'].pricePerM || 0);
        }
      }
    }
    if (variant.extras && variant.extras !== '—' && prices.rooms.extras) {
      if (prices.rooms.extras[variant.extras]) {
        total += prices.rooms.extras[variant.extras].pricePerUnit || 0;
      }
    }
  }
  
  return {
    numeric: total > 0 ? total : 0,
    formatted: total > 0 ? `${total.toLocaleString('ru-RU')} ₽` : "—"
  };
}

// Функция расчета цены для варианта квартиры (возвращает объект с числом и строкой)
function calculateApartmentPrice(variant, prices) {
  if (!prices || !prices.apartments) return { numeric: 0, formatted: "—" };
  
  const area = extractNumber(variant.area);
  let total = 0;
  
  // Новая структура с items
  if (variant.items && Array.isArray(variant.items)) {
    variant.items.forEach(item => {
      if (!item.value || item.value === '—' || item.value === '') return;
      
      const unit = item.unit || 'шт';
      const itemName = item.name.trim();
      
      // Определяем категорию и ключ для поиска цены
      let category = 'extras';
      let priceKey = itemName;
      
      if (itemName.toLowerCase().includes('полотно') || itemName.toLowerCase().includes('fabric')) {
        category = 'fabric';
        priceKey = item.value.trim();
        if (prices.apartments.fabric && prices.apartments.fabric[priceKey]) {
          total += area * (prices.apartments.fabric[priceKey].pricePerM2 || 0);
        }
      } else if (itemName.toLowerCase().includes('светильник') || itemName.toLowerCase().includes('light')) {
        category = 'lights';
        const match = item.value.match(/(\d+)x\s+(.+)/);
        if (match) {
          const count = parseInt(match[1]);
          priceKey = match[2].trim();
          if (prices.apartments.lights && prices.apartments.lights[priceKey]) {
            total += count * (prices.apartments.lights[priceKey].pricePerUnit || 0);
          }
        }
      } else if (itemName.toLowerCase().includes('гардин') || itemName.toLowerCase().includes('curtain')) {
        category = 'curtains';
        const valueLower = item.value.toLowerCase();
        if (valueLower.includes('на потолок') || valueLower.includes('потолок')) priceKey = 'на потолок';
        else if (valueLower.includes('скрыт')) priceKey = 'скрытые';
        else priceKey = itemName;
        
        // Извлекаем метраж из разных форматов: "2x на потолок", "до 3 м", "3 м"
        let meters = 0;
        const countMatch = item.value.match(/(\d+)x/); // "2x на потолок"
        const metersMatch1 = item.value.match(/до\s+(\d+)\s*м/i); // "до 3 м" или "до 3м"
        const metersMatch2 = item.value.match(/(\d+)\s*м(?!²)/i); // "3 м" (но не "м²")
        
        if (countMatch) {
          // Для формата "2x на потолок" умножаем количество на средний метраж (3 м на гардину)
          meters = parseInt(countMatch[1]) * 3;
        } else if (metersMatch1) {
          meters = parseInt(metersMatch1[1]);
        } else if (metersMatch2) {
          meters = parseInt(metersMatch2[1]);
        } else if (unit === 'м') {
          // Если unit указан как "м", но метраж не найден, используем значение по умолчанию
          meters = 3;
        }
        
        if (meters > 0 && prices.apartments.curtains && prices.apartments.curtains[priceKey]) {
          total += meters * (prices.apartments.curtains[priceKey].pricePerM || 0);
        }
      }
    });
  } else {
    // Обратная совместимость со старой структурой
    if (variant.fabric && variant.fabric !== '—' && prices.apartments.fabric && prices.apartments.fabric[variant.fabric]) {
      total += area * (prices.apartments.fabric[variant.fabric].pricePerM2 || 0);
    }
    if (variant.lights && variant.lights !== '—') {
      const lightsMatch = variant.lights.match(/(\d+)x\s+(.+)/);
      if (lightsMatch) {
        const count = parseInt(lightsMatch[1]);
        const lightType = lightsMatch[2].trim();
        if (prices.apartments.lights && prices.apartments.lights[lightType]) {
          total += count * (prices.apartments.lights[lightType].pricePerUnit || 0);
        }
      }
    }
    if (variant.curtains && variant.curtains !== '—') {
      const curtainsMatch = variant.curtains.match(/(\d+)x\s+(.+)/);
      if (curtainsMatch) {
        const count = parseInt(curtainsMatch[1]);
        const curtainType = curtainsMatch[2].trim();
        const meters = count * 3;
        if (curtainType === 'на потолок' && prices.apartments.curtains && prices.apartments.curtains['на потолок']) {
          total += meters * (prices.apartments.curtains['на потолок'].pricePerM || 0);
        } else if (curtainType === 'скрытые' && prices.apartments.curtains && prices.apartments.curtains['скрытые']) {
          total += meters * (prices.apartments.curtains['скрытые'].pricePerM || 0);
        }
      }
    }
  }
  
  return {
    numeric: total > 0 ? total : 0,
    formatted: total > 0 ? `${total.toLocaleString('ru-RU')} ₽` : "—"
  };
}

// =======================
// Логика для конструктора
// =======================

/**
 * Расчет стоимости гардин по общему метражу для конструктора.
 * section: 'rooms' | 'apartments'
 * type: 'на потолок' | 'скрытые' (или любая строка, содержащая эти слова)
 * meters: число (общий метраж в метрах)
 */
function calculateCurtainsPriceForConstructor(section, type, meters, prices) {
  const sourcePrices = prices || pricesData;
  if (!sourcePrices || !sourcePrices[section] || !sourcePrices[section].curtains) {
    return { numeric: 0, formatted: "—" };
  }

  const rawMeters = typeof meters === "string" ? meters.replace(",", ".") : meters;
  const m = Number(rawMeters);
  if (!Number.isFinite(m) || m <= 0) {
    return { numeric: 0, formatted: "—" };
  }

  const rawType = (type || "").toString();
  let priceKey = rawType.trim();

  // Нормализуем ключи так же, как в готовых решениях
  if (rawType.toLowerCase().includes("потолок")) {
    priceKey = "на потолок";
  } else if (rawType.toLowerCase().includes("скрыт")) {
    priceKey = "скрытые";
  }

  const curtainPrice = sourcePrices[section].curtains[priceKey];
  if (!curtainPrice || typeof curtainPrice.pricePerM !== "number") {
    return { numeric: 0, formatted: "—" };
  }

  const total = m * curtainPrice.pricePerM;
  return {
    numeric: total,
    formatted: `${total.toLocaleString("ru-RU")} ₽`
  };
}

// Функция загрузки продуктов с сервера
async function loadProducts() {
  try {
    const res = await fetch('/api/products');
    const data = await res.json();
    if (data.status === 'success' && data.products) {
      productsData = data.products;
      return true;
    }
    return false;
  } catch (err) {
    console.error('Ошибка загрузки продуктов:', err);
    return false;
  }
}

// Вспомогательная функция: извлечь числовую цену из строки "12 200 ₽"
function extractPriceNumber(priceStr) {
  if (!priceStr) return null;
  try {
    let s = String(priceStr)
      .replace(/\s/g, '')
      .replace(/₽/g, '')
      .replace(/[^\d]/g, '');
    const n = parseInt(s, 10);
    return Number.isNaN(n) ? null : n;
  } catch (e) {
    console.error('Ошибка разбора цены для schema.org:', priceStr, e);
    return null;
  }
}

// Генерация schema.org ItemList для готовых решений
function generateReadySolutionsSchema() {
  try {
    if (!productsData || !productsData.rooms || !productsData.apartments) return;

    const url = "https://potolok-konkurent.ru/ready-solutions/";
    const itemListElement = [];
    let position = 1;

    // Комнаты: basic / comfort
    productsData.rooms.forEach(room => {
      ["basic", "comfort"].forEach(variantKey => {
        const variant = room[variantKey];
        if (!variant) return;
        const priceNumber = extractPriceNumber(variant.price);
        if (!priceNumber) return;

        const name =
          `${room.title} — пакет ${variantKey === "basic" ? "Базовый" : "Комфорт"} (${room.area})`;
        const description =
          `Готовое решение натяжного потолка: ${room.title}, пакет ` +
          `${variantKey === "basic" ? "Базовый" : "Комфорт"}, площадь ${room.area}.`;

        itemListElement.push({
          "@type": "Product",
          position: position++,
          name,
          description,
          category: "Комната",
          offers: {
            "@type": "Offer",
            price: String(priceNumber),
            priceCurrency: "RUB",
            availability: "https://schema.org/InStock",
            url
          }
        });
      });
    });

    // Квартиры: все variants
    productsData.apartments.forEach(apartment => {
      apartment.variants.forEach(variant => {
        const priceNumber = extractPriceNumber(variant.price);
        if (!priceNumber) return;

        const name =
          `${apartment.title} — ${variant.type === "basic" ? "Базовый" : "Комфорт"} (${variant.area})`;
        const description =
          `Готовое решение натяжных потолков для ${apartment.title.toLowerCase()}: ` +
          `пакет ${variant.type === "basic" ? "Базовый" : "Комфорт"}, площадь ${variant.area}.`;

        itemListElement.push({
          "@type": "Product",
          position: position++,
          name,
          description,
          category: "Квартира",
          offers: {
            "@type": "Offer",
            price: String(priceNumber),
            priceCurrency: "RUB",
            availability: "https://schema.org/InStock",
            url
          }
        });
      });
    });

    if (!itemListElement.length) return;

    const schema = {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Готовые решения натяжных потолков",
      url,
      itemListElement
    };

    let script = document.getElementById("ready-solutions-products-schema");
    if (!script) {
      script = document.createElement("script");
      script.type = "application/ld+json";
      script.id = "ready-solutions-products-schema";
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(schema);
  } catch (e) {
    console.error("Ошибка генерации schema.org для готовых решений:", e);
  }
}

// Инициализация корзины
document.addEventListener("DOMContentLoaded", async () => {
  // Загружаем цены и продукты с сервера
  const [pricesLoaded, productsLoaded] = await Promise.all([loadPrices(), loadProducts()]);
  
  if (!pricesLoaded) {
    console.error("Не удалось загрузить цены с сервера! Цены не будут отображаться.");
  } else {
    console.log("Цены успешно загружены:", pricesData);
  }
  
  if (!productsLoaded) {
    console.warn("Не удалось загрузить продукты с сервера, готовые решения временно недоступны");
    productsData = { rooms: [], apartments: [] };
  } else {
    console.log("Продукты успешно загружены:", productsData);
    // Проверяем структуру данных
    if (productsData.rooms && productsData.rooms.length > 0) {
      const firstRoom = productsData.rooms[0];
      console.log("Пример комнаты:", firstRoom);
      console.log("Базовый вариант:", firstRoom.basic);
      console.log("Есть items?", firstRoom.basic?.items);
    }
  }
  
  // Обновляем бейдж при загрузке
  Cart.updateBadge();

  // Генерация schema.org только на странице готовых решений
  if (window.location.pathname.includes("/ready-solutions")) {
    generateReadySolutionsSchema();
  }

  // Функция для получения информации о светильнике (изображение и название)
  const getLightInfo = (lightsText) => {
    if (!lightsText || lightsText === '—') return { image: null, name: null };
    
    // Определяем тип светильника
    // Используем WebP с fallback на PNG для совместимости
    if (lightsText.includes('GX53')) {
      // ВАЖНО: используем абсолютные пути, чтобы они работали и на /ready-solutions/
      return { image: '/ligth/gx53.webp', name: 'GX53', fallback: '/ligth/gx53.png' };
    } else if (lightsText.includes('IN HOME RLP VC') || lightsText.includes('RLP VC')) {
      return { image: '/ligth/rlp-vc.webp', name: 'IN HOME RLP VC', fallback: '/ligth/rlp-vc.png' };
    }
    return { image: null, name: null };
  };

  // Функция для получения описания полотна
  const getFabricInfo = (fabricText) => {
    if (!fabricText || fabricText === '—') return null;
    
    const descriptions = {
      'MSD Standard': {
        name: 'MSD Standard',
        description: 'Базовое полотно MSD Standard — качественное решение для стандартных помещений. Отличается хорошей прочностью и долговечностью при доступной цене.'
      },
      'BAUF 205': {
        name: 'BAUF 205',
        description: 'Премиум полотно BAUF 205 — высококачественный материал премиум-класса. Отличается превосходной текстурой, повышенной прочностью и долговечностью. Идеально подходит для гостиных, спален и других важных помещений.'
      }
    };
    
    return descriptions[fabricText] || null;
  };

  // Вспомогательная функция для извлечения данных из варианта (поддержка старой и новой структуры)
  const extractVariantData = (variant) => {
    const data = { fabric: null, lights: null, curtains: null, extras: null };
    
    if (variant.items && Array.isArray(variant.items) && variant.items.length > 0) {
      // Новая структура с items
      variant.items.forEach(item => {
        if (!item.value || item.value === '—' || item.value === '') return;
        const itemName = item.name.trim().toLowerCase();
        const itemValue = item.value.trim();
        
        if (itemName.includes('полотно') || itemName.includes('fabric')) {
          data.fabric = itemValue;
        } else if (itemName.includes('светильник') || itemName.includes('light')) {
          data.lights = itemValue;
        } else if (itemName.includes('гардин') || itemName.includes('curtain')) {
          data.curtains = itemValue;
        } else {
          data.extras = itemValue;
        }
      });
    } else {
      // Старая структура
      data.fabric = variant.fabric || null;
      data.lights = variant.lights || null;
      data.curtains = variant.curtains || null;
      data.extras = variant.extras || null;
    }
    
    return data;
  };

  // Функция для рендеринга состава варианта (улучшенное описание)
  const renderVariantDetails = (variant) => {
    if (!variant) {
      console.warn("renderVariantDetails: variant is null or undefined");
      return '<div class="variant-detail-item" style="color: #999;">Состав не указан</div>';
    }
    
    const details = [];
    
    // Новая структура с items (проверяем, что items не пустой и содержит валидные данные)
    const hasValidItems = variant.items && Array.isArray(variant.items) && variant.items.length > 0 && 
                          variant.items.some(item => item.value && item.value !== '—' && item.value !== '');
    const hasOldStructure = (variant.fabric && variant.fabric !== '—') || 
                            (variant.lights && variant.lights !== '—') || 
                            (variant.curtains && variant.curtains !== '—') || 
                            (variant.extras && variant.extras !== '—');
    
    if (hasValidItems) {
      variant.items.forEach(item => {
        if (!item.value || item.value === '—' || item.value === '') return;
        
        const itemName = item.name.trim();
        const itemValue = item.value.trim();
        
        // Полотно
        if (itemName.toLowerCase().includes('полотно') || itemName.toLowerCase().includes('fabric')) {
          const fabricInfo = getFabricInfo(itemValue);
          if (fabricInfo) {
            details.push(`<div class="variant-detail-item"><strong>${itemName}:</strong> <span class="fabric-name-clickable" onclick="showFabricModal('${fabricInfo.name}', '${itemValue}', \`${fabricInfo.description}\`)" title="Нажмите, чтобы узнать больше">${itemValue}</span></div>`);
          } else {
            details.push(`<div class="variant-detail-item"><strong>${itemName}:</strong> ${itemValue}</div>`);
          }
        }
        // Светильники
        else if (itemName.toLowerCase().includes('светильник') || itemName.toLowerCase().includes('light')) {
          const formattedLights = formatQuantity(itemValue);
          const lightInfo = getLightInfo(itemValue);
          if (lightInfo.image) {
            const parts = formattedLights.split(' - ');
            if (parts.length === 2) {
              const lightName = parts[0].trim();
              const quantity = parts[1].trim();
              details.push(`<div class="variant-detail-item"><strong>${itemName}:</strong> <span class="lights-text"><span class="light-name-clickable" onclick="showLightModal('${lightInfo.image}', '${lightInfo.name}', '${lightInfo.fallback || ''}')" title="Нажмите, чтобы посмотреть изображение">${lightName}</span> - ${quantity}</span></div>`);
            } else {
              details.push(`<div class="variant-detail-item"><strong>${itemName}:</strong> <span class="lights-text light-name-clickable" onclick="showLightModal('${lightInfo.image}', '${lightInfo.name}', '${lightInfo.fallback || ''}')" title="Нажмите, чтобы посмотреть изображение">${formattedLights}</span></div>`);
            }
          } else {
            details.push(`<div class="variant-detail-item"><strong>${itemName}:</strong> ${formattedLights}</div>`);
          }
        }
        // Гардины и остальное
        else {
          const formattedValue = itemName.toLowerCase().includes('гардин') ? formatQuantity(itemValue) : itemValue;
          details.push(`<div class="variant-detail-item"><strong>${itemName}:</strong> ${formattedValue}</div>`);
        }
      });
    } else if (hasOldStructure) {
      // Обратная совместимость со старой структурой
      if (variant.fabric && variant.fabric !== '—') {
        const fabricInfo = getFabricInfo(variant.fabric);
        if (fabricInfo) {
          details.push(`<div class="variant-detail-item"><strong>Полотно:</strong> <span class="fabric-name-clickable" onclick="showFabricModal('${fabricInfo.name}', '${variant.fabric}', \`${fabricInfo.description}\`)" title="Нажмите, чтобы узнать больше">${variant.fabric}</span></div>`);
        } else {
          details.push(`<div class="variant-detail-item"><strong>Полотно:</strong> ${variant.fabric}</div>`);
        }
      }
      if (variant.lights && variant.lights !== '—') {
        const formattedLights = formatQuantity(variant.lights);
        const lightInfo = getLightInfo(variant.lights);
        if (lightInfo.image) {
          const parts = formattedLights.split(' - ');
          if (parts.length === 2) {
            const lightName = parts[0].trim();
            const quantity = parts[1].trim();
            details.push(`<div class="variant-detail-item"><strong>Светильники:</strong> <span class="lights-text"><span class="light-name-clickable" onclick="showLightModal('${lightInfo.image}', '${lightInfo.name}', '${lightInfo.fallback || ''}')" title="Нажмите, чтобы посмотреть изображение">${lightName}</span> - ${quantity}</span></div>`);
          } else {
            details.push(`<div class="variant-detail-item"><strong>Светильники:</strong> <span class="lights-text light-name-clickable" onclick="showLightModal('${lightInfo.image}', '${lightInfo.name}', '${lightInfo.fallback || ''}')" title="Нажмите, чтобы посмотреть изображение">${formattedLights}</span></div>`);
          }
        } else {
          details.push(`<div class="variant-detail-item"><strong>Светильники:</strong> ${formattedLights}</div>`);
        }
      }
      if (variant.curtains && variant.curtains !== '—') {
        const formattedCurtains = formatQuantity(variant.curtains);
        details.push(`<div class="variant-detail-item"><strong>Гардина:</strong> ${formattedCurtains}</div>`);
      }
      if (variant.extras && variant.extras !== '—') {
        details.push(`<div class="variant-detail-item"><strong>Дополнительно:</strong> ${variant.extras}</div>`);
      }
    } else {
      // Если нет ни items, ни старой структуры
      console.warn("renderVariantDetails: нет данных для отображения", variant);
    }
    
    return details.length > 0 ? details.join('') : '<div class="variant-detail-item" style="color: #999;">Состав не указан</div>';
  };

  // Рендерим карточки комнат (полные карточки без аккордеона внутри)
  const roomsGrid = document.getElementById('roomsGrid');
  if (roomsGrid) {
    roomsGrid.innerHTML = productsData.rooms.map(room => {
      // Рассчитываем цены
      const basicPrice = calculateRoomPrice(room.basic, room.area, pricesData);
      const comfortPrice = calculateRoomPrice(room.comfort, room.area, pricesData);
      
      return `
      <div class="product-card room-card">
        <div class="product-header">
          <h3 class="product-title">${room.title}</h3>
          <div class="product-area">Площадь: ${room.area}</div>
          ${room.note ? `<div class="product-note">${room.note}</div>` : ''}
        </div>
        <div class="product-variants">
          <div class="product-variant">
            <div class="variant-header">БАЗОВЫЙ</div>
            <div class="variant-content">
              <div class="variant-details">
                ${renderVariantDetails(room.basic)}
              </div>
              <div class="variant-price">${basicPrice.formatted}</div>
              <button class="add-to-cart-btn" onclick="addRoomToCart(${room.id}, 'basic')">
                <i class="fa fa-shopping-cart"></i> Добавить в корзину
              </button>
            </div>
          </div>
          <div class="product-variant">
            <div class="variant-header variant-comfort">КОМФОРТ</div>
            <div class="variant-content">
              <div class="variant-details">
                ${renderVariantDetails(room.comfort)}
              </div>
              <div class="variant-price">${comfortPrice.formatted}</div>
              <button class="add-to-cart-btn btn-comfort" onclick="addRoomToCart(${room.id}, 'comfort')">
                <i class="fa fa-shopping-cart"></i> Добавить в корзину
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    }).join('');
  }

  // Функция для получения значения позиции из варианта
  const getVariantItemValue = (variant, itemName) => {
    // Проверяем новую структуру с items
    const hasValidItems = variant.items && Array.isArray(variant.items) && variant.items.length > 0 && 
                          variant.items.some(item => item.value && item.value !== '—' && item.value !== '');
    
    if (hasValidItems) {
      const item = variant.items.find(i => i.name && i.name.toLowerCase().includes(itemName.toLowerCase()));
      if (item && item.value && item.value !== '—' && item.value !== '') {
        return item.value;
      }
    }
    
    // Обратная совместимость - используем старую структуру, если items пустой или невалидный
    const hasOldStructure = (variant.fabric && variant.fabric !== '—') || 
                            (variant.lights && variant.lights !== '—') || 
                            (variant.curtains && variant.curtains !== '—') || 
                            (variant.extras && variant.extras !== '—');
    
    if (!hasValidItems && hasOldStructure) {
      if (itemName.toLowerCase().includes('полотно') || itemName.toLowerCase().includes('fabric')) {
        return variant.fabric && variant.fabric !== '—' ? variant.fabric : null;
      }
      if (itemName.toLowerCase().includes('светильник') || itemName.toLowerCase().includes('light')) {
        return variant.lights && variant.lights !== '—' ? variant.lights : null;
      }
      if (itemName.toLowerCase().includes('гардин') || itemName.toLowerCase().includes('curtain')) {
        return variant.curtains && variant.curtains !== '—' ? variant.curtains : null;
      }
      if (itemName.toLowerCase().includes('дополнительно') || itemName.toLowerCase().includes('extras')) {
        return variant.extras && variant.extras !== '—' ? variant.extras : null;
      }
    }
    
    return null;
  };

  // Рендерим карточки квартир
  const apartmentsGrid = document.getElementById('apartmentsGrid');
  if (apartmentsGrid) {
    apartmentsGrid.innerHTML = productsData.apartments.map(apartment => {
      // Определяем, какие строки нужно показывать (убираем пустые)
      const hasCurtains = apartment.variants.some(v => {
        const curtainsValue = getVariantItemValue(v, 'гардин');
        return curtainsValue && curtainsValue !== '—';
      });
      
      // Собираем все уникальные позиции из всех вариантов
      const allItemNames = new Set();
      apartment.variants.forEach(v => {
        // Проверяем новую структуру с items
        const hasValidItems = v.items && Array.isArray(v.items) && v.items.length > 0 && 
                              v.items.some(item => item.value && item.value !== '—' && item.value !== '');
        
        if (hasValidItems) {
          v.items.forEach(item => {
            if (item.name && item.value && item.value !== '—' && item.value !== '') {
              allItemNames.add(item.name);
            }
          });
        }
        
        // Обратная совместимость - проверяем старую структуру, даже если items существует
        const hasOldStructure = (v.fabric && v.fabric !== '—') || 
                                (v.lights && v.lights !== '—') || 
                                (v.curtains && v.curtains !== '—') || 
                                (v.extras && v.extras !== '—');
        
        if (!hasValidItems && hasOldStructure) {
          // Используем старую структуру, если items пустой или невалидный
          if (v.fabric && v.fabric !== '—') allItemNames.add('Полотно');
          if (v.lights && v.lights !== '—') allItemNames.add('Светильники');
          if (v.curtains && v.curtains !== '—') allItemNames.add('Гардины');
          if (v.extras && v.extras !== '—') allItemNames.add('Дополнительно');
        }
      });
      
      return `
      <div class="product-card apartment-card">
        <div class="product-header">
          <h3 class="product-title">${apartment.title}</h3>
          <div class="product-area">Площадь: ${apartment.area}</div>
          ${apartment.note ? `<div class="product-note">${apartment.note}</div>` : ''}
        </div>
        <div class="apartment-variants-table">
          <table class="variants-table">
            <thead>
              <tr>
                <th></th>
                <th colspan="2">БАЗОВЫЙ</th>
                <th colspan="2">КОМФОРТ</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Метраж</strong></td>
                ${apartment.variants.filter(v => v.type === 'basic').map(v => `<td>${v.area}</td>`).join('')}
                ${apartment.variants.filter(v => v.type === 'comfort').map(v => `<td>${v.area}</td>`).join('')}
              </tr>
              ${Array.from(allItemNames).map(itemName => {
                if (itemName === 'Гардины' && !hasCurtains) return '';
                
                const isFabric = itemName.toLowerCase().includes('полотно') || itemName.toLowerCase().includes('fabric');
                const isLights = itemName.toLowerCase().includes('светильник') || itemName.toLowerCase().includes('light');
                const isCurtains = itemName.toLowerCase().includes('гардин') || itemName.toLowerCase().includes('curtain');
                
                return `
              <tr>
                <td><strong>${itemName}</strong></td>
                ${apartment.variants.filter(v => v.type === 'basic').map(v => {
                  const value = getVariantItemValue(v, itemName);
                  if (!value || value === '—') return '<td>—</td>';
                  
                  if (isFabric) {
                    const fabricInfo = getFabricInfo(value);
                    if (fabricInfo) {
                      return `<td><span class="fabric-name-clickable" onclick="showFabricModal('${fabricInfo.name}', '${value}', \`${fabricInfo.description}\`)" title="Нажмите, чтобы узнать больше">${value}</span></td>`;
                    }
                    return `<td>${value}</td>`;
                  } else if (isLights) {
                    const formattedLights = formatQuantity(value);
                    const lightInfo = getLightInfo(value);
                    if (lightInfo.image) {
                      const parts = formattedLights.split(' - ');
                      if (parts.length === 2) {
                        const lightName = parts[0].trim();
                        const quantity = parts[1].trim();
                        return `<td class="lights-cell"><span class="lights-text"><span class="light-name-clickable" onclick="showLightModal('${lightInfo.image}', '${lightInfo.name}', '${lightInfo.fallback || ''}')" title="Нажмите, чтобы посмотреть изображение">${lightName}</span> - ${quantity}</span></td>`;
                      }
                      return `<td class="lights-cell"><span class="lights-text light-name-clickable" onclick="showLightModal('${lightInfo.image}', '${lightInfo.name}', '${lightInfo.fallback || ''}')" title="Нажмите, чтобы посмотреть изображение">${formattedLights}</span></td>`;
                    }
                    return `<td class="lights-cell"><span class="lights-text">${formattedLights}</span></td>`;
                  } else if (isCurtains) {
                    return `<td>${formatQuantity(value)}</td>`;
                  }
                  return `<td>${value}</td>`;
                }).join('')}
                ${apartment.variants.filter(v => v.type === 'comfort').map(v => {
                  const value = getVariantItemValue(v, itemName);
                  if (!value || value === '—') return '<td>—</td>';
                  
                  if (isFabric) {
                    const fabricInfo = getFabricInfo(value);
                    if (fabricInfo) {
                      return `<td><span class="fabric-name-clickable" onclick="showFabricModal('${fabricInfo.name}', '${value}', \`${fabricInfo.description}\`)" title="Нажмите, чтобы узнать больше">${value}</span></td>`;
                    }
                    return `<td>${value}</td>`;
                  } else if (isLights) {
                    const formattedLights = formatQuantity(value);
                    const lightInfo = getLightInfo(value);
                    if (lightInfo.image) {
                      const parts = formattedLights.split(' - ');
                      if (parts.length === 2) {
                        const lightName = parts[0].trim();
                        const quantity = parts[1].trim();
                        return `<td class="lights-cell"><span class="lights-text"><span class="light-name-clickable" onclick="showLightModal('${lightInfo.image}', '${lightInfo.name}', '${lightInfo.fallback || ''}')" title="Нажмите, чтобы посмотреть изображение">${lightName}</span> - ${quantity}</span></td>`;
                      }
                      return `<td class="lights-cell"><span class="lights-text light-name-clickable" onclick="showLightModal('${lightInfo.image}', '${lightInfo.name}', '${lightInfo.fallback || ''}')" title="Нажмите, чтобы посмотреть изображение">${formattedLights}</span></td>`;
                    }
                    return `<td class="lights-cell"><span class="lights-text">${formattedLights}</span></td>`;
                  } else if (isCurtains) {
                    return `<td>${formatQuantity(value)}</td>`;
                  }
                  return `<td>${value}</td>`;
                }).join('')}
              </tr>
              `;
              }).join('')}
              <tr>
                <td><strong>Цена</strong></td>
                ${apartment.variants.filter(v => v.type === 'basic').map(v => {
                  const calculatedPrice = calculateApartmentPrice(v, pricesData);
                  return `<td class="price-cell">${calculatedPrice.formatted}</td>`;
                }).join('')}
                ${apartment.variants.filter(v => v.type === 'comfort').map(v => {
                  const calculatedPrice = calculateApartmentPrice(v, pricesData);
                  return `<td class="price-cell">${calculatedPrice.formatted}</td>`;
                }).join('')}
              </tr>
              <tr>
                <td><strong>Кнопка</strong></td>
                ${apartment.variants.map((v, idx) => `<td><button class="add-to-cart-btn ${v.type === 'comfort' ? 'btn-comfort' : ''}" onclick="addApartmentToCart(${apartment.id}, ${idx})"><i class="fa fa-shopping-cart"></i> Добавить</button></td>`).join('')}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
    }).join('');
  }

  // Открытие корзины
  const cartBtn = document.getElementById('cartBtn');
  const floatingCartBtn = document.getElementById('floatingCartBtn');
  const cartModal = document.getElementById('cartModal');
  const cartClose = cartModal?.querySelector('.close');

  const openCart = () => {
    renderCart();
    showModal('cartModal');
  };

  if (cartBtn && cartModal) {
    cartBtn.addEventListener('click', openCart);
  }
  
  if (floatingCartBtn && cartModal) {
    floatingCartBtn.addEventListener('click', openCart);
  }

  if (cartClose) {
    cartClose.addEventListener('click', () => hideModal('cartModal'));
  }

  window.addEventListener('click', e => {
    if (e.target === cartModal) hideModal('cartModal');
    const lightModal = document.getElementById('lightModal');
    if (lightModal && e.target === lightModal) hideModal('lightModal');
    const fabricModal = document.getElementById('fabricModal');
    if (fabricModal && e.target === fabricModal) hideModal('fabricModal');
    const featureModal = document.getElementById('featureModal');
    if (featureModal && e.target === featureModal) hideModal('featureModal');
  });

  // Обработка формы корзины
  const cartForm = document.getElementById('cartForm');
  if (cartForm) {
    cartForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = cartForm.querySelector('input[placeholder="Ваше имя"]').value.trim();
      const phone = cartForm.querySelector('input[placeholder="Ваш телефон"]').value.trim();

      if (!name || !phone) {
        showToast("Заполните все обязательные поля", "error");
        return;
      }

      if (phone.length < 10) {
        showToast("Введите корректный номер телефона", "error");
        return;
      }

      const cartItems = Cart.getItems();
      const itemsInfo = cartItems.map(item => `${item.title} (${item.price})`).join(', ');

      // Рассчитываем общую сумму корзины
      let totalAmount = 0;
      cartItems.forEach(item => {
        // Используем числовое значение цены, если оно есть, иначе парсим строку
        if (item.priceNumeric && item.priceNumeric > 0) {
          totalAmount += item.priceNumeric;
        } else if (item.price && item.price !== '—' && item.price !== '' && item.price !== null) {
          try {
            // Извлекаем число из строки типа "12 200 ₽" или "12200 ₽" (для обратной совместимости)
            let priceStr = String(item.price)
              .replace(/\s/g, '')           // Удаляем все пробелы
              .replace(/₽/g, '')           // Удаляем символ рубля
              .replace(/[^\d]/g, '');      // Оставляем только цифры
            
            const price = parseInt(priceStr, 10);
            if (!isNaN(price) && price > 0) {
              totalAmount += price;
            }
          } catch (e) {
            console.error('Ошибка при обработке цены:', item.price, e);
          }
        }
      });

      const result = await sendRequest(name, phone, "Готовые решения", totalAmount > 0 ? totalAmount : null, null, false, cartItems);

      if (result.status === "success") {
        cartForm.reset();
        Cart.clear();
        Cart.updateBadge();
        showToast("Заявка успешно отправлена!", "success");
        setTimeout(() => {
          hideModal('cartModal');
        }, 500);
      } else {
        showToast("Ошибка: " + result.message, "error");
      }
    });
  }
});

// Функция переключения раздела "Комнаты" (аккордеон)
window.toggleRoomsSection = function(headerElement) {
  const section = headerElement.closest('.products-section');
  const content = section.querySelector('.section-accordion-content');
  const arrow = headerElement.querySelector('.section-arrow');
  
  // Переключаем видимость раздела
  content.classList.toggle('section-content-collapsed');
  arrow.classList.toggle('section-arrow-open');
};

// Функция переключения раздела "Квартиры" (аккордеон)
window.toggleApartmentsSection = function(headerElement) {
  const section = headerElement.closest('.products-section');
  const content = section.querySelector('.section-accordion-content');
  const arrow = headerElement.querySelector('.section-arrow');
  
  // Переключаем видимость раздела
  content.classList.toggle('section-content-collapsed');
  arrow.classList.toggle('section-arrow-open');
};

// Функция показа модального окна с изображением светильника
window.showLightModal = function(imageSrc, lightName, fallbackSrc) {
  const modal = document.getElementById('lightModal');
  const modalImage = document.getElementById('lightModalImage');
  const modalImageWebP = document.getElementById('lightModalImageWebP');
  const modalTitle = document.getElementById('lightModalTitle');
  
  if (modal && modalImage && modalTitle) {
    // Используем picture элемент для нативной поддержки WebP с fallback
    if (modalImageWebP && imageSrc.endsWith('.webp')) {
      modalImageWebP.srcset = imageSrc;
      if (fallbackSrc) {
        modalImage.src = fallbackSrc;
      } else {
        modalImage.src = imageSrc.replace('.webp', '.png');
      }
    } else {
      // Если нет picture элемента или это PNG, используем обычный img
      modalImage.src = imageSrc;
    }
    
    modalTitle.textContent = `Светильник ${lightName}`;
    showModal('lightModal');
  }
};

// Функция показа модального окна с описанием полотна
window.showFabricModal = function(fabricName, fullName, description) {
  const modal = document.getElementById('fabricModal');
  const modalTitle = document.getElementById('fabricModalTitle');
  const modalDescription = document.getElementById('fabricModalDescription');
  
  if (modal && modalTitle && modalDescription) {
    modalTitle.textContent = `Полотно ${fullName}`;
    modalDescription.textContent = description;
    showModal('fabricModal');
  }
};

// Функция показа модального окна с описанием преимущества
window.showFeatureModal = function(featureId, title, description) {
  const modal = document.getElementById('featureModal');
  const modalIcon = document.getElementById('featureModalIcon');
  const modalTitle = document.getElementById('featureModalTitle');
  const modalDescription = document.getElementById('featureModalDescription');
  
  if (modal && modalTitle && modalDescription) {
    // Определяем иконку в зависимости от типа преимущества
    const icons = {
      'install': '<i class="fa fa-clock"></i>',
      'warranty': '<i class="fa fa-shield-alt"></i>',
      'clients': '<i class="fa fa-smile"></i>'
    };
    
    if (modalIcon) {
      modalIcon.innerHTML = icons[featureId] || '<i class="fa fa-star"></i>';
    }
    
    modalTitle.textContent = title;
    modalDescription.textContent = description;
    showModal('featureModal');
  }
};

// Функция добавления комнаты в корзину
window.addRoomToCart = function(roomId, variant) {
  const room = productsData.rooms.find(r => r.id === roomId);
  if (room) {
    const variantData = variant === 'basic' ? room.basic : room.comfort;
    const calculatedPrice = calculateRoomPrice(variantData, room.area, pricesData);
    
    // Извлекаем данные из варианта (поддержка старой и новой структуры)
    let fabric = null, lights = null, curtains = null, extras = null;
    if (variantData.items && Array.isArray(variantData.items) && variantData.items.length > 0) {
      variantData.items.forEach(item => {
        if (!item.value || item.value === '—' || item.value === '') return;
        const itemName = item.name.trim().toLowerCase();
        const itemValue = item.value.trim();
        if (itemName.includes('полотно') || itemName.includes('fabric')) fabric = itemValue;
        else if (itemName.includes('светильник') || itemName.includes('light')) lights = itemValue;
        else if (itemName.includes('гардин') || itemName.includes('curtain')) curtains = itemValue;
        else extras = itemValue;
      });
    } else {
      fabric = variantData.fabric || null;
      lights = variantData.lights || null;
      curtains = variantData.curtains || null;
      extras = variantData.extras || null;
    }
    
    const cartItem = {
      id: `room-${roomId}-${variant}`,
      title: `${room.title} (${variant === 'basic' ? 'БАЗОВЫЙ' : 'КОМФОРТ'})`,
      area: room.area,
      fabric: fabric,
      lights: lights,
      curtains: curtains,
      extras: extras,
      price: calculatedPrice.formatted,
      priceNumeric: calculatedPrice.numeric,
      type: 'room',
      variant: variant
    };
    
    const added = Cart.addItem(cartItem);
    if (added) {
      showToast(`${cartItem.title} добавлен в корзину`, "success");
    } else {
      showToast("Товар уже в корзине", "info");
    }
  }
};

// Функция добавления квартиры в корзину
window.addApartmentToCart = function(apartmentId, variantIndex) {
  const apartment = productsData.apartments.find(a => a.id === apartmentId);
  if (apartment && apartment.variants[variantIndex]) {
    const variant = apartment.variants[variantIndex];
    const calculatedPrice = calculateApartmentPrice(variant, pricesData);
    
    // Извлекаем данные из варианта (поддержка старой и новой структуры)
    let fabric = null, lights = null, curtains = null, extras = null;
    if (variant.items && Array.isArray(variant.items) && variant.items.length > 0) {
      variant.items.forEach(item => {
        if (!item.value || item.value === '—' || item.value === '') return;
        const itemName = item.name.trim().toLowerCase();
        const itemValue = item.value.trim();
        if (itemName.includes('полотно') || itemName.includes('fabric')) fabric = itemValue;
        else if (itemName.includes('светильник') || itemName.includes('light')) lights = itemValue;
        else if (itemName.includes('гардин') || itemName.includes('curtain')) curtains = itemValue;
        else extras = itemValue;
      });
    } else {
      fabric = variant.fabric || null;
      lights = variant.lights || null;
      curtains = variant.curtains || null;
      extras = variant.extras || null;
    }
    
    const cartItem = {
      id: `apartment-${apartmentId}-${variantIndex}`,
      title: `${apartment.title} (${variant.type === 'basic' ? 'БАЗОВЫЙ' : 'КОМФОРТ'}, ${variant.area})`,
      area: variant.area,
      fabric: fabric,
      lights: lights,
      curtains: curtains,
      extras: extras,
      price: calculatedPrice.formatted,
      priceNumeric: calculatedPrice.numeric,
      type: 'apartment',
      variant: variant.type
    };
    
    const added = Cart.addItem(cartItem);
    if (added) {
      showToast(`${cartItem.title} добавлен в корзину`, "success");
    } else {
      showToast("Товар уже в корзине", "info");
    }
  }
};

// Функция удаления из корзины
window.removeFromCart = function(productId) {
  Cart.removeItem(productId);

  // Если есть логика конструктора, синхронизируем расчёт
  if (typeof window.removeConstructorRoomById === 'function') {
    window.removeConstructorRoomById(productId);
  }

  renderCart();
  showToast("Товар удалён из корзины", "info");
};

// Рендеринг корзины
function renderCart() {
  const cartItems = Cart.getItems();
  const cartItemsContainer = document.getElementById('cartItems');
  const cartEmpty = document.getElementById('cartEmpty');
  const cartFormContainer = document.getElementById('cartFormContainer');
  const cartTotalContainer = document.getElementById('cartTotal');

  if (cartItems.length === 0) {
    if (cartItemsContainer) cartItemsContainer.style.display = "none";
    if (cartEmpty) cartEmpty.style.display = "block";
    if (cartFormContainer) cartFormContainer.style.display = "none";
    if (cartTotalContainer) cartTotalContainer.style.display = "none";
  } else {
    if (cartEmpty) cartEmpty.style.display = "none";
    if (cartItemsContainer) {
      cartItemsContainer.style.display = "block";
      cartItemsContainer.innerHTML = cartItems.map(item => {
        let details = '';
        if (item.fabric) details += `<div class="cart-item-detail"><strong>Полотно:</strong> ${item.fabric}</div>`;
        if (item.lights) details += `<div class="cart-item-detail"><strong>Светильники:</strong> ${formatQuantity(item.lights)}</div>`;
        if (item.curtains && item.curtains !== '—') details += `<div class="cart-item-detail"><strong>Гардина:</strong> ${formatQuantity(item.curtains)}</div>`;
        if (item.extras && item.extras !== '—') details += `<div class="cart-item-detail"><strong>Дополнительно:</strong> ${item.extras}</div>`;
        
        return `
        <div class="cart-item">
          <div class="cart-item-info">
            <div class="cart-item-title">${item.title}</div>
            ${item.area ? `<div class="cart-item-area">Площадь: ${item.area}</div>` : ''}
            ${details}
            <div class="cart-item-price">${item.price}</div>
          </div>
          <button class="remove-item-btn" onclick="removeFromCart('${item.id}')">
            <i class="fa fa-trash"></i> Удалить
          </button>
        </div>
      `;
      }).join('');

      // Подсчёт общей суммы
      let totalAmount = 0;
      cartItems.forEach(item => {
        if (item.priceNumeric && item.priceNumeric > 0) {
          totalAmount += item.priceNumeric;
        } else if (item.price && item.price !== '—' && item.price !== '' && item.price !== null) {
          try {
            let priceStr = String(item.price)
              .replace(/\s/g, '')
              .replace(/₽/g, '')
              .replace(/[^\d]/g, '');
            const price = parseInt(priceStr, 10);
            if (!isNaN(price) && price > 0) {
              totalAmount += price;
            }
          } catch (e) {
            console.error('Ошибка при обработке цены в корзине:', item.price, e);
          }
        }
      });

      if (cartTotalContainer) {
        cartTotalContainer.style.display = "flex";
        const totalValueEl = cartTotalContainer.querySelector('.cart-total-value');
        if (totalValueEl) {
          totalValueEl.textContent = totalAmount > 0 ? `${totalAmount.toLocaleString('ru-RU')} ₽` : '—';
        }
      }
    }
    if (cartFormContainer) cartFormContainer.style.display = "block";
  }
}