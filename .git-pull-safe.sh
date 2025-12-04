#!/bin/bash
# Безопасный git pull с автоматической обработкой конфликтов
# Используйте этот скрипт вместо обычного git pull

echo "🔄 Безопасный git pull с обработкой конфликтов..."
echo ""

# Если есть локальные изменения в HTML файлах (от deploy.js)
if ! git diff --quiet public/*.html public/*/*.html 2>/dev/null; then
    echo "💾 Обнаружены локальные изменения в HTML файлах"
    echo "   (это нормально - они созданы deploy.js для использования минифицированных версий)"
    echo "   Сбрасываем их перед pull..."
    git checkout -- public/*.html public/*/*.html 2>/dev/null || true
    echo "✅ Локальные изменения сброшены"
    echo ""
fi

# Выполняем git pull
echo "📥 Выполняем git pull..."
git pull --no-rebase

# После успешного pull hook автоматически запустится и обновит HTML файлы

