const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/adminController');

router.use(authenticate);

// Allow faculty to read students (for marks upload)
router.get('/students', authorize('admin', 'faculty'), ctrl.getStudents);
router.post('/students', authorize('admin'), ctrl.enrollStudent);
router.get('/students/:id', authorize('admin'), ctrl.getStudent);
router.patch('/students/:id', authorize('admin'), ctrl.updateStudent);
router.delete('/students/:id', authorize('admin'), ctrl.deleteStudent);

router.post('/faculty', authorize('admin'), ctrl.enrollFaculty);
router.get('/faculty', authorize('admin'), ctrl.getFaculty);
router.get('/faculty/:id', authorize('admin'), ctrl.getFacultyById);
router.patch('/faculty/:id', authorize('admin'), ctrl.updateFaculty);
router.delete('/faculty/:id', authorize('admin'), ctrl.deleteFaculty);

router.post('/subjects', authorize('admin'), ctrl.createSubject);
router.get('/subjects', authorize('admin'), ctrl.getSubjects);
router.patch('/subjects/:id', authorize('admin'), ctrl.updateSubject);
router.delete('/subjects/:id', authorize('admin'), ctrl.deleteSubject);

router.post('/notices', authorize('admin'), ctrl.createNotice);
router.get('/notices', authorize('admin'), ctrl.getNotices);
router.delete('/notices/:id', authorize('admin'), ctrl.deleteNotice);

router.post('/exam-schedule', authorize('admin'), ctrl.createExamSchedule);
router.get('/exam-schedule', authorize('admin'), ctrl.getExamSchedules);

router.post('/class-schedule', authorize('admin'), ctrl.createClassSchedule);
router.get('/class-schedule', authorize('admin'), ctrl.getClassSchedules);

router.get('/stats', authorize('admin'), ctrl.getStats);
router.get('/fees', authorize('admin'), ctrl.getFees);

router.get('/results', authorize('admin'), ctrl.getResults);
router.post('/results/calculate-percentage', authorize('admin'), ctrl.calculatePercentage);

module.exports = router;
