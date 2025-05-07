const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mysql = require('mysql2/promise'); // Menggunakan promise-based API

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Konfigurasi koneksi MySQL
const dbConfig = {
  host: 'mysql-ibrmm-ibrammanggaraa-e1fc.h.aivencloud.com',
  user: 'avnadmin',
  password: 'AVNS__y_04E50xeLsL6PmMBy',
  database: 'defaultdb',
  port: 15633, // Ganti dengan port Aiven MySQL Anda (biasanya 4-5 digit)
  ssl: {
    rejectUnauthorized: false, // Biasanya diperlukan untuk Aiven
    ca: `-----BEGIN CERTIFICATE-----
MIIETTCCArWgAwIBAgIUW/TTdlz66Wllgblp+EvrMMFzkcUwDQYJKoZIhvcNAQEM
BQAwQDE+MDwGA1UEAww1MzcwMTRhMzQtZmRjYS00YTc5LWJjM2MtYmNiYzBmNDZl
NGRmIEdFTiAxIFByb2plY3QgQ0EwHhcNMjUwNTA3MTQzODI3WhcNMzUwNTA1MTQz
ODI3WjBAMT4wPAYDVQQDDDUzNzAxNGEzNC1mZGNhLTRhNzktYmMzYy1iY2JjMGY0
NmU0ZGYgR0VOIDEgUHJvamVjdCBDQTCCAaIwDQYJKoZIhvcNAQEBBQADggGPADCC
AYoCggGBAOCvZKph+3C1nI9H4B5fJH8eLwiIAg2gArxJudC6FeZHZK/u0HetYPW7
tSg6WzQI9BVb91utbZMru7+s5goD6ca3AHGPtSpxl4wRn5JYnKfDJR8nsWCwhIU/
wV4nHywZwRXh+pvgx6Mi898+PAn32EJJ2rPuTuA2qjNCD+vqu4N3/xNEGkpi5u6x
Sv4+C/1SL6B9MmMEodcHpoN6qEchKbo4ySWu2aybNG/Sz5IUucxOUPMtkXoRPFDC
vNyz4ZIMJxsu3/XRpLpe92dFLYvhrAlhgDO+UW1y2E0tKLhHFTvGxJPiB2OWQtTP
UxpZkWgSBcc//F3qwCRUsaVWCGgA1DDM+mzp82r25V++9ne+BYWms+Yqw+UKtQsk
YcikXi4XWp/sgb41zfc2g/5PpDy4tzGWbRZgBf0Ge78HGXvSaEC0B/T0lbyMJEsi
t4jORYlsKGauOnTKBcVHtJhWwhPItty8exdM3qtJvnR3jDmwIbKbaRzd1D+MAkca
CTl7sMjFGQIDAQABoz8wPTAdBgNVHQ4EFgQUevRqCfGNL5Nj05aC8wWDlSQDsv8w
DwYDVR0TBAgwBgEB/wIBADALBgNVHQ8EBAMCAQYwDQYJKoZIhvcNAQEMBQADggGB
ADodFKJxKuKqk3f4DT/H8Vry8Xj84UgRXrYDiw/FXOWh3K/H3mGQ6BW0FK3Wk+T0
jsBhKA9cmtmsIXZv2Ndx/G5xHkipZm5mSn6s+R4TYvRJRveaGz+Mkb1JTtxsJE7o
1/m3ZPipnh6tio5H93KOIW6izq7ijsuNcO+qnyBdnKAQdBe9ZL2VXJyNYDa3aCY/
b+Da3PdWs6oatTgD+BRFsqmnfx+S+EKsAgNsb+IK30D2lvEClKADg2+AXW5WFfYN
e2bCSFci16o/NQC7s5aTuO0BLCTAdrUKSZzkG2tJca07842xKsU016Z0wsLiEr6L
Sqte061DdXBLGzfY5t819GoCSJI9lLbY2saMNvfOEtZXVbOxOwBnhYa5UZSDbMv0
f4HKEi5IVqgq0xubckJPTuOSWsqnkgnD9kBV0GrdXz1YgCSBJgqSMGNYBZ4NAReH
xqUCZPP8jHC93tEExd8uRemk+HjmoquKyV68zvPjKZu4iPaLi/CvccwR5nCLa/G4
9g==
    -----END CERTIFICATE-----`
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
