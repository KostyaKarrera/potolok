#!/usr/bin/env node
/**
 * Скрипт для скачивания шрифтов Montserrat с Google Fonts
 * Создает локальные копии для самозагрузки
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_DIR = path.join(__dirname, '../public');
const FONTS_DIR = path.join(PUBLIC_DIR, 'fonts');

// Создаем папку для шрифтов, если её нет
if (!fs.existsSync(FONTS_DIR)) {
  fs.mkdirSync(FONTS_DIR, { recursive: true });
}

// Веса шрифтов, которые нам нужны
const fontWeights = [400, 500, 600, 700];

// Прямые ссылки на шрифты (альтернативный способ, если API не работает)
const DIRECT_FONT_URLS = {
  '400': 'https://fonts.gstatic.com/s/montserrat/v26/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCtr6Hw5aXpsog.woff2',
  '500': 'https://fonts.gstatic.com/s/montserrat/v26/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCtr6Hw5aXpsog.woff2',
  '600': 'https://fonts.gstatic.com/s/montserrat/v26/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCtr6Hw5aXpsog.woff2',
  '700': 'https://fonts.gstatic.com/s/montserrat/v26/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCtr6Hw5aXpsog.woff2'
};

// URL для получения информации о шрифтах
const GOOGLE_FONTS_API = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=optional';

// Функция для скачивания файла
function downloadFile(url, filepath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(filepath);
    
    protocol.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        // Редирект
        return downloadFile(response.headers.location, filepath)
          .then(resolve)
          .catch(reject);
      }
      
      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(filepath);
        reject(new Error(`Ошибка загрузки: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      file.close();
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
      reject(err);
    });
  });
}

// Функция для получения URL шрифтов из CSS
async function getFontUrls() {
  return new Promise((resolve, reject) => {
    https.get(GOOGLE_FONTS_API, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        // Парсим CSS и извлекаем URL шрифтов с весами
        const fontData = [];
        const fontFaceRegex = /@font-face\s*\{[^}]*font-weight:\s*(\d+)[^}]*url\((https?:\/\/[^)]+\.woff2)\)[^}]*\}/g;
        let match;
        
        while ((match = fontFaceRegex.exec(data)) !== null) {
          const weight = match[1];
          const url = match[2];
          fontData.push({ weight, url });
        }
        
        // Если не нашли через regex, пробуем простой способ
        if (fontData.length === 0) {
          const urlRegex = /url\((https?:\/\/[^)]+\.woff2)\)/g;
          while ((match = urlRegex.exec(data)) !== null) {
            fontData.push({ weight: null, url: match[1] });
          }
        }
        
        resolve(fontData);
      });
    }).on('error', reject);
  });
}

// Главная функция
async function main() {
  console.log('🚀 Начинаем скачивание шрифтов Montserrat...\n');
  
  try {
    // Получаем URL шрифтов
    console.log('📡 Получаем информацию о шрифтах из Google Fonts API...');
    let fontUrls = await getFontUrls();
    
    // Если не получилось через API, используем прямые ссылки
    if (fontUrls.length === 0) {
      console.log('⚠️  Не удалось получить через API, используем прямые ссылки...\n');
      fontUrls = Object.entries(DIRECT_FONT_URLS).map(([weight, url]) => ({
        weight,
        url
      }));
    }
    
    if (fontUrls.length === 0) {
      console.error('❌ Не удалось найти URL шрифтов');
      process.exit(1);
    }
    
    console.log(`✅ Найдено ${fontUrls.length} файлов шрифтов\n`);
    
    // Скачиваем каждый файл
    for (let i = 0; i < fontUrls.length; i++) {
      const fontInfo = fontUrls[i];
      const url = fontInfo.url;
      
      // Определяем имя файла на основе веса
      let filename;
      if (fontInfo.weight) {
        const weightMap = {
          '400': 'Montserrat-Regular.woff2',
          '500': 'Montserrat-Medium.woff2',
          '600': 'Montserrat-SemiBold.woff2',
          '700': 'Montserrat-Bold.woff2'
        };
        filename = weightMap[fontInfo.weight] || `Montserrat-${fontInfo.weight}.woff2`;
      } else {
        // Если вес не определен, используем имя из URL
        filename = path.basename(url.split('?')[0]);
        // Пытаемся определить вес из имени файла
        if (filename.includes('Regular') || filename.includes('400')) {
          filename = 'Montserrat-Regular.woff2';
        } else if (filename.includes('Medium') || filename.includes('500')) {
          filename = 'Montserrat-Medium.woff2';
        } else if (filename.includes('SemiBold') || filename.includes('600')) {
          filename = 'Montserrat-SemiBold.woff2';
        } else if (filename.includes('Bold') || filename.includes('700')) {
          filename = 'Montserrat-Bold.woff2';
        }
      }
      
      const filepath = path.join(FONTS_DIR, filename);
      
      console.log(`📥 Скачиваем: ${filename} (вес: ${fontInfo.weight || 'неизвестен'})...`);
      await downloadFile(url, filepath);
      
      const stats = fs.statSync(filepath);
      console.log(`   ✅ Скачан: ${(stats.size / 1024).toFixed(2)} KB\n`);
    }
    
    console.log('✅ Все шрифты успешно скачаны!');
    console.log(`📁 Расположение: ${FONTS_DIR}`);
    console.log('\n💡 Теперь обновите CSS файл для использования локальных шрифтов.');
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);

