const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  facultyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty', required: true },
  date: { type: Date, required: true },
  semester: Number,
  branch: String,
  section: String,
  records: [{
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    status: { type: String, enum: ['present', 'absent'], required: true },
  }],
}, { timestamps: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
