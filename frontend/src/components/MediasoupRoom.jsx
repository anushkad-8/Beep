// frontend/src/components/MediasoupRoom.jsx
import React, { useEffect, useRef, useState } from "react";
import * as mediasoupClient from "mediasoup-client";
import API from "../api/api";

export default function MediasoupRoom({ socket, me, roomId, visible = true }) {
  const localVideoRef = useRef(null);
  const [device, setDevice] = useState(null);
  const [sendTransport, setSendTransport] = useState(null);
  const [recvTransport, setRecvTransport] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    if (!socket) return;

    socket.on("room:peer-joined", async () => await fetchProducers());
    socket.on("room:peer-left", async () => await fetchProducers());
    return () => {
      socket.off("room:peer-joined");
      socket.off("room:peer-left");
    };
  }, [socket]);

  async function fetchProducers() {
    const res = await API.get(`/mediasoup/rooms/${roomId}/producers`);
    const producers = res.data || [];
    producers.forEach((p) => consumeTrack(p));
  }

  async function join() {
    if (!socket) return alert("Socket not connected");

    // 1️⃣ Create Mediasoup device
    const rtp = (await API.get(`/mediasoup/rooms/${roomId}/rtpCapabilities`)).data.rtpCapabilities;
    const device = new mediasoupClient.Device();
    await device.load({ routerRtpCapabilities: rtp });
    setDevice(device);

    // 2️⃣ Create Send Transport
    const sendParams = (await API.post(`/mediasoup/rooms/${roomId}/create-transport`)).data;
    const sendT = device.createSendTransport(sendParams);

    sendT.on("connect", async ({ dtlsParameters }, callback, errback) => {
      try {
        await API.post(`/mediasoup/rooms/${roomId}/transport-connect`, {
          transportId: sendT.id,
          dtlsParameters,
          peerId: socket.id,
        });
        callback();
      } catch (err) {
        errback(err);
      }
    });

    sendT.on("produce", async ({ kind, rtpParameters }, callback, errback) => {
      try {
        const { data } = await API.post(`/mediasoup/rooms/${roomId}/produce`, {
          transportId: sendT.id,
          kind,
          rtpParameters,
          peerId: socket.id,
        });
        callback({ id: data.id });
      } catch (err) {
        errback(err);
      }
    });

    setSendTransport(sendT);

    // 3️⃣ Create Recv Transport
    const recvParams = (await API.post(`/mediasoup/rooms/${roomId}/create-transport`)).data;
    const recvT = device.createRecvTransport(recvParams);
    recvT.on("connect", async ({ dtlsParameters }, callback, errback) => {
      try {
        await API.post(`/mediasoup/rooms/${roomId}/transport-connect`, {
          transportId: recvT.id,
          dtlsParameters,
          peerId: socket.id,
        });
        callback();
      } catch (err) {
        errback(err);
      }
    });
    setRecvTransport(recvT);

    // 4️⃣ Capture local media
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideoRef.current.srcObject = stream;
    for (const track of stream.getTracks()) await sendT.produce({ track });

    // 5️⃣ Join socket room
    socket.emit("join_room", { roomId });
    await fetchProducers();
    setJoined(true);
  }

  async function consumeTrack(p) {
    if (!device || !recvTransport) return;
    if (p.peerId === socket.id) return;

    try {
      const { data } = await API.get(
        `/mediasoup/rooms/${roomId}/producer/${p.id}/rtpParameters`
      );
      const consumer = await recvTransport.consume({
        id: p.id,
        producerId: p.id,
        kind: data.kind,
        rtpParameters: data.rtpParameters || {},
      });

      const stream = new MediaStream([consumer.track]);
      setRemoteStreams((prev) => ({ ...prev, [p.peerId]: stream }));
    } catch (e) {
      console.error("Error consuming track", e);
    }
  }

  return (
    visible && (
      <div className="mt-4 bg-[#0f1729] p-4 rounded-2xl border border-gray-800 shadow-lg">
        <h3 className="text-violet-300 font-semibold mb-3">Video Meeting Room</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {/* Local video */}
          <div className="relative border border-gray-700 rounded-lg overflow-hidden">
            <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-40 bg-black" />
            <div className="absolute bottom-1 left-1 text-xs bg-black/50 px-2 rounded">
              You
            </div>
          </div>

          {/* Remote videos */}
          {Object.entries(remoteStreams).map(([peerId, stream]) => (
            <div key={peerId} className="relative border border-gray-700 rounded-lg overflow-hidden">
              <video
                autoPlay
                playsInline
                className="w-full h-40 bg-black"
                ref={(ref) => ref && (ref.srcObject = stream)}
              />
              <div className="absolute bottom-1 left-1 text-xs bg-black/50 px-2 rounded">
                {peerId.slice(0, 6)}...
              </div>
            </div>
          ))}
        </div>

        {!joined && (
          <button
            onClick={join}
            className="mt-4 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg"
          >
            🎥 Join Meeting
          </button>
        )}
      </div>
    )
  );
}
