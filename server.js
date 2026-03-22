import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import compression from "compression";
import TelegramBot from "node-telegram-bot-api";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import fs from "fs";
import QRCode from "qrcode";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { initDB } from "./database.js";
import multer from "multer";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8000;
const JWT_SECRET = process.env.JWT_SECRET || "supersecret";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

// === Telegram ===
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

if (!TELEGRAM_TOKEN || !CHAT_ID) {
  console.warn("⚠️ Telegram токен или chat_id не указан в .env — уведомления отключены");
}

const bot = TELEGRAM_TOKEN ? new TelegramBot(TELEGRAM_TOKEN) : null;

// === Middleware ===
app.use(cors());

// Сжатие ответов (gzip/brotli)
app.use(compression({
  level: 6, // Уровень сжатия (1-9, 6 - оптимальный баланс)
  filter: (req, res) => {
    // Сжимаем только текстовые файлы и JSON
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// Content Security Policy (CSP) - разрешаем unsafe-eval для минифицированного кода
app.use((req, res, next) => {
  // Устанавливаем CSP только для HTML страниц
  if (req.path.endsWith('.html') || (!req.path.includes('.') && req.accepts('text/html'))) {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.google.com https://maps.googleapis.com; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https:; " +
      "font-src 'self' data:; " +
      "connect-src 'self' https://www.google.com https://maps.googleapis.com; " +
      "frame-src 'self' https://www.google.com https://maps.googleapis.com; " +
      "object-src 'none'; " +
      "base-uri 'self'; " +
      "form-action 'self';"
    );
  }
  next();
});

app.use(bodyParser.json());

// Статические файлы с кэшированием
app.use(express.static(path.join(__dirname, "public"), {
  maxAge: '1y', // Кэш на 1 год для статических файлов
  etag: true, // Включить ETag для валидации кэша
  lastModified: true, // Включить Last-Modified заголовок
  setHeaders: (res, path) => {
    // Дополнительные заголовки для разных типов файлов
    if (path.endsWith('.html')) {
      // HTML не кэшируем долго (для обновлений)
      res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 час
    } else if (path.endsWith('.webp') || path.endsWith('.png') || path.endsWith('.jpg') || path.endsWith('.jpeg')) {
      // Изображения кэшируем долго
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // 1 год
    } else if (path.endsWith('.css') || path.endsWith('.js')) {
      // CSS и JS кэшируем долго, но с возможностью обновления через версионирование
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // 1 год
    } else if (path.endsWith('.woff2')) {
      // Шрифты кэшируем очень долго
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // 1 год
      res.setHeader('Content-Type', 'font/woff2');
    } else if (path.endsWith('.woff')) {
      // Шрифты кэшируем очень долго
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // 1 год
      res.setHeader('Content-Type', 'font/woff');
    } else if (path.endsWith('sw.js')) {
      // Service Worker - не кэшируем, всегда свежий
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Content-Type', 'application/javascript');
      res.setHeader('Service-Worker-Allowed', '/');
    }
  }
}));

const db = await initDB();

// === Uploads (multer) ===
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }); // до 10 МБ на файл

// === Отправка заявки в Telegram ===
async function sendTelegram(name, phone, type, estimatedPrice, ref, promo, giftPromo = false, cartItems = null) {
  const escapeHTML = (str) =>
    str.replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  let message = `<b>📩 Новая заявка</b>\n`;
  message += `<b>Имя:</b> ${escapeHTML(name)}\n`;
  message += `<b>Телефон:</b> ${escapeHTML(phone)}\n`;
  message += `<b>Тип заявки:</b> ${escapeHTML(type)}`;
  if (estimatedPrice)
    message += `\n<b>Ориентировочная стоимость:</b> ${escapeHTML(estimatedPrice.toString())} ₽`;
  if (ref)
    message += `\n\n💎 <b>Реферальный код:</b> ${escapeHTML(ref)}`;
  
  // Информация о товарах из корзины
  if (cartItems && Array.isArray(cartItems) && cartItems.length > 0) {
    message += `\n\n🛒 <b>Выбранные готовые решения:</b>\n`;
    cartItems.forEach((item, index) => {
      message += `\n${index + 1}. <b>${escapeHTML(item.title || 'Товар')}</b>\n`;
      if (item.area) message += `   Площадь: ${escapeHTML(item.area)}\n`;
      if (item.fabric) message += `   Полотно: ${escapeHTML(item.fabric)}\n`;
      if (item.lights) message += `   Светильники: ${escapeHTML(item.lights)}\n`;
      if (item.curtains && item.curtains !== '—') message += `   Гардина: ${escapeHTML(item.curtains)}\n`;
      if (item.extras && item.extras !== '—') message += `   Допы: ${escapeHTML(item.extras)}\n`;
      message += `   <b>Цена: ${escapeHTML(item.price || 'Цена не указана')}</b>\n`;
    });
  }
  
  // Специальное уведомление для акции "Подарок" (6 светильников)
  if (giftPromo) {
    message += `\n\n🎁 <b>АКЦИЯ "ПОДАРОК" АКТИВИРОВАНА!</b>\n`;
    message += `🎉 <b>Клиент заказал через сайт и получит 6 светильников в подарок!</b>\n`;
    message += `✨ <b>Не забудьте предоставить подарок при оформлении заказа!</b>`;
  }
  
  // Специальное уведомление для промокода sale5
  if (promo && promo.toLowerCase() === "sale5") {
    message += `\n\n🎉 <b>ПРОМОКОД АКТИВИРОВАН!</b>\n`;
    message += `🔥 <b>Промокод:</b> ${escapeHTML(promo.toUpperCase())}\n`;
    message += `💰 <b>Клиент получит скидку 5% на сумму заказа!</b>`;
  } else if (promo) {
    message += `\n\n🎫 <b>Промокод:</b> ${escapeHTML(promo)}`;
  }

  if (bot && CHAT_ID) {
    try {
      await bot.sendMessage(CHAT_ID, message, { parse_mode: "HTML" });
    } catch (err) {
      console.error("Ошибка отправки в Telegram:", err);
    }
  }
}

// === Простая защита от частых запросов (rate limit в памяти) ===
const ipBuckets = new Map();
function rateLimit({ windowMs = 60_000, max = 30 } = {}) {
  return (req, res, next) => {
    const ip = req.ip || req.headers["x-forwarded-for"] || req.connection.remoteAddress || "unknown";
    const now = Date.now();
    const bucket = ipBuckets.get(ip) || [];
    // очистим старые записи за пределами окна
    const fresh = bucket.filter((ts) => now - ts < windowMs);
    fresh.push(now);
    ipBuckets.set(ip, fresh);
    if (fresh.length > max) {
      return res.status(429).json({ status: "error", message: "Слишком много запросов, попробуйте позже" });
    }
    next();
  };
}

// Применим ограничение на чувствительные маршруты
app.use("/api/request", rateLimit({ windowMs: 60_000, max: 20 }));
app.use("/api/partners", rateLimit({ windowMs: 60_000, max: 50 }));

// === Регистрация партнёра ===
app.post("/api/partners/register", async (req, res) => {
  const { name, phone, password } = req.body;
  if (!name || !password || !phone)
    return res.status(400).json({ status: "error", message: "Введите имя, телефон и пароль" });

  try {
    // Валидации
    if (name.length < 3) {
      return res.status(400).json({ status: "error", message: "Имя должно быть не короче 3 символов" });
    }
    if (password.length < 6) {
      return res.status(400).json({ status: "error", message: "Пароль должен быть не короче 6 символов" });
    }
    // Упрощенная валидация телефона
    if (!phone.match(/^7\d{10}$/)) {
      return res.status(400).json({ status: "error", message: "Введите корректный номер телефона" });
    }
    
    // ПРОВЕРЯЕМ УНИКАЛЬНОСТЬ ТЕЛЕФОНА (а не имени)
    const exists = await db.get("SELECT id FROM partners WHERE phone = ?", [phone]);
    if (exists) {
      return res.status(409).json({ status: "error", message: "Партнёр с таким номером телефона уже зарегистрирован" });
    }

    const hash = await bcrypt.hash(password, 10);
    const promo = "PROMO" + Math.random().toString(36).substring(2, 8).toUpperCase();

    await db.run(
      "INSERT INTO partners (name, phone, password, promo, createdAt) VALUES (?, ?, ?, ?, datetime('now'))",
      [name, phone, hash, promo]
    );

    const partner = await db.get(
      "SELECT id, name, phone, promo, createdAt FROM partners WHERE promo = ?",
      [promo]
    );

    const token = jwt.sign({ id: partner.id }, JWT_SECRET, { expiresIn: "7d" });

    res.json({
      status: "success",
      message: "Добро пожаловать в партнёрскую программу!",
      promo: partner.promo,
      qrUrl: `/api/ref/${partner.promo}/qrcode`,
      partner,
      token
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: "Ошибка при регистрации" });
  }
});

// === Авторизация партнёра (ПО ТЕЛЕФОНУ) ===
app.post("/api/partners/login", async (req, res) => {
  const { phone } = req.body; // ТЕПЕРЬ ПРИНИМАЕМ phone ВМЕСТО name
  const partner = await db.get("SELECT * FROM partners WHERE phone = ?", [phone]);

  if (!partner)
    return res.status(400).json({ status: "error", message: "Партнёр с таким номером телефона не найден" });

  const valid = await bcrypt.compare(req.body.password, partner.password);
  if (!valid)
    return res.status(401).json({ status: "error", message: "Неверный пароль" });

  const token = jwt.sign({ id: partner.id }, JWT_SECRET, { expiresIn: "7d" });
  res.json({
    status: "success",
    token,
    partner: { 
      id: partner.id, 
      name: partner.name, 
      phone: partner.phone,
      promo: partner.promo, 
      createdAt: partner.createdAt 
    }
  });
});

// === ЛК партнёра: просмотр заявок (без id в URL) ===
app.get("/api/partners/requests", async (req, res) => {
  const auth = req.headers.authorization?.split(" ")[1];
  if (!auth) return res.status(401).json({ status: "error", message: "Нет токена" });

  try {
    const payload = jwt.verify(auth, JWT_SECRET);
    
    const requests = await db.all("SELECT * FROM requests WHERE ref = ? ORDER BY createdAt DESC", [payload.id]);
    res.json({ status: "success", requests });
  } catch {
    res.status(401).json({ status: "error", message: "Неверный токен" });
  }
});

// === ЛК партнёра: просмотр договоров (без id в URL) ===
app.get("/api/partners/contracts", async (req, res) => {
  const auth = req.headers.authorization?.split(" ")[1];
  if (!auth) return res.status(401).json({ status: "error", message: "Нет токена" });

  try {
    const payload = jwt.verify(auth, JWT_SECRET);
    
    const contracts = await db.all("SELECT * FROM contracts WHERE ref = ? ORDER BY createdAt DESC", [payload.id]);
    res.json({ status: "success", contracts });
  } catch {
    res.status(401).json({ status: "error", message: "Неверный токен" });
  }
});

// === Проверка промокода ===
app.get("/api/validate-promo/:promo", async (req, res) => {
  const { promo } = req.params;
  
  if (!promo) {
    return res.json({ status: "error", message: "Промокод не указан", valid: false });
  }

  try {
    const promoLower = promo.toLowerCase().trim();
    
    // Проверяем специальный промокод sale5
    if (promoLower === "sale5") {
      return res.json({ 
        status: "success", 
        valid: true, 
        type: "sale5",
        message: "Промокод действителен. Скидка 5% на сумму заказа."
      });
    }
    
    // Проверяем промокод партнёра
    const partner = await db.get("SELECT id, name, promo FROM partners WHERE promo = ?", [promo]);
    if (partner) {
      return res.json({ 
        status: "success", 
        valid: true, 
        type: "partner",
        message: "Промокод действителен"
      });
    }
    
    // Промокод не найден
    return res.json({ 
      status: "error", 
      valid: false, 
      message: "Промокод не найден. Проверьте правильность ввода." 
    });
  } catch (err) {
    console.error("Ошибка проверки промокода:", err);
    return res.json({ status: "error", valid: false, message: "Ошибка проверки промокода" });
  }
});

// === Заявки клиентов (с ref/promo) ===
app.post("/api/request", async (req, res) => {
  const { name, phone, type, estimatedPrice, ref, promo, giftPromo, cartItems } = req.body;

  if (!name || !phone || !type)
    return res.status(400).json({ status: "error", message: "Не все обязательные поля заполнены" });

  try {
    let partnerId = null;
    let promoValid = true;
    let promoError = null;

    // Валидация промокода, если он указан
    if (promo) {
      const promoLower = promo.toLowerCase().trim();
      
      // Проверяем специальный промокод sale5
      if (promoLower === "sale5") {
        // Промокод sale5 валиден, не привязываем к партнёру
        promoValid = true;
      } else {
        // Проверяем промокод партнёра
        const partner = await db.get("SELECT id FROM partners WHERE promo = ?", [promo]);
        if (partner) {
          partnerId = partner.id;
          promoValid = true;
        } else {
          promoValid = false;
          promoError = "Промокод не найден";
        }
      }
    }

    // Если указан ref, проверяем его
    if (ref && !promo) {
      const partner = await db.get("SELECT id FROM partners WHERE promo = ?", [ref]);
      if (partner) partnerId = partner.id;
    }

    // Если промокод невалиден, возвращаем ошибку
    if (promo && !promoValid) {
      return res.status(400).json({ 
        status: "error", 
        message: promoError || "Неверный промокод. Проверьте правильность ввода." 
      });
    }

    await db.run(
      `INSERT INTO requests (name, phone, type, estimatedPrice, ref, createdAt)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      [name, phone, type, estimatedPrice, partnerId]
    );

    await sendTelegram(name, phone, type, estimatedPrice, ref, promo, giftPromo, cartItems);

    res.json({ status: "success", message: "Заявка отправлена!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: "Ошибка сервера" });
  }
});

// === Админка: авторизация ===
app.post("/api/admin/login", async (req, res) => {
  const { password } = req.body;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ status: "error", message: "Неверный пароль" });
  }
  const token = jwt.sign({ role: "admin" }, JWT_SECRET, { expiresIn: "24h" });
  res.json({ status: "success", token });
});

// === Админка: получить все заявки ===
app.get("/api/admin/requests", async (req, res) => {
  const auth = req.headers.authorization?.split(" ")[1];
  if (!auth) return res.status(401).json({ status: "error", message: "Нет токена" });

  try {
    const payload = jwt.verify(auth, JWT_SECRET);
    if (payload.role !== "admin") {
      return res.status(403).json({ status: "error", message: "Нет доступа" });
    }

    const requests = await db.all(`
      SELECT r.*, p.name as partnerName, p.promo as partnerPromo 
      FROM requests r 
      LEFT JOIN partners p ON r.ref = p.id 
      ORDER BY r.createdAt DESC
    `);
    res.json({ status: "success", requests });
  } catch {
    res.status(401).json({ status: "error", message: "Неверный токен" });
  }
});

// === Админка: обновить заявку ===
app.patch("/api/admin/requests/:id", requireAdmin, async (req, res) => {
  try {
    const { name, phone, type, contractAmount, status, estimatedPrice } = req.body;
    const id = req.params.id;

    // Если переданы базовые поля, обновляем их
    if (name || phone || type) {
      await db.run(
        "UPDATE requests SET name = COALESCE(?, name), phone = COALESCE(?, phone), type = COALESCE(?, type) WHERE id = ?",
        [name || null, phone || null, type || null, id]
      );
    }

    // Обновляем остальные поля
    await db.run(
      "UPDATE requests SET contractAmount = COALESCE(?, contractAmount), status = COALESCE(?, status), estimatedPrice = COALESCE(?, estimatedPrice) WHERE id = ?",
      [contractAmount || null, status || null, estimatedPrice || null, id]
    );

    res.json({ status: "success", message: "Заявка обновлена" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: "Ошибка сервера" });
  }
});

// === Админка: контракты (заключенные договоры) ===
// Служебная функция сохранения массива буферов фото на диск и возврат путей
async function saveContractPhotos(contractId, files) {
  const dirRelative = path.join("uploads", "contracts", String(contractId));
  const dirAbsolute = path.join(__dirname, "public", dirRelative);
  if (!fs.existsSync(dirAbsolute)) {
    fs.mkdirSync(dirAbsolute, { recursive: true });
  }
  const savedPaths = [];
  for (const file of files || []) {
    const time = Date.now();
    const safeOriginal = file.originalname?.replace(/[^a-zA-Z0-9._-]+/g, "_") || `photo_${time}.jpg`;
    const filename = `${time}_${safeOriginal}`;
    const abs = path.join(dirAbsolute, filename);
    await fs.promises.writeFile(abs, file.buffer);
    savedPaths.push("/" + path.posix.join(dirRelative.replace(/\\\\/g, "/"), filename).replace(/\\\\/g, "/"));
  }
  return savedPaths;
}

// Авторизация админа middleware
function requireAdmin(req, res, next) {
  const auth = req.headers.authorization?.split(" ")[1];
  if (!auth) return res.status(401).json({ status: "error", message: "Нет токена" });
  try {
    const payload = jwt.verify(auth, JWT_SECRET);
    if (payload.role !== "admin") {
      return res.status(403).json({ status: "error", message: "Нет доступа" });
    }
    next();
  } catch {
    return res.status(401).json({ status: "error", message: "Неверный токен" });
  }
}

// Получить список контрактов
app.get("/api/admin/contracts", requireAdmin, async (req, res) => {
  try {
    const rows = await db.all(`
      SELECT c.*, p.name as partnerName, p.promo as partnerPromo
      FROM contracts c
      LEFT JOIN partners p ON c.ref = p.id
      ORDER BY COALESCE(c.contractDate, c.createdAt) DESC
    `);
    const contracts = rows.map(r => ({
      ...r,
      photos: r.photos ? JSON.parse(r.photos) : []
    }));
    res.json({ status: "success", contracts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: "Ошибка сервера" });
  }
});

// Получить список партнёров (для выбора рефера)
app.get("/api/admin/partners", requireAdmin, async (req, res) => {
  try {
    const partners = await db.all(
      "SELECT id, name, phone, promo, createdAt FROM partners ORDER BY name COLLATE NOCASE"
    );
    res.json({ status: "success", partners });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: "Ошибка сервера" });
  }
});

// Создать контракт (multipart form-data)
app.post("/api/admin/contracts", requireAdmin, upload.array("photos", 10), async (req, res) => {
  try {
    const {
      name,
      phone,
      address,
      contractAmount,
      contractDate,
      installDate,
      prepayment,
      ref
    } = req.body;

    if (!name || !phone || !address) {
      return res.status(400).json({ status: "error", message: "Имя, телефон и адрес обязательны" });
    }

    // Определим partnerId по promo (если передан нечисловой ref)
    let partnerId = null;
    if (ref) {
      // ref может быть promo-кодом или числовым id
      if (/^\d+$/.test(String(ref))) {
        partnerId = Number(ref);
      } else {
        const partner = await db.get("SELECT id FROM partners WHERE promo = ?", [ref]);
        if (partner) partnerId = partner.id;
      }
    }

    const result = await db.run(
      `INSERT INTO contracts
        (name, phone, address, contractAmount, contractDate, installDate, prepayment, photos, ref, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        name,
        phone,
        address,
        contractAmount ? Number(contractAmount) : null,
        contractDate || null,
        installDate || null,
        prepayment ? Number(prepayment) : null,
        JSON.stringify([]),
        partnerId
      ]
    );

    const contractId = result.lastID;
    const saved = await saveContractPhotos(contractId, req.files);

    if (saved.length > 0) {
      await db.run("UPDATE contracts SET photos = ? WHERE id = ?", [JSON.stringify(saved), contractId]);
    }

    const created = await db.get(
      `SELECT c.*, p.name as partnerName, p.promo as partnerPromo
       FROM contracts c
       LEFT JOIN partners p ON c.ref = p.id
       WHERE c.id = ?`,
      [contractId]
    );

    created.photos = created.photos ? JSON.parse(created.photos) : [];
    res.json({ status: "success", contract: created });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: "Ошибка сервера" });
  }
});

