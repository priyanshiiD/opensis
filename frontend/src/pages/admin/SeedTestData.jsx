import React, { useState } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { RefreshCw, CheckCircle, AlertCircle, Copy } from 'lucide-react';

/**
 * TEMPORARY: Test Data Seeder Component
 * Creates 10 dummy students and 10 dummy faculty for quick testing
 * REMOVE THIS IN PRODUCTION
 */
export default function SeedTestData() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [copiedIndex, setCopiedIndex] = useState(null);

  const handleSeed = async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/admin/seed-test-data');
      setResult(data.data);
      toast.success(`✅ Test data created: ${data.data.studentsCreated + data.data.facultyCreated} accounts`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to seed test data');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800">🧪 Test Data Seeder</h2>
        <p className="text-sm text-slate-500 mt-1">
          ⚠️ TEMPORARY - This feature is only for development/testing and should be removed in production
        </p>
      </div>

      {/* Seed Button */}
      {!result && (
        <div className="card mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-700">Generate Test Accounts</h3>
              <p className="text-sm text-slate-600 mt-1">
                Creates 10 test students + 10 test faculty instantly (if not already created)
              </p>
            </div>
            <button
              onClick={handleSeed}
              disabled={loading}
              className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Creating...' : 'Create Test Data'}
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="card text-center">
              <p className="text-sm text-slate-600 font-medium">Students Created</p>
              <p className="text-3xl font-bold text-emerald-600 mt-2">{result.studentsCreated}</p>
            </div>
            <div className="card text-center">
              <p className="text-sm text-slate-600 font-medium">Faculty Created</p>
              <p className="text-3xl font-bold text-emerald-600 mt-2">{result.facultyCreated}</p>
            </div>
            <div className="card text-center">
              <p className="text-sm text-slate-600 font-medium">Students Skipped</p>
              <p className="text-3xl font-bold text-amber-600 mt-2">{result.studentsSkipped}</p>
            </div>
            <div className="card text-center">
              <p className="text-sm text-slate-600 font-medium">Faculty Skipped</p>
              <p className="text-3xl font-bold text-amber-600 mt-2">{result.facultySkipped}</p>
            </div>
          </div>

          {/* Test Accounts - Students */}
          <div className="card">
            <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              Student Test Accounts (10 - Realistic Indian Names)
            </h3>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {result.testAccounts.students.map((student, idx) => (
                <div key={idx} className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <p className="font-medium text-slate-800 mb-2">{student.name}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Roll No</p>
                      <code className="text-xs bg-white px-2 py-1 rounded border border-slate-200 font-mono block mt-1">
                        {student.rollNo}
                      </code>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Email</p>
                      <div className="flex items-center gap-1 mt-1">
                        <code className="text-xs bg-white px-2 py-1 rounded border border-slate-200 font-mono flex-1 truncate">
                          {student.email}
                        </code>
                        <button
                          onClick={() => copyToClipboard(student.email, `email-${idx}`)}
                          className="p-1 hover:bg-slate-200 rounded flex-shrink-0"
                          title="Copy"
                        >
                          <Copy className={`w-4 h-4 ${copiedIndex === `email-${idx}` ? 'text-emerald-600' : 'text-slate-400'}`} />
                        </button>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Username</p>
                      <div className="flex items-center gap-1 mt-1">
                        <code className="text-xs bg-white px-2 py-1 rounded border border-slate-200 font-mono flex-1 truncate">
                          {student.username}
                        </code>
                        <button
                          onClick={() => copyToClipboard(student.username, `username-${idx}`)}
                          className="p-1 hover:bg-slate-200 rounded flex-shrink-0"
                          title="Copy"
                        >
                          <Copy className={`w-4 h-4 ${copiedIndex === `username-${idx}` ? 'text-emerald-600' : 'text-slate-400'}`} />
                        </button>
                      </div>
                    </div>
                    <div className="sm:col-span-2 md:col-span-3">
                      <p className="text-xs text-slate-500 font-medium">Password</p>
                      <div className="flex items-center gap-1 mt-1">
                        <code className="text-xs bg-white px-2 py-1 rounded border border-slate-200 font-mono flex-1">
                          {student.password}
                        </code>
                        <button
                          onClick={() => copyToClipboard(student.password, `password-student-${idx}`)}
                          className="p-1 hover:bg-slate-200 rounded flex-shrink-0"
                          title="Copy"
                        >
                          <Copy className={`w-4 h-4 ${copiedIndex === `password-student-${idx}` ? 'text-emerald-600' : 'text-slate-400'}`} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Test Accounts - Faculty */}
          <div className="card">
            <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              Faculty Test Accounts (10 - Realistic Indian Names)
            </h3>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {result.testAccounts.faculty.map((faculty, idx) => (
                <div key={idx} className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <p className="font-medium text-slate-800 mb-2">{faculty.name}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Employee ID</p>
                      <code className="text-xs bg-white px-2 py-1 rounded border border-slate-200 font-mono block mt-1">
                        {faculty.employeeId}
                      </code>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Email</p>
                      <div className="flex items-center gap-1 mt-1">
                        <code className="text-xs bg-white px-2 py-1 rounded border border-slate-200 font-mono flex-1 truncate">
                          {faculty.email}
                        </code>
                        <button
                          onClick={() => copyToClipboard(faculty.email, `email-fac-${idx}`)}
                          className="p-1 hover:bg-slate-200 rounded flex-shrink-0"
                          title="Copy"
                        >
                          <Copy className={`w-4 h-4 ${copiedIndex === `email-fac-${idx}` ? 'text-emerald-600' : 'text-slate-400'}`} />
                        </button>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Username</p>
                      <div className="flex items-center gap-1 mt-1">
                        <code className="text-xs bg-white px-2 py-1 rounded border border-slate-200 font-mono flex-1 truncate">
                          {faculty.username}
                        </code>
                        <button
                          onClick={() => copyToClipboard(faculty.username, `username-fac-${idx}`)}
                          className="p-1 hover:bg-slate-200 rounded flex-shrink-0"
                          title="Copy"
                        >
                          <Copy className={`w-4 h-4 ${copiedIndex === `username-fac-${idx}` ? 'text-emerald-600' : 'text-slate-400'}`} />
                        </button>
                      </div>
                    </div>
                    <div className="sm:col-span-2 md:col-span-3">
                      <p className="text-xs text-slate-500 font-medium">Password</p>
                      <div className="flex items-center gap-1 mt-1">
                        <code className="text-xs bg-white px-2 py-1 rounded border border-slate-200 font-mono flex-1">
                          {faculty.password}
                        </code>
                        <button
                          onClick={() => copyToClipboard(faculty.password, `password-fac-${idx}`)}
                          className="p-1 hover:bg-slate-200 rounded flex-shrink-0"
                          title="Copy"
                        >
                          <Copy className={`w-4 h-4 ${copiedIndex === `password-fac-${idx}` ? 'text-emerald-600' : 'text-slate-400'}`} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Errors if any */}
          {result.errors.length > 0 && (
            <div className="card bg-red-50 border border-red-200">
              <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                Errors ({result.errors.length})
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {result.errors.map((err, idx) => (
                  <div key={idx} className="text-sm bg-white p-2 rounded border border-red-200">
                    <p className="font-medium text-red-700">
                      {err.type} #{err.index}: {err.email}
                    </p>
                    <p className="text-red-600 text-xs mt-1">{err.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reset Button */}
          <button
            onClick={() => setResult(null)}
            className="btn btn-secondary w-full"
          >
            Create More Test Data
          </button>
        </div>
      )}

      {/* Info Box */}
      <div className="card bg-blue-50 border border-blue-200 mt-6">
        <h4 className="font-semibold text-blue-900 mb-2">ℹ️ How to Test</h4>
        <ol className="space-y-2 text-sm text-blue-800 list-decimal list-inside">
          <li>Click "Create Test Data" above to generate 10 students + 10 faculty</li>
          <li>Copy any email/username/password using the copy button</li>
          <li>Go to <span className="bg-white px-1 rounded font-mono">/login</span> and test login</li>
          <li>Test profile completion workflow with the created accounts</li>
          <li>Test bulk upload feature with Excel files</li>
        </ol>
      </div>

      {/* Warning Box */}
      <div className="card bg-amber-50 border border-amber-200 mt-4">
        <p className="text-sm text-amber-800 font-medium">
          ⚠️ Warning: This component should be removed before deploying to production. It's only for development and testing purposes.
        </p>
      </div>
    </div>
  );
}
