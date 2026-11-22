import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { ArrowLeft, BookOpen, FlaskConical, AlertCircle } from 'lucide-react';
import { isValidPhone, PHONE_ERROR_MESSAGE } from '../../utils/phoneValidation';
import { DEPARTMENT_OPTIONS, getDepartmentLabel } from '../../constants/departments';
import {
  FACULTY_DESIGNATION_OPTIONS,
  FACULTY_QUALIFICATION_OPTIONS,
} from '../../constants/facultyProfessional';

export default function EnrollFaculty() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: '', password: '', employeeId: '', namePrefix: '', firstName: '', lastName: '',
    department: 'IT', designation: '', qualification: '', joiningDate: '',
    phone: '', address: '',
  });
  const [subjectIds, setSubjectIds] = useState([]);
  const [labIds, setLabIds] = useState([]);
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [availableLabs, setAvailableLabs] = useState([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [loadingLabs, setLoadingLabs] = useState(false);
  const [subjectSearch, setSubjectSearch] = useState('');
  const [labSearch, setLabSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [phoneError, setPhoneError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const isValidEmail = (email) => /^[^\s@]+@sgsits\.ac\.in$/i.test(String(email).trim());

  const handleEmailChange = (e) => {
    const email = e.target.value;
    set('email', email);
    if (email && !isValidEmail(email)) {
      setEmailError('Enter a valid SGSITS email (name@sgsits.ac.in)');
    } else {
      setEmailError('');
    }
  };

  // Load subjects whenever department changes
  useEffect(() => {
    setSubjectIds([]);
    setLabIds([]);
    setSubjectSearch('');
    setLabSearch('');
    setLoadingSubjects(true);
    setLoadingLabs(true);
    Promise.all([
      api.get(`/admin/subjects?branch=${form.department}`)
        .then(r => setAvailableSubjects(r.data.data.subjects)),
      api.get(`/admin/labs?branch=${form.department}`)
        .then(r => setAvailableLabs(r.data.data.labs)),
    ]).finally(() => {
      setLoadingSubjects(false);
      setLoadingLabs(false);
    });
  }, [form.department]);

  const toggleSubject = (id) => {
    setSubjectIds(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const toggleLab = (id) => {
    setLabIds(prev =>
      prev.includes(id) ? prev.filter(l => l !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.email && !isValidEmail(form.email)) {
      setEmailError('Enter a valid SGSITS email (name@sgsits.ac.in)');
      return;
    }
    if (!isValidPhone(form.phone)) {
      setPhoneError(PHONE_ERROR_MESSAGE);
      return;
    }
    setPhoneError('');
    setLoading(true);
    try {
      await api.post('/admin/faculty', { ...form, subjectIds, labIds });
      toast.success('Faculty enrolled successfully!');
      navigate('/admin/faculty');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Enrollment failed');
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

        {/* Login Credentials */}
        <div className="card">
          <h2 className="font-semibold text-slate-700 mb-4">Login Credentials</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Email *</label>
              <input
                className={`input ${emailError ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                type="email"
                value={form.email}
                onChange={handleEmailChange}
                placeholder="faculty@sgsits.ac.in"
                required
              />
              {emailError && (
                <p className="text-sm font-medium text-red-600 mt-1.5 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {emailError}
                </p>
              )}
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="Default: Faculty@123" />
            </div>
          </div>
        </div>

        {/* Personal Details */}
        <div className="card">
          <h2 className="font-semibold text-slate-700 mb-4">Personal Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Name Prefix (Optional)</label>
              <select className="input" value={form.namePrefix} onChange={e => set('namePrefix', e.target.value)}>
                <option value="">No prefix</option>
                <option value="Mr.">Mr.</option>
                <option value="Mrs.">Mrs.</option>
                <option value="Ms.">Ms.</option>
                <option value="Miss">Miss</option>
                <option value="Dr.">Dr.</option>
                <option value="Prof.">Prof.</option>
              </select>
            </div>
            <div><label className="label">First Name *</label><input className="input" value={form.firstName} onChange={e => set('firstName', e.target.value)} required /></div>
            <div><label className="label">Last Name *</label><input className="input" value={form.lastName} onChange={e => set('lastName', e.target.value)} required /></div>
            <div><label className="label">Phone</label><input className={`input ${phoneError ? 'border-red-500' : ''}`} inputMode="numeric" value={form.phone} onChange={e => { set('phone', e.target.value); setPhoneError(''); }} />{phoneError && <p className="text-sm text-red-600 mt-1">{phoneError}</p>}</div>
            <div className="sm:col-span-2"><label className="label">Address</label><textarea className="input resize-none h-16" value={form.address} onChange={e => set('address', e.target.value)} /></div>
          </div>
        </div>

        {/* Professional Details */}
        <div className="card">
          <h2 className="font-semibold text-slate-700 mb-4">Professional Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Employee ID *</label>
              <input className="input font-mono" value={form.employeeId} onChange={e => set('employeeId', e.target.value)} required placeholder="EMP001" />
            </div>
            <div>
              <label className="label">Department *</label>
              <select className="input" value={form.department} onChange={e => set('department', e.target.value)}>
                {DEPARTMENT_OPTIONS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Designation</label>
              <select className="input" value={form.designation} onChange={e => set('designation', e.target.value)}>
                <option value="">Select designation</option>
                {FACULTY_DESIGNATION_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Qualification</label>
              <select className="input" value={form.qualification} onChange={e => set('qualification', e.target.value)}>
                <option value="">Select qualification</option>
                {FACULTY_QUALIFICATION_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
            <div><label className="label">Joining Date</label><input className="input" type="date" value={form.joiningDate} onChange={e => set('joiningDate', e.target.value)} /></div>
          </div>
        </div>

        {/* Subject Assignment */}
        <div className="card">
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="w-4 h-4 text-primary-600" />
            <h2 className="font-semibold text-slate-700">Assign Subjects</h2>
            {subjectIds.length > 0 && (
              <span className="ml-auto text-xs bg-primary-100 text-primary-700 font-semibold px-2 py-0.5 rounded-full">
                {subjectIds.length} selected
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mb-4">Subjects listed below are from the <strong>{getDepartmentLabel(form.department)}</strong> department. Change department above to see others.</p>
          <input
            type="search"
            className="input mb-3"
            value={subjectSearch}
            onChange={e => setSubjectSearch(e.target.value)}
            placeholder="Search subject name or code..."
          />

          {loadingSubjects ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse" />)}
            </div>
          ) : availableSubjects.length === 0 ? (
            <p className="text-sm text-slate-400 italic">No subjects found for {getDepartmentLabel(form.department)}. Add subjects first from the Subjects page.</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {availableSubjects.filter(s => {
                const query = subjectSearch.trim().toLowerCase();
                return !query || String(s.name || '').toLowerCase().includes(query)
                  || String(s.code || '').toLowerCase().includes(query);
              }).map(s => {
                const checked = subjectIds.includes(s._id);
                const alreadyAssigned = s.facultyId && !checked;
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
                      {alreadyAssigned && (
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

        {/* Lab Assignment */}
        <div className="card">
          <div className="flex items-center gap-2 mb-1">
            <FlaskConical className="w-4 h-4 text-emerald-600" />
            <h2 className="font-semibold text-slate-700">Assign Labs</h2>
            {labIds.length > 0 && (
              <span className="ml-auto text-xs bg-emerald-100 text-emerald-700 font-semibold px-2 py-0.5 rounded-full">
                {labIds.length} selected
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Labs listed below are from the <strong>{getDepartmentLabel(form.department)}</strong> department.
          </p>
          <input
            type="search"
            className="input mb-3"
            value={labSearch}
            onChange={e => setLabSearch(e.target.value)}
            placeholder="Search lab name or code..."
          />

          {loadingLabs ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse" />)}
            </div>
          ) : availableLabs.length === 0 ? (
            <p className="text-sm text-slate-400 italic">No labs found for {getDepartmentLabel(form.department)}. Add labs first from the Subjects page.</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {availableLabs.filter(lab => {
                const query = labSearch.trim().toLowerCase();
                return !query || String(lab.name || '').toLowerCase().includes(query)
                  || String(lab.code || '').toLowerCase().includes(query);
              }).map(lab => (
                <label
                  key={lab._id}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    labIds.includes(lab._id)
                      ? 'border-emerald-400 bg-emerald-50'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="accent-emerald-600 w-4 h-4 shrink-0"
                    checked={labIds.includes(lab._id)}
                    onChange={() => toggleLab(lab._id)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-emerald-600">{lab.code}</span>
                      <span className="text-sm font-medium text-slate-700 truncate">{lab.name}</span>
                      <span className="text-xs text-slate-400 ml-auto shrink-0">Sem {lab.semester} · {lab.credits} cr.</span>
                    </div>
                    {lab.facultyId && (
                      <p className="text-xs text-amber-600 mt-0.5">
                        Currently: {lab.facultyId.firstName} {lab.facultyId.lastName}
                      </p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Enrolling...' : `Enroll Faculty${subjectIds.length > 0 ? ` & Assign ${subjectIds.length} Subject${subjectIds.length > 1 ? 's' : ''}` : ''}`}
          </button>
          <Link to="/admin/faculty" className="btn-secondary">Cancel</Link>
        </div>

      </form>
    </div>
  );
}
