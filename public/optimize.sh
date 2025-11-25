#!/bin/bash

echo "🚀 Начинаем оптимизацию WebP изображений..."

# Конвертируем каждый .webp файл в папке jobs
for img in *.webp; do
  if [ -f "$img" ]; then
    echo "Оптимизируем: $img"
    
    # Создаем мобильную версию (600px ширины, качество 75%)
    convert "$img" -resize 600x -quality 75 "mobile/$img"
    
    echo "✅ Готово: mobile/$img"
  fi
done

echo "🎉 Все WebP изображения оптимизированы!"