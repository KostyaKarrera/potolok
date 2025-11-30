# 🖼️ Оптимизация Hero изображения

## Текущее состояние

Hero изображение: `public/header/header-optimized.webp`

## Проверка размера

Проверьте размер файла:

```bash
# На сервере
ls -lh public/header/header-optimized.webp
```

**Рекомендации по размеру:**
- **Мобильные:** < 200KB (желательно < 150KB)
- **Десктоп:** < 300KB (желательно < 250KB)

## Оптимизация

### Если изображение > 200KB

#### Вариант 1: Использовать ImageMagick (если установлен)

```bash
# Оптимизация существующего файла
convert public/header/header-optimized.webp -quality 85 -strip public/header/header-optimized.webp

# Или создание новой версии
convert public/header/header-optimized.webp -quality 80 -strip public/header/header-optimized-new.webp
```

#### Вариант 2: Онлайн-инструменты

1. Используйте [Squoosh.app](https://squoosh.app/)
2. Загрузите `header-optimized.webp`
3. Выберите формат WebP
4. Установите качество 80-85%
5. Скачайте оптимизированную версию
6. Замените оригинальный файл

#### Вариант 3: Создать мобильную версию hero изображения

Для еще лучшей оптимизации можно создать отдельную мобильную версию:

```bash
# Создать папку для мобильных версий
mkdir -p public/header/mobile

# Создать мобильную версию (800px ширина, качество 75%)
convert public/header/header-optimized.webp -resize 800x -quality 75 public/header/mobile/header-mobile.webp
```

Затем обновить CSS:

```css
header {
  background: linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.3)), 
              url('/header/mobile/header-mobile.webp') center/cover no-repeat;
}

@media (min-width: 769px) {
  header {
    background: linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.3)), 
                url('/header/header-optimized.webp') center/cover no-repeat;
  }
}
```

## Ожидаемый эффект

После оптимизации:
- **LCP улучшится на 1-2 секунды** (если изображение было > 200KB)
- **Размер страницы уменьшится на 100-200KB**
- **Время загрузки на мобильных улучшится на 1-3 секунды**

## Проверка после оптимизации

1. Проверьте размер файла: `ls -lh public/header/header-optimized.webp`
2. Проверьте визуальное качество в браузере
3. Проверьте метрики в Lighthouse/PageSpeed Insights

