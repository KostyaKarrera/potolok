# Инструкция по оптимизации изображений

## Проблема
PageSpeed Insights сообщает о необходимости оптимизации изображений для мобильной версии:
- `jobs/mobile/IMG_0477.webp` - 79.4 KiB (можно сжать до ~39 KiB)
- `reviews/mobile/Frame 3.webp` - размер изображения превышает контейнер
- `logo/mobile/logo.webp` - 8.9 KiB (можно сжать до ~4 KiB)

## Решение

### 1. Использование скрипта оптимизации

На сервере (Linux) запустите:

```bash
cd /path/to/project
bash scripts/optimize-images.sh
```

Скрипт требует:
- ImageMagick (`convert`) - обычно уже установлен
- `bc` для вычислений (обычно уже установлен)

Если ImageMagick не установлен:
```bash
sudo apt-get update
sudo apt-get install imagemagick
```

### 2. Ручная оптимизация (если скрипт недоступен)

#### Для `jobs/mobile/IMG_0477.webp`:
```bash
convert public/jobs/mobile/IMG_0477.webp \
  -resize 600x> \
  -quality 75 \
  -define webp:method=6 \
  public/jobs/mobile/IMG_0477.webp
```

#### Для `logo/mobile/logo.webp`:
```bash
convert public/logo/mobile/logo.webp \
  -resize 300x> \
  -quality 80 \
  -define webp:method=6 \
  public/logo/mobile/logo.webp
```

#### Для `reviews/mobile/Frame 3.webp`:
```bash
convert public/reviews/mobile/Frame\ 3.webp \
  -resize 440x> \
  -quality 80 \
  -define webp:method=6 \
  public/reviews/mobile/Frame\ 3.webp
```

### 3. Проверка результатов

После оптимизации проверьте размеры файлов:
```bash
ls -lh public/jobs/mobile/IMG_0477.webp
ls -lh public/logo/mobile/logo.webp
ls -lh public/reviews/mobile/Frame\ 3.webp
```

Ожидаемые размеры:
- `IMG_0477.webp`: ~35-40 KiB (было 79.4 KiB)
- `logo.webp`: ~4-5 KiB (было 8.9 KiB)
- `Frame 3.webp`: ~18-20 KiB (было 32.1 KiB)

### 4. Что уже исправлено в коде

✅ HTML обновлен для использования WebP версий отзывов
✅ Добавлен атрибут `sizes` для адаптивности изображений
✅ CSS обновлен для правильного масштабирования на мобильных
✅ Исправлены все HTML файлы (index.html, cheboksary, novocheboksarsk, yoshkar-ola)

### 5. После оптимизации

1. Проверьте качество изображений в браузере
2. Если качество недостаточно, увеличьте параметр `quality` в скрипте
3. Запустите PageSpeed Insights снова для проверки

## Примечания

- Скрипт перезаписывает исходные файлы
- Рекомендуется сделать backup перед оптимизацией
- Параметры качества можно настроить в скрипте (75-80 обычно достаточно)

