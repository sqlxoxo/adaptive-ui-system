/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response, NextFunction } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getDB } from "./db";

dotenv.config();

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || "default_super_secret_key";

app.use(express.json());

// Auth Request interface
interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    name: string;
  };
}

// Middleware to authenticate JWT
function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    res.status(401).json({ error: "Необхідна авторизація" });
    return;
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      res.status(403).json({ error: "Недійсний або прострочений токен" });
      return;
    }
    req.user = decoded as { id: string; username: string; name: string };
    next();
  });
}

// Calculate Skill Score and Config
function calculateSkillScore(telemetry: {
  errorsCount: number;
  hoverTime: number;
  firstTaskDuration: number;
  shortcutCount: number;
  actionsCount: number;
  totalTime: number;
}, currentLevel: string): { score: number; level: "Novice" | "Expert" } {
  // Novices start at a lower score, Experts start higher
  let score = currentLevel === "Expert" ? 60 : 15;

  // Every action adds points to allow progression in novice mode
  score += telemetry.actionsCount * 2;

  // Shortcuts are a strong signal of expert level
  score += telemetry.shortcutCount * 12;

  // Errors count hurts skill level
  score -= telemetry.errorsCount * 10;

  // High hover time (wandering) shows hesitation / confusion
  if (telemetry.hoverTime > 15) {
    score -= 15;
  } else if (telemetry.hoverTime > 0 && telemetry.hoverTime < 6) {
    score += 10;
  }

  // First task completion duration
  if (telemetry.firstTaskDuration > 45) {
    score -= 12;
  } else if (telemetry.firstTaskDuration > 0 && telemetry.firstTaskDuration < 20) {
    score += 15;
  }

  // Action count density
  if (telemetry.actionsCount > 25 && telemetry.shortcutCount > 4) {
    score += 10;
  }

  // Bound score [0 - 100]
  score = Math.max(0, Math.min(100, score));

  // Determine Level (with a bit of buffer)
  let level: "Novice" | "Expert" = currentLevel as "Novice" | "Expert";

  if (score < 45) {
    level = "Novice";
  } else if (score >= 50) {
    level = "Expert";
  }

  return { score, level };
}

// ==========================================
// Auth Routes
// ==========================================

