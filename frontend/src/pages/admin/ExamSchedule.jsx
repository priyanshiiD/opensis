import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { Plus, Calendar, Trash2 } from 'lucide-react';

const BRANCHES = ['IT', 'CSE', 'ECE', 'ME', 'CE'];

export default function AdminExamSchedule() {
  const [schedules, setSchedules] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ session: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`, semester: 5, branch: 'IT', examType: 'end', entries: [{ subjectId: '', date: '', startTime: '', endTime: '', venue: '' }] });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const load = () => {
    Promise.all([
      api.get('/admin/exam-schedule').then(r => setSchedules(r.data.data.schedules)),
      api.get('/admin/subjects').then(r => setSubjects(r.data.data.subjects)),
    ]).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const updateEntry = (i, k, v) => {
    const entries = [...form.entries];
    entries[i] = { ...entries[i], [k]: v };
    setForm(f => ({ ...f, entries }));
  };
  const addEntry = () => setForm(f => ({ ...f, entries: [...f.entries, { subjectId: '', date: '', startTime: '', endTime: '', venue: '' }] }));
  const removeEntry = (i) => setForm(f => ({ ...f, entries: f.entries.filter((_, idx) => idx !== i) }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/admin/exam-schedule', form);
      toast.success('Exam schedule created!');
      setShowForm(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  const filteredSubjects = subjects.filter(s => s.branch === form.branch && s.semester === form.semester);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Exam Schedule</h1>
          <p className="text-slate-500 text-sm">{schedules.length} schedules</p>
        </div>
        <button onClick={() => setShowForm(s => !s)} className="btn-primary"><Plus className="w-4 h-4" />Create Schedule</button>
      </div>

      {showForm && (
        <div className="card mb-6">
          <h2 className="font-semibold text-slate-700 mb-4">New Exam Schedule</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div><label className="label">Session</label><input className="input" value={form.session} onChange={e => set('session', e.target.value)} placeholder="2026-2027" /></div>
              <div><label className="label">Branch</label>
                <select className="input" value={form.branch} onChange={e => set('branch', e.target.value)}>
                  {BRANCHES.map(b => <option key={b}>{b}</option>)}
                </select>
              </div>
              <div><label className="label">Semester</label>
                <select className="input" value={form.semester} onChange={e => set('semester', Number(e.target.value))}>
                  {[1,2,3,4,5,6,7,8].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div><label className="label">Type</label>
                <select className="input" value={form.examType} onChange={e => set('examType', e.target.value)}>
                  <option value="mid">Mid Semester</option>
                  <option value="end">End Semester</option>
                </select>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">Exam Entries</label>
                <button type="button" onClick={addEntry} className="text-xs text-primary-600 hover:underline">+ Add row</button>
              </div>
              <div className="space-y-2">
                {form.entries.map((entry, i) => (
                  <div key={i} className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
                    <div className="sm:col-span-2"><select className="input text-xs" value={entry.subjectId} onChange={e => updateEntry(i, 'subjectId', e.target.value)}>
                      <option value="">Select Subject</option>
                      {filteredSubjects.map(s => <option key={s._id} value={s._id}>{s.code} — {s.name}</option>)}
                    </select></div>
                    <div><input className="input text-xs" type="date" value={entry.date} onChange={e => updateEntry(i, 'date', e.target.value)} /></div>
                    <div className="flex gap-1">
                      <input className="input text-xs" type="time" value={entry.startTime} onChange={e => updateEntry(i, 'startTime', e.target.value)} placeholder="Start" />
                    </div>
                    <div className="flex gap-1 items-center">
                      <input className="input text-xs" placeholder="Venue" value={entry.venue} onChange={e => updateEntry(i, 'venue', e.target.value)} />
                      {form.entries.length > 1 && <button type="button" onClick={() => removeEntry(i)} className="text-red-400 hover:text-red-600 ml-1"><Trash2 className="w-4 h-4" /></button>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Create'}</button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-4">
        {loading ? <div className="card h-24 animate-pulse bg-slate-100" /> : schedules.length === 0 ? (
          <div className="card text-center py-10 text-slate-400"><Calendar className="w-10 h-10 mx-auto mb-2 text-slate-300" />No exam schedules yet</div>
        ) : (
          schedules.map(s => (
            <div key={s._id} className="card">
              <div className="flex items-center gap-3 mb-3">
                <span className="badge-indigo capitalize">{s.branch} Sem {s.semester}</span>
                <span className="badge-blue capitalize">{s.examType} Semester</span>
                <span className="text-xs text-slate-500 ml-auto">{s.session}</span>
              </div>
              <div className="space-y-2">
                {s.entries?.map((e, i) => (
                  <div key={i} className="flex items-center gap-4 text-sm p-2 rounded-lg bg-slate-50">
                    <span className="font-mono text-xs text-primary-600 w-16">{e.subjectId?.code}</span>
                    <span className="flex-1 text-slate-700">{e.subjectId?.name}</span>
                    <span className="text-slate-500">{e.date ? new Date(e.date).toLocaleDateString() : '—'}</span>
                    <span className="text-slate-500">{e.startTime} – {e.endTime}</span>
                    <span className="text-slate-500">{e.venue}</span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
