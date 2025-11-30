#!/usr/bin/env node
/**
 * Production build скрипт
 * Минифицирует CSS и JS, создает оптимизированные версии
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔨 Запуск production build...\n');

try {
  // Запускаем минификацию
  const { stdout, stderr } = await execAsync('node scripts/minify.js', {
    cwd: path.join(__dirname, '..')
  });
  
  console.log(stdout);
  if (stderr) console.error(stderr);
  
  console.log('\n✅ Build завершен успешно!');
} catch (error) {
  console.error('❌ Ошибка при сборке:', error.message);
  process.exit(1);
}

