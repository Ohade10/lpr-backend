// index.js
const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Adjust as needed
    methods: ["GET", "POST"]
  }
});

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, "public")));

// Optional: simple health check
app.get("/", (req, res) => {
  res.send("LPR Backend Running");
});

// Socket.io events
io.on("connection", (socket) => {
  console.log("🚗 Client connected:", socket.id);

  // Emit fake LPR data every 6 seconds
  const interval = setInterval(() => {
    const event = {
      CameraId: "cam-001",
      Code: "XYZ123",
      CodeConfidence: Math.round(Math.random() * 100),
      EventDateTime: new Date().toISOString(),
      PlateImageBase64: "data:image/jpeg;base64,..."
    };

    socket.emit("lprEvent", event);
    console.log("📸 Sent LPR event:", event);
  }, 6000);

  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
    clearInterval(interval);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
