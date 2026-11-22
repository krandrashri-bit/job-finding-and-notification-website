require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mysql = require("mysql2/promise");
const nodemailer = require("nodemailer");

const app = express();
const port = Number(process.env.PORT || 5000);
if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET must be set in backend/.env");
const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "domain_job_system",
  waitForConnections: true,
  connectionLimit: 10,
});
const mailer = process.env.SMTP_HOST ? nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === "true",
  auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
}) : null;

function notificationProviderStatus() {
  return {
    email: Boolean(mailer),
    sms: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER),
  };
}

app.use(cors({
  origin(origin, callback) {
    const allowedOrigins = new Set([
      process.env.CLIENT_ORIGIN || "http://localhost:5173",
      "http://localhost:5173",
      "http://127.0.0.1:5173",
    ]);
    callback(null, !origin || allowedOrigins.has(origin));
  },
}));
app.use(express.json({ limit: "1mb" }));

function authenticate(req, res, next) {
  const token = req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Please log in to continue." });
  try {
    req.auth = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Your session has expired. Please log in again." });
  }
}

function requireAdmin(req, res, next) {
  if (req.auth?.role !== "admin") return res.status(403).json({ error: "Administrator access is required." });
  next();
}

function signInPayload(user) {
  const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "12h" });
  return { token, user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role } };
}

function jobShape(row) {
  return {
    id: row.id, title: row.title, company: row.company, domain: row.domain,
    location: row.location, salary: row.salary, description: row.description,
    type: row.job_type, posted: timeSince(row.created_at),
  };
}

function timeSince(date) {
  const hours = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 3600000));
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

async function sendEmail(email, job) {
  if (!mailer) return "pending";
  const link = `${process.env.CLIENT_ORIGIN || "http://localhost:5173"}`;
  await mailer.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: `Job opportunity in ${job.domain}: ${job.title}`,
    text: `${job.title} at ${job.company}\nDomain: ${job.domain}\nLocation: ${job.location}\nSalary: ${job.salary || "Not listed"}\n\n${job.description}\n\nBrowse jobs: ${link}`,
  });
  return "sent";
}

async function sendSms(phone, job) {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) return "pending";
  const credentials = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");
  const body = new URLSearchParams({ To: phone, From: TWILIO_FROM_NUMBER, Body: `${job.domain} job opportunity: ${job.title} at ${job.company} (${job.location}).` });
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) throw new Error(`SMS provider returned status ${response.status}`);
  return "sent";
}

async function createUserJobNotifications(member, job) {
  const [inAppResult] = await pool.execute(
    `INSERT INTO notifications (user_id, job_id, channel, status)
     VALUES (?, ?, 'in_app', 'sent')
     ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
    [member.id, job.id],
  );
  let created = inAppResult.affectedRows === 1 ? 1 : 0;
  for (const channel of ["email", "sms"]) {
    const recipient = channel === "email" ? member.email : member.phone;
    const enabled = channel === "email" ? member.email_enabled && recipient : member.phone_enabled && recipient;
    if (!enabled) continue;

    const [result] = await pool.execute(
      `INSERT INTO notifications (user_id, job_id, channel, status)
       VALUES (?, ?, ?, 'pending')
       ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
      [member.id, job.id, channel],
    );
    if (result.affectedRows === 1) created += 1;
    const notificationId = Number(result.insertId);
    const [[delivery]] = await pool.execute("SELECT status FROM notifications WHERE id = ?", [notificationId]);
    if (!delivery || delivery.status !== "pending") continue;

    try {
      const status = channel === "email" ? await sendEmail(recipient, job) : await sendSms(recipient, job);
      await pool.execute("UPDATE notifications SET status = ? WHERE id = ?", [status, notificationId]);
    } catch (error) {
      await pool.execute("UPDATE notifications SET status = 'failed' WHERE id = ?", [notificationId]);
      console.error(`Notification ${notificationId} (${channel}) failed:`, error.message);
    }
  }
  return created;
}

async function createNotifications(job, domainId) {
  const [members] = await pool.execute(
    `SELECT u.id, u.email, u.phone, u.email_enabled, u.phone_enabled
     FROM users u JOIN candidate_domains cd ON cd.user_id = u.id
     WHERE cd.domain_id = ? AND u.role = 'seeker'`,
    [domainId],
  );
  let created = 0;
  for (const member of members) created += await createUserJobNotifications(member, job);
  return created;
}

