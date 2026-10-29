import React, { useMemo, useState } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import {
  AlertTriangle, ArrowLeft, CheckCircle2, Download, FileSpreadsheet, FileText,
  Loader2, Upload, X, XCircle,
} from 'lucide-react';
import academicConfig from '../../../../shared/academicConfig.json';
import { getDepartmentLabel } from '../../constants/departments';

const SESSIONS = academicConfig.ACADEMIC_YEARS;
const BRANCHES = academicConfig.DEPARTMENTS;
const YEARS = [1, 2, 3, 4];
const SEMESTERS_BY_YEAR = academicConfig.SEMESTERS_BY_YEAR;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.csv', '.pdf'];

const fieldClass = 'w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-primary-400 focus:outline-none';

const statusBadge = (status) => {
  if (status === 'error') {
    return <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700"><XCircle className="h-3 w-3" />Error</span>;
  }
  if (status === 'warning') {
    return <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700"><AlertTriangle className="h-3 w-3" />Warning</span>;
  }
  return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700"><CheckCircle2 className="h-3 w-3" />Valid</span>;
};

const summarizeRows = (rows) => ({
  total: rows.length,
  valid: rows.filter((row) => row.status !== 'error').length,
  warnings: rows.filter((row) => row.status === 'warning').length,
  errors: rows.filter((row) => row.status === 'error').length,
  duplicates: rows.filter((row) => row.duplicate).length,
});