// === Админка: удаление заявки ===
app.delete("/api/admin/requests/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Удаляем заявку из базы данных
    const result = await db.run('DELETE FROM requests WHERE id = ?', [id]);

    if (result.changes === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Заявка не найдена'
      });
    }

    res.json({
      status: 'success',
      message: 'Заявка удалена'
    });

  } catch (error) {
    console.error('Ошибка при удалении заявки:', error);
    res.status(500).json({
      status: 'error',
      message: 'Ошибка сервера при удалении заявки'
    });
  }
});

// === Админка: обновить договор (общая функция) ===
async function updateContractHandler(req, res) {
  try {
    const {
      name,
      phone,
      address,
      contractAmount,
      contractDate,
      installDate,
      prepayment,
      ref
    } = req.body;
    const id = req.params.id;

    // Определим partnerId по promo (если передан нечисловой ref)
    let partnerId = null;
    if (ref) {
      if (/^\d+$/.test(String(ref))) {
        partnerId = Number(ref);
      } else {
        const partner = await db.get("SELECT id FROM partners WHERE promo = ?", [ref]);
        if (partner) partnerId = partner.id;
      }
    }

    // Обновляем основные поля
    await db.run(
      `UPDATE contracts SET
        name = COALESCE(?, name),
        phone = COALESCE(?, phone),
        address = COALESCE(?, address),
        contractAmount = COALESCE(?, contractAmount),
        contractDate = COALESCE(?, contractDate),
        installDate = COALESCE(?, installDate),
        prepayment = COALESCE(?, prepayment),
        ref = COALESCE(?, ref)
      WHERE id = ?`,
      [
        name || null,
        phone || null,
        address || null,
        contractAmount ? Number(contractAmount) : null,
        contractDate || null,
        installDate || null,
        prepayment ? Number(prepayment) : null,
        partnerId,
        id
      ]
    );

    // Если есть новые фото, добавляем их
    if (req.files && req.files.length > 0) {
      const contract = await db.get("SELECT photos FROM contracts WHERE id = ?", [id]);
      const existingPhotos = contract.photos ? JSON.parse(contract.photos) : [];
      const newPhotos = await saveContractPhotos(id, req.files);
      const allPhotos = [...existingPhotos, ...newPhotos];
      await db.run("UPDATE contracts SET photos = ? WHERE id = ?", [JSON.stringify(allPhotos), id]);
    }

    res.json({ status: "success", message: "Договор обновлен" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: "Ошибка сервера" });
  }
}

