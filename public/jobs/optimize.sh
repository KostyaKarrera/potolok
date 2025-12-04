#!/bin/bash

echo "🚀 Начинаем оптимизацию WebP изображений..."

# Создаем папку для мобильных версий если её нет
mkdir -p mobile

# Конвертируем каждый .webp файл
for img in *.webp; do
  if [ -f "$img" ]; then
    echo "Оптимизируем: $img"
    
    # Создаем мобильную версию (600px ширины, качество 75%)
    convert "$img" -resize 600x -quality 75 "mobile/$img"
    
    echo "✅ Готово: mobile/$img"
  fi
done

echo "🎉 Все WebP изображения оптимизированы!"
