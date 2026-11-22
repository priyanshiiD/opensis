const HODSignature = require('../models/HodSignature');
const FileAsset = require('../models/FileAsset');
const Faculty = require('../models/Faculty');
const Student = require('../models/Student');
const Subject = require('../models/Subject');
const Lab = require('../models/Lab');
const Section = require('../models/Section');
const { preprocessSignatureImage } = require('../utils/signatureImage');

const normalizeKey = value => String(value || '').trim();

const getDatabaseDepartments = async () => {
  const [facultyDepartments, studentBranches, subjectBranches, labBranches, sectionDepartments] = await Promise.all([
    Faculty.distinct('department'),
    Student.distinct('branch'),
    Subject.distinct('branch'),
    Lab.distinct('branch'),
    Section.distinct('department'),
  ]);

  const departments = new Map();
  [...facultyDepartments, ...studentBranches, ...subjectBranches, ...labBranches, ...sectionDepartments]
    .filter(Boolean)
    .forEach(value => {
      const name = normalizeKey(value);
      if (name) departments.set(name, { id: name, name });
    });

  return [...departments.values()].sort((left, right) => left.name.localeCompare(right.name));
};

const serializeSignature = (signature) => signature ? {
  department: signature.department,
  departmentLabel: signature.department,
  imageUrl: signature.imageUrl,
  fileName: signature.fileName,
  contentType: signature.contentType,
  size: signature.size,
  updatedAt: signature.updatedAt,
} : null;

exports.listSignatures = async (req, res) => {
  try {
    const departments = await getDatabaseDepartments();
    const signatures = await HODSignature.find().lean();
    const byDepartment = new Map(signatures.map(item => [normalizeKey(item.department), serializeSignature(item)]));
    res.json({
      success: true,
      data: {
        departments: departments.map(department => ({
          id: department.id,
          name: department.name,
          department: department.id,
          departmentLabel: department.name,
          signature: byDepartment.get(department.id) || null,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.uploadSignature = async (req, res) => {
  try {
    const department = normalizeKey(req.params.department);
    const departments = await getDatabaseDepartments();
    if (!departments.some(item => item.id === department)) {
      return res.status(400).json({ success: false, message: 'Invalid department.' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please select a PNG or JPG/JPEG signature image.' });
    }

    let processedData = req.file.buffer;
    let processedContentType = req.file.mimetype;
    let processedFileName = req.file.originalname;
    try {
      processedData = await preprocessSignatureImage(req.file.buffer);
      processedContentType = 'image/png';
      processedFileName = `${req.file.originalname.replace(/\.(png|jpe?g)$/i, '') || 'hod-signature'}.png`;
    } catch {
      // Preserve the original image if preprocessing is unavailable for a valid upload.
    }

    const asset = await FileAsset.create({
      data: processedData,
      contentType: processedContentType,
      fileName: processedFileName,
      size: processedData.length,
    });

    const existing = await HODSignature.findOne({ department }).lean();
    const signature = await HODSignature.findOneAndUpdate(
      { department },
      {
        $set: {
          department,
          imageUrl: `/api/files/${asset._id}`,
          assetId: asset._id,
          contentType: processedContentType,
          fileName: processedFileName,
          size: processedData.length,
        },
      },
      { upsert: true, new: true, runValidators: true },
    ).lean();

    if (existing?.assetId && existing.assetId.toString() !== asset._id.toString()) {
      await FileAsset.findByIdAndDelete(existing.assetId).catch(() => {});
    }

    res.json({ success: true, data: { signature: serializeSignature(signature) } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteSignature = async (req, res) => {
  try {
    const department = normalizeKey(req.params.department);
    const departments = await getDatabaseDepartments();
    if (!departments.some(item => item.id === department)) {
      return res.status(400).json({ success: false, message: 'Invalid department.' });
    }

    const existing = await HODSignature.findOneAndDelete({ department }).lean();
    if (existing?.assetId) await FileAsset.findByIdAndDelete(existing.assetId).catch(() => {});
    res.json({ success: true, data: { signature: null } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
