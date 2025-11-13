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
  console.error("❌ Telegram токен или chat_id не указан в .env");
  process.exit(1);
}

const bot = new TelegramBot(TELEGRAM_TOKEN);

// === Middleware ===
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

const db = await initDB();

// === Uploads (multer) ===
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }); // до 10 МБ на файл

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
      "SELECT id, name, promo, createdAt FROM partners ORDER BY name COLLATE NOCASE"
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
