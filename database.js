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
      password TEXT,
      promo TEXT UNIQUE,
      createdAt TEXT
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_partners_name ON partners(name);

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
  `);

  return db;
}
