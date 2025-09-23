import 'dotenv/config';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: true
  });

  // Create DB if not exist, then use it
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\``);
  await conn.query(`USE \`${process.env.DB_NAME}\``);

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
    url TEXT NOT NULL,           -- Bunny CDN URL
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
  `;
  await conn.query(sql);

  // Seed categories
  const cats = ['General', 'Photos', 'Videos'];
  for (const name of cats) {
    await conn.query('INSERT IGNORE INTO categories (name) VALUES (?)', [name]);
  }

  // Seed admin
  const [rows] = await conn.query('SELECT id FROM users WHERE email=?', [process.env.ADMIN_EMAIL]);
  if (rows.length === 0) {
    const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
    await conn.query(
      'INSERT INTO users (username, email, password_hash, role) VALUES (?,?,?,?)',
      [process.env.ADMIN_USERNAME, process.env.ADMIN_EMAIL, hash, 'admin']
    );
  }

  // Optional sample media (replace with your Bunny URLs if you want)
  const [admin] = await conn.query('SELECT id FROM users WHERE role="admin" LIMIT 1');
  const adminId = admin[0]?.id;
  if (adminId) {
    await conn.query(
      'INSERT IGNORE INTO media (user_id, category_id, title, url, type, is_approved) VALUES (?,?,?,?,?,1)',
      [adminId, 2, 'Sample Image', `${process.env.BUNNY_CDN_URL || ''}/sample1.webp`, 'image']
    );
    await conn.query(
      'INSERT IGNORE INTO media (user_id, category_id, title, url, type, is_approved) VALUES (?,?,?,?,?,1)',
      [adminId, 3, 'Sample Video', `${process.env.BUNNY_CDN_URL || ''}/sample1.mp4`, 'video']
    );
  }

  console.log('✅ Database setup completed.');
  await conn.end();
}

main().catch(err => {
  console.error('❌ DB setup error:', err);
  process.exit(1);
});
