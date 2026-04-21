import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { User, Save, Mail, Phone, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';

export default function StudentProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ phone: '', address: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/student/profile').then(r => {
      setProfile(r.data.data.student);
      setForm({ phone: r.data.data.student.phone || '', address: r.data.data.student.address || '' });
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await api.patch('/student/profile', form);
      setProfile(data.data.student);
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
        <p className="text-slate-500 text-sm mt-1">View and manage your personal information</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="card flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mb-4">
            <User className="w-10 h-10 text-primary-600" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">{profile.firstName} {profile.lastName}</h2>
          <p className="text-sm text-slate-500">{profile.enrollmentNo}</p>
          <div className="mt-3 space-y-1 text-sm text-slate-500">
            <p>{profile.branch} · Semester {profile.currentSemester}</p>
            <p>Section {profile.section}</p>
            <p>Session: {profile.session}</p>
          </div>
        </div>

        {/* Details */}
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
              <label className="label">Enrollment No</label>
              <p className="text-sm text-slate-800 bg-slate-50 px-3 py-2 rounded-lg">{profile.enrollmentNo}</p>
            </div>
            <div>
              <label className="label">Gender</label>
              <p className="text-sm text-slate-800 bg-slate-50 px-3 py-2 rounded-lg capitalize">{profile.gender || '—'}</p>
            </div>
            <div>
              <label className="label">Date of Birth</label>
              <p className="text-sm text-slate-800 bg-slate-50 px-3 py-2 rounded-lg">{profile.dob ? new Date(profile.dob).toLocaleDateString() : '—'}</p>
            </div>
            <div>
              <label className="label">Admission Year</label>
              <p className="text-sm text-slate-800 bg-slate-50 px-3 py-2 rounded-lg">{profile.admissionYear}</p>
            </div>
            <div>
              <label className="label">Father's Name</label>
              <p className="text-sm text-slate-800 bg-slate-50 px-3 py-2 rounded-lg">{profile.fatherName || '—'}</p>
            </div>
            <div>
              <label className="label">Mother's Name</label>
              <p className="text-sm text-slate-800 bg-slate-50 px-3 py-2 rounded-lg">{profile.motherName || '—'}</p>
            </div>
            <div>
              <label className="label flex items-center gap-1"><Phone className="w-3 h-3" /> Phone</label>
              {editing ? (
                <input className="input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              ) : (
                <p className="text-sm text-slate-800 bg-slate-50 px-3 py-2 rounded-lg">{profile.phone || '—'}</p>
              )}
            </div>
            <div>
              <label className="label flex items-center gap-1"><MapPin className="w-3 h-3" /> Address</label>
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
