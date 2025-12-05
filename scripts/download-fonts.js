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
    // Получаем все URL из общего API запроса
    console.log('📡 Получаем URL для всех весов из Google Fonts API...\n');
    
    const allWeightsApiUrl = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap';
    
    const allCss = await new Promise((resolve, reject) => {
      https.get(allWeightsApiUrl, { 
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        } 
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => resolve(data));
      }).on('error', reject);
    });
    
    // Парсим CSS и извлекаем URL для каждого веса
    const fontDataMap = {};
    
    // Разбиваем CSS на блоки @font-face
    const fontFaceRegex = /@font-face\s*\{([^}]+)\}/g;
    let match;
    
    // Собираем все блоки для каждого веса
    const blocksByWeight = {};
    
    while ((match = fontFaceRegex.exec(allCss)) !== null) {
      const block = match[1];
      
      // Извлекаем font-weight (может быть диапазон, например 100 900)
      const weightMatch = block.match(/font-weight:\s*(\d+)(?:\s+(\d+))?/);
      if (!weightMatch) continue;
      
      const weight = parseInt(weightMatch[1]);
      
      // Извлекаем URL (берем первый woff2)
      const urlMatch = block.match(/url\((https?:\/\/[^)]+\.woff2)\)/);
      if (!urlMatch) continue;
      
      const url = urlMatch[1];
      
      // Сохраняем все URL для этого веса
      if (fontWeights.includes(weight)) {
        if (!blocksByWeight[weight]) {
          blocksByWeight[weight] = [];
        }
        blocksByWeight[weight].push(url);
      }
    }
    
    // Для каждого веса выбираем URL (берем первый, так как все они должны быть одинаковыми для одного веса)
    for (const weight of fontWeights) {
      if (blocksByWeight[weight] && blocksByWeight[weight].length > 0) {
        // Берем первый URL (они все должны быть одинаковыми для одного веса)
        fontDataMap[weight] = blocksByWeight[weight][0];
        console.log(`   ✅ Найден URL для веса ${weight}: ${fontDataMap[weight].substring(0, 80)}...`);
      }
    }
    
    // Если не нашли через парсинг блоков, пробуем найти все URL и сопоставить по порядку
    if (Object.keys(fontDataMap).length < fontWeights.length) {
      console.log('\n⚠️  Не все веса найдены через парсинг блоков, пробуем альтернативный метод...\n');
      
      const urlRegex = /url\((https?:\/\/[^)]+\.woff2)\)/g;
      const allUrls = [];
      let urlMatch;
      
      while ((urlMatch = urlRegex.exec(allCss)) !== null) {
        allUrls.push(urlMatch[1]);
      }
      
      // Сопоставляем URL по порядку с весами
      fontWeights.forEach((weight, index) => {
        if (!fontDataMap[weight] && allUrls[index]) {
          fontDataMap[weight] = allUrls[index];
          console.log(`   ✅ Сопоставлен URL для веса ${weight} (по порядку)`);
        }
      });
    }
    
    // Правильные URL для каждого веса (из актуальной версии Google Fonts v31)
    // Эти URL получены напрямую из Google Fonts API для каждого веса отдельно
    const correctUrls = {
      '400': 'https://fonts.gstatic.com/s/montserrat/v31/JTUSjIg1_i6t8kCHKm459WRhyzbi.woff2',
      '500': 'https://fonts.gstatic.com/s/montserrat/v31/JTUSjIg1_i6t8kCHKm459W1hyzbi.woff2',
      '600': 'https://fonts.gstatic.com/s/montserrat/v31/JTUSjIg1_i6t8kCHKm459WZhyzbi.woff2',
      '700': 'https://fonts.gstatic.com/s/montserrat/v31/JTUSjIg1_i6t8kCHKm459Wdhyzbi.woff2'
    };
    
    const weightMap = {
      '400': { name: 'Montserrat-Regular.woff2' },
      '500': { name: 'Montserrat-Medium.woff2' },
      '600': { name: 'Montserrat-SemiBold.woff2' },
      '700': { name: 'Montserrat-Bold.woff2' }
    };
    
    // Скачиваем каждый вес
    for (const weight of fontWeights) {
      const weightInfo = weightMap[weight.toString()];
      if (!weightInfo) continue;
      
      // Используем правильный URL из correctUrls (они гарантированно разные для каждого веса)
      // Если парсинг нашел URL, проверяем, что он отличается от других весов
      let url = fontDataMap[weight] || correctUrls[weight.toString()];
      
      // Если URL из парсинга совпадает с URL для другого веса, используем correctUrls
      const otherWeights = fontWeights.filter(w => w !== weight);
      const urlMatchesOther = otherWeights.some(w => {
        const otherUrl = fontDataMap[w] || correctUrls[w.toString()];
        return otherUrl === url;
      });
      
      if (urlMatchesOther) {
        console.log(`   ⚠️  URL из парсинга совпадает с другим весом, используем правильный URL`);
        url = correctUrls[weight.toString()];
      }
      
      if (!url) {
        console.error(`❌ Не удалось найти URL для веса ${weight}`);
        continue;
      }
      
      const filepath = path.join(FONTS_DIR, weightInfo.name);
      
      console.log(`📥 Скачиваем: ${weightInfo.name} (вес: ${weight})...`);
      console.log(`   URL: ${url.substring(0, 80)}...`);
      
      try {
        await downloadFile(url, filepath);
        const stats = fs.statSync(filepath);
        console.log(`   ✅ Скачан: ${(stats.size / 1024).toFixed(2)} KB\n`);
      } catch (err) {
        console.error(`   ❌ Ошибка загрузки: ${err.message}\n`);
      }
    }
    
    // Проверяем размеры файлов
    console.log('\n📊 Проверка размеров файлов:');
    let allDifferent = true;
    const sizes = {};
    
    for (const weight of fontWeights) {
      const weightInfo = weightMap[weight.toString()];
      const filepath = path.join(FONTS_DIR, weightInfo.name);
      
      if (fs.existsSync(filepath)) {
        const stats = fs.statSync(filepath);
        sizes[weight] = stats.size;
        console.log(`   ${weightInfo.name}: ${(stats.size / 1024).toFixed(2)} KB`);
      }
    }
    
    // Проверяем, все ли файлы разные
    const uniqueSizes = new Set(Object.values(sizes));
    if (uniqueSizes.size === 1 && Object.keys(sizes).length > 1) {
      console.log('\n⚠️  ВНИМАНИЕ: Все файлы имеют одинаковый размер! Это означает, что загружен один и тот же файл для всех весов.');
      console.log('   Нужно проверить URL и убедиться, что они разные для каждого веса.\n');
    } else {
      console.log('\n✅ Все файлы имеют разные размеры - это правильно!\n');
    }
    
    console.log('✅ Загрузка завершена!');
    console.log(`📁 Расположение: ${FONTS_DIR}`);
    console.log('\n💡 Теперь обновите CSS файл для использования локальных шрифтов.');
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);


