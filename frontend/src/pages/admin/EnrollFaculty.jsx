import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';

const DEPARTMENTS = ['IT', 'CSE', 'ECE', 'ME', 'CE', 'Mathematics', 'Physics', 'Chemistry'];

export default function EnrollFaculty() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: '', password: '', employeeId: '', firstName: '', lastName: '',
    department: 'IT', designation: '', qualification: '', joiningDate: '',
    phone: '', address: '',
  });
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/admin/faculty', form);
      toast.success('Faculty enrolled successfully!');
      navigate('/admin/faculty');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/admin/faculty" className="text-slate-400 hover:text-slate-600"><ArrowLeft className="w-5 h-5" /></Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Enroll Faculty</h1>
          <p className="text-slate-500 text-sm">Add a new faculty member</p>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card">
          <h2 className="font-semibold text-slate-700 mb-4">Login Credentials</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="label">Email *</label><input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} required /></div>
            <div><label className="label">Password</label><input className="input" type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="Default: Faculty@123" /></div>
          </div>
        </div>
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
            <div><label className="label">Employee ID *</label><input className="input font-mono" value={form.employeeId} onChange={e => set('employeeId', e.target.value)} required placeholder="EMP001" /></div>
            <div><label className="label">Department *</label>
              <select className="input" value={form.department} onChange={e => set('department', e.target.value)}>
                {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div><label className="label">Designation</label><input className="input" value={form.designation} onChange={e => set('designation', e.target.value)} placeholder="Associate Professor" /></div>
            <div><label className="label">Qualification</label><input className="input" value={form.qualification} onChange={e => set('qualification', e.target.value)} placeholder="M.Tech / Ph.D" /></div>
            <div><label className="label">Joining Date</label><input className="input" type="date" value={form.joiningDate} onChange={e => set('joiningDate', e.target.value)} /></div>
          </div>
        </div>
        <div className="flex gap-3">
          <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Enrolling...' : 'Enroll Faculty'}</button>
          <Link to="/admin/faculty" className="btn-secondary">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
