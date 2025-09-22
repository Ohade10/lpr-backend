const express = require('express');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Camera health map
let cameras = {};
const EXPIRY_MS = 30000; // 30 seconds

// In-memory transaction log
let transactions = [];
const MAX_TRANSACTIONS = 100;

// POST /heartbeat - receive camera event
app.post('/heartbeat', (req, res) => {
  const { CameraId, Code, EventDateTime } = req.body;

  if (!CameraId || !Code || !EventDateTime) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Update camera live status
  cameras[CameraId] = {
    id: CameraId,
    plate: Code,
    timestamp: new Date(EventDateTime).toISOString(),
    lastSeen: Date.now()
  };

  // Add to transaction log
  transactions.unshift({
    time: new Date().toISOString(),
    cameraId: CameraId,
    plate: Code,
    rawEventTime: EventDateTime
  });
  if (transactions.length > MAX_TRANSACTIONS) transactions.pop();

  res.status(200).json({ CameraId, Code, EventDateTime });
});

// GET / - for Google AI Studio
app.get('/', (req, res) => {
  const now = Date.now();
  const activeCameras = Object.values(cameras)
    .filter(cam => now - cam.lastSeen < EXPIRY_MS)
    .map(cam => ({
      id: cam.id,
      plate: cam.plate,
      timestamp: cam.timestamp
    }));

  res.status(200).json(activeCameras);
});

// GET /viewer - live transaction viewer
app.get('/viewer', (req, res) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>LPR Heartbeat Viewer</title>
      <meta charset="UTF-8">
      <style>
        body { font-family: sans-serif; background: #f4f4f4; padding: 20px; }
        h1 { color: #333; }
        table { border-collapse: collapse; width: 100%; background: white; }
        th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
        th { background: #222; color: white; }
        tr:nth-child(even) { background: #f9f9f9; }
      </style>
    </head>
    <body>
      <h1>📸 Live LPR Heartbeats</h1>
      <p>Last ${transactions.length} events received.</p>
      <table>
        <thead>
          <tr>
            <th>Time Received</th>
            <th>Camera ID</th>
            <th>Plate</th>
            <th>Original Timestamp</th>
          </tr>
        </thead>
        <tbody>
          ${transactions.map(tx => `
            <tr>
              <td>${tx.time}</td>
              <td>${tx.cameraId}</td>
              <td>${tx.plate}</td>
              <td>${tx.rawEventTime}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </body>
    </html>
  `;
  res.send(html);
});

app.listen(port, () => {
  console.log(`LPR backend running on port ${port}`);
});
