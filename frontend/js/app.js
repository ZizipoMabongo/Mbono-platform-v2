const ST=['Applied','Screening','Shortlisted','Assessment','Interview','Offer','Hired'];
const NAV={Candidate:[['jobs','Find jobs'],['dash','My dashboard'],['profile','My profile']],Recruiter:[['rdash','Dashboard'],['pipe','Pipeline'],['post','Vacancies'],['rep','Reports']],'Hiring Manager':[['appr','Approvals'],['review','Candidate review'],['rep','Reports']],Admin:[['users','Users'],['audit','Audit log'],['consents','Consents'],['rep','Reports']]};
let TOKEN=null,QUIET=false;
let D={jobs:[],apps:[],saved:[],audit:[],users:[],me:{name:'',email:'',loc:'',skills:''}};
async function api(m,p,b){
 let r;try{r=await fetch(API+p,{method:m,headers:{'Content-Type':'application/json',...(TOKEN?{Authorization:'Bearer '+TOKEN}:{})},body:b?JSON.stringify(b):undefined})}
 catch(e){if(!QUIET)alert('Cannot reach the server. If it has been idle it can take up to a minute to wake up. Please try again shortly.');throw e}
 const j=await r.json().catch(()=>({}));
 if(!r.ok){if(!QUIET)alert(j.error||'Request failed');throw new Error(j.error||r.status)}
 return j}
const start=j=>{TOKEN=j.token;role=j.role;view=NAV[role][0][0];return load()};
function signOut(){TOKEN=null;try{localStorage.removeItem('mbono_token')}catch(e){}D.me={name:'',email:''};D.apps=[];view='jobs';api('GET','/jobs').then(j=>{D.jobs=j}).catch(()=>{}).finally(render)}
async function load(){
 const [j,a,me]=await Promise.all([api('GET','/jobs'),api('GET','/applications'),api('GET','/me')]);
 D.jobs=j;D.apps=a;D.me=me;D.saved=me.saved||[];
 if(role=='Admin'){D.audit=await api('GET','/audit');D.users=await api('GET','/users');D.allConsents=await api('GET','/consents')}
 if(role=='Candidate')D.consents=await api('GET','/me/consents');else D.rep=await api('GET','/reports')}
const act=async fn=>{try{await fn();await load();render()}catch(e){}};
let role='Candidate',view='jobs',F={t:'',l:'',i:'',y:''},pf=0,M='',drag=0;
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const job=id=>D.jobs.find(j=>j.id==id)||{title:'(removed)',skills:[]};
const score=(j,s)=>{const k=s.toLowerCase().split(',').map(x=>x.trim());return j.skills.length?Math.round(100*j.skills.filter(x=>k.includes(x.toLowerCase())).length/j.skills.length):0};
const chips=a=>a.map(x=>`<span class="chip">${esc(x)}</span>`).join('');

const setView=v=>{view=v;history.pushState({v},'');render()};
// The name close() belongs to the browser (document.close), so the portal uses closeM().
const closeM=()=>{M='';if(history.state&&history.state.m)history.back();else render()};
addEventListener('popstate',e=>{const s=e.state||{};M='';if(s.v)view=s.v;render()});
addEventListener('keydown',e=>{if(e.key=='Escape'&&M)closeM()});

const slides=()=>`<div class="slides"><i class="sl" style="background-image:url(img/hero/hero-1.jpg)"></i><i class="sl" style="background-image:url(img/hero/hero-2.jpg)"></i><i class="sl" style="background-image:url(img/hero/hero-3.jpg)"></i></div>`;
const bar=(t,sub)=>`<div class="pagebar">${slides()}<img class="wm" src="img/emblem.png" alt=""><div class="bin"><h2>${esc(t)}</h2><p>${esc(sub||'')}</p></div></div>`;
const ini=n=>String(n||'?').split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
const av=(u,c='')=>`<span class="av ${c}">${u.avatar?`<img src="${esc(u.avatar)}" alt="">`:esc(ini(u.name))}</span>`;
function render(){
 const hs=history.state||{};if(M&&!hs.m)history.pushState({v:view,m:1},'');else if(!M&&hs.m)history.replaceState({v:view},'');
 const nav=!TOKEN?`<button class="on">Vacancies</button>`:NAV[role].map(([v,l])=>`<button class="${v==view?'on':''}" onclick="setView('${v}')">${l}</button>`).join('');
 const lab=TOKEN&&NAV[role].find(x=>x[0]==view),head=view=='jobs'?'':bar(lab?lab[1]:'',D.me.name?'Welcome, '+D.me.name+' · '+role:'');
 $('app').innerHTML=`<header class="top"><div class="in"><a class="brand" href="index.html"><img src="img/emblem-sm.png" alt=""><span><b>Mbono Career Goals</b><small>Mbono Professional Services</small></span></a><nav>${nav}</nav>
 <div class="acts">${TOKEN?`${av(D.me)}<span class="who">${esc(D.me.name)}<small>${role}</small></span><button class="btn o" onclick="signOut()">Sign out</button>`:`<button class="btn o" onclick="MBAuth.open('login')">Portal Login</button><button class="btn" onclick="MBAuth.open('register')">Create account</button>`}</div></div></header>
 <main><div class="view">${head}${V[view]()}</div></main>${foot()}${M}`;
}

