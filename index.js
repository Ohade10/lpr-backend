// index.js - Full backend code with CodeConfidence + Base64 image + 50-row history + Socket updates

const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

let cameras = [];
const EXPIRY_MS = 30000;

// POST /heartbeat - Camera sends plate data
app.post('/heartbeat', (req, res) => {
  const { CameraId, Code, EventDateTime, PlateImageBase64, CodeConfidence } = req.body;

  if (!CameraId || !Code || !EventDateTime) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const entry = {
    id: CameraId,
    plate: Code,
    timestamp: EventDateTime,
    image: PlateImageBase64,
    confidence: CodeConfidence || 'N/A',
    lastSeen: Date.now()
  };

  cameras.unshift(entry);
  if (cameras.length > 50) cameras.pop();

  io.emit('cameraUpdate', cameras);
  res.status(200).json({ success: true });
});

// GET / - Return last 50 active rows
app.get('/', (req, res) => {
  const now = Date.now();
  const active = cameras.filter(c => now - c.lastSeen < EXPIRY_MS);
  res.json(active);
});

// Serve viewer
app.get('/viewer', (req, res) => {
  res.sendFile(__dirname + '/viewer.html');
});

// WebSocket connection
io.on('connection', (socket) => {
  console.log('Client connected');
  socket.emit('cameraUpdate', cameras);
});

server.listen(port, () => {
  console.log(`LPR backend running on http://localhost:${port}`);
});
