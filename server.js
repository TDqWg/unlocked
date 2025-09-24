import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Security & middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// DB pool - support Railway's automatic MySQL variables
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || process.env.DB_HOST,
  port: Number(process.env.MYSQL_PORT || process.env.DB_PORT || 3306),
  user: process.env.MYSQL_USER || process.env.DB_USER,
  password: process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD,
  database: process.env.MYSQL_DATABASE || process.env.DB_NAME,
  connectionLimit: 10
});

// Auto-initialize database on startup
async function initDatabase() {
  try {
    console.log('🔧 Initializing database...');
    
    // Debug: Show available environment variables
    console.log('🔍 Environment variables:');
    console.log(`   MYSQL_HOST: ${process.env.MYSQL_HOST || 'undefined'}`);
    console.log(`   MYSQL_PORT: ${process.env.MYSQL_PORT || 'undefined'}`);
    console.log(`   MYSQL_USER: ${process.env.MYSQL_USER || 'undefined'}`);
    console.log(`   MYSQL_DATABASE: ${process.env.MYSQL_DATABASE || 'undefined'}`);
    console.log(`   MYSQL_PASSWORD: ${process.env.MYSQL_PASSWORD ? '[SET]' : '[NOT SET]'}`);
    console.log(`   DB_HOST: ${process.env.DB_HOST || 'undefined'}`);
    console.log(`   DB_PORT: ${process.env.DB_PORT || 'undefined'}`);
    console.log(`   DB_USER: ${process.env.DB_USER || 'undefined'}`);
    console.log(`   DB_NAME: ${process.env.DB_NAME || 'undefined'}`);
    console.log(`   DB_PASSWORD: ${process.env.DB_PASSWORD ? '[SET]' : '[NOT SET]'}`);
    
    // Create tables if they don't exist
    const sql = `
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(60) UNIQUE NOT NULL,
      email VARCHAR(120) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('user','admin') DEFAULT 'user',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(60) UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS media (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      category_id INT,
      title VARCHAR(160),
      url TEXT NOT NULL,
      type ENUM('image','video') NOT NULL,
      is_approved TINYINT DEFAULT 1,
      likes INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    );

           CREATE TABLE IF NOT EXISTS comments (
             id INT AUTO_INCREMENT PRIMARY KEY,
             media_id INT NOT NULL,
             user_id INT NOT NULL,
             body VARCHAR(500) NOT NULL,
             created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
             FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE,
             FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
           );

           CREATE TABLE IF NOT EXISTS likes (
             id INT AUTO_INCREMENT PRIMARY KEY,
             media_id INT NOT NULL,
             user_id INT NOT NULL,
             created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
             UNIQUE KEY unique_like (media_id, user_id),
             FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE,
             FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
           );
    `;
    
    // Execute each table creation separately to avoid syntax issues
    const tables = sql.split(';').filter(stmt => stmt.trim());
    for (const tableSql of tables) {
      if (tableSql.trim()) {
        await pool.query(tableSql);
      }
    }
    
    // Seed categories
    const cats = ['General', 'Photos', 'Videos'];
    for (const name of cats) {
      await pool.query('INSERT IGNORE INTO categories (name) VALUES (?)', [name]);
    }
    
    // Create admin user if it doesn't exist
           const [rows] = await pool.query('SELECT id FROM users WHERE email=?', [process.env.ADMIN_EMAIL]);
           if (rows.length === 0) {
             // Store admin password as plain text
             await pool.query(
               'INSERT INTO users (username, email, password_hash, role) VALUES (?,?,?,?)',
               [process.env.ADMIN_USERNAME, process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD, 'admin']
             );
             console.log('✅ Admin user created');
           }
    
    // Remove sample media if it exists
    await pool.query("DELETE FROM media WHERE url LIKE '%sample%'");
    console.log('✅ Sample media removed');
    
    // Remove duplicate media (keep the newest one)
    await pool.query(`
      DELETE m1 FROM media m1
      INNER JOIN media m2 
      WHERE m1.id < m2.id 
      AND m1.url = m2.url
    `);
    console.log('✅ Duplicate media removed');
    
    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
}

// Helpers
const sign = (u) =>
  jwt.sign({ id: u.id, role: u.role, username: u.username }, process.env.JWT_SECRET, { expiresIn: '7d' });

const auth = (roles = []) => async (req, res, next) => {
  try {
    const token = req.cookies?.token || (req.headers.authorization || '').replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const data = jwt.verify(token, process.env.JWT_SECRET);
    if (roles.length && !roles.includes(data.role)) return res.status(403).json({ error: 'Forbidden' });
    req.user = data;
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// Routes: basic pages (served from /public)
app.get('/', (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/admin', (_, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/forum', (_, res) => res.sendFile(path.join(__dirname, 'public', 'forum.html')));
app.get('/users', (_, res) => res.sendFile(path.join(__dirname, 'public', 'users.html')));

// Auth
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body || {};
  if (!username || !email || !password) return res.status(400).json({ error: 'Missing fields' });
  // Store password as plain text instead of hashing
  try {
    const [r] = await pool.query('INSERT INTO users (username, email, password_hash) VALUES (?,?,?)',
      [username, email, password]);
    const user = { id: r.insertId, role: 'user', username, email, created_at: new Date() };
    const token = sign(user);
    res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 864e5 });
    res.json({ ok: true, user });
  } catch (e) {
    res.status(400).json({ error: 'User exists or invalid data' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  const [rows] = await pool.query('SELECT * FROM users WHERE email=? LIMIT 1', [email]);
  const user = rows[0];
  if (!user) return res.status(400).json({ error: 'Invalid credentials' });
  
  // Check if password is hashed (starts with $2b$) or plain text
  let isValidPassword = false;
  if (user.password_hash.startsWith('$2b$')) {
    // Password is hashed, use bcrypt comparison
    isValidPassword = await bcrypt.compare(password, user.password_hash);
  } else {
    // Password is plain text, direct comparison
    isValidPassword = (password === user.password_hash);
  }
  
  if (!isValidPassword) return res.status(400).json({ error: 'Invalid credentials' });
  const token = sign(user);
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 864e5 });
  res.json({ ok: true, user: { id: user.id, username: user.username, email: user.email, role: user.role, created_at: user.created_at } });
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

// Check auth status
app.get('/api/auth/me', auth(), (req, res) => {
  res.json({ user: req.user });
});

// Media: list (approved only)
app.get('/api/media', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT m.id, m.title, m.url, m.type, m.likes, m.created_at, c.name as category
     FROM media m LEFT JOIN categories c ON m.category_id=c.id
     WHERE m.is_approved=1 ORDER BY m.created_at DESC LIMIT 200`
  );
  res.json({ items: rows });
});

// Media: create (admin only, you supply a Bunny CDN URL)
app.post('/api/admin/media', auth(['admin']), async (req, res) => {
  const { title, url, type, category } = req.body || {};
  if (!url || !type) return res.status(400).json({ error: 'Missing url/type' });

  // ensure category exists / get id
  let categoryId = null;
  if (category) {
    await pool.query('INSERT IGNORE INTO categories (name) VALUES (?)', [category]);
    const [c] = await pool.query('SELECT id FROM categories WHERE name=? LIMIT 1', [category]);
    categoryId = c[0]?.id ?? null;
  }

  await pool.query(
    'INSERT INTO media (user_id, category_id, title, url, type, is_approved) VALUES (?,?,?,?,?,1)',
    [req.user.id, categoryId, title || null, url, type]
  );
  res.json({ ok: true });
});

// Likes
app.post('/api/media/:id/like', auth(['user', 'admin']), async (req, res) => {
  const id = Number(req.params.id);
  const userId = req.user.id;
  
  try {
    // Check if user already liked this media
    const [existing] = await pool.query(
      'SELECT id FROM likes WHERE media_id=? AND user_id=?', 
      [id, userId]
    );
    
    if (existing.length > 0) {
      // Unlike - remove the like
      await pool.query('DELETE FROM likes WHERE media_id=? AND user_id=?', [id, userId]);
      await pool.query('UPDATE media SET likes = likes - 1 WHERE id=?', [id]);
      res.json({ ok: true, liked: false, message: 'Unliked successfully' });
    } else {
      // Like - add the like
      await pool.query('INSERT INTO likes (media_id, user_id) VALUES (?, ?)', [id, userId]);
      await pool.query('UPDATE media SET likes = likes + 1 WHERE id=?', [id]);
      res.json({ ok: true, liked: true, message: 'Liked successfully' });
    }
  } catch (error) {
    console.error('Like error:', error);
    res.status(500).json({ error: 'Failed to like media' });
  }
});

// Get user's liked posts
app.get('/api/user/likes', auth(['user', 'admin']), async (req, res) => {
  const userId = req.user.id;
  const [rows] = await pool.query(
    'SELECT media_id FROM likes WHERE user_id = ?',
    [userId]
  );
  const likedIds = rows.map(row => row.media_id);
  res.json({ likedIds });
});

// Comments
app.get('/api/media/:id/comments', async (req, res) => {
  const id = Number(req.params.id);
  const [rows] = await pool.query(
    `SELECT c.id, c.body, c.created_at, u.username
     FROM comments c JOIN users u ON c.user_id=u.id
     WHERE c.media_id=? ORDER BY c.created_at DESC LIMIT 100`, [id]);
  res.json({ items: rows });
});

app.post('/api/media/:id/comments', auth(), async (req, res) => {
  const id = Number(req.params.id);
  const { body } = req.body || {};
  if (!body) return res.status(400).json({ error: 'Empty comment' });
  await pool.query('INSERT INTO comments (media_id, user_id, body) VALUES (?,?,?)', [id, req.user.id, body]);
  res.json({ ok: true });
});

// Admin: Remove sample media
app.post('/api/admin/remove-samples', auth(['admin']), async (req, res) => {
  await pool.query("DELETE FROM media WHERE url LIKE '%sample%'");
  res.json({ ok: true, message: 'Sample media removed' });
});

// Admin: Remove duplicates
app.post('/api/admin/remove-duplicates', auth(['admin']), async (req, res) => {
  const [result] = await pool.query(`
    DELETE m1 FROM media m1
    INNER JOIN media m2 
    WHERE m1.id < m2.id 
    AND m1.url = m2.url
  `);
  res.json({ ok: true, message: `${result.affectedRows} duplicate media removed` });
});

// Admin: Clear all media
app.post('/api/admin/clear-all', auth(['admin']), async (req, res) => {
  const [result] = await pool.query('DELETE FROM media');
  res.json({ ok: true, message: `${result.affectedRows} media items cleared` });
});

// Admin: Get all media (including unapproved)
app.get('/api/admin/media', auth(['admin']), async (req, res) => {
  const [rows] = await pool.query(
    `SELECT m.id, m.title, m.url, m.type, m.likes, m.is_approved, m.created_at, c.name as category
     FROM media m LEFT JOIN categories c ON m.category_id=c.id
     ORDER BY m.created_at DESC`
  );
  res.json({ items: rows });
});

// Admin: Delete media
app.delete('/api/admin/media/:id', auth(['admin']), async (req, res) => {
  const id = Number(req.params.id);
  await pool.query('DELETE FROM media WHERE id=?', [id]);
  res.json({ ok: true, message: 'Media deleted' });
});

// User management endpoints
app.get('/api/admin/users', auth(['admin']), async (req, res) => {
  const [rows] = await pool.query(
    'SELECT id, username, email, role, created_at FROM users ORDER BY created_at DESC'
  );
  res.json({ users: rows });
});

app.delete('/api/admin/users/:id', auth(['admin']), async (req, res) => {
  const id = Number(req.params.id);
  
  // Check if user exists and is not admin
  const [userRows] = await pool.query('SELECT role FROM users WHERE id=?', [id]);
  if (userRows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  if (userRows[0].role === 'admin') {
    return res.status(400).json({ error: 'Cannot delete admin user' });
  }
  
  await pool.query('DELETE FROM users WHERE id=?', [id]);
  res.json({ ok: true, message: 'User deleted' });
});

app.post('/api/admin/users/:id/password', auth(['admin']), async (req, res) => {
  const id = Number(req.params.id);
  const { adminPassword } = req.body;
  
  // Verify admin password (handle both hashed and plain text)
  const [adminRows] = await pool.query('SELECT password_hash FROM users WHERE role="admin" LIMIT 1');
  if (adminRows.length === 0) {
    return res.status(500).json({ error: 'Admin user not found' });
  }
  
  let isAdminPasswordValid = false;
  if (adminRows[0].password_hash.startsWith('$2b$')) {
    // Admin password is hashed
    isAdminPasswordValid = await bcrypt.compare(adminPassword, adminRows[0].password_hash);
  } else {
    // Admin password is plain text
    isAdminPasswordValid = (adminPassword === adminRows[0].password_hash);
  }
  
  if (!isAdminPasswordValid) {
    return res.status(401).json({ error: 'Invalid admin password' });
  }
  
  // Get user's password
  const [userRows] = await pool.query('SELECT username, password_hash FROM users WHERE id=?', [id]);
  if (userRows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  // Show the password (plain text or indicate if hashed)
  if (userRows[0].password_hash.startsWith('$2b$')) {
    res.json({ 
      password: `[HASHED] ${userRows[0].password_hash.substring(0, 20)}...`,
      note: 'Password is hashed and cannot be decrypted'
    });
  } else {
    res.json({ 
      password: userRows[0].password_hash,
      note: 'Password retrieved successfully'
    });
  }
});

const PORT = process.env.PORT || 3000;

// Start server with database initialization
async function startServer() {
  // Start the server immediately
  app.listen(PORT, () => {
    console.log(`✅ Server listening on ${PORT}`);
    console.log(`🌐 Website available at: http://localhost:${PORT}`);
  });
  
  // Initialize database in background (non-blocking)
  console.log('🔄 Initializing database in background...');
  initDatabase().then(() => {
    console.log('✅ Database initialized successfully');
  }).catch(error => {
    console.error('⚠️ Database initialization failed:', error.message);
    console.log('🔧 Some features may not work until database is fixed');
  });
}

startServer();
