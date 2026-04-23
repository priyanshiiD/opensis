import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { BarChart3, Calculator, Award, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminResults() {
  const [results, setResults] = useState([]);
  const [semester, setSemester] = useState('5');
  const [session, setSession] = useState('2024-25');
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [tab, setTab] = useState('view');

  const loadResults = () => {
    setLoading(true);
    api.get(`/admin/results?semester=${semester}&session=${session}`)
      .then(r => setResults(r.data.data.results || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadResults();
  }, []);

  const handleCalculatePercentage = async () => {
    if (!semester || !session) return toast.error('Enter semester and session');
    setCalculating(true);
    try {
      const { data } = await api.post('/admin/results/calculate-percentage', {
        semester: Number(semester),
        session,
      });
      toast.success(`Calculated percentage for ${data.data.updated.length} results`);
      loadResults();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to calculate');
    }
    setCalculating(false);
  };

  const getStatusColor = (status) => {
    return status === 'pass' ? 'text-green-600' : status === 'fail' ? 'text-red-600' : 'text-gray-400';
  };

  const getGradeColor = (grade) => {
    if (['O', 'A+'].includes(grade)) return 'text-emerald-600 font-bold';
    if (['A', 'B+'].includes(grade)) return 'text-blue-600 font-bold';
    if (['B'].includes(grade)) return 'text-amber-600 font-bold';
    return 'text-red-600 font-bold';
  };

  const passCount = results.filter(r => r.status === 'pass').length;
  const failCount = results.filter(r => r.status === 'fail').length;
  const avgPercentage = results.length > 0 
    ? (results.reduce((sum, r) => sum + (r.percentage || 0), 0) / results.length).toFixed(1)
    : 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-800">Results Management</h1>
        <p className="text-slate-500 text-sm mt-1">View and calculate student results and percentages</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('view')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'view' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-600'
          }`}
        >
          View Results
        </button>
        <button
          onClick={() => setTab('calculate')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'calculate' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-600'
          }`}
        >
          Calculate Percentage
        </button>
      </div>

      {/* View Tab */}
      {tab === 'view' && (
        <>
          {/* Filters */}
          <div className="card mb-6">
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex-1">
                <label className="label">Semester</label>
                <input
                  type="number"
                  className="input"
                  value={semester}
                  onChange={e => setSemester(e.target.value)}
                  min="1"
                  max="8"
                />
              </div>
              <div className="flex-1">
                <label className="label">Session</label>
                <input
                  className="input"
                  value={session}
                  onChange={e => setSession(e.target.value)}
                  placeholder="e.g. 2024-25"
                />
              </div>
              <button onClick={loadResults} disabled={loading} className="btn-primary">
                {loading ? 'Loading...' : 'Load Results'}
              </button>
            </div>
          </div>

          {/* Summary Stats */}
          {results.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
              <div className="card bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-600 text-xs font-medium">Total Results</p>
                    <p className="text-3xl font-bold text-blue-700 mt-1">{results.length}</p>
                  </div>
                  <BarChart3 className="w-10 h-10 text-blue-300" />
                </div>
              </div>
              <div className="card bg-gradient-to-br from-green-50 to-green-100 border border-green-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-600 text-xs font-medium">Passed</p>
                    <p className="text-3xl font-bold text-green-700 mt-1">{passCount}</p>
                    <p className="text-xs text-green-600 mt-1">
                      {results.length > 0 ? ((passCount / results.length) * 100).toFixed(1) : 0}%
                    </p>
                  </div>
                  <Award className="w-10 h-10 text-green-300" />
                </div>
              </div>
              <div className="card bg-gradient-to-br from-red-50 to-red-100 border border-red-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-red-600 text-xs font-medium">Failed</p>
                    <p className="text-3xl font-bold text-red-700 mt-1">{failCount}</p>
                    <p className="text-xs text-red-600 mt-1">
                      {results.length > 0 ? ((failCount / results.length) * 100).toFixed(1) : 0}%
                    </p>
                  </div>
                  <AlertCircle className="w-10 h-10 text-red-300" />
                </div>
              </div>
              <div className="card bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-amber-600 text-xs font-medium">Avg Percentage</p>
                    <p className="text-3xl font-bold text-amber-700 mt-1">{avgPercentage}%</p>
                  </div>
                  <Calculator className="w-10 h-10 text-amber-300" />
                </div>
              </div>
            </div>
          )}

          {/* Results Table */}
          {loading ? (
            <div className="card text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
              <p className="text-slate-500 mt-3">Loading results...</p>
            </div>
          ) : results.length === 0 ? (
            <div className="card text-center py-12">
              <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No results found for this semester/session</p>
            </div>
          ) : (
            <div className="card">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="text-left py-3 px-3 text-slate-600 font-semibold">Student</th>
                      <th className="text-center py-3 px-3 text-slate-600 font-semibold">Enrollment</th>
                      <th className="text-center py-3 px-3 text-slate-600 font-semibold">SGPA</th>
                      <th className="text-center py-3 px-3 text-slate-600 font-semibold">Percentage</th>
                      <th className="text-center py-3 px-3 text-slate-600 font-semibold">Status</th>
                      <th className="text-left py-3 px-3 text-slate-600 font-semibold">Subjects</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map(r => (
                      <tr key={r._id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-3 px-3 font-medium text-slate-800">
                          {r.studentId?.firstName} {r.studentId?.lastName}
                        </td>
                        <td className="py-3 px-3 text-center text-slate-600 font-mono text-xs">
                          {r.studentId?.enrollmentNo}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="inline-block bg-primary-100 text-primary-700 px-3 py-1 rounded-full font-semibold">
                            {r.sgpa || '—'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="inline-block bg-amber-100 text-amber-700 px-3 py-1 rounded-full font-semibold">
                            {r.percentage ? r.percentage.toFixed(1) : '—'}%
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`inline-block px-3 py-1 rounded-full font-semibold text-white ${
                            r.status === 'pass' ? 'bg-green-600' :
                            r.status === 'fail' ? 'bg-red-600' :
                            'bg-gray-400'
                          }`}>
                            {r.status?.toUpperCase() || 'PENDING'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-xs text-slate-600">
                          {(r.subjectMarks || []).length === 0 ? (
                            <span className="text-gray-400">—</span>
                          ) : (
                            <div className="space-y-1">
                              {(r.subjectMarks || []).map((sm, i) => (
                                <div key={i}>
                                  {sm.subjectId?.code || '?'}: {sm.totalMarks || '–'} ({sm.grade || '–'})
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Calculate Tab */}
      {tab === 'calculate' && (
        <div className="card max-w-xl mx-auto">
          <div className="text-center mb-6">
            <Calculator className="w-12 h-12 text-primary-600 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-slate-800">Calculate Result Percentages</h3>
            <p className="text-sm text-slate-500 mt-1">
              This will calculate the overall percentage and SGPA for all students based on their subject marks.
              Once all subjects have marks, the aggregate percentage will be computed.
            </p>
          </div>

          <div className="space-y-4 bg-slate-50 p-4 rounded-lg mb-6">
            <div>
              <label className="label">Semester *</label>
              <input
                type="number"
                className="input"
                value={semester}
                onChange={e => setSemester(e.target.value)}
                min="1"
                max="8"
                required
              />
            </div>
            <div>
              <label className="label">Session *</label>
              <input
                className="input"
                value={session}
                onChange={e => setSession(e.target.value)}
                placeholder="e.g. 2024-25"
                required
              />
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800">
              <strong>How it works:</strong> The system will:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Check each student's subject marks</li>
                <li>Calculate weighted average percentage based on credits</li>
                <li>Compute SGPA (marks/10)</li>
                <li>Set status as PASS if all subjects ≥ 40, otherwise FAIL</li>
              </ul>
            </p>
          </div>

          <button
            onClick={handleCalculatePercentage}
            disabled={calculating || !semester || !session}
            className="btn-primary w-full"
          >
            <Calculator className="w-4 h-4" />
            {calculating ? 'Calculating...' : 'Calculate Percentages'}
          </button>
        </div>
      )}
    </div>
  );
}
