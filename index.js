const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let events = [];

const EXPIRY_MS = 30 * 1000; // 30 seconds
const MAX_ENTRIES = 50;
const PAGE_SIZE = 10;

app.post('/heartbeat', (req, res) => {
  const { CameraId, Code, EventDateTime, PlateImageUrl, PlateImageBase64 } = req.body;

  if (!CameraId || !Code || !EventDateTime) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const newEvent = {
    id: CameraId,
    plate: Code,
    timestamp: EventDateTime,
    image: PlateImageBase64 || PlateImageUrl || null,
    lastSeen: Date.now()
  };

  events.unshift(newEvent); // add to the beginning
  if (events.length > MAX_ENTRIES) {
    events = events.slice(0, MAX_ENTRIES);
  }

  res.status(200).json({ success: true });
});

app.get('/', (req, res) => {
  const now = Date.now();
  const active = events.filter(e => now - e.lastSeen < EXPIRY_MS);
  res.json(active);
});

app.get('/viewer', (req, res) => {
  const page = parseInt(req.query.page || "1");
  const start = (page - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const totalPages = Math.ceil(events.length / PAGE_SIZE);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>LPR Viewer</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 20px;
          background-color: var(--bg, #fff);
          color: var(--text, #000);
        }
        .light { --bg: #fff; --text: #000; }
        .dark  { --bg: #121212; --text: #f0f0f0; }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        th, td {
          padding: 10px;
          border-bottom: 1px solid #ccc;
        }
        img {
          max-width: 150px;
        }
        .pagination {
          display: flex;
          justify-content: space-between;
        }
        button {
          padding: 5px 15px;
          font-size: 14px;
        }
        .toggle {
          position: absolute;
          top: 10px;
          right: 10px;
        }
      </style>
    </head>
    <body class="light">
      <button class="toggle" onclick="toggleTheme()">Toggle Light/Dark</button>
      <h2>LPR Camera Events (Showing ${events.length} total)</h2>
      <table>
        <thead>
          <tr><th>Camera ID</th><th>Plate</th><th>Timestamp</th><th>Image</th></tr>
        </thead>
        <tbody>
          ${events.slice(start, end).map(e => `
            <tr>
              <td>${e.id}</td>
              <td>${e.plate}</td>
              <td>${e.timestamp}</td>
              <td>${e.image ? `<img src="${e.image}" alt="Plate Image">` : 'N/A'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="pagination">
        <button onclick="prevPage()" ${page <= 1 ? 'disabled' : ''}>Prev</button>
        <span>Page ${page} of ${totalPages}</span>
        <button onclick="nextPage()" ${page >= totalPages ? 'disabled' : ''}>Next</button>
      </div>

      <script>
        let currentPage = ${page};
        function toggleTheme() {
          document.body.classList.toggle('dark');
          document.body.classList.toggle('light');
        }
        function nextPage() {
          location.href = "/viewer?page=" + (currentPage + 1);
        }
        function prevPage() {
          location.href = "/viewer?page=" + (currentPage - 1);
        }
        setTimeout(() => {
          location.reload();
        }, 30000); // Refresh every 30s
      </script>
    </body>
    </html>
  `;
  res.send(html);
});

app.listen(port, () => {
  console.log(`LPR backend running at http://localhost:${port}`);
});
