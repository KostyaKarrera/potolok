import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import TelegramBot from "node-telegram-bot-api";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config(); // Загружаем переменные из .env

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8000;

// ===== Настройки Telegram =====
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

if (!TELEGRAM_TOKEN || !CHAT_ID) {
  console.error("❌ Telegram токен или chat_id не указан в .env");
  process.exit(1);
}

const bot = new TelegramBot(TELEGRAM_TOKEN); // без polling

// ===== Middleware =====
app.use(cors());
app.use(bodyParser.json());

// ===== Раздача статики =====
app.use(express.static(path.join(__dirname, "public")));

// ===== Эндпоинт для форм =====
async function sendTelegram(name, phone, type, estimatedPrice) {
  const escapeHTML = (str) =>
    str.replace(/&/g, "&amp;")
       .replace(/</g, "&lt;")
       .replace(/>/g, "&gt;");

  let message = `<b>📩 Новая заявка</b>\n`;
  message += `<b>Имя:</b> ${escapeHTML(name)}\n`;
  message += `<b>Телефон:</b> ${escapeHTML(phone)}\n`;
  message += `<b>Тип заявки:</b> ${escapeHTML(type)}`;
  if (estimatedPrice) message += `\n<b>Ориентировочная стоимость:</b> ${escapeHTML(estimatedPrice.toString())} ₽`;

  try {
    await bot.sendMessage(CHAT_ID, message, { parse_mode: "HTML" });
  } catch (err) {
    console.error("Ошибка отправки в Telegram:", err);
  }
}

app.post("/api/request", async (req, res) => {
  const { name, phone, type, estimatedPrice } = req.body;

  if (!name || !phone || !type) {
    return res.status(400).json({ status: "error", message: "Не все обязательные поля заполнены" });
  }

  try {
    await sendTelegram(name, phone, type, estimatedPrice);
    res.json({ status: "success", message: "Заявка отправлена в Telegram!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: "Ошибка сервера" });
  }
});

// ===== Любой GET, который не начинается с /api — отдаём index.html =====
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ===== Тестовое сообщение при запуске =====
bot.sendMessage(CHAT_ID, "✅ Сервер запущен, Telegram готов к приему сообщений").catch(console.error);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
