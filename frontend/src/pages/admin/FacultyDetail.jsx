import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../api/axios';
import { ArrowLeft, User, Pencil, Calendar, X, Trash2 } from 'lucide-react';
import { getDepartmentLabel } from '../../constants/departments';
import TimetableGrid from '../../components/TimetableGrid';
import timetableSlots from '../../../../shared/timetableSlots.json';

function Field({ label, value }) {
  return (
    <div>
      <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">{label}</p>
      <p className="text-sm text-slate-800 mt-0.5 break-all">{value || '—'}</p>
    </div>
  );
}

export default function FacultyDetail() {
  const { id } = useParams();
  const [faculty, setFaculty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timetableOpen, setTimetableOpen] = useState(false);
  const [timetableLoading, setTimetableLoading] = useState(false);
  const [timetableEntries, setTimetableEntries] = useState([]);
  const [timetableOptions, setTimetableOptions] = useState({ subjects: [], rooms: [], faculty: [] });
  const [timetableSections, setTimetableSections] = useState([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [saving, setSaving] = useState(false);
  const [conflicts, setConflicts] = useState([]);
  const [timetableAcademicYear, setTimetableAcademicYear] = useState('');
  const [timetableSemester, setTimetableSemester] = useState('');
  const [form, setForm] = useState({
    section: '', subject: '', faculty: '', room: '', batch: '', day: 1, startSlot: 1,
  });

  useEffect(() => {
    api.get(`/admin/faculty/${id}`).then(r => setFaculty(r.data.data.faculty)).finally(() => setLoading(false));
  }, [id]);

  const loadFacultyTimetable = async () => {
    if (!faculty?.userId) return;
    const facultyUserId = faculty.userId._id || faculty.userId;
    setTimetableLoading(true);
    try {
      const [timetableRes, optionsRes, sectionsRes] = await Promise.all([
        api.get(`/timetable/faculty/${facultyUserId}`),
        api.get('/timetable/options'),
        api.get('/timetable/admin/sections'),
      ]);
      setTimetableEntries(timetableRes.data.data.entries || []);
      setTimetableAcademicYear(timetableRes.data.data.selectedAcademicYear || '');
      setTimetableSemester(timetableRes.data.data.selectedSemester ? String(timetableRes.data.data.selectedSemester) : '');
      setTimetableOptions(optionsRes.data.data);
      setTimetableSections(sectionsRes.data.data.sections || []);
    } catch (error) {
      setConflicts([error.response?.data?.message || 'Failed to load faculty timetable']);
    } finally {
      setTimetableLoading(false);
    }
  };

  const openTimetable = async () => {
    setTimetableOpen(true);
    await loadFacultyTimetable();
  };

  const openCreate = (day = 1, startSlot = 1) => {
    setEditingEntry(null);
    setConflicts([]);
    setForm({
      section: '',
      subject: '',
      faculty: (faculty.userId._id || faculty.userId),
      room: '',
      batch: '',
      day,
      startSlot,
    });
    setEditorOpen(true);
  };

  const openEdit = entry => {
    setEditingEntry(entry);
    setConflicts([]);
    setForm({
      section: entry.section?._id || entry.section || '',
      subject: entry.subject?._id || entry.subject || '',
      faculty: entry.faculties?.length ? (entry.faculties[0]._id || entry.faculties[0]) : (entry.faculty?._id || entry.faculty || ''),
      room: entry.room?._id || entry.room || '',
      batch: entry.batch || '',
      day: entry.day,
      startSlot: entry.startSlot || entry.slots?.[0] || 1,
    });
    setEditorOpen(true);
  };

  const selectedSubject = timetableOptions.subjects.find(subject => String(subject._id) === String(form.subject));
  const isLab = selectedSubject?.type === 'lab';
  const selectedSection = timetableSections.find(section => String(section._id) === String(form.section));

  const previewAndSave = async event => {
    event?.preventDefault();
    setSaving(true);
    setConflicts([]);
    try {
      const subjectType = selectedSubject?.subjectType || (editingEntry?.subjectType) || 'Subject';
      const sectionSemester = selectedSection
        ? (Number(selectedSection.year) === 1 ? 1 : Number(selectedSection.year) === 2 ? 3 : Number(selectedSection.year) === 3 ? 5 : 7)
        : null;
      const payload = {
        section: form.section,
        subject: form.subject,
        subjectType,
        faculty: form.faculty,
        faculties: isLab ? [form.faculty] : [form.faculty],
        room: form.room,
        batch: isLab ? (form.batch || null) : null,
        day: Number(form.day),
        startSlot: Number(form.startSlot),
        slotCount: isLab ? 2 : 1,
        academicYear: editingEntry?.academicYear || timetableEntries[0]?.academicYear || timetableAcademicYear,
        semester: Number(editingEntry?.semester || timetableSemester || sectionSemester || 1),
      };

      if (!payload.academicYear) throw new Error('Select or add an entry with an academic year first.');
      if (editingEntry) await api.put(`/timetable/${editingEntry._id}`, payload);
      else await api.post('/timetable', { entries: [payload] });
      setEditorOpen(false);
      await loadFacultyTimetable();
    } catch (error) {
      const serverErrors = error.response?.data?.errors || [];
      setConflicts(serverErrors.length
        ? serverErrors.map(item => item.message)
        : [error.response?.data?.message || error.message || 'Failed to save timetable entry']);
    } finally {
      setSaving(false);
    }
  };

  const deleteEntry = async () => {
    if (!editingEntry || !window.confirm('Delete this timetable entry?')) return;
    setSaving(true);
    try {
      await api.delete(`/timetable/${editingEntry._id}`);
      setEditorOpen(false);
      await loadFacultyTimetable();
    } catch (error) {
      setConflicts([error.response?.data?.message || 'Failed to delete timetable entry']);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>;
  if (!faculty) return <p className="text-slate-400 text-center py-10">Faculty not found</p>;

  const assignedItems = (faculty.assignedItems && faculty.assignedItems.length > 0)
    ? faculty.assignedItems
    : (faculty.subjectsTaught || []).map(item => ({
        itemId: item._id,
        itemType: 'class',
        code: item.code,
        name: item.name,
      }));

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/admin/faculty" className="text-slate-400 hover:text-slate-600"><ArrowLeft className="w-5 h-5" /></Link>
        <h1 className="text-2xl font-bold text-slate-800">Faculty Profile</h1>
        <Link to={`/admin/faculty/${id}/edit`} className="ml-auto btn-secondary flex items-center gap-2">
          <Pencil className="w-4 h-4" />Edit Details
        </Link>
      </div>

      <div className="card mb-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center">
            <User className="w-8 h-8 text-primary-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-800">{[faculty.namePrefix, faculty.firstName, faculty.lastName].filter(Boolean).join(' ')}</h2>
            <p className="text-slate-500 text-sm">{faculty.designation || 'Faculty'}</p>
            <p className="text-slate-400 text-xs mt-0.5">{faculty.email || '—'}</p>
          </div>
          <span className="ml-auto badge-indigo">{getDepartmentLabel(faculty.department)}</span>
        </div>
      </div>

      <button type="button" onClick={openTimetable} className="btn-primary mb-4 flex items-center gap-2">
        <Calendar className="h-4 w-4" />
        View &amp; Manage Timetable
      </button>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="font-semibold text-slate-700 mb-4">Details</h3>
          <div className="space-y-3">
            <Field label="Employee ID" value={faculty.employeeId} />
            <Field label="Email" value={faculty.email} />
            <Field label="Phone" value={faculty.phone} />
            <Field label="Qualification" value={faculty.qualification} />
            <Field label="Joining Date" value={faculty.joiningDate ? new Date(faculty.joiningDate).toLocaleDateString() : null} />
            <Field label="Address" value={faculty.address} />
          </div>
        </div>
        <div className="card">
          <h3 className="font-semibold text-slate-700 mb-1">Subjects &amp; Labs Taught</h3>
          <p className="text-xs text-slate-400 mb-4">Current session and term</p>
          {assignedItems.length === 0 ? (
            <p className="text-slate-400 text-sm">No subjects assigned</p>
          ) : (
            <div className="space-y-2">
              {assignedItems.map(s => (
                <div key={`${s.itemType}:${s.itemId || s._id}`} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                  <span className={s.itemType === 'lab'
                    ? 'inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide uppercase bg-emerald-50 text-emerald-600 border border-emerald-100'
                    : 'badge-blue text-xs'}>{s.code}</span>
                  <span className="text-sm text-slate-700">{s.name}</span>
                  <span className="ml-auto text-[10px] uppercase tracking-wide text-slate-400">{s.itemType === 'lab' ? 'Lab' : 'Theory'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {timetableOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true">
          <div className="max-h-[92vh] w-full max-w-[1180px] overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-800">
                  {faculty.firstName} {faculty.lastName} - Timetable
                </h2>
                <p className="text-sm text-slate-500">
                  {timetableAcademicYear || 'All academic years'}{timetableSemester ? ` · Semester ${timetableSemester}` : ''}
                </p>
              </div>
              <button type="button" onClick={() => setTimetableOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            {conflicts.length > 0 && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {conflicts.map((message, index) => <p key={index}>{message}</p>)}
              </div>
            )}

            {timetableLoading ? (
              <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" /></div>
            ) : (
              <TimetableGrid
                entries={timetableEntries}
                mode="admin"
                onEmptyCell={openCreate}
                onEntryClick={openEdit}
              />
            )}

            {editorOpen && (
              <form onSubmit={previewAndSave} className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
                <label className="label">
                  Section
                  <select required className="input mt-1" value={form.section} onChange={event => setForm(current => ({ ...current, section: event.target.value }))}>
                    <option value="">Select section</option>
                    {timetableSections.map(section => (
                      <option key={section._id} value={section._id}>{getDepartmentLabel(section.department)} · Year {section.year} · Section {section.sectionName}</option>
                    ))}
                  </select>
                </label>
                <label className="label">
                  Subject
                  <select required className="input mt-1" value={form.subject} onChange={event => setForm(current => ({ ...current, subject: event.target.value }))}>
                    <option value="">Select subject</option>
                    {timetableOptions.subjects
                      .filter(subject => !subject.branch || subject.branch === selectedSection?.department)
                      .map(subject => (
                        <option key={`${subject.subjectType}-${subject._id}`} value={subject._id}>{subject.type === 'lab' ? '[LAB] ' : ''}{subject.code} · {subject.name}</option>
                      ))}
                  </select>
                </label>
                <label className="label">
                  Faculty
                  <select required className="input mt-1" value={form.faculty} onChange={event => setForm(current => ({ ...current, faculty: event.target.value }))}>
                    {timetableOptions.faculty.map(item => (
                      <option key={item._id} value={item._id}>{item.name}</option>
                    ))}
                  </select>
                </label>
                <label className="label">
                  Room
                  <select required className="input mt-1" value={form.room} onChange={event => setForm(current => ({ ...current, room: event.target.value }))}>
                    <option value="">Select room</option>
                    {timetableOptions.rooms.map(room => (
                      <option key={room._id} value={room._id}>{room.name || `${room.building}-${room.roomNo}`}</option>
                    ))}
                  </select>
                </label>
                {isLab && (
                  <label className="label">
                    Batch
                    <select required className="input mt-1" value={form.batch} onChange={event => setForm(current => ({ ...current, batch: event.target.value }))}>
                      <option value="">Select batch</option>
                      {(selectedSection?.batches || []).map(batch => <option key={batch} value={batch}>{batch}</option>)}
                    </select>
                  </label>
                )}
                <label className="label">
                  Day
                  <select className="input mt-1" value={form.day} onChange={event => setForm(current => ({ ...current, day: Number(event.target.value) }))}>
                    {[['1', 'Monday'], ['2', 'Tuesday'], ['3', 'Wednesday'], ['4', 'Thursday'], ['5', 'Friday']].map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
                <label className="label">
                  Start time
                  <select className="input mt-1" value={form.startSlot} onChange={event => setForm(current => ({ ...current, startSlot: Number(event.target.value) }))}>
                    {[1, 2, 3, 4, 5, 6, 7].map(slot => (
                      <option key={slot} value={slot}>{timetableSlots.slots[String(slot)].label}</option>
                    ))}
                  </select>
                </label>
                {conflicts.length > 0 && (
                  <div className="sm:col-span-2 rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">
                    {conflicts.map((message, index) => <p key={index}>{message}</p>)}
                  </div>
                )}
                <div className="sm:col-span-2 flex justify-end gap-2">
                  {editingEntry && (
                    <button type="button" onClick={deleteEntry} disabled={saving} className="btn-danger flex items-center gap-2">
                      <Trash2 className="h-4 w-4" />Delete
                    </button>
                  )}
                  <button type="button" onClick={() => setEditorOpen(false)} className="btn-secondary">Cancel</button>
                  <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save'}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
