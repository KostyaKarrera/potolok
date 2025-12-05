#!/bin/bash
# Безопасный git pull с автоматической обработкой конфликтов
# Используйте этот скрипт вместо обычного git pull

echo "🔄 Безопасный git pull с обработкой конфликтов..."
echo ""

# Если есть локальные изменения в HTML файлах (от deploy.js) или в font-awesome-custom.css (автогенерируемый)
if ! git diff --quiet public/*.html public/*/*.html public/css/font-awesome-custom.css 2>/dev/null; then
    echo "💾 Обнаружены локальные изменения в HTML файлах или font-awesome-custom.css"
    echo "   (это нормально - они созданы deploy.js/generate-fa для использования минифицированных/оптимизированных версий)"
    echo "   Сбрасываем их перед pull..."
    git checkout -- public/*.html public/*/*.html public/css/font-awesome-custom.css 2>/dev/null || true
    echo "✅ Локальные изменения сброшены"
    echo ""
fi

# Выполняем git pull
echo "📥 Выполняем git pull..."
git pull --no-rebase

# После успешного pull hook автоматически запустится и обновит HTML файлы

