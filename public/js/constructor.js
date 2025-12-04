// ==================== CONSTRUCTOR.JS ====================
// Логика конструктора натяжного потолка
// =================================================
// ВАЖНО: используем глобальный объект pricesData, который
// инициализируется в main.js после загрузки /api/prices

// Список уже добавленных комнат (для типа rooms)
let savedRooms = [];

// Глобальная функция для сброса состояния конструктора
function resetConstructorState() {
  savedRooms = [];
  currentCalculation = {
    type: 'rooms',
    area: 0,
    fabric: null,
    lights: { type: null, count: 0 },
    curtains: { type: null, meters: 0 },
    extras: {}
  };

  const typeSelect = document.getElementById('constructorType');
  const areaInput = document.getElementById('constructorArea');
  const fabricSelect = document.getElementById('constructorFabric');
  const lightTypeSelect = document.getElementById('constructorLightType');
  const lightCountInput = document.getElementById('constructorLightCount');
  const curtainTypeSelect = document.getElementById('constructorCurtainType');
  const curtainMetersInput = document.getElementById('constructorCurtainMeters');

  if (typeSelect) typeSelect.value = 'rooms';
  if (areaInput) areaInput.value = '';
  if (fabricSelect) fabricSelect.value = '';
  if (lightTypeSelect) lightTypeSelect.value = '';
  if (lightCountInput) lightCountInput.value = '';
  if (curtainTypeSelect) curtainTypeSelect.value = '';
  if (curtainMetersInput) curtainMetersInput.value = '';
  document.querySelectorAll('.extras-checkbox').forEach(cb => cb.checked = false);

  updateAddRoomVisibility();
  updateAddToCartVisibility();
  calculatePrice();
}

window.resetConstructorState = resetConstructorState;

// Глобальная функция: удалить комнату по id (используется при удалении из корзины)
function removeConstructorRoomById(id) {
  if (!id) return;
  savedRooms = savedRooms.filter(room => room.id !== id);
  calculatePrice();
}

// Глобальные функции для управления видимостью кнопок
function updateAddRoomVisibility() {
  const typeSelect = document.getElementById('constructorType');
  const addRoomButton = document.getElementById('addRoomButton');
  if (!addRoomButton || !typeSelect) return;
  if (typeSelect.value === 'rooms') {
    addRoomButton.style.display = '';
  } else {
    addRoomButton.style.display = 'none';
  }
}

function updateAddToCartVisibility() {
  const typeSelect = document.getElementById('constructorType');
  const addToCartBtn = document.getElementById('addToCartBtn');
  const addToCartBtnMobile = document.getElementById('addToCartBtnMobile');
  if (!typeSelect) return;
  
  const isVisible = typeSelect.value === 'apartments';
  
  if (addToCartBtn) {
    addToCartBtn.style.display = isVisible ? '' : 'none';
  }
  if (addToCartBtnMobile) {
    addToCartBtnMobile.style.display = isVisible ? '' : 'none';
  }
}

window.removeConstructorRoomById = removeConstructorRoomById;
let currentCalculation = {
  type: 'rooms',
  area: 0,
  fabric: null,
  lights: { type: null, count: 0 },
  curtains: { type: null, meters: 0 },
  extras: {}
};

// Счётчик для генерации уникальных ID элементов конструктора
let constructorItemCounter = 0;

// Загрузка цен при инициализации конструктора
document.addEventListener("DOMContentLoaded", async () => {
  // Ждём, пока main.js загрузит цены (глобальный pricesData)
  let tries = 0;
  while ((typeof pricesData === 'undefined' || !pricesData || !pricesData.rooms) && tries < 50) {
    await new Promise(r => setTimeout(r, 100));
    tries++;
  }

  if (!pricesData || !pricesData.rooms) {
    console.error("pricesData не загружен, конструктор не сможет посчитать цену");
    return;
  }

  initializeConstructor();
  setupEventListeners();
  initConstructorHelpIcons();
});

// Инициализация конструктора
function initializeConstructor() {
  if (!pricesData) return;
  
  const typeSelect = document.getElementById('constructorType');
  const fabricSelect = document.getElementById('constructorFabric');
  const lightTypeSelect = document.getElementById('constructorLightType');
  
  // Заполняем селекты на основе выбранного типа
  updateSelectsForType(typeSelect.value);
  
  // Обновляем extras
  updateExtrasForType(typeSelect.value);
}

