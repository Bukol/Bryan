import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import path from "path";
import fs from "fs";

const db = new Database("construction.db");

// Initialize Database Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT CHECK(role IN ('PM', 'PIC')) NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS subcontractors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    total_awarded INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS houses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    subcontractor_id INTEGER,
    house_number TEXT NOT NULL,
    status TEXT CHECK(status IN ('Not Started', 'Ongoing', 'Finished')) DEFAULT 'Not Started',
    progress_percentage INTEGER DEFAULT 0,
    start_date TEXT,
    completion_date TEXT,
    FOREIGN KEY(project_id) REFERENCES projects(id),
    FOREIGN KEY(subcontractor_id) REFERENCES subcontractors(id)
  );

  CREATE TABLE IF NOT EXISTS daily_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    house_id INTEGER,
    subcontractor_id INTEGER,
    user_id INTEGER,
    date TEXT NOT NULL,
    task_description TEXT,
    manpower INTEGER,
    issues TEXT,
    weather TEXT,
    progress_added INTEGER,
    photo_url TEXT,
    FOREIGN KEY(house_id) REFERENCES houses(id),
    FOREIGN KEY(subcontractor_id) REFERENCES subcontractors(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

// Seed initial data if empty
const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
if (userCount.count === 0) {
  const salt = bcrypt.genSaltSync(10);
  const pmPassword = bcrypt.hashSync("pm123", salt);
  const picPassword = bcrypt.hashSync("pic123", salt);

  db.prepare("INSERT INTO users (name, role, email, password) VALUES (?, ?, ?, ?)").run(
    "John Manager", "PM", "pm@example.com", pmPassword
  );
  db.prepare("INSERT INTO users (name, role, email, password) VALUES (?, ?, ?, ?)").run(
    "Site Engineer Mike", "PIC", "pic@example.com", picPassword
  );

  db.prepare("INSERT INTO projects (name) VALUES (?)").run("Green Valley Estates");
  
  const subs = ["BuildRight Inc.", "Solid Foundations", "Elite Masonry"];
  subs.forEach(sub => {
    db.prepare("INSERT INTO subcontractors (name) VALUES (?)").run(sub);
  });

  // Initial houses
  const project = db.prepare("SELECT id FROM projects LIMIT 1").get() as { id: number };
  const sub1 = db.prepare("SELECT id FROM subcontractors WHERE name = 'BuildRight Inc.'").get() as { id: number };
  
  for (let i = 1; i <= 5; i++) {
    db.prepare("INSERT INTO houses (project_id, subcontractor_id, house_number, status, progress_percentage) VALUES (?, ?, ?, ?, ?)").run(
      project.id, sub1.id, `Block 1 Lot ${i}`, 'Not Started', 0
    );
  }
  db.prepare("UPDATE subcontractors SET total_awarded = 5 WHERE id = ?", sub1.id).run();
}

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: "*" }
  });

  const PORT = 3000;
  const JWT_SECRET = process.env.JWT_SECRET || "super-secret-construction-key";

  app.use(express.json());

  // Auth Middleware
  const authenticate = (req: any, res: any, next: any) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      next();
    } catch (err) {
      res.status(401).json({ error: "Invalid token" });
    }
  };

  // API Routes
  app.post("/api/login", (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const token = jwt.sign({ id: user.id, role: user.role, name: user.name }, JWT_SECRET);
    res.json({ token, user: { id: user.id, name: user.name, role: user.role } });
  });

  app.get("/api/dashboard/pm", authenticate, (req: any, res: any) => {
    if (req.user.role !== 'PM') return res.status(403).json({ error: "Forbidden" });

    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_houses,
        SUM(CASE WHEN status = 'Finished' THEN 1 ELSE 0 END) as finished,
        SUM(CASE WHEN status = 'Ongoing' THEN 1 ELSE 0 END) as ongoing,
        SUM(CASE WHEN status = 'Not Started' THEN 1 ELSE 0 END) as not_started
      FROM houses
    `).get();

    const subcontractors = db.prepare(`
      SELECT 
        s.id, s.name, s.total_awarded,
        COUNT(h.id) as current_houses,
        AVG(h.progress_percentage) as avg_progress,
        SUM(CASE WHEN h.status = 'Finished' THEN 1 ELSE 0 END) as completed_houses,
        SUM(CASE WHEN h.status = 'Ongoing' THEN 1 ELSE 0 END) as ongoing_houses
      FROM subcontractors s
      LEFT JOIN houses h ON s.id = h.subcontractor_id
      GROUP BY s.id
    `).all();

    res.json({ stats, subcontractors });
  });

  app.get("/api/houses", authenticate, (req: any, res: any) => {
    const houses = db.prepare(`
      SELECT h.*, s.name as subcontractor_name 
      FROM houses h
      JOIN subcontractors s ON h.subcontractor_id = s.id
    `).all();
    res.json(houses);
  });

  app.get("/api/subcontractors", authenticate, (req, res) => {
    const subs = db.prepare("SELECT * FROM subcontractors").all();
    res.json(subs);
  });

  app.post("/api/houses/award", authenticate, (req: any, res: any) => {
    if (req.user.role !== 'PM') return res.status(403).json({ error: "Forbidden" });
    const { subcontractor_id, count, start_date } = req.body;
    
    const project = db.prepare("SELECT id FROM projects LIMIT 1").get() as { id: number };
    
    for (let i = 0; i < count; i++) {
      const houseNum = `New-${Date.now()}-${i}`;
      db.prepare("INSERT INTO houses (project_id, subcontractor_id, house_number, start_date) VALUES (?, ?, ?, ?)").run(
        project.id, subcontractor_id, houseNum, start_date
      );
    }

    db.prepare("UPDATE subcontractors SET total_awarded = total_awarded + ? WHERE id = ?").run(count, subcontractor_id);
    
    io.emit("data_updated");
    res.json({ success: true });
  });

  app.post("/api/logs", authenticate, (req: any, res: any) => {
    if (req.user.role !== 'PIC') return res.status(403).json({ error: "Forbidden" });
    const { house_id, task_description, manpower, issues, weather, progress_added, photo_url } = req.body;
    
    const house = db.prepare("SELECT * FROM houses WHERE id = ?").get(house_id) as any;
    const newProgress = Math.min(100, house.progress_percentage + progress_added);
    const newStatus = newProgress === 100 ? 'Finished' : 'Ongoing';

    db.prepare(`
      INSERT INTO daily_logs (house_id, subcontractor_id, user_id, date, task_description, manpower, issues, weather, progress_added, photo_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(house_id, house.subcontractor_id, req.user.id, new Date().toISOString(), task_description, manpower, issues, weather, progress_added, photo_url);

    db.prepare("UPDATE houses SET progress_percentage = ?, status = ? WHERE id = ?").run(newProgress, newStatus, house_id);

    io.emit("data_updated");
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  io.on("connection", (socket) => {
    console.log("Client connected");
  });

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
