#!/usr/bin/env node
/**
 * Скрипт автоматического деплоя
 * Запускается на сервере после git pull
 * 
 * Выполняет:
 * 1. Генерацию кастомного Font Awesome CSS
 * 2. Минификацию CSS и JS
 * 3. Обновление HTML файлов для использования минифицированных версий
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
  'yoshkar-ola/index.html',
  '404.html'
];

console.log('🚀 Начинаем автоматический деплой...\n');

// Шаг 0: Генерация кастомного Font Awesome CSS
async function generateCustomFA() {
  console.log('🎨 Шаг 0: Генерация кастомного Font Awesome CSS...');
  try {
    const { stdout, stderr } = await execAsync('npm run generate-fa', {
      cwd: path.join(__dirname, '..')
    });
    console.log(stdout);
    if (stderr) console.error(stderr);
    return true;
  } catch (error) {
    console.error('❌ Ошибка генерации Font Awesome:', error.message);
    return false;
  }
}

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

// Автоматическое обнаружение HTML файлов, использующих основные CSS/JS
function findHTMLFilesWithAssets() {
  const htmlFiles = [];
  
  function scanDirectory(dir, basePath = '') {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;
      
      if (entry.isDirectory()) {
        // Пропускаем node_modules, служебные папки и папки с собственными CSS/JS
        if (!['node_modules', '.git', '.vscode', 'admin', 'partners'].includes(entry.name)) {
          scanDirectory(fullPath, relativePath);
        }
      } else if (entry.isFile() && entry.name.endsWith('.html')) {
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          // Проверяем, использует ли файл основные CSS/JS
          if (/\/css\/style\.css/.test(content) || /\/js\/main\.js/.test(content)) {
            htmlFiles.push(relativePath);
          }
        } catch (err) {
          // Игнорируем ошибки чтения
        }
      }
    }
  }
  
  scanDirectory(PUBLIC_DIR);
  return htmlFiles;
}

// Шаг 2: Обновление HTML файлов
function updateHTMLFiles() {
  console.log('\n📝 Шаг 2: Обновление HTML файлов...');
  
  // Объединяем явно указанные файлы с автоматически найденными
  const autoFoundFiles = findHTMLFilesWithAssets();
  const allFiles = [...new Set([...HTML_FILES, ...autoFoundFiles])];
  
  console.log(`📋 Найдено HTML файлов для обновления: ${allFiles.length}`);
  if (autoFoundFiles.length > 0) {
    console.log(`   (автоматически найдено: ${autoFoundFiles.length})`);
  }
  
  let updated = 0;
  let errors = 0;
  
  for (const htmlFile of allFiles) {
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
      // Проверяем, что файл содержит /css/style.css и НЕ содержит уже минифицированную версию
      const hasStyleCSS = /\/css\/style\.css/.test(content);
      const hasStyleMinCSS = /\/css\/style\.min\.css/.test(content);
      
      if (hasStyleCSS && !hasStyleMinCSS) {
        // Заменяем все вхождения /css/style.css на /css/style.min.css
        content = content.replace(
          /\/css\/style\.css/g,
          '/css/style.min.css'
        );
        changed = true;
      }
      
      // Заменяем ссылки на JS
      // Проверяем, что файл содержит /js/main.js и НЕ содержит уже минифицированную версию
      const hasMainJS = /\/js\/main\.js/.test(content);
      const hasMainMinJS = /\/js\/main\.min\.js/.test(content);
      
      if (hasMainJS && !hasMainMinJS) {
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
        // Проверяем, почему файл не был обновлен
        if (hasStyleMinCSS && hasMainMinJS) {
          console.log(`⏭️  Пропущен (уже обновлен): ${htmlFile}`);
        } else if (!hasStyleCSS && !hasMainJS) {
          console.log(`⏭️  Пропущен (не использует style.css/main.js): ${htmlFile}`);
        } else {
          console.log(`⚠️  Пропущен (частично обновлен?): ${htmlFile}`);
        }
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
  
  // Генерируем кастомный Font Awesome CSS
  const faSuccess = await generateCustomFA();
  if (!faSuccess) {
    console.error('\n⚠️  Ошибка генерации Font Awesome. Продолжаем деплой...');
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

