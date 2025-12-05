#!/usr/bin/env node
/**
 * Скрипт для генерации кастомного Font Awesome CSS
 * Извлекает только используемые иконки из полного font-awesome.css
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_DIR = path.join(__dirname, '../public');
const FA_CSS = path.join(PUBLIC_DIR, 'css/font-awesome.css');
const OUTPUT_CSS = path.join(PUBLIC_DIR, 'css/font-awesome-custom.css');

// Список используемых иконок (из анализа всех HTML файлов)
const USED_ICONS = {
  solid: [
    'phone', 'shopping-cart', 'clock', 'shield-alt', 'smile', 
    'shopping-bag', 'tools', 'map', 'handshake', 'gift', 
    'check-circle', 'clipboard-list', 'trash', 'star', 'plus', 
    'undo', 'chevron-down', 'arrow-up'
  ],
  brands: [
    'telegram', 'whatsapp', 'vk', 'google', 'yandex'
  ]
};

// Unicode коды для иконок (Font Awesome 6.x)
const ICON_UNICODES = {
  solid: {
    'phone': '\\f095',
    'shopping-cart': '\\f07a',
    'clock': '\\f017',
    'shield-alt': '\\f3ed',
    'smile': '\\f118',
    'shopping-bag': '\\f290',
    'tools': '\\f7d9',
    'map': '\\f279',
    'handshake': '\\f2b5',
    'gift': '\\f06b',
    'check-circle': '\\f058',
    'clipboard-list': '\\f46d',
    'trash': '\\f2ed',
    'star': '\\f005',
    'plus': '\\f067',
    'undo': '\\f0e2',
    'chevron-down': '\\f078',
    'arrow-up': '\\f062'
  },
  brands: {
    'telegram': '\\f2c6',
    'whatsapp': '\\f232',
    'vk': '\\f189',
    'google': '\\f1a0',
    'yandex': '\\f413'
  }
};

function generateCustomFA() {
  console.log('🎨 Генерируем кастомный Font Awesome CSS...\n');
  
  // Читаем оригинальный CSS для получения базовых стилей
  let originalCSS = '';
  try {
    originalCSS = fs.readFileSync(FA_CSS, 'utf8');
  } catch (err) {
    console.error('❌ Не удалось прочитать font-awesome.css');
    process.exit(1);
  }
  
  // Извлекаем @font-face правила
  const fontFaceRegex = /@font-face\s*\{[^}]+\}/g;
  const fontFaces = originalCSS.match(fontFaceRegex) || [];
  
  // Извлекаем стили для используемых иконок из оригинального CSS
  const iconStyles = {};
  const allIcons = [...USED_ICONS.solid.map(i => `fa-${i}`), ...USED_ICONS.brands.map(i => `fa-${i}`)];
  
  allIcons.forEach(iconClass => {
    // Ищем стили для иконки - более гибкий поиск
    const escapedClass = iconClass.replace(/-/g, '\\-');
    // Ищем паттерны типа .fa-phone:before, .fa-phone::before, .fa-phone, и т.д.
    const patterns = [
      new RegExp(`\\.${escapedClass}(::?before|,|\\.|\\s|\\{)[^}]*\\{[^}]*content:[^}]*\\}`, 'g'),
      new RegExp(`\\.${escapedClass}[^}]*\\{[^}]*content:[^}]*\\}`, 'g')
    ];
    
    for (const pattern of patterns) {
      const matches = originalCSS.match(pattern);
      if (matches && matches.length > 0) {
        // Берем первый найденный стиль
        iconStyles[iconClass] = matches[0];
        break;
      }
    }
  });
  
  // Создаем кастомный CSS
  let customCSS = `/*! 
 * Custom Font Awesome CSS
 * Generated automatically - contains only used icons
 * Original: Font Awesome 6.x
 */
\n`;
  
  // Добавляем @font-face правила
  customCSS += fontFaces.join('\n\n') + '\n\n';
  
  // Добавляем базовые стили
  customCSS += `/* Base styles */\n`;
  customCSS += `.fa, .fas, .fab {
  font-family: "Font Awesome 6 Free";
  font-weight: 900;
  -webkit-font-smoothing: antialiased;
  display: inline-block;
  font-style: normal;
  font-variant: normal;
  text-rendering: auto;
  line-height: 1;
}

.fab {
  font-family: "Font Awesome 6 Brands";
  font-weight: 400;
}

.fas {
  font-family: "Font Awesome 6 Free";
  font-weight: 900;
}

\n`;
  
  // Добавляем стили для каждой используемой иконки
  customCSS += `/* Solid icons */\n`;
  USED_ICONS.solid.forEach(icon => {
    const iconClass = `fa-${icon}`;
    if (iconStyles[iconClass]) {
      customCSS += iconStyles[iconClass] + '\n';
    } else {
      // Fallback - используем Unicode коды
      const unicode = ICON_UNICODES.solid[icon];
      if (unicode) {
        customCSS += `.fa-${icon}::before { content: "${unicode}"; }\n`;
      }
    }
  });
  
  customCSS += `\n/* Brand icons */\n`;
  USED_ICONS.brands.forEach(icon => {
    const iconClass = `fa-${icon}`;
    if (iconStyles[iconClass]) {
      customCSS += iconStyles[iconClass] + '\n';
    } else {
      // Fallback - используем Unicode коды
      const unicode = ICON_UNICODES.brands[icon];
      if (unicode) {
        customCSS += `.fa-${icon}::before { content: "${unicode}"; }\n`;
      }
    }
  });
  
  // Сохраняем файл
  fs.writeFileSync(OUTPUT_CSS, customCSS, 'utf8');
  
  const originalSize = fs.statSync(FA_CSS).size;
  const customSize = fs.statSync(OUTPUT_CSS).size;
  const savings = ((1 - customSize / originalSize) * 100).toFixed(1);
  
  console.log(`✅ Кастомный Font Awesome CSS создан!`);
  console.log(`📁 Файл: ${OUTPUT_CSS}`);
  console.log(`📊 Размер: ${(customSize / 1024).toFixed(2)} KB (было ${(originalSize / 1024).toFixed(2)} KB)`);
  console.log(`💰 Экономия: ${savings}%`);
  console.log(`\n💡 Теперь замените font-awesome.css на font-awesome-custom.css в HTML файлах.`);
}

generateCustomFA();