const CATS=[['BPO & GBS Services','Preparing talent for high-volume contact centre environments and shared services.'],['Professional Services & Admin','Back-office support, including data capturing and records management.'],['Industrial & Manufacturing','Packaging, processing, warehouse support and general labour roles.'],['Learnerships & Work Readiness','SETA-aligned programmes combining theory with workplace practice and digital literacy.']];
const catF=i=>{F.i=F.i==CATS[i][0]?'':CATS[i][0];render()};
const cats=()=>`<h2>Browse by focus area</h2><div class="grid cats">${CATS.map((c,i)=>`<div class="cat ${F.i==c[0]?'on':''}" onclick="catF(${i})"><b>0${i+1}</b><h3>${esc(c[0])}</h3><p>${c[1]}</p></div>`).join('')}</div>`;
const cta=()=>`<div class="cta"><div><h2>Source work-ready talent that fits.</h2><p>Tell us what you need and we will connect you with trained, motivated candidates.</p><p class="cd">Contact details: <a href="mailto:info@mbono.co.za">info@mbono.co.za</a> · <a href="tel:+27418800086">+27 (0)41 880 0086</a> · 19 Oakworth Road, Harbour View Building, South End, Gqeberha, 6001</p></div><div><button class="btn" onclick="MBEnquiry.open('employer')">Request talent</button></div></div>`;
const foot=()=>`<footer><div class="fg"><div><img src="img/emblem-sm.png" width="52" alt="" style="border-radius:50%;margin-bottom:.5rem"><h4>Mbono Professional Services</h4><p>A purpose-led workforce solutions and business enablement company unlocking human potential across the Eastern Cape.</p></div>
<div><h4>Business units</h4><a href="https://www.mbono.co.za/bpo-link" target="_blank" rel="noopener">BPO Link</a><a href="https://www.mbono.co.za/career-goals" target="_blank" rel="noopener">Career Goals</a><a href="https://www.mbono.co.za/digigoals" target="_blank" rel="noopener">DigiGoals</a><a href="https://www.mbono.co.za/mcx-connect" target="_blank" rel="noopener">MCX Connect</a></div>
<div><h4>Get in touch</h4><p>info@mbono.co.za<br>+27 (0)41 880 0086<br>19 Oakworth Road, Harbour View Building, South End, Gqeberha, 6001</p></div></div>
<small>© 2026 Mbono Professional Services. All rights reserved. · Beta preview</small></footer>`;
const V={
jobs(){
 const S=j=>j.sector||j.ind;
 const L=D.jobs.filter(j=>j.st=='Open'&&(!F.t||(j.title+j.skills).toLowerCase().includes(F.t.toLowerCase()))&&(!F.l||j.loc==F.l)&&(!F.i||S(j)==F.i)&&(!F.y||j.type==F.y));
 const op=(k,f)=>[...new Set(D.jobs.map(j=>j[k]))].map(x=>`<option ${F[f]==x?'selected':''}>${esc(x)}</option>`).join('');
 return `<div class="hero inapp">${slides()}<img class="wm" src="img/emblem.png" alt=""><div class="in"><span class="pill">Eastern Cape workforce enablement</span><h1>Building skills,<em>Unlocking opportunity.</em></h1>
 <p class="lead">Work-ready talent and meaningful careers across the Eastern Cape. Search vacancies, apply in one click and track every step.</p>
 <div class="grid sf"><input id="ft" placeholder="Job title or skill" value="${esc(F.t)}"><select id="fl"><option value="">Any location</option>${op('loc','l')}</select><select id="fy"><option value="">Any type</option>${op('type','y')}</select>
 <button class="btn em" onclick="F={...F,t:$('ft').value,l:$('fl').value,y:$('fy').value};render()">Search</button></div></div></div>
 ${cats()}<p class="mut">${L.length} vacancies</p>`+L.map(j=>{const ap=D.apps.some(a=>a.job==j.id&&a.email==D.me.email);return `<div class="card jc"><div class="art">${mbArt(CATS.findIndex(c=>c[0]==S(j)))}</div><div><div class="row"><div><h3>${esc(j.title)}</h3>
 <span class="mut">${esc(j.ind)} · ${esc(j.loc)} · ${esc(j.type)} · ${esc(j.sal)}</span></div>
 <div><button class="btn o" onclick="tog(${j.id})">${D.saved.includes(j.id)?'Saved ✓':'Save'}</button> <button class="btn" ${ap?'disabled':''} onclick="applyM(${j.id})">${ap?'Applied':'Apply'}</button></div></div>
 <p>${esc(j.desc)}</p>${chips(j.skills)}</div></div>`}).join('')+(L.length?'':'<div class="card">No vacancies match your search.</div>')+cta();
},
dash(){
 const my=D.apps.filter(a=>a.email==D.me.email);
 return `<h2>My dashboard</h2><div class="grid" style="margin-bottom:1rem"><div class="stat"><b>${my.length}</b>Applications</div><div class="stat"><b>${D.saved.length}</b>Saved jobs</div><div class="stat"><b>${my.filter(a=>a.stage=='Interview').length}</b>Interviews</div></div>
 <div class="card"><h3>Applications</h3><div class="tw"><table><tr><th>Role</th><th>Status</th><th></th></tr>${my.map(a=>`<tr><td>${esc(job(a.job).title)}</td><td><span class="chip">${a.stage}</span>${a.interview?`<br><span class="mut">Interview ${esc(new Date(a.interview.when).toLocaleString())} · ${esc(a.interview.mode)}${a.interview.link?` · ${esc(a.interview.link)}`:''}</span>`:''}</td><td><button class="btn o" onclick="wd(${a.id})">Withdraw</button></td></tr>`).join('')||'<tr><td colspan=3 class="mut">No applications yet.</td></tr>'}</table></div></div>
 <div class="card"><h3>Saved jobs</h3>${D.saved.map(id=>`<div class="row"><span>${esc(job(id).title)}</span><button class="btn o" onclick="tog(${id})">Remove</button></div>`).join('')||'<span class="mut">Nothing saved.</span>'}</div>`;
},
profile(){const m=D.me,f=(id,l,k,r)=>r?`<label>${l}</label><textarea id="${id}" rows="${r}">${esc(m[k]||'')}</textarea>`:`<label>${l}</label><input id="${id}" value="${esc(m[k]||'')}"${k=='email'?' readonly':''}>`;
 return `<div class="card"><div class="row" style="justify-content:flex-start;gap:1rem">${av(m,'lg')}<div><h3 style="margin:0">${esc(m.name)}</h3><span class="mut">${esc(m.email)}</span><br><label class="btn o" style="margin-top:.5rem;cursor:pointer">Change photo<input type="file" accept="image/*" hidden onchange="upAv(this.files[0])"></label></div></div></div>
 <div class="card"><h3>Personal details</h3><div class="grid2">${f('pn','Full name','name')}${f('pe','Email','email')}${f('pp','Phone','phone')}${f('pl','Location','loc')}</div>${f('pa','Address','address')}${f('ps','Skills (comma separated)','skills')}
 <h3 style="margin-top:1.2rem">CV details</h3><p class="mut">These fill in automatically when you upload a CV. Check and correct them. Recruiters see all of this and can download your CV.</p>
 ${f('pd','Education','education',3)}${f('px','Work experience','experience',4)}${f('pc','Certifications','certifications',2)}${f('pg','Languages','languages',1)}${f('pr','Professional references','references',2)}
 <label>CV (PDF or DOCX, max 5 MB)</label><input type="file" accept=".pdf,.docx" onchange="upCV(this.files[0])"><p class="mut">${m.cv?`Stored CV: ${esc(m.cv)} · <a href="#" onclick="dlCV();return false">Download</a>`:'Upload a CV and we will read your details into your profile.'}</p>
 <button class="btn" onclick="saveProfile()">Save profile</button></div>${m.role=='Candidate'?`<div class="card"><h3>Your data (POPIA)</h3><p class="mut">Consent recorded: ${esc((m.consentAt||'').slice(0,10)||'demo account')}. Download everything we hold about you, or delete your account and data permanently.</p><details style="margin:.5rem 0"><summary>Consent history (${(D.consents||[]).length})</summary><div class="tw"><table><tr><th>When</th><th>Type</th><th>Action</th><th>Policy version</th></tr>${(D.consents||[]).map(c=>`<tr><td>${esc(new Date(c.at).toLocaleString())}</td><td>${esc(c.type)}</td><td>${esc(c.action)}</td><td>${esc(c.policyVersion)}</td></tr>`).join('')}</table></div></details><button class="btn o" onclick="exp()">Download my data</button> <button class="btn d" onclick="delMe()">Delete my account</button></div>`:''}`},
rdash(){
 const open=D.jobs.filter(j=>j.st=='Open').length,hires=D.apps.filter(a=>a.stage=='Hired').length;
 return `<h2>Recruitment dashboard</h2><div class="grid" style="margin-bottom:1rem"><div class="stat"><b>${open}</b>Open vacancies</div><div class="stat"><b>${D.apps.length}</b>Applications</div>
 <div class="stat"><b>${D.apps.filter(a=>a.stage=='Applied').length}</b>New applicants</div><div class="stat"><b>${D.apps.filter(a=>a.stage=='Interview').length}</b>Interviews</div><div class="stat"><b>${hires}</b>Hires</div></div>
 <div class="card"><h3>Applications per vacancy</h3>${D.jobs.map(j=>{const n=D.apps.filter(a=>a.job==j.id).length;return `<div class="row"><span style="width:200px">${esc(j.title)}</span><div style="flex:1"><div class="bar" style="width:${n*20+2}%"></div></div><b>${n}</b></div>`}).join('')}</div>`},
pipe(){
 const A=D.apps.filter(a=>!pf||a.job==pf&&a.stage!='Rejected');
 return `<div class="row"><h2>Candidate pipeline</h2><select style="width:240px" onchange="pf=+this.value;render()"><option value="0">All vacancies</option>${D.jobs.map(j=>`<option value="${j.id}" ${pf==j.id?'selected':''}>${esc(j.title)}</option>`).join('')}</select></div>
 <p class="mut">Drag cards between stages. The match score compares candidate skills with the vacancy (rule-based in this beta).</p><div class="kan">`+
 ST.map(s=>`<div class="col" ondragover="event.preventDefault()" ondrop="mv(drag,'${s}')"><h3>${s} (${A.filter(a=>a.stage==s).length})</h3>`+A.filter(a=>a.stage==s).map(a=>`<div class="kc" draggable="true" ondragstart="drag=${a.id}" onclick="det(${a.id})"><span class="sc">${score(job(a.job),a.skills)}%</span><b>${esc(a.name)}</b><br><span class="mut">${esc(job(a.job).title)}</span></div>`).join('')+'</div>').join('')+'</div>'},
post(){
 return `<h2>Vacancies</h2><div class="card"><h3>New vacancy</h3><div class="grid"><div><label>Title</label><input id="vt"></div><div><label>Location</label><input id="vl"></div><div><label>Sector</label><select id="vi">${CATS.map(c=>`<option>${esc(c[0])}</option>`).join('')}</select></div>
 <div><label>Type</label><select id="vy"><option>Full-time</option><option>Part-time</option><option>Contract</option><option>Learnership</option></select></div><div><label>Salary</label><input id="vs" placeholder="R20k–R30k"></div>
 <div><label>Minimum years of experience</label><input id="vm" type="number" min="0" max="40" value="0"></div><div><label>Minimum qualification</label><select id="vq">${['None','Matric','Certificate','Diploma','Degree'].map(q=>`<option>${q}</option>`).join('')}</select></div></div>
 <label>Required skills (comma separated)</label><input id="vk"><label>Description</label><textarea id="vd" rows="3"></textarea><br><br><button class="btn" onclick="addJ()">Submit for approval</button></div>
 <div class="card tw"><table><tr><th>Title</th><th>Status</th><th></th></tr>${D.jobs.map(j=>`<tr><td>${esc(j.title)}${j.st=='Changes requested'&&j.changeNote?`<br><span class="bad">Changes requested: ${esc(j.changeNote)}</span>`:''}</td><td><span class="chip">${j.st}</span></td>
 <td>${['Changes requested','Pending'].includes(j.st)?`<button class="btn" onclick="editJ(${j.id})">Edit</button> `:''}<button class="btn o" onclick="dup(${j.id})">Duplicate</button> <button class="btn o" onclick="jst(${j.id},'Closed')">Close</button></td></tr>`).join('')}</table></div>`},
appr(){
 const P=D.jobs.filter(j=>['Pending','Changes requested'].includes(j.st));
 return `<h2>Vacancy approvals</h2>`+(P.map(j=>`<div class="card"><div class="row"><h3>${esc(j.title)}</h3><span class="chip">${j.st}</span></div><span class="mut">${esc(j.loc)} · ${esc(j.type)} · ${esc(j.sal)} · ${esc(j.sector||'')}${j.minYears?` · ${j.minYears}+ yrs`:''}${j.qualification&&j.qualification!='None'?` · ${esc(j.qualification)}`:''}</span><p>${esc(j.desc)}</p>${chips(j.skills)}
 ${j.st=='Changes requested'?`<p class="bad">Waiting for the recruiter. You asked: ${esc(j.changeNote||'')}</p>`:`<br><br><button class="btn" onclick="jst(${j.id},'Open')">Approve</button> <button class="btn o" onclick="reqChg(${j.id})">Request changes</button>`}</div>`).join('')||'<div class="card mut">No vacancies waiting for approval.</div>')},
review(){
 const A=D.apps.filter(a=>['Shortlisted','Assessment','Interview','Offer'].includes(a.stage));
 return `<h2>Candidate review</h2>`+(A.map(a=>`<div class="card"><div class="row"><div><h3>${esc(a.name)}</h3><span class="mut">${esc(job(a.job).title)} · ${a.stage} · match ${score(job(a.job),a.skills)}%</span></div>
 <select style="width:130px" onchange="rate(${a.id},+this.value)">${[0,1,2,3,4,5].map(n=>`<option value="${n}" ${a.rate==n?'selected':''}>${n?'★'.repeat(n):'Not rated'}</option>`).join('')}</select></div>
 <p>Skills: ${esc(a.skills)}</p><textarea rows="2" placeholder="Interview feedback" onchange="fb(${a.id},this.value)">${esc(a.fb)}</textarea><br><br>
 <button class="btn o" onclick="det(${a.id})">View CV details</button> <button class="btn" onclick="mv(${a.id},'Offer')">Make offer</button> <button class="btn d" onclick="rej(${a.id})">Reject</button></div>`).join('')||'<div class="card mut">No shortlisted candidates yet.</div>')},
users(){
 const U=D.users.map(u=>[u.name,u.role]);
 return `<h2>User management</h2><div class="card tw"><table><tr><th>Name</th><th>Role</th><th>Access</th></tr>${U.map(u=>`<tr><td>${esc(u[0])}</td><td>${u[1]}</td><td class="ok">Active</td></tr>`).join('')}</table></div><p class="mut">Roles are enforced by the API. Real sign-in screens and Microsoft SSO come next.</p>`},
audit(){return `<h2>Audit log</h2><div class="card tw"><table><tr><th>Time</th><th>Role</th><th>Event</th></tr>${D.audit.slice(0,50).map(a=>`<tr><td>${esc(a.t)}</td><td>${esc(a.r)}</td><td>${esc(a.m)}</td></tr>`).join('')}</table></div>`},
rep(){
 const R=D.rep||{aging:[],sources:[],recruiters:[],timeToHire:{},months:[],funnel:[]};
 const bars=(rows,label,val,max,unit='')=>rows.map(r=>`<div class="row"><span style="width:190px">${esc(label(r))}</span><div style="flex:1"><div class="bar" style="width:${Math.max(2,100*val(r)/Math.max(max,1))}%"></div></div><b>${val(r)}${unit}</b></div>`).join('')||'<p class="mut">No data yet.</p>';
 const tk={};D.jobs.forEach(j=>j.skills.forEach(s=>tk[s]=(tk[s]||0)+1));const top=Object.entries(tk).sort((a,b)=>b[1]-a[1]).slice(0,6);
 const mx=Math.max(1,...R.months.map(m=>Math.max(m.applications,m.hires)));
 return `<h2>Reports</h2><div class="grid" style="margin-bottom:1rem"><div class="stat"><b>${R.timeToHire.avgDays==null?'–':R.timeToHire.avgDays+' days'}</b>Average time to hire</div><div class="stat"><b>${R.funnel.length?R.funnel[R.funnel.length-1].pct+'%':'0%'}</b>Application to hire</div><div class="stat"><b>${D.apps.length}</b>Total applications</div><div class="stat"><b>${D.jobs.filter(j=>j.st=='Open').length}</b>Open vacancies</div></div>
 <div class="card"><h3>Applications and hires by month</h3><div class="mon">${R.months.map(m=>`<div><div class="mb"><i style="height:${100*m.applications/mx}%" title="Applications"></i><i class="h" style="height:${100*m.hires/mx}%" title="Hires"></i></div><b>${m.applications}/${m.hires}</b><span>${esc(m.label)}</span></div>`).join('')}</div><p class="mut">Green bars are applications and orange bars are hires.</p></div>
 <div class="card tw"><h3>Vacancy aging</h3><table><tr><th>Vacancy</th><th>Status</th><th>Days since posted</th><th>Applicants</th></tr>${R.aging.map(a=>`<tr><td>${esc(a.title)}</td><td><span class="chip">${a.status}</span></td><td class="${a.days>=21?'bad':''}">${a.days}</td><td>${a.applicants}</td></tr>`).join('')||'<tr><td colspan=4 class="mut">No open vacancies.</td></tr>'}</table></div>
 <div class="card tw"><h3>Source of hire</h3><table><tr><th>Source</th><th>Applications</th><th>Hires</th><th>Conversion</th></tr>${R.sources.map(s=>`<tr><td>${esc(s.source)}</td><td>${s.applications}</td><td>${s.hires}</td><td>${s.applications?Math.round(100*s.hires/s.applications)+'%':'–'}</td></tr>`).join('')}</table></div>
 <div class="card tw"><h3>Recruiter performance</h3><table><tr><th>Recruiter</th><th>Vacancies posted</th><th>Candidates moved</th><th>Interviews</th><th>Hires</th><th>Avg days to hire</th></tr>${R.recruiters.map(r=>`<tr><td>${esc(r.name)}</td><td>${r.vacancies}</td><td>${r.moves}</td><td>${r.interviews}</td><td>${r.hires}</td><td>${r.avgDaysToHire==null?'–':r.avgDaysToHire}</td></tr>`).join('')}</table></div>
 <div class="card"><h3>Candidate conversion by stage</h3>${bars(R.funnel,f=>f.stage,f=>f.pct,100,'%')}</div>
 <div class="card"><h3>Top skills in demand</h3>${bars(top,t=>t[0],t=>t[1],top.length?top[0][1]:1)}</div>`},
consents(){return `<h2>Consent records</h2><p class="mut">Every consent is stored with the policy version and a timestamp. A deleted account keeps a withdrawal record with no personal details.</p><div class="card tw"><table><tr><th>When</th><th>Who</th><th>Type</th><th>Action</th><th>Policy version</th></tr>${(D.allConsents||[]).slice(0,100).map(c=>`<tr><td>${esc(new Date(c.at).toLocaleString())}</td><td>${esc(c.email||'(anonymised)')}</td><td>${esc(c.type)}</td><td>${esc(c.action)}</td><td>${esc(c.policyVersion)}</td></tr>`).join('')}</table></div>`}
};

