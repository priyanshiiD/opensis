const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  facultyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty', required: true },
  session: String,
  semester: Number,
  ratings: {
    teaching: { type: Number, min: 1, max: 5 },
    content: { type: Number, min: 1, max: 5 },
    interaction: { type: Number, min: 1, max: 5 },
  },
  comments: String,
  submittedAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('Feedback', feedbackSchema);
