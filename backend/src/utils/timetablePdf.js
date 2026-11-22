const PDFDocument = require('pdfkit');
const slotConfig = require('../../../shared/timetableSlots.json');
const HODSignature = require('../models/HodSignature');
const FileAsset = require('../models/FileAsset');
const { departmentLabel } = require('../utils/departments');
const { preprocessSignatureImage } = require('./signatureImage');

const DAYS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
];
const ROWS = [1, 2, 3, 'lunch', 4, 5, 6, 7];
const YEAR_LABELS = ['', 'I', 'II', 'III', 'IV'];

const sectionLabel = section => {
  if (!section) return 'Section unavailable';
  return `${section.department || ''} ${YEAR_LABELS[section.year] || section.year || ''}-${section.sectionName || ''}`.trim();
};

const cleanFilenamePart = value => String(value || 'timetable').replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'timetable';
const entryStart = entry => Number(entry.startSlot || entry.slots?.[0]);
const entryEnd = entry => entryStart(entry) + Number(entry.slotCount || entry.slots?.length || 1) - 1;

function buildFacultySubjectSummary(entries) {
  const summary = new Map();
  const countedEntries = new Set();

  entries.forEach(entry => {
    const subjectId = String(entry.subject?._id || entry.subject || '').trim();
    if (!subjectId) return;
    const day = Number(entry.day);
    const startSlot = entryStart(entry);
    const slotCount = Number(entry.slotCount || entry.slots?.length || 1);
    const sectionId = String(entry.section?._id || entry.section || '').trim();
    const batch = entry.batch ? String(entry.batch) : '';
    const uniquenessKey = `${subjectId}|${day}|${startSlot}|${slotCount}|${sectionId}|${batch}`;
    if (countedEntries.has(uniquenessKey)) return;
    countedEntries.add(uniquenessKey);

    const key = subjectId;
    const current = summary.get(key) || {
      subjectId,
      name: entry.subject?.name || 'Subject unavailable',
      code: entry.subject?.code || '',
      hours: 0,
    };
    current.hours += slotCount;
    summary.set(key, current);
  });

  return [...summary.values()].sort((a, b) =>
    a.code.localeCompare(b.code) || a.name.localeCompare(b.name)
  );
}

function entryLines(entry, role, studentBatch) {
  const subjectCode = entry.subject?.code || '';
  const subjectName = entry.subject?.name || '';
  const subjectLabel = [subjectCode, subjectName].filter(Boolean).join(' · ') || 'Subject unavailable';
  const subject = `${entry.subject?.type === 'lab' ? '[LAB] ' : ''}${subjectLabel}`;
  const section = sectionLabel(entry.section);
  const room = entry.room?.name || (entry.room?.building && entry.room?.roomNo
    ? `${entry.room.building}-${entry.room.roomNo}`
    : 'Room unavailable');
  const batch = entry.batch ? `Batch: ${entry.batch}${role === 'student' && studentBatch && entry.batch === studentBatch ? ' (Your batch)' : ''}` : '';
  const secondLine = role === 'faculty'
    ? (entry.facultyNames && entry.facultyNames.length > 1 ? `${section} (Co: ${entry.facultyName})` : section)
    : (entry.facultyName || entry.faculty?.email || 'Faculty unavailable');
  return [subject, secondLine, batch, room].filter(Boolean);
}

function drawCell(doc, x, y, width, height, fill = '#ffffff') {
  doc.save().fillColor(fill).rect(x, y, width, height).fill().restore();
  doc.strokeColor('#cbd5e1').lineWidth(0.6).rect(x, y, width, height).stroke();
}