function applyM(id){if(!TOKEN){MBAuth.open('login');return}const j=job(id);M=`<div class="ov" onclick="if(event.target===this)closeM()"><div class="md"><h3>Apply: ${esc(j.title)}</h3><p class="mut">Applying as ${esc(D.me.name)} (${esc(D.me.email)}). Your profile skills are used for matching.</p>
 <label>CV (PDF or DOCX)</label><input id="acv" type="file" accept=".pdf,.docx"><label>How did you hear about this vacancy?</label><select id="asr">${['Mbono website','Social media','Referral','Walk-in or community event','Job board','Mbono programme or learnership'].map(x=>`<option>${x}</option>`).join('')}</select><label>Cover letter note</label><textarea id="acl" rows="3"></textarea>
 <label><input id="aco" type="checkbox" style="width:auto"> I consent to my data being processed for recruitment (POPIA).</label><br>
 <button class="btn" onclick="sub(${id})">Submit application</button> <button class="btn o" onclick="closeM()">Cancel</button></div></div>`;render()}
async function det(id){
 const a=D.apps.find(x=>x.id==id);let c={};
 try{c=await api('GET','/applications/'+id+'/details')}catch(e){return}
 const f=(l,v)=>v?`<h3 class="sh">${l}</h3><p class="pre">${esc(v)}</p>`:'';
 const t=c.ats||{matched:[],missing:[],flags:[]},sk=(c.skills||a.skills||'').split(',').map(x=>x.trim()).filter(Boolean);
 const sc=(c.scorecards||[]).map(s=>`<div class="card" style="margin:.4rem 0"><b>${esc(s.by)}</b> <span class="chip">${esc(s.overall)}</span> <span class="mut">${esc(new Date(s.at).toLocaleDateString())}</span><br>${s.items.map(i=>`<span class="mut">${esc(i.name)}: ${'★'.repeat(i.rating)||'–'}${i.comment?' ('+esc(i.comment)+')':''}</span>`).join('<br>')}</div>`).join('');
 M=`<div class="ov" onclick="if(event.target===this)closeM()"><div class="md wide"><div class="row" style="justify-content:flex-start;gap:1rem">${av({name:a.name,avatar:c.avatar},'lg')}<div><h3 style="margin:0">${esc(a.name)}</h3>
 <span class="mut">${esc(a.email)}${c.phone?' · '+esc(c.phone):''}${c.loc?' · '+esc(c.loc):''}</span><br><span class="mut">${esc(job(a.job).title)} · Stage: ${a.stage}${c.source?' · Source: '+esc(c.source):''}</span></div></div>
 <div class="row" style="margin:.8rem 0"><span>${chips(sk)}</span>${c.hasCv?`<button class="btn" onclick="dl('/applications/${a.id}/cv','${esc((c.cv||'cv').replace(/'/g,''))}')">Download complete CV</button>`:'<span class="mut">No CV on file</span>'}</div>
 <details open><summary><b>ATS screening</b> <span class="chip">${t.score}% match</span></summary><p>${chips(t.matched)}${(t.missing||[]).map(x=>`<span class="chip miss">${esc(x)}</span>`).join('')}</p>
 <p class="mut">Experience found: ${t.hasCv?t.years+' yr':'unknown'} (required ${t.minYears||0}) · Qualification found: ${esc(t.level||'none')} (required ${esc(t.required||'None')})</p>${(t.flags||[]).map(x=>`<p class="bad" style="margin:.1rem 0">⚠ ${esc(x)}</p>`).join('')}</details>
 <details open><summary><b>CV details</b></summary>${f('Address',c.address)}${f('Education',c.education)}${f('Work experience',c.experience)}${f('Certifications',c.certifications)}${f('Languages',c.languages)}${f('Professional references',c.references)}
 ${c.cvText?`<details><summary class="mut">Full CV text</summary><p class="pre scroll">${esc(c.cvText)}</p></details>`:''}${!c.hasCv&&!c.education&&!c.experience?'<p class="mut">This applicant has no CV details on file yet.</p>':''}</details>
 <details ${(c.scorecards||[]).length?'open':''}><summary><b>Interview assistant</b></summary><div class="row" style="justify-content:flex-start"><button class="btn o" onclick="aiQ(${a.id})">Generate interview questions</button><button class="btn o" onclick="aiS(${a.id})">Generate scorecard</button></div>
 <div id="aiq"></div><div id="ais"></div><h3 class="sh">Saved scorecards</h3>${sc||'<p class="mut">None yet.</p>'}</details>
 <details><summary><b>Message to candidate</b></summary><div class="row" style="justify-content:flex-start"><select id="mk" style="width:210px">${[['received','Application received'],['shortlisted','Shortlisted'],['interview','Interview invitation'],['offer','Offer'],['hired','Welcome / hired'],['rejected','Not successful'],['followup','Follow-up']].map(k=>`<option value="${k[0]}">${k[1]}</option>`).join('')}</select><button class="btn o" onclick="draftM(${a.id})">Auto-generate message</button></div>
 <input id="ms" placeholder="Subject" style="margin-top:.5rem"><textarea id="mb" rows="6" placeholder="Choose a type and select Auto-generate. Edit the message before sending."></textarea><br><br><button class="btn" onclick="sendM(${a.id})">Send email</button> <span class="mut" id="mnote"></span></details>
 ${role!='Hiring Manager'?`<h3 class="sh">Interview</h3>${a.interview?`<p class="mut">Booked: ${esc(new Date(a.interview.when).toLocaleString())} · ${esc(a.interview.mode)}</p>`:''}<div class="grid"><input id="iw" type="datetime-local"><select id="im"><option>Teams</option><option>In person</option><option>Phone</option></select></div><input id="il" placeholder="Meeting link or venue" style="margin-top:.4rem"><br><br><button class="btn" onclick="book(${a.id})">Send invitation</button>`:''}
 <h3 class="sh">Recruiter notes</h3>${a.notes.map(n=>`<p class="chip">${esc(n)}</p>`).join('')||'<p class="mut">No notes yet.</p>'}
 <textarea id="nt" rows="2" placeholder="Add a note"></textarea><br><br><button class="btn" onclick="addN(${a.id})">Add note</button> <button class="btn d" onclick="rej(${a.id});closeM()">Reject</button> <button class="btn o" onclick="closeM()">Close</button></div></div>`;render()}