// Обновление селектов в зависимости от типа (комната/квартира)
function updateSelectsForType(type) {
  if (!pricesData || !pricesData[type]) return;
  
  const section = pricesData[type];
  
  // Полотно
  const fabricSelect = document.getElementById('constructorFabric');
  fabricSelect.innerHTML = '<option value="">Выберите полотно</option>';
  if (section.fabric) {
    Object.keys(section.fabric).forEach(fabricName => {
      const option = document.createElement('option');
      option.value = fabricName;
      option.textContent = fabricName;
      fabricSelect.appendChild(option);
    });
  }
  
  // Светильники
  const lightTypeSelect = document.getElementById('constructorLightType');
  lightTypeSelect.innerHTML = '<option value="">Выберите тип</option>';
  if (section.lights) {
    Object.keys(section.lights).forEach(lightName => {
      const option = document.createElement('option');
      option.value = lightName;
      option.textContent = lightName;
      lightTypeSelect.appendChild(option);
    });
  }
}

// Обновление extras в зависимости от типа
function updateExtrasForType(type) {
  if (!pricesData || !pricesData[type] || !pricesData[type].extras) {
    document.getElementById('extrasGroup').style.display = 'none';
    return;
  }
  
  const extras = pricesData[type].extras;
  const extrasContainer = document.getElementById('extrasContainer');
  extrasContainer.innerHTML = '';
  
  if (Object.keys(extras).length === 0) {
    document.getElementById('extrasGroup').style.display = 'none';
    return;
  }
  
  document.getElementById('extrasGroup').style.display = 'block';
  
  // Группируем по subCategory, фильтруя служебные/пустые позиции
  const grouped = {};
  Object.keys(extras).forEach(key => {
    const item = extras[key];
    // Не показываем служебные/пустые позиции
    if (!item) return;
    if (key.toLowerCase() === 'дополнительно') return;
    if (!item.subCategory || !item.subCategory.trim()) return;
    if (item.pricePerUnit === 0) return;

    const subCategory = item.subCategory.trim();
    if (!grouped[subCategory]) {
      grouped[subCategory] = [];
    }
    grouped[subCategory].push({ key, item });
  });
  
  const subCategories = Object.keys(grouped);

  if (subCategories.length === 0) {
    document.getElementById('extrasGroup').style.display = 'none';
    return;
  }

  subCategories.forEach(subCategory => {
    const groupDiv = document.createElement('div');
    groupDiv.className = 'extras-group';
    
    if (subCategory !== 'Прочее') {
      const groupTitle = document.createElement('div');
      groupTitle.className = 'extras-group-title';
      groupTitle.textContent = subCategory;
      groupDiv.appendChild(groupTitle);
    }
    
    grouped[subCategory].forEach(({ key, item }) => {
      const label = document.createElement('label');
      label.className = 'extras-checkbox-label';
      label.innerHTML = `
        <input type="checkbox" class="extras-checkbox" data-key="${key}" value="${key}">
        <span>${key}</span>
      `;
      groupDiv.appendChild(label);
    });
    
    extrasContainer.appendChild(groupDiv);
  });
}

// Инициализация иконок-подсказок (вопросиков) — показываем только если реально есть контент
function initConstructorHelpIcons() {
  const icons = document.querySelectorAll('.info-icon[data-help-target]');
  if (!icons.length) return;

  icons.forEach((icon) => {
    const targetId = icon.getAttribute('data-help-target');
    if (!targetId) return;

    const modal = document.getElementById(targetId);
    // Считаем, что контент есть, если в модалке есть текст или блоки с примерами
    const hasContent = modal && modal.querySelector('.examples-list, p, ul');

    if (!hasContent) {
      icon.style.display = 'none';
      return;
    }

    icon.addEventListener('click', () => {
      if (typeof showModal === 'function') {
        showModal(targetId);
      }
    });
  });
}

