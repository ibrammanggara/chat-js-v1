const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mysql = require('mysql2/promise');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Konfigurasi koneksi database
const dbConfig = {
  host: 'mysql-ibrmm-ibrammanggaraa-e1fc.h.aivencloud.com',
  user: 'avnadmin',
  password: 'AVNS__y_04E50xeLsL6PmMBy',
  database: 'defaultdb',
  port: 15633,
  ssl: {
    rejectUnauthorized: false,
  },
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

const pool = mysql.createPool(dbConfig);

// Inisialisasi tabel messages
async function initializeDatabase() {
  try {
    const connection = await pool.getConnection();
    await connection.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        reply_to TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    connection.release();
    console.log('Database initialized');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
}

initializeDatabase();

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', async (socket) => {
  console.log('A user connected');

  // Kirim sambutan awal
  socket.emit('chatMessage', {
    message: 'Selamat datang di ruang chat!',
    replyTo: null,
    createdAt: new Date().toISOString()
  });

  // Kirim riwayat pesan
  try {
    const [messages] = await pool.query('SELECT * FROM messages ORDER BY created_at DESC LIMIT 50');
    messages.reverse().forEach(msg => {
      socket.emit('chatMessage', {
        message: `${msg.name}: ${msg.message}`,
        replyTo: msg.reply_to || null,
        createdAt: msg.created_at // Menambahkan waktu ke setiap pesan
      });
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
  }

  // Terima dan simpan pesan baru
  socket.on('chatMessage', async (data) => {
    try {
      if (typeof data === 'object' && data.message) {
        const separatorIndex = data.message.indexOf(':');
        if (separatorIndex > 0) {
          const name = data.message.substring(0, separatorIndex).trim();
          const message = data.message.substring(separatorIndex + 1).trim();

          const [result] = await pool.query(
            'INSERT INTO messages (name, message, reply_to) VALUES (?, ?, ?)',
            [name, message, data.replyTo || null]
          );

          const newMessage = {
            message: data.message,
            replyTo: data.replyTo || null,
            createdAt: new Date().toISOString() // Menambahkan waktu
          };

          io.emit('chatMessage', newMessage); // Kirim data termasuk waktu
        }
      }
    } catch (error) {
      console.error('Error saving message:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});

server.listen(80, () => {
  console.log('Server started on http://localhost:80');
});
