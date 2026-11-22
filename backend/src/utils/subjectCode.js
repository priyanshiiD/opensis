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

const normalizeBranch = (branch) => String(branch || '').trim().toUpperCase();

const getBranchPrefix = (branch) => {
  const normalized = normalizeBranch(branch);
  return BRANCH_PREFIXES[normalized] || '';
};

const yearForSemester = (semester) => {
  const sem = Number(semester);
  if (!Number.isInteger(sem) || sem < 1 || sem > 8) return null;
  return Math.ceil(sem / 2);
};

const validateSubjectCode = (code, branch, semester, { isCommon = false } = {}) => {
  const normalizedCode = String(code || '').trim().toUpperCase();
  if (!normalizedCode) return 'Subject/lab code is required';

  const normalizedBranch = normalizeBranch(branch);
  if (!normalizedBranch) return 'Select a valid department';

  if (normalizedBranch === 'MBA') {
    if (!/^MBA\d{4}$/.test(normalizedCode)) {
      return 'Invalid MBA code. Use format MBAXXXX with exactly four digits.';
    }
    return null;
  }

  const year = yearForSemester(semester);
  if (!year) return 'Select a valid semester (1-8)';

  if (!/^[A-Z]{2,4}[1-4]\d{4}$/.test(normalizedCode)) {
    return `Invalid code format. Use ${getBranchPrefix(normalizedBranch) || 'BRANCH'}${year}XXXX (branch prefix, year, and four digits).`;
  }

  const prefix = getBranchPrefix(normalizedBranch);
  if (!prefix) return 'Select a valid department';

  if (!isCommon && !normalizedCode.startsWith(`${prefix}${year}`)) {
    return `Invalid code for ${normalizedBranch}. It must start with ${prefix}${year}.`;
  }

  return null;
};

const normalizeSubjectCode = (code) => String(code || '').trim().toUpperCase();
const normalizeSubjectCodeForScheme = (code, branch, semester) => {
  const normalized = normalizeSubjectCode(code);
  const year = yearForSemester(semester);
  const prefix = getBranchPrefix(branch);
  if (!normalized || !year || !prefix) return normalized;

  if (normalizeBranch(branch) === 'MBA') {
    const digits = normalized.match(/\d+$/);
    return `MBA${String(digits ? digits[0] : '').padStart(4, '0').slice(-4)}`;
  }

  const currentPrefixMatch = normalized.match(/^([A-Z]+)(.*)$/);
  if (!currentPrefixMatch) return normalized;

  const rest = currentPrefixMatch[2];
  const digits = rest.match(/\d+$/)?.[0] || '';
  if (!digits) return normalized;

  let suffix;
  if (digits.length >= 5) {
    suffix = digits.slice(-4);
  } else {
    suffix = digits.padStart(4, '0');
  }

  if (/^[A-Z]{2,4}[1-4]\d{4}$/.test(normalized)) {
    const existingYear = normalized.match(/[A-Z]([1-4])\d{4}$/)?.[1];
    if (existingYear === String(year)) return normalized;
  }

  return `${prefix}${year}${suffix}`;
};

module.exports = {
  BRANCH_PREFIXES,
  getBranchPrefix,
  yearForSemester,
  validateSubjectCode,
  normalizeSubjectCode,
  normalizeSubjectCodeForScheme,
};
