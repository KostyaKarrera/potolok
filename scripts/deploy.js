#!/usr/bin/env node
/**
 * Скрипт автоматического деплоя
 * Запускается на сервере после git pull
 * 
 * Выполняет:
 * 1. Минификацию CSS и JS
 * 2. Обновление HTML файлов для использования минифицированных версий
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_DIR = path.join(__dirname, '../public');

// HTML файлы для обновления
const HTML_FILES = [
  'index.html',
  'ready-solutions/index.html',
  'constructor/index.html',
  'about/index.html',
  'cheboksary/index.html',
  'novocheboksarsk/index.html',
  'yoshkar-ola/index.html'
];

console.log('🚀 Начинаем автоматический деплой...\n');

// Шаг 1: Минификация
async function minifyFiles() {
  console.log('📦 Шаг 1: Минификация CSS и JS...');
  try {
    const { stdout, stderr } = await execAsync('node scripts/minify.js', {
      cwd: path.join(__dirname, '..')
    });
    console.log(stdout);
    if (stderr) console.error(stderr);
    return true;
  } catch (error) {
    console.error('❌ Ошибка минификации:', error.message);
    return false;
  }
}

// Шаг 2: Обновление HTML файлов
function updateHTMLFiles() {
  console.log('\n📝 Шаг 2: Обновление HTML файлов...');
  
  let updated = 0;
  let errors = 0;
  
  for (const htmlFile of HTML_FILES) {
    const filePath = path.join(PUBLIC_DIR, htmlFile);
    
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  Файл не найден: ${htmlFile}`);
      errors++;
      continue;
    }
    
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      let changed = false;
      
      // Заменяем ссылки на CSS (включая preload)
      if (content.includes('/css/style.css') && !content.includes('/css/style.min.css')) {
        // Заменяем все вхождения /css/style.css на /css/style.min.css
        content = content.replace(
          /\/css\/style\.css/g,
          '/css/style.min.css'
        );
        changed = true;
      }
      
      // Заменяем ссылки на JS
      if (content.includes('/js/main.js') && !content.includes('/js/main.min.js')) {
        // Заменяем все вхождения /js/main.js на /js/main.min.js
        content = content.replace(
          /\/js\/main\.js/g,
          '/js/main.min.js'
        );
        changed = true;
      }
      
      if (changed) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`✅ Обновлен: ${htmlFile}`);
        updated++;
      } else {
        console.log(`⏭️  Пропущен (уже обновлен): ${htmlFile}`);
      }
    } catch (error) {
      console.error(`❌ Ошибка при обновлении ${htmlFile}:`, error.message);
      errors++;
    }
  }
  
  console.log(`\n📊 Обновлено файлов: ${updated}, ошибок: ${errors}`);
  return errors === 0;
}

// Главная функция
async function main() {
  // Проверяем, что мы на сервере (можно добавить проверку переменной окружения)
  const isProduction = process.env.NODE_ENV === 'production' || process.argv.includes('--production');
  
  if (!isProduction) {
    console.log('⚠️  Внимание: скрипт запущен не в production режиме');
    console.log('   Используйте: NODE_ENV=production node scripts/deploy.js');
    console.log('   или: node scripts/deploy.js --production\n');
  }
  
  // Выполняем минификацию
  const minifySuccess = await minifyFiles();
  if (!minifySuccess) {
    console.error('\n❌ Ошибка минификации. Деплой прерван.');
    process.exit(1);
  }
  
  // Обновляем HTML файлы
  const updateSuccess = updateHTMLFiles();
  if (!updateSuccess) {
    console.error('\n⚠️  Были ошибки при обновлении HTML файлов.');
  }
  
  console.log('\n✅ Деплой завершен успешно!');
  console.log('💡 Перезапустите сервер: sudo systemctl restart potolok.service');
}

main().catch(error => {
  console.error('❌ Критическая ошибка:', error);
  process.exit(1);
});