function tog(id){if(!TOKEN){MBAuth.open('login');return}const x=D.saved.includes(id)?D.saved.filter(i=>i!=id):[...D.saved,id];act(()=>api('PUT','/me',{saved:x}))}
function sub(id){if(!$('aco').checked){alert('Please accept the POPIA consent to continue.');return}
 const c=$('acl').value,sr=$('asr').value;M='';act(()=>api('POST','/applications',{jobId:id,coverNote:c,consent:true,source:sr}))}
function wd(id){act(()=>api('DELETE','/applications/'+id))}
function mv(id,s){if(!id)return;M='';act(()=>api('PATCH','/applications/'+id,{stage:s}))}
function rej(id){act(()=>api('PATCH','/applications/'+id,{stage:'Rejected'}))}
function rate(id,n){act(()=>api('PATCH','/applications/'+id,{rate:n}))}
function fb(id,t){api('PATCH','/applications/'+id,{fb:t}).catch(()=>{})}
function jst(id,s){act(()=>api('PATCH','/jobs/'+id,{st:s}))}
function dup(id){act(()=>api('POST','/jobs/'+id+'/duplicate'))}
function addJ(){const t=$('vt').value.trim();if(!t){alert('Please enter a title.');return}
 act(()=>api('POST','/jobs',{title:t,loc:$('vl').value,sector:$('vi').value,minYears:$('vm').value,qualification:$('vq').value,type:$('vy').value,sal:$('vs').value,skills:$('vk').value.split(',').map(x=>x.trim()).filter(Boolean),desc:$('vd').value}))}
