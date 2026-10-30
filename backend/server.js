// Mbono Professional Services – recruitment API (beta)
// Storage is a JSON file (data/db.json) so nothing else needs installing.
// To move to SQL Server later, replace the load()/save() helpers and the db.* reads.
require('dotenv').config(); // reads backend/.env if it exists
const express = require('express'), cors = require('cors'), jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const multer = require('multer'), nodemailer = require('nodemailer'), mammoth = require('mammoth');
const pdfParse = require('pdf-parse/lib/pdf-parse.js');
const ai = require('./ai'), { screen } = require('./ats'), { createStore } = require('./store');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
// DATA_DIR: where db.json, uploaded CVs and the email log are kept. On Render, point it at a persistent disk (for example /var/data),
// because the normal file system is wiped whenever the service restarts or redeploys.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const UPLOADS = process.env.DATA_DIR ? path.join(DATA_DIR, 'uploads') : path.join(__dirname, 'uploads');
const PROD = !!(process.env.RENDER || process.env.NODE_ENV === 'production');
fs.mkdirSync(UPLOADS, { recursive: true });

const PORT = process.env.PORT || 3000;
let SECRET = process.env.JWT_SECRET;
if (!SECRET) { // never run a public site on a secret that is written in the code
  SECRET = PROD ? crypto.randomBytes(32).toString('hex') : 'dev-secret-change-me';
  if (PROD) console.warn('\n*** JWT_SECRET is not set. Using a temporary secret, so everyone is signed out whenever the server restarts. Set JWT_SECRET in the environment. ***\n');
}
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_FILE = path.join(DATA_DIR, 'db.json');
const SECTORS = ['BPO & GBS Services', 'Professional Services & Admin', 'Industrial & Manufacturing', 'Learnerships & Work Readiness'];
const QUALS = ['None', 'Matric', 'Certificate', 'Diploma', 'Degree'];
const SOURCES = ['Mbono website', 'Social media', 'Referral', 'Walk-in or community event', 'Job board', 'Mbono programme or learnership'];
const POLICY = { version: '2026-10-v1', effective: '2026-10-29', text: 'I consent to Mbono Professional Services processing my personal information for recruitment purposes, in line with POPIA.' };
const STAGES = ['Applied','Screening','Shortlisted','Assessment','Interview','Offer','Hired','Rejected'];

// ---------- storage ----------
function load() {
  if (fs.existsSync(DB_FILE)) { const d = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); migrate(d, false); return d; }
  const seed = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'seed.json'), 'utf8'));
  const pw = bcrypt.hashSync('Demo@123', 8);
  // The admin account is not a public demo account: its password comes from ADMIN_PASSWORD, or is generated and shown once below.
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@mbono.demo';
  const adminPw = process.env.ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url');
  if (!process.env.ADMIN_PASSWORD) console.log(`\n*** Admin account created. Email: ${adminEmail}  Password: ${adminPw}  (shown once; set ADMIN_PASSWORD in .env to choose your own) ***\n`);
  const u = (id, name, email, role, extra = {}) => ({ id, name, email, role, pw, loc: '', skills: '', saved: [], ...extra });
  const d = {
    users: [
      u(1, 'Zanele Dlamini', 'candidate@mbono.demo', 'Candidate', { loc: 'Gqeberha', skills: 'Communication, Customer service, Computer literacy' }),
      u(2, 'Sam Recruiter', 'recruiter@mbono.demo', 'Recruiter'),
      u(3, 'Nomsa Manager', 'manager@mbono.demo', 'Hiring Manager'),
      u(4, 'Admin User', adminEmail, 'Admin', { pw: bcrypt.hashSync(adminPw, 10) }),
    ],
    jobs: seed.jobs, apps: seed.apps, audit: [], consents: [], inquiries: [],
  };
  migrate(d, true);
  d.consents.push({ id: 1, userId: 1, email: 'candidate@mbono.demo', type: 'registration', action: 'given', policyVersion: POLICY.version, policyText: POLICY.text, at: new Date().toISOString(), ip: 'seed' });
  return d;
}
// Adds dates, sources and stage history that the reports need. fresh = new demo data, so spread the dates over past weeks.
function migrate(d, fresh) {
  const now = Date.now(), day = 864e5, iso = ms => new Date(ms).toISOString(), order = STAGES.slice(0, 7);
  d.consents = d.consents || []; d.inquiries = d.inquiries || [];
  const jobAge = [21, 14, 28, 7, 5, 2], appAge = [10, 8, 12, 25, 3, 2];
  d.jobs.forEach((j, i) => {
    if (!j.sector) j.sector = j.ind; j.ind = 'Mbono Career Goals';
    if (!j.createdAt) j.createdAt = iso(now - (fresh ? jobAge[i] || 3 : 0) * day);
    if (!j.createdBy) j.createdBy = 2;
    if (!j.openedAt && j.st === 'Open') j.openedAt = j.createdAt;
    j.minYears = j.minYears || 0; j.qualification = j.qualification || 'None';
  });
  d.apps.forEach((a, i) => {
    if (!a.createdAt) a.createdAt = iso(now - (fresh ? appAge[i] || 2 : 0) * day);
    if (!a.source) a.source = SOURCES[i % SOURCES.length];
    if (!a.history) {
      a.history = [{ stage: 'Applied', at: a.createdAt, by: null }];
      for (let k = 1; k <= order.indexOf(a.stage); k++) a.history.push({ stage: order[k], at: iso(Math.min(now, Date.parse(a.createdAt) + k * day)), by: 2 });
    }
  });
  if (fresh) { d.jobs.forEach(j => { if (j.title === 'Records Management Clerk') j.minYears = 1; if (j.title === 'Data Capturer') j.qualification = 'Matric'; }); }
}
const db = load();
db.jobs.forEach(j => { if (!j.sector) j.sector = j.ind; j.ind = 'Mbono Career Goals'; }); // one industry: Mbono Career Goals
const save = () => fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
const nextId = list => list.reduce((m, x) => Math.max(m, x.id), 0) + 1;
let store; // audit trail + consent records (MongoDB when MONGODB_URI is set, otherwise the JSON file)
const log = (user, msg) => {
  const at = new Date(), e = { at: at.toISOString(), t: at.toLocaleString('en-ZA'), uid: user.id || null, r: user.role, m: msg };
  Promise.resolve(store.audit.add(e)).catch(err => console.error('Audit write failed:', err.message));
};
const recordConsent = (req, u, type, extra = {}) => Promise.resolve(store.consent.add({ userId: u.id, email: u.email, type, action: 'given', policyVersion: POLICY.version,
  policyText: POLICY.text, at: new Date().toISOString(), ip: req.ip, ua: String(req.headers['user-agent'] || '').slice(0, 160), ...extra })).catch(err => console.error('Consent write failed:', err.message));
