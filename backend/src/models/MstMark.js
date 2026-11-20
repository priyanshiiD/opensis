const mongoose = require('mongoose');

const mstStudentMarkSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  enrollmentNo: { type: String, required: true, trim: true },
  studentName: { type: String, trim: true },
  marks: { type: Number, required: true, min: 0, max: 20 },
}, { _id: false });

const mstMarkSchema = new mongoose.Schema({
  facultyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty', required: true },
  assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'FacultyTeachingAssignment', required: true },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  assessment: { type: String, enum: ['mst1', 'mst2'], required: true },
  session: { type: String, required: true, trim: true },
  term: { type: String, enum: ['july-december', 'january-june'], required: true },
  semester: { type: Number, required: true, min: 1, max: 8 },
  branch: { type: String, required: true, trim: true, uppercase: true },
  section: { type: String, trim: true, uppercase: true, default: '' },
  sectionLabel: { type: String, trim: true, default: 'All sections' },
  maxMarks: { type: Number, default: 20 },
  marks: { type: [mstStudentMarkSchema], default: [] },
  status: { type: String, enum: ['draft', 'published'], default: 'draft' },
  fileName: { type: String, trim: true },
  uploadedAt: { type: Date, default: Date.now },
  publishedAt: { type: Date },
}, { timestamps: true });

mstMarkSchema.index(
  { facultyId: 1, subjectId: 1, session: 1, term: 1, semester: 1, section: 1, assessment: 1 },
  { unique: true, name: 'faculty_mst_unique' },
);
mstMarkSchema.index({ status: 1, session: 1, term: 1, branch: 1, semester: 1, section: 1 });

module.exports = mongoose.model('MstMark', mstMarkSchema);
