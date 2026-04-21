const mongoose = require('mongoose');

const libraryBookSchema = new mongoose.Schema({
  bookId: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  author: String,
  isbn: String,
  copiesTotal: { type: Number, default: 1 },
  copiesAvailable: { type: Number, default: 1 },
}, { timestamps: true });

module.exports = mongoose.model('LibraryBook', libraryBookSchema);
