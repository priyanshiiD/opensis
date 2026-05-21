const Faculty = require('../models/Faculty');
const Subject = require('../models/Subject');
const Attendance = require('../models/Attendance');
const Assignment = require('../models/Assignment');
const Notice = require('../models/Notice');
const ClassSchedule = require('../models/ClassSchedule');
const Result = require('../models/Result');
const Student = require('../models/Student');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const xlsx = require('xlsx');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const parseDateOnly = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const isFutureDate = (date) => {
  if (!date) return false;
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  return date > endOfToday;
};

const toLocalDateOnly = (value) => {
  if (value === undefined || value === null || value === '') return null;
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
};

const getMonthBounds = (monthValue) => {
  if (!monthValue || typeof monthValue !== 'string' || !/^\d{4}-\d{2}$/.test(monthValue)) {
    return null;
  }
  const [year, month] = monthValue.split('-').map(Number);
  const start = new Date(year, month - 1, 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(year, month, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end, daysInMonth: end.getDate(), year, month };
};

const normalizeAttendanceStatus = (value) => {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (['present', 'p', '1', 'yes', 'y', 'true'].includes(normalized)) return 'present';
  if (['absent', 'a', '0', 'no', 'n', 'false'].includes(normalized)) return 'absent';
  return null;
};

const getAttendanceUploadDir = () => path.join(__dirname, '../uploads/attendance-reports');

const ensureAttendanceUploadDir = async () => {
  const dir = getAttendanceUploadDir();
  await fs.promises.mkdir(dir, { recursive: true });
  return dir;
};

const facultyOwnsSubject = (faculty, subjectId, subject) => {
  if (!faculty || !subject) return false;
  const subjectOwned = subject.facultyId && String(subject.facultyId) === String(faculty._id);
  const facultyAssigned = Array.isArray(faculty.subjectsTaught) && faculty.subjectsTaught.map(String).includes(String(subjectId));
  return subjectOwned || facultyAssigned;
};

const getClassRoster = async (subject, semester, section = '') => {
  const filter = { branch: subject.branch, currentSemester: Number(semester) };
  if (section) filter.section = section;
  return Student.find(filter)
    .sort({ enrollmentNo: 1 })
    .select('firstName lastName enrollmentNo branch currentSemester section session')
    .lean();
};

const getAttendanceRecordForDate = async (subjectId, date) => {
  const day = toLocalDateOnly(date);
  if (!day) return null;
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(day);
  end.setHours(23, 59, 59, 999);
  return Attendance.findOne({ subjectId, date: { $gte: start, $lte: end } }).lean();
};

const saveAttendanceWorkbook = async (workbook, filename) => {
  const dir = await ensureAttendanceUploadDir();
  const fullPath = path.join(dir, filename);
  await workbook.xlsx.writeFile(fullPath);
  return { fullPath, publicPath: `/uploads/attendance-reports/${filename}` };
};

exports.getProfile = async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ userId: req.user._id })
      .populate('userId', 'email')
      .populate('subjectsTaught', 'code name branch semester')
      .lean();
    if (!faculty) return res.status(404).json({ success: false, message: 'Profile not found' });
    res.json({ success: true, data: { faculty: { ...faculty, officialEmail: faculty.userId?.email } } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ userId: req.user._id }).populate('userId', 'email');
    if (!faculty) return res.status(404).json({ success: false, message: 'Profile not found' });

    const allowed = ['email', 'phone', 'address', 'gender', 'qualification', 'experience', 'joiningDate'];
    const update = {};

    allowed.forEach((key) => {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    });

    const email = update.email?.trim().toLowerCase();
    if (email !== undefined) {
      if (!email || !EMAIL_REGEX.test(email)) {
        return res.status(400).json({ success: false, message: 'Please enter a valid email address' });
      }
      const duplicate = await require('../models/User').findOne({ email, _id: { $ne: req.user._id } });
      if (duplicate) {
        return res.status(400).json({ success: false, message: 'Email already in use' });
      }
      update.email = email;
    }

    if (update.experience !== undefined) {
      const experience = Number(update.experience);
      if (!Number.isFinite(experience) || experience < 0) {
        return res.status(400).json({ success: false, message: 'Experience must be a valid non-negative number' });
      }
      update.experience = experience;
    }

    if (update.joiningDate !== undefined) {
      const joiningDate = parseDateOnly(update.joiningDate);
      if (!joiningDate) {
        return res.status(400).json({ success: false, message: 'Please select a valid joining date' });
      }
      if (isFutureDate(joiningDate)) {
        return res.status(400).json({ success: false, message: 'Joining date cannot be in the future' });
      }
      update.joiningDate = joiningDate;
    }

    if (req.files?.profilePhoto?.[0]) {
      update.profilePhotoUrl = `/uploads/${req.files.profilePhoto[0].filename}`;
    }

    if (req.files?.profilePhoto?.[0]) {
      update.profilePhotoUrl = `/uploads/${req.files.profilePhoto[0].filename}`;
    }

    if (update.email) {
      await require('../models/User').findByIdAndUpdate(req.user._id, { email: update.email }, { runValidators: true });
    }

    delete update.email;

    await Faculty.findByIdAndUpdate(faculty._id, update, { runValidators: true });

    const updated = await Faculty.findOne({ userId: req.user._id })
      .populate('userId', 'email')
      .populate('subjectsTaught', 'code name branch semester')
      .lean();

    res.json({ success: true, data: { faculty: { ...updated, officialEmail: updated.userId?.email } } });
  } catch (err) {
    const message = err.name === 'ValidationError' ? Object.values(err.errors).map(e => e.message).join(', ') : err.message;
    const statusCode = err.name === 'ValidationError' ? 400 : 500;
    res.status(statusCode).json({ success: false, message });
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

exports.getClassStudents = async (req, res) => {
  try {
    const { subjectId, semester, session, section } = req.query;
    if (!subjectId || !semester) {
      return res.status(400).json({ success: false, message: 'subjectId and semester are required' });
    }

    const faculty = await Faculty.findOne({ userId: req.user._id }).lean();
    if (!faculty) return res.status(404).json({ success: false, message: 'Faculty profile not found' });

    const subject = await Subject.findById(subjectId).lean();
    if (!subject) return res.status(404).json({ success: false, message: 'Subject not found' });

    if (!facultyOwnsSubject(faculty, subjectId, subject)) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this class roster' });
    }

    const filter = {
      branch: subject.branch,
      currentSemester: Number(semester),
    };
    if (session) filter.session = session;
    if (section) filter.section = section;

    const students = await Student.find(filter)
      .sort({ enrollmentNo: 1 })
      .select('firstName lastName enrollmentNo branch currentSemester section session')
      .lean();

    res.json({
      success: true,
      data: {
        students,
        count: students.length,
        subject: {
          _id: subject._id,
          code: subject.code,
          name: subject.name,
          branch: subject.branch,
          semester: subject.semester,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.markAttendance = async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ userId: req.user._id });
    const { subjectId, date, section, records } = req.body;
    const subject = await Subject.findById(subjectId).lean();
    if (!subject) return res.status(404).json({ success: false, message: 'Subject not found' });
    if (!facultyOwnsSubject(faculty, subjectId, subject)) {
      return res.status(403).json({ success: false, message: 'Not authorized to mark attendance for this subject' });
    }

    const attendanceDate = toLocalDateOnly(date);
    if (!attendanceDate) return res.status(400).json({ success: false, message: 'Please select a valid date' });
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, message: 'No attendance records provided' });
    }

    const rosterIds = new Set((await getClassRoster(subject, subject.semester, section || '')).map(s => String(s._id)));
    const cleanedRecords = records
      .filter(r => r.studentId && rosterIds.has(String(r.studentId)))
      .map(r => ({
        studentId: r.studentId,
        status: normalizeAttendanceStatus(r.status) || 'present',
      }));

    const attendanceFilter = {
      subjectId,
      facultyId: faculty._id,
      date: attendanceDate,
    };

    const attendancePayload = {
      subjectId,
      facultyId: faculty._id,
      date: attendanceDate,
      semester: subject.semester,
      branch: subject.branch,
      section: section || '',
      records: cleanedRecords,
    };

    const existing = await Attendance.findOne(attendanceFilter);
    const attendance = existing
      ? await Attendance.findByIdAndUpdate(existing._id, attendancePayload, { new: true, runValidators: true })
      : await Attendance.create(attendancePayload);

    res.status(existing ? 200 : 201).json({ success: true, data: { attendance } });
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

exports.downloadAttendanceTemplate = async (req, res) => {
  try {
    const { subjectId, date } = req.query;
    if (!subjectId || !date) {
      return res.status(400).json({ success: false, message: 'subjectId and date are required' });
    }

    const faculty = await Faculty.findOne({ userId: req.user._id }).lean();
    if (!faculty) return res.status(404).json({ success: false, message: 'Faculty profile not found' });

    const subject = await Subject.findById(subjectId).lean();
    if (!subject) return res.status(404).json({ success: false, message: 'Subject not found' });
    if (!facultyOwnsSubject(faculty, subjectId, subject)) {
      return res.status(403).json({ success: false, message: 'Not authorized to download attendance template for this subject' });
    }

    const students = await getClassRoster(subject, subject.semester);
    if (students.length === 0) {
      return res.status(404).json({ success: false, message: 'No students found for this subject class' });
    }

    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet(`${subject.code}_${date}`);
    ws.columns = [
      { header: 'enrollmentNo', key: 'enrollmentNo', width: 18 },
      { header: 'studentName', key: 'studentName', width: 26 },
      { header: 'status', key: 'status', width: 14 },
    ];
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDEBF7' } };
    ws.views = [{ state: 'frozen', ySplit: 1 }];

    students.forEach((student) => {
      ws.addRow({
        enrollmentNo: student.enrollmentNo,
        studentName: `${student.firstName} ${student.lastName}`,
        status: 'present',
      });
    });

    const filename = `AttendanceTemplate_${subject.code}_${date}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.bulkUploadAttendance = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const { subjectId, date } = req.body;
    if (!subjectId || !date) {
      return res.status(400).json({ success: false, message: 'subjectId and date are required' });
    }

    const faculty = await Faculty.findOne({ userId: req.user._id });
    if (!faculty) return res.status(404).json({ success: false, message: 'Faculty profile not found' });

    const subject = await Subject.findById(subjectId).lean();
    if (!subject) return res.status(404).json({ success: false, message: 'Subject not found' });
    if (!facultyOwnsSubject(faculty, subjectId, subject)) {
      return res.status(403).json({ success: false, message: 'Not authorized to upload attendance for this subject' });
    }

    const attendanceDate = toLocalDateOnly(date);
    if (!attendanceDate) return res.status(400).json({ success: false, message: 'Please select a valid date' });

    const students = await getClassRoster(subject, subject.semester);
    const rosterByRoll = new Map(students.map(student => [String(student.enrollmentNo).trim().toLowerCase(), student]));

    const workbook = xlsx.readFile(req.file.path, { cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

    const records = [];
    const results = { success: [], failed: [] };

    for (const [idx, row] of rows.entries()) {
      const enrollmentNo = String(row.enrollmentNo || row.EnrollmentNo || row.enrollment_no || row.rollNo || row.RollNo || '').trim();
      const statusRaw = row.status || row.Status || row.attendance || row.Attendance || '';
      if (!enrollmentNo) {
        results.failed.push({ row: idx + 2, reason: 'Missing enrollment number' });
        continue;
      }

      const student = rosterByRoll.get(enrollmentNo.toLowerCase());
      if (!student) {
        results.failed.push({ row: idx + 2, enrollmentNo, reason: 'Student not found in this class' });
        continue;
      }

      const status = normalizeAttendanceStatus(statusRaw) || 'present';
      records.push({ studentId: student._id, status });
      results.success.push({ row: idx + 2, enrollmentNo, status });
    }

    if (records.length === 0) {
      try { fs.unlinkSync(req.file.path); } catch (e) { }
      return res.status(400).json({ success: false, message: 'No valid attendance rows found' });
    }

    const existing = await Attendance.findOne({ subjectId, facultyId: faculty._id, date: attendanceDate });
    const attendancePayload = {
      subjectId,
      facultyId: faculty._id,
      date: attendanceDate,
      semester: subject.semester,
      branch: subject.branch,
      section: '',
      records,
    };

    const attendance = existing
      ? await Attendance.findByIdAndUpdate(existing._id, attendancePayload, { new: true, runValidators: true })
      : await Attendance.create(attendancePayload);

    try { fs.unlinkSync(req.file.path); } catch (e) { }
    res.json({ success: true, data: { attendance, results } });
  } catch (err) {
    try { fs.unlinkSync(req.file.path); } catch (e) { }
    res.status(500).json({ success: false, message: err.message });
  }
};

const buildMonthlyAttendanceSummary = async ({ faculty, subjectId, month }) => {
  const subject = await Subject.findById(subjectId).lean();
  if (!subject) throw new Error('Subject not found');
  if (!facultyOwnsSubject(faculty, subjectId, subject)) throw new Error('Not authorized for this subject');

  const monthBounds = getMonthBounds(month);
  if (!monthBounds) throw new Error('month is required in YYYY-MM format');

  const students = await getClassRoster(subject, subject.semester);
  const attendanceDocs = await Attendance.find({
    subjectId,
    date: { $gte: monthBounds.start, $lte: monthBounds.end },
  })
    .sort({ date: 1 })
    .lean();

  const days = Array.from({ length: monthBounds.daysInMonth }, (_, index) => index + 1);
  const rows = students.map((student) => ({
    studentId: student._id,
    enrollmentNo: student.enrollmentNo,
    studentName: `${student.firstName} ${student.lastName}`,
    statuses: Array(monthBounds.daysInMonth).fill(''),
    presentDays: 0,
    absentDays: 0,
    markedDays: 0,
  }));
  const rowMap = new Map(rows.map(row => [String(row.studentId), row]));

  attendanceDocs.forEach((attendance) => {
    const dayIndex = new Date(attendance.date).getDate() - 1;
    (attendance.records || []).forEach((record) => {
      const row = rowMap.get(String(record.studentId));
      if (!row || dayIndex < 0 || dayIndex >= monthBounds.daysInMonth) return;
      const status = normalizeAttendanceStatus(record.status) || 'present';
      row.statuses[dayIndex] = status === 'present' ? 'P' : 'A';
      row.markedDays += 1;
      if (status === 'present') row.presentDays += 1;
      else row.absentDays += 1;
    });
  });

  return { subject, monthBounds, days, rows, attendanceDocs };
};

const createMonthlyAttendanceWorkbook = async (summary) => {
  const { subject, monthBounds, days, rows } = summary;
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet(`${subject.code}_${monthBounds.year}_${String(monthBounds.month).padStart(2, '0')}`);

  ws.columns = [
    { header: 'enrollmentNo', key: 'enrollmentNo', width: 18 },
    { header: 'studentName', key: 'studentName', width: 26 },
    ...days.map(day => ({ header: String(day), key: `d${day}`, width: 10 })),
    { header: 'presentDays', key: 'presentDays', width: 14 },
    { header: 'absentDays', key: 'absentDays', width: 14 },
    { header: 'markedDays', key: 'markedDays', width: 14 },
  ];

  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9EAF7' } };
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  rows.forEach((row) => {
    const values = {
      enrollmentNo: row.enrollmentNo,
      studentName: row.studentName,
      presentDays: row.presentDays,
      absentDays: row.absentDays,
      markedDays: row.markedDays,
    };
    days.forEach((day, idx) => {
      values[`d${day}`] = row.statuses[idx] || '';
    });
    ws.addRow(values);
  });

  return workbook;
};

exports.getMonthlyAttendanceSummary = async (req, res) => {
  try {
    const { subjectId, month } = req.query;
    if (!subjectId || !month) {
      return res.status(400).json({ success: false, message: 'subjectId and month are required' });
    }
    const faculty = await Faculty.findOne({ userId: req.user._id }).lean();
    if (!faculty) return res.status(404).json({ success: false, message: 'Faculty profile not found' });
    const summary = await buildMonthlyAttendanceSummary({ faculty, subjectId, month });
    res.json({
      success: true,
      data: {
        subject: summary.subject,
        month: month,
        days: summary.days,
        students: summary.rows,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.downloadMonthlyAttendanceReport = async (req, res) => {
  try {
    const { subjectId, month } = req.query;
    if (!subjectId || !month) {
      return res.status(400).json({ success: false, message: 'subjectId and month are required' });
    }
    const faculty = await Faculty.findOne({ userId: req.user._id }).lean();
    if (!faculty) return res.status(404).json({ success: false, message: 'Faculty profile not found' });
    const summary = await buildMonthlyAttendanceSummary({ faculty, subjectId, month });
    const workbook = await createMonthlyAttendanceWorkbook(summary);
    const filename = `Attendance_${summary.subject.code}_${month}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.publishMonthlyAttendanceNotice = async (req, res) => {
  try {
    const { subjectId, month } = req.body;
    if (!subjectId || !month) {
      return res.status(400).json({ success: false, message: 'subjectId and month are required' });
    }

    const faculty = await Faculty.findOne({ userId: req.user._id }).lean();
    if (!faculty) return res.status(404).json({ success: false, message: 'Faculty profile not found' });

    const summary = await buildMonthlyAttendanceSummary({ faculty, subjectId, month });
    const workbook = await createMonthlyAttendanceWorkbook(summary);
    const filename = `Attendance_${summary.subject.code}_${month}.xlsx`;
    const { publicPath } = await saveAttendanceWorkbook(workbook, filename);

    const notice = await Notice.create({
      title: `Monthly Attendance - ${summary.subject.code} - ${month}`,
      body: `Monthly attendance sheet for ${summary.subject.code} (${summary.subject.name}) for ${month} is attached.`,
      audience: 'students',
      attachments: [publicPath],
      isPinned: false,
    });

    res.status(201).json({ success: true, data: { notice, fileUrl: publicPath } });
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

// Grade calculation helpers
const calcGrade = (totalMarks) => {
  if (totalMarks >= 90) return 'O';
  if (totalMarks >= 75) return 'A+';
  if (totalMarks >= 60) return 'A';
  if (totalMarks >= 50) return 'B+';
  if (totalMarks >= 40) return 'B';
  return 'F';
};

const calcGradePoints = (totalMarks) => {
  if (totalMarks >= 90) return 10;
  if (totalMarks >= 75) return 9;
  if (totalMarks >= 60) return 8;
  if (totalMarks >= 50) return 7;
  if (totalMarks >= 40) return 6;
  return 0;
};

exports.updateMarks = async (req, res) => {
  try {
    const { semester, session, entries } = req.body;
    for (const entry of entries) {
      const { studentId, subjectId, internalMarks, externalMarks } = entry;
      const totalMarks = (internalMarks || 0) + (externalMarks || 0);
      const grade = calcGrade(totalMarks);
      const gradePoints = calcGradePoints(totalMarks);

      // Get subject credits
      const subject = await Subject.findById(subjectId).lean();
      const credits = subject?.credits || 3;
      const creditPoints = gradePoints * credits;

      // Get student for branch info
      const student = await Student.findById(studentId).lean();

      // Enrollment check
      if (student && subject && student.branch !== subject.branch) {
        throw new Error(`Enrollment Mismatch: Student ${student.enrollmentNo} is from ${student.branch}, cannot assign marks for ${subject.branch} subject`);
      }
      if (student && subject && student.currentSemester < subject.semester) {
        throw new Error(`Semester Mismatch: Student ${student.enrollmentNo} is in Sem ${student.currentSemester}, but this subject is for Sem ${subject.semester}`);
      }

      let result = await Result.findOne({ studentId, semester, session });
      if (!result) result = new Result({ studentId, semester, session, branch: student?.branch, subjectMarks: [] });

      const existing = result.subjectMarks.findIndex(s => s.subjectId?.toString() === subjectId);
      const markEntry = { subjectId, internalMarks, externalMarks, totalMarks, grade, gradePoints, credits, creditPoints };
      if (existing >= 0) result.subjectMarks[existing] = markEntry;
      else result.subjectMarks.push(markEntry);

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
      .populate('subjectMarks.subjectId', 'code name credits')
      .lean();
    res.json({ success: true, data: { results } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Bulk upload marks via Excel
exports.bulkUploadMarks = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const { subjectId, semester, session } = req.body;
    if (!subjectId || !semester || !session) {
      return res.status(400).json({ success: false, message: 'subjectId, semester, and session are required' });
    }

    const xlsx = require('xlsx');
    const fs = require('fs');

    const subject = await Subject.findById(subjectId).lean();
    if (!subject) return res.status(404).json({ success: false, message: 'Subject not found' });

    const credits = subject.credits || 3;

    const workbook = xlsx.readFile(req.file.path, { cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

    const results = { success: [], failed: [] };

    for (const [idx, row] of rows.entries()) {
      try {
        const enrollmentNo = String(row.enrollmentNo || row.EnrollmentNo || row.enrollment_no || row.rollNo || row.RollNo || '').trim();
        const internalMarks = Number(row.internalMarks || row.InternalMarks || row.internal || row.Internal || 0);
        const externalMarks = Number(row.externalMarks || row.ExternalMarks || row.external || row.External || 0);

        if (!enrollmentNo) {
          results.failed.push({ row: idx + 2, reason: 'Missing enrollment number' });
          continue;
        }

        if (internalMarks < 0 || internalMarks > 40) {
          results.failed.push({ row: idx + 2, reason: `Internal marks must be 0-40 (got ${internalMarks})`, enrollmentNo });
          continue;
        }
        if (externalMarks < 0 || externalMarks > 60) {
          results.failed.push({ row: idx + 2, reason: `External marks must be 0-60 (got ${externalMarks})`, enrollmentNo });
          continue;
        }

        const student = await Student.findOne({ enrollmentNo }).lean();
        if (!student) {
          results.failed.push({ row: idx + 2, reason: 'Student not found in system', enrollmentNo });
          continue;
        }

        // Enrollment check: branch must match subject branch
        if (student.branch !== subject.branch) {
          results.failed.push({ 
            row: idx + 2, 
            reason: `Enrollment Mismatch: Student is from ${student.branch}, but this subject is for ${subject.branch}`, 
            enrollmentNo 
          });
          continue;
        }

        // Semester check: Ensure student is in (or has passed) the semester of the subject
        if (student.currentSemester < subject.semester) {
          results.failed.push({
            row: idx + 2,
            reason: `Semester Mismatch: Student is in Sem ${student.currentSemester}, but this subject is for Sem ${subject.semester}`,
            enrollmentNo
          });
          continue;
        }

        const totalMarks = internalMarks + externalMarks;
        const grade = calcGrade(totalMarks);
        const gradePoints = calcGradePoints(totalMarks);
        const creditPoints = gradePoints * credits;

        let result = await Result.findOne({ studentId: student._id, semester: Number(semester), session });
        if (!result) {
          result = new Result({
            studentId: student._id,
            semester: Number(semester),
            session,
            branch: student.branch,
            subjectMarks: [],
          });
        }

        const existingIdx = result.subjectMarks.findIndex(s => s.subjectId?.toString() === subjectId);
        const markEntry = { subjectId, internalMarks, externalMarks, totalMarks, grade, gradePoints, credits, creditPoints };

        if (existingIdx >= 0) result.subjectMarks[existingIdx] = markEntry;
        else result.subjectMarks.push(markEntry);

        await result.save();
        results.success.push({ row: idx + 2, enrollmentNo, totalMarks, grade });
      } catch (errRow) {
        results.failed.push({ row: idx + 2, reason: errRow.message || 'Failed to process row' });
      }
    }

    // cleanup uploaded file
    try { require('fs').unlinkSync(req.file.path); } catch (e) { }

    res.json({ success: true, data: results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.downloadMarksTemplate = async (req, res) => {
  try {
    const { subjectId, semester, session } = req.query;
    if (!subjectId || !semester || !session) return res.status(400).json({ success: false, message: 'subjectId, semester, and session required' });

    const subject = await Subject.findById(subjectId).lean();
    if (!subject) return res.status(404).json({ success: false, message: 'Subject not found' });

    // Ensure requesting faculty actually teaches this subject
    const faculty = await Faculty.findOne({ userId: req.user._id }).lean();
    if (!faculty) return res.status(404).json({ success: false, message: 'Faculty profile not found' });

    const teaches = (subject.facultyId && subject.facultyId.toString() === (faculty._id || '').toString())
      || (Array.isArray(faculty.subjectsTaught) && faculty.subjectsTaught.map(s => s.toString()).includes(subjectId.toString()));
    if (!teaches) return res.status(403).json({ success: false, message: 'Not authorized to download template for this subject' });

    const studentFilter = { branch: subject.branch, currentSemester: Number(semester), session };
    if (req.query.section) studentFilter.section = req.query.section;

    const students = await Student.find(studentFilter)
      .sort({ enrollmentNo: 1 })
      .select('firstName lastName enrollmentNo branch currentSemester section session')
      .lean();

    if (students.length === 0) return res.status(404).json({ success: false, message: 'No students found for this branch and semester' });

    // Find existing results to pre-fill marks if any
    const results = await Result.find({ semester: Number(semester), session }).lean();

    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet(`${subject.code} Marks`);

    // Add columns
    ws.columns = [
      { header: 'enrollmentNo', key: 'enrollmentNo', width: 20 },
      { header: 'internalMarks', key: 'internalMarks', width: 15 },
      { header: 'externalMarks', key: 'externalMarks', width: 15 },
      { header: 'studentName', key: 'studentName', width: 30 },
    ];

    // Style header
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    // Add data
    for (const student of students) {
      // Look for existing marks for this student and subject
      const result = results.find(r => r.studentId?.toString() === student._id.toString());
      let internal = '';
      let external = '';

      if (result) {
        const sm = (result.subjectMarks || []).find(s => s.subjectId?.toString() === subjectId);
        if (sm) {
          internal = sm.internalMarks ?? '';
          external = sm.externalMarks ?? '';
        }
      }

      ws.addRow({
        enrollmentNo: student.enrollmentNo,
        studentName: `${student.firstName} ${student.lastName}`,
        internalMarks: internal,
        externalMarks: external,
      });
    }

    const filename = `MarksTemplate_${subject.code}_Sem${semester}_${session}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.downloadMarksReport = async (req, res) => {
  try {
    const { subjectId, semester, session } = req.query;
    if (!subjectId || !semester || !session) return res.status(400).json({ success: false, message: 'subjectId, semester, and session required' });

    const subject = await Subject.findById(subjectId).lean();
    if (!subject) return res.status(404).json({ success: false, message: 'Subject not found' });

    const faculty = await Faculty.findOne({ userId: req.user._id }).lean();
    if (!faculty) return res.status(404).json({ success: false, message: 'Faculty profile not found' });

    const teaches = (subject.facultyId && subject.facultyId.toString() === (faculty._id || '').toString())
      || (Array.isArray(faculty.subjectsTaught) && faculty.subjectsTaught.map(s => s.toString()).includes(subjectId.toString()));
    if (!teaches) return res.status(403).json({ success: false, message: 'Not authorized to export marks for this subject' });

    const studentFilter = { branch: subject.branch, currentSemester: Number(semester), session };
    if (req.query.section) studentFilter.section = req.query.section;

    const students = await Student.find(studentFilter)
      .sort({ enrollmentNo: 1 })
      .select('firstName lastName enrollmentNo')
      .lean();

    if (students.length === 0) return res.status(404).json({ success: false, message: 'No students found for this branch and semester' });

    // Load results for these students to fill marks
    const studentIds = students.map(s => s._id);
    const results = await Result.find({ studentId: { $in: studentIds }, semester: Number(semester), session }).lean();

    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet(`${subject.code}_Marks_${session}`);

    ws.columns = [
      { header: 'enrollmentNo', key: 'enrollmentNo', width: 20 },
      { header: 'studentName', key: 'studentName', width: 30 },
      { header: 'internalMarks', key: 'internalMarks', width: 15 },
      { header: 'externalMarks', key: 'externalMarks', width: 15 },
      { header: 'totalMarks', key: 'totalMarks', width: 12 },
      { header: 'grade', key: 'grade', width: 10 },
    ];

    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } };
    ws.views = [{ state: 'frozen', ySplit: 1 }];

    for (const student of students) {
      const result = results.find(r => String(r.studentId) === String(student._id));
      let internal = '';
      let external = '';
      let total = '';
      let grade = '';

      if (result && Array.isArray(result.subjectMarks)) {
        const sm = result.subjectMarks.find(s => s.subjectId?.toString() === subjectId.toString());
        if (sm) {
          internal = sm.internalMarks ?? '';
          external = sm.externalMarks ?? '';
          total = sm.totalMarks ?? '';
          grade = sm.grade ?? '';
        }
      }

      ws.addRow({
        enrollmentNo: student.enrollmentNo,
        studentName: `${student.firstName} ${student.lastName}`,
        internalMarks: internal,
        externalMarks: external,
        totalMarks: total,
        grade,
      });
    }

    const filename = `SubmittedMarks_${subject.code}_Sem${semester}_${session}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();
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