function addN(id){const v=$('nt').value.trim();if(v)api('POST','/applications/'+id+'/notes',{note:v}).then(load).then(()=>det(id)).catch(()=>{})}
function saveProfile(){const g=i=>$(i).value;act(()=>api('PUT','/me',{name:g('pn'),phone:g('pp'),loc:g('pl'),address:g('pa'),skills:g('ps'),education:g('pd'),experience:g('px'),certifications:g('pc'),languages:g('pg'),references:g('pr')}))}
function upAv(f){if(!f)return;const im=new Image();im.onload=()=>{const c=document.createElement('canvas');c.width=c.height=160;const x=c.getContext('2d'),m=Math.min(im.width,im.height);
 x.drawImage(im,(im.width-m)/2,(im.height-m)/2,m,m,0,0,160,160);act(()=>api('PUT','/me',{avatar:c.toDataURL('image/jpeg',.8)}))};im.src=URL.createObjectURL(f)}
async function upCV(f){if(!f)return;const fd=new FormData();fd.append('cv',f);
 try{const r=await fetch(API+'/me/cv',{method:'POST',headers:{Authorization:'Bearer '+TOKEN},body:fd}),j=await r.json();if(!r.ok)throw new Error(j.error);
 alert(j.found.length?'Skills found in your CV: '+j.found.join(', '):'CV saved. No known skills were detected, please add them manually.');await load();render()}catch(e){alert(e.message||'Upload failed')}}
