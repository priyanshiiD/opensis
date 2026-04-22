import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';

const DEPARTMENTS = ['IT', 'CSE', 'ECE', 'ME', 'CE'];

export default function EditFaculty() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
    }).finally(() => setLoading(false));
  }, [id]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/admin/faculty/${id}`, form);
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
          <p className="text-slate-500 text-sm">Password and Employee ID cannot be changed here</p>
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
            <div><label className="label">Department *</label>
              <select className="input" value={form.department} onChange={e => set('department', e.target.value)}>
                {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div><label className="label">Designation</label><input className="input" value={form.designation} onChange={e => set('designation', e.target.value)} placeholder="e.g. Associate Professor" /></div>
            <div><label className="label">Qualification</label><input className="input" value={form.qualification} onChange={e => set('qualification', e.target.value)} placeholder="e.g. M.Tech, Ph.D" /></div>
            <div><label className="label">Joining Date</label><input className="input" type="date" value={form.joiningDate} onChange={e => set('joiningDate', e.target.value)} /></div>
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save Changes'}</button>
          <Link to={`/admin/faculty/${id}`} className="btn-secondary">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