function drawEntry(doc, entry, x, y, width, height, role, studentBatch) {
  const isOtherStudentBatch = role === 'student' && entry.batch && studentBatch && entry.batch !== studentBatch;
  drawCell(doc, x, y, width, height, isOtherStudentBatch ? '#f8fafc' : '#eff6ff');
  const subjectCode = entry.subject?.code || '';
  const subjectName = entry.subject?.name || 'Subject unavailable';
  const labPrefix = entry.subject?.type === 'lab' ? '[LAB] ' : '';
  const section = sectionLabel(entry.section);
  const room = entry.room?.name || (entry.room?.building && entry.room?.roomNo
    ? `${entry.room.building}-${entry.room.roomNo}`
    : 'Room unavailable');
  const batch = entry.batch ? `Batch: ${entry.batch}${role === 'student' && studentBatch && entry.batch === studentBatch ? ' (Your batch)' : ''}` : '';
  const detail = role === 'faculty'
    ? (entry.facultyNames && entry.facultyNames.length > 1 ? `${section} · Co: ${entry.facultyName}` : section)
    : (entry.facultyName || entry.faculty?.email || 'Faculty unavailable');

  const padding = 5;
  const textWidth = Math.max(20, width - padding * 2);
  let cursorY = y + 5;

  doc.font('Helvetica-Bold').fontSize(width < 115 ? 7 : 8).fillColor('#1e3a8a')
    .text(`${labPrefix}${subjectCode}`, x + padding, cursorY, {
      width: textWidth,
      lineBreak: false,
      ellipsis: true,
    });
  cursorY += 10;

  doc.font('Helvetica-Bold').fontSize(width < 115 ? 7 : 7.5).fillColor('#1e293b')
    .text(subjectName, x + padding, cursorY, {
      width: textWidth,
      height: 22,
      lineBreak: true,
      wordSpacing: 0,
      characterSpacing: 0,
      ellipsis: true,
    });

  cursorY = y + 34;

  doc.font('Helvetica').fontSize(6.5).fillColor('#334155')
    .text(detail, x + padding, cursorY, {
      width: textWidth,
      height: 10,
      lineBreak: false,
      ellipsis: true,
    });
  cursorY += 9;

  if (batch) {
    doc.font('Helvetica').fontSize(6.5).fillColor('#475569')
      .text(batch, x + padding, cursorY, {
        width: textWidth,
        height: 10,
        lineBreak: false,
        ellipsis: true,
      });
    cursorY += 9;
  }

  doc.font('Helvetica').fontSize(6.5).fillColor('#475569')
    .text(room, x + padding, cursorY, {
      width: textWidth,
      height: Math.max(7, y + height - cursorY - 3),
      lineBreak: false,
      ellipsis: true,
    });
}

