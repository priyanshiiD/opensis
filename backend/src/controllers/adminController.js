const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const Subject = require('../models/Subject');
const Notice = require('../models/Notice');
const ExamSchedule = require('../models/ExamSchedule');
const ClassSchedule = require('../models/ClassSchedule');
const Fee = require('../models/Fee');
const Admin = require('../models/Admin');

// Students
exports.enrollStudent = async (req, res) => {
  try {
    const { email, password, enrollmentNo, firstName, lastName, department, year, semester, section, admissionYear, session, dob, gender, phone, address, fatherName, motherName } = req.body;

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ success: false, message: 'Email already in use' });

    const passwordHash = await bcrypt.hash(password || 'College@123', 12);
    const user = await User.create({ email, passwordHash, role: 'student' });

    const student = await Student.create({
      userId: user._id, enrollmentNo, firstName, lastName, department, year: Number(year), semester, section, admissionYear, session, dob, gender, phone, address, fatherName, motherName,
    });

    res.status(201).json({ success: true, data: { student } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getStudents = async (req, res) => {
  try {
    const filter = {};
    if (req.query.department) filter.department = req.query.department;
    if (req.query.year) filter.year = Number(req.query.year);
    if (req.query.section) filter.section = req.query.section;
    if (req.query.semester) filter.semester = req.query.semester;
    if (req.query.gender) filter.gender = req.query.gender;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const [students, total] = await Promise.all([
      Student.find(filter).sort({ department: 1, year: 1, section: 1, firstName: 1 }).skip(skip).limit(limit).lean(),
      Student.countDocuments(filter),
    ]);
    res.json({ success: true, data: { students, total, page, pages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id).lean();
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    res.json({ success: true, data: { student } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateStudent = async (req, res) => {
  try {
    const allowed = ['firstName', 'lastName', 'dob', 'gender', 'phone', 'address', 'fatherName', 'motherName', 'department', 'year', 'semester', 'section', 'admissionYear', 'session', 'profilePhotoUrl'];
    const update = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k]; });
    if (update.year) update.year = Number(update.year);
    const student = await Student.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    res.json({ success: true, data: { student } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Faculty
exports.enrollFaculty = async (req, res) => {
  try {
    const { email, password, employeeId, firstName, lastName, department, designation, qualification, joiningDate, phone, address } = req.body;

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ success: false, message: 'Email already in use' });

    const passwordHash = await bcrypt.hash(password || 'Faculty@123', 12);
    const user = await User.create({ email, passwordHash, role: 'faculty' });

    const faculty = await Faculty.create({ userId: user._id, employeeId, firstName, lastName, department, designation, qualification, joiningDate, phone, address });
    res.status(201).json({ success: true, data: { faculty } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getFaculty = async (req, res) => {
  try {
    const faculty = await Faculty.find().populate('subjectsTaught', 'code name').lean();
    res.json({ success: true, data: { faculty } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getFacultyById = async (req, res) => {
  try {
    const faculty = await Faculty.findById(req.params.id).populate('subjectsTaught').lean();
    if (!faculty) return res.status(404).json({ success: false, message: 'Faculty not found' });
    res.json({ success: true, data: { faculty } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateFaculty = async (req, res) => {
  try {
    const allowed = ['firstName', 'lastName', 'phone', 'address', 'department', 'designation', 'qualification', 'joiningDate', 'profilePhotoUrl'];
    const update = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k]; });
    const faculty = await Faculty.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!faculty) return res.status(404).json({ success: false, message: 'Faculty not found' });
    res.json({ success: true, data: { faculty } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Subjects
exports.createSubject = async (req, res) => {
  try {
    const subject = await Subject.create(req.body);
    if (req.body.facultyId) {
      await Faculty.findByIdAndUpdate(req.body.facultyId, { $addToSet: { subjectsTaught: subject._id } });
    }
    res.status(201).json({ success: true, data: { subject } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getSubjects = async (req, res) => {
  try {
    const filter = {};
    if (req.query.branch) filter.branch = req.query.branch;
    if (req.query.semester) filter.semester = Number(req.query.semester);
    const subjects = await Subject.find(filter).populate('facultyId', 'firstName lastName').lean();
    res.json({ success: true, data: { subjects } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Notices
exports.createNotice = async (req, res) => {
  try {
    const admin = await Admin.findOne({ userId: req.user._id });
    const notice = await Notice.create({ ...req.body, postedBy: admin?._id });
    res.status(201).json({ success: true, data: { notice } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getNotices = async (req, res) => {
  try {
    const notices = await Notice.find().sort({ isPinned: -1, createdAt: -1 }).lean();
    res.json({ success: true, data: { notices } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteNotice = async (req, res) => {
  try {
    await Notice.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Notice deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Exam Schedule
exports.createExamSchedule = async (req, res) => {
  try {
    const schedule = await ExamSchedule.create(req.body);
    res.status(201).json({ success: true, data: { schedule } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getExamSchedules = async (req, res) => {
  try {
    const filter = {};
    if (req.query.branch) filter.branch = req.query.branch;
    if (req.query.semester) filter.semester = Number(req.query.semester);
    const schedules = await ExamSchedule.find(filter).populate('entries.subjectId', 'code name').lean();
    res.json({ success: true, data: { schedules } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Class Schedule
exports.createClassSchedule = async (req, res) => {
  try {
    const schedule = await ClassSchedule.create(req.body);
    res.status(201).json({ success: true, data: { schedule } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getClassSchedules = async (req, res) => {
  try {
    const filter = {};
    if (req.query.branch) filter.branch = req.query.branch;
    if (req.query.semester) filter.semester = Number(req.query.semester);
    const schedules = await ClassSchedule.find(filter).populate('timetable.subjectId', 'code name').populate('timetable.facultyId', 'firstName lastName').lean();
    res.json({ success: true, data: { schedules } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Stats
exports.getStats = async (req, res) => {
  try {
    const [students, faculty, subjects, notices] = await Promise.all([
      Student.countDocuments(),
      Faculty.countDocuments(),
      Subject.countDocuments(),
      Notice.countDocuments(),
    ]);
    res.json({ success: true, data: { students, faculty, subjects, notices } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Fee management (admin view)
exports.getFees = async (req, res) => {
  try {
    const fees = await Fee.find().populate('studentId', 'firstName lastName enrollmentNo').lean();
    res.json({ success: true, data: { fees } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
