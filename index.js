const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let transactions = [];
const EXPIRY_MS = 30000; // 30 seconds
const MAX_TRANSACTIONS = 50;

// POST /heartbeat - Receive LPR events
app.post('/heartbeat', (req, res) => {
  const { CameraId, Code, EventDateTime, PlateImageUrl, PlateImageBase64 } = req.body;

  if (!CameraId || !Code || !EventDateTime) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const image =
    PlateImageBase64
      ? `data:image/jpeg;base64,${PlateImageBase64}`
      : PlateImageUrl || '';

  const newEvent = {
    id: CameraId,
    plate: Code,
    timestamp: EventDateTime,
    lastSeen: Date.now(),
    image,
  };

  // Add to transactions (newest first)
  transactions.unshift(newEvent);
  if (transactions.length > MAX_TRANSACTIONS) {
    transactions.pop();
  }

  res.status(200).json({ status: 'OK' });
});

// GET / - Return active cameras
app.get('/', (req, res) => {
  const now = Date.now();
  const active = transactions.filter(e => now - e.lastSeen < EXPIRY_MS);
  res.json(active);
});

// GET /viewer - Return HTML page
app.get('/viewer', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const perPage = 10;
  const start = (page - 1) * perPage;
  const end = start + perPage;
  const totalPages = Math.ceil(transactions.length / perPage);
  const data = transactions.slice(start, end);

  const html = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <title>LPR Camera Viewer</title>
    <style>
      body {
        font-family: sans-serif;
        background-color: var(--bg);
        color: var(--fg);
        transition: background 0.3s, color 0.3s;
      }
      :root {
        --bg: #fff;
        --fg: #000;
      }
      body.dark {
        --bg: #1e1e1e;
        --fg: #e0e0e0;
      }
      .container { max-width: 900px; margin: auto; padding: 20px; }
      table { width: 100%; border-collapse: collapse; margin-top: 20px; }
      th, td { padding: 10px; border-bottom: 1px solid #ccc; text-align: left; }
      img { max-height: 60px; }
      .pagination { margin-top: 20px; }
      .pagination a {
        margin: 0 5px;
        text-decoration: none;
        color: var(--fg);
        font-weight: bold;
      }
      .theme-toggle {
        margin-top: 10px;
        cursor: pointer;
        background: none;
        border: 1px solid var(--fg);
        padding: 5px 10px;
        border-radius: 5px;
        color: var(--fg);
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>LPR Transactions</h1>
      <button class="theme-toggle" onclick="toggleTheme()">Toggle Light/Dark Mode</button>
      <table>
        <thead>
          <tr><th>Camera ID</th><th>Plate</th><th>Timestamp</th><th>Image</th></tr>
        </thead>
        <tbody>
          ${data.map(e => `
            <tr>
              <td>${e.id}</td>
              <td>${e.plate}</td>
              <td>${e.timestamp}</td>
              <td>
                ${e.image
                  ? `<img src="${e.image.startsWith('data:image') ? e.image : e.image}" alt="Plate" onerror="this.style.display='none';">`
                  : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="pagination">
        ${Array.from({ length: totalPages }, (_, i) => `
          <a href="/viewer?page=${i + 1}">${i + 1}</a>
        `).join('')}
      </div>
    </div>

    <script>
      function toggleTheme() {
        document.body.classList.toggle('dark');
        localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : '');
      }

      if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark');
      }

      setTimeout(() => {
        window.location.reload();
      }, 30000);
    </script>
  </body>
  </html>
  `;
  res.send(html);
});

app.listen(port, () => {
  console.log(`LPR backend running on port ${port}`);
});
