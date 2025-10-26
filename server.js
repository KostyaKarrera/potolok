import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import TelegramBot from "node-telegram-bot-api";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import fs from "fs";
import QRCode from "qrcode";

dotenv.config();

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

const bot = new TelegramBot(TELEGRAM_TOKEN);
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// ===== Функция отправки в Telegram =====
async function sendTelegram(name, phone, type, estimatedPrice, ref) {
  const escapeHTML = (str) =>
    str.replace(/&/g, "&amp;")
       .replace(/</g, "&lt;")
       .replace(/>/g, "&gt;");

  let message = `<b>📩 Новая заявка</b>\n`;
  message += `<b>Имя:</b> ${escapeHTML(name)}\n`;
  message += `<b>Телефон:</b> ${escapeHTML(phone)}\n`;
  message += `<b>Тип заявки:</b> ${escapeHTML(type)}`;
  if (estimatedPrice) message += `\n<b>Ориентировочная стоимость:</b> ${escapeHTML(estimatedPrice.toString())} ₽`;
  if (ref) message += `\n\n💎 <b>Реферальный код:</b> ${escapeHTML(ref)}`;

  try {
    await bot.sendMessage(CHAT_ID, message, { parse_mode: "HTML" });
  } catch (err) {
    console.error("Ошибка отправки в Telegram:", err);
  }
}

// ===== Обработка заявок =====
app.post("/api/request", async (req, res) => {
  const { name, phone, type, estimatedPrice, ref } = req.body;

  if (!name || !phone || !type) {
    return res.status(400).json({ status: "error", message: "Не все обязательные поля заполнены" });
  }

  try {
    await sendTelegram(name, phone, type, estimatedPrice, ref);
    res.json({ status: "success", message: "Заявка отправлена в Telegram!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: "Ошибка сервера" });
  }
});

// ===== QR-коды для партнёров =====
app.get("/api/ref/:partnerId/qrcode", async (req, res) => {
  const { partnerId } = req.params;
  const url = `https://potolok-konkurent.ru/?ref=${encodeURIComponent(partnerId)}`;

  try {
    const qr = await QRCode.toBuffer(url, { type: "png", width: 300 });
    res.setHeader("Content-Type", "image/png");
    res.send(qr);
  } catch (err) {
    console.error(err);
    res.status(500).send("Ошибка генерации QR");
  }
});

// ===== Sitemap и Robots =====
app.get("/sitemap.xml", (req, res) => res.sendFile(path.join(__dirname, "public", "sitemap.xml")));
app.get("/robots.txt", (req, res) => res.sendFile(path.join(__dirname, "public", "robots.txt")));

// ===== Обработка маршрутов (для городов и главной) =====
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

app.listen(PORT, () => console.log(`✅ Сервер запущен: http://localhost:${PORT}`));
