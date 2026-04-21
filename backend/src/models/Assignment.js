const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: String,
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  facultyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty', required: true },
  fileUrl: String,
  dueDate: Date,
  maxMarks: { type: Number, default: 100 },
  submissions: [{
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    fileUrl: String,
    submittedAt: Date,
    marks: Number,
    feedback: String,
  }],
}, { timestamps: true });

module.exports = mongoose.model('Assignment', assignmentSchema);