const publicUser = u => { const { pw, reset, cvFile, cvText, ...rest } = u; return rest; };

// ---------- middleware ----------
const app = express();
app.set('trust proxy', 1); // behind Render's proxy: use the visitor's real IP (rate limits and consent records)
const ORIGINS = (process.env.FRONTEND_ORIGIN || '').split(',').map(x => x.trim().replace(/\/$/, '')).filter(Boolean);
app.use(cors(ORIGINS.length ? { origin: ORIGINS } : undefined)); // FRONTEND_ORIGIN = your Vercel address; empty allows any origin (local use)
app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use(express.json());
const auth = (...roles) => (req, res, next) => {
  try { req.user = jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), SECRET); }
  catch { return res.status(401).json({ error: 'Please sign in' }); }
  if (!db.users.some(u => u.id === req.user.id)) return res.status(401).json({ error: 'Please sign in' });
  if (roles.length && !roles.includes(req.user.role)) return res.status(403).json({ error: 'Not allowed for your role' });
  next();
};
const me = req => db.users.find(u => u.id === req.user.id);
const STAFF = ['Recruiter', 'Hiring Manager', 'Admin'];

// ---------- auth ----------
app.post('/api/auth/login', (req, res) => {
  const { email = '', password = '' } = req.body;
  const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.pw)) return res.status(401).json({ error: 'Wrong email or password' });
  if (req.body.role && user.role !== 'Admin' && user.role !== req.body.role)
    return res.status(403).json({ error: `This is not a ${req.body.role} account. Please choose the correct role.` });
  log(user, `${user.name} signed in`); save();
  res.json({ token: jwt.sign({ id: user.id, role: user.role }, SECRET, { expiresIn: '8h' }), role: user.role });
});

// ---------- profile ----------
app.get('/api/me', auth(), (req, res) => res.json(publicUser(me(req))));
app.put('/api/me', auth(), (req, res) => {
  const u = me(req);
  const av = req.body.avatar;
  if (av !== undefined && !(typeof av === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(av) && av.length < 90000)) return res.status(400).json({ error: 'Photo must be a small JPEG, PNG or WebP' });
  for (const k of ['name', 'loc', 'skills', 'saved', 'phone', 'address', 'education', 'experience', 'certifications', 'languages', 'references', 'avatar']) {
    const v = req.body[k];
    if (v !== undefined) u[k] = (typeof v === 'string' && k !== 'avatar') ? v.slice(0, 5000) : v;
  }
  if (req.body.skills !== undefined || req.body.name !== undefined) log(u, 'Profile updated');
  save(); res.json(publicUser(u));
});

// ---------- vacancies ----------
app.get('/api/jobs', (req, res) => { // public: signed-out visitors see open vacancies only
  let role = null;
  try { role = jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), SECRET).role; } catch {}
  res.json(STAFF.includes(role) ? db.jobs : db.jobs.filter(j => j.st === 'Open'));
});

