const mongoose = require('mongoose');

const AttachmentSchema = new mongoose.Schema({
  url: { type: String, required: true },
  name: { type: String },
  mime: { type: String },
  size: { type: Number },
});

const MessageSchema = new mongoose.Schema(
  {
    team: { type: String, default: "default" },
    channel: { type: String, required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, default: "" },
    attachments: [AttachmentSchema], // multiple files per message
  },
  { timestamps: true }
);

module.exports = mongoose.model("Message", MessageSchema);
