import React, { useEffect, useRef, useState } from "react";
import * as mediasoupClient from "mediasoup-client";
import API from "../api/api";
import { X, Mic, MicOff, Video, VideoOff, Users } from "lucide-react";

export default function MeetingRoomModal({ socket, me, onClose }) {
  const roomId = "team-room"; // static for now
  const localVideoRef = useRef(null);
  const [device, setDevice] = useState(null);
  const [sendTransport, setSendTransport] = useState(null);
  const [recvTransport, setRecvTransport] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [joined, setJoined] = useState(false);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);

  // 🔁 Socket event listeners
  useEffect(() => {
    if (!socket) return;

    socket.on("room:peer-joined", async () => {
      console.log("👥 Peer joined, fetching producers...");
      await fetchProducers();
    });

    socket.on("room:peer-left", async () => {
      console.log("👋 Peer left, refreshing producers...");
      await fetchProducers();
    });

    return () => {
      socket.off("room:peer-joined");
      socket.off("room:peer-left");
    };
  }, [socket, device, recvTransport]);

  // 🚀 Join Meeting
  async function join() {
    console.log("🚀 Joining meeting...");
    try {
      // 1️⃣ Load router RTP capabilities
      const { data } = await API.get(`/mediasoup/rooms/${roomId}/rtpCapabilities`);
      const dev = new mediasoupClient.Device();
      await dev.load({ routerRtpCapabilities: data.rtpCapabilities });
      setDevice(dev);
      console.log("✅ Device loaded");

      // 2️⃣ Create Send Transport
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
        } catch (err) {
          console.error("❌ Send transport connect failed:", err);
          errback(err);
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
        } catch (err) {
          console.error("❌ Produce failed:", err);
          errback(err);
        }
      });
      setSendTransport(sendT);

      // 3️⃣ Create Recv Transport
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
        } catch (err) {
          console.error("❌ Recv transport connect failed:", err);
          errback(err);
        }
      });
      setRecvTransport(recvT);

      // 4️⃣ Capture local media
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      console.log("🎥 Local media captured");

      // ✅ Wait for ref to be ready
      let attempts = 0;
      while (!localVideoRef.current && attempts < 10) {
        await new Promise((r) => setTimeout(r, 100));
        attempts++;
      }
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        console.log("✅ Local video stream attached");
      } else {
        console.warn("⚠️ Video element not ready; skipping attach");
      }

      // 5️⃣ Produce local tracks
      for (const track of stream.getTracks()) await sendT.produce({ track });
      console.log("✅ Local tracks produced");

      // 6️⃣ Join the room
      socket.emit("join_room", { roomId });
      setJoined(true);
      console.log("📡 Joined room");

      // 7️⃣ Fetch and consume existing producers
      await fetchProducers(dev, recvT);
    } catch (err) {
      console.error("❌ Join meeting failed:", err);
    }
  }

  // 🔄 Fetch all active producers in the room
  async function fetchProducers(dev = device, recvT = recvTransport) {
    if (!dev || !recvT) return;
    try {
      const res = await API.get(`/mediasoup/rooms/${roomId}/producers`);
      console.log("🎯 Fetched producers:", res.data);
      for (const p of res.data || []) {
        if (p.peerId !== socket.id) await consumeTrack(p, dev, recvT);
      }
    } catch (err) {
      console.error("❌ Failed to fetch producers:", err);
    }
  }

  // 📥 Consume remote producer streams
  async function consumeTrack(p, dev, recvT) {
    try {
      console.log("📥 Consuming track from:", p.peerId);
      const { data } = await API.post(`/mediasoup/rooms/${roomId}/consume`, {
        transportId: recvT.id,
        producerId: p.id,
        rtpCapabilities: dev.rtpCapabilities,
        peerId: socket.id,
      });

      const consumer = await recvT.consume({
        id: data.id,
        producerId: data.producerId,
        kind: data.kind,
        rtpParameters: data.rtpParameters,
      });

      const stream = new MediaStream([consumer.track]);
      setRemoteStreams((prev) => ({ ...prev, [p.peerId]: stream }));
      console.log("✅ Remote stream added for", p.peerId);
    } catch (err) {
      console.error("❌ Consume failed:", err);
    }
  }

  // 🎙 Toggle mic
  function toggleMic() {
    const track = localVideoRef.current?.srcObject?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMuted(!track.enabled);
    }
  }

  // 🎥 Toggle camera
  function toggleCam() {
    const track = localVideoRef.current?.srcObject?.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setCamOff(!track.enabled);
    }
  }

  // 🚪 Leave meeting
  function leaveMeeting() {
    socket.emit("leave_room", { roomId });
    setJoined(false);
    onClose();
  }

  // 🧱 Determine grid layout
  const participantCount = 1 + Object.keys(remoteStreams).length;
  const gridCols = participantCount <= 2 ? "grid-cols-2" : participantCount <= 4 ? "grid-cols-3" : "grid-cols-4";

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-[#0e1423] w-[90%] md:w-[80%] h-[80vh] rounded-2xl border border-gray-700 shadow-2xl p-5 flex flex-col relative">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-gray-800 pb-2 mb-4">
          <h2 className="text-violet-300 text-lg font-semibold flex items-center gap-2">
            <Users size={18} /> Team Meeting Room
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={22} />
          </button>
        </div>

        {!joined ? (
          <div className="flex justify-center items-center flex-1">
            <button
              onClick={join}
              className="bg-violet-600 hover:bg-violet-700 px-6 py-3 rounded-xl text-white font-medium shadow-lg"
            >
              Join Meeting
            </button>
          </div>
        ) : (
          <>
            {/* Video Grid */}
            <div className={`grid ${gridCols} gap-4 flex-1 overflow-auto mb-4`}>
              {/* Local Video */}
              <div className="relative border border-gray-700 rounded-lg overflow-hidden">
                <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-44 bg-black" />
                <div className="absolute bottom-1 left-2 text-xs bg-black/50 px-2 rounded">You</div>
              </div>

              {/* Remote Videos */}
              {Object.entries(remoteStreams).map(([peerId, stream]) => (
                <div key={peerId} className="relative border border-gray-700 rounded-lg overflow-hidden">
                  <video
                    autoPlay
                    playsInline
                    ref={(ref) => ref && (ref.srcObject = stream)}
                    className="w-full h-44 bg-black"
                  />
                  <div className="absolute bottom-1 left-2 text-xs bg-black/50 px-2 rounded">
                    {peerId.slice(0, 6)}...
                  </div>
                </div>
              ))}
            </div>

            {/* Controls */}
            <div className="flex justify-center gap-4 mt-auto">
              <button
                onClick={toggleMic}
                className={`p-3 rounded-full border ${
                  muted ? "bg-red-600 border-red-700" : "bg-gray-700 border-gray-600"
                }`}
              >
                {muted ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
              <button
                onClick={toggleCam}
                className={`p-3 rounded-full border ${
                  camOff ? "bg-red-600 border-red-700" : "bg-gray-700 border-gray-600"
                }`}
              >
                {camOff ? <VideoOff size={18} /> : <Video size={18} />}
              </button>
              <button
                onClick={leaveMeeting}
                className="p-3 rounded-full border bg-red-700 border-red-800 hover:bg-red-800 text-white"
              >
                Leave
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
