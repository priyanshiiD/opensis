const mongoose = require('mongoose');

const feeSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  session: String,
  semester: Number,
  amount: { type: Number, required: true },
  dueDate: Date,
  status: { type: String, enum: ['pending', 'paid'], default: 'pending' },
  paidOn: Date,
  transactionId: String,
  receiptNo: String,
}, { timestamps: true });

module.exports = mongoose.model('Fee', feeSchema);