// 1. Register User
app.post("/api/auth/register", async (req: Request, res: Response) => {
  const { username, name, password } = req.body;

  if (!username || !name || !password) {
    res.status(400).json({ error: "Усі поля обов'язкові для заповнення!" });
    return;
  }

  if (username.trim().length < 3 || password.length < 4) {
    res.status(400).json({ error: "Логін має бути мін. 3 символи, а пароль - мін. 4 символи!" });
    return;
  }

  try {
    const db = await getDB();
    
    // Check if user already exists
    const existingUser = await db.get("SELECT id FROM users WHERE username = ?", [username.trim().toLowerCase()]);
    if (existingUser) {
      res.status(400).json({ error: "Цей логін вже зайнятий!" });
      return;
    }

    const userId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const passwordHash = await bcrypt.hash(password, 10);
    const joinedAt = new Date().toISOString();

    await db.run(
      `INSERT INTO users (id, username, name, password_hash, level, joined_at) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, username.trim().toLowerCase(), name.trim(), passwordHash, "Novice", joinedAt]
    );

    res.status(201).json({ success: true, message: "Реєстрація успішна!" });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ error: "Помилка сервера під час реєстрації" });
  }
});

// 2. Login User
app.post("/api/auth/login", async (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: "Будь ласка, введіть логін та пароль!" });
    return;
  }

  try {
    const db = await getDB();
    const user = await db.get("SELECT * FROM users WHERE username = ?", [username.trim().toLowerCase()]);
    
    if (!user) {
      res.status(401).json({ error: "Неправильний логін або пароль!" });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      res.status(401).json({ error: "Неправильний логін або пароль!" });
      return;
    }

    // Sign JWT
    const token = jwt.sign(
      { id: user.id, username: user.username, name: user.name },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        level: user.level,
      }
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Помилка сервера під час входу" });
  }
});

// 3. Get Current User Info
app.get("/api/auth/me", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const db = await getDB();
    const user = await db.get("SELECT id, username, name, level, joined_at FROM users WHERE id = ?", [req.user!.id]);
    
    if (!user) {
      res.status(404).json({ error: "Користувача не знайдено" });
      return;
    }

    res.json(user);
  } catch (err) {
    console.error("Auth me error:", err);
    res.status(500).json({ error: "Помилка сервера" });
  }
});

// ==========================================
// Secured API Routes
// ==========================================

// 1. Get Tasks (Only for current user)
app.get("/api/tasks", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const db = await getDB();
    const tasks = await db.all("SELECT id, title, description, status, priority, created_at as createdAt, completed_at as completedAt FROM tasks WHERE user_id = ? ORDER BY created_at DESC", [req.user!.id]);
    res.json(tasks);
  } catch (err) {
    console.error("Get tasks error:", err);
    res.status(500).json({ error: "Помилка завантаження задач" });
  }
});

// 2. Create Task
app.post("/api/tasks", authenticateToken, async (req: AuthRequest, res: Response) => {
  const { title, description, status, priority } = req.body;
  const userId = req.user!.id;
  
  if (!title || title.trim() === "") {
    try {
      const db = await getDB();
      // Track error telemetry in db
      await db.run(
        `UPDATE users SET errors_count = errors_count + 1, actions_count = actions_count + 1 WHERE id = ?`,
        [userId]
      );
    } catch (e) {
      console.error("Telemetry update error:", e);
    }
    res.status(400).json({ error: "Назва задачі не може бути порожньою!" });
    return;
  }

  try {
    const db = await getDB();
    
    // Track first task timestamp if user has only default tasks and firstTaskDuration is 0
    const user = await db.get("SELECT * FROM users WHERE id = ?", [userId]);
    const userTasks = await db.all("SELECT id FROM tasks WHERE user_id = ?", [userId]);
    
    let firstTaskDuration = user.first_task_duration;
    if (userTasks.length === 0 && firstTaskDuration === 0) {
      const elapsed = Math.round(user.total_time || 12);
      firstTaskDuration = elapsed;
      await db.run("UPDATE users SET first_task_duration = ? WHERE id = ?", [firstTaskDuration, userId]);
    }

    const newTask = {
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      title: title.trim(),
      description: description || "",
      status: status || "todo",
      priority: priority || "medium",
      created_at: new Date().toISOString(),
      user_id: userId
    };

    await db.run(
      `INSERT INTO tasks (id, title, description, status, priority, created_at, user_id) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [newTask.id, newTask.title, newTask.description, newTask.status, newTask.priority, newTask.created_at, userId]
    );

    await db.run(`UPDATE users SET actions_count = actions_count + 1 WHERE id = ?`, [userId]);

    res.status(201).json({
      id: newTask.id,
      title: newTask.title,
      description: newTask.description,
      status: newTask.status,
      priority: newTask.priority,
      createdAt: newTask.created_at,
    });
  } catch (err) {
    console.error("Create task error:", err);
    res.status(500).json({ error: "Помилка створення задачі" });
  }
});

// 3. Update Task
app.put("/api/tasks/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { title, description, status, priority } = req.body;
  const userId = req.user!.id;

  if (title !== undefined && title.trim() === "") {
    try {
      const db = await getDB();
      await db.run(
        `UPDATE users SET errors_count = errors_count + 1, actions_count = actions_count + 1 WHERE id = ?`,
        [userId]
      );
    } catch (e) {
      console.error(e);
    }
    res.status(400).json({ error: "Назва задачі не може бути порожньою!" });
    return;
  }

  try {
    const db = await getDB();
    const task = await db.get("SELECT * FROM tasks WHERE id = ? AND user_id = ?", [id, userId]);

    if (!task) {
      res.status(404).json({ error: "Задача не знайдена або доступ заборонено" });
      return;
    }

    const completedAt = (status === "done" && task.status !== "done") ? new Date().toISOString() : task.completed_at;

    await db.run(
      `UPDATE tasks 
       SET title = COALESCE(?, title), 
           description = COALESCE(?, description), 
           status = COALESCE(?, status), 
           priority = COALESCE(?, priority),
           completed_at = ?
       WHERE id = ? AND user_id = ?`,
      [
        title !== undefined ? title.trim() : null,
        description !== undefined ? description : null,
        status !== undefined ? status : null,
        priority !== undefined ? priority : null,
        completedAt,
        id,
        userId
      ]
    );

    await db.run(`UPDATE users SET actions_count = actions_count + 1 WHERE id = ?`, [userId]);

    const updated = await db.get("SELECT id, title, description, status, priority, created_at as createdAt, completed_at as completedAt FROM tasks WHERE id = ?", [id]);
    res.json(updated);
  } catch (err) {
    console.error("Update task error:", err);
    res.status(500).json({ error: "Помилка оновлення задачі" });
  }
});

