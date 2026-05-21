import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { Save, BarChart3, Plus, X, Upload, CheckCircle, AlertCircle, FileSpreadsheet, Download } from 'lucide-react';
import toast from 'react-hot-toast';

export default function FacultyMarks() {
  const [subjects, setSubjects] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [semester, setSemester] = useState('5');
  const [session, setSession] = useState('2024-25');
  const [entries, setEntries] = useState([]);
  const [existingResults, setExistingResults] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState('update');
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Excel upload state
  const [excelFile, setExcelFile] = useState(null);
  const [excelSubject, setExcelSubject] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get('/faculty/subjects').then(r => setSubjects(r.data.data.subjects)),
    ]);
  }, []);

  const loadExisting = () => {
    api.get(`/faculty/marks?semester=${semester}&session=${session}`).then(r => {
      setExistingResults(r.data.data.results || []);
    });
  };

  // Load students for selected subject/semester/session
  // Load students for the currently active subject (depends on tab)
  useEffect(() => {
    const load = async () => {
      const activeSubjectId = tab === 'excel' ? excelSubject : selectedSubject;
      if (!activeSubjectId) return setStudents([]);
      const subj = subjects.find(s => s._id === activeSubjectId);
      if (!subj) return setStudents([]);
      const sem = semester || subj.semester;
      setLoadingStudents(true);
      try {
        let q = `?branch=${encodeURIComponent(subj.branch)}&semester=${encodeURIComponent(sem)}&session=${encodeURIComponent(session)}&limit=1000`;
        let { data } = await api.get(`/admin/students${q}`);
        let roster = data.data.students || [];
        // fallback: if session filter returns very few students, retry without session
        if (roster.length <= 2) {
          try {
            q = `?branch=${encodeURIComponent(subj.branch)}&semester=${encodeURIComponent(sem)}&limit=1000`;
            const resp2 = await api.get(`/admin/students${q}`);
            const roster2 = resp2.data.data.students || [];
            if (roster2.length > roster.length) {
              roster = roster2;
              toast.success(`Loaded ${roster.length} students (session not applied)`);
            }
          } catch (e) {
            // ignore fallback error
          }
        }
        setStudents(roster);
      } catch (err) {
        setStudents([]);
      }
      setLoadingStudents(false);
    };
    load();
  }, [selectedSubject, excelSubject, semester, session, subjects, tab]);

  useEffect(() => {
    if (tab === 'view') loadExisting();
  }, [tab, semester, session]);

  const addEntry = () => {
    setEntries([...entries, { studentId: '', internalMarks: '', externalMarks: '' }]);
  };

  const populateRoster = async () => {
    const activeSubject = tab === 'excel' ? excelSubject : selectedSubject;
    if (!activeSubject) return toast.error('Select a subject first');
    const subj = subjects.find(s => s._id === activeSubject);
    if (!subj) return toast.error('Subject not found');
    const sem = semester || subj.semester;
    setLoadingStudents(true);
    try {
      let q = `?branch=${encodeURIComponent(subj.branch)}&semester=${encodeURIComponent(sem)}&session=${encodeURIComponent(session)}&limit=1000`;
      let { data } = await api.get(`/admin/students${q}`);
      let roster = data.data.students || [];
      if (roster.length <= 2) {
        try {
          q = `?branch=${encodeURIComponent(subj.branch)}&semester=${encodeURIComponent(sem)}&limit=1000`;
          const resp2 = await api.get(`/admin/students${q}`);
          const roster2 = resp2.data.data.students || [];
          if (roster2.length > roster.length) {
            roster = roster2;
            toast.success(`Loaded ${roster.length} students (session not applied)`);
          }
        } catch (e) {
          // ignore
        }
      }
      if (roster.length === 0) return toast.error('No students found for this subject/semester/session');
      const rows = roster.map(s => ({ studentId: s._id, internalMarks: '', externalMarks: '' }));
      setEntries(rows);
      setStudents(roster);
      toast.success(`${rows.length} students added to entries`);
    } catch (err) {
      toast.error('Failed to load students');
    }
    setLoadingStudents(false);
  };

  const updateEntry = (idx, field, value) => {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e));
  };

  const removeEntry = (idx) => {
    setEntries(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (entries.length === 0) return toast.error('Add at least one entry');
    if (!selectedSubject) return toast.error('Select a subject');
    const valid = entries.every(e => e.studentId && (e.internalMarks !== '' || e.externalMarks !== ''));
    if (!valid) return toast.error('Fill all required fields');
    setSubmitting(true);
    try {
      await api.post('/faculty/marks', {
        semester: Number(semester),
        session,
        entries: entries.map(e => ({
          studentId: e.studentId,
          subjectId: selectedSubject,
          internalMarks: Number(e.internalMarks) || 0,
          externalMarks: Number(e.externalMarks) || 0,
        })),
      });
      toast.success('Marks updated successfully');
      setEntries([]);
      if (tab === 'view') loadExisting();
      // after manual submit, attempt to download the submitted marks workbook
      try {
        const q = `?subjectId=${selectedSubject}&semester=${semester}&session=${encodeURIComponent(session)}`;
        const resp = await api.get(`/faculty/marks/export${q}`, { responseType: 'blob' });
        const disposition = resp.headers['content-disposition'] || '';
        let filename = 'submitted_marks.xlsx';
        const match = /filename\*?=([^;]+)/i.exec(disposition);
        if (match) filename = match[1].replace(/UTF-8''/, '').replace(/"/g, '').trim();
        const url = window.URL.createObjectURL(new Blob([resp.data]));
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } catch (e) {
        // ignore download errors
      }
    } catch {
      toast.error('Failed to update marks');
    }
    setSubmitting(false);
  };

  // Excel upload handlers
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const validTypes = ['.xlsx', '.xls', '.csv'];
      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      if (!validTypes.includes(ext)) {
        toast.error('Please select a valid Excel file (.xlsx, .xls, or .csv)');
        return;
      }
      setExcelFile(file);
    }
  };

  const handleDownloadTemplate = async () => {
    if (!excelSubject || !semester || !session) {
      return toast.error('Select Subject, Semester, and Session to download template');
    }
    const q = `?subjectId=${excelSubject}&semester=${semester}&session=${encodeURIComponent(session)}`;
    try {
      const resp = await api.get(`/faculty/marks/template${q}`, { responseType: 'blob' });
      const disposition = resp.headers['content-disposition'] || '';
      let filename = 'marks_template.xlsx';
      const match = /filename\*?=([^;]+)/i.exec(disposition);
      if (match) filename = match[1].replace(/UTF-8''/, '').replace(/"/g, '').trim();

      const url = window.URL.createObjectURL(new Blob([resp.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to download template');
    }
  };

  const handleDownloadSubmitted = async () => {
    if (!selectedSubject || !semester || !session) return toast.error('Select subject, semester and session to download');
    const q = `?subjectId=${selectedSubject}&semester=${semester}&session=${encodeURIComponent(session)}`;
    try {
      const resp = await api.get(`/faculty/marks/export${q}`, { responseType: 'blob' });
      const disposition = resp.headers['content-disposition'] || '';
      let filename = 'submitted_marks.xlsx';
      const match = /filename\*?=([^;]+)/i.exec(disposition);
      if (match) filename = match[1].replace(/UTF-8''/, '').replace(/"/g, '').trim();

      const url = window.URL.createObjectURL(new Blob([resp.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to download submitted marks');
    }
  };

  const handleExcelUpload = async (e) => {
    e.preventDefault();
    if (!excelFile) return toast.error('Please select a file');
    if (!excelSubject) return toast.error('Please select a subject');

    const formData = new FormData();
    formData.append('file', excelFile);
    formData.append('subjectId', excelSubject);
    formData.append('semester', semester);
    formData.append('session', session);

    setUploading(true);
    try {
      const { data } = await api.post('/faculty/marks/bulk-upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadResult(data.data);
      toast.success(`Processed ${data.data.success.length} entries`);
      setExcelFile(null);
      // try to download the submitted marks workbook for convenience
      try {
        const q = `?subjectId=${excelSubject}&semester=${semester}&session=${encodeURIComponent(session)}`;
        const resp = await api.get(`/faculty/marks/export${q}`, { responseType: 'blob' });
        const disposition = resp.headers['content-disposition'] || '';
        let filename = 'submitted_marks.xlsx';
        const match = /filename\*?=([^;]+)/i.exec(disposition);
        if (match) filename = match[1].replace(/UTF-8''/, '').replace(/"/g, '').trim();
        const url = window.URL.createObjectURL(new Blob([resp.data]));
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } catch (e) {
        // ignore download errors
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    }
    setUploading(false);
  };

  const getStudentName = (id) => {
    const s = students.find(st => st._id === id);
    return s ? `${s.firstName} ${s.lastName} (${s.enrollmentNo})` : 'Unknown';
  };

  const activeSubjectId = tab === 'excel' ? excelSubject : selectedSubject;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Update Marks</h1>
        <p className="text-slate-500 text-sm mt-1">Upload and manage student marks for your subjects</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 rounded-lg p-1 w-fit">
        <button onClick={() => setTab('update')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'update' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-600'}`}>Manual Entry</button>
        <button onClick={() => setTab('excel')} className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'excel' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-600'}`}><FileSpreadsheet className="w-4 h-4" /> Upload Excel</button>
        <button onClick={() => setTab('view')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'view' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-600'}`}>View Results</button>
      </div>

      {/* Manual Entry Tab */}
      {tab === 'update' && (
        <>
          {/* Filters */}
          <div className="card mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="label">Subject *</label>
                <select className="input" value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}>
                  <option value="">Select subject</option>
                  {subjects.map(s => <option key={s._id} value={s._id}>{s.code} — {s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Semester</label>
                <input type="number" className="input" value={semester} onChange={e => setSemester(e.target.value)} />
              </div>
              <div>
                <label className="label">Session</label>
                <input className="input" value={session} onChange={e => setSession(e.target.value)} placeholder="e.g. 2024-25" />
              </div>
            </div>
          </div>

          {/* Entries */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">Mark Entries</h3>
              <div className="flex gap-2">
                <button onClick={addEntry} className="btn-secondary text-xs flex items-center gap-1">
                  <Plus className="w-4 h-4" /> Add Student
                </button>
                <button onClick={populateRoster} disabled={!activeSubjectId || loadingStudents} className="btn-secondary text-xs flex items-center gap-1" title="Populate all students from this class">
                  <Download className="w-4 h-4" /> Populate Roster
                </button>
              </div>
            </div>

            {entries.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-8">Click "Add Student" to start entering marks</p>
            ) : (
              <>
                <div className="space-y-3">
                  {entries.map((e, i) => (
                    <div key={i} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                        <div>
                          <label className="label text-xs">Student *</label>
                          <select 
                            className="input text-sm"
                            value={e.studentId}
                            onChange={ev => updateEntry(i, 'studentId', ev.target.value)}
                          >
                            <option value="">Select student</option>
                            {students.map(s => <option key={s._id} value={s._id}>{s.firstName} {s.lastName} ({s.enrollmentNo})</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="label text-xs">Internal (40)</label>
                          <input 
                            type="number" 
                            className="input text-sm"
                            value={e.internalMarks}
                            onChange={ev => updateEntry(i, 'internalMarks', ev.target.value)}
                            placeholder="0-40"
                            min="0"
                            max="40"
                          />
                        </div>
                        <div>
                          <label className="label text-xs">External (60)</label>
                          <input 
                            type="number"
                            className="input text-sm"
                            value={e.externalMarks}
                            onChange={ev => updateEntry(i, 'externalMarks', ev.target.value)}
                            placeholder="0-60"
                            min="0"
                            max="60"
                          />
                        </div>
                        <div className="flex items-end">
                          <button onClick={() => removeEntry(i)} className="btn-danger text-xs w-full">
                            <X className="w-4 h-4 inline" /> Remove
                          </button>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-slate-500">
                        Total: {(Number(e.internalMarks) || 0) + (Number(e.externalMarks) || 0)} / 100
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button onClick={() => setEntries([])} className="btn-secondary">Clear All</button>
                  <button onClick={handleSubmit} disabled={submitting} className="btn-primary">
                    <Save className="w-4 h-4" /> {submitting ? 'Saving...' : 'Submit Marks'}
                  </button>
                  <button onClick={() => handleDownloadSubmitted()} disabled={!selectedSubject || !semester || !session} className="btn-secondary">Download Submitted Marks</button>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* Excel Upload Tab */}
      {tab === 'excel' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <form onSubmit={handleExcelUpload} className="card space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-slate-700 flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-primary-600" />
                  Upload Marks via Excel
                </h2>
                <button 
                  type="button" 
                  onClick={handleDownloadTemplate} 
                  disabled={!excelSubject || !semester || !session}
                  className="btn-secondary text-xs flex items-center gap-1 disabled:opacity-50"
                  title="Select Subject, Semester, and Session to download template"
                >
                  <Download className="w-4 h-4" /> Download Template
                </button>
              </div>

              {/* Subject & Semester Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="label">Subject *</label>
                  <select className="input" value={excelSubject} onChange={e => setExcelSubject(e.target.value)} required>
                    <option value="">Select subject</option>
                    {subjects.map(s => <option key={s._id} value={s._id}>{s.code} — {s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Semester *</label>
                  <input type="number" className="input" value={semester} onChange={e => setSemester(e.target.value)} min="1" max="8" required />
                </div>
                <div>
                  <label className="label">Session *</label>
                  <input className="input" value={session} onChange={e => setSession(e.target.value)} placeholder="2024-25" required />
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                {activeSubjectId ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-medium text-slate-700">Class roster ready:</span>
                    <span>{loadingStudents ? 'Loading students...' : `${students.length} students found`}</span>
                    {students.length > 0 && (
                      <span className="text-xs text-slate-500">Use this roster to prepare the Excel sheet before uploading marks.</span>
                    )}
                  </div>
                ) : (
                  <span>Select subject, semester, and session to load the class roster.</span>
                )}
              </div>

              {students.length > 0 && (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-sm font-medium text-slate-700">
                    Students in this class ({students.length})
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-white">
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="px-4 py-2 text-left">#</th>
                          <th className="px-4 py-2 text-left">Student</th>
                          <th className="px-4 py-2 text-left">Roll No.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.map((s, i) => (
                          <tr key={s._id} className="border-b border-slate-100 last:border-0">
                            <td className="px-4 py-2 text-slate-500">{i + 1}</td>
                            <td className="px-4 py-2 text-slate-800">{s.firstName} {s.lastName}</td>
                            <td className="px-4 py-2 font-mono text-xs text-slate-500">{s.enrollmentNo}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* File Upload Area */}
              <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 hover:border-primary-300 transition-colors">
                <div className="flex flex-col items-center justify-center text-center">
                  <Upload className="w-8 h-8 text-slate-400 mb-2" />
                  <label className="cursor-pointer">
                    <span className="text-primary-600 font-medium hover:underline">Click to upload</span>
                    {' '}or drag and drop
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                  <p className="text-xs text-slate-500 mt-1">
                    {excelFile ? `📄 ${excelFile.name}` : 'Excel files (.xlsx, .xls, .csv) • Max 15 MB'}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={uploading || !excelFile || !excelSubject}
                  className="flex-1 btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Upload className="w-4 h-4" /> {uploading ? 'Uploading...' : 'Upload Marks'}
                </button>
                {excelFile && (
                  <button type="button" onClick={() => setExcelFile(null)} className="btn btn-secondary">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Format Guide */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                <p className="font-medium mb-1">Excel Format Required:</p>
                <ul className="space-y-1 text-xs">
                  <li>• Columns: <code className="bg-blue-100 px-1 rounded">enrollmentNo</code>, <code className="bg-blue-100 px-1 rounded">internalMarks</code>, <code className="bg-blue-100 px-1 rounded">externalMarks</code></li>
                  <li>• Internal marks: 0-40, External marks: 0-60</li>
                  <li>• System auto-calculates: Total, Grade, Grade Points</li>
                  <li>• Enrollment number must match existing students</li>
                </ul>
              </div>
            </form>

            {/* Sample Table */}
            <div className="card mt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-700">📋 Sample Excel Files</h3>
              </div>
              <p className="text-xs text-slate-500 mb-4">Download these sample files to test the upload feature. The files contain valid enrollment numbers for the demo.</p>
              <div className="flex gap-3">
                <a href="/sample_marks.xlsx" download className="flex-1 btn-secondary text-xs flex items-center justify-center gap-2 py-2">
                  <Download className="w-4 h-4" /> Download Valid Sample
                </a>
                <a href="/sample_marks_with_errors.xlsx" download className="flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-medium rounded-lg flex items-center justify-center gap-2 py-2 transition-colors">
                  <AlertCircle className="w-4 h-4 text-amber-500" /> Download Error Sample
                </a>
              </div>
              
              <div className="overflow-x-auto mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs font-medium text-slate-600 mb-2">Example Format:</p>
                <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="py-2 px-3 text-left text-slate-600 font-semibold border-b">enrollmentNo</th>
                      <th className="py-2 px-3 text-center text-slate-600 font-semibold border-b">internalMarks</th>
                      <th className="py-2 px-3 text-center text-slate-600 font-semibold border-b">externalMarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-100">
                      <td className="py-2 px-3 font-mono text-xs">0801IT221001</td>
                      <td className="py-2 px-3 text-center">35</td>
                      <td className="py-2 px-3 text-center">48</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-2 px-3 font-mono text-xs">0801IT221002</td>
                      <td className="py-2 px-3 text-center">28</td>
                      <td className="py-2 px-3 text-center">42</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Results Panel */}
          <div className="lg:col-span-1">
            {uploadResult ? (
              <div className="card space-y-4">
                <h2 className="font-semibold text-slate-700">Upload Results</h2>
                {/* Success */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                    <span className="font-medium text-emerald-900">Success</span>
                  </div>
                  <p className="text-2xl font-bold text-emerald-600">{uploadResult.success.length}</p>
                  <p className="text-xs text-emerald-700 mt-1">marks uploaded</p>
                </div>
                {/* Failed */}
                {uploadResult.failed.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertCircle className="w-5 h-5 text-red-600" />
                      <span className="font-medium text-red-900">Failed</span>
                    </div>
                    <p className="text-2xl font-bold text-red-600">{uploadResult.failed.length}</p>
                  </div>
                )}
                {/* Failed Details */}
                {uploadResult.failed.length > 0 && (
                  <details className="group">
                    <summary className="cursor-pointer font-medium text-sm text-slate-700">View Failures</summary>
                    <div className="mt-3 max-h-64 overflow-y-auto space-y-2">
                      {uploadResult.failed.map((f, i) => (
                        <div key={i} className="text-xs bg-red-50 border border-red-200 rounded p-2">
                          <p className="font-medium text-red-700">Row {f.row}{f.enrollmentNo ? ` (${f.enrollmentNo})` : ''}</p>
                          <p className="text-red-600">{f.reason}</p>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
                {/* Success Details */}
                {uploadResult.success.length > 0 && (
                  <details className="group">
                    <summary className="cursor-pointer font-medium text-sm text-slate-700">View Successes</summary>
                    <div className="mt-3 max-h-64 overflow-y-auto space-y-2">
                      {uploadResult.success.map((s, i) => (
                        <div key={i} className="text-xs bg-emerald-50 border border-emerald-200 rounded p-2">
                          <p className="font-medium text-emerald-700">{s.enrollmentNo}</p>
                          <p className="text-emerald-600">Total: {s.totalMarks} | Grade: {s.grade}</p>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
                <button onClick={() => setUploadResult(null)} className="btn-secondary w-full text-sm">Upload Another</button>
              </div>
            ) : (
              <div className="card text-center py-8">
                <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500">Upload an Excel file to see results here</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* View Tab */}
      {tab === 'view' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">Results Summary</h3>
            <div className="flex gap-2">
              <input 
                type="number"
                className="input text-sm w-24"
                value={semester}
                onChange={e => setSemester(e.target.value)}
                placeholder="Sem"
              />
              <input
                className="input text-sm w-32"
                value={session}
                onChange={e => setSession(e.target.value)}
                placeholder="2024-25"
              />
              <button onClick={loadExisting} className="btn-secondary text-xs">Refresh</button>
            </div>
          </div>
          
          {existingResults.length === 0 ? (
            <div className="text-center py-12">
              <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No results found for this semester/session</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-2 text-slate-600 font-semibold">Student</th>
                    <th className="text-center py-3 px-2 text-slate-600 font-semibold">SGPA</th>
                    <th className="text-center py-3 px-2 text-slate-600 font-semibold">Percentage</th>
                    <th className="text-center py-3 px-2 text-slate-600 font-semibold">Status</th>
                    <th className="text-left py-3 px-2 text-slate-600 font-semibold">Subjects</th>
                  </tr>
                </thead>
                <tbody>
                  {existingResults.map(r => (
                    <tr key={r._id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-2 text-slate-800 font-medium">
                        {r.studentId?.firstName} {r.studentId?.lastName}
                        <br /><span className="text-xs text-slate-400">{r.studentId?.enrollmentNo}</span>
                      </td>
                      <td className="py-3 px-2 text-center font-bold text-primary-600">{r.sgpa || '-'}</td>
                      <td className="py-3 px-2 text-center font-bold text-amber-600">{r.percentage ? r.percentage.toFixed(1) + '%' : '-'}</td>
                      <td className="py-3 px-2 text-center"><span className={r.status === 'pass' ? 'badge-green' : 'badge-red'}>{r.status?.toUpperCase() || 'PENDING'}</span></td>
                      <td className="py-3 px-2 text-xs text-slate-600">
                        {(r.subjectMarks || []).length === 0 ? '—' : (r.subjectMarks || []).map(sm => `${sm.subjectId?.code || '?'}: ${sm.totalMarks || '–'} (${sm.grade || '–'})`).join(' • ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
