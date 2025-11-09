const express = require("express");
const router = express.Router();
const { createRoom, getRoom } = require("./mediasoupServer");

// ==============================
// 🛰 Get RTP Capabilities
// ==============================
router.get("/rooms/:roomId/rtpCapabilities", async (req, res) => {
  const { roomId } = req.params;
  const room = await createRoom(roomId);
  res.json({ rtpCapabilities: room.router.rtpCapabilities });
});

// ==============================
// 🚀 Create WebRTC Transport
// ==============================
router.post("/rooms/:roomId/create-transport", async (req, res) => {
  const { roomId } = req.params;
  const room = await createRoom(roomId);

  const transport = await room.router.createWebRtcTransport({
    listenIps: [{ ip: "0.0.0.0", announcedIp: null }],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
  });

  room.transports.set(transport.id, transport);

  res.json({
    id: transport.id,
    iceParameters: transport.iceParameters,
    iceCandidates: transport.iceCandidates,
    dtlsParameters: transport.dtlsParameters,
  });
});

// ==============================
// 🔗 Connect WebRTC Transport
// ==============================
router.post("/rooms/:roomId/transport-connect", async (req, res) => {
  const { roomId } = req.params;
  const { transportId, dtlsParameters, peerId } = req.body;

  const room = getRoom(roomId);
  if (!room) return res.status(404).json({ error: "room not found" });

  const transport = room.transports.get(transportId);
  if (!transport) return res.status(404).json({ error: "transport not found" });

  await transport.connect({ dtlsParameters });

  if (!room.peers) room.peers = new Map();
  const peer = room.peers.get(peerId) || {
    transports: new Set(),
    producers: new Set(),
    consumers: new Set(),
  };
  peer.transports.add(transportId);
  room.peers.set(peerId, peer);

  res.json({ ok: true });
});

// ==============================
// 🎙 Produce Media (Audio/Video)
// ==============================
router.post("/rooms/:roomId/produce", async (req, res) => {
  const { roomId } = req.params;
  const { transportId, kind, rtpParameters, peerId } = req.body;

  const room = getRoom(roomId);
  if (!room) return res.status(404).json({ error: "room not found" });

  const transport = room.transports.get(transportId);
  if (!transport) return res.status(404).json({ error: "transport not found" });

  const producer = await transport.produce({
    kind,
    rtpParameters,
    appData: { peerId },
  });

  if (!room.producers) room.producers = new Map();
  room.producers.set(producer.id, { producer, peerId });

  if (!room.peers) room.peers = new Map();
  const peer = room.peers.get(peerId) || {
    transports: new Set(),
    producers: new Set(),
    consumers: new Set(),
  };
  peer.producers.add(producer.id);
  room.peers.set(peerId, peer);

  console.log(`🎥 Producer created by ${peerId}: ${producer.id}`);

  res.json({ id: producer.id });
});

// ==============================
// 📡 Get All Producers in a Room
// ==============================
router.get("/rooms/:roomId/producers", async (req, res) => {
  const { roomId } = req.params;
  const room = getRoom(roomId);
  if (!room) return res.status(404).json({ error: "room not found" });

  const list = [];
  for (const [id, item] of room.producers.entries()) {
    list.push({
      id,
      peerId: item.peerId,
      kind: item.producer.kind,
      appData: item.producer.appData,
    });
  }
  res.json(list);
});

// ==============================
// 🧠 Consume: Allow peer to receive other’s stream
// ==============================
// ==============================
// 🧠 Consume: Allow peer to receive other’s stream
// ==============================
router.post("/rooms/:roomId/consume", async (req, res) => {
  const { roomId } = req.params;
  const { transportId, producerId, rtpCapabilities, peerId } = req.body;

  const room = getRoom(roomId);
  if (!room) return res.status(404).json({ error: "room not found" });

  const transport = room.transports?.get(transportId);
  if (!transport) return res.status(404).json({ error: "transport not found" });

  if (!room.router.canConsume({ producerId, rtpCapabilities })) {
    console.warn("⚠️ Cannot consume producer:", producerId);
    return res.status(400).json({ error: "Cannot consume this producer" });
  }

  try {
    const consumer = await transport.consume({
      producerId,
      rtpCapabilities,
      paused: true,
    });

    if (!consumer) {
      console.error("❌ Consumer creation returned null");
      return res.status(500).json({ error: "Consumer creation failed" });
    }

    if (!room.peers) room.peers = new Map();
    if (!room.consumers) room.consumers = new Map();

    let peer = room.peers.get(peerId);
    if (!peer) {
      peer = { transports: new Set(), producers: new Set(), consumers: new Set() };
      room.peers.set(peerId, peer);
    }

    peer.consumers.add(consumer.id);
    room.consumers.set(consumer.id, consumer);

    await consumer.resume();

    console.log(`🎧 Consumer created for peer ${peerId}: ${consumer.id}`);

    return res.status(200).json({
      id: consumer.id,
      producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
    });
  } catch (err) {
    console.error("❌ Error creating consumer:", err);
    return res.status(500).json({ error: err.message });
  }
});


module.exports = router;