async function dl(path,name){const r=await fetch(API+path,{headers:{Authorization:'Bearer '+TOKEN}});if(!r.ok){alert('Download failed');return}
 const a=document.createElement('a');a.href=URL.createObjectURL(await r.blob());a.download=name;a.click()}
const dlCV=()=>dl('/me/cv',D.me.cv),exp=()=>dl('/me/export','my-data.json');
async function delMe(){const p=prompt('This permanently deletes your account, applications and CV. Type your password to confirm.');if(!p)return;
 try{await api('DELETE','/me',{password:p});alert('Your account and data have been deleted.');signOut()}catch(e){}}
function book(id){const w=$('iw').value;if(!w){alert('Pick a date and time.');return}
 const b={when:new Date(w).toISOString(),mode:$('im').value,link:$('il').value};M='';act(()=>api('POST','/applications/'+id+'/interview',b))}
async function aiQ(id){const o=$('aiq');o.innerHTML='<p class="mut">Generating…</p>';
 try{const r=await api('POST','/applications/'+id+'/ai/questions');o.innerHTML=`<h3 class="sh">Interview questions <span class="mut">(${r.source=='ai'?'written by AI':'from built-in templates'})</span></h3><ol>${r.questions.map(q=>`<li>${esc(q)}</li>`).join('')}</ol>`}catch(e){o.innerHTML=''}}
