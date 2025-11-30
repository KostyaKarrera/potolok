# 🔧 Решение конфликта при git pull (локальные изменения)

## Проблема

При выполнении `git pull` возникает ошибка:
```
error: Your local changes to the following files would be overwritten by merge:
    public/cheboksary/index.html
    public/index.html
    ...
Please commit your changes or stash them before you merge.
```

## Причина

Скрипт `deploy.js` автоматически обновляет HTML файлы на сервере (заменяет ссылки на минифицированные версии). Эти изменения не закоммичены, поэтому Git не позволяет обновить файлы из репозитория.

## Быстрое решение (на сервере)

### Вариант 1: Stash и применить обратно (рекомендуется)

```bash
# 1. Сохранить локальные изменения
git stash

# 2. Выполнить git pull
git pull origin main

# 3. Применить сохраненные изменения обратно
git stash pop
```

После этого hook автоматически запустится и обновит HTML файлы для использования минифицированных версий.

### Вариант 2: Сбросить изменения HTML (если они не важны)

```bash
# 1. Сбросить изменения в HTML файлах
git checkout -- public/index.html public/ready-solutions.html public/cheboksary/index.html public/novocheboksarsk/index.html public/yoshkar-ola/index.html

# 2. Выполнить git pull
git pull origin main
```

Hook автоматически обновит HTML файлы после pull.

### Вариант 3: Обновить hook для автоматической обработки

Обновите `.git/hooks/post-merge` чтобы он автоматически обрабатывал конфликты:

```bash
#!/bin/bash

echo "=========================================="
echo "🚀 Автоматический деплой после git pull"
echo "=========================================="
echo ""

# Если есть локальные изменения в HTML, сохраняем их
if ! git diff --quiet public/*.html public/*/*.html 2>/dev/null; then
    echo "💾 Сохранение локальных изменений в HTML..."
    git stash push -m "Локальные изменения HTML перед pull" public/*.html public/*/*.html 2>/dev/null || true
fi

# Шаг 1: Установка зависимостей
echo "📦 Шаг 1: Установка зависимостей..."
npm install --production=false
if [ $? -ne 0 ]; then
    echo "❌ Ошибка при установке зависимостей!"
    exit 1
fi
echo "✅ Зависимости установлены"
echo ""

# Шаг 2: Запуск автоматического деплоя
echo "🔨 Шаг 2: Минификация и обновление файлов..."
NODE_ENV=production npm run deploy
if [ $? -ne 0 ]; then
    echo "❌ Ошибка при деплое!"
    exit 1
fi
echo "✅ Деплой выполнен успешно"
echo ""

# Шаг 3: Перезапуск сервера
echo "🔄 Шаг 3: Перезапуск сервера..."
sudo systemctl restart potolok.service
if [ $? -ne 0 ]; then
    echo "⚠️  Предупреждение: не удалось перезапустить сервер автоматически"
    echo "   Перезапустите вручную: sudo systemctl restart potolok.service"
else
    echo "✅ Сервер перезапущен"
fi
echo ""

echo "=========================================="
echo "✅ Деплой завершен успешно!"
echo "=========================================="
```

---

## Почему это происходит

1. **Локально (Cursor):** HTML файлы используют оригинальные версии (`style.css`, `main.js`)
2. **На сервере:** После первого деплоя `deploy.js` обновляет HTML для использования минифицированных версий (`style.min.css`, `main.min.js`)
3. **При git pull:** Git видит, что HTML файлы на сервере отличаются от версии в репозитории

## Предотвращение в будущем

### Решение: Обновить hook (Вариант 3 выше)

Hook будет автоматически обрабатывать локальные изменения перед выполнением деплоя.

### Альтернативное решение: Не изменять HTML напрямую

Можно изменить подход и использовать переменные окружения или другой механизм для переключения между dev и production версиями, но это более сложно.

---

## Проверка после решения

После успешного `git pull`:

1. Проверьте, что HTML файлы обновлены:
```bash
grep "style.min.css" public/index.html
grep "main.min.js" public/index.html
```

2. Проверьте работу сайта в браузере

3. Проверьте, что загружаются минифицированные версии в DevTools → Network