async function backfillUserNotifications(userId) {
  const [members] = await pool.execute(
    `SELECT id, email, phone, email_enabled, phone_enabled
     FROM users WHERE id = ? AND role = 'seeker'`,
    [userId],
  );
  if (!members.length) return 0;

  const [rows] = await pool.execute(
    `SELECT j.id, j.title, j.company, j.location, j.salary, j.description, j.job_type, j.created_at, d.name AS domain
     FROM jobs j
     JOIN domains d ON d.id = j.domain_id
     JOIN candidate_domains cd ON cd.domain_id = j.domain_id
     WHERE cd.user_id = ? AND j.status = 'published'
     ORDER BY j.created_at DESC`,
    [userId],
  );
  let created = 0;
  for (const row of rows) created += await createUserJobNotifications(members[0], jobShape(row));
  return created;
}

async function backfillInAppNotifications() {
  const [result] = await pool.execute(
    `INSERT INTO notifications (user_id, job_id, channel, status)
     SELECT DISTINCT u.id, j.id, 'in_app', 'sent'
     FROM users u
     JOIN candidate_domains cd ON cd.user_id = u.id
     JOIN jobs j ON j.domain_id = cd.domain_id AND j.status = 'published'
     WHERE u.role = 'seeker'
     ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(notifications.id)`,
  );
  return result.affectedRows;
}

async function ensureInAppNotificationChannel() {
  const [[column]] = await pool.execute(
    `SELECT column_type FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'notifications'
       AND column_name = 'channel'`,
  );
  if (!column || column.column_type.includes("'in_app'")) return;
  await pool.query(
    "ALTER TABLE notifications MODIFY channel ENUM('email', 'sms', 'in_app') NOT NULL",
  );
}

async function ensureNotificationDeliveryIndex() {
  const [indexes] = await pool.execute(
    `SELECT index_name FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'notifications'
       AND index_name = 'uq_notifications_user_job_channel'`,
  );
  if (indexes.length) return;

  const [[duplicates]] = await pool.execute(
    `SELECT COUNT(*) AS total FROM (
       SELECT user_id, job_id, channel FROM notifications
       GROUP BY user_id, job_id, channel HAVING COUNT(*) > 1
     ) AS duplicate_deliveries`,
  );
  if (Number(duplicates.total) > 0) {
    throw new Error("Duplicate notification deliveries exist; resolve them before enabling notification backfill.");
  }
  await pool.query(
    "ALTER TABLE notifications ADD UNIQUE KEY uq_notifications_user_job_channel (user_id, job_id, channel)",
  );
}

async function retryPendingNotifications() {
  const [pending] = await pool.execute(
    `SELECT n.id, n.channel, u.email, u.phone, u.email_enabled, u.phone_enabled,
            j.title, j.company, j.location, j.salary, j.description, d.name AS domain
     FROM notifications n
     JOIN users u ON u.id = n.user_id
     JOIN jobs j ON j.id = n.job_id
     JOIN domains d ON d.id = j.domain_id
     WHERE n.status = 'pending'`,
  );

  let resolved = 0;
  for (const delivery of pending) {
    if ((delivery.channel === "email" && !mailer) || (delivery.channel === "sms" && !notificationProviderStatus().sms)) continue;
    const recipient = delivery.channel === "email" ? delivery.email : delivery.phone;
    const enabled = delivery.channel === "email" ? delivery.email_enabled : delivery.phone_enabled;
    if (!enabled || !recipient) {
      await pool.execute("UPDATE notifications SET status = 'failed' WHERE id = ? AND status = 'pending'", [delivery.id]);
      resolved += 1;
      continue;
    }

    try {
      const job = {
        title: delivery.title,
        company: delivery.company,
        location: delivery.location,
        salary: delivery.salary,
        description: delivery.description,
        domain: delivery.domain,
      };
      const status = delivery.channel === "email" ? await sendEmail(recipient, job) : await sendSms(recipient, job);
      await pool.execute("UPDATE notifications SET status = ? WHERE id = ? AND status = 'pending'", [status, delivery.id]);
      resolved += 1;
    } catch (error) {
      await pool.execute("UPDATE notifications SET status = 'failed' WHERE id = ? AND status = 'pending'", [delivery.id]);
      console.error(`Notification ${delivery.id} (${delivery.channel}) failed:`, error.message);
      resolved += 1;
    }
  }
  return resolved;
}

