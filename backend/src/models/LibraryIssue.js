const mongoose = require('mongoose');

const libraryIssueSchema = new mongoose.Schema({
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'LibraryBook', required: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  issuedOn: { type: Date, default: Date.now },
  dueOn: Date,
  returnedOn: Date,
  fine: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('LibraryIssue', libraryIssueSchema);
