#!/bin/bash
# Безопасный git pull с автоматической обработкой конфликтов
# Используйте этот скрипт вместо обычного git pull

echo "🔄 Безопасный git pull с обработкой конфликтов..."
echo ""

# Всегда сбрасываем автогенерируемые файлы перед pull
echo "💾 Сбрасываем автогенерируемые файлы перед pull..."
echo "   (HTML файлы от deploy.js и font-awesome-custom.css от generate-fa)"
git checkout -- public/*.html public/*/*.html public/css/font-awesome-custom.css 2>/dev/null || true
echo "✅ Автогенерируемые файлы сброшены"
echo ""

# Выполняем git pull
echo "📥 Выполняем git pull..."
git pull --no-rebase

# После успешного pull hook автоматически запустится и обновит HTML файлы

