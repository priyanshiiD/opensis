const mongoose = require('mongoose');

const noticeAudienceTargetSchema = new mongoose.Schema({
  assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'FacultyTeachingAssignment' },
  itemType: { type: String, enum: ['class', 'lab'], default: 'class' },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
  labId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lab' },
  subjectCode: { type: String, trim: true },
  subjectName: { type: String, trim: true },
  session: { type: String, trim: true },
  term: { type: String, enum: ['july-december', 'january-june'] },
  semester: { type: Number, min: 1, max: 8 },
  branch: { type: String, trim: true },
  section: { type: String, trim: true, default: '' },
  sectionLabel: { type: String, trim: true, default: 'All sections' },
}, { _id: false });

const noticeSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  body: { type: String, required: true },
  audience: { type: String, enum: ['all', 'students', 'faculty'], default: 'all' },
  // Missing authorRole on legacy notices is interpreted as 'admin'.
  authorRole: { type: String, enum: ['admin', 'faculty'], default: 'admin' },
  category: { type: String, trim: true },
  eventDate: { type: Date },
  session: { type: String, trim: true },
  term: { type: String, enum: ['july-december', 'january-june'] },
  targetStudentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
  // Faculty notices persist an audience snapshot so later assignment changes
  // cannot silently widen an already-published notice.
  audienceTargets: { type: [noticeAudienceTargetSchema], default: undefined },
  audienceSummary: { type: String, trim: true },
  audienceMode: { type: String, enum: ['all-my-classes', 'selected'] },
  postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  postedByFaculty: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty' },
  attachments: [String],
  isPinned: { type: Boolean, default: false },
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

module.exports = mongoose.model('Notice', noticeSchema);
