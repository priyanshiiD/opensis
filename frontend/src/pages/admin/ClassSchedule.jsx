import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { Plus, Calendar, Trash2 } from 'lucide-react';

const BRANCHES = ['IT', 'CSE', 'ECE', 'ME', 'CE'];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SLOTS = ['8:00-9:00', '9:00-10:00', '10:00-11:00', '11:00-12:00', '12:00-13:00', '14:00-15:00', '15:00-16:00', '16:00-17:00'];

export default function AdminClassSchedule() {
  const [schedules, setSchedules] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ session: '2024-25', semester: 5, branch: 'IT', section: 'A', timetable: [{ day: 'Monday', slot: '9:00-10:00', subjectId: '', facultyId: '', room: '' }] });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const load = () => {
    Promise.all([
      api.get('/admin/class-schedule').then(r => setSchedules(r.data.data.schedules)),
      api.get('/admin/subjects').then(r => setSubjects(r.data.data.subjects)),
      api.get('/admin/faculty').then(r => setFaculty(r.data.data.faculty)),
    ]).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const updateSlot = (i, k, v) => {
    const timetable = [...form.timetable];
    timetable[i] = { ...timetable[i], [k]: v };
    setForm(f => ({ ...f, timetable }));
  };
  const addSlot = () => setForm(f => ({ ...f, timetable: [...f.timetable, { day: 'Monday', slot: '9:00-10:00', subjectId: '', facultyId: '', room: '' }] }));
  const removeSlot = (i) => setForm(f => ({ ...f, timetable: f.timetable.filter((_, idx) => idx !== i) }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/admin/class-schedule', form);
      toast.success('Class schedule created!');
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
          <h1 className="text-2xl font-bold text-slate-800">Class Schedule</h1>
          <p className="text-slate-500 text-sm">{schedules.length} schedules</p>
        </div>
        <button onClick={() => setShowForm(s => !s)} className="btn-primary"><Plus className="w-4 h-4" />Create Schedule</button>
      </div>

      {showForm && (
        <div className="card mb-6">
          <h2 className="font-semibold text-slate-700 mb-4">New Class Schedule</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div><label className="label">Session</label><input className="input" value={form.session} onChange={e => set('session', e.target.value)} /></div>
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
              <div><label className="label">Section</label><input className="input" value={form.section} onChange={e => set('section', e.target.value)} /></div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">Timetable Slots</label>
                <button type="button" onClick={addSlot} className="text-xs text-primary-600 hover:underline">+ Add slot</button>
              </div>
              <div className="space-y-2">
                {form.timetable.map((slot, i) => (
                  <div key={i} className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
                    <div><select className="input text-xs" value={slot.day} onChange={e => updateSlot(i, 'day', e.target.value)}>
                      {DAYS.map(d => <option key={d}>{d}</option>)}
                    </select></div>
                    <div><select className="input text-xs" value={slot.slot} onChange={e => updateSlot(i, 'slot', e.target.value)}>
                      {SLOTS.map(s => <option key={s}>{s}</option>)}
                    </select></div>
                    <div><select className="input text-xs" value={slot.subjectId} onChange={e => updateSlot(i, 'subjectId', e.target.value)}>
                      <option value="">Subject</option>
                      {filteredSubjects.map(s => <option key={s._id} value={s._id}>{s.code}</option>)}
                    </select></div>
                    <div><select className="input text-xs" value={slot.facultyId} onChange={e => updateSlot(i, 'facultyId', e.target.value)}>
                      <option value="">Faculty</option>
                      {faculty.map(f => <option key={f._id} value={f._id}>{f.firstName} {f.lastName}</option>)}
                    </select></div>
                    <div className="flex gap-1 items-center">
                      <input className="input text-xs" placeholder="Room" value={slot.room} onChange={e => updateSlot(i, 'room', e.target.value)} />
                      {form.timetable.length > 1 && <button type="button" onClick={() => removeSlot(i)} className="text-red-400 hover:text-red-600 ml-1"><Trash2 className="w-4 h-4" /></button>}
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
          <div className="card text-center py-10 text-slate-400"><Calendar className="w-10 h-10 mx-auto mb-2 text-slate-300" />No class schedules yet</div>
        ) : (
          schedules.map(s => (
            <div key={s._id} className="card">
              <div className="flex items-center gap-3 mb-3">
                <span className="badge-indigo">{s.branch} Sem {s.semester}</span>
                <span className="badge-blue">Section {s.section}</span>
                <span className="text-xs text-slate-500 ml-auto">{s.session}</span>
              </div>
              <div className="space-y-1">
                {DAYS.map(day => {
                  const slots = s.timetable?.filter(t => t.day === day);
                  if (!slots?.length) return null;
                  return (
                    <div key={day} className="flex items-start gap-3 text-sm">
                      <span className="w-24 text-xs font-medium text-slate-500 pt-1 flex-shrink-0">{day}</span>
                      <div className="flex flex-wrap gap-2">
                        {slots.map((t, i) => (
                          <span key={i} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded">
                            {t.slot} · {t.subjectId?.code || '—'} · {t.facultyId ? `${t.facultyId.firstName} ${t.facultyId.lastName}` : '—'} · {t.room}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