app.post('/api/jobs', auth('Recruiter', 'Admin'), (req, res) => {
  const b = req.body;
  if (!b.title || !String(b.title).trim()) return res.status(400).json({ error: 'Title is required' });
  const job = { id: nextId(db.jobs), title: b.title.trim().slice(0, 120), loc: b.loc || 'Remote', ind: 'Mbono Career Goals', sector: SECTORS.includes(b.sector) ? b.sector : SECTORS[1],
    type: b.type || 'Full-time', sal: b.sal || 'Negotiable', skills: Array.isArray(b.skills) ? b.skills : [], desc: b.desc || '', st: 'Pending',
    minYears: Math.max(0, Math.min(40, +b.minYears || 0)), qualification: QUALS.includes(b.qualification) ? b.qualification : 'None', createdAt: new Date().toISOString(), createdBy: req.user.id };
  db.jobs.push(job); log(req.user, `Vacancy created: ${job.title}`); save(); res.status(201).json(job);
});

app.patch('/api/jobs/:id', auth(...STAFF), (req, res) => {
  const job = db.jobs.find(j => j.id == req.params.id);
  if (!job) return res.status(404).json({ error: 'Vacancy not found' });
  const allowed = req.user.role === 'Recruiter' ? ['Closed'] : ['Open', 'Changes requested', 'Closed'];
  if (!allowed.includes(req.body.st)) return res.status(403).json({ error: `${req.user.role} cannot set status "${req.body.st}"` });
  if (req.body.st === 'Changes requested') {
    const note = String(req.body.note || '').trim().slice(0, 1000);
    if (note.length < 5) return res.status(400).json({ error: 'Please say what needs to change (at least 5 characters)' });
    job.changeNote = note; job.changeBy = req.user.id;
    const owner = db.users.find(u => u.id === job.createdBy && u.role === 'Recruiter'), to = owner ? [owner] : db.users.filter(u => u.role === 'Recruiter');
    to.forEach(u => mail(u.email, `Changes requested: ${job.title}`, `Hi ${u.name},\n\n${me(req).name} reviewed "${job.title}" and asked for changes before it can be approved:\n\n"${note}"\n\nOpen Vacancies in the portal, choose Edit, update the vacancy and it will go back for approval automatically.\n\nMbono Professional Services`));
  }
  if (req.body.st === 'Open') { job.openedAt = job.openedAt || new Date().toISOString(); job.changeNote = ''; }
  job.st = req.body.st; log(req.user, `Vacancy ${job.title}: ${job.st}`); save(); res.json(job);
});

app.post('/api/jobs/:id/duplicate', auth('Recruiter', 'Admin'), (req, res) => {
  const job = db.jobs.find(j => j.id == req.params.id);
  if (!job) return res.status(404).json({ error: 'Vacancy not found' });
  const copy = { ...job, id: nextId(db.jobs), title: job.title + ' (copy)', st: 'Pending', createdAt: new Date().toISOString(), createdBy: req.user.id, openedAt: undefined, changeNote: '', history: [] };
  db.jobs.push(copy); log(req.user, 'Vacancy duplicated'); save(); res.status(201).json(copy);
});

// ---------- applications ----------
app.get('/api/applications', auth(), (req, res) => {
  const list = req.user.role === 'Candidate' ? db.apps.filter(a => a.email === me(req).email) : db.apps;
  res.json(list);
});

app.post('/api/applications', auth('Candidate'), (req, res) => {
  const u = me(req), job = db.jobs.find(j => j.id == req.body.jobId);
  if (!job || job.st !== 'Open') return res.status(400).json({ error: 'This vacancy is not open' });
  if (!req.body.consent) return res.status(400).json({ error: 'POPIA consent is required' });
  if (db.apps.some(a => a.job === job.id && a.email === u.email)) return res.status(409).json({ error: 'You already applied' });
  const now = new Date().toISOString();
  const a = { id: nextId(db.apps), job: job.id, name: u.name, email: u.email, skills: u.skills, stage: 'Applied', notes: [], rate: 0, fb: '', cover: req.body.coverNote || '',
    source: SOURCES.includes(req.body.source) ? req.body.source : SOURCES[0], createdAt: now, history: [{ stage: 'Applied', at: now, by: null }] };
  db.apps.push(a); log(req.user, `Applied for ${job.title}`); recordConsent(req, u, 'application', { jobId: job.id }); save();
  mail(u.email, `Application received: ${job.title}`, `Hi ${u.name},\n\nWe received your application for ${job.title}. You can follow its status on your dashboard.\n\nMbono Professional Services`);
  res.status(201).json(a);
});

app.delete('/api/applications/:id', auth('Candidate'), (req, res) => {
  const i = db.apps.findIndex(a => a.id == req.params.id && a.email === me(req).email);
  if (i < 0) return res.status(404).json({ error: 'Application not found' });
  db.apps.splice(i, 1); log(req.user, 'Application withdrawn'); save(); res.json({ ok: true });
});

