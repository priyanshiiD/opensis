const mongoose = require('mongoose');

const resultUploadBatchSchema = new mongoose.Schema({
  facultyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty', required: true, index: true },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
  semester: { type: Number, required: true, index: true },
  department: { type: String, required: true, trim: true, index: true },
  section: { type: String, required: true, trim: true, index: true },
  session: { type: String, required: true, trim: true, index: true },
  fileName: String,
  totalRows: { type: Number, default: 0 },
  validRows: { type: Number, default: 0 },
  invalidRows: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'locked', 'published'],
    default: 'pending',
    index: true,
  },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  reviewedAt: Date,
  reviewRemark: String,
}, { timestamps: true });

module.exports = mongoose.model('ResultUploadBatch', resultUploadBatchSchema);
