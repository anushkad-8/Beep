// frontend/src/components/ChatBox.jsx
import React, { useEffect, useRef, useState } from "react";
import dayjs from "dayjs";
import API from "../api/api";
import { PaperclipIcon, SendIcon, FileIcon, ImageIcon } from "lucide-react";

function MessageBubble({ m, meId }) {
  const mine = String(m.sender?._id) === String(meId);
  const attachments = m.attachments || [];

  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"} mb-4`}>
      {!mine && (
        <div className="mr-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-br from-violet-600 to-indigo-600 text-white font-semibold">
            {m.sender?.name?.[0]?.toUpperCase() || "U"}
          </div>
        </div>
      )}

      <div className={`max-w-[70%] ${mine ? "text-right" : "text-left"}`}>
        <div
          className={`inline-block p-3 rounded-2xl shadow-lg ${
            mine ? "bg-violet-600 text-white" : "bg-[#0b1220] text-gray-200"
          }`}
        >
          {/* attachments */}
          {attachments.length > 0 ? (
            <div className="flex flex-col gap-2">
              {attachments.map((att, idx) => (
                <div key={idx}>
                  {att.mime?.startsWith("image/") ? (
                    <img
                      src={att.url}
                      alt={att.name}
                      className="rounded-lg max-h-60 border border-gray-700 mb-1"
                    />
                  ) : null}

                  <a
                    href={att.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 text-sm underline text-violet-200 hover:text-violet-100 break-all"
                  >
                    {att.mime?.startsWith("image/") ? (
                      <ImageIcon size={16} />
                    ) : (
                      <FileIcon size={16} />
                    )}
                    {att.name}
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm font-medium">{m.content}</div>
          )}
        </div>

        <div className="text-xs text-gray-500 mt-1">
          <span>{m.sender?.name || (mine ? "You" : "Unknown")}</span> •{" "}
          <span>{dayjs(m.createdAt).format("h:mm A")}</span>
        </div>
      </div>

      {mine && (
        <div className="ml-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-700 text-white font-semibold">
            {m.sender?.name?.[0]?.toUpperCase() || "Y"}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ChatBox({ messages = [], onSend, me }) {
  const [text, setText] = useState("");
  const endRef = useRef();

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [messages]);

  async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
      // 1) request presign or local upload info
      const { data } = await API.post("/files/presign", {
        name: file.name,
        type: file.type,
      });

      // 2) upload binary
      let finalFileUrl = null;

      if (data.url.includes("local-upload") || data.url.startsWith("http://localhost")) {
        // Local upload expects multipart/form-data; send file under 'file'
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch(data.url, {
          method: "PUT",
          body: formData,
        });

        if (!res.ok) throw new Error(`Local upload failed (${res.status})`);
        const json = await res.json();
        // backend returns .fileUrl for local hander
        finalFileUrl = json.fileUrl || data.publicUrl || `http://localhost:4000/uploads/${file.name}`;
      } else {
        // S3 style - PUT raw bytes
        const res = await fetch(data.url, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!res.ok) throw new Error(`S3 upload failed (${res.status})`);
        finalFileUrl = data.publicUrl;
      }

      // 3) prepare payload that matches your Message schema (attachments array)
      const payload = {
        sender: me?._id || me?.id,
        channel: "general",
        content: `[File]: ${file.name}`,
        attachments: [
          {
            url: finalFileUrl,
            name: file.name,
            mime: file.type,
            size: file.size || 0,
          },
        ],
      };

      // 4) emit real-time event (optional) and save to DB
      if (window.socket) window.socket.emit("file:send", payload);
      await API.post("/messages/upload", payload);

      // success — scroll and done
      // optimistic UI will update when socket emits message:receive; but we can optionally add it locally
    } catch (err) {
      console.error("❌ File upload failed:", err);
      alert("File upload failed. See console for details.");
    }
  }

  function submit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text.trim());
    setText("");
  }

  return (
    <div className="flex flex-col h-full">
      {/* messages */}
      <div className="flex-1 overflow-auto p-6 bg-gradient-to-b from-[#071029] to-[#081126]">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-20">
            No messages yet — send the first message to start the conversation.
          </div>
        )}
        {messages.map((m) => (
          <MessageBubble key={m._id || Math.random()} m={m} meId={me?.id || me?._id} />
        ))}
        <div ref={endRef} />
      </div>

      {/* input */}
      <form
        onSubmit={submit}
        className="p-4 bg-[#071029] border-t border-gray-800 flex items-center gap-3"
      >
        <label className="cursor-pointer">
          <PaperclipIcon className="text-violet-300 hover:text-violet-400" size={22} />
          <input type="file" onChange={handleFileUpload} className="hidden" />
        </label>

        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message the team..."
          className="flex-1 bg-transparent border border-gray-800 px-4 py-2 rounded-full text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
        />

        <button
          type="submit"
          className="bg-gradient-to-r from-violet-500 to-indigo-600 px-4 py-2 rounded-full text-white shadow flex items-center gap-1"
        >
          <SendIcon size={18} /> <span>Send</span>
        </button>
      </form>
    </div>
  );
}