app.patch('/api/applications/:id', auth(...STAFF), (req, res) => {
  const a = db.apps.find(x => x.id == req.params.id);
  if (!a) return res.status(404).json({ error: 'Application not found' });
  const { stage, rate, fb } = req.body;
  if (stage !== undefined) {
    if (!STAGES.includes(stage)) return res.status(400).json({ error: 'Unknown stage' });
    a.stage = stage; (a.history = a.history || []).push({ stage, at: new Date().toISOString(), by: req.user.id }); log(req.user, `${a.name} moved to ${stage}`); notifyStage(a, stage);
  }
  if (rate !== undefined) { a.rate = Math.max(0, Math.min(5, +rate || 0)); log(req.user, `${a.name} rated ${a.rate}`); }
  if (fb !== undefined) { a.fb = String(fb); log(req.user, `Feedback updated for ${a.name}`); }
  save(); res.json(a);
});

app.post('/api/applications/:id/notes', auth(...STAFF), (req, res) => {
  const a = db.apps.find(x => x.id == req.params.id);
  if (!a || !req.body.note) return res.status(400).json({ error: 'Note and application required' });
  a.notes.push(String(req.body.note)); log(req.user, `Note added on ${a.name}`); save(); res.json(a);
});

// ---------- applicant details (full CV information for staff) ----------
const userOf = a => db.users.find(u => u.email === a.email);
app.get('/api/applications/:id/details', auth(...STAFF), (req, res) => {
  const a = db.apps.find(x => x.id == req.params.id);
  if (!a) return res.status(404).json({ error: 'Application not found' });
  const u = userOf(a) || {};
  res.json({ avatar: u.avatar, phone: u.phone, loc: u.loc, address: u.address, skills: u.skills || a.skills, education: u.education, experience: u.experience,
    certifications: u.certifications, languages: u.languages, references: u.references, cv: u.cv, hasCv: !!u.cvFile, cvText: u.cvText,
    ats: screen(jobOf(a), u, a), scorecards: a.scorecards || [], source: a.source });
});
app.get('/api/applications/:id/cv', auth(...STAFF), (req, res) => {
  const a = db.apps.find(x => x.id == req.params.id), u = a && userOf(a);
  if (!u || !u.cvFile) return res.status(404).json({ error: 'No CV on file for this applicant' });
  log(req.user, `CV downloaded for ${a.name}`); save();
  res.download(path.join(UPLOADS, u.cvFile), u.cv);
});

// ---------- website enquiries (Request Talent and General Inquiry pop-up form) ----------
const enqHits = new Map(); // simple limit: 5 messages per hour per visitor
app.post('/api/inquiries', (req, res) => {
  const b = req.body || {};
  if (b.website) return res.json({ ok: true }); // hidden field: only bots fill it in
  const now = Date.now(), hits = (enqHits.get(req.ip) || []).filter(t => now - t < 3600e3);
  if (hits.length >= 5) return res.status(429).json({ error: 'Too many messages. Please try again later.' });
  const one = (s, n) => String(s || '').replace(/[\r\n]+/g, ' ').trim().slice(0, n);
  const type = b.type === 'candidate' ? 'candidate' : 'employer';
  const name = one(b.name, 100), email = one(b.email, 150), company = one(b.company, 150), message = String(b.message || '').trim().slice(0, 3000);
  if (!name) return res.status(400).json({ error: 'Please enter your full name' });
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Please enter a valid email address' });
  if (type === 'employer' && !company) return res.status(400).json({ error: 'Please enter your company or organisation name' });
  if (message.length < 10) return res.status(400).json({ error: 'Please tell us a little more (at least 10 characters)' });
  hits.push(now); enqHits.set(req.ip, hits);
  db.inquiries = db.inquiries || [];
  db.inquiries.push({ id: nextId(db.inquiries), type, name, email, company, message, at: new Date().toISOString() });
  log({ role: 'Visitor' }, `New ${type} enquiry from ${name}`); save();
  const label = type === 'employer' ? 'Talent request' : 'Candidate enquiry';
  mail(process.env.INQUIRY_TO || 'info@mbono.co.za', `${label}: ${name}`, `${label}\n\nName: ${name}\nEmail: ${email}\nCompany: ${company || 'n/a'}\n\n${message}`);
  mail(email, 'We received your message', `Hi ${name},\n\nThank you for contacting Mbono Professional Services. We have received your message and will reply soon.\n\nMbono Professional Services`);
  res.status(201).json({ ok: true });
});