let SC=null;
async function aiS(id){const o=$('ais');o.innerHTML='<p class="mut">Generating…</p>';
 try{const r=await api('POST','/applications/'+id+'/ai/scorecard');SC=r.criteria;
 o.innerHTML=`<h3 class="sh">Scorecard <span class="mut">(${r.source=='ai'?'written by AI':'from built-in templates'})</span></h3><div class="tw"><table>${r.criteria.map((c,i)=>`<tr><td><b>${esc(c.name)}</b><br><span class="mut">${esc(c.description)}</span></td><td><select id="sr${i}" style="width:90px">${[0,1,2,3,4,5].map(n=>`<option value="${n}">${n?'★'.repeat(n):'–'}</option>`).join('')}</select></td><td><input id="sm${i}" placeholder="Comment"></td></tr>`).join('')}</table></div>
 <div class="row" style="justify-content:flex-start;margin-top:.5rem"><select id="so" style="width:140px">${['Strong yes','Yes','Maybe','No'].map(x=>`<option>${x}</option>`).join('')}</select><button class="btn" onclick="saveSC(${id})">Save scorecard</button></div>`}catch(e){o.innerHTML=''}}
async function saveSC(id){if(!SC)return;const items=SC.map((c,i)=>({name:c.name,rating:+$('sr'+i).value,comment:$('sm'+i).value}));
 try{await api('PUT','/applications/'+id+'/scorecard',{items,overall:$('so').value});await det(id)}catch(e){}}
