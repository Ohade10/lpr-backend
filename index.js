const express = require('express');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let cameras = {};

const EXPIRY_MS = 30000; // 30 seconds

// POST /heartbeat - Update camera status
app.post('/heartbeat', (req, res) => {
  const { CameraId, Code, EventDateTime } = req.body;

  if (!CameraId || !Code || !EventDateTime) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  cameras[CameraId] = {
    id: CameraId,
    plate: Code,
    timestamp: EventDateTime, // Use EventDateTime directly (not new Date().toISOString())
    lastSeen: Date.now()
  };

  res.status(200).json({ CameraId, Code, EventDateTime });
});

// GET / - Return only active cameras in AI Studio compatible format
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

app.listen(port, () => {
  console.log(`LPR backend running on port ${port}`);
});