// Middleware для условной обработки multipart/form-data
const handleMultipartOrJson = (req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('multipart/form-data')) {
    return upload.array("photos", 10)(req, res, (err) => {
      if (err) {
        console.error("Multer error:", err);
        return res.status(400).json({ status: "error", message: "Ошибка загрузки файлов: " + err.message });
      }
      next();
    });
  }
  // Для JSON запросов просто пропускаем дальше
  next();
};

// Маршрут для обновления (работает и с JSON, и с FormData)
app.patch("/api/admin/contracts/:id", requireAdmin, handleMultipartOrJson, updateContractHandler);

// === Админка: удалить фото из договора ===
app.delete("/api/admin/contracts/:id/photos", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { photoPath } = req.body;

    if (!photoPath) {
      return res.status(400).json({ status: "error", message: "Не указан путь к фото" });
    }

    // Получаем текущие фото
    const contract = await db.get("SELECT photos FROM contracts WHERE id = ?", [id]);
    if (!contract) {
      return res.status(404).json({ status: "error", message: "Договор не найден" });
    }

    const photos = contract.photos ? JSON.parse(contract.photos) : [];
    const updatedPhotos = photos.filter(p => p !== photoPath);

    // Удаляем файл
    const fullPath = path.join(__dirname, "public", photoPath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }

    // Обновляем список фото в БД
    await db.run("UPDATE contracts SET photos = ? WHERE id = ?", [JSON.stringify(updatedPhotos), id]);

    res.json({ status: "success", message: "Фото удалено" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: "Ошибка сервера" });
  }
});

