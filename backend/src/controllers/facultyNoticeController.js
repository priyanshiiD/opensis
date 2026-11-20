const Notice = require('../models/Notice');
const Faculty = require('../models/Faculty');
const {
  getFacultyAssignments,
  buildAudienceOptions,
  resolveTargetSelection,
  summarizeAudience,
  isValidObjectId,
} = require('../services/noticeAudienceService');
const { normalizeSession } = require('../utils/academicSession');

const cleanText = (value) => String(value ?? '').trim();

const parseAssignmentIds = (value) => {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
  } catch (err) {
    // Fall through to comma-separated parsing.
  }
  return value.split(',').map((item) => item.trim()).filter(Boolean);
};

const parseDate = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const findOwnedNotice = async (noticeId, facultyId) => {
  if (!isValidObjectId(noticeId)) return null;
  return Notice.findOne({ _id: noticeId, postedByFaculty: facultyId });
};

const mapMine = (notice) => ({
  ...notice,
  authorName: notice.postedByFaculty
    ? `${notice.postedByFaculty.firstName || ''} ${notice.postedByFaculty.lastName || ''}`.trim()
    : '',
});

const resolveAudience = async ({ facultyId, session, term, mode, assignmentIds }) => {
  const assignments = await getFacultyAssignments(facultyId, { session, term });
  const options = buildAudienceOptions(assignments);
  const resolved = resolveTargetSelection({ mode, assignmentIds, options });
  if (resolved.error) return resolved;
  return {
    targets: resolved.targets,
    summary: summarizeAudience(resolved.targets),
  };
};

exports.getAudienceOptions = async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ userId: req.user._id }).lean();
    if (!faculty) return res.status(404).json({ success: false, message: 'Faculty profile not found' });
    if (!req.academicSession) {
      return res.status(400).json({ success: false, message: 'Select an academic session before posting a notice.' });
    }
    const assignments = await getFacultyAssignments(faculty._id, {
      session: req.academicSession,
      term: req.academicTerm,
    });
    const options = buildAudienceOptions(assignments);
    res.json({
      success: true,
      data: {
        session: normalizeSession(req.academicSession),
        term: req.academicTerm,
        options,
        count: options.length,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getMyNotices = async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ userId: req.user._id }).lean();
    if (!faculty) return res.status(404).json({ success: false, message: 'Faculty profile not found' });
    const notices = await Notice.find({ postedByFaculty: faculty._id })
      .populate('postedByFaculty', 'firstName lastName')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, data: { notices: notices.map(mapMine) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createNotice = async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ userId: req.user._id }).lean();
    if (!faculty) return res.status(404).json({ success: false, message: 'Faculty profile not found' });

    const title = cleanText(req.body.title);
    const body = cleanText(req.body.body ?? req.body.description);
    if (!title || !body) {
      return res.status(400).json({ success: false, message: 'Title and description are required.' });
    }
    if (!req.academicSession) {
      return res.status(400).json({ success: false, message: 'Select an academic session before posting a notice.' });
    }

    const session = normalizeSession(req.academicSession);
    const term = req.academicTerm || undefined;
    const audienceMode = req.body.audienceMode === 'all-my-classes' ? 'all-my-classes' : 'selected';
    const assignmentIds = parseAssignmentIds(req.body.assignmentIds);
    const audience = await resolveAudience({
      facultyId: faculty._id,
      session,
      term,
      mode: audienceMode,
      assignmentIds,
    });
    if (audience.error) return res.status(400).json({ success: false, message: audience.error });

    const eventDate = parseDate(req.body.eventDate);
    if (eventDate === null) {
      return res.status(400).json({ success: false, message: 'Please enter a valid event date.' });
    }

    const attachments = req.file ? [`/uploads/${req.file.filename}`] : [];
    const notice = await Notice.create({
      title,
      body,
      category: cleanText(req.body.category) || undefined,
      eventDate,
      audience: 'students',
      authorRole: 'faculty',
      postedByFaculty: faculty._id,
      session,
      term,
      audienceTargets: audience.targets,
      audienceSummary: audience.summary,
      audienceMode,
      attachments,
      isPinned: req.body.isPinned === true || req.body.isPinned === 'true',
    });

    res.status(201).json({ success: true, data: { notice } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateNotice = async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ userId: req.user._id }).lean();
    if (!faculty) return res.status(404).json({ success: false, message: 'Faculty profile not found' });

    const notice = await findOwnedNotice(req.params.id, faculty._id);
    if (!notice) return res.status(404).json({ success: false, message: 'Notice not found or not owned by you.' });

    if (req.body.title !== undefined) {
      const title = cleanText(req.body.title);
      if (!title) return res.status(400).json({ success: false, message: 'Title is required.' });
      notice.title = title;
    }
    if (req.body.body !== undefined || req.body.description !== undefined) {
      const body = cleanText(req.body.body ?? req.body.description);
      if (!body) return res.status(400).json({ success: false, message: 'Description is required.' });
      notice.body = body;
    }
    if (req.body.category !== undefined) {
      notice.category = cleanText(req.body.category) || undefined;
    }
    if (req.body.eventDate !== undefined) {
      const eventDate = parseDate(req.body.eventDate);
      if (eventDate === null) {
        return res.status(400).json({ success: false, message: 'Please enter a valid event date.' });
      }
      notice.eventDate = eventDate;
    }
    if (req.body.isPinned !== undefined) {
      notice.isPinned = req.body.isPinned === true || req.body.isPinned === 'true';
    }
    if (req.file) {
      notice.attachments = [...(notice.attachments || []), `/uploads/${req.file.filename}`];
    }

    // Always revalidate the audience on edit. Existing targets are used when
    // the client does not send a new selection.
    const targetSession = normalizeSession(notice.session || req.academicSession);
    const targetTerm = notice.term || req.academicTerm;
    if (!targetSession) {
      return res.status(400).json({ success: false, message: 'This notice has no academic session and cannot be revalidated.' });
    }
    const existingAssignmentIds = (notice.audienceTargets || []).map((target) => String(target.assignmentId));
    const audienceMode = req.body.audienceMode
      || (existingAssignmentIds.length > 0 ? 'selected' : 'all-my-classes');
    const assignmentIds = req.body.assignmentIds !== undefined
      ? parseAssignmentIds(req.body.assignmentIds)
      : existingAssignmentIds;
    const audience = await resolveAudience({
      facultyId: faculty._id,
      session: targetSession,
      term: targetTerm,
      mode: audienceMode,
      assignmentIds,
    });
    if (audience.error) return res.status(400).json({ success: false, message: audience.error });

    notice.audienceTargets = audience.targets;
    notice.audienceSummary = audience.summary;
    notice.audienceMode = audienceMode;
    notice.audience = 'students';
    notice.authorRole = 'faculty';
    await notice.save();

    res.json({ success: true, data: { notice } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteNotice = async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ userId: req.user._id }).lean();
    if (!faculty) return res.status(404).json({ success: false, message: 'Faculty profile not found' });
    const notice = await findOwnedNotice(req.params.id, faculty._id);
    if (!notice) return res.status(404).json({ success: false, message: 'Notice not found or not owned by you.' });
    await notice.deleteOne();
    res.json({ success: true, message: 'Notice deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
