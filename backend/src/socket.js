const jwtUtils = require("./utils/jwt");
const Message = require("./models/Message");

function initSocket(io) {
  const userSockets = new Map(); // userId → Set(socketIds)
  const socketUser = new Map(); // socketId → userId

  // 🔐 Middleware — verify user token
  io.use((socket, next) => {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    if (!token) return next(new Error("No auth token"));

    try {
      const payload = jwtUtils.verify(token);
      socket.user = payload;
      next();
    } catch (err) {
      next(new Error("Auth error"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.user.id;
    socketUser.set(socket.id, userId);

    if (!userSockets.has(userId)) userSockets.set(userId, new Set());
    userSockets.get(userId).add(socket.id);

    console.log(`✅ User connected: ${userId} via socket ${socket.id}`);

    // ==============================================
    // 🧩 TEAM PRESENCE
    // ==============================================
    socket.on("join_team", ({ team }) => {
      socket.join(`team:${team}`);
      io.to(`team:${team}`).emit("presence:update", { userId, status: "online" });
    });

    // ==============================================
    // 💬 CHAT MESSAGE HANDLING
    // ==============================================
    socket.on("message:send", async (payload) => {
      const { channel, content, attachments } = payload;

      const msg = new Message({
        team: payload.team || "default",
        channel,
        sender: userId,
        content,
        attachments,
      });

      await msg.save();
      const populated = await msg.populate("sender", "name email avatarUrl");

      io.to(`channel:${channel}`).emit("message:receive", populated);
    });

    // ==============================================
    // 🎥 MEDIASOUP ROOM EVENTS
    // ==============================================
    socket.on("join_room", ({ roomId }) => {
      socket.join(`room:${roomId}`);
      io.to(`room:${roomId}`).emit("room:peer-joined", { peerId: socket.id, userId });
      console.log(`👥 ${userId} joined room:${roomId}`);
    });

    socket.on("leave_room", ({ roomId }) => {
      socket.leave(`room:${roomId}`);
      io.to(`room:${roomId}`).emit("room:peer-left", { peerId: socket.id, userId });
      console.log(`👋 ${userId} left room:${roomId}`);
    });

    // Triggered when a new producer is created (video/audio track)
    socket.on("producer:created", ({ roomId, producerId, peerId }) => {
      socket.to(`room:${roomId}`).emit("room:new-producer", { producerId, peerId });
      console.log(`🎞️ New producer in room ${roomId}: ${producerId} by ${peerId}`);
    });

    // ==============================================
    // 🔄 WEBRTC SIGNALING (for direct connections)
    // ==============================================
    socket.on("webrtc:offer", ({ to, offer }) => {
      const sockets = userSockets.get(to) || new Set();
      sockets.forEach((sid) =>
        io.to(sid).emit("webrtc:offer", { from: userId, offer })
      );
    });

    socket.on("webrtc:answer", ({ to, answer }) => {
      const sockets = userSockets.get(to) || new Set();
      sockets.forEach((sid) =>
        io.to(sid).emit("webrtc:answer", { from: userId, answer })
      );
    });

    socket.on("webrtc:ice", ({ to, candidate }) => {
      const sockets = userSockets.get(to) || new Set();
      sockets.forEach((sid) =>
        io.to(sid).emit("webrtc:ice", { from: userId, candidate })
      );
    });

    // ==============================================
    // 🔌 CLEANUP ON DISCONNECT
    // ==============================================
    socket.on("disconnect", () => {
      const u = socketUser.get(socket.id);
      if (u) {
        const set = userSockets.get(u);
        if (set) {
          set.delete(socket.id);
          if (set.size === 0) {
            userSockets.delete(u);
          }
        }
      }

      socketUser.delete(socket.id);
      io.emit("presence:update", { userId: u, status: "offline" });
      io.emit("room:peer-left", { peerId: socket.id, userId: u });

      console.log(`❌ User ${u} disconnected (socket ${socket.id})`);
    });
  });
}

module.exports = initSocket;
