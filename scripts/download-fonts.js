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
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    };
    
    https.get(GOOGLE_FONTS_API, options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        // Парсим CSS и извлекаем URL шрифтов с весами
        const fontData = [];
        
        // Разбиваем CSS на отдельные @font-face блоки
        const fontFaceBlocks = data.match(/@font-face\s*\{[^}]+\}/g) || [];
        
        fontFaceBlocks.forEach(block => {
          // Извлекаем font-weight
          const weightMatch = block.match(/font-weight:\s*(\d+)/);
          const weight = weightMatch ? weightMatch[1] : null;
          
          // Извлекаем URL
          const urlMatch = block.match(/url\((https?:\/\/[^)]+\.woff2)\)/);
          const url = urlMatch ? urlMatch[1] : null;
          
          if (weight && url) {
            fontData.push({ weight, url });
          }
        });
        
        // Если не нашли через regex, пробуем простой способ
        if (fontData.length === 0) {
          const urlRegex = /url\((https?:\/\/[^)]+\.woff2)\)/g;
          let match;
          let index = 0;
          while ((match = urlRegex.exec(data)) !== null) {
            const weight = fontWeights[index] || null;
            fontData.push({ weight, url: match[1] });
            index++;
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
    // Всегда получаем URL для каждого веса отдельно из Google Fonts API
    console.log('📡 Получаем правильные URL для каждого веса из Google Fonts API...\n');
    
    const weightMap = {
      '400': { name: 'Montserrat-Regular.woff2', url: 'https://fonts.gstatic.com/s/montserrat/v26/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCtr6Hw5aXpsog.woff2' },
      '500': { name: 'Montserrat-Medium.woff2', url: 'https://fonts.gstatic.com/s/montserrat/v26/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCtr6Hw5aXpsog.woff2' },
      '600': { name: 'Montserrat-SemiBold.woff2', url: 'https://fonts.gstatic.com/s/montserrat/v26/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCtr6Hw5aXpsog.woff2' },
      '700': { name: 'Montserrat-Bold.woff2', url: 'https://fonts.gstatic.com/s/montserrat/v26/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCtr6Hw5aXpsog.woff2' }
    };
    
    // Скачиваем каждый вес отдельно, получая правильный URL из Google Fonts API
    for (const weight of fontWeights) {
      const weightInfo = weightMap[weight.toString()];
      if (!weightInfo) continue;
      
      // Получаем URL для конкретного веса
      const weightApiUrl = `https://fonts.googleapis.com/css2?family=Montserrat:wght@${weight}&display=swap`;
      
      try {
        const weightCss = await new Promise((resolve, reject) => {
          https.get(weightApiUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => resolve(data));
          }).on('error', reject);
        });
        
        // Извлекаем URL из CSS
        const urlMatch = weightCss.match(/url\((https?:\/\/[^)]+\.woff2)\)/);
        const url = urlMatch ? urlMatch[1] : weightInfo.url;
        
        const filepath = path.join(FONTS_DIR, weightInfo.name);
        
        console.log(`📥 Скачиваем: ${weightInfo.name} (вес: ${weight})...`);
        await downloadFile(url, filepath);
        
        const stats = fs.statSync(filepath);
        console.log(`   ✅ Скачан: ${(stats.size / 1024).toFixed(2)} KB\n`);
      } catch (err) {
        console.log(`⚠️  Ошибка для веса ${weight} (${err.message}), используем fallback URL...`);
        const filepath = path.join(FONTS_DIR, weightInfo.name);
        await downloadFile(weightInfo.url, filepath);
        const stats = fs.statSync(filepath);
        console.log(`   ✅ Скачан: ${(stats.size / 1024).toFixed(2)} KB\n`);
      }
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