// === Админка: удаление договора ===
app.delete("/api/admin/contracts/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Сначала получаем информацию о договоре чтобы удалить файлы
    const contract = await db.get('SELECT photos FROM contracts WHERE id = ?', [id]);
    
    if (contract && contract.photos) {
      try {
        const photos = JSON.parse(contract.photos);
        // Удаляем файлы фотографий
        for (const photoPath of photos) {
          const fullPath = path.join(__dirname, 'public', photoPath);
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
          }
        }
        // Удаляем папку контракта если она пустая
        const contractDir = path.join(__dirname, 'public', 'uploads', 'contracts', id);
        if (fs.existsSync(contractDir)) {
          fs.rmdirSync(contractDir, { recursive: true });
        }
      } catch (fileError) {
        console.error('Ошибка при удалении файлов:', fileError);
      }
    }
    
    // Удаляем договор из базы данных
    const result = await db.run('DELETE FROM contracts WHERE id = ?', [id]);

    if (result.changes === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Договор не найден'
      });
    }

    res.json({
      status: 'success',
      message: 'Договор удален'
    });

  } catch (error) {
    console.error('Ошибка при удалении договора:', error);
    res.status(500).json({
      status: 'error',
      message: 'Ошибка сервера при удалении договора'
    });
  }
});

