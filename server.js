const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mysql = require('mysql2/promise'); // Menggunakan promise-based API

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Konfigurasi koneksi MySQL
const dbConfig = {
  host: '',
  user: '',
  password: '',
  database: 'defaultdb',
  port: 15633, 
  ssl: {
    rejectUnauthorized: false,
  },
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Membuat koneksi pool MySQL
const pool = mysql.createPool(dbConfig);

// Fungsi untuk inisialisasi database
async function initializeDatabase() {
  try {
    const connection = await pool.getConnection();
    await connection.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
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

  // Mengirim pesan selamat datang dan riwayat chat
  socket.emit('chatMessage', 'Selamat datang di ruang chat!');
  
  try {
    const [messages] = await pool.query('SELECT * FROM messages ORDER BY created_at DESC LIMIT 50');
    messages.reverse().forEach(msg => {
      socket.emit('chatMessage', `${msg.name}: ${msg.message}`);
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
  }

  // Menangani pesan yang dikirim oleh user
  socket.on('chatMessage', async (data) => {
    try {
      // Data harus dalam format "nama: pesan"
      const separatorIndex = data.indexOf(':');
      if (separatorIndex > 0) {
        const name = data.substring(0, separatorIndex).trim();
        const message = data.substring(separatorIndex + 1).trim();
        
        // Simpan ke database
        await pool.query(
          'INSERT INTO messages (name, message) VALUES (?, ?)',
          [name, message]
        );
      }
      
      // Mengirim pesan ke semua user
      io.emit('chatMessage', data);
    } catch (error) {
      console.error('Error saving message:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});

server.listen(8080, () => {
  console.log('Server started on http://localhost:8080');
});
