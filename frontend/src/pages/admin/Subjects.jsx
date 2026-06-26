import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';

const BRANCHES = ['IT', 'CSE', 'ECE', 'ME', 'CE'];
const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];

const EMPTY_FORM = { code: '', name: '', branch: 'IT', semester: 1, credits: 3 };

export default function AdminSubjects() {
  const [subjects, setSubjects] = useState([]);
  const [allFaculty, setAllFaculty] = useState([]);
  const [loading, setLoading] = useState(true);

  // filters
  const [filterBranch, setFilterBranch] = useState('');
  const [filterSem, setFilterSem] = useState('');

  // add form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // inline edit
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);

  // delete
  const [deletingId, setDeletingId] = useState(null);

  const loadSubjects = (branch = filterBranch, sem = filterSem) => {
    const params = new URLSearchParams();
    if (branch) params.set('branch', branch);
    if (sem) params.set('semester', sem);
    return api.get(`/admin/subjects?${params}`).then(r => setSubjects(r.data.data.subjects));
  };

  useEffect(() => {
    Promise.all([
      loadSubjects(),
      api.get('/admin/faculty').then(r => setAllFaculty(r.data.data.faculty)),
    ]).finally(() => setLoading(false));
  }, []);

  const handleFilterChange = (branch, sem) => {
    setFilterBranch(branch);
    setFilterSem(sem);
    loadSubjects(branch, sem);
  };

  // ── Add ──────────────────────────────────────────
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/admin/subjects', form);
      toast.success('Subject created!');
      setShowForm(false);
      setForm(EMPTY_FORM);
      loadSubjects();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  // ── Edit ─────────────────────────────────────────
  const startEdit = (s) => {
    setEditId(s._id);
    setEditForm({ name: s.name, credits: s.credits, facultyId: s.facultyId?._id || '' });
  };

  const cancelEdit = () => { setEditId(null); setEditForm({}); };

  const handleEdit = async (id) => {
    setEditSaving(true);
    try {
      await api.patch(`/admin/subjects/${id}`, editForm);
      toast.success('Subject updated!');
      cancelEdit();
      loadSubjects();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally {
      setEditSaving(false);
    }
  };

  // ── Delete ───────────────────────────────────────
  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await api.delete(`/admin/subjects/${id}`);
      toast.success('Subject deleted');
      setSubjects(prev => prev.filter(s => s._id !== id));
    } catch {
      toast.error('Delete failed');
    } finally {
      setDeletingId(null);
    }
  };

  const facultyForBranch = filterBranch
    ? allFaculty.filter(f => f.department === filterBranch)
    : allFaculty;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Subjects</h1>
          <p className="text-slate-500 text-sm">{subjects.length} shown</p>
        </div>
        <button onClick={() => setShowForm(s => !s)} className="btn-primary">
          <Plus className="w-4 h-4" />Add Subject
        </button>
      </div>

      {/* ── Add form ── */}
      {showForm && (
        <div className="card mb-6">
          <h2 className="font-semibold text-slate-700 mb-4">New Subject</h2>
          <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label">Code *</label>
              <input className="input font-mono uppercase" value={form.code} onChange={e => set('code', e.target.value)} required placeholder="IT501" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Name *</label>
              <input className="input" value={form.name} onChange={e => set('name', e.target.value)} required placeholder="Data Structures & Algorithms" />
            </div>
            <div>
              <label className="label">Branch *</label>
              <select className="input" value={form.branch} onChange={e => set('branch', e.target.value)}>
                {BRANCHES.map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Semester *</label>
              <select className="input" value={form.semester} onChange={e => set('semester', Number(e.target.value))}>
                {SEMESTERS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Credits</label>
              <input className="input" type="number" min={1} max={6} value={form.credits} onChange={e => set('credits', Number(e.target.value))} />
            </div>
            <div className="sm:col-span-3 flex gap-3">
              <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Creating...' : 'Create Subject'}</button>
              <button type="button" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }} className="btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* ── Filters ── */}
      <div className="card mb-4">
        <div className="flex flex-wrap gap-3">
          <select className="input w-auto" value={filterBranch} onChange={e => handleFilterChange(e.target.value, filterSem)}>
            <option value="">All Branches</option>
            {BRANCHES.map(b => <option key={b}>{b}</option>)}
          </select>
          <select className="input w-auto" value={filterSem} onChange={e => handleFilterChange(filterBranch, e.target.value)}>
            <option value="">All Semesters</option>
            {SEMESTERS.map(s => <option key={s} value={s}>Sem {s}</option>)}
          </select>
          {(filterBranch || filterSem) && (
            <button onClick={() => handleFilterChange('', '')} className="text-xs text-slate-500 hover:text-slate-700 underline">Clear filters</button>
          )}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Code', 'Name', 'Branch', 'Sem', 'Credits', 'Assigned Faculty', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    {[...Array(7)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>)}
                  </tr>
                ))
              ) : subjects.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-slate-400">No subjects found</td></tr>
              ) : (
                subjects.map(s => {
                  const isEditing = editId === s._id;
                  return (
                    <tr key={s._id} className={`border-b border-slate-100 ${isEditing ? 'bg-primary-50' : 'hover:bg-slate-50'}`}>
                      <td className="px-4 py-3 font-mono font-semibold text-primary-600">{s.code}</td>

                      {/* Name — editable */}
                      <td className="px-4 py-3">
                        {isEditing
                          ? <input className="input py-1 text-sm" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                          : <span className="font-medium">{s.name}</span>
                        }
                      </td>

                      <td className="px-4 py-3"><span className="badge-blue">{s.branch}</span></td>
                      <td className="px-4 py-3">Sem {s.semester}</td>

                      {/* Credits — editable */}
                      <td className="px-4 py-3">
                        {isEditing
                          ? <input className="input py-1 text-sm w-16" type="number" min={1} max={6} value={editForm.credits} onChange={e => setEditForm(f => ({ ...f, credits: Number(e.target.value) }))} />
                          : `${s.credits} cr.`
                        }
                      </td>

                      {/* Faculty — editable */}
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <select className="input py-1 text-sm" value={editForm.facultyId} onChange={e => setEditForm(f => ({ ...f, facultyId: e.target.value }))}>
                            <option value="">— Unassigned —</option>
                            {facultyForBranch.map(f => (
                              <option key={f._id} value={f._id}>{f.firstName} {f.lastName} · {f.department}</option>
                            ))}
                          </select>
                        ) : (
                          <span className={s.facultyId ? 'text-slate-700' : 'text-slate-400 italic'}>
                            {s.facultyId ? `${s.facultyId.firstName} ${s.facultyId.lastName}` : 'Unassigned'}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <button onClick={() => handleEdit(s._id)} disabled={editSaving} className="text-primary-600 hover:text-primary-700" title="Save">
                              <Check className="w-4 h-4" />
                            </button>
                            <button onClick={cancelEdit} className="text-slate-400 hover:text-slate-600" title="Cancel">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <button onClick={() => startEdit(s)} className="text-slate-500 hover:text-slate-700" title="Edit">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(s._id)}
                              disabled={deletingId === s._id}
                              className="text-red-400 hover:text-red-600 disabled:opacity-40"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
