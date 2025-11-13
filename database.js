import sqlite3 from "sqlite3";
import { open } from "sqlite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function initDB() {
  const db = await open({
    filename: path.join(__dirname, "database.db"),
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS partners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      phone TEXT UNIQUE,
      password TEXT,
      promo TEXT UNIQUE,
      createdAt TEXT
    );

    
    CREATE TABLE IF NOT EXISTS requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      phone TEXT,
      type TEXT,
      estimatedPrice INTEGER,
      ref INTEGER,
      status TEXT DEFAULT 'новая',
      contractAmount INTEGER,
      createdAt TEXT
    );

    -- Таблица заключенных договоров (вводятся вручную в админке)
    CREATE TABLE IF NOT EXISTS contracts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      phone TEXT,
      address TEXT,
      contractAmount INTEGER,
      contractDate TEXT,
      installDate TEXT,
      prepayment INTEGER,
      photos TEXT, -- JSON массив путей до фото
      ref INTEGER, -- ссылка на partners.id, если есть
      createdAt TEXT
    );
  `);

  return db;
}