// 4. Delete Task
app.delete("/api/tasks/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;

  try {
    const db = await getDB();
    const task = await db.get("SELECT * FROM tasks WHERE id = ? AND user_id = ?", [id, userId]);

    if (!task) {
      res.status(404).json({ error: "Задача не знайдена або доступ заборонено" });
      return;
    }

    await db.run("DELETE FROM tasks WHERE id = ? AND user_id = ?", [id, userId]);
    await db.run(`UPDATE users SET actions_count = actions_count + 1 WHERE id = ?`, [userId]);

    res.json({ success: true, message: "Задачу видалено успішно" });
  } catch (err) {
    console.error("Delete task error:", err);
    res.status(500).json({ error: "Помилка видалення задачі" });
  }
});

// 4.1. GET Custom Columns
app.get("/api/columns", authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  try {
    const db = await getDB();
    const user = await db.get("SELECT custom_columns FROM users WHERE id = ?", [userId]);
    if (!user) {
      res.status(404).json({ error: "Користувача не знайдено" });
      return;
    }
    const cols = JSON.parse(user.custom_columns || '[{"id":"todo","name":"To Do"},{"id":"inprogress","name":"In Progress"},{"id":"done","name":"Done"}]');
    res.json(cols);
  } catch (err) {
    console.error("GET columns error:", err);
    res.status(500).json({ error: "Помилка завантаження колонок" });
  }
});

// 4.2. PUT Custom Columns (Save/Update columns list)
app.put("/api/columns", authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { columns } = req.body;

  if (!Array.isArray(columns)) {
    res.status(400).json({ error: "Некоректний формат колонок" });
    return;
  }

  try {
    const db = await getDB();
    await db.run("UPDATE users SET custom_columns = ? WHERE id = ?", [JSON.stringify(columns), userId]);

    // Move orphaned tasks to the first column if there are columns left
    if (columns.length > 0) {
      const colIds = columns.map(c => c.id);
      const placeholders = colIds.map(() => "?").join(",");
      await db.run(
        `UPDATE tasks SET status = ? WHERE user_id = ? AND status NOT IN (${placeholders})`,
        [colIds[0], userId, ...colIds]
      );
    }
    res.json({ success: true, columns });
  } catch (err) {
    console.error("PUT columns error:", err);
    res.status(500).json({ error: "Помилка збереження колонок" });
  }
});

