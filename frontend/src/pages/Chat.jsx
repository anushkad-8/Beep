// frontend/src/pages/Chat.jsx
import React, { useEffect, useState } from "react";
import io from "socket.io-client";
import API from "../api/api";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import ChatBox from "../components/ChatBox";
import Scheduler from "../components/Scheduler";
import toast, { Toaster } from "react-hot-toast";
import CalendarModal from "../components/CalendarModal";
import MeetingRoomModal from "../components/MeetingRoomModal"; // 🆕 video meeting modal

export default function ChatPage({ token }) {
  const [socket, setSocket] = useState(null);
  const [channel, setChannel] = useState({ type: "channel", id: "general", label: "# general" });
  const [messages, setMessages] = useState([]);
  const [me, setMe] = useState(null);
  const [users, setUsers] = useState([]);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showMeeting, setShowMeeting] = useState(false); // 🆕 toggle modal

  useEffect(() => {
    // Decode JWT token
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      setMe({ id: payload.id || payload._id, name: payload.name, email: payload.email });
    } catch {
      setMe(null);
    }

    const s = io(import.meta.env.VITE_WS_URL || "http://localhost:4000", { auth: { token } });
    setSocket(s);

    s.on("connect", () => console.log("✅ Socket connected"));

    // 📩 Message handling
    s.on("message:receive", (msg) => {
      if (channel.type === "channel" && msg.channel === channel.id) setMessages((prev) => [...prev, msg]);
      if (channel.type === "dm" && msg.channel === channel.id) setMessages((prev) => [...prev, msg]);
    });

    // 📅 Meeting notifications
    s.on("meeting:scheduled", (data) => {
      toast.success(`📅 ${data.title} scheduled at ${new Date(data.date).toLocaleString()}`, { duration: 6000 });
    });
    s.on("meeting:reminder", (data) => {
      toast(`⏰ Reminder: ${data.title} starts at ${new Date(data.date).toLocaleString()}`, {
        icon: "🔔",
        duration: 8000,
      });
    });

    s.on("presence:update", ({ userId, status }) => console.log(`Presence update: ${userId} is ${status}`));

    return () => s.disconnect();
    // eslint-disable-next-line
  }, []);

  // Load messages for selected channel
  useEffect(() => {
    async function load() {
      if (!channel) return;
      try {
        const res = await API.get(`/messages/${channel.id}`);
        setMessages(res.data || []);
      } catch {
        setMessages([]);
      }
    }
    load();
  }, [channel]);

  // Load users
  useEffect(() => {
    async function fetchUsers() {
      try {
        const res = await API.get("/users");
        const others = (res.data || []).filter((u) => String(u._id) !== String(me?.id));
        setUsers(others);
      } catch {
        setUsers([]);
      }
    }
    fetchUsers();
  }, [me]);

  // Navigation between chats / channels
  function handleNavigate(target) {
    if (target.type === "dm") {
      const a = String(me?.id);
      const b = String(target.userId);
      const dmId = a < b ? `dm:${a}-${b}` : `dm:${b}-${a}`;
      setChannel({ type: "dm", id: dmId, label: target.label });
    } else if (target.type === "channel") {
      setChannel({ type: "channel", id: target.id, label: target.label });
    } else if (target.type === "schedule") {
      setChannel({ type: "schedule", id: "schedule", label: "Schedule" });
    } else if (target.type === "team") {
      setChannel({ type: "team", id: target.id, label: target.label });
    }
  }

  // Logout
  function onLogout() {
    localStorage.removeItem("token");
    window.location.href = "/login";
  }

  // Send a message
  async function sendMessage(content) {
    if (!socket) return;
    const payload = { channel: channel.id, content, team: "default" };
    socket.emit("message:send", payload);
    setMessages((prev) => [...prev, { content, sender: { _id: me.id, name: me.name }, createdAt: new Date() }]);
  }

  // Start meeting (open modal)
  function onStartMeeting() {
    setShowMeeting(true);
  }

  return (
    <div className="h-screen flex bg-[#0e1423] text-white">
      <Toaster position="top-right" />
      <Sidebar user={me} users={users} channel={channel} onNavigate={handleNavigate} />

      <div className="flex-1 flex flex-col">
        <Header
          title={`${channel.label || "# general"}`}
          onLogout={onLogout}
          onStartMeeting={onStartMeeting}
          onViewSchedule={() => setShowCalendar(true)}
        />

        <div className="flex-1 grid grid-cols-[1fr_360px]">
          {/* 💬 Chat Section */}
          <main className="p-6">
            <div className="h-[calc(100vh-170px)] rounded-2xl overflow-hidden shadow-xl bg-[#141d33]">
              <ChatBox messages={messages} onSend={sendMessage} me={me} />
            </div>
          </main>

          {/* 📅 Sidebar Section */}
          <aside className="p-6 border-l border-gray-800 bg-[#111a2b]">
            <Scheduler token={token} />
            <div className="mt-8">
              <h4 className="text-sm font-semibold text-gray-300 mb-2">Participants</h4>
              <div className="text-sm text-gray-400">Open a room to show participants here</div>
            </div>
          </aside>
        </div>
      </div>

      {/* 📆 Calendar Modal */}
      {showCalendar && <CalendarModal onClose={() => setShowCalendar(false)} />}

      {/* 🎥 Meeting Modal */}
      {showMeeting && (
        <MeetingRoomModal
          socket={socket}
          me={me}
          onClose={() => setShowMeeting(false)}
        />
      )}
    </div>
  );
}