// ---------- vacancies: recruiter edits after changes were requested ----------
app.put('/api/jobs/:id', auth('Recruiter', 'Admin'), (req, res) => {
  const job = db.jobs.find(j => j.id == req.params.id), b = req.body;
  if (!job) return res.status(404).json({ error: 'Vacancy not found' });
  if (!['Changes requested', 'Pending'].includes(job.st)) return res.status(409).json({ error: 'Only vacancies waiting for approval or needing changes can be edited' });
  if (b.title !== undefined) { if (!String(b.title).trim()) return res.status(400).json({ error: 'Title is required' }); job.title = String(b.title).trim().slice(0, 120); }
  for (const k of ['loc', 'sal', 'desc', 'type']) if (b[k] !== undefined) job[k] = String(b[k]).slice(0, 2000);
  if (SECTORS.includes(b.sector)) job.sector = b.sector;
  if (Array.isArray(b.skills)) job.skills = b.skills.map(x => String(x).trim()).filter(Boolean).slice(0, 20);
  if (b.minYears !== undefined) job.minYears = Math.max(0, Math.min(40, +b.minYears || 0));
  if (QUALS.includes(b.qualification)) job.qualification = b.qualification;
  if (job.st === 'Changes requested') (job.history = job.history || []).push({ at: new Date().toISOString(), by: req.user.id, requested: job.changeNote, action: 'Edited and resubmitted' });
  job.st = 'Pending'; job.changeNote = ''; job.version = (job.version || 1) + 1;
  log(req.user, `Vacancy edited and resubmitted for approval: ${job.title}`); save();
  db.users.filter(u => u.role === 'Hiring Manager').forEach(u => mail(u.email, `Vacancy resubmitted: ${job.title}`, `Hi ${u.name},\n\n${me(req).name} updated "${job.title}" and resubmitted it for your approval. Open Approvals in the portal to review it.\n\nMbono Professional Services`));
  res.json(job);
});

// ---------- AI interview assistant, scorecards and auto-generated messages ----------
const appOf = (req, res) => { const a = db.apps.find(x => x.id == req.params.id); if (!a) res.status(404).json({ error: 'Application not found' }); return a; };
app.post('/api/applications/:id/ai/questions', auth(...STAFF), async (req, res) => {
  const a = appOf(req, res); if (!a) return;
  const r = await ai.interviewQuestions(jobOf(a), screen(jobOf(a), userOf(a) || {}, a));
  log(req.user, `Interview questions generated for ${a.name} (${r.source})`); res.json(r);
});
app.post('/api/applications/:id/ai/scorecard', auth(...STAFF), async (req, res) => {
  const a = appOf(req, res); if (!a) return;
  const r = await ai.scorecard(jobOf(a)); log(req.user, `Scorecard generated for ${a.name} (${r.source})`); res.json(r);
});
app.put('/api/applications/:id/scorecard', auth(...STAFF), (req, res) => {
  const a = appOf(req, res); if (!a) return;
  const items = Array.isArray(req.body.items) ? req.body.items.slice(0, 10).map(i => ({ name: String(i.name || '').slice(0, 60), rating: Math.max(0, Math.min(5, +i.rating || 0)), comment: String(i.comment || '').slice(0, 500) })) : [];
  if (!items.length) return res.status(400).json({ error: 'Scorecard is empty' });
  const overall = ['Strong yes', 'Yes', 'Maybe', 'No'].includes(req.body.overall) ? req.body.overall : 'Maybe', u = me(req);
  a.scorecards = (a.scorecards || []).filter(s => s.uid !== u.id);
  a.scorecards.push({ uid: u.id, by: u.name, role: u.role, at: new Date().toISOString(), overall, items });
  log(req.user, `Scorecard saved for ${a.name}`); save(); res.json(a.scorecards);
});
app.post('/api/applications/:id/message/draft', auth(...STAFF), async (req, res) => {
  const a = appOf(req, res); if (!a) return;
  res.json(await ai.message(String(req.body.kind || 'followup'), a, jobOf(a)));
});
app.post('/api/applications/:id/message/send', auth(...STAFF), (req, res) => {
  const a = appOf(req, res); if (!a) return;
  const subject = String(req.body.subject || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 150), body = String(req.body.body || '').trim().slice(0, 3000);
  if (!subject || body.length < 10) return res.status(400).json({ error: 'Add a subject and a message' });
  mail(a.email, subject, `${body}\n\n${me(req).name}\nMbono Professional Services`);
  (a.messages = a.messages || []).push({ at: new Date().toISOString(), by: req.user.id, subject });
  log(req.user, `Message sent to ${a.name}: ${subject}`); save(); res.json({ ok: true });
});

// ---------- candidate chatbot (public; knows the candidate's own applications when signed in) ----------
const chatHits = new Map();
app.post('/api/chat', async (req, res) => {
  const q = String(req.body.message || '').trim().slice(0, 500);
  if (!q) return res.status(400).json({ error: 'Type a question' });
  const now = Date.now(), hits = (chatHits.get(req.ip) || []).filter(t => now - t < 3600e3);
  if (hits.length >= 40) return res.status(429).json({ error: 'Too many questions for now. Please try again later.' });
  hits.push(now); chatHits.set(req.ip, hits);
  let u = null;
  try { const t = jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), SECRET); u = db.users.find(x => x.id === t.id && x.role === 'Candidate') || null; } catch {}
  res.json(await ai.chat(q, { signedIn: !!u, jobs: db.jobs.filter(j => j.st === 'Open').map(j => ({ title: j.title, location: j.loc, type: j.type, sector: j.sector })),
    apps: u ? db.apps.filter(a => a.email === u.email).map(a => ({ title: jobOf(a).title, stage: a.stage, interview: a.interview || null })) : [] }));
});

