const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/adminController');

router.use(authenticate, authorize('admin'));

router.post('/students', ctrl.enrollStudent);
router.get('/students', ctrl.getStudents);
router.get('/students/:id', ctrl.getStudent);
router.patch('/students/:id', ctrl.updateStudent);

router.post('/faculty', ctrl.enrollFaculty);
router.get('/faculty', ctrl.getFaculty);
router.get('/faculty/:id', ctrl.getFacultyById);
router.patch('/faculty/:id', ctrl.updateFaculty);

router.post('/subjects', ctrl.createSubject);
router.get('/subjects', ctrl.getSubjects);

router.post('/notices', ctrl.createNotice);
router.get('/notices', ctrl.getNotices);
router.delete('/notices/:id', ctrl.deleteNotice);

router.post('/exam-schedule', ctrl.createExamSchedule);
router.get('/exam-schedule', ctrl.getExamSchedules);

router.post('/class-schedule', ctrl.createClassSchedule);
router.get('/class-schedule', ctrl.getClassSchedules);

router.get('/stats', ctrl.getStats);
router.get('/fees', ctrl.getFees);

module.exports = router;
