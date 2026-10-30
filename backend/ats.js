// ATS-style CV screening: compares a candidate's CV and profile with the vacancy's requirements.
const RANK = { none: 0, matric: 1, certificate: 2, diploma: 3, degree: 4 };
function levelOf(t) {
  if (/\b(phd|doctorate|master'?s|honours|bachelor|degree|b\.?\s?(com|sc|a|tech|ed)\b)/.test(t)) return 'degree';
  if (/\b(diploma|n\.?\s?dip)\b/.test(t)) return 'diploma';
  if (/\b(certificate|certification|nqf)\b/.test(t)) return 'certificate';
  if (/\b(matric|grade 12|national senior certificate|nsc)\b/.test(t)) return 'matric';
  return 'none';
}
function yearsOf(t) {
  const thisYear = new Date().getFullYear();
  const said = [...t.matchAll(/(\d{1,2})\+?\s*(?:years?|yrs?)\b/g)].map(m => +m[1]).filter(n => n <= 40);
  let spans = 0;
  for (const m of t.matchAll(/\b((?:19|20)\d{2})\s*(?:-|–|to)\s*((?:19|20)\d{2}|present|current|date)\b/g)) {
    const a = +m[1], b = /^\d/.test(m[2]) ? +m[2] : thisYear;
    if (b >= a && b - a <= 40) spans += b - a;
  }
  return Math.min(40, Math.max(0, ...said, spans));
}
function screen(job, user, app) {
  const text = [user.cvText, user.experience, user.education, user.certifications].filter(Boolean).join(' ').toLowerCase();
  const have = String(user.skills || app.skills || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const skills = job.skills || [], matched = [], missing = [];
  for (const s of skills) (have.includes(s.toLowerCase()) || text.includes(s.toLowerCase()) ? matched : missing).push(s);
  const years = yearsOf(text), minYears = +job.minYears || 0, level = levelOf(text), need = String(job.qualification || 'None');
  const skillPart = skills.length ? matched.length / skills.length : 1;
  const expPart = minYears ? Math.min(1, years / minYears) : 1;
  const qualOk = RANK[level] >= (RANK[need.toLowerCase()] || 0);
  const flags = [];
  if (!text) flags.push('No CV on file, so experience and qualifications could not be checked');
  if (missing.length) flags.push(`Skills not found: ${missing.join(', ')}`);
  if (text && minYears && years < minYears) flags.push(`Experience found (${years} yr) is below the ${minYears} yr required`);
  if (text && !qualOk) flags.push(`Required qualification not found: ${need}`);
  return { score: Math.round(100 * (0.6 * skillPart + 0.2 * expPart + 0.2 * (qualOk ? 1 : 0))), matched, missing, years, minYears, level, required: need, qualOk, hasCv: !!text, flags };
}
module.exports = { screen };
