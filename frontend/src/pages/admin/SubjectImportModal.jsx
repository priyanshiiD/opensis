import React, { useState, useMemo } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import {
  X, Upload, Download, CheckCircle, AlertTriangle, XCircle,
  FileSpreadsheet, ArrowLeft, RefreshCw, Layers, Check,
} from 'lucide-react';
import academicConfig from '../../../../shared/academicConfig.json';
import { DEPARTMENT_OPTIONS } from '../../constants/departments';

const SESSIONS = academicConfig.ACADEMIC_YEARS;
const YEARS = academicConfig.YEARS || [1, 2, 3, 4];
const SEMESTERS_BY_YEAR = academicConfig.SEMESTERS_BY_YEAR;

export default function SubjectImportModal({
  session: initialSession,
  branch: initialBranch,
  onClose,
  onDone,
}) {
  const [session, setSession] = useState(initialSession || SESSIONS[0]);
  const [branch, setBranch] = useState(initialBranch || '');
  const [year, setYear] = useState('1');
  const [semester, setSemester] = useState('1');
  const [updateMode, setUpdateMode] = useState('skip'); // 'skip' | 'update'

  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null); // { summary, rows }
  const [importResult, setImportResult] = useState(null);

  // Available semesters based on selected year
  const availableSemesters = useMemo(() => {
    return SEMESTERS_BY_YEAR[String(year)] || [1, 2];
  }, [year]);

  const handleYearChange = (newYear) => {
    setYear(newYear);
    const sems = SEMESTERS_BY_YEAR[String(newYear)] || [1, 2];
    setSemester(String(sems[0]));
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await api.get('/admin/subjects/import/template', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'subject-lab-import-template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download Excel template');
    }
  };

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (selected.size > 5 * 1024 * 1024) {
      toast.error('File size exceeds 5 MB limit');
      return;
    }
    const ext = selected.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      toast.error('Please upload an .xlsx, .xls, or .csv file');
      return;
    }
    setFile(selected);
  };

  const handlePreviewUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      toast.error('Please select an Excel or CSV file to upload');
      return;
    }
    if (!session || !branch || !semester) {
      toast.error('Please select Academic Year, Department, and Semester');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('session', session);
      formData.append('branch', branch);
      formData.append('semester', semester);
      formData.append('updateMode', updateMode);

      const { data } = await api.post('/admin/subjects/import/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setPreviewData(data.data);
      toast.success(`Parsed ${data.data.rows.length} rows`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to parse import file');
    } finally {
      setLoading(false);
    }
  };

  const handleRowChange = (index, field, value) => {
    if (!previewData) return;
    const updatedRows = [...previewData.rows];
    const target = { ...updatedRows[index], [field]: value };

    // Auto recalculations on change
    if (field === 'type') {
      const cr = Number(target.credits) || 0;
      if (value === 'lab') {
        target.l = 0; target.t = 0; target.p = cr * 2;
      } else {
        target.l = cr; target.t = 0; target.p = 0;
      }
    } else if (field === 'int' || field === 'ext') {
      const intVal = Number(field === 'int' ? value : target.int) || 0;
      const extVal = Number(field === 'ext' ? value : target.ext) || 0;
      target.total = intVal + extVal;
    } else if (field === 'credits') {
      const cr = Number(value) || 0;
      if (target.type === 'lab') {
        target.p = cr * 2;
      } else {
        target.l = cr;
      }
    }

    // Refresh row validation
    const errors = [];
    const warnings = [...(target.warnings || []).filter(w => !w.includes('Type conflict') && !w.includes('TOTAL marks'))];

    if (!String(target.code || '').trim()) errors.push('Course code is required');
    if (!String(target.name || '').trim()) errors.push('Course nomenclature is required');
    if (Number(target.int) < 0) errors.push('INT marks cannot be negative');
    if (Number(target.ext) < 0) errors.push('EXT marks cannot be negative');
    if (Number(target.credits) < 0) errors.push('Credits cannot be negative');

    target.errors = errors;
    target.status = errors.length > 0 ? 'error' : (warnings.length > 0 ? 'warning' : 'valid');

    updatedRows[index] = target;

    const summary = {
      total: updatedRows.length,
      valid: updatedRows.filter(r => r.status === 'valid').length,
      warnings: updatedRows.filter(r => r.status === 'warning').length,
      errors: updatedRows.filter(r => r.status === 'error').length,
      duplicates: updatedRows.filter(r => r.errors?.some(e => e.includes('Duplicate'))).length,
    };

    setPreviewData({ summary, rows: updatedRows });
  };

  const handleConfirmImport = async () => {
    if (!previewData || previewData.rows.length === 0) return;

    // Filter rows that are free of fatal errors
    const rowsToImport = previewData.rows.filter(r => r.status !== 'error');
    if (rowsToImport.length === 0) {
      toast.error('No valid or warning rows available to import. Please resolve the errors.');
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post('/admin/subjects/import/confirm', {
        session,
        branch,
        semester,
        updateMode,
        rows: rowsToImport,
      });

      setImportResult(data.data);
      toast.success(data.data.message || 'Import completed successfully');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Confirm import failed');
    } finally {
      setLoading(false);
    }
  };

  const canUpload = Boolean(session && branch && year && semester);
  const savableRowCount = previewData?.rows.filter(r => r.status !== 'error').length || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl my-8 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center text-primary-700">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Import Subjects &amp; Labs</h2>
              <p className="text-xs text-slate-500">
                Upload 7-column scheme file (.xlsx, .xls, .csv) for a single semester
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {!previewData && !importResult && (
            <>
              {/* Step 1: Selection Scope */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Step 1: Select Academic Scope
                  </span>
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="inline-flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-700 font-medium hover:underline"
                  >
                    <Download className="w-3.5 h-3.5" /> Download Excel Template
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="label">Academic Session *</label>
                    <select
                      value={session}
                      onChange={(e) => setSession(e.target.value)}
                      className="input"
                    >
                      {SESSIONS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="label">Department / Branch *</label>
                    <select
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      className="input"
                    >
                      <option value="">Select Department</option>
                      {DEPARTMENT_OPTIONS.map((dept) => (
                        <option key={dept.value} value={dept.value}>{dept.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="label">Year *</label>
                    <select
                      value={year}
                      onChange={(e) => handleYearChange(e.target.value)}
                      className="input"
                    >
                      {YEARS.map((y) => (
                        <option key={y} value={y}>Year {['I', 'II', 'III', 'IV'][y - 1] || y}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="label">Semester *</label>
                    <select
                      value={semester}
                      onChange={(e) => setSemester(e.target.value)}
                      className="input"
                    >
                      {availableSemesters.map((sem) => (
                        <option key={sem} value={sem}>Semester {sem}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Existing Records Mode */}
                <div className="pt-2 border-t border-slate-200/80 flex flex-wrap items-center gap-6">
                  <span className="text-xs font-semibold text-slate-700">Existing records:</span>
                  <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                    <input
                      type="radio"
                      name="updateMode"
                      value="skip"
                      checked={updateMode === 'skip'}
                      onChange={() => setUpdateMode('skip')}
                      className="text-primary-600 focus:ring-primary-500"
                    />
                    <span>Skip existing (default)</span>
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                    <input
                      type="radio"
                      name="updateMode"
                      value="update"
                      checked={updateMode === 'update'}
                      onChange={() => setUpdateMode('update')}
                      className="text-primary-600 focus:ring-primary-500"
                    />
                    <span>Update existing (preserves internal IDs)</span>
                  </label>
                </div>
              </div>

              {/* Step 2: Upload Zone */}
              <form onSubmit={handlePreviewUpload} className="space-y-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Step 2: Upload Scheme File
                </span>

                <div
                  className={`border-2 border-dashed rounded-2xl p-8 text-center transition-colors ${
                    !canUpload
                      ? 'border-slate-200 bg-slate-50/50 opacity-60 cursor-not-allowed'
                      : file
                      ? 'border-primary-400 bg-primary-50/30'
                      : 'border-slate-300 hover:border-primary-400 hover:bg-slate-50/50 cursor-pointer'
                  }`}
                >
                  <input
                    type="file"
                    id="import-file-input"
                    accept=".xlsx,.xls,.csv"
                    disabled={!canUpload}
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <label
                    htmlFor={canUpload ? 'import-file-input' : undefined}
                    className="flex flex-col items-center justify-center cursor-pointer"
                  >
                    <FileSpreadsheet className={`w-12 h-12 mb-3 ${file ? 'text-primary-600' : 'text-slate-400'}`} />
                    {file ? (
                      <div className="space-y-1">
                        <p className="font-semibold text-slate-800 text-sm">{file.name}</p>
                        <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
                        <span className="inline-block mt-2 text-xs text-primary-600 hover:underline">
                          Click to select a different file
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="font-semibold text-slate-700 text-sm">
                          {canUpload ? 'Click or drag file here to upload' : 'Complete scope selection above to enable upload'}
                        </p>
                        <p className="text-xs text-slate-400">Supported formats: .xlsx, .xls, .csv (Maximum 5 MB, 500 rows)</p>
                      </div>
                    )}
                  </label>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!canUpload || !file || loading}
                    className="btn-primary inline-flex items-center gap-2"
                  >
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
                    Upload &amp; Preview
                  </button>
                </div>
              </form>
            </>
          )}

          {/* Preview Section */}
          {previewData && !importResult && (
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                  <p className="text-xs text-slate-500">Total Rows</p>
                  <p className="text-lg font-bold text-slate-800">{previewData.summary.total}</p>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                  <p className="text-xs text-emerald-600">Valid</p>
                  <p className="text-lg font-bold text-emerald-700">{previewData.summary.valid}</p>
                </div>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center">
                  <p className="text-xs text-amber-600">Warnings</p>
                  <p className="text-lg font-bold text-amber-700">{previewData.summary.warnings}</p>
                </div>
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-center">
                  <p className="text-xs text-red-600">Errors</p>
                  <p className="text-lg font-bold text-red-700">{previewData.summary.errors}</p>
                </div>
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-center col-span-2 sm:col-span-1">
                  <p className="text-xs text-purple-600">Duplicates</p>
                  <p className="text-lg font-bold text-purple-700">{previewData.summary.duplicates}</p>
                </div>
              </div>

              {/* Informative Note */}
              <div className="flex items-center justify-between text-xs text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span>
                  Target: <strong>{branch}</strong> · Semester <strong>{semester}</strong> ({session}) · Mode: <strong>{updateMode === 'update' ? 'Update Existing' : 'Skip Existing'}</strong>
                </span>
                <span>Cells in the preview table below are editable prior to confirming.</span>
              </div>

              {/* Preview Table */}
              <div className="border border-slate-200 rounded-xl overflow-x-auto max-h-[46vh]">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 sticky top-0 z-10 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">Status</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">Code</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600 min-w-[180px]">Nomenclature</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">Type</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600 w-20">L-T-P</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600 w-16">INT</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600 w-16">EXT</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600 w-16">TOTAL</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600 w-16">Credits</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600 min-w-[140px]">Program &amp; Branch</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewData.rows.map((row, idx) => {
                      const isError = row.status === 'error';
                      const isWarning = row.status === 'warning';
                      const issues = [...(row.errors || []), ...(row.warnings || [])];

                      return (
                        <tr
                          key={idx}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isError ? 'bg-red-50/40' : isWarning ? 'bg-amber-50/30' : ''
                          }`}
                        >
                          {/* Status */}
                          <td className="px-3 py-2 align-top whitespace-nowrap">
                            <div className="flex flex-col gap-0.5">
                              {isError ? (
                                <span className="inline-flex items-center gap-1 font-semibold text-red-700">
                                  <XCircle className="w-3.5 h-3.5 text-red-500" /> Error
                                </span>
                              ) : isWarning ? (
                                <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Warning
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Valid
                                </span>
                              )}
                              {issues.length > 0 && (
                                <span className="text-[10px] text-slate-500 max-w-xs leading-tight" title={issues.join('\n')}>
                                  {issues[0]}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Code */}
                          <td className="px-2 py-1.5 align-top">
                            <input
                              type="text"
                              value={row.code}
                              onChange={(e) => handleRowChange(idx, 'code', e.target.value.toUpperCase())}
                              className="input text-xs py-1 px-2 font-mono font-bold"
                            />
                          </td>

                          {/* Name */}
                          <td className="px-2 py-1.5 align-top">
                            <input
                              type="text"
                              value={row.name}
                              onChange={(e) => handleRowChange(idx, 'name', e.target.value)}
                              className="input text-xs py-1 px-2"
                            />
                          </td>

                          {/* Type */}
                          <td className="px-2 py-1.5 align-top">
                            <select
                              value={row.type}
                              onChange={(e) => handleRowChange(idx, 'type', e.target.value)}
                              className="input text-xs py-1 px-2 font-semibold"
                            >
                              <option value="theory">Subject</option>
                              <option value="lab">Lab</option>
                            </select>
                          </td>

                          {/* L-T-P */}
                          <td className="px-2 py-1.5 align-top">
                            <input
                              type="text"
                              value={`${row.l}-${row.t}-${row.p}`}
                              onChange={(e) => {
                                const parts = e.target.value.split('-').map(p => Number(p) || 0);
                                handleRowChange(idx, 'l', parts[0] || 0);
                                handleRowChange(idx, 't', parts[1] || 0);
                                handleRowChange(idx, 'p', parts[2] || 0);
                              }}
                              className="input text-xs py-1 px-1.5 font-mono text-center"
                              title="Format: L-T-P"
                            />
                          </td>

                          {/* INT */}
                          <td className="px-2 py-1.5 align-top">
                            <input
                              type="number"
                              min="0"
                              value={row.int}
                              onChange={(e) => handleRowChange(idx, 'int', e.target.value)}
                              className="input text-xs py-1 px-1.5 text-right font-mono"
                            />
                          </td>

                          {/* EXT */}
                          <td className="px-2 py-1.5 align-top">
                            <input
                              type="number"
                              min="0"
                              value={row.ext}
                              onChange={(e) => handleRowChange(idx, 'ext', e.target.value)}
                              className="input text-xs py-1 px-1.5 text-right font-mono"
                            />
                          </td>

                          {/* TOTAL */}
                          <td className="px-3 py-2.5 align-top font-mono font-bold text-right text-slate-800">
                            {row.total}
                          </td>

                          {/* Credits */}
                          <td className="px-2 py-1.5 align-top">
                            <input
                              type="number"
                              min="0"
                              value={row.credits}
                              onChange={(e) => handleRowChange(idx, 'credits', e.target.value)}
                              className="input text-xs py-1 px-1.5 text-right font-mono font-semibold"
                            />
                          </td>

                          {/* Program & Branch */}
                          <td className="px-3 py-2.5 align-top text-slate-600 truncate max-w-xs" title={row.programAndBranch}>
                            {row.programAndBranch || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPreviewData(null)}
                  className="btn-secondary inline-flex items-center gap-1.5 text-xs"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Re-upload File
                </button>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">
                    Ready to save: <strong>{savableRowCount}</strong> row(s)
                  </span>
                  <button
                    type="button"
                    onClick={handleConfirmImport}
                    disabled={savableRowCount === 0 || loading}
                    className="btn-primary inline-flex items-center gap-2 text-xs"
                  >
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Confirm Import
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Result Section */}
          {importResult && (
            <div className="space-y-6 py-4 text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                <CheckCircle className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-800">Import Successful</h3>
                <p className="text-sm text-slate-600 max-w-md mx-auto">{importResult.message}</p>
              </div>

              <div className="flex justify-center gap-4 max-w-sm mx-auto">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex-1 text-center">
                  <p className="text-xs text-emerald-600 font-semibold">Created</p>
                  <p className="text-xl font-extrabold text-emerald-700">{importResult.created}</p>
                </div>
                <div className="p-3 bg-primary-50 border border-primary-200 rounded-xl flex-1 text-center">
                  <p className="text-xs text-primary-600 font-semibold">Updated</p>
                  <p className="text-xl font-extrabold text-primary-700">{importResult.updated}</p>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex-1 text-center">
                  <p className="text-xs text-slate-500 font-semibold">Skipped</p>
                  <p className="text-xl font-extrabold text-slate-700">{importResult.skipped}</p>
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    if (onDone) onDone();
                  }}
                  className="btn-primary px-8"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
