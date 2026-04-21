import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { User, Save, Phone, MapPin, Briefcase } from 'lucide-react';
import toast from 'react-hot-toast';

export default function FacultyProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ phone: '', address: '', designation: '', qualification: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/faculty/profile').then(r => {
      const f = r.data.data.faculty;
      setProfile(f);
      setForm({ phone: f.phone || '', address: f.address || '', designation: f.designation || '', qualification: f.qualification || '' });
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await api.patch('/faculty/profile', form);
      setProfile(data.data.faculty);
      setEditing(false);
      toast.success('Profile updated');
    } catch {
      toast.error('Failed to update');
    }
    setSaving(false);
  };

  if (!profile) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">My Profile</h1>
        <p className="text-slate-500 text-sm mt-1">View and manage your information</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
            <User className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">{profile.firstName} {profile.lastName}</h2>
          <p className="text-sm text-slate-500">{profile.employeeId}</p>
          <div className="mt-3 space-y-1 text-sm text-slate-500">
            <p>{profile.department} Department</p>
            <p>{profile.designation}</p>
            <p>{profile.qualification}</p>
          </div>
          {profile.subjectsTaught?.length > 0 && (
            <div className="mt-4 w-full">
              <p className="text-xs font-medium text-slate-500 mb-2">Subjects</p>
              <div className="flex flex-wrap justify-center gap-1">
                {profile.subjectsTaught.map(s => (
                  <span key={s._id} className="badge-indigo text-xs">{s.code}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-semibold text-slate-800">Personal Details</h2>
            {!editing ? (
              <button onClick={() => setEditing(true)} className="btn-primary text-xs">Edit</button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setEditing(false)} className="btn-secondary text-xs">Cancel</button>
                <button onClick={handleSave} disabled={saving} className="btn-primary text-xs">
                  <Save className="w-3 h-3" /> {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">First Name</label>
              <p className="text-sm text-slate-800 bg-slate-50 px-3 py-2 rounded-lg">{profile.firstName}</p>
            </div>
            <div>
              <label className="label">Last Name</label>
              <p className="text-sm text-slate-800 bg-slate-50 px-3 py-2 rounded-lg">{profile.lastName}</p>
            </div>
            <div>
              <label className="label">Employee ID</label>
              <p className="text-sm text-slate-800 bg-slate-50 px-3 py-2 rounded-lg">{profile.employeeId}</p>
            </div>
            <div>
              <label className="label">Joining Date</label>
              <p className="text-sm text-slate-800 bg-slate-50 px-3 py-2 rounded-lg">{profile.joiningDate ? new Date(profile.joiningDate).toLocaleDateString() : '—'}</p>
            </div>
            <div>
              <label className="label"><Briefcase className="w-3 h-3 inline mr-1" />Designation</label>
              {editing ? (
                <input className="input" value={form.designation} onChange={e => setForm({ ...form, designation: e.target.value })} />
              ) : (
                <p className="text-sm text-slate-800 bg-slate-50 px-3 py-2 rounded-lg">{profile.designation || '—'}</p>
              )}
            </div>
            <div>
              <label className="label">Qualification</label>
              {editing ? (
                <input className="input" value={form.qualification} onChange={e => setForm({ ...form, qualification: e.target.value })} />
              ) : (
                <p className="text-sm text-slate-800 bg-slate-50 px-3 py-2 rounded-lg">{profile.qualification || '—'}</p>
              )}
            </div>
            <div>
              <label className="label"><Phone className="w-3 h-3 inline mr-1" />Phone</label>
              {editing ? (
                <input className="input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              ) : (
                <p className="text-sm text-slate-800 bg-slate-50 px-3 py-2 rounded-lg">{profile.phone || '—'}</p>
              )}
            </div>
            <div>
              <label className="label"><MapPin className="w-3 h-3 inline mr-1" />Address</label>
              {editing ? (
                <input className="input" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
              ) : (
                <p className="text-sm text-slate-800 bg-slate-50 px-3 py-2 rounded-lg">{profile.address || '—'}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