app.get("/api/health", async (_req, res) => {
  try { await pool.query("SELECT 1"); res.json({ status: "ok", database: "connected" }); }
  catch (error) { res.status(503).json({ status: "error", error: error.message }); }
});

app.get("/api/domains", async (_req, res, next) => {
  try {
    const [domains] = await pool.execute(
      `SELECT d.id, d.name, COUNT(j.id) AS count FROM domains d
       LEFT JOIN jobs j ON j.domain_id = d.id AND j.status = 'published'
       GROUP BY d.id, d.name ORDER BY d.name`,
    );
    res.json({ domains: domains.map((d) => ({ ...d, id: Number(d.id), count: Number(d.count), icon: "✳" })) });
  } catch (error) { next(error); }
});

app.post("/api/auth/register", async (req, res, next) => {
  const { name, email, phone = "", password, domainIds = [], emailEnabled = true, phoneEnabled = false } = req.body;
  if (!name?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || "") || typeof password !== "string" || password.length < 8) {
    return res.status(400).json({ error: "Enter your name, a valid email address, and a password of at least 8 characters." });
  }
  if (!Array.isArray(domainIds) || domainIds.some((id) => !Number.isInteger(Number(id)))) return res.status(400).json({ error: "Choose valid job domains." });
  if (phoneEnabled && !phone.trim()) return res.status(400).json({ error: "Add a mobile number to enable SMS alerts." });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute(
      `INSERT INTO users (name, email, phone, password_hash, role, email_enabled, phone_enabled)
       VALUES (?, ?, ?, ?, 'seeker', ?, ?)`,
      [name.trim(), email.trim().toLowerCase(), phone.trim() || null, await bcrypt.hash(password, 12), emailEnabled ? 1 : 0, phoneEnabled ? 1 : 0],
    );
    for (const domainId of [...new Set(domainIds.map(Number))]) {
      await connection.execute("INSERT INTO candidate_domains (user_id, domain_id) VALUES (?, ?)", [result.insertId, domainId]);
    }
    await connection.commit();
    backfillUserNotifications(result.insertId).catch((error) => console.error("Could not backfill jobs for new seeker:", error.message));
    res.status(201).json(signInPayload({ id: result.insertId, name: name.trim(), email: email.trim().toLowerCase(), phone: phone || null, role: "seeker" }));
  } catch (error) {
    await connection.rollback();
    if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "An account with that email already exists." });
    if (error.code === "ER_NO_REFERENCED_ROW_2") return res.status(400).json({ error: "One of the selected domains is not available." });
    next(error);
  } finally { connection.release(); }
});

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const [rows] = await pool.execute("SELECT id, name, email, phone, password_hash, role FROM users WHERE email = ? LIMIT 1", [(req.body.email || "").trim().toLowerCase()]);
    if (!rows.length || !await bcrypt.compare(req.body.password || "", rows[0].password_hash)) return res.status(401).json({ error: "Email or password is incorrect." });
    res.json(signInPayload(rows[0]));
    if (rows[0].role === "seeker") {
      backfillUserNotifications(rows[0].id).catch((error) => console.error("Could not backfill jobs for seeker:", error.message));
    }
  } catch (error) { next(error); }
});

app.get("/api/jobs", async (req, res, next) => {
  try {
    const params = [];
    let where = "WHERE j.status = 'published'";
    if (req.query.domainId) { where += " AND j.domain_id = ?"; params.push(Number(req.query.domainId)); }
    const [rows] = await pool.execute(
      `SELECT j.id, j.title, j.company, j.location, j.salary, j.description, j.job_type, j.created_at, d.name AS domain
       FROM jobs j JOIN domains d ON d.id = j.domain_id ${where} ORDER BY j.created_at DESC`,
      params,
    );
    res.json({ jobs: rows.map(jobShape) });
  } catch (error) { next(error); }
});

