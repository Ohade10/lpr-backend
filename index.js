const express = require('express');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let cameras = {};
const EXPIRY_MS = 30000; // 30 seconds

// POST /heartbeat - Receive events
app.post('/heartbeat', (req, res) => {
  const { CameraId, Code, EventDateTime, plateImageUrl } = req.body;

  if (!CameraId || !Code || !EventDateTime) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  cameras[CameraId] = {
    id: CameraId,
    plate: Code,
    timestamp: EventDateTime,
    lastSeen: Date.now(),
    image: plateImageUrl || null
  };

  res.status(200).json({ success: true });
});

// GET / - Returns active camera transactions
app.get('/', (req, res) => {
  const now = Date.now();
  const activeCameras = Object.values(cameras).filter(
    cam => now - cam.lastSeen < EXPIRY_MS
  );
  res.json(activeCameras);
});

// GET /viewer - Auto-refreshing transaction viewer
app.get('/viewer', (req, res) => {
  const now = Date.now();
  const activeCameras = Object.values(cameras).filter(
    cam => now - cam.lastSeen < EXPIRY_MS
  );

  const html = `
    <html>
      <head>
        <title>LPR Viewer</title>
        <meta http-equiv="refresh" content="5" />
        <style>
          body { font-family: Arial, sans-serif; background: #111; color: #fff; padding: 20px; }
          h1 { color: #0ff; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { padding: 10px; border: 1px solid #444; text-align: left; }
          img { max-width: 250px; height: auto; border: 1px solid #666; }
        </style>
      </head>
      <body>
        <h1>📸 Active LPR Events (last 30s)</h1>
        <table>
          <thead>
            <tr>
              <th>Camera ID</th>
              <th>Plate</th>
              <th>Timestamp</th>
              <th>Plate Image</th>
            </tr>
          </thead>
          <tbody>
            ${activeCameras
              .map(
                cam => `
                <tr>
                  <td>${cam.id}</td>
                  <td>${cam.plate}</td>
                  <td>${new Date(cam.timestamp).toLocaleString()}</td>
                  <td>${
                    cam.image
                      ? `<img src="${cam.image}" alt="Plate image for ${cam.plate}" />`
                      : '—'
                  }</td>
                </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </body>
    </html>
  `;

  res.send(html);
});

app.listen(port, () => {
  console.log(`🚀 LPR backend running at http://localhost:${port}`);
});
