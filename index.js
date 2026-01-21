// index.js
// LPR backend with REST ingest, 50 event history, optional live updates, and camera status.
// Designed to be resilient across slightly different package.json setups.

const express = require("express");
const cors = require("cors");
const http = require("http");

// Optional dotenv support
try {
  require("dotenv").config();
} catch (e) {
  // If dotenv is not installed, continue without it
}

// Optional uuid support
let uuidv4 = null;
try {
  ({ v4: uuidv4 } = require("uuid"));
} catch (e) {
  // If uuid is not installed, we will use a fallback id generator
}

const app = express();
const PORT = process.env.PORT || 3000;

// CORS setup
const corsOrigin = process.env.CORS_ORIGIN || "*";
app.use(
  cors({
    origin: corsOrigin,
    methods: ["GET", "POST", "OPTIONS"],
    credentials: false
  })
);

// Body parsing
app.use(express.json({ limit: "10mb" }));

// HTTP server
const server = http.createServer(app);

// Optional Socket.IO support
let io = null;
try {
  const { Server } = require("socket.io");
  io = new Server(server, {
    cors: {
      origin: corsOrigin,
      methods: ["GET", "POST"]
    }
  });
} catch (e) {
  io = null;
}

// In memory storage
const EVENTS_LIMIT = 50;
const CAMERA_ONLINE_MS = 10 * 60 * 1000;
const lastSeen = new Map();
const events = [];

// Utilities
function makeId() {
  if (uuidv4) return uuidv4();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeEvent(body) {
  const {
    CameraId,
    Code,
    EventDateTime,
    CodeConfidence,
    PlateImageBase64,
    ImageBase64,
    VehicleMake,
    CarColor
  } = body || {};

  return {
    id: makeId(),
    CameraId,
    Code,
    EventDateTime,
    CodeConfidence: CodeConfidence ?? null,
    PlateImageBase64: PlateImageBase64 ?? null,
    ImageBase64: ImageBase64 ?? null,
    VehicleMake: VehicleMake ?? null,
    CarColor: CarColor ?? null,
    receivedAt: new Date().toISOString()
  };
}

function validateRequired(event) {
  return event && event.CameraId && event.Code && event.EventDateTime;
}

function pushEvent(event) {
  events.unshift(event);
  if (events.length > EVENTS_LIMIT) events.pop();

  lastSeen.set(event.CameraId, Date.now());

  if (io) {
    io.emit("lprEvent", event);
    io.emit("eventsUpdate", events);
  }
}

// Health routes
app.get("/ping", (req, res) => res.send("pong"));

// Root returns recent events to keep older dashboards happy
app.get("/", (req, res) => {
  res.status(200).json(events);
});

// Main ingest endpoint
app.post("/events", (req, res) => {
  const event = normalizeEvent(req.body);

  console.log("Received event", {
    CameraId: event.CameraId,
    HasPlateImage: !!event.PlateImageBase64,
    HasImageBase64: !!event.ImageBase64
  });

  if (!validateRequired(event)) {
    return res.status(400).json({
      error: "Missing required fields: CameraId, Code, EventDateTime"
    });
  }

  pushEvent(event);

  res.status(200).json({
    success: true,
    event
  });
});

// Backward compatible ingest route
app.post("/heartbeat", (req, res) => {
  const event = normalizeEvent(req.body);

  if (!validateRequired(event)) {
    return res.status(400).json({
      error: "Missing required fields: CameraId, Code, EventDateTime"
    });
  }

  pushEvent(event);

  res.status(200).json({
    success: true,
    event
  });
});

// Fetch recent events explicitly
app.get("/events", (req, res) => {
  res.status(200).json(events);
});

// Simple camera status endpoint
app.get("/cameras/status", (req, res) => {
  const now = Date.now();
  const result = [];

  for (const [cameraId, ts] of lastSeen.entries()) {
    result.push({
      CameraId: cameraId,
      lastSeen: new Date(ts).toISOString(),
      isOnline: now - ts < CAMERA_ONLINE_MS
    });
  }

  res.status(200).json(result);
});

// Serve viewer if you have a local file
app.get("/viewer", (req, res) => {
  res.sendFile(__dirname + "/viewer.html", err => {
    if (err) {
      res
        .status(404)
        .send("viewer.html not found. This route is optional.");
    }
  });
});

// WebSocket connection handlers if Socket.IO exists
if (io) {
  io.on("connection", socket => {
    socket.emit("eventsUpdate", events);
  });
}

// Start server
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  if (!io) {
    console.log("Socket.IO not detected. REST endpoints will still work.");
  }
});
