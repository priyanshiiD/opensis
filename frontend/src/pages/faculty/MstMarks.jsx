import React, { useEffect, useRef, useState } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import {
  AlertCircle, CheckCircle2, Download, FileSpreadsheet, Loader2, Lock,
  RefreshCw, Save, Send, Upload,
} from 'lucide-react';
import toast from 'react-hot-toast';

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const ASSESSMENTS = [
  { value: 'mst1', label: 'MST 1' },
  { value: 'mst2', label: 'MST 2' },
];

const statusBadge = (status) => (
  status === 'published'
    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
    : 'bg-amber-50 text-amber-700 border border-amber-200'
);

export default function FacultyMstMarks() {
  const { selectedSession, selectedTerm } = useAuth();
  const [options, setOptions] = useState([]);
  const [marks, setMarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMarks, setLoadingMarks] = useState(false);
  const [assignmentId, setAssignmentId] = useState('');
  const [assessment, setAssessment] = useState('mst1');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishingId, setPublishingId] = useState('');
  const [publishFailures, setPublishFailures] = useState([]);
  const [downloading, setDownloading] = useState(false);
  const fileRef = useRef(null);

  const loadOptions = async () => {
    const { data } = await api.get('/faculty/mst-marks/options');
    const nextOptions = data.data.options || [];
    setOptions(nextOptions);
    setAssignmentId((current) => (
      nextOptions.some((option) => String(option.assignmentId) === String(current))
        ? current
        : String(nextOptions[0]?.assignmentId || '')
    ));
  };

  const loadMarks = async () => {
    setLoadingMarks(true);
    try {
      const { data } = await api.get('/faculty/mst-marks');
      setMarks(data.data.marks || []);
    } finally {
      setLoadingMarks(false);
    }
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFile(null);
    setPreview(null);
    setPublishFailures([]);
    if (fileRef.current) fileRef.current.value = '';
    Promise.all([loadOptions(), loadMarks()])
      .catch(() => {
        if (active) toast.error('Failed to load MST marks');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [selectedSession, selectedTerm]);

  const resetPreview = () => {
    setPreview(null);
    setPublishFailures([]);
  };

  const handleFileChange = (event) => {
    const selected = event.target.files?.[0];
    if (!selected) {
      setFile(null);
      resetPreview();
      return;
    }
    const ext = selected.name.substring(selected.name.lastIndexOf('.')).toLowerCase();
    if (!['.xlsx', '.xls', '.csv'].includes(ext)) {
      toast.error('Please upload an Excel or CSV file (.xlsx, .xls, .csv)');
      event.target.value = '';
      setFile(null);
      return;
    }
    setFile(selected);
    resetPreview();
  };

  const buildFormData = () => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('assignmentId', assignmentId);
    formData.append('assessment', assessment);
    return formData;
  };

  const handlePreview = async () => {
    if (!assignmentId) return toast.error('Select a class/section first.');
    if (!file) return toast.error('Choose the Excel/CSV file to upload.');
    setPreviewing(true);
    setPublishFailures([]);
    try {
      const { data } = await api.post('/faculty/mst-marks/preview', buildFormData(), {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPreview(data.data);
      toast.success(`Preview ready: ${data.data.stats.validCount} valid row(s)`);
    } catch (err) {
      setPreview(null);
      toast.error(err.response?.data?.message || 'Failed to preview the uploaded file');
    } finally {
      setPreviewing(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!preview) return toast.error('Preview the file before saving a draft.');
    if (preview.failed.length > 0) return toast.error('Fix all invalid rows before saving the draft.');
    setSaving(true);
    try {
      const { data } = await api.post('/faculty/mst-marks/upload', buildFormData(), {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(data.message || 'MST draft saved');
      setPreview(null);
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      await loadMarks();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save MST draft');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadTemplate = async () => {
    if (!assignmentId) return toast.error('Select a class/section first.');
    setDownloading(true);
    try {
      const response = await api.get('/faculty/mst-marks/template', {
        params: { assignmentId, assessment },
        responseType: 'blob',
      });
      const disposition = response.headers?.['content-disposition'] || '';
      const match = disposition.match(/filename="?([^";]+)"?/i);
      const filename = match?.[1] || `MST-${assessment.toUpperCase()}.xlsx`;
      const url = URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to download the template');
    } finally {
      setDownloading(false);
    }
  };

  const handlePublish = async (mark) => {
    if (!window.confirm(
      `Publish ${mark.assessment === 'mst2' ? 'MST 2' : 'MST 1'} marks for ${mark.subjectId?.code || 'this subject'}? `
      + 'This will update the subject CW and totals in student results.',
    )) return;
    setPublishingId(mark._id);
    setPublishFailures([]);
    try {
      const { data } = await api.post(`/faculty/mst-marks/${mark._id}/publish`);
      toast.success(data.message || 'MST marks published');
      await loadMarks();
    } catch (err) {
      const failed = err.response?.data?.data?.failed || [];
      setPublishFailures(failed);
      toast.error(err.response?.data?.message || 'Failed to publish MST marks');
    } finally {
      setPublishingId('');
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">MST Marks</h1>
        <p className="text-slate-500 text-sm mt-1">
          Upload MST 1 / MST 2 marks, review the draft, and publish them into student results
        </p>
      </div>

      <div className="card mb-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-9 h-9 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-800">Upload MST Marks</h2>
            <p className="text-xs text-slate-500">Excel/CSV upload is validated against your assigned class roster.</p>
          </div>
        </div>

        {options.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            No class assignments were found for this session and term. Ask the administration to assign your subject.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="label">Class / Section</label>
                <select
                  className="input"
                  value={assignmentId}
                  onChange={(event) => {
                    setAssignmentId(event.target.value);
                    resetPreview();
                  }}
                >
                  {options.map((option) => (
                    <option key={option.assignmentId} value={option.assignmentId}>
                      {option.subjectCode} · {option.subjectName} · Sem {option.semester} · {option.sectionLabel}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Assessment</label>
                <select
                  className="input"
                  value={assessment}
                  onChange={(event) => {
                    setAssessment(event.target.value);
                    resetPreview();
                  }}
                >
                  {ASSESSMENTS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="label">Excel / CSV File</label>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="input text-xs"
                  onChange={handleFileChange}
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Required column: <span className="font-mono">enrollmentNo</span> and{' '}
                  <span className="font-mono">{assessment === 'mst2' ? 'MST 2' : 'MST 1'} (20)</span>
                </p>
              </div>
              <div className="flex items-end">
                <button type="button" onClick={handleDownloadTemplate} disabled={downloading} className="btn-secondary w-full">
                  {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Download Pre-filled Template
                </button>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2 mt-4">
              <button type="button" onClick={handlePreview} disabled={previewing || !file} className="btn-secondary">
                {previewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {previewing ? 'Validating...' : 'Preview / Validate'}
              </button>
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={saving || !preview || preview.failed.length > 0}
                className="btn-primary"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Saving...' : 'Save Draft'}
              </button>
            </div>
          </>
        )}

        {preview && (
          <div className="mt-5 border-t border-slate-100 pt-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {preview.assignment.subjectCode} · {preview.assignment.subjectName}
                </p>
                <p className="text-xs text-slate-500">
                  {preview.assessmentLabel} · Sem {preview.assignment.semester} · {preview.assignment.sectionLabel}
                  {' '}· Roster {preview.rosterCount}
                </p>
              </div>
              <div className="flex gap-2 text-xs">
                <span className="rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1">
                  {preview.stats.validCount} valid
                </span>
                <span className={`rounded-full px-3 py-1 border ${preview.stats.failedCount ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                  {preview.stats.failedCount} invalid
                </span>
              </div>
            </div>

            {preview.failed.length > 0 && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs max-h-44 overflow-y-auto">
                <div className="flex items-center gap-1.5 text-rose-700 font-semibold mb-2">
                  <AlertCircle className="w-4 h-4" /> Fix these rows before saving:
                </div>
                {preview.failed.map((failure, index) => (
                  <p key={index} className="text-rose-600 pl-5">
                    Row {failure.row}{failure.enrollmentNo ? ` (${failure.enrollmentNo})` : ''} — {failure.reason}
                  </p>
                ))}
              </div>
            )}

            <div className="overflow-x-auto max-h-64 overflow-y-auto border border-slate-200 rounded-xl">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2">Enrollment No</th>
                    <th className="text-left px-3 py-2">Student</th>
                    <th className="text-center px-3 py-2">{preview.assessmentLabel} / {preview.maxMarks}</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.valid.map((row) => (
                    <tr key={`${row.studentId}-${row.enrollmentNo}`} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-mono">{row.enrollmentNo}</td>
                      <td className="px-3 py-2">{row.studentName}</td>
                      <td className="px-3 py-2 text-center font-semibold">{row.marks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.failed.length === 0 && (
              <p className="text-xs text-emerald-700 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> All rows are valid. Save the draft, then publish when you are ready.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="card">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="font-semibold text-slate-800">MST Uploads</h2>
            <p className="text-xs text-slate-500">Drafts are private until published</p>
          </div>
          <button type="button" onClick={loadMarks} disabled={loadingMarks} className="btn-secondary text-xs">
            {loadingMarks ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh
          </button>
        </div>

        {publishFailures.length > 0 && (
          <div className="mb-4 bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs max-h-44 overflow-y-auto">
            <div className="flex items-center gap-1.5 text-rose-700 font-semibold mb-2">
              <AlertCircle className="w-4 h-4" /> This draft could not be published:
            </div>
            {publishFailures.map((failure, index) => (
              <p key={index} className="text-rose-600 pl-5">
                {failure.enrollmentNo} {failure.studentName ? `(${failure.studentName})` : ''} — {failure.reason}
              </p>
            ))}
          </div>
        )}

        {marks.length === 0 ? (
          <div className="text-center py-10">
            <FileSpreadsheet className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No MST marks uploaded for this session and term yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-3 py-2">Subject</th>
                  <th className="text-left px-3 py-2">Assessment</th>
                  <th className="text-left px-3 py-2">Class / Section</th>
                  <th className="text-center px-3 py-2">Students</th>
                  <th className="text-center px-3 py-2">Status</th>
                  <th className="text-left px-3 py-2">Updated</th>
                  <th className="text-right px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {marks.map((mark) => (
                  <tr key={mark._id} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-3">
                      <p className="font-medium text-slate-800">{mark.subjectId?.code || 'Subject'}</p>
                      <p className="text-xs text-slate-500">{mark.subjectId?.name}</p>
                    </td>
                    <td className="px-3 py-3 font-medium">{mark.assessment === 'mst2' ? 'MST 2' : 'MST 1'}</td>
                    <td className="px-3 py-3 text-xs text-slate-600">
                      Sem {mark.semester} · {mark.sectionLabel || (mark.section ? `Section ${mark.section}` : 'All sections')}
                    </td>
                    <td className="px-3 py-3 text-center">{mark.marks?.length || 0}</td>
                    <td className="px-3 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium capitalize ${statusBadge(mark.status)}`}>
                        {mark.status === 'published' && <Lock className="w-3 h-3" />}
                        {mark.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500">
                      {formatDate(mark.status === 'published' ? mark.publishedAt : mark.updatedAt)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {mark.status === 'published' ? (
                        <span className="text-xs text-slate-400">Locked</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handlePublish(mark)}
                          disabled={publishingId === mark._id}
                          className="btn-primary text-xs"
                        >
                          {publishingId === mark._id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                          Publish
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
