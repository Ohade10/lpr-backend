const express = require("express");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// In memory storage
const EVENTS_LIMIT = 50;
const lastSeen = new Map();
const events = [];

// Health and sanity routes
app.get("/", (req, res) => {
  res.send("LPR backend running");
});

app.get("/ping", (req, res) => {
  res.send("pong");
});

// Main ingest endpoint
// This matches your template exactly, and Make and Color are optional.
// Missing optional fields will not fail the request.
app.post("/events", (req, res) => {
  const {
    CameraId,
    Code,
    EventDateTime,
    CodeConfidence,
    PlateImageBase64,
    VehicleMake,
    CarColor
  } = req.body || {};

  if (!CameraId || !Code || !EventDateTime) {
    return res.status(400).json({
      error: "Missing required fields: CameraId, Code, EventDateTime"
    });
  }

  const event = {
    id: uuidv4(),
    CameraId,
    Code,
    EventDateTime,
    CodeConfidence: CodeConfidence ?? null,
    PlateImageBase64: PlateImageBase64 ?? null,
    VehicleMake: VehicleMake ?? null,
    CarColor: CarColor ?? null,
    receivedAt: new Date().toISOString()
  };

  events.unshift(event);
  if (events.length > EVENTS_LIMIT) events.pop();

  lastSeen.set(CameraId, Date.now());

  res.status(200).json({ success: true, event });
});

// Fetch recent events for your dashboard
app.get("/events", (req, res) => {
  res.json(events);
});

// Simple camera status endpoint
app.get("/cameras/status", (req, res) => {
  const now = Date.now();
  const result = [];

  for (const [cameraId, ts] of lastSeen.entries()) {
    result.push({
      CameraId: cameraId,
      lastSeen: new Date(ts).toISOString(),
      isOnline: now - ts < 10 * 60 * 1000
    });
  }

  res.json(result);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