// === QR-коды партнёров ===
app.get("/api/ref/:promo/qrcode", async (req, res) => {
  const { promo } = req.params;
  const url = `https://potolok-konkurent.ru/?ref=${encodeURIComponent(promo)}`;

  try {
    const qr = await QRCode.toBuffer(url, { type: "png", width: 300 });
    res.setHeader("Content-Type", "image/png");
    res.send(qr);
  } catch (err) {
    console.error(err);
    res.status(500).send("Ошибка генерации QR");
  }
});

// === Sitemap и Robots ===
app.get("/sitemap.xml", (req, res) => res.sendFile(path.join(__dirname, "public", "sitemap.xml")));
app.get("/robots.txt", (req, res) => res.sendFile(path.join(__dirname, "public", "robots.txt")));
// Старый URL страницы готовых решений — редиректим на красивый путь без .html
app.get("/ready-solutions.html", (req, res) => res.redirect(301, "/ready-solutions/"));

// === Фронтенд маршруты и 404 ===
app.get(/^\/(?!api).*/, (req, res) => {
  const requestedPath = path.join(__dirname, "public", req.path);
  let filePath = requestedPath;

  // Если запрошен каталог — ищем index.html внутри
  if (fs.existsSync(requestedPath) && fs.lstatSync(requestedPath).isDirectory()) {
    filePath = path.join(requestedPath, "index.html");
  }

  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }

  // Отдаём кастомную страницу 404 с корректным HTTP‑статусом
  return res.status(404).sendFile(path.join(__dirname, "public", "404.html"));
});
// === Google рейтинг ===
app.get("/api/google-rating", async (req, res) => {
  try {
    const ratingRow = await db.get("SELECT value FROM settings WHERE key = ?", ["google_rating"]);
    const reviewsRow = await db.get("SELECT value FROM settings WHERE key = ?", ["google_reviews_count"]);
    
    res.json({
      status: "success",
      rating: ratingRow ? parseFloat(ratingRow.value) : 5.0,
      reviewsCount: reviewsRow ? parseInt(reviewsRow.value) : 1,
      name: "КонкурентЪ Натяжные потолки"
    });
  } catch (error) {
    res.json({
      status: "success",
      rating: 5.0,
      reviewsCount: 1,
      name: "КонкурентЪ Натяжные потолки"
    });
  }
});

