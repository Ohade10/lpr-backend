const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let cameras = {};
let transactions = [];

const EXPIRY_MS = 30000; // 30 seconds

// POST /heartbeat - Update camera status and log the event
app.post('/heartbeat', (req, res) => {
  const { CameraId, Code, EventDateTime, plateImageUrl } = req.body;

  if (!CameraId || !Code || !EventDateTime) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const timestampNow = new Date().toISOString();

  // Update camera status
  cameras[CameraId] = {
    id: CameraId,
    plate: Code,
    timestamp: timestampNow,
    lastSeen: Date.now()
  };

  // Log the transaction for viewer
  transactions.unshift({
    time: timestampNow,
    cameraId: CameraId,
    plate: Code,
    rawEventTime: EventDateTime,
    image: plateImageUrl || null
  });

  // Keep only the last 100 transactions
  if (transactions.length > 100) transactions.pop();

  res.status(200).json({ CameraId, Code, EventDateTime, plateImageUrl });
});

// GET / - Return currently active cameras
app.get('/', (req, res) => {
  const now = Date.now();
  const activeCameras = Object.values(cameras).filter(
    cam => now - cam.lastSeen < EXPIRY_MS
  );
  res.json(activeCameras);
});

// GET /viewer - Live dashboard with recent transactions
app.get('/viewer', (req, res) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>LPR Heartbeat Viewer</title>
      <meta charset="UTF-8">
      <meta http-equiv="refresh" content="10">
      <style>
        body { font-family: sans-serif; background: #f4f4f4; padding: 20px; }
        h1 { color: #333; }
        table { border-collapse: collapse; width: 100%; background: white; }
        th, td { border: 1px solid #ccc; padding: 8px; text-align: left; vertical-align: top; }
        th { background: #222; color: white; }
        tr:nth-child(even) { background: #f9f9f9; }
        img.thumb { width: 120px; border: 1px solid #999; border-radius: 4px; }
      </style>
    </head>
    <body>
      <h1>📸 Live LPR Heartbeats</h1>
      <p>Auto-refreshes every 10 seconds. Showing last ${transactions.length} transactions.</p>
      <table>
        <thead>
          <tr>
            <th>Time Received</th>
            <th>Camera ID</th>
            <th>Plate</th>
            <th>Original Timestamp</th>
            <th>Plate Image</th>
          </tr>
        </thead>
        <tbody>
          ${transactions.map(tx => `
            <tr>
              <td>${tx.time}</td>
              <td>${tx.cameraId}</td>
              <td>${tx.plate}</td>
              <td>${tx.rawEventTime}</td>
              <td>
                ${tx.image ? `<img class="thumb" src="${tx.image}" alt="Plate Image">` : '—'}
              </td>
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