app.get("/api/preferences", authenticate, async (req, res, next) => {
  try {
    const [[user]] = await pool.execute("SELECT email, phone, email_enabled, phone_enabled FROM users WHERE id = ?", [req.auth.id]);
    const [rows] = await pool.execute("SELECT domain_id FROM candidate_domains WHERE user_id = ?", [req.auth.id]);
    res.json({ preferences: { email: user.email, phone: user.phone || "", domainIds: rows.map((row) => Number(row.domain_id)), emailEnabled: Boolean(user.email_enabled), phoneEnabled: Boolean(user.phone_enabled), deliveryConfigured: notificationProviderStatus() } });
  } catch (error) { next(error); }
});

app.put("/api/preferences", authenticate, async (req, res, next) => {
  const { domainIds = [], emailEnabled = true, phoneEnabled = false, phone } = req.body;
  if (!Array.isArray(domainIds) || domainIds.some((id) => !Number.isInteger(Number(id)))) return res.status(400).json({ error: "Choose valid job domains." });
  if (typeof emailEnabled !== "boolean" || typeof phoneEnabled !== "boolean") return res.status(400).json({ error: "Choose valid notification preferences." });
  if (phone !== undefined && (typeof phone !== "string" || phone.trim().length > 32)) return res.status(400).json({ error: "Enter a valid mobile number." });
  try {
    const [[user]] = await pool.execute("SELECT email, phone FROM users WHERE id = ?", [req.auth.id]);
    const updatedPhone = phone === undefined ? user.phone : phone.trim() || null;
    if (phoneEnabled && !updatedPhone) return res.status(400).json({ error: "Add a mobile number before enabling SMS alerts." });
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute("DELETE FROM candidate_domains WHERE user_id = ?", [req.auth.id]);
      for (const domainId of [...new Set(domainIds.map(Number))]) {
        await connection.execute("INSERT INTO candidate_domains (user_id, domain_id) VALUES (?, ?)", [req.auth.id, domainId]);
      }
      await connection.execute("UPDATE users SET phone = ?, email_enabled = ?, phone_enabled = ? WHERE id = ?", [updatedPhone, emailEnabled ? 1 : 0, phoneEnabled ? 1 : 0, req.auth.id]);
      await connection.commit();
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
    backfillUserNotifications(req.auth.id).catch((error) => console.error("Could not backfill jobs after preference update:", error.message));
    res.json({ preferences: { email: user.email, phone: updatedPhone || "", domainIds: [...new Set(domainIds.map(Number))], emailEnabled, phoneEnabled, deliveryConfigured: notificationProviderStatus() } });
  } catch (error) {
    if (error.code === "ER_NO_REFERENCED_ROW_2") return res.status(400).json({ error: "One of the selected domains is not available." });
    next(error);
  }
});

app.get("/api/notifications", authenticate, async (req, res, next) => {
  try {
    await backfillUserNotifications(req.auth.id);
    const [rows] = await pool.execute(
      `SELECT n.id, n.channel, n.status, n.created_at, j.title AS job_title, j.company, j.location, d.name AS domain
       FROM notifications n JOIN jobs j ON j.id = n.job_id JOIN domains d ON d.id = j.domain_id
       WHERE n.user_id = ? AND n.status <> 'failed'
       ORDER BY n.created_at DESC`,
      [req.auth.id],
    );
    res.json({ notifications: rows.map((row) => ({ id: row.id, channel: row.channel, status: row.status, createdAt: row.created_at, jobTitle: row.job_title, company: row.company, location: row.location, domain: row.domain })) });
  } catch (error) { next(error); }
});

app.get("/api/admin/summary", authenticate, requireAdmin, async (_req, res, next) => {
  try {
    const [[users]] = await pool.execute("SELECT COUNT(*) AS total, SUM(role = 'seeker') AS seekers, SUM(role = 'employer') AS employers FROM users");
    const [[jobs]] = await pool.execute("SELECT COUNT(*) AS total FROM jobs WHERE status = 'published'");
    res.json({ users: Number(users.total), seekers: Number(users.seekers || 0), employers: Number(users.employers || 0), jobs: Number(jobs.total) });
  } catch (error) { next(error); }
});

