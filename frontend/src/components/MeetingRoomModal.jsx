import React, { useEffect, useRef, useState } from "react";
import * as mediasoupClient from "mediasoup-client";
import API from "../api/api";
import { X, Mic, MicOff, Video, VideoOff, PhoneOff } from "lucide-react";

export default function MeetingRoomModal({ socket, me, onClose }) {
  const roomId = "team-room";
  const localVideoRef = useRef(null);
  const [device, setDevice] = useState(null);
  const [sendTransport, setSendTransport] = useState(null);
  const [recvTransport, setRecvTransport] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [joined, setJoined] = useState(false);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);

  // 🔁 Socket listeners
  useEffect(() => {
    if (!socket) return;

    socket.on("room:peer-joined", () => {
      console.log("👥 Peer joined, refreshing producers...");
      fetchProducers();
    });

    socket.on("room:peer-left", () => {
      console.log("👋 Peer left, refreshing producers...");
      fetchProducers();
    });

    return () => {
      socket.off("room:peer-joined");
      socket.off("room:peer-left");
    };
  }, [socket]);

  // 🔄 Attach remote video streams dynamically
  useEffect(() => {
    Object.entries(remoteStreams).forEach(([peerId, stream]) => {
      const videoEl = document.getElementById(`remote-${peerId}`);
      if (videoEl && !videoEl.srcObject) {
        videoEl.srcObject = stream;
      }
    });
  }, [remoteStreams]);

  async function fetchProducers() {
    try {
      const res = await API.get(`/mediasoup/rooms/${roomId}/producers`);
      console.log("🎯 Fetched producers:", res.data);
      for (const p of res.data || []) {
        if (p.peerId !== socket.id) {
          await consumeTrack(p);
        }
      }
    } catch (err) {
      console.error("❌ Failed to fetch producers:", err);
    }
  }

  async function join() {
    try {
      console.log("🚀 Joining meeting...");
      const { data } = await API.get(`/mediasoup/rooms/${roomId}/rtpCapabilities`);
      const dev = new mediasoupClient.Device();
      await dev.load({ routerRtpCapabilities: data.rtpCapabilities });
      setDevice(dev);
      console.log("✅ Device loaded");

      // --- Send transport ---
      const sendParams = (await API.post(`/mediasoup/rooms/${roomId}/create-transport`)).data;
      const sendT = dev.createSendTransport(sendParams);

      sendT.on("connect", async ({ dtlsParameters }, callback, errback) => {
        try {
          await API.post(`/mediasoup/rooms/${roomId}/transport-connect`, {
            transportId: sendT.id,
            dtlsParameters,
            peerId: socket.id,
          });
          callback();
        } catch (e) {
          errback(e);
        }
      });

      sendT.on("produce", async ({ kind, rtpParameters }, callback, errback) => {
        try {
          const res = await API.post(`/mediasoup/rooms/${roomId}/produce`, {
            transportId: sendT.id,
            kind,
            rtpParameters,
            peerId: socket.id,
          });
          callback({ id: res.data.id });
        } catch (e) {
          errback(e);
        }
      });
      setSendTransport(sendT);

      // --- Recv transport ---
      const recvParams = (await API.post(`/mediasoup/rooms/${roomId}/create-transport`)).data;
      const recvT = dev.createRecvTransport(recvParams);

      recvT.on("connect", async ({ dtlsParameters }, callback, errback) => {
        try {
          await API.post(`/mediasoup/rooms/${roomId}/transport-connect`, {
            transportId: recvT.id,
            dtlsParameters,
            peerId: socket.id,
          });
          callback();
        } catch (e) {
          errback(e);
        }
      });
      setRecvTransport(recvT);

      // --- Local stream ---
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      console.log("🎥 Local media captured");

      for (const track of stream.getTracks()) {
        await sendT.produce({ track });
      }
      console.log("✅ Local tracks produced");

      socket.emit("join_room", { roomId });
      setJoined(true);

      await fetchProducers();
      console.log("📡 Joined room");
    } catch (err) {
      console.error("❌ Join meeting failed:", err);
    }
  }

  async function consumeTrack(p) {
    try {
      console.log("📥 Consuming track from:", p.peerId);
      const { data } = await API.post(`/mediasoup/rooms/${roomId}/consume`, {
        transportId: recvTransport?.id,
        producerId: p.id,
        rtpCapabilities: device?.rtpCapabilities,
        peerId: socket.id,
      });

      if (!data || !data.id) {
        console.warn("⚠️ Invalid consumer response:", data);
        return;
      }

      const consumer = await recvTransport.consume({
        id: data.id,
        producerId: data.producerId,
        kind: data.kind,
        rtpParameters: data.rtpParameters,
      });

      const stream = new MediaStream();
      stream.addTrack(consumer.track);

      // Wait for DOM render before attaching
      setTimeout(() => {
        const videoEl = document.getElementById(`remote-${p.peerId}`);
        if (videoEl) videoEl.srcObject = stream;
        else console.warn("⚠️ Remote video element not found for:", p.peerId);
      }, 300);

      setRemoteStreams((prev) => ({ ...prev, [p.peerId]: stream }));
      console.log(`✅ Consumed ${data.kind} track from ${p.peerId}`);
    } catch (err) {
      console.error("❌ Consume failed:", err);
    }
  }

  function toggleMic() {
    const track = localVideoRef.current?.srcObject?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMuted(!track.enabled);
    }
  }

  function toggleCam() {
    const track = localVideoRef.current?.srcObject?.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setCamOff(!track.enabled);
    }
  }

  function leaveMeeting() {
    socket.emit("leave_room", { roomId });
    setJoined(false);
    setRemoteStreams({});
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-[#0b1220] rounded-2xl w-[90%] max-w-6xl h-[85vh] flex flex-col border border-gray-700 shadow-2xl relative overflow-hidden">
        <div className="flex justify-between items-center px-5 py-3 border-b border-gray-800 bg-[#111a2b]/70">
          <h2 className="text-violet-300 text-lg font-semibold flex items-center gap-2">
            👥 Team Meeting Room
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {!joined ? (
          <div className="flex flex-1 items-center justify-center">
            <button
              onClick={join}
              className="bg-violet-600 hover:bg-violet-700 text-white px-8 py-3 rounded-xl font-medium shadow-lg transition"
            >
              Join Meeting
            </button>
          </div>
        ) : (
          <>
            {/* 🎥 Video Grid */}
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-5 overflow-y-auto bg-[#0b1220]/80">
              {/* Local video */}
              <div className="relative rounded-xl overflow-hidden border border-gray-700 bg-black shadow-md">
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-48 object-cover rounded-xl"
                />
                <span className="absolute bottom-1 left-2 text-xs text-white bg-black/50 px-2 rounded">
                  You
                </span>
              </div>

              {/* Remote videos */}
              {Object.entries(remoteStreams).map(([peerId]) => (
                <div
                  key={peerId}
                  className="relative rounded-xl overflow-hidden border border-gray-700 bg-black shadow-md"
                >
                  <video
                    id={`remote-${peerId}`}
                    autoPlay
                    playsInline
                    className="w-full h-48 object-cover rounded-xl"
                  />
                  <span className="absolute bottom-1 left-2 text-xs text-white bg-black/50 px-2 rounded">
                    {peerId.slice(0, 6)}...
                  </span>
                </div>
              ))}
            </div>

            {/* 🎛 Controls */}
            <div className="flex justify-center items-center gap-6 py-4 border-t border-gray-800 bg-[#111a2b]/80">
              <button
                onClick={toggleMic}
                className={`p-3 rounded-full transition ${
                  muted ? "bg-red-600" : "bg-gray-700 hover:bg-gray-600"
                }`}
              >
                {muted ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
              <button
                onClick={toggleCam}
                className={`p-3 rounded-full transition ${
                  camOff ? "bg-red-600" : "bg-gray-700 hover:bg-gray-600"
                }`}
              >
                {camOff ? <VideoOff size={18} /> : <Video size={18} />}
              </button>
              <button
                onClick={leaveMeeting}
                className="p-3 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-lg"
              >
                <PhoneOff size={18} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