// ---------- reports: aging, source of hire, recruiter performance, time to hire, monthly charts ----------
app.get('/api/reports', auth(...STAFF), (req, res) => {
  const now = Date.now(), day = 864e5, order = STAGES.slice(0, 7);
  const hireAt = a => { const h = (a.history || []).find(x => x.stage === 'Hired'); return h ? Date.parse(h.at) : null; };
  const aging = db.jobs.filter(j => ['Open', 'Pending', 'Changes requested'].includes(j.st)).map(j => ({ id: j.id, title: j.title, status: j.st,
    days: Math.floor((now - Date.parse(j.createdAt)) / day), applicants: db.apps.filter(a => a.job === j.id).length })).sort((x, y) => y.days - x.days);
  const src = {}; SOURCES.forEach(s => { src[s] = { source: s, applications: 0, hires: 0 }; });
  db.apps.forEach(a => { const s = src[a.source] || (src[a.source] = { source: a.source, applications: 0, hires: 0 }); s.applications++; if (a.stage === 'Hired') s.hires++; });
  const days = a => { const j = db.jobs.find(x => x.id === a.job), h = hireAt(a); return j && h ? Math.max(0, Math.round((h - Date.parse(j.createdAt)) / day)) : null; };
  const hired = db.apps.filter(a => a.stage === 'Hired'), tth = hired.map(days).filter(x => x != null);
  const recruiters = db.users.filter(u => u.role === 'Recruiter').map(u => {
    const mv = db.apps.flatMap(a => (a.history || []).filter(h => h.by === u.id && h.stage !== 'Applied').map(h => ({ ...h, a })));
    const hs = mv.filter(m => m.stage === 'Hired').map(m => days(m.a)).filter(x => x != null);
    return { name: u.name, vacancies: db.jobs.filter(j => j.createdBy === u.id).length, moves: mv.length, interviews: mv.filter(m => m.stage === 'Interview').length,
      hires: hs.length, avgDaysToHire: hs.length ? Math.round(hs.reduce((x, y) => x + y, 0) / hs.length) : null };
  });
  const months = []; for (let i = 5; i >= 0; i--) { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); months.push({ key: d.toISOString().slice(0, 7), label: d.toLocaleString('en-ZA', { month: 'short' }), applications: 0, hires: 0 }); }
  db.apps.forEach(a => { const m = months.find(x => x.key === String(a.createdAt).slice(0, 7)); if (m) m.applications++; const h = hireAt(a), hm = h && months.find(x => x.key === new Date(h).toISOString().slice(0, 7)); if (hm) hm.hires++; });
  const funnel = order.map(s => { const reached = db.apps.filter(a => (a.history || []).some(h => h.stage === s) || order.indexOf(a.stage) >= order.indexOf(s)).length; return { stage: s, reached, pct: db.apps.length ? Math.round(100 * reached / db.apps.length) : 0 }; });
  res.json({ aging, sources: Object.values(src), recruiters, timeToHire: { avgDays: tth.length ? Math.round(tth.reduce((x, y) => x + y, 0) / tth.length) : null, hires: hired.length }, months, funnel });
});

// ---------- consent records (versioned, timestamped) ----------
app.get('/api/me/consents', auth(), async (req, res) => res.json(await store.consent.forUser(req.user.id)));
app.get('/api/consents', auth('Admin'), async (req, res) => res.json(await store.consent.all(500)));
app.get('/api/policy', (req, res) => res.json(POLICY));

// ---------- admin ----------
app.get('/api/users', auth('Admin'), (req, res) => res.json(db.users.map(publicUser)));
app.get('/api/audit', auth('Admin'), async (req, res) => res.json(await store.audit.list(300)));

// ---------- email (SMTP if configured, otherwise printed and saved to data/outbox.log) ----------
const tx = process.env.SMTP_HOST ? nodemailer.createTransport({ host: process.env.SMTP_HOST, port: +process.env.SMTP_PORT || 587,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } }) : null;
async function mail(to, subject, text, attachments) {
  const m = { from: process.env.MAIL_FROM || 'Mbono Careers <no-reply@mbono.co.za>', to, subject, text, attachments };
  if (tx) { try { await tx.sendMail(m); } catch (e) { console.error('Email failed:', e.message); } return; }
  const out = `\n[EMAIL not sent, no SMTP set] To: ${to}\nSubject: ${subject}\n${text}\n`;
  console.log(out); fs.appendFileSync(path.join(DATA_DIR, 'outbox.log'), out);
}
const jobOf = a => db.jobs.find(j => j.id === a.job) || { title: 'the vacancy' };
function notifyStage(a, s) {
  const t = { Screening: 'is being screened', Shortlisted: 'has been shortlisted', Interview: 'has moved to the interview stage (an invitation will follow)',
    Offer: 'has resulted in an offer', Hired: 'was successful. Congratulations!', Rejected: 'was not successful this time' }[s];
  if (t) mail(a.email, `Application update: ${jobOf(a).title}`, `Hi ${a.name},\n\nYour application for ${jobOf(a).title} ${t}.\n\nMbono Professional Services`);
}

