import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { Plus, BookOpen } from 'lucide-react';

const BRANCHES = ['IT', 'CSE', 'ECE', 'ME', 'CE'];

export default function AdminSubjects() {
  const [subjects, setSubjects] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', branch: 'IT', semester: 1, credits: 3, facultyId: '' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const load = () => {
    Promise.all([
      api.get('/admin/subjects').then(r => setSubjects(r.data.data.subjects)),
      api.get('/admin/faculty').then(r => setFaculty(r.data.data.faculty)),
    ]).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/admin/subjects', form);
      toast.success('Subject created!');
      setShowForm(false);
      setForm({ code: '', name: '', branch: 'IT', semester: 1, credits: 3, facultyId: '' });
      load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Subjects</h1>
          <p className="text-slate-500 text-sm">{subjects.length} total</p>
        </div>
        <button onClick={() => setShowForm(s => !s)} className="btn-primary"><Plus className="w-4 h-4" />Add Subject</button>
      </div>

      {showForm && (
        <div className="card mb-6">
          <h2 className="font-semibold text-slate-700 mb-4">New Subject</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div><label className="label">Code *</label><input className="input font-mono uppercase" value={form.code} onChange={e => set('code', e.target.value)} required placeholder="IT501" /></div>
            <div className="sm:col-span-2"><label className="label">Name *</label><input className="input" value={form.name} onChange={e => set('name', e.target.value)} required /></div>
            <div><label className="label">Branch *</label>
              <select className="input" value={form.branch} onChange={e => set('branch', e.target.value)}>
                {BRANCHES.map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
            <div><label className="label">Semester *</label>
              <select className="input" value={form.semester} onChange={e => set('semester', Number(e.target.value))}>
                {[1,2,3,4,5,6,7,8].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div><label className="label">Credits</label><input className="input" type="number" min={1} max={6} value={form.credits} onChange={e => set('credits', Number(e.target.value))} /></div>
            <div className="sm:col-span-3"><label className="label">Assign Faculty</label>
              <select className="input" value={form.facultyId} onChange={e => set('facultyId', e.target.value)}>
                <option value="">— None —</option>
                {faculty.map(f => <option key={f._id} value={f._id}>{f.firstName} {f.lastName} ({f.department})</option>)}
              </select>
            </div>
            <div className="sm:col-span-3 flex gap-3">
              <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Create Subject'}</button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Code', 'Name', 'Branch', 'Semester', 'Credits', 'Faculty'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    {[...Array(6)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>)}
                  </tr>
                ))
              ) : subjects.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-slate-400">No subjects yet</td></tr>
              ) : (
                subjects.map(s => (
                  <tr key={s._id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono font-semibold text-primary-600">{s.code}</td>
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-4 py-3"><span className="badge-blue">{s.branch}</span></td>
                    <td className="px-4 py-3">Sem {s.semester}</td>
                    <td className="px-4 py-3">{s.credits} cr.</td>
                    <td className="px-4 py-3 text-slate-600">
                      {s.facultyId ? `${s.facultyId.firstName} ${s.facultyId.lastName}` : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
