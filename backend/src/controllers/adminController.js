const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const Subject = require('../models/Subject');
const Notice = require('../models/Notice');
const ExamSchedule = require('../models/ExamSchedule');
const ClassSchedule = require('../models/ClassSchedule');
const Fee = require('../models/Fee');
const Result = require('../models/Result');
const Admin = require('../models/Admin');
const { createStudentWorkbook, createFacultyWorkbook } = require('../utils/excelExport');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

// Students
exports.enrollStudent = async (req, res) => {
  try {
    const { email, password, enrollmentNo, firstName, lastName, branch, currentSemester, section, admissionYear, session, dob, gender, phone, address, fatherName, motherName } = req.body;

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ success: false, message: 'Email already in use' });

    const passwordHash = await bcrypt.hash(password || 'College@123', 12);
    const user = await User.create({ email, passwordHash, role: 'student' });

    const student = await Student.create({
      userId: user._id, enrollmentNo, firstName, lastName, branch, currentSemester, section, admissionYear, session, dob, gender, phone, address, fatherName, motherName,
    });

    res.status(201).json({ success: true, data: { student } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getStudents = async (req, res) => {
  try {
    const filter = {};
    if (req.query.branch) filter.branch = req.query.branch;
    if (req.query.semester) filter.currentSemester = Number(req.query.semester);
    if (req.query.admissionYear) filter.admissionYear = Number(req.query.admissionYear);
    if (req.query.gender) filter.gender = req.query.gender;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const [raw, total] = await Promise.all([
      Student.find(filter).populate('userId', 'email').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Student.countDocuments(filter),
    ]);
    const students = raw.map(s => ({ ...s, email: s.userId?.email }));
    res.json({ success: true, data: { students, total, page, pages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getStudent = async (req, res) => {
  try {
    const raw = await Student.findById(req.params.id).populate('userId', 'email').lean();
    if (!raw) return res.status(404).json({ success: false, message: 'Student not found' });
    const student = { ...raw, email: raw.userId?.email };
    res.json({ success: true, data: { student } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateStudent = async (req, res) => {
  try {
    const allowed = ['enrollmentNo','firstName', 'lastName', 'dob', 'gender', 'phone', 'address', 'fatherName', 'motherName', 'branch', 'currentSemester', 'section', 'admissionYear', 'session', 'profilePhotoUrl'];
    const update = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k]; });
    const student = await Student.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    res.json({ success: true, data: { student } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteStudent = async (req, res) => {
  try {
    const student = await Student.findByIdAndDelete(req.params.id);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    await User.findByIdAndDelete(student.userId);
    res.json({ success: true, message: 'Student deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Faculty
exports.enrollFaculty = async (req, res) => {
  try {
    const { email, password, employeeId, firstName, lastName, department, designation, qualification, joiningDate, phone, address, subjectIds, personalEmail, gender, experience } = req.body;

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ success: false, message: 'Email already in use' });

    const passwordHash = await bcrypt.hash(password || 'Faculty@123', 12);
    const user = await User.create({ email, passwordHash, role: 'faculty' });

    const assignedSubjects = Array.isArray(subjectIds) ? subjectIds.filter(Boolean) : [];
    const faculty = await Faculty.create({ userId: user._id, employeeId, firstName, lastName, department, designation, qualification, joiningDate, phone, address, personalEmail, gender, experience, subjectsTaught: assignedSubjects });

    if (assignedSubjects.length > 0) {
      await Subject.updateMany({ _id: { $in: assignedSubjects } }, { facultyId: faculty._id });
    }

    res.status(201).json({ success: true, data: { faculty } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getFaculty = async (req, res) => {
  try {
    const raw = await Faculty.find().populate('userId', 'email').populate('subjectsTaught', 'code name').lean();
    const faculty = raw.map(f => ({ ...f, email: f.userId?.email }));
    res.json({ success: true, data: { faculty } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getFacultyById = async (req, res) => {
  try {
    const raw = await Faculty.findById(req.params.id).populate('userId', 'email').populate('subjectsTaught').lean();
    if (!raw) return res.status(404).json({ success: false, message: 'Faculty not found' });
    const faculty = { ...raw, email: raw.userId?.email };
    res.json({ success: true, data: { faculty } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateFaculty = async (req, res) => {
  try {
    const allowed = ['firstName', 'lastName', 'personalEmail', 'phone', 'address', 'gender', 'department', 'designation', 'qualification', 'experience', 'joiningDate', 'profilePhotoUrl', 'signatureUrl'];
    const update = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k]; });

    // new: false → get the OLD doc so we can diff subjectsTaught
    const faculty = await Faculty.findByIdAndUpdate(req.params.id, update, { new: false, runValidators: true });
    if (!faculty) return res.status(404).json({ success: false, message: 'Faculty not found' });

    if (Array.isArray(req.body.subjectIds)) {
      const newIds = req.body.subjectIds.filter(Boolean).map(String);
      const oldIds = faculty.subjectsTaught.map(String);

      const toRemove = oldIds.filter(id => !newIds.includes(id));
      const toAdd    = newIds.filter(id => !oldIds.includes(id));

      if (toRemove.length > 0) {
        await Subject.updateMany(
          { _id: { $in: toRemove }, facultyId: faculty._id },
          { $unset: { facultyId: 1 } }
        );
      }

      if (toAdd.length > 0) {
        const prevAssigned = await Subject.find({ _id: { $in: toAdd }, facultyId: { $exists: true, $ne: null } }).select('_id facultyId').lean();
        for (const s of prevAssigned) {
          if (String(s.facultyId) !== String(faculty._id)) {
            await Faculty.findByIdAndUpdate(s.facultyId, { $pull: { subjectsTaught: s._id } });
          }
        }
        await Subject.updateMany({ _id: { $in: toAdd } }, { facultyId: faculty._id });
      }

      await Faculty.findByIdAndUpdate(faculty._id, { subjectsTaught: newIds });
    }

    const updated = await Faculty.findById(faculty._id).populate('userId', 'email').populate('subjectsTaught', 'code name').lean();
    res.json({ success: true, data: { faculty: { ...updated, email: updated.userId?.email } } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteFaculty = async (req, res) => {
  try {
    const faculty = await Faculty.findByIdAndDelete(req.params.id);
    if (!faculty) return res.status(404).json({ success: false, message: 'Faculty not found' });
    await User.findByIdAndDelete(faculty.userId);
    res.json({ success: true, message: 'Faculty deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Bulk upload students via Excel
exports.bulkUploadStudents = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const workbook = xlsx.readFile(req.file.path, { cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

    const results = { success: [], failed: [] };

    for (const [idx, row] of rows.entries()) {
      try {
        const rollNo = String(row.rollNo || row.RollNo || row.Roll || row.Roll_No || '').trim();
        const fullName = String(row.fullName || row.FullName || row.name || row.Name || '').trim();
        const email = String(row.email || row.Email || '').trim().toLowerCase();
        const branch = String(row.branch || row.Branch || '').trim();
        const semester = row.semester || row.Sem || row.Semester || '';

        if (!rollNo || !fullName || !email || !branch || !semester) {
          results.failed.push({ row: idx + 2, reason: 'Missing required field(s)', data: row });
          continue;
        }

        // duplicate checks
        const dupEmail = await User.findOne({ email });
        const dupRoll = await Student.findOne({ enrollmentNo: rollNo });
        if (dupEmail) {
          results.failed.push({ row: idx + 2, reason: 'Duplicate email', data: { email } });
          continue;
        }
        if (dupRoll) {
          results.failed.push({ row: idx + 2, reason: 'Duplicate rollNo', data: { rollNo } });
          continue;
        }

        // split full name
        const parts = fullName.split(/\s+/);
        const firstName = parts.shift();
        const lastName = parts.join(' ') || '';

        // generate username (ensure unique)
        const base = (email.split('@')[0] || `${firstName}.${lastName}`.replace(/\s+/g, '.')).toLowerCase().replace(/[^a-z0-9\.]/g, '');
        let username = base;
        let i = 0;
        while (await User.findOne({ username })) {
          i += 1;
          username = `${base}${i}`;
        }

        const defaultPassword = 'Welcome@123';
        const passwordHash = await bcrypt.hash(defaultPassword, 12);

        const user = await User.create({ email, passwordHash, role: 'student', username });

        const student = await Student.create({
          userId: user._id,
          enrollmentNo: rollNo,
          firstName,
          lastName,
          branch,
          currentSemester: Number(semester),
        });

        results.success.push({ row: idx + 2, userId: user._id, studentId: student._id, email, rollNo });
      } catch (errRow) {
        results.failed.push({ row: idx + 2, reason: errRow.message || 'Failed to process row', data: row });
      }
    }

    // remove uploaded file
    try { fs.unlinkSync(req.file.path); } catch (e) { }

    res.json({ success: true, data: results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Bulk upload faculty via Excel
exports.bulkUploadFaculty = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const workbook = xlsx.readFile(req.file.path, { cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

    const results = { success: [], failed: [] };

    for (const [idx, row] of rows.entries()) {
      try {
        const employeeId = String(row.employeeId || row.EmployeeId || row.employee || '').trim();
        const fullName = String(row.fullName || row.FullName || row.name || row.Name || '').trim();
        const email = String(row.email || row.Email || '').trim().toLowerCase();
        const department = String(row.department || row.Department || '').trim();
        const designation = String(row.designation || row.Designation || '').trim();

        if (!employeeId || !fullName || !email || !department || !designation) {
          results.failed.push({ row: idx + 2, reason: 'Missing required field(s)', data: row });
          continue;
        }

        const dupEmail = await User.findOne({ email });
        const dupEmp = await Faculty.findOne({ employeeId });
        if (dupEmail) {
          results.failed.push({ row: idx + 2, reason: 'Duplicate email', data: { email } });
          continue;
        }
        if (dupEmp) {
          results.failed.push({ row: idx + 2, reason: 'Duplicate employeeId', data: { employeeId } });
          continue;
        }

        const parts = fullName.split(/\s+/);
        const firstName = parts.shift();
        const lastName = parts.join(' ') || '';

        const base = (email.split('@')[0] || `${firstName}.${lastName}`.replace(/\s+/g, '.')).toLowerCase().replace(/[^a-z0-9\.]/g, '');
        let username = base;
        let i = 0;
        while (await User.findOne({ username })) {
          i += 1;
          username = `${base}${i}`;
        }

        const defaultPassword = 'Welcome@123';
        const passwordHash = await bcrypt.hash(defaultPassword, 12);

        const user = await User.create({ email, passwordHash, role: 'faculty', username });

        const faculty = await Faculty.create({ userId: user._id, employeeId, firstName, lastName, department, designation });

        results.success.push({ row: idx + 2, userId: user._id, facultyId: faculty._id, email, employeeId });
      } catch (errRow) {
        results.failed.push({ row: idx + 2, reason: errRow.message || 'Failed to process row', data: row });
      }
    }

    try { fs.unlinkSync(req.file.path); } catch (e) { }

    res.json({ success: true, data: results });
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
    const subjects = await Subject.find(filter).populate('facultyId', 'firstName lastName department').lean();
    res.json({ success: true, data: { subjects } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateSubject = async (req, res) => {
  try {
    const { name, credits, facultyId } = req.body;
    const subject = await Subject.findById(req.params.id);
    if (!subject) return res.status(404).json({ success: false, message: 'Subject not found' });

    // reassign faculty: remove from old, add to new
    if (facultyId !== undefined && String(subject.facultyId || '') !== String(facultyId)) {
      if (subject.facultyId) {
        await Faculty.findByIdAndUpdate(subject.facultyId, { $pull: { subjectsTaught: subject._id } });
      }
      if (facultyId) {
        await Faculty.findByIdAndUpdate(facultyId, { $addToSet: { subjectsTaught: subject._id } });
      }
      subject.facultyId = facultyId || undefined;
    }
    if (name !== undefined) subject.name = name;
    if (credits !== undefined) subject.credits = Number(credits);
    await subject.save();

    const updated = await Subject.findById(subject._id).populate('facultyId', 'firstName lastName department').lean();
    res.json({ success: true, data: { subject: updated } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteSubject = async (req, res) => {
  try {
    const subject = await Subject.findByIdAndDelete(req.params.id);
    if (!subject) return res.status(404).json({ success: false, message: 'Subject not found' });
    if (subject.facultyId) {
      await Faculty.findByIdAndUpdate(subject.facultyId, { $pull: { subjectsTaught: subject._id } });
    }
    res.json({ success: true, message: 'Subject deleted' });
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

// Result Management
exports.getResults = async (req, res) => {
  try {
    const filter = {};
    if (req.query.semester) filter.semester = Number(req.query.semester);
    if (req.query.session) filter.session = req.query.session;
    const results = await Result.find(filter)
      .populate('studentId', 'firstName lastName enrollmentNo branch')
      .populate('subjectMarks.subjectId', 'code name credits')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, data: { results } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.calculatePercentage = async (req, res) => {
  try {
    const { semester, session } = req.body;
    if (!semester || !session) return res.status(400).json({ success: false, message: 'Semester and session required' });
    
    const results = await Result.find({ semester, session })
      .populate('subjectMarks.subjectId', 'credits')
      .lean();
    
    const updated = [];
    for (const result of results) {
      const subjectMarks = result.subjectMarks || [];
      
      // Check if all subjects have marks
      if (subjectMarks.length === 0 || subjectMarks.some(s => !s.totalMarks)) {
        continue;
      }
      
      // Calculate total marks and total credits
      let totalMarksWeighted = 0;
      let totalCredits = 0;
      let allPassing = true;
      
      for (const sm of subjectMarks) {
        const credits = sm.subjectId?.credits || 3;
        const marks = sm.totalMarks || 0;
        totalMarksWeighted += marks * credits;
        totalCredits += credits;
        if (marks < 40) allPassing = false;
      }
      
      // Calculate percentage and SGPA
      const percentage = totalCredits > 0 ? ((totalMarksWeighted / totalCredits) / 100).toFixed(2) * 100 : 0;
      const sgpa = totalCredits > 0 ? (totalMarksWeighted / totalCredits / 10).toFixed(2) : 0;
      const status = allPassing ? 'pass' : 'fail';
      
      await Result.findByIdAndUpdate(result._id, {
        sgpa,
        percentage: Number(percentage),
        status,
      });
      
      updated.push({ studentId: result.studentId, sgpa, percentage, status });
    }
    
    res.json({ success: true, message: `Processed ${updated.length} results`, data: { updated } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Export Students to Excel
exports.exportStudents = async (req, res) => {
  try {
    const filter = {};
    if (req.query.branch) filter.branch = req.query.branch;
    if (req.query.semester) filter.currentSemester = Number(req.query.semester);
    if (req.query.admissionYear) filter.admissionYear = Number(req.query.admissionYear);
    if (req.query.gender) filter.gender = req.query.gender;

    const students = await Student.find(filter)
      .populate('userId', 'email')
      .sort({ enrollmentNo: 1 })
      .lean();

    const studentsWithEmail = students.map(s => ({ ...s, email: s.userId?.email }));

    const workbook = createStudentWorkbook(studentsWithEmail);
    
    // Generate filename with filters
    const filterStr = [];
    if (req.query.branch) filterStr.push(`Branch-${req.query.branch}`);
    if (req.query.semester) filterStr.push(`Sem-${req.query.semester}`);
    if (req.query.admissionYear) filterStr.push(`Year-${req.query.admissionYear}`);
    const filename = filterStr.length > 0 
      ? `Students_${filterStr.join('_')}_${Date.now()}.xlsx`
      : `Students_${Date.now()}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Export Faculty to Excel
exports.exportFaculty = async (req, res) => {
  try {
    const filter = {};
    if (req.query.department) filter.department = req.query.department;
    if (req.query.designation) filter.designation = req.query.designation;

    const faculty = await Faculty.find(filter)
      .populate('userId', 'email')
      .sort({ employeeId: 1 })
      .lean();

    const facultyWithEmail = faculty.map(f => ({ ...f, email: f.userId?.email }));

    const workbook = createFacultyWorkbook(facultyWithEmail);
    
    // Generate filename with filters
    const filterStr = [];
    if (req.query.department) filterStr.push(`Dept-${req.query.department}`);
    if (req.query.designation) filterStr.push(`Desg-${req.query.designation}`);
    const filename = filterStr.length > 0 
      ? `Faculty_${filterStr.join('_')}_${Date.now()}.xlsx`
      : `Faculty_${Date.now()}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// =============== TEMPORARY: Seed Test Data (For Development Only) ===============
// This endpoint generates 10 test students and 10 test faculty for quick testing
// REMOVE THIS IN PRODUCTION
exports.seedTestData = async (req, res) => {
  try {
    const { seedTestData, testStudentData, testFacultyData } = require('../utils/seedTestData');
    const results = await seedTestData();

    // Map generated data to credentials format
    const studentCredentials = results.studentsCreated > 0 
      ? testStudentData.map((s, idx) => ({
          name: `${s.firstName} ${s.lastName}`,
          rollNo: `TS${String(idx + 1).padStart(4, '0')}`,
          email: s.email,
          username: `${s.firstName.toLowerCase()}.${s.lastName.toLowerCase()}`,
          password: 'Welcome@123',
        }))
      : [];

    const facultyCredentials = results.facultyCreated > 0
      ? testFacultyData.map((f, idx) => ({
          name: `${f.title ? f.title + ' ' : ''}${f.firstName} ${f.lastName}`,
          employeeId: `EMPL${String(idx + 1).padStart(5, '0')}`,
          email: f.email,
          username: `${f.firstName.toLowerCase()}.${f.lastName.toLowerCase()}`,
          password: 'Welcome@123',
        }))
      : [];

    res.status(201).json({
      success: true,
      message: 'Test data seeded successfully',
      data: {
        studentsCreated: results.studentsCreated,
        facultyCreated: results.facultyCreated,
        studentsSkipped: results.studentsSkipped,
        facultySkipped: results.facultySkipped,
        errors: results.errors,
        testAccounts: {
          students: studentCredentials,
          faculty: facultyCredentials,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
