import sqlite3 from "sqlite3";
import { open, Database } from "sqlite";
import path from "path";

const DB_PATH = path.join(process.cwd(), "adaptive_tasks.db");

let dbInstance: Database | null = null;

export async function getDB(): Promise<Database> {
  if (dbInstance) return dbInstance;

  dbInstance = await open({
    filename: DB_PATH,
    driver: sqlite3.Database,
  });

  await initDB(dbInstance);
  return dbInstance;
}

async function initDB(db: Database) {
  // Enable foreign keys
  await db.run("PRAGMA foreign_keys = ON;");

  // Create tables
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      level TEXT DEFAULT 'Novice',
      joined_at TEXT NOT NULL,
      errors_count INTEGER DEFAULT 0,
      hover_time REAL DEFAULT 0.0,
      first_task_duration REAL DEFAULT 0.0,
      shortcut_count INTEGER DEFAULT 0,
      actions_count INTEGER DEFAULT 0,
      total_time REAL DEFAULT 0.0
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT DEFAULT 'todo',
      priority TEXT DEFAULT 'medium',
      created_at TEXT NOT NULL,
      completed_at TEXT,
      user_id TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS telemetry_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      errors_count INTEGER DEFAULT 0,
      hover_time REAL DEFAULT 0.0,
      first_task_duration REAL DEFAULT 0.0,
      shortcut_count INTEGER DEFAULT 0,
      actions_count INTEGER DEFAULT 0,
      total_time REAL DEFAULT 0.0,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS metrics_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      time TEXT NOT NULL,
      score INTEGER NOT NULL,
      errors INTEGER NOT NULL,
      shortcuts INTEGER NOT NULL,
      hover_time REAL NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
}

export async function createDefaultTasksForUser(db: Database, userId: string) {
  const defaultTasks = [
    {
      title: "Ознайомитись з адаптивним інтерфейсом",
      description: "Спробуйте змінити ширину вікна, перегляньте великі кнопки та покроковий гід. Зверніть увагу на показник Skill Score в шапці.",
      status: "todo",
      priority: "high",
    },
    {
      title: "Створити першу власну задачу",
      description: "Натисніть кнопку 'Додати задачу' та заповніть форму. Намагайтесь не робити помилок валідації, щоб швидше отримати статус Expert!",
      status: "todo",
      priority: "medium",
    },
    {
      title: "Вивчити гарячі клавіші Експерта",
      description: "Коли ви отримаєте статус Expert, відкриються швидкі клавіші. Натисніть 'N' для нової задачі, 'S' для пошуку, 'Esc' для закриття модальних вікон.",
      status: "todo",
      priority: "low",
    }
  ];

  for (const task of defaultTasks) {
    const taskId = `task-default-${Math.random().toString(36).substr(2, 9)}`;
    await db.run(
      `INSERT OR IGNORE INTO tasks (id, title, description, status, priority, created_at, user_id) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        taskId,
        task.title,
        task.description,
        task.status,
        task.priority,
        new Date().toISOString(),
        userId
      ]
    );
  }
}
