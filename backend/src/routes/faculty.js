const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const ctrl = require('../controllers/facultyController');

router.use(authenticate, authorize('faculty'));

router.get('/profile', ctrl.getProfile);
router.patch('/profile', upload.fields([
	{ name: 'profilePhoto', maxCount: 1 },
	{ name: 'signature', maxCount: 1 },
]), ctrl.updateProfile);
router.get('/subjects', ctrl.getSubjects);
router.post('/attendance', ctrl.markAttendance);
router.get('/attendance', ctrl.getAttendance);
router.post('/assignments', upload.single('file'), ctrl.createAssignment);
router.get('/assignments', ctrl.getAssignments);
router.get('/assignments/:id/submissions', ctrl.getSubmissions);
router.patch('/submissions/:id', ctrl.gradeSubmission);
router.post('/marks', ctrl.updateMarks);
router.get('/marks', ctrl.getMarks);
router.get('/notices', ctrl.getNotices);
router.get('/class-schedule', ctrl.getClassSchedule);

module.exports = router;