async function createTimetablePdf(response, { entries, role, headerName, section, studentBatch, academicYear, department, filename }) {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30, bufferPages: true });
  response.setHeader('Content-Type', 'application/pdf');
  response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(response);

  const pageWidth = doc.page.width - 60;
  const departmentName = departmentLabel(String(department || '').trim()) || String(department || '').trim();
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(16)
    .text(process.env.COLLEGE_NAME || 'Shri G. S. Institute of Technology & Science, Indore', { align: 'center' });
  if (departmentName) {
    doc.moveDown(0.2).font('Helvetica-Bold').fontSize(11).fillColor('#334155')
      .text(`Department of ${departmentName}`, { align: 'center' });
  }
  doc.moveDown(0.15).font('Helvetica-Bold').fontSize(11).fillColor('#1e293b')
    .text(role === 'student' ? `Student: ${headerName}` : `Faculty: ${headerName}`, { align: 'center' });
  doc.font('Helvetica').fontSize(9).fillColor('#475569')
    .text(role === 'student'
      ? `Section: ${sectionLabel(section)}  |  Academic Year: ${academicYear}`
      : `Academic Year: ${academicYear}`, { align: 'center' });

  const tableTop = doc.y + 12;
  const timeWidth = 92;
  const dayWidth = (pageWidth - timeWidth) / DAYS.length;
  const headerHeight = 27;
  const rowHeight = role === 'faculty' ? 48 : 50;
  const tableLeft = 30;

  drawCell(doc, tableLeft, tableTop, timeWidth, headerHeight, '#1e293b');
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8).text('Time', tableLeft + 5, tableTop + 9, { width: timeWidth - 10, align: 'center' });
  DAYS.forEach((day, index) => {
    const x = tableLeft + timeWidth + index * dayWidth;
    drawCell(doc, x, tableTop, dayWidth, headerHeight, '#1e293b');
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8).text(day.label, x + 4, tableTop + 9, { width: dayWidth - 8, align: 'center' });
  });

  const covered = new Set();
  let rowIndex = 0;
  ROWS.forEach(row => {
    const y = tableTop + headerHeight + rowIndex * rowHeight;
    if (row === 'lunch') {
      drawCell(doc, tableLeft, y, timeWidth, rowHeight, '#e2e8f0');
      doc.fillColor('#475569').font('Helvetica-Bold').fontSize(8).text('12:00 - 1:00', tableLeft + 4, y + 14, { width: timeWidth - 8, align: 'center' });
      drawCell(doc, tableLeft + timeWidth, y, pageWidth - timeWidth, rowHeight, '#e2e8f0');
      doc.fillColor('#64748b').font('Helvetica-Bold').fontSize(9).text('LUNCH', tableLeft + timeWidth, y + 14, { width: pageWidth - timeWidth, align: 'center' });
      rowIndex += 1;
      return;
    }

    const slot = slotConfig.slots[String(row)];
    drawCell(doc, tableLeft, y, timeWidth, rowHeight);
    doc.fillColor('#475569').font('Helvetica').fontSize(7).text(slot.label, tableLeft + 4, y + 14, { width: timeWidth - 8, align: 'center' });

    DAYS.forEach((day, dayIndex) => {
      const x = tableLeft + timeWidth + dayIndex * dayWidth;
      const key = `${day.value}-${row}`;
      if (covered.has(key)) return;
      const dayEntries = entries.filter(entry => Number(entry.day) === day.value && entryStart(entry) === row);
      const span = Math.max(1, ...dayEntries.map(entry => Number(entry.slotCount || entry.slots?.length || 1)));
      for (let next = row + 1; next < row + span; next += 1) covered.add(`${day.value}-${next}`);
      if (!dayEntries.length) {
        drawCell(doc, x, y, dayWidth, rowHeight);
      } else {
        const entryWidth = dayWidth / dayEntries.length;
        dayEntries.forEach((entry, entryIndex) => drawEntry(doc, entry, x + entryIndex * entryWidth, y, entryWidth, rowHeight * span, role, studentBatch));
      }
    });
    rowIndex += 1;
  });

  if (role === 'faculty') {
    const subjectSummary = buildFacultySubjectSummary(entries);
    if (subjectSummary.length) {
      const tableBottom = tableTop + headerHeight + ROWS.length * rowHeight;
      const summaryTop = tableBottom + 10;
      const summaryWidth = Math.min(650, doc.page.width - 60 - 150);
      const summaryX = tableLeft;
      const nameWidth = 330;
      const codeWidth = 150;
      const hoursWidth = summaryWidth - nameWidth - codeWidth;
      const summaryHeaderHeight = 20;
      const summaryRowHeight = 16;

      doc.font('Helvetica-Bold').fontSize(9).fillColor('#1e293b')
        .text('Subject-wise Weekly Teaching Hours', summaryX, summaryTop, {
          width: summaryWidth,
          lineBreak: false,
        });

      const headerY = summaryTop + 16;
      drawCell(doc, summaryX, headerY, nameWidth, summaryHeaderHeight, '#1e293b');
      drawCell(doc, summaryX + nameWidth, headerY, codeWidth, summaryHeaderHeight, '#1e293b');
      drawCell(doc, summaryX + nameWidth + codeWidth, headerY, hoursWidth, summaryHeaderHeight, '#1e293b');
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8)
        .text('Subject Name', summaryX + 5, headerY + 6, { width: nameWidth - 10, lineBreak: false });
      doc.text('Subject Code', summaryX + nameWidth + 5, headerY + 6, { width: codeWidth - 10, lineBreak: false });
      doc.text('Total Hours', summaryX + nameWidth + codeWidth + 5, headerY + 6, { width: hoursWidth - 10, lineBreak: false });

      subjectSummary.forEach((subject, index) => {
        const rowY = headerY + summaryHeaderHeight + index * summaryRowHeight;
        const fill = index % 2 === 0 ? '#ffffff' : '#f8fafc';
        drawCell(doc, summaryX, rowY, nameWidth, summaryRowHeight, fill);
        drawCell(doc, summaryX + nameWidth, rowY, codeWidth, summaryRowHeight, fill);
        drawCell(doc, summaryX + nameWidth + codeWidth, rowY, hoursWidth, summaryRowHeight, fill);
        doc.fillColor('#334155').font('Helvetica').fontSize(8)
          .text(subject.name, summaryX + 5, rowY + 4, { width: nameWidth - 10, height: summaryRowHeight - 6, ellipsis: true });
        doc.text(subject.code || '—', summaryX + nameWidth + 5, rowY + 4, { width: codeWidth - 10, height: summaryRowHeight - 6, ellipsis: true });
        doc.text(`${subject.hours} ${subject.hours === 1 ? 'Hour' : 'Hours'}`, summaryX + nameWidth + codeWidth + 5, rowY + 4, { width: hoursWidth - 10, height: summaryRowHeight - 6, ellipsis: true });
      });
    }
  }

  const signatureDepartment = String(department || '').trim();
  if (signatureDepartment) {
    try {
      const signature = await HODSignature.findOne({ department: signatureDepartment }).lean();
      if (signature?.assetId) {
        const asset = await FileAsset.findById(signature.assetId);
        if (asset?.data) {
          let imageData = asset.data;
          try {
            imageData = await preprocessSignatureImage(asset.data);
          } catch {
            // Use the original asset if it cannot be decoded by the image processor.
          }
          const signatureWidth = 120;
          const signatureHeight = 30;
          const signatureX = doc.page.width - 30 - signatureWidth;
          const signatureImageY = doc.page.height - 77;
          doc.save();
          doc.image(imageData, signatureX, signatureImageY, {
            fit: [signatureWidth, signatureHeight],
            align: 'center',
            valign: 'center',
          });
          doc.restore();
          doc.font('Helvetica-Bold').fontSize(8).fillColor('#1e293b')
            .text('Signature of HOD', signatureX, doc.page.height - 45, { width: signatureWidth, align: 'center', lineBreak: false });
        }
      }
    } catch {
      // A missing or unreadable optional signature must not break PDF downloads.
    }
  }

  doc.end();
}

module.exports = { createTimetablePdf, cleanFilenamePart, buildFacultySubjectSummary };