const SummaryCard = ({ label, value, tone = 'slate' }) => {
  const tones = {
    slate: 'bg-slate-50 text-slate-700 border-slate-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    primary: 'bg-primary-50 text-primary-700 border-primary-200',
  };
  return (
    <div className={`rounded-xl border px-4 py-3 ${tones[tone]}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide opacity-75">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
};

export default function SubjectImportModal({ session: initialSession, branch: initialBranch, onClose, onDone }) {
  const [step, setStep] = useState('setup');
  const [session, setSession] = useState(initialSession || SESSIONS[0]);
  const [branch, setBranch] = useState(initialBranch || '');
  const [year, setYear] = useState(1);
  const [semester, setSemester] = useState(1);
  const [updateMode, setUpdateMode] = useState('skip');
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState([]);
  const [fileType, setFileType] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const semesters = SEMESTERS_BY_YEAR[String(year)] || [];
  const summary = useMemo(() => summarizeRows(rows), [rows]);
  const selectionsComplete = Boolean(session && branch && year && semester);

  const changeYear = (value) => {
    const nextYear = Number(value);
    setYear(nextYear);
    const available = SEMESTERS_BY_YEAR[String(nextYear)] || [];
    if (!available.includes(Number(semester))) setSemester(available[0] || 1);
  };

  const handleFileChange = (event) => {
    const selected = event.target.files?.[0] || null;
    setError('');
    if (!selected) {
      setFile(null);
      return;
    }
    const extension = `.${selected.name.split('.').pop().toLowerCase()}`;
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      setFile(null);
      setError('Invalid file type. Upload an .xlsx, .xls, .csv or .pdf file.');
      return;
    }
    if (selected.size > MAX_FILE_SIZE) {
      setFile(null);
      setError('File size limit exceeded. Maximum size is 5 MB.');
      return;
    }
    setFile(selected);
  };

  const downloadTemplate = async () => {
    try {
      const response = await api.get('/admin/subjects/import/template', { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'subject-lab-import-template.xlsx';
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Could not download the import template.');
    }
  };

  const requestPreview = async () => {
    if (!file || !selectionsComplete) return;
    setLoading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('session', session);
      formData.append('branch', branch);
      formData.append('year', String(year));
      formData.append('semester', String(semester));
      formData.append('updateMode', updateMode);
      const { data } = await api.post('/admin/subjects/import/preview', formData);
      setRows(data.data.rows || []);
      setFileType(data.data.fileType || '');
      setStep('preview');
    } catch (err) {
      const message = err.response?.data?.message || 'The file could not be processed.';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const updateRowValues = (index, field, value) => {
    setRows((previous) => previous.map((row, rowIndex) => {
      if (rowIndex !== index) return row;
      const values = { ...row.values, [field]: value };
      if (field === 'ltp') {
        const parts = String(value).split(/[^0-9.]+/).filter(Boolean);
        values.l = Number(parts[0] || 0);
        values.t = Number(parts[1] || 0);
        values.p = Number(parts[2] || 0);
        values.ltp = `${values.l}-${values.t}-${values.p}`;
      }
      if (field === 'semester') values.semester = value === '' ? '' : Number(value);
      if (field === 'year') values.year = value === '' ? '' : Number(value);
      return {
        ...row,
        values,
        status: 'warning',
        action: 'create',
        duplicate: false,
        errors: [],
        warnings: ['This row was edited locally. It will be revalidated when the import is confirmed.'],
      };
    }));
  };

  const confirmImport = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/admin/subjects/import/confirm', {
        session,
        branch,
        year,
        semester,
        updateMode,
        rows: rows.map((row) => ({ rowNumber: row.rowNumber, values: row.values })),
      });
      setResult(data.data);
      setStep('result');
      toast.success('Import completed.');
    } catch (err) {
      const message = err.response?.data?.message || 'The import could not be completed.';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const finish = () => {
    onDone?.({ session, branch });
  };

  const resetToSetup = () => {
    setStep('setup');
    setRows([]);
    setResult(null);
    setError('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary-100 p-2 text-primary-700">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-800">Import Subjects and Labs</h2>
              <p className="text-xs text-slate-500">
                Preview and validate the file before saving. Existing manual add, edit and delete flows are unchanged.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:text-slate-600" aria-label="Close import dialog">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === 'setup' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div>
                  <label className="label">Academic Year *</label>
                  <select className="input" value={session} onChange={(event) => setSession(event.target.value)}>
                    {SESSIONS.map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Department *</label>
                  <select className="input" value={branch} onChange={(event) => setBranch(event.target.value)}>
                    <option value="">Select Department</option>
                    {BRANCHES.map((value) => <option key={value} value={value}>{getDepartmentLabel(value)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Year *</label>
                  <select className="input" value={year} onChange={(event) => changeYear(event.target.value)}>
                    {YEARS.map((value) => <option key={value} value={value}>Year {value}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Semester *</label>
                  <select className="input" value={semester} onChange={(event) => setSemester(Number(event.target.value))}>
                    {semesters.map((value) => <option key={value} value={value}>Semester {value}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="label">Existing Records</label>
                  <select className="input" value={updateMode} onChange={(event) => setUpdateMode(event.target.value)}>
                    <option value="skip">Skip existing</option>
                    <option value="update">Update existing</option>
                  </select>
                  <p className="mt-1 text-xs text-slate-500">
                    This controls codes that already exist in the selected academic year, department and semester.
                  </p>
                </div>
                <div className="flex items-end">
                  <button type="button" onClick={downloadTemplate} className="btn-secondary">
                    <Download className="h-4 w-4" /> Download Excel Template
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-5">
                <div className="flex flex-col items-center justify-center gap-2 text-center">
                  <FileSpreadsheet className="h-8 w-8 text-primary-500" />
                  <p className="text-sm font-semibold text-slate-700">Upload the completed import file</p>
                  <p className="text-xs text-slate-500">Accepted formats: .xlsx, .xls, .csv and .pdf. Maximum size: 5 MB.</p>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv,.pdf"
                    onChange={handleFileChange}
                    disabled={!selectionsComplete || loading}
                    className="mt-2 block w-full max-w-xl cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-60"
                  />
                  {!selectionsComplete && (
                    <p className="text-xs text-slate-500">
                      Select the academic year, department, year and semester before uploading a file.
                    </p>
                  )}
                  {file && (
                    <p className="text-xs text-slate-600">
                      Selected file: <span className="font-medium">{file.name}</span> ({Math.ceil(file.size / 1024)} KB)
                    </p>
                  )}
                  {file?.name.toLowerCase().endsWith('.pdf') && (
                    <p className="text-xs text-amber-700">
                      Text-based PDFs are supported. Scanned PDFs must be converted to Excel before import.
                    </p>
                  )}
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                <p className="text-xs text-slate-500">
                  Nothing is saved until the preview is reviewed and the import is confirmed.
                </p>
                <button
                  type="button"
                  onClick={requestPreview}
                  disabled={!file || !selectionsComplete || loading}
                  className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {loading ? 'Validating...' : 'Upload and Preview'}
                </button>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-800">Import Preview</h3>
                  <p className="text-xs text-slate-500">
                    {session} · {getDepartmentLabel(branch)} · Year {year} · Semester {semester} · {fileType === 'pdf' ? 'PDF' : fileType === 'csv' ? 'CSV' : 'Excel'}
                    {' · '}Existing records: {updateMode === 'update' ? 'Update' : 'Skip'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setStep('setup')} className="btn-secondary">
                    <ArrowLeft className="h-4 w-4" /> Back
                  </button>
                  <button
                    type="button"
                    onClick={confirmImport}
                    disabled={loading || summary.valid === 0}
                    className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    {loading ? 'Importing...' : 'Confirm Import'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                <SummaryCard label="Total Rows" value={summary.total} />
                <SummaryCard label="Valid Rows" value={summary.valid} tone="emerald" />
                <SummaryCard label="Warnings" value={summary.warnings} tone="amber" />
                <SummaryCard label="Errors" value={summary.errors} tone="red" />
                <SummaryCard label="Duplicates" value={summary.duplicates} tone="primary" />
              </div>

              <div className="rounded-lg border border-primary-100 bg-primary-50 px-4 py-3 text-xs text-primary-800">
                Only valid and warning rows will be imported. Rows with errors will be skipped and reported.
                For PDF imports, you may correct a value directly in the preview before confirming.
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-[1500px] w-full text-xs">
                  <thead className="bg-slate-50 text-left text-[10px] uppercase tracking-wide text-slate-500">
                    <tr>
                      {['Row', 'Status', 'Code', 'Subject Name', 'Type', 'L-T-P', 'Credits', 'Theory End', 'CW', 'Practical End', 'SW', 'Total', 'Faculty', 'Semester', 'Year', 'Syllabus', 'Messages'].map((header) => (
                        <th key={header} className="whitespace-nowrap px-2 py-2 font-semibold">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => (
                      <tr key={`${row.rowNumber}-${index}`} className="border-t border-slate-100 align-top">
                        <td className="px-2 py-2 text-slate-500">{row.rowNumber}</td>
                        <td className="px-2 py-2">{statusBadge(row.status)}</td>
                        <td className="px-2 py-2">
                          <input className={`${fieldClass} min-w-[92px] font-mono uppercase`} value={row.values.code ?? ''} onChange={(event) => updateRowValues(index, 'code', event.target.value)} />
                        </td>
                        <td className="px-2 py-2">
                          <input className={`${fieldClass} min-w-[210px]`} value={row.values.name ?? ''} onChange={(event) => updateRowValues(index, 'name', event.target.value)} />
                        </td>
                        <td className="px-2 py-2">
                          <select className={`${fieldClass} min-w-[90px]`} value={row.values.type || 'subject'} onChange={(event) => updateRowValues(index, 'type', event.target.value)}>
                            <option value="subject">Subject</option>
                            <option value="lab">Lab</option>
                          </select>
                        </td>
                        <td className="px-2 py-2">
                          <input className={`${fieldClass} min-w-[64px] text-center`} value={row.values.ltp ?? ''} onChange={(event) => updateRowValues(index, 'ltp', event.target.value)} />
                        </td>
                        {['credits', 'theoryEnd', 'cw', 'practicalEnd', 'sw', 'total'].map((field) => (
                          <td key={field} className="px-2 py-2">
                            <input type="number" min="0" className={`${fieldClass} w-[70px] tabular-nums`} value={row.values[field] ?? ''} onChange={(event) => updateRowValues(index, field, event.target.value === '' ? '' : Number(event.target.value))} />
                          </td>
                        ))}
                        <td className="px-2 py-2">
                          <input className={`${fieldClass} min-w-[190px]`} value={row.values.faculty ?? ''} onChange={(event) => updateRowValues(index, 'faculty', event.target.value)} placeholder="Names or emails" />
                        </td>
                        <td className="px-2 py-2">
                          <input type="number" min="1" max="8" className={`${fieldClass} w-[64px]`} value={row.values.semester ?? ''} onChange={(event) => updateRowValues(index, 'semester', event.target.value)} />
                        </td>
                        <td className="px-2 py-2">
                          <input type="number" min="1" max="4" className={`${fieldClass} w-[64px]`} value={row.values.year ?? ''} onChange={(event) => updateRowValues(index, 'year', event.target.value)} />
                        </td>
                        <td className="px-2 py-2">
                          <input className={`${fieldClass} min-w-[180px]`} value={row.values.syllabus ?? ''} onChange={(event) => updateRowValues(index, 'syllabus', event.target.value)} />
                        </td>
                        <td className="px-2 py-2">
                          <div className="min-w-[260px] space-y-1">
                            {row.errors.map((message, messageIndex) => (
                              <p key={`error-${messageIndex}`} className="flex gap-1 text-red-700"><XCircle className="mt-0.5 h-3 w-3 flex-shrink-0" />{message}</p>
                            ))}
                            {row.warnings.map((message, messageIndex) => (
                              <p key={`warning-${messageIndex}`} className="flex gap-1 text-amber-700"><AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" />{message}</p>
                            ))}
                            {!row.errors.length && !row.warnings.length && <span className="text-emerald-700">Ready to import.</span>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {step === 'result' && result && (
            <div className="space-y-5">
              <div>
                <h3 className="font-semibold text-slate-800">Import Result</h3>
                <p className="text-xs text-slate-500">
                  {session} · {getDepartmentLabel(branch)} · Year {year} · Semester {semester}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <SummaryCard label="Created" value={result.summary?.created || 0} tone="emerald" />
                <SummaryCard label="Updated" value={result.summary?.updated || 0} tone="primary" />
                <SummaryCard label="Skipped" value={result.summary?.skipped || 0} tone="amber" />
                <SummaryCard label="Errors in File" value={result.summary?.errors || 0} tone="red" />
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Row</th>
                      <th className="px-3 py-2 font-semibold">Code</th>
                      <th className="px-3 py-2 font-semibold">Result</th>
                      <th className="px-3 py-2 font-semibold">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(result.results || []).map((item, index) => (
                      <tr key={`${item.rowNumber}-${index}`} className="border-t border-slate-100">
                        <td className="px-3 py-2 text-slate-500">{item.rowNumber}</td>
                        <td className="px-3 py-2 font-mono text-xs text-slate-700">{item.code}</td>
                        <td className="px-3 py-2">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                            item.action === 'created'
                              ? 'bg-emerald-100 text-emerald-700'
                              : item.action === 'updated'
                                ? 'bg-primary-100 text-primary-700'
                                : 'bg-amber-100 text-amber-700'
                          }`}>
                            {item.action}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-600">{item.reason || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                <button type="button" onClick={resetToSetup} className="btn-secondary">
                  <FileText className="h-4 w-4" /> Import Another File
                </button>
                <button type="button" onClick={finish} className="btn-primary">
                  <CheckCircle2 className="h-4 w-4" /> Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
