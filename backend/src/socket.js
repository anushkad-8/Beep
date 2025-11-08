const jwtUtils = require('./utils/jwt');
const Message = require('./models/Message');

function initSocket(io) {
  const userSockets = new Map();
  const socketUser = new Map();

  io.use((socket, next) => {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    if (!token) return next(new Error('no auth'));
    try {
      const payload = jwtUtils.verify(token);
      socket.user = payload;
      next();
    } catch (err) {
      next(new Error('auth error'));
    }
  });

  io.on('connection', socket => {
    const userId = socket.user.id;
    socketUser.set(socket.id, userId);

    if (!userSockets.has(userId)) userSockets.set(userId, new Set());
    userSockets.get(userId).add(socket.id);

    socket.on('join_team', ({ team }) => {
      socket.join(`team:${team}`);
      io.to(`team:${team}`).emit('presence:update', { userId, status: 'online' });
    });

    socket.on('join_room', ({ roomId }) => {
      socket.join(`room:${roomId}`);
      io.to(`room:${roomId}`).emit('room:peer-joined', { peerId: socket.id, userId });
    });

    socket.on('leave_room', ({ roomId }) => {
      socket.leave(`room:${roomId}`);
      io.to(`room:${roomId}`).emit('room:peer-left', { peerId: socket.id, userId });
    });

    socket.on('message:send', async (payload) => {
      const { channel, content, attachments } = payload;
      const msg = new Message({ team: payload.team, channel, sender: userId, content, attachments });
      await msg.save();
      const populated = await msg.populate('sender', 'name email avatarUrl');
      io.to(`channel:${channel}`).emit('message:receive', populated);
    });

    socket.on('webrtc:offer', ({ to, offer }) => {
      const sockets = userSockets.get(to) || new Set();
      sockets.forEach(sid => io.to(sid).emit('webrtc:offer', { from: userId, offer }));
    });

    socket.on('webrtc:answer', ({ to, answer }) => {
      const sockets = userSockets.get(to) || new Set();
      sockets.forEach(sid => io.to(sid).emit('webrtc:answer', { from: userId, answer }));
    });

    socket.on('webrtc:ice', ({ to, candidate }) => {
      const sockets = userSockets.get(to) || new Set();
      sockets.forEach(sid => io.to(sid).emit('webrtc:ice', { from: userId, candidate }));
    });

    socket.on('disconnect', () => {
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
    });
  });
}

module.exports = initSocket;
