const BRANCH_PREFIXES = {
  IT: 'IT',
  CSE: 'CS',
  CS: 'CS',
  ECE: 'EC',
  IP: 'IP',
  BM: 'BM',
  CIVIL: 'CE',
  CE: 'CE',
  MC: 'ME',
  ME: 'ME',
  MATHEMATICS: 'MA',
  MA: 'MA',
  PHYSICS: 'PY',
  PY: 'PY',
  CHEMISTRY: 'CH',
  CH: 'CH',
  'ELECTRICAL ENGINEERING': 'EE',
  EE: 'EE',
  HUMANITIES: 'HU',
  HU: 'HU',
  MBA: 'MBA',
};

export const getSubjectCodePrefix = (branch) => BRANCH_PREFIXES[String(branch || '').trim().toUpperCase()] || '';

export const getYearForSemester = (semester) => {
  const value = Number(semester);
  return Number.isInteger(value) && value >= 1 && value <= 8 ? Math.ceil(value / 2) : null;
};

export const validateSubjectCode = (code, branch, semester, { isCommon = false } = {}) => {
  const normalizedCode = String(code || '').trim().toUpperCase();
  const normalizedBranch = String(branch || '').trim().toUpperCase();
  if (!normalizedCode) return 'Subject/lab code is required';
  if (!normalizedBranch) return 'Select a valid department';

  if (normalizedBranch === 'MBA') {
    return /^MBA\d{4}$/.test(normalizedCode)
      ? null
      : 'Invalid MBA code. Use format MBAXXXX with exactly four digits.';
  }

  const year = getYearForSemester(semester);
  if (!year) return 'Select a valid semester (1-8)';
  if (!/^[A-Z]{2,4}[1-4]\d{4}$/.test(normalizedCode)) {
    const prefix = getSubjectCodePrefix(normalizedBranch) || 'BRANCH';
    return `Invalid code format. Use ${prefix}${year}XXXX (branch prefix, year, and four digits).`;
  }

  const prefix = getSubjectCodePrefix(normalizedBranch);
  if (!prefix) return 'Select a valid department';
  if (!isCommon && !normalizedCode.startsWith(`${prefix}${year}`)) {
    return `Invalid code for ${normalizedBranch}. It must start with ${prefix}${year}.`;
  }
  return null;
};