// ---------- sign-up and password reset ----------
const sha = x => crypto.createHash('sha256').update(x).digest('hex');
const issue = u => ({ token: jwt.sign({ id: u.id, role: u.role }, SECRET, { expiresIn: '8h' }), role: u.role });
app.post('/api/auth/register', (req, res) => {
  const { name = '', email = '', password = '', consent } = req.body;
  if (!name.trim() || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Enter your name and a valid email' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  if (!consent) return res.status(400).json({ error: 'POPIA consent is required' });
  if (db.users.some(u => u.email.toLowerCase() === email.toLowerCase())) return res.status(409).json({ error: 'That email is already registered' });
  const u = { id: nextId(db.users), name: name.trim(), email: email.trim(), role: 'Candidate', pw: bcrypt.hashSync(password, 10),
    loc: '', skills: '', saved: [], consentAt: new Date().toISOString() };
  db.users.push(u); log(u, `${u.name} registered`); recordConsent(req, u, 'registration'); save();
  mail(u.email, 'Welcome to Mbono Careers', `Hi ${u.name},\n\nYour account is ready. Upload your CV to fill in your skills and start applying.\n\nMbono Professional Services`);
  res.status(201).json(issue(u));
});
app.post('/api/auth/forgot', (req, res) => {
  const u = db.users.find(x => x.email.toLowerCase() === String(req.body.email || '').toLowerCase());
  if (u) {
    const t = crypto.randomBytes(24).toString('hex');
    u.reset = { h: sha(t), exp: Date.now() + 3600e3 }; save();
    mail(u.email, 'Reset your password', `Hi ${u.name},\n\nUse this link within one hour to choose a new password:\n${BASE_URL}/app.html#reset=${t}\n\nIf you did not ask for this, ignore this email.`);
  }
  res.json({ ok: true }); // same answer either way, so emails cannot be probed
});
app.post('/api/auth/reset', (req, res) => {
  const { token = '', password = '' } = req.body;
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  const u = db.users.find(x => x.reset && x.reset.h === sha(token) && x.reset.exp > Date.now());
  if (!u) return res.status(400).json({ error: 'This reset link is invalid or has expired' });
  u.pw = bcrypt.hashSync(password, 10); delete u.reset; log(u, `${u.name} reset their password`); save(); res.json({ ok: true });
});

// ---------- CV upload and parsing ----------
const SEC = [['experience', /^(work\s+|employment\s+|professional\s+)?(experience|history)$/i], ['education', /^(education|qualifications|academic.*)$/i],
  ['certifications', /^(certifications?|certificates?|courses|training)$/i], ['languages', /^languages?$/i], ['references', /^references?$/i]];
function fillFromCv(u, raw) { // copies headed sections of the CV into empty profile fields
  const out = {}; let cur = null;
  for (const line of raw.split(/\r?\n/)) {
    const l = line.trim(); if (!l) continue;
    const h = l.replace(/[:\-\u2013\s]+$/, ''), hit = h.length <= 40 && SEC.find(([, re]) => re.test(h));
    if (hit) { cur = hit[0]; out[cur] = out[cur] || []; continue; }
    if (cur) out[cur].push(l);
  }
  for (const [k, v] of Object.entries(out)) if (!u[k] && v.length) u[k] = v.join('\n').slice(0, 3000);
  const ph = raw.match(/(\+27|0)[\s-]?\d{2}[\s-]?\d{3}[\s-]?\d{4}/); if (!u.phone && ph) u.phone = ph[0];
}
const SKILLS = ['Communication','Customer service','Excel','MS Office','Data capturing','Filing','Records management','Teamwork','Leadership','Coaching',
  'Reporting','Digital literacy','Packing','Stock handling','Payroll','CRM','Problem solving','Typing','Computer literacy','Attention to detail','SQL','JavaScript','Python','C#','React'];
const up = multer({ storage: multer.diskStorage({ destination: UPLOADS, filename: (r, f, cb) => cb(null, `${r.user.id}-${Date.now()}${path.extname(f.originalname).toLowerCase()}`) }),
  limits: { fileSize: 5e6 }, fileFilter: (r, f, cb) => cb(null, /\.(pdf|docx)$/i.test(f.originalname)) });
async function cvText(file) {
  const buf = fs.readFileSync(file.path);
  return /\.pdf$/i.test(file.originalname) ? (await pdfParse(buf)).text : (await mammoth.extractRawText({ buffer: buf })).value;
}
app.post('/api/me/cv', auth(), up.single('cv'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Upload a PDF or DOCX file under 5 MB' });
  const u = me(req);
  try {
    const raw = await cvText(req.file), text = raw.toLowerCase();
    const all = [...new Set([...SKILLS, ...db.jobs.flatMap(j => j.skills)])];
    const found = all.filter(sk => text.includes(sk.toLowerCase()));
    const have = u.skills.split(',').map(x => x.trim()).filter(Boolean);
    u.skills = [...new Set([...have, ...found])].join(', ');
    if (u.cvFile) fs.rmSync(path.join(UPLOADS, u.cvFile), { force: true });
    u.cv = req.file.originalname; u.cvFile = req.file.filename; u.cvText = raw.slice(0, 30000); fillFromCv(u, raw); log(u, 'CV uploaded'); save();
    res.json({ found, profile: publicUser(u) });
  } catch (e) { fs.rmSync(req.file.path, { force: true }); res.status(422).json({ error: 'We could not read that file' }); }
});
app.get('/api/me/cv', auth(), (req, res) => {
  const u = me(req);
  if (!u.cvFile) return res.status(404).json({ error: 'No CV stored' });
  res.download(path.join(UPLOADS, u.cvFile), u.cv);
});

// ---------- interviews (invitation email with a calendar file) ----------
function ics(a, job, iv) {
  const d = new Date(iv.when), f = x => x.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Mbono//Careers//EN', 'BEGIN:VEVENT', `UID:${a.id}-${+d}@mbono.co.za`, `DTSTAMP:${f(new Date())}`,
    `DTSTART:${f(d)}`, `DTEND:${f(new Date(+d + 3600e3))}`, `SUMMARY:Interview - ${job.title}`, `DESCRIPTION:${iv.mode} interview ${iv.link || ''}`.trim(),
    iv.link ? `LOCATION:${iv.link}` : '', 'END:VEVENT', 'END:VCALENDAR'].filter(Boolean).join('\r\n');
}
app.post('/api/applications/:id/interview', auth('Recruiter', 'Admin'), (req, res) => {
  const a = db.apps.find(x => x.id == req.params.id), { when, mode = 'Teams', link = '' } = req.body;
  if (!a) return res.status(404).json({ error: 'Application not found' });
  if (!when || isNaN(new Date(when))) return res.status(400).json({ error: 'Choose a valid date and time' });
  a.interview = { when, mode, link }; a.stage = 'Interview'; (a.history = a.history || []).push({ stage: 'Interview', at: new Date().toISOString(), by: req.user.id }); log(req.user, `Interview booked for ${a.name}`); save();
  const when_ = new Date(when).toLocaleString('en-ZA');
  mail(a.email, `Interview invitation: ${jobOf(a).title}`, `Hi ${a.name},\n\nYou are invited to an interview for ${jobOf(a).title}.\nWhen: ${when_}\nHow: ${mode}${link ? '\nLink or venue: ' + link : ''}\n\nA calendar file is attached.\n\nMbono Professional Services`,
    [{ filename: 'interview.ics', content: ics(a, jobOf(a), a.interview), contentType: 'text/calendar' }]);
  res.json(a);
});

