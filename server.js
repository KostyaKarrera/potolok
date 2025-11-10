import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import TelegramBot from "node-telegram-bot-api";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import fs from "fs";
import QRCode from "qrcode";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { initDB } from "./database.js";

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
  console.error("❌ Telegram токен или chat_id не указан в .env");
  process.exit(1);
}

const bot = new TelegramBot(TELEGRAM_TOKEN);

// === Middleware ===
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

const db = await initDB();

// === Отправка заявки в Telegram ===
async function sendTelegram(name, phone, type, estimatedPrice, ref) {
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

  try {
    await bot.sendMessage(CHAT_ID, message, { parse_mode: "HTML" });
  } catch (err) {
    console.error("Ошибка отправки в Telegram:", err);
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
  const { name, password } = req.body;
  if (!name || !password)
    return res.status(400).json({ status: "error", message: "Введите имя и пароль" });

  try {
    // Валидации
    if (name.length < 3) {
      return res.status(400).json({ status: "error", message: "Имя должно быть не короче 3 символов" });
    }
    if (password.length < 6) {
      return res.status(400).json({ status: "error", message: "Пароль должен быть не короче 6 символов" });
    }
    const exists = await db.get("SELECT id FROM partners WHERE name = ?", [name]);
    if (exists) {
      return res.status(409).json({ status: "error", message: "Партнёр с таким именем уже существует" });
    }

    const hash = await bcrypt.hash(password, 10);
    const promo = "PROMO" + Math.random().toString(36).substring(2, 8).toUpperCase();

    await db.run(
      "INSERT INTO partners (name, password, promo, createdAt) VALUES (?, ?, ?, datetime('now'))",
      [name, hash, promo]
    );

    const partner = await db.get(
      "SELECT id, name, promo, createdAt FROM partners WHERE promo = ?",
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

// === Авторизация партнёра ===
app.post("/api/partners/login", async (req, res) => {
  const { name, password } = req.body;
  const partner = await db.get("SELECT * FROM partners WHERE name = ?", [name]);

  if (!partner)
    return res.status(400).json({ status: "error", message: "Партнёр не найден" });

  const valid = await bcrypt.compare(password, partner.password);
  if (!valid)
    return res.status(401).json({ status: "error", message: "Неверный пароль" });

  const token = jwt.sign({ id: partner.id }, JWT_SECRET, { expiresIn: "7d" });
  // не отдаём хеш пароля наружу
  res.json({
    status: "success",
    token,
    partner: { id: partner.id, name: partner.name, promo: partner.promo, createdAt: partner.createdAt }
  });
});

// === ЛК партнёра: просмотр заявок ===
app.get("/api/partners/:id/requests", async (req, res) => {
  const auth = req.headers.authorization?.split(" ")[1];
  if (!auth) return res.status(401).json({ status: "error", message: "Нет токена" });

  try {
    const payload = jwt.verify(auth, JWT_SECRET);
    if (payload.id != req.params.id)
      return res.status(403).json({ status: "error", message: "Нет доступа" });

    const requests = await db.all("SELECT * FROM requests WHERE ref = ? ORDER BY createdAt DESC", [payload.id]);
    res.json({ status: "success", requests });
  } catch {
    res.status(401).json({ status: "error", message: "Неверный токен" });
  }
});

// === Заявки клиентов (с ref/promo) ===
app.post("/api/request", async (req, res) => {
  const { name, phone, type, estimatedPrice, ref, promo } = req.body;

  if (!name || !phone || !type)
    return res.status(400).json({ status: "error", message: "Не все обязательные поля заполнены" });

  try {
    let partnerId = null;

    if (ref || promo) {
      const partner = await db.get("SELECT id FROM partners WHERE promo = ?", [ref || promo]);
      if (partner) partnerId = partner.id;
    }

    await db.run(
      `INSERT INTO requests (name, phone, type, estimatedPrice, ref, createdAt)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      [name, phone, type, estimatedPrice, partnerId]
    );

    await sendTelegram(name, phone, type, estimatedPrice, ref || promo);

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

// === Админка: обновить заявку (сумма и статус) ===
app.patch("/api/admin/requests/:id", async (req, res) => {
  const auth = req.headers.authorization?.split(" ")[1];
  if (!auth) return res.status(401).json({ status: "error", message: "Нет токена" });

  try {
    const payload = jwt.verify(auth, JWT_SECRET);
    if (payload.role !== "admin") {
      return res.status(403).json({ status: "error", message: "Нет доступа" });
    }

    const { contractAmount, status, estimatedPrice } = req.body;
    const id = req.params.id;

    await db.run(
      "UPDATE requests SET contractAmount = ?, status = ?, estimatedPrice = ? WHERE id = ?",
      [contractAmount || null, status || "новая", estimatedPrice || null, id]
    );

    res.json({ status: "success", message: "Заявка обновлена" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: "Ошибка сервера" });
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

// === Фронтенд маршруты ===
app.get(/^\/(?!api).*/, (req, res) => {
  const requestedPath = path.join(__dirname, "public", req.path);
  let filePath = requestedPath;
  if (fs.existsSync(requestedPath) && fs.lstatSync(requestedPath).isDirectory()) {
    filePath = path.join(requestedPath, "index.html");
  }

  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.sendFile(path.join(__dirname, "public", "index.html"));
  }
});

// === Запуск ===
app.listen(PORT, () => console.log(`✅ Сервер запущен: http://localhost:${PORT}`));
