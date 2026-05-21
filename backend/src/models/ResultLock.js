const mongoose = require('mongoose');

const resultLockSchema = new mongoose.Schema({
  semester: { type: Number, required: true, index: true },
  department: { type: String, required: true, trim: true, index: true },
  section: { type: String, required: true, trim: true, index: true },
  session: { type: String, required: true, trim: true, index: true },
  isLocked: { type: Boolean, default: true },
  lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  lockedAt: { type: Date, default: Date.now },
}, { timestamps: true });

resultLockSchema.index({ semester: 1, department: 1, section: 1, session: 1 }, { unique: true });

module.exports = mongoose.model('ResultLock', resultLockSchema);
