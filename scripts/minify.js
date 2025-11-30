#!/usr/bin/env node
/**
 * Скрипт минификации CSS и JS файлов
 * Создает минифицированные версии для production
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import postcss from 'postcss';
import cssnano from 'cssnano';
import { minify } from 'terser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_DIR = path.join(__dirname, '../public');

// Минификация CSS
async function minifyCSS() {
  const cssFile = path.join(PUBLIC_DIR, 'css/style.css');
  const outputFile = path.join(PUBLIC_DIR, 'css/style.min.css');
  
  if (!fs.existsSync(cssFile)) {
    console.error('❌ CSS файл не найден:', cssFile);
    return false;
  }
  
  try {
    const css = fs.readFileSync(cssFile, 'utf8');
    const result = await postcss([cssnano({
      preset: ['default', {
        discardComments: { removeAll: true },
        normalizeWhitespace: true,
        minifyFontValues: true,
        minifySelectors: true,
        reduceIdents: false, // Не минифицируем идентификаторы
        zindex: false // Не оптимизируем z-index
      }]
    })]).process(css, { from: cssFile, to: outputFile });
    
    fs.writeFileSync(outputFile, result.css);
    
    const originalSize = fs.statSync(cssFile).size;
    const minifiedSize = fs.statSync(outputFile).size;
    const savings = ((1 - minifiedSize / originalSize) * 100).toFixed(1);
    
    console.log(`✅ CSS минифицирован: ${(minifiedSize / 1024).toFixed(2)} KB (экономия ${savings}%)`);
    return true;
  } catch (err) {
    console.error('❌ Ошибка минификации CSS:', err.message);
    return false;
  }
}

// Минификация JS
async function minifyJS() {
  const jsFile = path.join(PUBLIC_DIR, 'js/main.js');
  const outputFile = path.join(PUBLIC_DIR, 'js/main.min.js');
  
  if (!fs.existsSync(jsFile)) {
    console.error('❌ JS файл не найден:', jsFile);
    return false;
  }
  
  try {
    const js = fs.readFileSync(jsFile, 'utf8');
    const result = await minify(js, {
      compress: {
        drop_console: false, // Оставляем console для отладки
        drop_debugger: true,
        pure_funcs: ['console.debug', 'console.trace'], // Удаляем только debug/trace
        passes: 2 // Два прохода для лучшей оптимизации
      },
      mangle: {
        reserved: ['Cart', 'showToast', 'showModal', 'hideModal'] // Не минифицируем важные функции
      },
      format: {
        comments: false // Удаляем комментарии
      }
    });
    
    if (result.error) {
      throw result.error;
    }
    
    fs.writeFileSync(outputFile, result.code);
    
    const originalSize = fs.statSync(jsFile).size;
    const minifiedSize = fs.statSync(outputFile).size;
    const savings = ((1 - minifiedSize / originalSize) * 100).toFixed(1);
    
    console.log(`✅ JS минифицирован: ${(minifiedSize / 1024).toFixed(2)} KB (экономия ${savings}%)`);
    return true;
  } catch (err) {
    console.error('❌ Ошибка минификации JS:', err.message);
    return false;
  }
}

// Главная функция
async function main() {
  console.log('🚀 Начинаем минификацию...\n');
  
  const [cssResult, jsResult] = await Promise.all([
    minifyCSS(),
    minifyJS()
  ]);
  
  console.log('\n📊 Результаты:');
  if (cssResult && jsResult) {
    console.log('✅ Все файлы успешно минифицированы!');
    console.log('\n💡 Для использования минифицированных версий обновите ссылки в HTML:');
    console.log('   - /css/style.css → /css/style.min.css');
    console.log('   - /js/main.js → /js/main.min.js');
  } else {
    console.log('⚠️  Некоторые файлы не удалось минифицировать');
    process.exit(1);
  }
}

main().catch(console.error);

