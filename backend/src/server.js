require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const connectDB = require("./config/db");
const { initMediasoup } = require("./mediasoup/mediasoupServer");

// Import routes
const authRoutes = require("./routes/auth");
const messagesRoutes = require("./routes/messages");
const meetingsRoutes = require("./routes/meetings");
const mediasoupRoutes = require("./mediasoup/routes");
const transcribeRoute = require("./routes/transcribe");
const usersRoutes = require("./routes/users");
const initSocket = require("./socket");

const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/office_meetings";

const app = express();
console.log("🧭 __dirname =", __dirname);
const testPath = path.resolve(__dirname, "../uploads");
console.log("🔍 Expected uploads path:", testPath);
console.log("📂 Does it exist?", fs.existsSync(testPath));
app.use(cors());
app.use(express.json());

// ============================
// 📁 STATIC FILE SERVING (Uploads)
// ============================
const uploadDir = path.resolve(__dirname, "../uploads"); // ✅ correct path
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

console.log("🧭 __dirname =", __dirname);
console.log("🧩 Serving uploads from:", uploadDir);
console.log("📂 Exists:", fs.existsSync(uploadDir));

app.use(
  "/uploads",
  express.static(uploadDir, {
    setHeaders: (res) => {
      res.set("Access-Control-Allow-Origin", "*");
    },
  })
);

// ✅ Must come BEFORE all route handlers


// ============================
// ⚙️ Multer Setup for Local Uploads
// ============================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + "_" + file.originalname),
});
const upload = multer({ storage });

// ============================
// ☁️ FILE UPLOAD / PRESIGN ROUTE (AWS + Local Fallback)
// ============================
const AWS = require("aws-sdk");

if (process.env.AWS_ACCESS_KEY_ID && process.env.S3_BUCKET) {
  const s3 = new AWS.S3({ region: process.env.S3_REGION });

  // Generate AWS presigned URL
  app.post("/api/files/presign", async (req, res) => {
    const { name, type } = req.body;
    const key = `uploads/${Date.now()}_${name}`;
    const url = s3.getSignedUrl("putObject", {
      Bucket: process.env.S3_BUCKET,
      Key: key,
      ContentType: type,
      Expires: 60,
    });

    res.json({
      url,
      key,
      publicUrl: `https://${process.env.S3_BUCKET}.s3.${process.env.S3_REGION}.amazonaws.com/${key}`,
    });
  });
} else {
  // 🧩 Local Upload Mode
  app.post("/api/files/presign", (req, res) => {
    const filename = `${Date.now()}_${req.body.name}`;
    res.json({
      url: `http://localhost:${PORT}/local-upload`,
      key: `local/${filename}`,
      publicUrl: `http://localhost:${PORT}/uploads/${filename}`,
    });
  });

  // Handle local upload PUT request
  app.put("/local-upload", upload.single("file"), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const fileUrl = `http://localhost:${PORT}/uploads/${req.file.filename}`;
    console.log("✅ File uploaded:", fileUrl);
    res.json({ success: true, fileUrl });
  });
}

// ============================
// 🚀 Initialize Server + Socket.IO + DB + Routes
// ============================
(async () => {
  await connectDB(MONGO_URI);

  try {
    await initMediasoup();
  } catch (e) {
    console.warn("⚠️ mediasoup init failed (you can enable later):", e.message || e);
  }

  const server = http.createServer(app);
  const { Server } = require("socket.io");
  const io = new Server(server, { cors: { origin: "*" } });

  // Make socket.io globally accessible
  app.set("io", io);
  initSocket(io);

  // Load scheduled meeting reminders
  const reminderScheduler = require("./jobs/reminderScheduler");
  reminderScheduler.loadUpcomingMeetings(io);

  // User rooms for direct notifications
  io.on("connection", (socket) => {
    const userId = socket.handshake.auth?.tokenUserId || socket.user?.id;
    if (userId) {
      socket.join(userId.toString());
      console.log(`👤 User ${userId} joined their personal room`);
    }
  });

  // API routes
  app.use("/api/auth", authRoutes);
  app.use("/api/messages", messagesRoutes);
  app.use("/api/meetings", meetingsRoutes);
  app.use("/api/mediasoup", mediasoupRoutes);
  app.use("/api/transcribe", transcribeRoute);
  app.use("/api/users", usersRoutes);

  // ✅ Start server
  server.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
  });
})();
