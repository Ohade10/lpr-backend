const express = require('express');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const EXPIRY_MS = 30000;
const MAX_EVENTS = 50;
const EVENTS_PER_PAGE = 10;

let events = [];

app.post('/heartbeat', (req, res) => {
  const { CameraId, Code, EventDateTime, plateImageUrl } = req.body;

  if (!CameraId || !Code || !EventDateTime) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const event = {
    id: CameraId,
    plate: Code,
    timestamp: EventDateTime,
    image: plateImageUrl || null,
    receivedAt: Date.now()
  };

  events.push(event);
  if (events.length > MAX_EVENTS) {
    events = events.slice(-MAX_EVENTS);
  }

  console.log(`[Heartbeat] ${CameraId} | Plate: ${Code}`);
  res.status(200).json({ success: true });
});

app.get('/', (req, res) => {
  const now = Date.now();
  const recent = events.filter(e => now - e.receivedAt < EXPIRY_MS);

  const latestPerCamera = {};
  for (const e of recent) {
    latestPerCamera[e.id] = e;
  }

  res.json(Object.values(latestPerCamera));
});

app.get('/viewer', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const startIdx = (page - 1) * EVENTS_PER_PAGE;
  const endIdx = startIdx + EVENTS_PER_PAGE;
  const paginatedEvents = events.slice().reverse().slice(startIdx, endIdx);
  const totalPages = Math.ceil(events.length / EVENTS_PER_PAGE);

  const paginationHtml = Array.from({ length: totalPages }, (_, i) => {
    const p = i + 1;
    return `<a href="/viewer?page=${p}" style="margin: 0 5px;" class="page-link">${p}</a>`;
  }).join('');

  const html = `
    <html>
      <head>
        <title>LPR Viewer</title>
        <meta http-equiv="refresh" content="30">
        <style>
          body {
            font-family: Arial, sans-serif;
            background-color: #111;
            color: #eee;
            padding: 20px;
            transition: background 0.3s, color 0.3s;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }
          th, td {
            border: 1px solid #444;
            padding: 8px;
            text-align: left;
          }
          img {
            max-width: 250px;
            height: auto;
          }
          .pagination {
            margin-top: 20px;
            text-align: center;
          }
          .pagination a {
            text-decoration: none;
            font-weight: bold;
            color: #0af;
          }
          .toggle-btn {
            position: fixed;
            top: 20px;
            right: 20px;
            background: #333;
            color: #fff;
            border: none;
            padding: 10px 15px;
            cursor: pointer;
            border-radius: 8px;
          }

          /* Light Mode */
          body.light {
            background-color: #f5f5f5;
            color: #111;
          }
          body.light table th, body.light table td {
            border-color: #ccc;
          }
          body.light .pagination a {
            color: #007bff;
          }
          body.light .toggle-btn {
            background: #ddd;
            color: #111;
          }
        </style>
      </head>
      <body>
        <button class="toggle-btn" onclick="toggleMode()">🌙</button>
        <h1>📸 LPR Transactions (Page ${page}/${totalPages})</h1>
        <p>Auto-refreshes every 30 seconds. Showing ${paginatedEvents.length} of ${events.length} total events.</p>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Camera ID</th>
              <th>Plate</th>
              <th>Timestamp</th>
              <th>Image</th>
            </tr>
          </thead>
          <tbody>
            ${paginatedEvents
              .map((e, i) => `
                <tr>
                  <td>${startIdx + i + 1}</td>
                  <td>${e.id}</td>
                  <td>${e.plate}</td>
                  <td>${new Date(e.timestamp).toLocaleString()}</td>
                  <td>
                    ${e.image
                      ? `<img src="${e.image}" alt="Plate image" onerror="this.onerror=null;this.src='https://via.placeholder.com/200x80?text=No+Image';">`
                      : '<em>No image</em>'}
                  </td>
                </tr>
              `).join('')}
          </tbody>
        </table>
        <div class="pagination">${paginationHtml}</div>

        <script>
          function toggleMode() {
            const body = document.body;
            body.classList.toggle('light');
            const isLight = body.classList.contains('light');
            document.querySelector('.toggle-btn').textContent = isLight ? '⚫️' : '🌙';
            localStorage.setItem('theme', isLight ? 'light' : 'dark');
          }

          // On load
          (() => {
            const theme = localStorage.getItem('theme');
            if (theme === 'light') {
              document.body.classList.add('light');
              document.querySelector('.toggle-btn').textContent = '⚫️';
            }
          })();
        </script>
      </body>
    </html>
  `;

  res.send(html);
});

app.listen(port, () => {
  console.log(`🚦 LPR backend running on port ${port}`);
});
