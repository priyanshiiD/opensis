const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const excelUpload = require('../middleware/excelUpload');
const ctrl = require('../controllers/facultyController');
const noticeCtrl = require('../controllers/facultyNoticeController');
const mstCtrl = require('../controllers/mstMarkController');

router.use(authenticate, authorize('faculty'));

router.get('/profile', ctrl.getProfile);
router.patch('/profile', upload.fields([
	{ name: 'profilePhoto', maxCount: 1 },
	{ name: 'signature', maxCount: 1 },
]), ctrl.updateProfile);
router.get('/subjects', ctrl.getSubjects);
router.post('/attendance', ctrl.markAttendance);
router.get('/attendance', ctrl.getAttendance);
router.get('/attendance/template', ctrl.downloadAttendanceTemplate);
router.post('/attendance/bulk-upload', excelUpload.single('file'), ctrl.bulkUploadAttendance);
router.get('/attendance/monthly-summary', ctrl.getMonthlyAttendanceSummary);
router.get('/attendance/monthly-export', ctrl.downloadMonthlyAttendanceReport);
router.get('/attendance/detention-export', ctrl.downloadDetentionAttendanceReport);
router.post('/attendance/monthly-notice', ctrl.publishMonthlyAttendanceNotice);
router.post('/assignments', upload.single('file'), ctrl.createAssignment);
router.get('/assignments', ctrl.getAssignments);
router.patch('/assignments/:id', upload.single('file'), ctrl.updateAssignment);
router.delete('/assignments/:id', ctrl.deleteAssignment);
router.get('/assignments/:id/submissions', ctrl.getSubmissions);
router.patch('/submissions/:id', ctrl.gradeSubmission);
router.delete('/submissions/:id', ctrl.deleteSubmission);
router.post('/marks', ctrl.updateMarks);
router.post('/marks/bulk-upload', excelUpload.single('file'), ctrl.bulkUploadMarks);
router.post('/marks/coursework-upload', excelUpload.single('file'), ctrl.bulkUploadCoursework);
router.get('/marks/coursework-template', ctrl.downloadCourseworkTemplate);
router.get('/marks/coursework-roster', ctrl.downloadCourseworkRoster);
router.get('/marks/template', ctrl.downloadMarksTemplate);
router.get('/marks/export', ctrl.downloadMarksReport);
router.get('/class-students', ctrl.getClassStudents);
router.get('/marks', ctrl.getMarks);

router.get('/mst-marks/options', mstCtrl.getOptions);
router.get('/mst-marks/template', mstCtrl.downloadTemplate);
router.get('/mst-marks', mstCtrl.getMarks);
router.post('/mst-marks/preview', excelUpload.single('file'), mstCtrl.previewUpload);
router.post('/mst-marks/upload', excelUpload.single('file'), mstCtrl.uploadMarks);
router.post('/mst-marks/:id/publish', mstCtrl.publishMarks);
router.get('/notices', ctrl.getNotices);
router.post('/notices/mark-read', ctrl.markNoticesRead);
router.get('/notices/audiences', noticeCtrl.getAudienceOptions);
router.get('/notices/mine', noticeCtrl.getMyNotices);
router.post('/notices', upload.single('attachment'), noticeCtrl.createNotice);
router.put('/notices/:id', upload.single('attachment'), noticeCtrl.updateNotice);
router.delete('/notices/:id', noticeCtrl.deleteNotice);
router.get('/class-schedule', ctrl.getClassSchedule);
router.get('/feedback', ctrl.getFeedback);

// Lab batch management (faculty assigns students to batches for lab practicals)
router.get('/lab-batches/:labId', ctrl.getLabBatches);
router.put('/lab-batches/:labId', ctrl.saveLabBatches);

// Syllabus management (faculty can add/edit syllabus for their assigned subjects & labs)
router.patch('/syllabus/subject/:subjectId', upload.single('syllabusFile'), ctrl.updateSubjectSyllabus);
router.patch('/syllabus/lab/:labId', upload.single('syllabusFile'), ctrl.updateLabSyllabus);

// Enrolled students view (faculty sees who is in their subject / lab)
router.get('/subject-students/:subjectId', ctrl.getSubjectStudents);
router.get('/lab-students/:labId', ctrl.getLabStudents);

module.exports = router;