app.post("/api/admin/update-rating", requireAdmin, async (req, res) => {
  const { rating, reviewsCount } = req.body;
  
  try {
    await db.run(
  "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
  ["google_rating", rating]
);

await db.run(
  "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
  ["google_reviews_count", reviewsCount]
);
   
    res.json({ status: "success", message: "Рейтинг обновлен" });
  } catch (error) {
    console.error("Ошибка обновления рейтинга:", error);
    res.status(500).json({ status: "error", message: "Ошибка сервера" });
  }
});

// === Сохранение клика по номеру телефона ===
app.post("/api/phone-click", async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ status: "error", message: "Нет номера" });

    await db.run(
      "INSERT INTO phone_clicks (phone, clickedAt) VALUES (?, datetime('now'))",
      [phone]
    );

    return res.json({ status: "success" });
  } catch (err) {
    console.error("Ошибка записи клика:", err);
    res.status(500).json({ status: "error", message: "Ошибка сервера" });
  }
});

// === Админка: статистика кликов по телефону ===
app.get("/api/admin/phone-clicks", requireAdmin, async (req, res) => {
  try {
    const stats = await db.all(`
      SELECT 
        phone,
        COUNT(*) AS total,
        MIN(clickedAt) AS firstClick,
        MAX(clickedAt) AS lastClick
      FROM phone_clicks
      GROUP BY phone
      ORDER BY total DESC
    `);

    res.json({ status: "success", stats });
  } catch (err) {
    console.error("Ошибка получения статистики телефонных кликов:", err);
    res.status(500).json({ status: "error", message: "Ошибка сервера" });
  }
});

// === Админка: получить цены ===
app.get("/api/admin/prices", requireAdmin, async (req, res) => {
  try {
    const pricesPath = path.join(__dirname, "data", "prices.json");
    if (!fs.existsSync(pricesPath)) {
      // Создаем файл с дефолтными ценами, если его нет (без номенклатуры монтажа)
      const defaultPrices = {
        rooms: {
          fabric: {
            "MSD Standard": { pricePerM2: 450, unit: "м²" },
            "BAUF 205": { pricePerM2: 650, unit: "м²" }
          },
          lights: {
            GX53: { pricePerUnit: 800, unit: "шт" },
            "IN HOME RLP VC": { pricePerUnit: 1200, unit: "шт" }
          },
          curtains: {
            "на потолок": { pricePerM: 500, unit: "м" },
            скрытые: { pricePerM: 800, unit: "м" }
          },
          extras: {
            "Вент. решетка": { pricePerUnit: 500, unit: "шт" }
          }
        },
        apartments: {
          fabric: {
            "MSD Standard": { pricePerM2: 420, unit: "м²" },
            "BAUF 205": { pricePerM2: 600, unit: "м²" }
          },
          lights: {
            GX53: { pricePerUnit: 750, unit: "шт" },
            "IN HOME RLP VC": { pricePerUnit: 1100, unit: "шт" }
          },
          curtains: {
            "на потолок": { pricePerM: 450, unit: "м" },
            скрытые: { pricePerM: 750, unit: "м" }
          }
        }
      };
      fs.writeFileSync(pricesPath, JSON.stringify(defaultPrices, null, 2), "utf8");
      return res.json({ status: "success", prices: defaultPrices });
    }
    
    const pricesData = fs.readFileSync(pricesPath, "utf8");
    const prices = JSON.parse(pricesData);
    res.json({ status: "success", prices });
  } catch (err) {
    console.error("Ошибка получения цен:", err);
    res.status(500).json({ status: "error", message: "Ошибка сервера" });
  }
});

// Вспомогательная функция: загрузка и (при необходимости) инициализация файла цен
function loadOrInitPrices() {
  const pricesPath = path.join(__dirname, "data", "prices.json");
  const pricesDir = path.dirname(pricesPath);

  if (!fs.existsSync(pricesDir)) {
    fs.mkdirSync(pricesDir, { recursive: true });
  }

  if (!fs.existsSync(pricesPath)) {
    const defaultPrices = {
      rooms: {
        fabric: {},
        lights: {},
        curtains: {},
        extras: {}
      },
      apartments: {
        fabric: {},
        lights: {},
        curtains: {}
      }
    };
    fs.writeFileSync(pricesPath, JSON.stringify(defaultPrices, null, 2), "utf8");
    return { prices: defaultPrices, pricesPath };
  }

  const raw = fs.readFileSync(pricesPath, "utf8");
  const prices = JSON.parse(raw);
  return { prices, pricesPath };
}

// === Админка: обновить цены ===
app.post("/api/admin/prices", requireAdmin, async (req, res) => {
  try {
    const { prices } = req.body;
    if (!prices) {
      return res.status(400).json({ status: "error", message: "Цены не указаны" });
    }

    const pricesPath = path.join(__dirname, "data", "prices.json");
    const pricesDir = path.dirname(pricesPath);
    
    // Создаем директорию, если её нет
    if (!fs.existsSync(pricesDir)) {
      fs.mkdirSync(pricesDir, { recursive: true });
    }

    fs.writeFileSync(pricesPath, JSON.stringify(prices, null, 2), "utf8");
    res.json({ status: "success", message: "Цены обновлены" });
  } catch (err) {
    console.error("Ошибка обновления цен:", err);
    res.status(500).json({ status: "error", message: "Ошибка сервера" });
  }
});

