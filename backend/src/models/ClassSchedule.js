const mongoose = require('mongoose');

const classScheduleSchema = new mongoose.Schema({
  session: String,
  semester: Number,
  branch: String,
  section: String,
  timetable: [{
    day: { type: String, enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] },
    slot: String,
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
    facultyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty' },
    room: String,
  }],
}, { timestamps: true });

module.exports = mongoose.model('ClassSchedule', classScheduleSchema);
