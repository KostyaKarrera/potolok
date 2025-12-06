#!/bin/bash

# Скрипт оптимизации изображений для мобильной версии
# Требует ImageMagick (convert) или cwebp

echo "🚀 Начинаем оптимизацию изображений для мобильной версии..."
echo ""

PUBLIC_DIR="$(cd "$(dirname "$0")/../public" && pwd)"

# Проверяем наличие ImageMagick
if ! command -v convert &> /dev/null; then
    echo "❌ ImageMagick (convert) не найден. Установите: sudo apt-get install imagemagick"
    exit 1
fi

# Проверяем наличие cwebp
if ! command -v cwebp &> /dev/null; then
    echo "⚠️  cwebp не найден. Установите: sudo apt-get install webp"
    echo "   Продолжаем с ImageMagick..."
fi

# Функция оптимизации WebP изображения
optimize_webp() {
    local input="$1"
    local output="$2"
    local width="$3"
    local quality="$4"
    
    if [ ! -f "$input" ]; then
        echo "⚠️  Файл не найден: $input"
        return 1
    fi
    
    local original_size=$(stat -f%z "$input" 2>/dev/null || stat -c%s "$input" 2>/dev/null)
    
    # Используем ImageMagick для оптимизации
    convert "$input" \
        -resize "${width}x>" \
        -quality "$quality" \
        -define webp:method=6 \
        -define webp:lossless=false \
        "$output" 2>/dev/null || {
        echo "❌ Ошибка оптимизации $input"
        return 1
    }
    
    local new_size=$(stat -f%z "$output" 2>/dev/null || stat -c%s "$output" 2>/dev/null)
    local savings=$(echo "scale=1; (1 - $new_size / $original_size) * 100" | bc)
    
    local original_kb=$(echo "scale=2; $original_size / 1024" | bc)
    local new_kb=$(echo "scale=2; $new_size / 1024" | bc)
    
    echo "✅ $(basename "$input"): ${original_kb} KB → ${new_kb} KB (экономия ${savings}%)"
    return 0
}

# Оптимизируем изображения
echo "📦 Оптимизация изображений..."
echo ""

# IMG_0477.webp - мобильная версия (600px, качество 75%)
optimize_webp \
    "$PUBLIC_DIR/jobs/mobile/IMG_0477.webp" \
    "$PUBLIC_DIR/jobs/mobile/IMG_0477.webp" \
    600 \
    75

# logo.webp - мобильная версия (300px, качество 80%)
optimize_webp \
    "$PUBLIC_DIR/logo/mobile/logo.webp" \
    "$PUBLIC_DIR/logo/mobile/logo.webp" \
    300 \
    80

# Frame 3.webp - мобильная версия (440px для retina, качество 80%)
optimize_webp \
    "$PUBLIC_DIR/reviews/mobile/Frame 3.webp" \
    "$PUBLIC_DIR/reviews/mobile/Frame 3.webp" \
    440 \
    80

echo ""
echo "✅ Оптимизация завершена!"
echo ""
echo "💡 Рекомендации:"
echo "   1. Проверьте качество изображений в браузере"
echo "   2. Если качество недостаточно, увеличьте параметр quality"
echo "   3. Если размер все еще большой, уменьшите width"

