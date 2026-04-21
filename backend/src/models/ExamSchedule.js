const mongoose = require('mongoose');

const examScheduleSchema = new mongoose.Schema({
  session: { type: String, required: true },
  semester: { type: Number, required: true },
  branch: { type: String, required: true },
  examType: { type: String, enum: ['mid', 'end'], required: true },
  entries: [{
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
    date: Date,
    startTime: String,
    endTime: String,
    venue: String,
  }],
}, { timestamps: true });

module.exports = mongoose.model('ExamSchedule', examScheduleSchema);