// Настройка обработчиков событий
function setupEventListeners() {
  const typeSelect = document.getElementById('constructorType');
  const areaInput = document.getElementById('constructorArea');
  const fabricSelect = document.getElementById('constructorFabric');
  const lightTypeSelect = document.getElementById('constructorLightType');
  const lightCountInput = document.getElementById('constructorLightCount');
  const curtainTypeSelect = document.getElementById('constructorCurtainType');
  const curtainMetersInput = document.getElementById('constructorCurtainMeters');
  const addToCartBtn = document.getElementById('addToCartBtn');
  const addToCartBtnMobile = document.getElementById('addToCartBtnMobile');
  const addRoomButton = document.getElementById('addRoomButton');
  const resetButton = document.getElementById('resetConstructorButton');
  const resetButtonMobile = document.getElementById('resetConstructorButtonMobile');
  
  // Изменение типа помещения
  typeSelect.addEventListener('change', (e) => {
    currentCalculation.type = e.target.value;
    // При переключении на квартиры очищаем накопленные комнаты
    if (currentCalculation.type !== 'rooms') {
      savedRooms = [];
    }
    updateSelectsForType(e.target.value);
    updateExtrasForType(e.target.value);
    updateAddRoomVisibility();
    updateAddToCartVisibility();
    calculatePrice();
  });
  
  // Изменение площади
  areaInput.addEventListener('input', (e) => {
    currentCalculation.area = parseFloat(e.target.value) || 0;
    calculatePrice();
  });

  // Изменение полотна
  fabricSelect.addEventListener('change', (e) => {
    currentCalculation.fabric = e.target.value || null;
    calculatePrice();
  });
  
  // Изменение типа светильника
  lightTypeSelect.addEventListener('change', (e) => {
    currentCalculation.lights.type = e.target.value || null;
    calculatePrice();
  });
  
  // Изменение количества светильников
  lightCountInput.addEventListener('input', (e) => {
    const val = e.target.value === '' ? 0 : parseInt(e.target.value);
    currentCalculation.lights.count = Number.isFinite(val) && val > 0 ? val : 0;
    calculatePrice();
  });
  
  // Изменение типа гардин
  curtainTypeSelect.addEventListener('change', (e) => {
    currentCalculation.curtains.type = e.target.value || null;
    calculatePrice();
  });
  
  // Изменение метража гардин
  curtainMetersInput.addEventListener('input', (e) => {
    const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
    currentCalculation.curtains.meters = Number.isFinite(val) && val > 0 ? val : 0;
    calculatePrice();
  });
  
  // Обработка extras checkboxes
  document.addEventListener('change', (e) => {
    if (e.target.classList.contains('extras-checkbox')) {
      const key = e.target.dataset.key;
      if (e.target.checked) {
        currentCalculation.extras[key] = true;
      } else {
        delete currentCalculation.extras[key];
      }
      calculatePrice();
    }
  });
  
  // Добавление в корзину (десктоп)
  if (addToCartBtn) {
    addToCartBtn.addEventListener('click', () => {
      addConstructorToCart();
    });
  }

  // Добавление в корзину (мобильная версия)
  if (addToCartBtnMobile) {
    addToCartBtnMobile.addEventListener('click', () => {
      addConstructorToCart();
    });
  }

  // Быстро добавить комнату и очистить форму под следующую
  if (addRoomButton) {
    addRoomButton.addEventListener('click', () => {
      const added = addConstructorToCart();
      if (added) {
        // Сбрасываем только параметры комнаты, тип оставляем
        areaInput.value = '';
        currentCalculation.area = 0;

        fabricSelect.value = '';
        currentCalculation.fabric = null;

        lightTypeSelect.value = '';
        lightCountInput.value = '';
        currentCalculation.lights = { type: null, count: 0 };

        curtainTypeSelect.value = '';
        curtainMetersInput.value = '';
        currentCalculation.curtains = { type: null, meters: 0 };

        currentCalculation.extras = {};
        document.querySelectorAll('.extras-checkbox').forEach(cb => cb.checked = false);

        calculatePrice();
      }
    });
  }

  if (resetButton) {
    resetButton.addEventListener('click', () => {
      resetConstructorState();
    });
  }

  if (resetButtonMobile) {
    resetButtonMobile.addEventListener('click', () => {
      resetConstructorState();
    });
  }

  // Инициализируем видимость кнопок при загрузке
  updateAddRoomVisibility();
  updateAddToCartVisibility();
}

