import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'unlocked',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function fixPasswords() {
  try {
    console.log('🔧 Fixing passwords...');
    
    // Get all users
    const [users] = await pool.query('SELECT id, username, email, password_hash FROM users');
    
    for (const user of users) {
      console.log(`\n👤 User: ${user.username} (${user.email})`);
      
      if (user.password_hash.startsWith('$2b$')) {
        console.log('  📝 Password is hashed, converting to plain text...');
        
        // For admin account, use the known password
        if (user.email === 'tdawgyt24@gmail.com') {
          await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', ['WarmVery24!', user.id]);
          console.log('  ✅ Admin password set to plain text');
        } else if (user.email === 'rylobrisko@gmail.com') {
          await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', ['WarmVery24!?', user.id]);
          console.log('  ✅ Rylo password set to plain text');
        } else {
          // For other users, we can't know their original password
          console.log('  ⚠️  Cannot convert - original password unknown');
        }
      } else {
        console.log('  ✅ Password is already plain text');
      }
    }
    
    console.log('\n🎉 Password fix complete!');
    
  } catch (error) {
    console.error('❌ Error fixing passwords:', error);
  } finally {
    await pool.end();
  }
}

fixPasswords();
