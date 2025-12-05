#!/bin/bash
# Скрипт для исправления прав доступа на файлы шрифтов

echo "🔧 Исправляем права доступа на файлы шрифтов..."

# Переходим в директорию проекта
cd ~/potolok || exit 1

# Даем права на чтение всем для файлов шрифтов
chmod 644 public/fonts/*.woff2

# Даем права на чтение и выполнение для директории fonts
chmod 755 public/fonts

# Опционально: меняем владельца на www-data (если нужно)
# sudo chown www-data:www-data public/fonts/*.woff2
# sudo chown www-data:www-data public/fonts

echo "✅ Права доступа исправлены!"
echo ""
echo "Проверьте права:"
ls -la public/fonts/

