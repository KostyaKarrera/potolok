// ===== Настройка маски для телефонов =====
window.addEventListener("load", () => {
  if (typeof Inputmask !== "undefined") {
    const phoneInputs = document.querySelectorAll('input[type="tel"]');
    phoneInputs.forEach(input => {
      Inputmask({
        mask: "+7 (999) 999-99-99",
        showMaskOnHover: false,
        clearIncomplete: true
      }).mask(input);
    });
  } else {
    console.error("❌ Inputmask не загрузился!");
  }
});

// ===== Функция анимации числа =====
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

// ===== Функция отправки данных на сервер =====
async function sendRequest(name, phone, type, estimatedPrice = null) {
  try {
    const API_URL = "/api/request";

const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, type, estimatedPrice }),
    });
    return await res.json();
  } catch (err) {
    console.error("Ошибка отправки запроса:", err);
    return { status: "error", message: "Сервер недоступен" };
  }
}

// ===== Калькулятор =====
const calculatorForm = document.getElementById('calculator-form');
const estimateModal = document.getElementById('estimateModal');
const estimateText = document.getElementById('estimateText');
const closeEstimate = estimateModal.querySelector('.close');
const estimateForm = document.getElementById('estimateForm');
const successMessage = document.getElementById('successMessage');

calculatorForm.addEventListener('submit', function(e){
  e.preventDefault();
  const area = Number(this.querySelector('input[placeholder*="Площадь"]').value);
  const lamps = Number(this.querySelector('input[placeholder*="Светильники"]').value);
  const chandeliers = Number(this.querySelector('input[placeholder*="Люстры"]').value);
  if(area < 1){ alert('Введите корректную площадь'); return; }

  const price = area*1200 + lamps*300 + chandeliers*500;

  estimateModal.style.display='block';
  successMessage.style.display='none';
  estimateForm.style.display='block';

  animateNumber(estimateText, 0, price, 1200);
});

// Закрытие модалки калькулятора
closeEstimate.addEventListener('click', ()=>{ estimateModal.style.display='none'; });
window.addEventListener('click', e=>{ if(e.target===estimateModal) estimateModal.style.display='none'; });

// Отправка формы калькулятора на сервер
estimateForm.addEventListener('submit', async e => {
  e.preventDefault();
  const name = estimateForm.querySelector('input[placeholder="Ваше имя"]').value.trim();
  const phone = estimateForm.querySelector('input[placeholder="Ваш телефон"]').value.trim();
  const estimatedPrice = estimateText.textContent.match(/\d+/g)?.join("") || null;

  if(!name || !phone) return alert("Заполните все поля");

  const result = await sendRequest(name, phone, "Калькулятор", estimatedPrice);
  if(result.status==="success"){
    estimateForm.style.display="none";
    successMessage.style.display="block";
  } else {
    alert("Ошибка: " + result.message);
  }
});

// ===== Заказать звонок =====
const callBtn = document.getElementById("callBtn");
const callModal = document.getElementById("callModal");
const callClose = callModal.querySelector(".close");
const callForm = document.getElementById("callForm");
const callSuccess = document.getElementById("callSuccess");

callBtn.addEventListener('click', ()=>{ callModal.style.display='block'; callForm.style.display='block'; callSuccess.style.display='none'; });
callClose.addEventListener('click', ()=>{ callModal.style.display='none'; });
window.addEventListener('click', e=>{ if(e.target===callModal) callModal.style.display='none'; });

callForm.addEventListener('submit', async e => {
  e.preventDefault();
  const name = callForm.querySelector('input[placeholder="Ваше имя"]').value.trim();
  const phone = callForm.querySelector('input[placeholder="Ваш телефон"]').value.trim();
  if(!name || !phone) return alert("Заполните все поля");

  const result = await sendRequest(name, phone, "Заказ звонка");
  if(result.status==="success"){
    callForm.style.display='none';
    callSuccess.style.display='block';
  } else {
    alert("Ошибка: " + result.message);
  }
});

// ===== Вызвать специалиста =====
const measureBtn = document.getElementById("measureBtn");
const measureModal = document.getElementById("measureModal");
const measureClose = measureModal.querySelector(".close");
const measureForm = document.getElementById("measureForm");
const measureSuccess = document.getElementById("measureSuccess");

measureBtn.addEventListener('click', ()=>{ measureModal.style.display='block'; measureForm.style.display='block'; measureSuccess.style.display='none'; });
measureClose.addEventListener('click', ()=>{ measureModal.style.display='none'; });
window.addEventListener('click', e=>{ if(e.target===measureModal) measureModal.style.display='none'; });

measureForm.addEventListener('submit', async e => {
  e.preventDefault();
  const name = measureForm.querySelector('input[placeholder="Ваше имя"]').value.trim();
  const phone = measureForm.querySelector('input[placeholder="Ваш телефон"]').value.trim();
  if(!name || !phone) return alert("Заполните все поля");

  const result = await sendRequest(name, phone, "Вызов специалиста");
  if(result.status==="success"){
    measureForm.style.display='none';
    measureSuccess.style.display='block';
  } else {
    alert("Ошибка: " + result.message);
  }
});

// ===== Лайтбокс для галереи =====
const lightbox = document.getElementById("lightbox");
const lightboxImg = document.querySelector(".lightbox-img");
const lightboxClose = document.querySelector(".lightbox-close");
const lightboxPrev = document.querySelector(".lightbox-prev");
const lightboxNext = document.querySelector(".lightbox-next");
const galleryImages = document.querySelectorAll(".gallery img");
let currentIndex = 0;

galleryImages.forEach((img,i)=>{ img.addEventListener('click',()=>{ lightbox.style.display='flex'; lightboxImg.src=img.src; currentIndex=i; }); });
lightboxClose.addEventListener('click',()=>{ lightbox.style.display='none'; });
lightbox.addEventListener('click', e=>{ if(e.target===lightbox) lightbox.style.display='none'; });
lightboxPrev.addEventListener('click',()=>{ currentIndex=(currentIndex-1+galleryImages.length)%galleryImages.length; lightboxImg.src=galleryImages[currentIndex].src; });
lightboxNext.addEventListener('click',()=>{ currentIndex=(currentIndex+1)%galleryImages.length; lightboxImg.src=galleryImages[currentIndex].src; });
