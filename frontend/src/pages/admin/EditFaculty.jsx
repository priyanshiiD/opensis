import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { ArrowLeft, BookOpen } from 'lucide-react';

const DEPARTMENTS = ['IT', 'CSE', 'ECE', 'ME', 'CE'];

export default function EditFaculty() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [subjectIds, setSubjectIds] = useState([]);
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const isInitialSubjectLoad = useRef(true);

  useEffect(() => {
    api.get(`/admin/faculty/${id}`).then(r => {
      const f = r.data.data.faculty;
      setForm({
        firstName: f.firstName || '',
        lastName: f.lastName || '',
        phone: f.phone || '',
        address: f.address || '',
        department: f.department || 'IT',
        designation: f.designation || '',
        qualification: f.qualification || '',
        joiningDate: f.joiningDate ? f.joiningDate.slice(0, 10) : '',
      });
      const assignedIds = (f.subjectsTaught || []).map(s => (typeof s === 'object' ? s._id : s));
      setSubjectIds(assignedIds);
    }).finally(() => setLoading(false));
  }, [id]);

  // Reload subjects when department changes; clear selection only on explicit dept change (not initial load)
  useEffect(() => {
    if (!form) return;
    if (!isInitialSubjectLoad.current) setSubjectIds([]);
    isInitialSubjectLoad.current = false;
    setLoadingSubjects(true);
    api.get(`/admin/subjects?branch=${form.department}`)
      .then(r => setAvailableSubjects(r.data.data.subjects))
      .finally(() => setLoadingSubjects(false));
  }, [form?.department]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const toggleSubject = (sid) => {
    setSubjectIds(prev =>
      prev.includes(sid) ? prev.filter(s => s !== sid) : [...prev, sid]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/admin/faculty/${id}`, { ...form, subjectIds });
      toast.success('Faculty updated successfully!');
      navigate(`/admin/faculty/${id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link to={`/admin/faculty/${id}`} className="text-slate-400 hover:text-slate-600"><ArrowLeft className="w-5 h-5" /></Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Edit Faculty</h1>
          <p className="text-slate-500 text-sm">Email and Employee ID cannot be changed here</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card">
          <h2 className="font-semibold text-slate-700 mb-4">Personal Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="label">First Name *</label><input className="input" value={form.firstName} onChange={e => set('firstName', e.target.value)} required /></div>
            <div><label className="label">Last Name *</label><input className="input" value={form.lastName} onChange={e => set('lastName', e.target.value)} required /></div>
            <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
            <div className="sm:col-span-2"><label className="label">Address</label><textarea className="input resize-none h-16" value={form.address} onChange={e => set('address', e.target.value)} /></div>
          </div>
        </div>

        <div className="card">
          <h2 className="font-semibold text-slate-700 mb-4">Professional Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Department *</label>
              <select className="input" value={form.department} onChange={e => set('department', e.target.value)}>
                {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div><label className="label">Designation</label><input className="input" value={form.designation} onChange={e => set('designation', e.target.value)} placeholder="e.g. Associate Professor" /></div>
            <div><label className="label">Qualification</label><input className="input" value={form.qualification} onChange={e => set('qualification', e.target.value)} placeholder="e.g. M.Tech, Ph.D" /></div>
            <div><label className="label">Joining Date</label><input className="input" type="date" value={form.joiningDate} onChange={e => set('joiningDate', e.target.value)} /></div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="w-4 h-4 text-primary-600" />
            <h2 className="font-semibold text-slate-700">Assigned Subjects</h2>
            {subjectIds.length > 0 && (
              <span className="ml-auto text-xs bg-primary-100 text-primary-700 font-semibold px-2 py-0.5 rounded-full">
                {subjectIds.length} selected
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Showing subjects from <strong>{form.department}</strong>. Change department above to see others.
          </p>

          {loadingSubjects ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse" />)}
            </div>
          ) : availableSubjects.length === 0 ? (
            <p className="text-sm text-slate-400 italic">No subjects found for {form.department}.</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {availableSubjects.map(s => {
                const checked = subjectIds.includes(s._id);
                const otherFaculty = s.facultyId && String(s.facultyId._id || s.facultyId) !== id && !checked;
                return (
                  <label
                    key={s._id}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      checked
                        ? 'border-primary-400 bg-primary-50'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="accent-primary-600 w-4 h-4 shrink-0"
                      checked={checked}
                      onChange={() => toggleSubject(s._id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-primary-600">{s.code}</span>
                        <span className="text-sm font-medium text-slate-700 truncate">{s.name}</span>
                        <span className="text-xs text-slate-400 ml-auto shrink-0">Sem {s.semester} · {s.credits} cr.</span>
                      </div>
                      {otherFaculty && (
                        <p className="text-xs text-amber-600 mt-0.5">
                          Currently: {s.facultyId.firstName} {s.facultyId.lastName}
                        </p>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save Changes'}</button>
          <Link to={`/admin/faculty/${id}`} className="btn-secondary">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
