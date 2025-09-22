const express = require('express');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const EXPIRY_MS = 30000; // 30 seconds
let events = []; // ⬅️ store all LPR events

// POST /heartbeat - Add new event
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

  console.log(`[Heartbeat] ${CameraId} | Plate: ${Code} | Image: ${plateImageUrl || 'No image'}`);
  res.status(200).json({ success: true });
});

// GET / - Return only recent events for AI Studio
app.get('/', (req, res) => {
  const now = Date.now();
  const recent = events.filter(e => now - e.receivedAt < EXPIRY_MS);
  // Return only one entry per unique CameraId
  const uniqueByCamera = {};
  recent.forEach(e => {
    uniqueByCamera[e.id] = e;
  });
  res.json(Object.values(uniqueByCamera));
});

// GET /viewer - HTML page to see all events
app.get('/viewer', (req, res) => {
  const now = Date.now();
  const recent = events.filter(e => now - e.receivedAt < EXPIRY_MS);

  const html = `
    <html>
      <head>
        <title>LPR Viewer</title>
        <meta http-equiv="refresh" content="5" />
        <style>
          body { font-family: Arial; background: #111; color: #eee; padding: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #444; padding: 10px; text-align: left; }
          img { max-width: 250px; height: auto; }
        </style>
      </head>
      <body>
        <h1>📸 All Recent LPR Events (Last 30s)</h1>
        <table>
          <tr>
            <th>Camera ID</th>
            <th>Plate</th>
            <th>Timestamp</th>
            <th>Plate Image</th>
          </tr>
          ${recent
            .map(event => `
              <tr>
                <td>${event.id}</td>
                <td>${event.plate}</td>
                <td>${new Date(event.timestamp).toLocaleString()}</td>
                <td>
                  ${event.image
                    ? `<img src="${event.image}" alt="Plate image" onerror="this.onerror=null;this.src='https://via.placeholder.com/200x80?text=Invalid+Image';">`
                    : '<em>No image provided</em>'
                  }
                </td>
              </tr>
            `)
            .join('')}
        </table>
      </body>
    </html>
  `;

  res.send(html);
});

app.listen(port, () => {
  console.log(`🚦 LPR backend listening on port ${port}`);
});
