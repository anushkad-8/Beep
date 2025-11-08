// backend/src/jobs/reminderScheduler.js
const Meeting = require('../models/Meeting');

const scheduledJobs = new Map(); // meetingId -> timeout

/**
 * Schedule a 5-minute-before reminder for the meeting.
 * meeting: mongoose doc or plain object with at least {_id, date, title, description, invitedUsers, createdBy}
 * io: socket.io server instance
 */
function scheduleReminder(meeting, io) {
  try {
    const meetingId = String(meeting._id);
    // clear existing
    if (scheduledJobs.has(meetingId)) {
      clearTimeout(scheduledJobs.get(meetingId));
      scheduledJobs.delete(meetingId);
    }

    const meetingDate = new Date(meeting.date);
    const reminderTime = new Date(meetingDate.getTime() - 5 * 60 * 1000);
    const now = new Date();

    // If reminder time already passed, skip scheduling (or optionally fire immediately)
    if (reminderTime <= now) {
      // Do not schedule; optionally you can emit immediate reminder if within meeting time:
      // if (meetingDate > now) emitReminder(); else skip
      if (meetingDate > now) {
        // emit immediate reminder (because it's within 5 minutes)
        emitReminder(meeting, io);
      }
      return;
    }

    const delay = reminderTime.getTime() - now.getTime();

    const t = setTimeout(() => {
      emitReminder(meeting, io);
      scheduledJobs.delete(meetingId);
    }, delay);

    scheduledJobs.set(meetingId, t);
    console.log(`Scheduled reminder for meeting ${meetingId} at ${reminderTime.toISOString()}`);
  } catch (err) {
    console.error('scheduleReminder error', err);
  }
}

/**
 * Emit reminder to all invited users (via socket.io).
 */
function emitReminder(meeting, io) {
  try {
    const payload = {
      meetingId: String(meeting._id),
      title: meeting.title,
      description: meeting.description,
      date: meeting.date,
      duration: meeting.duration,
      createdBy: meeting.createdBy,
    };

    // invitedUsers may be array of ids or user docs
    const invited = (meeting.invitedUsers || []).map(u => (typeof u === 'string' ? u : (u._id || u.id)));

    invited.forEach(uid => {
      try {
        io.to(String(uid)).emit('meeting:reminder', payload);
      } catch (e) {
        console.warn('emitReminder error for uid', uid, e);
      }
    });

    // Optionally also notify the meeting creator
    if (meeting.createdBy) {
      try { io.to(String(meeting.createdBy)).emit('meeting:reminder', payload); } catch (e) {}
    }

    console.log(`Emitted reminder for meeting ${meeting._id} to ${invited.length} users`);
  } catch (err) {
    console.error('emitReminder error', err);
  }
}

/**
 * Load upcoming meetings from DB and schedule reminders.
 * Finds meetings whose date is in the future and sets timers.
 */
async function loadUpcomingMeetings(io) {
  try {
    const now = new Date();
    // load meetings whose date is still ahead
    const meetings = await Meeting.find({ date: { $gte: now } }).lean().exec();
    meetings.forEach(m => scheduleReminder(m, io));
    console.log(`Loaded and scheduled ${meetings.length} upcoming meeting reminders`);
  } catch (err) {
    console.error('loadUpcomingMeetings error', err);
  }
}

/**
 * Cancel scheduled reminder (call when meeting is cancelled/edited)
 */
function cancelReminder(meetingId) {
  const id = String(meetingId);
  if (scheduledJobs.has(id)) {
    clearTimeout(scheduledJobs.get(id));
    scheduledJobs.delete(id);
    console.log(`Cancelled reminder for meeting ${id}`);
  }
}

module.exports = { scheduleReminder, loadUpcomingMeetings, cancelReminder };
