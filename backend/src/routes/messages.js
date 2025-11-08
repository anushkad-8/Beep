const express = require("express");
const router = express.Router();
const Message = require("../models/Message");

// 📩 Get all messages for a channel
router.get("/:channelId", async (req, res) => {
  try {
    const { channelId } = req.params;
    const msgs = await Message.find({ channel: channelId })
      .sort({ createdAt: 1 })
      .limit(200)
      .populate("sender", "name email");
    res.json(msgs);
  } catch (err) {
    console.error("❌ Error fetching messages:", err);
    res.status(500).json({ error: "Failed to load messages" });
  }
});

// 📤 Upload message with attachments (file uploads)
router.post("/upload", async (req, res) => {
  try {
    const { sender, channel, content, attachments } = req.body;

    if (!attachments || attachments.length === 0) {
      return res.status(400).json({ error: "No attachments provided" });
    }

    const newMessage = new Message({
      sender,
      channel,
      content: content || "[File]",
      attachments,
    });

    await newMessage.save();

    // Emit real-time message event
    const io = req.app.get("io");
    io.emit("message:receive", await newMessage.populate("sender", "name email"));

    res.json(newMessage);
  } catch (err) {
    console.error("❌ Error saving uploaded message:", err);
    res.status(500).json({ error: "Server error while saving file message" });
  }
});

// 💬 Send a normal text message
router.post("/", async (req, res) => {
  try {
    const { sender, channel, content } = req.body;
    if (!content || !channel) return res.status(400).json({ error: "Missing data" });

    const msg = await Message.create({
      sender,
      channel,
      content,
    });

    const io = req.app.get("io");
    io.emit("message:receive", await msg.populate("sender", "name email"));
    res.json(msg);
  } catch (err) {
    console.error("❌ Error sending message:", err);
    res.status(500).json({ error: "Server error while sending message" });
  }
});

module.exports = router;