app.get("/api/admin/users", authenticate, requireAdmin, async (_req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT u.id, u.name, u.email, u.phone, u.role, u.created_at,
       GROUP_CONCAT(d.name ORDER BY d.name SEPARATOR ', ') AS domains
       FROM users u LEFT JOIN candidate_domains cd ON cd.user_id = u.id
       LEFT JOIN domains d ON d.id = cd.domain_id
       GROUP BY u.id, u.name, u.email, u.phone, u.role, u.created_at ORDER BY u.created_at DESC`,
    );
    res.json({ users: rows.map((row) => ({ id: row.id, name: row.name, email: row.email, phone: row.phone, role: row.role, createdAt: row.created_at, domains: row.domains ? row.domains.split(", ") : [] })) });
  } catch (error) { next(error); }
});

app.get("/api/admin/jobs", authenticate, requireAdmin, async (_req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT j.id, j.title, j.company, j.location, j.salary, j.description, j.job_type, j.created_at, d.name AS domain
       FROM jobs j JOIN domains d ON d.id = j.domain_id ORDER BY j.created_at DESC`,
    );
    res.json({ jobs: rows.map(jobShape) });
  } catch (error) { next(error); }
});

app.post("/api/admin/jobs", authenticate, requireAdmin, async (req, res, next) => {
  const { title, company, domainId, location, salary = "", description, jobType = "Full-time" } = req.body;
  if (![title, company, location, description].every((value) => typeof value === "string" && value.trim()) || !Number.isInteger(Number(domainId))) {
    return res.status(400).json({ error: "Enter a job title, company, domain, location, and description." });
  }
  try {
    const [result] = await pool.execute(
      `INSERT INTO jobs (title, company, domain_id, location, salary, description, job_type, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'published', ?)`,
      [title.trim(), company.trim(), Number(domainId), location.trim(), salary.trim() || null, description.trim(), jobType, req.auth.id],
    );
    const [[domain]] = await pool.execute("SELECT name FROM domains WHERE id = ?", [Number(domainId)]);
    const job = { id: result.insertId, title: title.trim(), company: company.trim(), domain: domain.name, location: location.trim(), salary: salary.trim() || "", description: description.trim() };
    const notificationsCreated = await createNotifications(job, Number(domainId));
    res.status(201).json({ job, notificationsCreated });
  } catch (error) {
    if (error.code === "ER_NO_REFERENCED_ROW_2") return res.status(400).json({ error: "Choose a valid job domain." });
    next(error);
  }
});

app.get("/api/admin/notifications", authenticate, requireAdmin, async (_req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT n.id, n.channel, n.status, n.created_at, u.name, u.email, j.title AS job_title
       FROM notifications n JOIN users u ON u.id = n.user_id JOIN jobs j ON j.id = n.job_id
       ORDER BY n.created_at DESC LIMIT 300`,
    );
    res.json({ notifications: rows.map((row) => ({ id: row.id, channel: row.channel, status: row.status, createdAt: row.created_at, name: row.name, email: row.email, jobTitle: row.job_title })) });
  } catch (error) { next(error); }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: "The server could not complete the request." });
});

async function ensureAdmin() {
  const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.warn("Admin bootstrap skipped: set ADMIN_EMAIL and ADMIN_PASSWORD in backend/.env.");
    return;
  }
  const [existing] = await pool.execute("SELECT id FROM users WHERE email = ? LIMIT 1", [ADMIN_EMAIL.trim().toLowerCase()]);
  if (existing.length) return;
  const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  await pool.execute(
    "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')",
    [ADMIN_NAME || "Domainly Admin", ADMIN_EMAIL.trim().toLowerCase(), hash],
  );
  console.log(`Created initial administrator account: ${ADMIN_EMAIL}`);
}

async function start() {
  await pool.query("SELECT 1");
  await ensureInAppNotificationChannel();
  await ensureNotificationDeliveryIndex();
  await ensureAdmin();
  const inAppCreated = await backfillInAppNotifications();
  if (inAppCreated > 0) console.log(`Created ${inAppCreated} in-app job alert(s).`);
  const resolvedPending = await retryPendingNotifications();
  if (resolvedPending > 0) console.log(`Resolved ${resolvedPending} pending notification(s).`);
  app.listen(port, () => console.log(`Domainly API listening on http://localhost:${port}`));
}

start().catch((error) => {
  console.error("Could not start the API. Check the MySQL service and backend configuration.", error.message);
  process.exitCode = 1;
});