async function draftM(id){try{const r=await api('POST','/applications/'+id+'/message/draft',{kind:$('mk').value});$('ms').value=r.subject;$('mb').value=r.body;
 $('mnote').textContent=r.source=='ai'?'Written by AI. Please check it before sending.':'From a built-in template. Edit it before sending.'}catch(e){}}
async function sendM(id){const s=$('ms').value.trim(),b=$('mb').value.trim();if(!s||b.length<10){alert('Add a subject and a message first.');return}
 try{await api('POST','/applications/'+id+'/message/send',{subject:s,body:b});$('mnote').textContent='Sent.';$('mb').value='';$('ms').value=''}catch(e){}}
function reqChg(id){M=`<div class="ov" onclick="if(event.target===this)closeM()"><div class="md"><h3>Request changes: ${esc(job(id).title)}</h3><p class="mut">Tell the recruiter what to change. They receive an email with your message and can edit the vacancy.</p><textarea id="rc" rows="4" placeholder="e.g. Please add the salary range and a closing date."></textarea><br><br><button class="btn" onclick="sendChg(${id})">Send to recruiter</button> <button class="btn o" onclick="closeM()">Cancel</button></div></div>`;render()}
function sendChg(id){const n=$('rc').value.trim();if(n.length<5){alert('Please say what needs to change.');return}M='';act(()=>api('PATCH','/jobs/'+id,{st:'Changes requested',note:n}))}
function editJ(id){const j=job(id);M=`<div class="ov" onclick="if(event.target===this)closeM()"><div class="md wide"><h3>Edit vacancy</h3>${j.changeNote?`<p class="bad">The hiring manager asked: ${esc(j.changeNote)}</p>`:''}
 <div class="grid2"><div><label>Title</label><input id="et" value="${esc(j.title)}"></div><div><label>Location</label><input id="el" value="${esc(j.loc)}"></div><div><label>Sector</label><select id="es">${CATS.map(c=>`<option ${c[0]==(j.sector||j.ind)?'selected':''}>${esc(c[0])}</option>`).join('')}</select></div>
 <div><label>Type</label><select id="ey">${['Full-time','Part-time','Contract','Learnership'].map(t=>`<option ${t==j.type?'selected':''}>${t}</option>`).join('')}</select></div><div><label>Salary</label><input id="ea" value="${esc(j.sal)}"></div>
 <div><label>Minimum years of experience</label><input id="em" type="number" min="0" max="40" value="${j.minYears||0}"></div><div><label>Minimum qualification</label><select id="eq">${['None','Matric','Certificate','Diploma','Degree'].map(x=>`<option ${x==(j.qualification||'None')?'selected':''}>${x}</option>`).join('')}</select></div></div>
 <label>Required skills (comma separated)</label><input id="ek" value="${esc(j.skills.join(', '))}"><label>Description</label><textarea id="ed" rows="4">${esc(j.desc)}</textarea><br><br>
 <button class="btn" onclick="saveJ(${id})">Save and resubmit for approval</button> <button class="btn o" onclick="closeM()">Cancel</button></div></div>`;render()}
function saveJ(id){const g=i=>$(i).value;M='';act(()=>api('PUT','/jobs/'+id,{title:g('et'),loc:g('el'),sector:g('es'),type:g('ey'),sal:g('ea'),minYears:g('em'),qualification:g('eq'),skills:g('ek').split(',').map(x=>x.trim()).filter(Boolean),desc:g('ed')}))}
MBAuth.onDone=j=>start(j).then(()=>{history.replaceState({v:view},'');render()});
{const hm=location.hash.match(/reset=([a-f0-9]+)/);
 try{TOKEN=localStorage.getItem('mbono_token')}catch(e){}
 if(hm)TOKEN=null;
 const pub=()=>api('GET','/jobs').then(j=>{D.jobs=j}).catch(()=>{});
 if(TOKEN){QUIET=true;api('GET','/me').then(m=>{role=m.role;view=NAV[role][0][0];return load()}).catch(()=>{TOKEN=null;return pub()}).finally(()=>{QUIET=false;history.replaceState({v:view},'');render()})}
 else pub().finally(()=>{history.replaceState({v:view},'');render();if(hm)MBAuth.open('reset',hm[1]);else if(location.hash=='#login')MBAuth.open('login');else if(location.hash=='#register')MBAuth.open('register')})}
