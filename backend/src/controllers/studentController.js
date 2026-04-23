const { v4: uuidv4 } = require('uuid');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const Assignment = require('../models/Assignment');
const Notice = require('../models/Notice');
const ExamSchedule = require('../models/ExamSchedule');
const ClassSchedule = require('../models/ClassSchedule');
const Result = require('../models/Result');
const Fee = require('../models/Fee');
const LibraryIssue = require('../models/LibraryIssue');
const LibraryBook = require('../models/LibraryBook');
const Feedback = require('../models/Feedback');
const RevaluationRequest = require('../models/RevaluationRequest');

exports.getProfile = async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user._id }).lean();
    if (!student) return res.status(404).json({ success: false, message: 'Profile not found' });
    res.json({ success: true, data: { student } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const allowed = ['phone', 'address', 'profilePhotoUrl'];
    const update = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k]; });
    const student = await Student.findOneAndUpdate({ userId: req.user._id }, update, { new: true });
    res.json({ success: true, data: { student } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAttendance = async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user._id });
    const records = await Attendance.find({ 'records.studentId': student._id })
      .populate('subjectId', 'code name')
      .lean();

    const grouped = {};
    for (const att of records) {
      const subId = att.subjectId?._id?.toString();
      if (!subId) continue;
      if (!grouped[subId]) {
        grouped[subId] = { subject: att.subjectId, total: 0, present: 0, dates: [] };
      }
      const record = att.records.find(r => r.studentId?.toString() === student._id.toString());
      if (record) {
        grouped[subId].total++;
        if (record.status === 'present') grouped[subId].present++;
        grouped[subId].dates.push({ date: att.date, status: record.status });
      }
    }

    res.json({ success: true, data: { attendance: Object.values(grouped) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAssignments = async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user._id });
    const assignments = await Assignment.find()
      .populate('subjectId', 'code name branch semester')
      .populate('facultyId', 'firstName lastName')
      .lean();

    const relevant = assignments
      .filter(a => a.subjectId?.branch === student.branch && a.subjectId?.semester === student.currentSemester)
      .map(a => {
        const sub = a.submissions?.find(s => s.studentId?.toString() === student._id.toString());
        return { ...a, mySubmission: sub || null, submissions: undefined };
      });

    res.json({ success: true, data: { assignments: relevant } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.submitAssignment = async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user._id });
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });

    const existing = assignment.submissions.findIndex(s => s.studentId?.toString() === student._id.toString());
    const fileUrl = req.file ? `/uploads/${req.file.filename}` : req.body.fileUrl;

    if (existing >= 0) {
      assignment.submissions[existing].fileUrl = fileUrl;
      assignment.submissions[existing].submittedAt = new Date();
    } else {
      assignment.submissions.push({ studentId: student._id, fileUrl, submittedAt: new Date() });
    }
    await assignment.save();
    res.json({ success: true, message: 'Submitted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getNotices = async (req, res) => {
  try {
    const notices = await Notice.find({ audience: { $in: ['all', 'students'] } })
      .sort({ isPinned: -1, createdAt: -1 })
      .lean();
    res.json({ success: true, data: { notices } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getExamSchedule = async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user._id });
    const schedules = await ExamSchedule.find({ branch: student.branch, semester: student.currentSemester })
      .populate('entries.subjectId', 'code name')
      .lean();
    res.json({ success: true, data: { schedules } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getResult = async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user._id });
    const requestedSemester = Number(req.query.semester);
    const query = { studentId: student._id };

    if (Number.isInteger(requestedSemester) && requestedSemester > 0) {
      query.semester = requestedSemester;
    } else {
      query.semester = student.currentSemester;
    }

    const results = await Result.find(query)
      .populate('subjectMarks.subjectId', 'code name')
      .sort({ semester: -1, createdAt: -1 })
      .lean();
    res.json({ success: true, data: { results } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.submitRevaluation = async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user._id });
    const reval = await RevaluationRequest.create({ studentId: student._id, ...req.body });
    res.status(201).json({ success: true, data: { reval } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getFees = async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user._id });
    const fees = await Fee.find({ studentId: student._id }).lean();
    res.json({ success: true, data: { fees } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.payFee = async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user._id });
    const fee = await Fee.findOne({ _id: req.params.id, studentId: student._id });
    if (!fee) return res.status(404).json({ success: false, message: 'Fee record not found' });
    if (fee.status === 'paid') return res.status(400).json({ success: false, message: 'Already paid' });

    fee.status = 'paid';
    fee.paidOn = new Date();
    fee.transactionId = `TXN-${uuidv4().slice(0, 8).toUpperCase()}`;
    fee.receiptNo = `RCP-${Date.now()}`;
    await fee.save();
    res.json({ success: true, data: { fee } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getLibrary = async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user._id });
    const issues = await LibraryIssue.find({ studentId: student._id })
      .populate('bookId')
      .lean();
    res.json({ success: true, data: { issues } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getClassSchedule = async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user._id });
    const schedule = await ClassSchedule.findOne({ branch: student.branch, semester: student.currentSemester, section: student.section })
      .populate('timetable.subjectId', 'code name')
      .populate('timetable.facultyId', 'firstName lastName')
      .lean();
    res.json({ success: true, data: { schedule } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.submitFeedback = async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user._id });
    const feedback = await Feedback.create({ studentId: student._id, ...req.body });
    res.status(201).json({ success: true, data: { feedback } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getMyFeedback = async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user._id });
    const feedback = await Feedback.find({ studentId: student._id })
      .populate('subjectId', 'code name')
      .populate('facultyId', 'firstName lastName')
      .lean();
    res.json({ success: true, data: { feedback } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAdmitCard = async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user._id }).lean();
    if (!student) return res.status(404).json({ success: false, message: 'Profile not found' });

    const schedules = await ExamSchedule.find({ branch: student.branch, semester: student.currentSemester })
      .populate('entries.subjectId', 'code name')
      .lean();

    if (schedules.length === 0) return res.status(404).json({ success: false, message: 'No exam schedule found' });

    const admitCard = {
      student: {
        name: `${student.firstName} ${student.lastName}`,
        enrollmentNo: student.enrollmentNo,
        branch: student.branch,
        semester: student.currentSemester,
        section: student.section,
        session: student.session,
        fatherName: student.fatherName,
        profilePhotoUrl: student.profilePhotoUrl,
      },
      examSchedule: schedules[0],
      issuedOn: new Date().toISOString(),
      collegeName: 'College ERP Institution',
    };

    res.json({ success: true, data: { admitCard } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getFeeReceipt = async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user._id }).lean();
    if (!student) return res.status(404).json({ success: false, message: 'Profile not found' });

    const fee = await Fee.findOne({ _id: req.params.id, studentId: student._id }).lean();
    if (!fee) return res.status(404).json({ success: false, message: 'Fee record not found' });
    if (fee.status !== 'paid') return res.status(400).json({ success: false, message: 'Fee not paid yet' });

    const receipt = {
      receiptNo: fee.receiptNo,
      transactionId: fee.transactionId,
      student: {
        name: `${student.firstName} ${student.lastName}`,
        enrollmentNo: student.enrollmentNo,
        branch: student.branch,
        semester: fee.semester,
        session: fee.session,
      },
      amount: fee.amount,
      paidOn: fee.paidOn,
      collegeName: 'College ERP Institution',
    };

    res.json({ success: true, data: { receipt } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