// === Админка: добавить/обновить одну позицию номенклатуры в ценах ===
// Позволяет из админки вручную добавлять новую номенклатуру во вкладке "Цены"
// Поддерживает подкатегории для extras (subCategory), чтобы группировать доп. позиции
app.post("/api/admin/prices/item", requireAdmin, async (req, res) => {
  try {
    const { section, category, key, unit, price, subCategory } = req.body;

    if (!section || !category || !key) {
      return res.status(400).json({
        status: "error",
        message: "Не указаны обязательные поля: section, category, key"
      });
    }

    const normalizedSection = section === "apartments" ? "apartments" : "rooms";
    const allowedCategories = ["fabric", "lights", "curtains", "extras"];

    if (!allowedCategories.includes(category)) {
      return res.status(400).json({
        status: "error",
        message: "Некорректная категория. Допустимые значения: fabric, lights, curtains, extras"
      });
    }

    const numericPrice = typeof price === "number" ? price : parseInt(price, 10);
    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      return res.status(400).json({
        status: "error",
        message: "Цена должна быть неотрицательным числом"
      });
    }

    const safeKey = String(key).trim();
    if (!safeKey) {
      return res.status(400).json({
        status: "error",
        message: "Название номенклатуры (key) не может быть пустым"
      });
    }

    const { prices, pricesPath } = loadOrInitPrices();

    if (!prices[normalizedSection]) {
      prices[normalizedSection] = {};
    }

    if (!prices[normalizedSection][category]) {
      prices[normalizedSection][category] = {};
    }

    // Определяем, какое поле цены использовать в зависимости от unit/категории
    let priceField = "pricePerUnit";
    let finalUnit = unit || "шт";

    if (category === "fabric") {
      priceField = "pricePerM2";
      finalUnit = unit || "м²";
    } else if (category === "curtains") {
      priceField = "pricePerM";
      finalUnit = unit || "м";
    }

    // Добавляем/обновляем запись номенклатуры
    const itemPayload = {
      [priceField]: numericPrice,
      unit: finalUnit
    };

    // Для extras поддерживаем подкатегорию, чтобы можно было группировать номенклатуру
    if (category === "extras" && typeof subCategory === "string" && subCategory.trim()) {
      itemPayload.subCategory = subCategory.trim();
    }

    prices[normalizedSection][category][safeKey] = itemPayload;

    fs.writeFileSync(pricesPath, JSON.stringify(prices, null, 2), "utf8");

    return res.json({
      status: "success",
      message: "Номенклатура успешно сохранена",
      prices
    });
  } catch (err) {
    console.error("Ошибка добавления номенклатуры в цены:", err);
    res.status(500).json({ status: "error", message: "Ошибка сервера" });
  }
});

// === Публичный API: получить цены (для фронтенда) ===
app.get("/api/prices", async (req, res) => {
  try {
    const pricesPath = path.join(__dirname, "data", "prices.json");
    if (!fs.existsSync(pricesPath)) {
      return res.status(404).json({ status: "error", message: "Цены не найдены" });
    }
    
    const pricesData = fs.readFileSync(pricesPath, "utf8");
    const prices = JSON.parse(pricesData);
    res.json({ status: "success", prices });
  } catch (err) {
    console.error("Ошибка получения цен:", err);
    res.status(500).json({ status: "error", message: "Ошибка сервера" });
  }
});

// === Админка: получить продукты ===
app.get("/api/admin/products", requireAdmin, async (req, res) => {
  try {
    const productsPath = path.join(__dirname, "data", "products.json");
    if (!fs.existsSync(productsPath)) {
      return res.status(404).json({ status: "error", message: "Продукты не найдены" });
    }
    
    const productsData = fs.readFileSync(productsPath, "utf8");
    const products = JSON.parse(productsData);
    res.json({ status: "success", products });
  } catch (err) {
    console.error("Ошибка получения продуктов:", err);
    res.status(500).json({ status: "error", message: "Ошибка сервера" });
  }
});

// === Админка: обновить продукты ===
app.post("/api/admin/products", requireAdmin, async (req, res) => {
  try {
    const { products } = req.body;
    if (!products) {
      return res.status(400).json({ status: "error", message: "Продукты не указаны" });
    }

    const productsPath = path.join(__dirname, "data", "products.json");
    const productsDir = path.dirname(productsPath);
    
    // Создаем директорию, если её нет
    if (!fs.existsSync(productsDir)) {
      fs.mkdirSync(productsDir, { recursive: true });
    }

    // Синхронизируем новые атрибуты с ценами
    await syncAttributesWithPrices(products);

    fs.writeFileSync(productsPath, JSON.stringify(products, null, 2), "utf8");
    res.json({ status: "success", message: "Продукты обновлены" });
  } catch (err) {
    console.error("Ошибка обновления продуктов:", err);
    res.status(500).json({ status: "error", message: "Ошибка сервера" });
  }
});