// Расчет цены
function calculatePrice() {
  if (!pricesData) return;
  
  const section = pricesData[currentCalculation.type];
  if (!section) return;

  let total = 0;
  const details = {
    fabric: { value: 0, formatted: "—" },
    lights: { value: 0, formatted: "—" },
    curtains: { value: 0, formatted: "—" },
    extras: { value: 0, formatted: "—" }
  };

  // Вспомогательная функция: добавить вклад одной комнаты в общий расчет
  function accumulateRoom(calc) {
    const area = parseFloat(calc.area) || 0;
    if (area <= 0) return;

    // Полотно
    if (calc.fabric && section.fabric && section.fabric[calc.fabric]) {
      const fabricPrice = section.fabric[calc.fabric];
      const fabricTotal = area * (fabricPrice.pricePerM2 || 0);
      details.fabric.value += fabricTotal;
      total += fabricTotal;
    }

    // Светильники
    if (calc.lights && calc.lights.type && calc.lights.count > 0 &&
        section.lights && section.lights[calc.lights.type]) {
      const lightPrice = section.lights[calc.lights.type];
      const lightsTotal = calc.lights.count * (lightPrice.pricePerUnit || 0);
      details.lights.value += lightsTotal;
      total += lightsTotal;
    }

    // Гардины
    if (calc.curtains && calc.curtains.type && calc.curtains.meters > 0) {
      const sectionKey = calc.type || currentCalculation.type || 'rooms';
      const curtainsResult = calculateCurtainsPriceForConstructor(
        sectionKey,
        calc.curtains.type,
        calc.curtains.meters,
        pricesData
      );
      details.curtains.value += curtainsResult.numeric;
      total += curtainsResult.numeric;
    }

    // Дополнительно
    if (section.extras && calc.extras) {
      Object.keys(calc.extras).forEach(key => {
        if (section.extras[key]) {
          details.extras.value += section.extras[key].pricePerUnit || 0;
          total += section.extras[key].pricePerUnit || 0;
        }
      });
    }
  }

  if (currentCalculation.type === 'rooms') {
    // Сначала уже добавленные комнаты
    savedRooms.forEach(room => accumulateRoom(room));
    // Плюс текущая (черновик), чтобы клиент видел будущую сумму
    accumulateRoom(currentCalculation);
  } else {
    // Для квартир оставляем поведение «одна конфигурация»
    accumulateRoom(currentCalculation);
  }

  // Форматируем части по категориям, если они > 0
  ["fabric", "lights", "curtains", "extras"].forEach(key => {
    if (details[key].value > 0) {
      details[key].formatted = `${details[key].value.toLocaleString("ru-RU")} ₽`;
    }
  });
  
  // Обновляем UI
  updateCalculationDisplay(details, total);
  
  // Активируем кнопку добавления в корзину если есть минимальные данные (десктоп и мобильная версия)
  const addToCartBtn = document.getElementById('addToCartBtn');
  const addToCartBtnMobile = document.getElementById('addToCartBtnMobile');
  const isEnabled = currentCalculation.area > 0 && currentCalculation.fabric && total > 0;
  
  if (addToCartBtn) {
    addToCartBtn.disabled = !isEnabled;
  }
  if (addToCartBtnMobile) {
    addToCartBtnMobile.disabled = !isEnabled;
  }
}

// Обновление отображения расчета
function updateCalculationDisplay(details, total) {
  document.getElementById('calcFabric').textContent = details.fabric.formatted;
  document.getElementById('calcLights').textContent = details.lights.formatted;
  document.getElementById('calcCurtains').textContent = details.curtains.formatted;

  // Строка «Дополнительно» скрывается, если extras = 0
  const extrasRowValueEl = document.getElementById('calcExtras');
  const extrasRow = extrasRowValueEl ? extrasRowValueEl.closest('.calculation-item') : null;
  if (details.extras.value > 0) {
    extrasRowValueEl.textContent = details.extras.formatted;
    if (extrasRow) extrasRow.style.display = '';
  } else {
    extrasRowValueEl.textContent = '—';
    if (extrasRow) extrasRow.style.display = 'none';
  }

  // Обновляем итоговую сумму (десктоп)
  const totalElement = document.getElementById('calcTotal');
  if (totalElement) {
    if (total > 0) {
      totalElement.textContent = `${total.toLocaleString('ru-RU')} ₽`;
      totalElement.className = 'total-price';
    } else {
      totalElement.textContent = "—";
      totalElement.className = 'total-price';
    }
  }

  // Обновляем итоговую сумму (мобильная версия)
  const totalElementMobile = document.getElementById('calcTotalMobile');
  if (totalElementMobile) {
    if (total > 0) {
      totalElementMobile.textContent = `${total.toLocaleString('ru-RU')} ₽`;
      totalElementMobile.className = 'mobile-total-price';
    } else {
      totalElementMobile.textContent = "—";
      totalElementMobile.className = 'mobile-total-price';
    }
  }
}

