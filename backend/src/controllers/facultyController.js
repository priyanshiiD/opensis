const Faculty = require('../models/Faculty');
const Subject = require('../models/Subject');
const Attendance = require('../models/Attendance');
const Assignment = require('../models/Assignment');
const Notice = require('../models/Notice');
const ClassSchedule = require('../models/ClassSchedule');
const Result = require('../models/Result');
const Student = require('../models/Student');

exports.getProfile = async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ userId: req.user._id }).populate('subjectsTaught', 'code name branch semester').lean();
    if (!faculty) return res.status(404).json({ success: false, message: 'Profile not found' });
    res.json({ success: true, data: { faculty } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const allowed = ['phone', 'address', 'profilePhotoUrl', 'designation', 'qualification'];
    const update = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k]; });
    const faculty = await Faculty.findOneAndUpdate({ userId: req.user._id }, update, { new: true });
    res.json({ success: true, data: { faculty } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getSubjects = async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ userId: req.user._id });
    const subjects = await Subject.find({ facultyId: faculty._id }).lean();
    res.json({ success: true, data: { subjects } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.markAttendance = async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ userId: req.user._id });
    const { subjectId, date, semester, branch, section, records } = req.body;
    const attendance = await Attendance.create({ subjectId, facultyId: faculty._id, date, semester, branch, section, records });
    res.status(201).json({ success: true, data: { attendance } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAttendance = async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ userId: req.user._id });
    const filter = { facultyId: faculty._id };
    if (req.query.subjectId) filter.subjectId = req.query.subjectId;
    const records = await Attendance.find(filter)
      .populate('subjectId', 'code name')
      .sort({ date: -1 })
      .lean();
    res.json({ success: true, data: { records } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createAssignment = async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ userId: req.user._id });
    const fileUrl = req.file ? `/uploads/${req.file.filename}` : req.body.fileUrl;
    const assignment = await Assignment.create({ ...req.body, facultyId: faculty._id, fileUrl });
    res.status(201).json({ success: true, data: { assignment } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAssignments = async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ userId: req.user._id });
    const assignments = await Assignment.find({ facultyId: faculty._id })
      .populate('subjectId', 'code name')
      .lean();
    res.json({ success: true, data: { assignments } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getSubmissions = async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id)
      .populate('submissions.studentId', 'firstName lastName enrollmentNo')
      .lean();
    if (!assignment) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: { submissions: assignment.submissions } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.gradeSubmission = async (req, res) => {
  try {
    const { marks, feedback } = req.body;
    const assignment = await Assignment.findOne({ 'submissions._id': req.params.id });
    if (!assignment) return res.status(404).json({ success: false, message: 'Submission not found' });
    const sub = assignment.submissions.id(req.params.id);
    sub.marks = marks;
    sub.feedback = feedback;
    await assignment.save();
    res.json({ success: true, message: 'Graded' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateMarks = async (req, res) => {
  try {
    const { semester, session, entries } = req.body;
    for (const entry of entries) {
      const { studentId, subjectId, internalMarks, externalMarks } = entry;
      const totalMarks = (internalMarks || 0) + (externalMarks || 0);
      const grade = totalMarks >= 90 ? 'O' : totalMarks >= 75 ? 'A+' : totalMarks >= 60 ? 'A' : totalMarks >= 50 ? 'B+' : totalMarks >= 40 ? 'B' : 'F';

      let result = await Result.findOne({ studentId, semester, session });
      if (!result) result = new Result({ studentId, semester, session, subjectMarks: [] });

      const existing = result.subjectMarks.findIndex(s => s.subjectId?.toString() === subjectId);
      const markEntry = { subjectId, internalMarks, externalMarks, totalMarks, grade };
      if (existing >= 0) result.subjectMarks[existing] = markEntry;
      else result.subjectMarks.push(markEntry);

      const allMarks = result.subjectMarks.map(s => s.totalMarks || 0);
      result.sgpa = allMarks.length ? (allMarks.reduce((a, b) => a + b, 0) / allMarks.length / 10).toFixed(2) : 0;
      result.status = result.subjectMarks.some(s => (s.totalMarks || 0) < 40) ? 'fail' : 'pass';
      await result.save();
    }
    res.json({ success: true, message: 'Marks updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getMarks = async (req, res) => {
  try {
    const { semester, session, subjectId } = req.query;
    const filter = {};
    if (semester) filter.semester = Number(semester);
    if (session) filter.session = session;
    const results = await Result.find(filter)
      .populate('studentId', 'firstName lastName enrollmentNo')
      .populate('subjectMarks.subjectId', 'code name')
      .lean();
    res.json({ success: true, data: { results } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getNotices = async (req, res) => {
  try {
    const notices = await Notice.find({ audience: { $in: ['all', 'faculty'] } })
      .sort({ isPinned: -1, createdAt: -1 })
      .lean();
    res.json({ success: true, data: { notices } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getClassSchedule = async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ userId: req.user._id });
    const schedules = await ClassSchedule.find({ 'timetable.facultyId': faculty._id })
      .populate('timetable.subjectId', 'code name')
      .populate('timetable.facultyId', 'firstName lastName')
      .lean();
    res.json({ success: true, data: { schedules } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