// Функция синхронизации атрибутов с ценами
async function syncAttributesWithPrices(products) {
  try {
    const pricesPath = path.join(__dirname, "data", "prices.json");
    if (!fs.existsSync(pricesPath)) {
      return;
    }

    const pricesData = fs.readFileSync(pricesPath, "utf8");
    const prices = JSON.parse(pricesData);

    // Собираем уникальные атрибуты из продуктов (новая структура с items)
    const priceMap = { rooms: {}, apartments: {} };

    // Функция для обработки позиций варианта
    const processVariantItems = (items, sectionType) => {
      if (!items || !Array.isArray(items)) return;
      
      items.forEach(item => {
        if (!item.name || !item.value || item.value === '—' || item.value === '') return;
        
        const unit = item.unit || 'шт';
        const itemName = item.name.trim();
        
        // Определяем категорию по названию позиции или единице измерения
        let category = 'extras';
        let priceKey = itemName;
        
        if (itemName.toLowerCase().includes('полотно') || itemName.toLowerCase().includes('fabric')) {
          category = 'fabric';
          priceKey = item.value.trim();
        } else if (itemName.toLowerCase().includes('светильник') || itemName.toLowerCase().includes('light')) {
          category = 'lights';
          const match = item.value.match(/\d+x\s+(.+)/);
          priceKey = match ? match[1].trim() : item.value.trim();
        } else if (itemName.toLowerCase().includes('гардин') || itemName.toLowerCase().includes('curtain')) {
          category = 'curtains';
          if (item.value.includes('на потолок')) priceKey = 'на потолок';
          else if (item.value.includes('скрыт') || item.value.includes('Скрыт')) priceKey = 'скрытые';
          else priceKey = itemName;
        } else {
          category = 'extras';
          priceKey = itemName;
        }
        
        if (!priceMap[sectionType][category]) {
          priceMap[sectionType][category] = {};
        }
        
        if (!priceMap[sectionType][category][priceKey]) {
          const priceStructure = unit === 'м²' 
            ? { pricePerM2: 0, unit: "м²" }
            : unit === 'м'
            ? { pricePerM: 0, unit: "м" }
            : { pricePerUnit: 0, unit: "шт" };
          priceMap[sectionType][category][priceKey] = priceStructure;
        }
      });
    };

    // Обрабатываем комнаты
    if (products.rooms) {
      products.rooms.forEach(room => {
        if (room.basic && room.basic.items) {
          processVariantItems(room.basic.items, 'rooms');
        }
        if (room.comfort && room.comfort.items) {
          processVariantItems(room.comfort.items, 'rooms');
        }
        // Обратная совместимость со старой структурой
        if (room.basic && !room.basic.items) {
          if (room.basic.fabric && room.basic.fabric !== '—') {
            if (!priceMap.rooms.fabric) priceMap.rooms.fabric = {};
            if (!priceMap.rooms.fabric[room.basic.fabric]) {
              priceMap.rooms.fabric[room.basic.fabric] = { pricePerM2: 0, unit: "м²" };
            }
          }
          if (room.basic.lights && room.basic.lights !== '—') {
            const match = room.basic.lights.match(/\d+x\s+(.+)/);
            if (match) {
              if (!priceMap.rooms.lights) priceMap.rooms.lights = {};
              if (!priceMap.rooms.lights[match[1].trim()]) {
                priceMap.rooms.lights[match[1].trim()] = { pricePerUnit: 0, unit: "шт" };
              }
            }
          }
        }
      });
    }

    // Обрабатываем квартиры
    if (products.apartments) {
      products.apartments.forEach(apartment => {
        if (apartment.variants) {
          apartment.variants.forEach(variant => {
            if (variant.items) {
              processVariantItems(variant.items, 'apartments');
            }
            // Обратная совместимость со старой структурой
            if (!variant.items) {
              if (variant.fabric && variant.fabric !== '—') {
                if (!priceMap.apartments.fabric) priceMap.apartments.fabric = {};
                if (!priceMap.apartments.fabric[variant.fabric]) {
                  priceMap.apartments.fabric[variant.fabric] = { pricePerM2: 0, unit: "м²" };
                }
              }
              if (variant.lights && variant.lights !== '—') {
                const match = variant.lights.match(/\d+x\s+(.+)/);
                if (match) {
                  if (!priceMap.apartments.lights) priceMap.apartments.lights = {};
                  if (!priceMap.apartments.lights[match[1].trim()]) {
                    priceMap.apartments.lights[match[1].trim()] = { pricePerUnit: 0, unit: "шт" };
                  }
                }
              }
            }
          });
        }
      });
    }

    // Обновляем цены для комнат
    if (!prices.rooms) prices.rooms = {};
    
    ['fabric', 'lights', 'curtains', 'extras'].forEach(category => {
      if (!prices.rooms[category]) prices.rooms[category] = {};
      if (priceMap.rooms[category]) {
        Object.keys(priceMap.rooms[category]).forEach(key => {
          if (!prices.rooms[category][key]) {
            prices.rooms[category][key] = priceMap.rooms[category][key];
          }
        });
      }
    });

    // Обновляем цены для квартир
    if (!prices.apartments) prices.apartments = {};
    
    ['fabric', 'lights', 'curtains'].forEach(category => {
      if (!prices.apartments[category]) prices.apartments[category] = {};
      if (priceMap.apartments[category]) {
        Object.keys(priceMap.apartments[category]).forEach(key => {
          if (!prices.apartments[category][key]) {
            prices.apartments[category][key] = priceMap.apartments[category][key];
          }
        });
      }
    });

    // Сохраняем обновленные цены
    fs.writeFileSync(pricesPath, JSON.stringify(prices, null, 2), "utf8");
  } catch (err) {
    console.error("Ошибка синхронизации атрибутов с ценами:", err);
  }
}

// === Публичный API: получить продукты (для фронтенда) ===
app.get("/api/products", async (req, res) => {
  try {
    const productsPath = path.join(__dirname, "data", "products.json");
    if (!fs.existsSync(productsPath)) {
      return res.status(404).json({ status: "error", message: "Продукты не найдены" });
    }
    
    const productsData = fs.readFileSync(productsPath, "utf8");
    const products = JSON.parse(productsData);
    res.json({ status: "success", products });
  } catch (err) {
    console.error("Ошибка получения продуктов:", err);
    res.status(500).json({ status: "error", message: "Ошибка сервера" });
  }
});


// === Запуск ===
app.listen(PORT, () => console.log(`✅ Сервер запущен: http://localhost:${PORT}`));
