const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  semester: { type: Number, required: true },
  session: String,
  subjectMarks: [{
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
    internalMarks: Number,
    externalMarks: Number,
    totalMarks: Number,
    grade: String,
  }],
  sgpa: Number,
  status: { type: String, enum: ['pass', 'fail'], default: 'pass' },
}, { timestamps: true });

module.exports = mongoose.model('Result', resultSchema);
