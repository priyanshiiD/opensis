import React, { useEffect, useMemo, useRef, useState } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import {
  Bell, Pin, Plus, Trash2, Edit2, X, Paperclip, CalendarDays, Users,
  Megaphone, Inbox, Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';

const resolveAssetUrl = (value) => {
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  const base = (import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/, '');
  return `${base}${value}`;
};

const emptyForm = {
  title: '',
  body: '',
  category: '',
  eventDate: '',
  audienceMode: 'selected',
  assignmentIds: [],
  isPinned: false,
};

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const noticeAudienceLabel = (notice) => {
  if (notice.audienceSummary) return notice.audienceSummary;
  if (notice.audience === 'students') return 'Students';
  if (notice.audience === 'faculty') return 'Faculty';
  return 'Everyone';
};

export default function FacultyNotices() {
  const { selectedSession, selectedTerm } = useAuth();
  const [tab, setTab] = useState('mine');
  const [mine, setMine] = useState([]);
  const [inbox, setInbox] = useState([]);
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);
  const formRef = useRef(null);

  const loadMine = async () => {
    const { data } = await api.get('/faculty/notices/mine');
    setMine(data.data.notices || []);
  };

  const loadOptions = async () => {
    try {
      const { data } = await api.get('/faculty/notices/audiences');
      setOptions(data.data.options || []);
    } catch {
      setOptions([]);
    }
  };

  const loadInbox = async () => {
    setInboxLoading(true);
    try {
      const { data } = await api.get('/faculty/notices');
      setInbox(data.data.notices || []);
      api.post('/faculty/notices/mark-read', {}).catch(() => {});
    } finally {
      setInboxLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    Promise.all([loadMine(), loadOptions()])
      .catch(() => {
        if (active) toast.error('Failed to load notices');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [selectedSession, selectedTerm]);

  useEffect(() => {
    if (tab === 'inbox') loadInbox();
  }, [tab]);

  const selectedCount = form.assignmentIds.length;
  const allClasses = form.audienceMode === 'all-my-classes';
  const groupedOptions = useMemo(() => {
    const groups = new Map();
    options.forEach((option) => {
      const key = `${option.branch}|${option.semester}|${option.section}`;
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          label: `${option.branch} · Semester ${option.semester} · ${option.sectionLabel}`,
          options: [],
        });
      }
      groups.get(key).options.push(option);
    });
    return [...groups.values()];
  }, [options]);

  const startCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const startEdit = (notice) => {
    setEditingId(notice._id);
    setForm({
      title: notice.title || '',
      body: notice.body || '',
      category: notice.category || '',
      eventDate: notice.eventDate ? String(notice.eventDate).slice(0, 10) : '',
      audienceMode: notice.audienceMode
        || ((notice.audienceTargets || []).length > 0 ? 'selected' : 'all-my-classes'),
      assignmentIds: (notice.audienceTargets || []).map((target) => String(target.assignmentId)),
      isPinned: Boolean(notice.isPinned),
    });
    setShowForm(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    if (fileRef.current) fileRef.current.value = '';
  };

  const toggleAssignment = (assignmentId) => {
    setForm((current) => ({
      ...current,
      assignmentIds: current.assignmentIds.includes(assignmentId)
        ? current.assignmentIds.filter((id) => id !== assignmentId)
        : [...current.assignmentIds, assignmentId],
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.title.trim() || !form.body.trim()) {
      return toast.error('Title and description are required.');
    }
    if (form.audienceMode === 'selected' && form.assignmentIds.length === 0) {
      return toast.error('Select at least one class/section, or choose All My Classes.');
    }
    setSaving(true);
    try {
      const payload = new FormData();
      payload.append('title', form.title.trim());
      payload.append('body', form.body.trim());
      payload.append('category', form.category.trim());
      payload.append('eventDate', form.eventDate);
      payload.append('audienceMode', form.audienceMode);
      payload.append('assignmentIds', JSON.stringify(form.assignmentIds));
      payload.append('isPinned', form.isPinned ? 'true' : 'false');
      if (fileRef.current?.files?.[0]) payload.append('attachment', fileRef.current.files[0]);

      if (editingId) {
        await api.put(`/faculty/notices/${editingId}`, payload, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        toast.success('Notice updated');
      } else {
        await api.post('/faculty/notices', payload, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        toast.success('Notice published to selected classes');
      }
      cancelForm();
      await loadMine();
      setTab('mine');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save notice');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (notice) => {
    if (!window.confirm('Delete this notice? Students will no longer be able to see it.')) return;
    try {
      await api.delete(`/faculty/notices/${notice._id}`);
      toast.success('Notice deleted');
      if (editingId === notice._id) cancelForm();
      await loadMine();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete notice');
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Notices</h1>
          <p className="text-slate-500 text-sm mt-1">Publish updates to the classes and sections assigned to you</p>
        </div>
        <button type="button" onClick={startCreate} className="btn-primary">
          <Plus className="w-4 h-4" /> New Notice
        </button>
      </div>

      <div className="flex bg-slate-100 p-1 rounded-xl text-sm font-medium text-slate-600 mb-6 max-w-md">
        <button
          type="button"
          onClick={() => setTab('mine')}
          className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors ${tab === 'mine' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'}`}
        >
          <Megaphone className="w-4 h-4" /> My Notices
        </button>
        <button
          type="button"
          onClick={() => setTab('inbox')}
          className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors ${tab === 'inbox' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'}`}
        >
          <Inbox className="w-4 h-4" /> Administration
        </button>
      </div>

      {showForm && (
        <div ref={formRef} className="card mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">{editingId ? 'Edit Notice' : 'Create Notice'}</h3>
            <button type="button" onClick={cancelForm} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="label">Title</label>
                <input className="input" required maxLength={160} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Notice title" />
              </div>
              <div>
                <label className="label">Category</label>
                <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  <option value="">General</option>
                  <option value="Academic">Academic</option>
                  <option value="Exam">Exam</option>
                  <option value="Assignment">Assignment</option>
                  <option value="Event">Event</option>
                  <option value="Holiday">Holiday</option>
                  <option value="Urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label className="label">Event / Due Date (optional)</label>
                <input type="date" className="input" value={form.eventDate} onChange={(e) => setForm({ ...form, eventDate: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Description</label>
                <textarea className="input min-h-[110px]" required maxLength={4000} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Write the notice details..." />
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl p-4">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800 flex items-center gap-2"><Users className="w-4 h-4" /> Audience</p>
                  <p className="text-xs text-slate-500 mt-1">Only your assigned classes and sections can receive this notice.</p>
                </div>
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={allClasses}
                    onChange={(e) => setForm({ ...form, audienceMode: e.target.checked ? 'all-my-classes' : 'selected' })}
                  />
                  All My Classes
                </label>
              </div>

              {options.length === 0 ? (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  No teaching assignments were found for this session and term. Ask the administration to assign your classes before posting a notice.
                </p>
              ) : (
                <div className={`space-y-3 ${allClasses ? 'opacity-60 pointer-events-none' : ''}`}>
                  {groupedOptions.map((group) => (
                    <div key={group.key} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                      <p className="text-xs font-semibold text-slate-700 mb-2">{group.label}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {group.options.map((option) => (
                          <label key={option.assignmentId} className="flex items-center gap-2 text-xs text-slate-600">
                            <input
                              type="checkbox"
                              checked={form.assignmentIds.includes(String(option.assignmentId))}
                              onChange={() => toggleAssignment(String(option.assignmentId))}
                            />
                            <span className="font-medium text-slate-800">{option.subjectCode || option.subjectName}</span>
                            <span>{option.itemType === 'lab' ? 'Lab' : ''}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-slate-500 mt-3">
                {allClasses ? 'This notice will go to every class currently assigned to you in this session and term.' : `${selectedCount} assignment${selectedCount === 1 ? '' : 's'} selected.`}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Attachment (optional)</label>
                <input type="file" ref={fileRef} className="input text-xs" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" />
                <p className="text-[10px] text-slate-400 mt-1">PDF, DOC, DOCX, JPG, JPEG, PNG (Max 10MB)</p>
              </div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 sm:mt-7">
                <input type="checkbox" checked={form.isPinned} onChange={(e) => setForm({ ...form, isPinned: e.target.checked })} />
                Pin to top
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={cancelForm} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Publish Notice'}
              </button>
            </div>
          </form>
        </div>
      )}

      {tab === 'mine' ? (
        mine.length === 0 ? (
          <div className="card text-center py-12">
            <Bell className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">You have not posted any notices yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {mine.map((notice) => (
              <div key={notice._id} className={`card ${notice.isPinned ? 'border-l-4 border-l-primary-500' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-semibold text-slate-800">{notice.title}</h3>
                      {notice.isPinned && <span className="badge-indigo flex items-center gap-1"><Pin className="w-3 h-3" /> Pinned</span>}
                      {notice.category && <span className="badge-blue">{notice.category}</span>}
                    </div>
                    <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{notice.body}</p>
                    <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {noticeAudienceLabel(notice)}</span>
                      {notice.eventDate && <span className="flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> {formatDate(notice.eventDate)}</span>}
                      <span>Posted {formatDate(notice.createdAt)}</span>
                    </div>
                    {Array.isArray(notice.attachments) && notice.attachments.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {notice.attachments.map((attachment, index) => (
                          <a key={index} href={resolveAssetUrl(attachment)} target="_blank" rel="noreferrer" className="text-xs font-medium text-primary-600 bg-primary-50 border border-primary-100 px-3 py-1.5 rounded-full hover:bg-primary-100 transition-colors flex items-center gap-1">
                            <Paperclip className="w-3 h-3" /> Attachment {index + 1}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button type="button" onClick={() => startEdit(notice)} className="p-2 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50" title="Edit notice">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => handleDelete(notice)} className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50" title="Delete notice">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : inboxLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary-600" /></div>
      ) : inbox.length === 0 ? (
        <div className="card text-center py-12">
          <Inbox className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No administration notices available</p>
        </div>
      ) : (
        <div className="space-y-4">
          {inbox.map((notice) => (
            <div key={notice._id} className={`card ${notice.isPinned ? 'border-l-4 border-l-primary-500' : ''}`}>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h3 className="font-semibold text-slate-800">{notice.title}</h3>
                {notice.isPinned && <span className="badge-indigo flex items-center gap-1"><Pin className="w-3 h-3" /> Pinned</span>}
                {notice.category && <span className="badge-blue">{notice.category}</span>}
              </div>
              <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{notice.body}</p>
              {Array.isArray(notice.attachments) && notice.attachments.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {notice.attachments.map((attachment, index) => (
                    <a key={index} href={resolveAssetUrl(attachment)} target="_blank" rel="noreferrer" className="text-xs font-medium text-primary-600 bg-primary-50 border border-primary-100 px-3 py-1.5 rounded-full hover:bg-primary-100 transition-colors">
                      View Attachment {index + 1}
                    </a>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-slate-400">
                <span>{formatDate(notice.createdAt)}</span>
                <span className="capitalize badge-blue">{notice.audience}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
