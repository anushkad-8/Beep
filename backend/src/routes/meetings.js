// backend/src/routes/meetings.js
const express = require('express');
const router = express.Router();
const Meeting = require('../models/Meeting');
const User = require('../models/User');
const { scheduleReminder, cancelReminder } = require('../jobs/reminderScheduler');

/**
 * POST /api/meetings
 * body: { title, description, date, duration, invitedUsers (array of userIds), team, createdBy }
 */
router.post('/', async (req, res) => {
  try {
    const { title, description, date, duration, invitedUsers = [], team, createdBy } = req.body;

    if (!title || !date || !duration || !createdBy) {
      return res.status(400).json({ error: 'title, date, duration and createdBy are required' });
    }

    const meeting = new Meeting({
      title,
      description,
      date: new Date(date),
      duration: Number(duration),
      invitedUsers,
      team: team || 'default',
      createdBy
    });

    await meeting.save();

    // Get io from app so we can emit to invited users
    const io = req.app.get('io');
    const payload = {
      meetingId: String(meeting._id),
      title: meeting.title,
      description: meeting.description,
      date: meeting.date,
      duration: meeting.duration,
      team: meeting.team,
      createdBy: meeting.createdBy
    };

    // Emit immediate scheduled notification to invited users
    (invitedUsers || []).forEach(uid => {
      try {
        io.to(String(uid)).emit('meeting:scheduled', payload);
      } catch (e) {
        console.warn('emit meeting:scheduled error for user', uid, e);
      }
    });

    // also emit to creator
    try { io.to(String(createdBy)).emit('meeting:scheduled', payload); } catch (e) {}

    // schedule 5-minute reminder
    scheduleReminder(meeting, io);

    res.json(meeting);
  } catch (err) {
    console.error('create meeting error', err);
    res.status(500).json({ error: 'Failed to schedule meeting' });
  }
});

/**
 * GET /api/meetings
 * list all meetings (or add query filters)
 */
router.get('/', async (req, res) => {
  try {
    const meetings = await Meeting.find().populate('invitedUsers', 'name email').sort({ date: 1 }).exec();
    res.json(meetings);
  } catch (err) {
    console.error('fetch meetings error', err);
    res.status(500).json({ error: 'Failed to fetch meetings' });
  }
});

/**
 * PUT /api/meetings/:id/cancel
 * Cancel a meeting and remove scheduled reminder
 */
router.put('/:id/cancel', async (req, res) => {
  try {
    const id = req.params.id;
    const meeting = await Meeting.findByIdAndUpdate(id, { state: 'cancelled' }, { new: true });
    if (!meeting) return res.status(404).json({ error: 'meeting not found' });
    cancelReminder(id);
    const io = req.app.get('io');
    (meeting.invitedUsers || []).forEach(uid => {
      try { io.to(String(uid)).emit('meeting:cancelled', { meetingId: id, title: meeting.title }); } catch(e) {}
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('cancel meeting error', err);
    res.status(500).json({ error: 'Failed to cancel meeting' });
  }
});

module.exports = router;