// Добавление в корзину
function addConstructorToCart() {
  if (!pricesData) return;
  
  const section = pricesData[currentCalculation.type];
  if (!section) return;
  
  // Формируем название
  const typeName = currentCalculation.type === 'rooms' ? 'Комната' : 'Квартира';
  const fabricName = currentCalculation.fabric || 'Не выбрано';
  const lightsText = currentCalculation.lights.type && currentCalculation.lights.count > 0
    ? `${currentCalculation.lights.count}x ${currentCalculation.lights.type}`
    : 'Нет';
  const curtainsText = currentCalculation.curtains.type && currentCalculation.curtains.meters > 0
    ? `${currentCalculation.curtains.type}, ${currentCalculation.curtains.meters} м`
    : 'Нет';
  
  const extrasList = Object.keys(currentCalculation.extras);
  const extrasText = extrasList.length > 0 ? extrasList.join(', ') : 'Нет';
  
  // Рассчитываем цену ТОЛЬКО для этой конфигурации
  let totalNumeric = 0;
  if (currentCalculation.type === 'rooms') {
    // Для комнат в корзину кладём только материалы/свет/гардины/допы, без монтажа
    const area = parseFloat(currentCalculation.area) || 0;
    if (area > 0) {
      // Полотно
      if (currentCalculation.fabric && section.fabric && section.fabric[currentCalculation.fabric]) {
        const fabricPrice = section.fabric[currentCalculation.fabric];
        totalNumeric += area * (fabricPrice.pricePerM2 || 0);
      }
      // Светильники
      if (currentCalculation.lights && currentCalculation.lights.type && currentCalculation.lights.count > 0 &&
          section.lights && section.lights[currentCalculation.lights.type]) {
        const lightPrice = section.lights[currentCalculation.lights.type];
        totalNumeric += currentCalculation.lights.count * (lightPrice.pricePerUnit || 0);
      }
      // Гардины
      if (currentCalculation.curtains && currentCalculation.curtains.type && currentCalculation.curtains.meters > 0) {
        const curtainsResult = calculateCurtainsPriceForConstructor(
          currentCalculation.type || 'rooms',
          currentCalculation.curtains.type,
          currentCalculation.curtains.meters,
          pricesData
        );
        totalNumeric += curtainsResult.numeric;
      }
      // Дополнительно
      if (section.extras && currentCalculation.extras) {
        Object.keys(currentCalculation.extras).forEach(key => {
          if (section.extras[key]) {
            totalNumeric += section.extras[key].pricePerUnit || 0;
          }
        });
      }
    }
  } else {
    // Для квартир используем полный расчёт с монтажом
    calculatePrice();
    const totalElement = document.getElementById('calcTotal');
    const totalText = totalElement.textContent;
    totalNumeric = parseFloat(totalText.replace(/\s/g, '').replace('₽', '')) || 0;
  }

  const totalText = totalNumeric > 0 ? `${totalNumeric.toLocaleString('ru-RU')} ₽` : "—";
  
  const cartItem = {
    id: `constructor-${Date.now()}-${++constructorItemCounter}`,
    title: `${typeName} (Конструктор)`,
    area: `${currentCalculation.area} м²`,
    fabric: fabricName,
    lights: lightsText,
    curtains: curtainsText,
    extras: extrasText,
    price: totalText,
    priceNumeric: totalNumeric,
    type: 'constructor',
    variant: currentCalculation.type
  };
  
  if (typeof Cart !== 'undefined' && Cart.addItem) {
    const added = Cart.addItem(cartItem);
    if (added) {
      showToast(`${cartItem.title} добавлен в корзину`, 'success');
      if (typeof Cart !== 'undefined' && Cart.updateBadge) {
        Cart.updateBadge();
      }

      // Если работаем с комнатами — сохраняем конфигурацию в общий список для суммарного расчета
      if (currentCalculation.type === 'rooms') {
        savedRooms.push({
          id: cartItem.id,
          type: currentCalculation.type,
          area: currentCalculation.area,
          fabric: currentCalculation.fabric,
          lights: { ...currentCalculation.lights },
          curtains: { ...currentCalculation.curtains },
          extras: { ...currentCalculation.extras }
        });
      }

      return true;
    } else {
      showToast('Ошибка добавления в корзину', 'error');
      return false;
    }
  } else {
    console.error('Cart не определен');
    showToast('Ошибка: корзина не инициализирована', 'error');
    return false;
  }
}

