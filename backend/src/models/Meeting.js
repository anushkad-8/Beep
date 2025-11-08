// backend/src/models/Meeting.js
const mongoose = require("mongoose");

const meetingSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  date: { type: Date, required: true },
  duration: { type: Number, required: true }, // in minutes
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  invitedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  team: { type: String, default: "default" },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Meeting", meetingSchema);