// ---------- POPIA: export and delete my data ----------
app.get('/api/me/export', auth(), async (req, res) => {
  const u = me(req);
  res.setHeader('Content-Disposition', 'attachment; filename="my-data.json"');
  res.json({ exportedAt: new Date().toISOString(), profile: { ...publicUser(u), cvText: u.cvText }, applications: db.apps.filter(a => a.email === u.email), consents: await store.consent.forUser(u.id) });
});
app.delete('/api/me', auth('Candidate'), async (req, res) => {
  const u = me(req);
  if (!bcrypt.compareSync(req.body.password || '', u.pw)) return res.status(403).json({ error: 'Wrong password' });
  if (u.cvFile) fs.rmSync(path.join(UPLOADS, u.cvFile), { force: true });
  db.apps = db.apps.filter(a => a.email !== u.email);
  await store.audit.scrub(u.name);
  await store.consent.anonymise(u.id);
  await recordConsent(req, { id: u.id, email: null }, 'account', { action: 'withdrawn' });
  db.users = db.users.filter(x => x.id !== u.id);
  log({ role: 'Candidate' }, 'Candidate account and data deleted (POPIA request)'); save(); res.json({ ok: true });
});

app.use((err, req, res, next) => res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'File is too large (max 5 MB)' : err.message }));

// ---------- frontend ----------
app.use(express.static(path.join(__dirname, '..', 'frontend')));
(async () => {
  store = await createStore({ db, save, nextId, uri: process.env.MONGODB_URI, dbName: process.env.MONGODB_DB });
  console.log(`Audit trail and consent records: ${store.kind === 'mongodb' ? 'MongoDB' : 'JSON file (set MONGODB_URI to use MongoDB)'}`);
  if (PROD && /localhost/.test(BASE_URL)) console.warn('*** BASE_URL is not set: password reset emails will link to localhost. Set BASE_URL to your Vercel address. ***');
  if (PROD && !ORIGINS.length) console.warn('*** FRONTEND_ORIGIN is not set: the API accepts requests from any website. Set it to your Vercel address. ***');
  if (PROD && !process.env.ADMIN_PASSWORD) console.warn('*** ADMIN_PASSWORD is not set: if the data folder is empty a random admin password is generated and printed in these logs. ***');
  console.log(`AI features: ${process.env.ANTHROPIC_API_KEY ? 'Claude API' : 'built-in templates (set ANTHROPIC_API_KEY to use Claude)'}`);
  app.listen(PORT, () => console.log(`Mbono Professional Services running at http://localhost:${PORT}`));
})();
