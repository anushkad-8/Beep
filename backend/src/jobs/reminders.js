const cron = require('node-cron');

const jobs = new Map();

function scheduleMeetingReminder(meeting) {
  const reminderTime = new Date(new Date(meeting.startTime).getTime() - 5 * 60 * 1000);
  const now = new Date();
  if (reminderTime <= now) return;

  const mins = reminderTime.getUTCMinutes();
  const hours = reminderTime.getUTCHours();
  const day = reminderTime.getUTCDate();
  const month = reminderTime.getUTCMonth() + 1;
  const cronExpr = `${mins} ${hours} ${day} ${month} *`;

  const task = cron.schedule(cronExpr, async () => {
    console.log('Reminder fired for meeting', meeting._id);
    // TODO: send socket notification, email, push
    task.stop();
    jobs.delete(meeting._id.toString());
  }, { scheduled: true, timezone: 'UTC' });

  jobs.set(meeting._id.toString(), task);
}

module.exports = { scheduleMeetingReminder };