// 5. POST Telemetry
app.post("/api/telemetry", authenticateToken, async (req: AuthRequest, res: Response) => {
  const { errorsCount, hoverTime, firstTaskDuration, shortcutCount, actionsCount, totalTime } = req.body;
  const userId = req.user!.id;

  try {
    const db = await getDB();
    const user = await db.get("SELECT * FROM users WHERE id = ?", [userId]);
    if (!user) {
      res.status(404).json({ error: "Користувача не знайдено" });
      return;
    }

    // Sync client telemetry to database user record
    const updatedTelemetry = {
      errorsCount: errorsCount !== undefined ? errorsCount : user.errors_count,
      hoverTime: hoverTime !== undefined ? hoverTime : user.hover_time,
      firstTaskDuration: (firstTaskDuration !== undefined && firstTaskDuration > 0) ? firstTaskDuration : user.first_task_duration,
      shortcutCount: shortcutCount !== undefined ? shortcutCount : user.shortcut_count,
      actionsCount: actionsCount !== undefined ? actionsCount : user.actions_count,
      totalTime: totalTime !== undefined ? totalTime : user.total_time,
    };

    // Calculate score
    const { score, level } = calculateSkillScore(updatedTelemetry, user.level);

    // Save back to user record
    await db.run(
      `UPDATE users 
       SET errors_count = ?, hover_time = ?, first_task_duration = ?, 
           shortcut_count = ?, actions_count = ?, total_time = ?, level = ?
       WHERE id = ?`,
      [
        updatedTelemetry.errorsCount,
        updatedTelemetry.hoverTime,
        updatedTelemetry.firstTaskDuration,
        updatedTelemetry.shortcutCount,
        updatedTelemetry.actionsCount,
        updatedTelemetry.totalTime,
        level,
        userId
      ]
    );

    // Log telemetry point
    const logId = `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    await db.run(
      `INSERT INTO telemetry_logs (id, user_id, timestamp, errors_count, hover_time, first_task_duration, shortcut_count, actions_count, total_time)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        logId,
        userId,
        new Date().toISOString(),
        updatedTelemetry.errorsCount,
        updatedTelemetry.hoverTime,
        updatedTelemetry.firstTaskDuration,
        updatedTelemetry.shortcutCount,
        updatedTelemetry.actionsCount,
        updatedTelemetry.totalTime
      ]
    );

    // Log to metrics history (cap history at 15 logs per user in backend to prevent bloating)
    const timeStr = new Date().toTimeString().split(" ")[0];
    await db.run(
      `INSERT INTO metrics_history (user_id, time, score, errors, shortcuts, hover_time)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        userId,
        timeStr,
        score,
        updatedTelemetry.errorsCount,
        updatedTelemetry.shortcutCount,
        Math.round(updatedTelemetry.hoverTime)
      ]
    );

    // Check history count and delete old items if count > 15
    const historyCount = await db.get("SELECT COUNT(*) as count FROM metrics_history WHERE user_id = ?", [userId]);
    if (historyCount.count > 15) {
      const oldestId = await db.get("SELECT id FROM metrics_history WHERE user_id = ? ORDER BY id ASC LIMIT 1", [userId]);
      await db.run("DELETE FROM metrics_history WHERE id = ?", [oldestId.id]);
    }

    res.json({
      success: true,
      score,
      level,
      activeTelemetry: updatedTelemetry,
    });
  } catch (err) {
    console.error("Telemetry error:", err);
    res.status(500).json({ error: "Помилка збереження телеметрії" });
  }
});

// 6. GET UI Config
app.get("/api/ui-config", authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;

  try {
    const db = await getDB();
    const user = await db.get("SELECT * FROM users WHERE id = ?", [userId]);
    if (!user) {
      res.status(404).json({ error: "Користувача не знайдено" });
      return;
    }

    const telemetry = {
      errorsCount: user.errors_count,
      hoverTime: user.hover_time,
      firstTaskDuration: user.first_task_duration,
      shortcutCount: user.shortcut_count,
      actionsCount: user.actions_count,
      totalTime: user.total_time,
    };

    const { score, level } = calculateSkillScore(telemetry, user.level);

    res.json({
      level,
      score,
      showHelperTooltips: level === "Novice",
      showInteractiveGuide: level === "Novice",
      showSimpleView: level === "Novice",
      showDetailedAnalytics: level === "Expert",
      showAdvancedFilters: level === "Expert",
      showQuickActionsPanel: level === "Expert",
      buttonSize: level === "Novice" ? "large" : "compact",
    });
  } catch (err) {
    console.error("UI Config error:", err);
    res.status(500).json({ error: "Помилка завантаження конфігурації" });
  }
});

// 7. GET Metrics History (for analytics charts)
app.get("/api/metrics-history", authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;

  try {
    const db = await getDB();
    const history = await db.all("SELECT time, score, errors, shortcuts, hover_time FROM metrics_history WHERE user_id = ? ORDER BY id ASC", [userId]);
    const user = await db.get("SELECT * FROM users WHERE id = ?", [userId]);

    const currentMetrics = {
      errorsCount: user.errors_count,
      hoverTime: user.hover_time,
      firstTaskDuration: user.first_task_duration,
      shortcutCount: user.shortcut_count,
      actionsCount: user.actions_count,
      totalTime: user.total_time,
    };

    res.json({
      history,
      currentMetrics,
    });
  } catch (err) {
    console.error("Metrics history error:", err);
    res.status(500).json({ error: "Помилка завантаження історії метрик" });
  }
});

// 8. PUT Override Telemetry (for easy direct UI demo triggers)
app.put("/api/telemetry/override", authenticateToken, async (req: AuthRequest, res: Response) => {
  const { targetLevel } = req.body;
  const userId = req.user!.id;

  let activeTelemetry;
  if (targetLevel === "Expert") {
    activeTelemetry = {
      errorsCount: 0,
      hoverTime: 1,
      firstTaskDuration: 12,
      shortcutCount: 10,
      actionsCount: 30,
      totalTime: 120,
    };
  } else {
    activeTelemetry = {
      errorsCount: 5,
      hoverTime: 25,
      firstTaskDuration: 90,
      shortcutCount: 0,
      actionsCount: 8,
      totalTime: 120,
    };
  }

  try {
    const db = await getDB();
    const { score, level } = calculateSkillScore(activeTelemetry, targetLevel);

    await db.run(
      `UPDATE users 
       SET errors_count = ?, hover_time = ?, first_task_duration = ?, 
           shortcut_count = ?, actions_count = ?, total_time = ?, level = ?
       WHERE id = ?`,
      [
        activeTelemetry.errorsCount,
        activeTelemetry.hoverTime,
        activeTelemetry.firstTaskDuration,
        activeTelemetry.shortcutCount,
        activeTelemetry.actionsCount,
        activeTelemetry.totalTime,
        level,
        userId
      ]
    );

    res.json({
      success: true,
      score,
      level,
      activeTelemetry,
    });
  } catch (err) {
    console.error("Override telemetry error:", err);
    res.status(500).json({ error: "Помилка перевизначення телеметрії" });
  }
});

// Setup Express -> Vite Integration for Dev environment
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[FULLSTACK SERVER] Running on port http://localhost:${PORT}`);
  });
}

startServer();
