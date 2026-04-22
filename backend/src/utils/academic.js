/**
 * Returns current session and semester period based on calendar month.
 * Jul-Dec → first semester of session (e.g., "Jul-Dec" in session "2025-26")
 * Jan-May → second semester of session (e.g., "Jan-May" in session "2025-26")
 */
function getCurrentSessionPeriod() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  if (month >= 7) {
    return { session: `${year}-${String(year + 1).slice(-2)}`, semester: 'Jul-Dec' };
  } else {
    return { session: `${year - 1}-${String(year).slice(-2)}`, semester: 'Jan-May' };
  }
}

/**
 * Converts year (1-4) + period ("Jan-May"/"Jul-Dec") to semester number (1-8).
 * Year 1 Jul-Dec = 1, Year 1 Jan-May = 2, Year 2 Jul-Dec = 3 ... Year 4 Jan-May = 8
 */
function getSemesterNumber(year, period) {
  return (Number(year) - 1) * 2 + (period === 'Jan-May' ? 2 : 1);
}

/**
 * Inverse: semester number (1-8) → { year, period }
 */
function fromSemesterNumber(semNum) {
  const year = Math.ceil(semNum / 2);
  const period = semNum % 2 === 0 ? 'Jan-May' : 'Jul-Dec';
  return { year, period };
}

module.exports = { getCurrentSessionPeriod, getSemesterNumber, fromSemesterNumber };
