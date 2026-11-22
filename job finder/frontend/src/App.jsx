import React, { useEffect, useState } from "react";
import {
  ArrowDown, ArrowRight, Bell, BriefcaseBusiness, Check, ChevronDown, Clock3,
  Compass, LayoutDashboard, MapPin, Menu, Search, ShieldCheck, Sparkles,
  Users, X,
} from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const demoDomains = [
  { id: 1, name: "Software Development", icon: "⌘", count: 24, tint: "blue" },
  { id: 2, name: "Data Science", icon: "◉", count: 18, tint: "violet" },
  { id: 3, name: "Cyber Security", icon: "⬡", count: 12, tint: "mint" },
  { id: 4, name: "Healthcare", icon: "✚", count: 16, tint: "coral" },
  { id: 5, name: "Finance", icon: "↗", count: 11, tint: "gold" },
  { id: 6, name: "Web Development", icon: "⌘", count: 21, tint: "blue" },
  { id: 7, name: "Artificial Intelligence", icon: "✳", count: 14, tint: "violet" },
  { id: 8, name: "Machine Learning", icon: "◌", count: 9, tint: "mint" },
];
const demoJobs = [
  { id: "d1", title: "Senior Product Designer", company: "Linear Studio", domain: "Software Development", location: "Remote · US", salary: "$120k – $160k", posted: "2h ago", type: "Full-time", logo: "L", color: "lavender" },
  { id: "d2", title: "Data Scientist", company: "Northstar AI", domain: "Data Science", location: "New York, NY", salary: "$135k – $175k", posted: "5h ago", type: "Full-time", logo: "N", color: "peach" },
  { id: "d3", title: "Security Engineer", company: "Arc Security", domain: "Cyber Security", location: "Remote · US", salary: "$110k – $145k", posted: "1d ago", type: "Full-time", logo: "A", color: "mint" },
  { id: "d4", title: "Frontend Developer", company: "Goodside", domain: "Web Development", location: "Austin, TX", salary: "$95k – $130k", posted: "1d ago", type: "Remote", logo: "G", color: "yellow" },
];

function getStoredUser() {
  try { return JSON.parse(localStorage.getItem("domainly_user") || "null"); } catch { return null; }
}

async function request(path, { token, ...options } = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}

function App() {
  const [user, setUser] = useState(getStoredUser);
  const [page, setPage] = useState("home");
  const [domains, setDomains] = useState(demoDomains);
  const [jobs, setJobs] = useState(demoJobs);
  const [selectedDomain, setSelectedDomain] = useState(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    request("/domains").then((data) => setDomains(data.domains)).catch(() => {});
    request("/jobs").then((data) => setJobs(data.jobs)).catch(() => {});
  }, []);

  const navigate = (next, domain = null) => {
    setPage(next);
    setSelectedDomain(domain);
    setMobileMenu(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const signOut = () => {
    localStorage.removeItem("domainly_user");
    setUser(null);
    navigate("home");
  };
  const flash = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3800);
  };
  const setSession = (session) => {
    localStorage.setItem("domainly_user", JSON.stringify(session));
    setUser(session);
    navigate(session.user.role === "admin" ? "admin" : "home");
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => navigate("home")} aria-label="Domainly home">
          <span className="brand-mark"><Compass size={21} strokeWidth={2.5} /></span>
          <span>domainly<span className="brand-dot">.</span></span>
        </button>
        <button className="mobile-toggle icon-button" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Toggle navigation">
          {mobileMenu ? <X size={20} /> : <Menu size={20} />}
        </button>
        <nav className={`main-nav ${mobileMenu ? "nav-open" : ""}`}>
          <button onClick={() => navigate("home")} className={page === "home" ? "nav-active" : ""}>Home</button>
          <button onClick={() => navigate("all-jobs")} className={page === "all-jobs" ? "nav-active" : ""}>All jobs</button>
          <button onClick={() => document.getElementById("domains")?.scrollIntoView({ behavior: "smooth" })}>Explore domains</button>
        </nav>
        <div className="header-actions">
          {user ? (
            <>
              {user.user.role === "admin" ? (
                <button className="admin-shortcut" onClick={() => navigate("admin")}><ShieldCheck size={16} /> Admin</button>
              ) : (
                <button className="icon-button notification-button" aria-label="Notifications" onClick={() => navigate("notifications")}><Bell size={19} /></button>
              )}
              <span className="header-greeting">Hi, {user.user.name.split(" ")[0]}</span>
              <button className="avatar" onClick={signOut} title="Sign out">{user.user.name[0]?.toUpperCase()}<span className="online-dot" /></button>
            </>
          ) : (
            <>
              <button className="text-button" onClick={() => navigate("login")}>Log in</button>
              <button className="button button-dark button-small" onClick={() => navigate("register")}>Get started <ArrowRight size={15} /></button>
            </>
          )}
        </div>
      </header>

      {page === "home" && <Home domains={domains} jobs={jobs} navigate={navigate} user={user} />}
      {page === "all-jobs" && <AllJobs jobs={jobs} domains={domains} navigate={navigate} />}
      {page === "domain" && <DomainJobs domain={selectedDomain} jobs={jobs} user={user} navigate={navigate} flash={flash} />}
      {page === "login" && <AuthPage mode="login" domains={domains} onAuth={setSession} onSwitch={() => navigate("register")} onAdmin={() => navigate("admin-login")} />}
      {page === "register" && <AuthPage mode="register" domains={domains} onAuth={setSession} onSwitch={() => navigate("login")} />}
      {page === "admin-login" && <AuthPage mode="admin" domains={domains} onAuth={setSession} onSwitch={() => navigate("login")} />}
      {page === "admin" && user?.user.role === "admin" && <AdminPanel token={user.token} flash={flash} onJobCreated={(job) => setJobs((current) => [job, ...current])} />}
      {page === "notifications" && user && <Notifications token={user.token} />}
      {(page === "admin" && user?.user.role !== "admin") && <AuthPage mode="admin" domains={domains} onAuth={setSession} onSwitch={() => navigate("login")} />}
      {notice && <div role="status" className="toast"><Check size={17} />{notice}<button onClick={() => setNotice("")} aria-label="Dismiss"><X size={16} /></button></div>}
      <Footer navigate={navigate} />
    </div>
  );
}

function Home({ domains, jobs, navigate, user }) {
  const [query, setQuery] = useState("");
  const goSearch = (event) => {
    event.preventDefault();
    navigate("all-jobs");
    window.setTimeout(() => window.dispatchEvent(new CustomEvent("job-search", { detail: query })), 50);
  };
  return (
    <main>
      <section className="hero">
        <div className="hero-glow" />
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-dot" /> YOUR NEXT CHAPTER STARTS HERE</div>
          <h1>Find work that<br />feels <em>like you.</em></h1>
          <p>Good work starts with the right fit. Discover opportunities picked for your field, your skills, and the way you want to work.</p>
          <form className="hero-search" onSubmit={goSearch}>
            <Search size={19} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Job title, skill, or company" aria-label="Search jobs" />
            <button type="submit" className="button button-blue">Find a job <ArrowRight size={16} /></button>
          </form>
          <div className="hero-meta"><span><span className="meta-check"><Check size={12} /></span> Curated by domain</span><span><span className="meta-check"><Check size={12} /></span> New roles, no noise</span></div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="orbit orbit-one" /><div className="orbit orbit-two" />
          <div className="art-center"><BriefcaseBusiness size={38} /></div>
          <div className="float-card float-card-top"><span className="float-icon mint">✳</span><span><b>Just for your field</b><small>Work that fits your skills</small></span><Sparkles className="float-spark" size={16} /></div>
          <div className="float-card float-card-bottom"><span className="float-avatar">JD</span><span><b>Your next move</b><small>could be one click away</small></span><ArrowRight size={17} /></div>
          <div className="art-star star-one">✳</div><div className="art-star star-two">✦</div><div className="art-star star-three">·</div>
        </div>
        <div className="hero-bottom"><span>THE RIGHT OPPORTUNITY IS OUT THERE</span><ArrowDown size={16} /></div>
      </section>

      <section className="trust-row content-width">
        <span className="trust-label">A better way to find your next role</span>
        <div className="trust-points"><span><ShieldCheck size={17} /> Your domain, your jobs</span><span><Bell size={17} /> Useful alerts only</span><span><Users size={17} /> 8 career communities</span></div>
      </section>

      <section className="section content-width" id="domains">
        <div className="section-heading">
          <div><div className="eyebrow eyebrow-light">FIND YOUR CORNER</div><h2>Explore by domain<span className="blue-dot">.</span></h2><p>Better matches happen when you start with what you know.</p></div>
          <button className="text-link" onClick={() => navigate("all-jobs")}>See every job <ArrowRight size={16} /></button>
        </div>
        <div className="domain-grid">
          {domains.map((domain, index) => <button key={domain.id} className="domain-card" onClick={() => navigate("domain", domain)}>
            <span className={`domain-icon ${domain.tint || ["blue", "violet", "mint", "coral"][index % 4]}`}>{domain.icon || "✳"}</span>
            <span className="domain-card-copy"><b>{domain.name}</b><small>{domain.count || 0} open roles</small></span>
            <ArrowRight size={17} className="domain-arrow" />
          </button>)}
        </div>
      </section>

      <section className="latest-section">
        <div className="content-width">
          <div className="section-heading">
            <div><div className="eyebrow eyebrow-light">FRESH OFF THE PRESS</div><h2>New opportunities<span className="blue-dot">.</span></h2><p>Good things don’t wait. Neither should you.</p></div>
            <button className="text-link" onClick={() => navigate("all-jobs")}>Browse all jobs <ArrowRight size={16} /></button>
          </div>
          <div className="job-list">{jobs.slice(0, 4).map((job) => <JobCard key={job.id} job={job} navigate={navigate} />)}</div>
        </div>
      </section>

      <section className="how-section content-width">
        <div className="how-intro"><div className="eyebrow eyebrow-light">LESS SCROLLING, MORE POSSIBILITY</div><h2>Make your next move<br />a little more <em>you.</em></h2><p>Job hunting shouldn’t feel like a full-time job. We make the right opportunities easier to find.</p>{!user && <button className="button button-dark" onClick={() => navigate("register")}>Create your free account <ArrowRight size={16} /></button>}</div>
        <div className="steps"><div className="step"><span>01</span><div><h3>Choose your domains</h3><p>Tell us the fields you care about. We’ll keep the rest out of your way.</p></div></div><div className="step"><span>02</span><div><h3>Find a better fit</h3><p>Explore focused job boards—or browse everything when you’re curious.</p></div></div><div className="step"><span>03</span><div><h3>Get the good news</h3><p>Opt into email or SMS alerts for new jobs in your selected domains.</p></div></div></div>
      </section>
      <section className="bottom-cta"><div><span className="eyebrow">YOUR NEXT CHAPTER</span><h2>Ready when you are.</h2><p>Pick your domains. We’ll help you find what comes next.</p></div><button className="button button-white" onClick={() => navigate(user ? "all-jobs" : "register")}>{user ? "Explore open roles" : "Get started for free"} <ArrowRight size={16} /></button></section>
    </main>
  );
}

function JobCard({ job, navigate }) {
  const logo = (job.company || "J").slice(0, 1).toUpperCase();
  return <article className="job-card"><div className={`company-logo ${job.color || "lavender"}`}>{job.logo || logo}</div><div className="job-main"><div className="job-title-row"><h3>{job.title}</h3><span className="job-type">{job.type || "Full-time"}</span></div><div className="job-company">{job.company}</div><div className="job-meta"><span><BriefcaseBusiness size={14} />{job.domain}</span><span><MapPin size={14} />{job.location}</span><span className="job-salary">{job.salary || "Salary not listed"}</span></div></div><div className="job-right"><span className="job-posted"><Clock3 size={13} />{job.posted || "New"}</span><button aria-label={`View ${job.title}`} className="job-arrow" onClick={() => navigate("all-jobs")}><ArrowRight size={17} /></button></div></article>;
}

function AllJobs({ jobs, domains, navigate }) {
  const [query, setQuery] = useState("");
  const [domainId, setDomainId] = useState("");
  useEffect(() => {
    const handler = (e) => setQuery(e.detail || "");
    window.addEventListener("job-search", handler);
    return () => window.removeEventListener("job-search", handler);
  }, []);
  const filtered = jobs.filter((job) => {
    const queryMatch = !query || `${job.title} ${job.company} ${job.domain} ${job.location}`.toLowerCase().includes(query.toLowerCase());
    const chosen = domains.find((domain) => String(domain.id) === domainId);
    return queryMatch && (!chosen || job.domain === chosen.name);
  });
  return <main className="subpage content-width"><div className="eyebrow eyebrow-light">THE WHOLE PICTURE</div><h1>All available jobs<span className="blue-dot">.</span></h1><p className="subpage-lede">Every opportunity in one place. This page is for browsing all jobs and doesn’t send domain alerts.</p><div className="filter-bar"><label className="filter-search"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search title, skill, company" /></label><label className="select-wrap"><select value={domainId} onChange={(e) => setDomainId(e.target.value)}><option value="">All domains</option>{domains.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select><ChevronDown size={15} /></label></div><div className="results-line">{filtered.length} opportunities <span>·</span> All domains {domainId && "· Filtered"}</div><div className="job-list">{filtered.length ? filtered.map((job) => <JobCard key={job.id} job={job} navigate={navigate} />) : <div className="empty-state"><Search size={26} /><h3>No matching roles just yet</h3><p>Try a different search or select another domain.</p></div>}</div></main>;
}

function DomainJobs({ domain, jobs, user, navigate, flash }) {
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const matching = jobs.filter((job) => job.domain === domain?.name);
  useEffect(() => {
    if (user?.token) request("/preferences", { token: user.token }).then(({ preferences }) => {
      setSubscribed(preferences.domainIds.includes(Number(domain?.id)));
    }).catch(() => {});
  }, [domain, user]);
  const toggle = async () => {
    if (!user) { navigate("register"); return; }
    setBusy(true);
    try {
      const { preferences } = await request("/preferences", { token: user.token });
      const domainIds = preferences.domainIds.map(Number);
      const updated = subscribed ? domainIds.filter((id) => id !== Number(domain.id)) : [...new Set([...domainIds, Number(domain.id)])];
      await request("/preferences", { token: user.token, method: "PUT", body: JSON.stringify({ domainIds: updated, emailEnabled: preferences.emailEnabled, phoneEnabled: preferences.phoneEnabled }) });
      setSubscribed(!subscribed);
      flash(subscribed ? "Domain alerts turned off." : "You’re subscribed to this domain.");
    } catch (error) { flash(error.message); }
    finally { setBusy(false); }
  };
  return <main className="subpage content-width domain-page"><button className="back-link" onClick={() => navigate("home")}>← All domains</button><div className="domain-hero"><span className={`domain-icon large ${domain?.tint || "blue"}`}>{domain?.icon || "✳"}</span><div><div className="eyebrow eyebrow-light">A SPACE OF YOUR OWN</div><h1>{domain?.name || "Domain jobs"}<span className="blue-dot">.</span></h1><p>{matching.length} open {matching.length === 1 ? "opportunity" : "opportunities"} in this domain</p></div></div><div className="alert-panel"><div className="alert-panel-icon"><Bell size={19} /></div><div className="alert-panel-copy"><b>Want to know when new roles arrive?</b><p>Get notifications for new jobs in {domain?.name} by email or mobile.</p></div><button className={`button ${subscribed ? "button-subscribed" : "button-dark"}`} onClick={toggle} disabled={busy}>{subscribed ? <><Check size={16} /> Following</> : user ? "Get domain alerts" : "Sign up for alerts"}</button></div><div className="section-heading compact"><div><div className="eyebrow eyebrow-light">HAND-PICKED FOR THIS FIELD</div><h2>Open roles<span className="blue-dot">.</span></h2></div></div><div className="job-list">{matching.length ? matching.map((job) => <JobCard key={job.id} job={job} navigate={navigate} />) : <div className="empty-state"><BriefcaseBusiness size={27} /><h3>More opportunities are on the way</h3><p>Check back soon for new roles in this domain.</p></div>}</div></main>;
}

function AuthPage({ mode, domains, onAuth, onSwitch, onAdmin }) {
  const isRegister = mode === "register";
  const isAdminLogin = mode === "admin";
  const [fields, setFields] = useState({ name: "", email: "", phone: "", password: "" });
  const [selected, setSelected] = useState([]);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [phoneEnabled, setPhoneEnabled] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const update = (key) => (event) => setFields((f) => ({ ...f, [key]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const body = isRegister ? { ...fields, domainIds: selected.map(Number), emailEnabled, phoneEnabled } : { email: fields.email, password: fields.password };
      const session = await request(`/auth/${isRegister ? "register" : "login"}`, { method: "POST", body: JSON.stringify(body) });
      if (isAdminLogin && session.user.role !== "admin") {
        setError("This account does not have administrator access.");
        return;
      }
      onAuth(session);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  return <main className="auth-page"><div className="auth-aside"><div className="auth-aside-content"><div className="eyebrow">{isAdminLogin ? "DOMAINLY ADMINISTRATION" : "MAKE ROOM FOR WHAT’S NEXT"}</div><h2>{isAdminLogin ? <>Keep great roles<br />in <em>reach.</em></> : isRegister ? <>A better job search<br />starts with <em>you.</em></> : <>Good to see<br />you <em>again.</em></>}</h2><p>{isAdminLogin ? "Sign in to manage job listings and keep opportunities organized by domain." : isRegister ? "Choose your fields, set your preferences, and let the right opportunities find their way to you." : "Your next opportunity could be just around the corner. Let’s pick up where you left off."}</p><div className="auth-benefits">{isAdminLogin ? <><span><Check size={15} /> Publish jobs in the right domain</span><span><Check size={15} /> Keep listings organized</span><span><Check size={15} /> Notify matching subscribers</span></> : <><span><Check size={15} /> Jobs, sorted by your domain</span><span><Check size={15} /> Alerts on your terms</span><span><Check size={15} /> Always free for job seekers</span></>}</div><div className="aside-decor">✳</div></div></div><div className="auth-form-wrap"><form className="auth-form" onSubmit={submit}><div className="eyebrow eyebrow-light">{isAdminLogin ? "SECURE ADMIN ACCESS" : isRegister ? "A FEW DETAILS TO GET STARTED" : "WELCOME BACK"}</div><h1>{isAdminLogin ? "Administrator login" : isRegister ? "Create your account" : "Log in to Domainly"}</h1><p className="auth-subtitle">{isAdminLogin ? "Sign in to publish and manage job listings." : isRegister ? "Join the community and find work that fits." : "Enter your details below to continue."}</p>{error && <div className="form-error" role="alert">{error}</div>}{isRegister && <label className="field-label">Full name<input required autoComplete="name" value={fields.name} onChange={update("name")} placeholder="Your name" /></label>}<label className="field-label">Email address<input required type="email" autoComplete="email" value={fields.email} onChange={update("email")} placeholder="you@example.com" /></label>{isRegister && <label className="field-label">Mobile number <span className="optional">(optional)</span><input type="tel" autoComplete="tel" value={fields.phone} onChange={update("phone")} placeholder="+1 555 000 0000" /></label>}<label className="field-label">Password<input required type="password" autoComplete={isRegister ? "new-password" : "current-password"} minLength={isRegister ? 8 : undefined} value={fields.password} onChange={update("password")} placeholder={isRegister ? "At least 8 characters" : "Your password"} /></label>{isRegister && <><div className="domain-picker"><div className="picker-heading"><b>Your domains</b><span>Select one or more</span></div><div className="picker-chips">{domains.map((domain) => <button type="button" key={domain.id} className={`picker-chip ${selected.includes(domain.id) ? "chip-selected" : ""}`} onClick={() => setSelected((s) => s.includes(domain.id) ? s.filter((id) => id !== domain.id) : [...s, domain.id])}>{selected.includes(domain.id) && <Check size={12} />}{domain.name}</button>)}</div></div><div className="preference-box"><b>New job alerts</b><label><input type="checkbox" checked={emailEnabled} onChange={(e) => setEmailEnabled(e.target.checked)} /> Email {fields.email && <span className="preference-contact">{fields.email}</span>}</label><label><input type="checkbox" checked={phoneEnabled} onChange={(e) => setPhoneEnabled(e.target.checked)} /> Mobile {fields.phone && <span className="preference-contact">{fields.phone}</span>}</label></div></>}<button disabled={busy} className="button button-dark auth-submit" type="submit">{busy ? "Please wait…" : isAdminLogin ? "Sign in to admin" : isRegister ? "Create my account" : "Log in"} {!busy && <ArrowRight size={16} />}</button>{isAdminLogin ? <p className="switch-auth">Job seeker? <button type="button" onClick={onSwitch}>Sign in here</button></p> : <p className="switch-auth">{isRegister ? "Already have an account?" : "New to Domainly?"} <button type="button" onClick={onSwitch}>{isRegister ? "Log in" : "Create an account"}</button>{!isRegister && onAdmin && <> · <button type="button" onClick={onAdmin}>Administrator login</button></>}</p>}<p className="privacy-note"><ShieldCheck size={14} /> Your information stays private and secure.</p></form></div></main>;
}

function AdminPanel({ token, flash, onJobCreated }) {
  const [tab, setTab] = useState("overview");
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ users: 0, jobs: 0, seekers: 0, employers: 0 });
  const [domains, setDomains] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ title: "", company: "", domainId: "", location: "", salary: "", description: "" });
  const [busy, setBusy] = useState(false);
  const load = async () => {
    setError("");
    try {
      const [overview, userData, jobData, domainData, logData] = await Promise.all([
        request("/admin/summary", { token }), request("/admin/users", { token }),
        request("/admin/jobs", { token }), request("/domains"),
        request("/admin/notifications", { token }),
      ]);
      setStats(overview); setUsers(userData.users); setJobs(jobData.jobs); setDomains(domainData.domains); setLogs(logData.notifications);
      setForm((f) => ({ ...f, domainId: f.domainId || String(domainData.domains[0]?.id || "") }));
    } catch (e) { setError(e.message); }
  };
  useEffect(() => { load(); }, [token]);
  const createJob = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const result = await request("/admin/jobs", { token, method: "POST", body: JSON.stringify({ ...form, domainId: Number(form.domainId) }) });
      flash(`Job published. ${result.notificationsCreated} domain notification(s) created.`);
      onJobCreated(result.job);
      setForm((f) => ({ ...f, title: "", company: "", location: "", salary: "", description: "" }));
      await load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  const nav = [["overview", "Overview", LayoutDashboard], ["users", "Users", Users], ["jobs", "Jobs", BriefcaseBusiness], ["notifications", "Notification log", Bell]];
  return <main className="admin-layout"><aside className="admin-sidebar"><div className="admin-label"><ShieldCheck size={17} /> ADMIN CONSOLE</div><h2>Workspace</h2>{nav.map(([key, title, Icon]) => <button key={key} className={`admin-nav-item ${tab === key ? "admin-nav-active" : ""}`} onClick={() => setTab(key)}><Icon size={17} />{title}{key === "notifications" && logs.length > 0 && <span className="nav-count">{logs.length}</span>}</button>)}<div className="sidebar-bottom"><span className="sidebar-status"><span className="status-dot" />System operational</span></div></aside><section className="admin-content"><div className="admin-topline"><div><div className="eyebrow eyebrow-light">DOMAINLY / ADMIN</div><h1>{nav.find(([key]) => key === tab)?.[1]}</h1></div><span className="admin-date"><ShieldCheck size={15} /> Secure admin access</span></div>{error && <div className="form-error admin-error" role="alert">{error}<button onClick={() => setError("")}><X size={15} /></button></div>}{tab === "overview" && <><div className="stats-grid"><Stat label="Registered users" value={stats.users} icon={<Users />} tint="blue" /><Stat label="Job seekers" value={stats.seekers} icon={<Compass />} tint="violet" /><Stat label="Employers" value={stats.employers} icon={<BriefcaseBusiness />} tint="gold" /><Stat label="Published jobs" value={stats.jobs} icon={<Sparkles />} tint="mint" /></div><div className="admin-columns"><div className="admin-panel-card"><div className="panel-title"><div><h3>Publish a new job</h3><p>Matching domain members will be notified.</p></div><span className="live-tag"><span /> LIVE</span></div><form className="job-create-form" onSubmit={createJob}><div className="two-fields"><label className="field-label">Job title<input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Product Designer" /></label><label className="field-label">Company<input required value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Company name" /></label></div><div className="two-fields"><label className="field-label">Domain<select required value={form.domainId} onChange={(e) => setForm({ ...form, domainId: e.target.value })}><option value="">Choose a domain</option>{domains.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label><label className="field-label">Location<input required value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Remote or city" /></label></div><label className="field-label">Salary range <span className="optional">(optional)</span><input value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} placeholder="$80k – $100k" /></label><label className="field-label">Description<textarea required rows="3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What makes this opportunity special?" /></label><button disabled={busy} className="button button-dark">{busy ? "Publishing…" : "Publish job"} <ArrowRight size={16} /></button></form></div><div className="admin-panel-card recent-panel"><div className="panel-title"><div><h3>Recently added</h3><p>Latest openings across all domains</p></div><button className="text-link small-link" onClick={() => setTab("jobs")}>View all <ArrowRight size={14} /></button></div>{jobs.slice(0, 4).map((job) => <div className="recent-job" key={job.id}><span className="recent-job-icon">{job.company?.[0] || "J"}</span><span><b>{job.title}</b><small>{job.company} · {job.domain}</small></span><span className="job-posted">{job.posted || "New"}</span></div>)}</div></div></>}{tab === "users" && <div className="admin-panel-card"><div className="panel-title"><div><h3>People on Domainly</h3><p>Account contact details and domain subscriptions. Passwords are never displayed.</p></div><span className="table-count">{users.length} accounts</span></div><div className="table-scroll"><table><thead><tr><th>NAME</th><th>EMAIL</th><th>MOBILE</th><th>ROLE</th><th>DOMAINS</th><th>JOINED</th></tr></thead><tbody>{users.map((u) => <tr key={u.id}><td><span className="user-cell"><span className="table-avatar">{u.name?.[0]?.toUpperCase()}</span><b>{u.name}</b></span></td><td>{u.email}</td><td>{u.phone || "—"}</td><td><span className={`role-tag ${u.role}`}>{u.role}</span></td><td>{u.domains?.join(", ") || "—"}</td><td>{new Date(u.createdAt).toLocaleDateString()}</td></tr>)}</tbody></table></div></div>}{tab === "jobs" && <div className="admin-panel-card"><div className="panel-title"><div><h3>Published jobs</h3><p>All jobs are kept under their selected domain.</p></div><span className="table-count">{jobs.length} jobs</span></div><div className="table-scroll"><table><thead><tr><th>TITLE</th><th>COMPANY</th><th>DOMAIN</th><th>LOCATION</th><th>SALARY</th><th>POSTED</th></tr></thead><tbody>{jobs.map((j) => <tr key={j.id}><td><b>{j.title}</b></td><td>{j.company}</td><td><span className="domain-tag">{j.domain}</span></td><td>{j.location}</td><td>{j.salary || "—"}</td><td>{j.posted || "New"}</td></tr>)}</tbody></table></div></div>}{tab === "notifications" && <div className="admin-panel-card"><div className="panel-title"><div><h3>Delivery activity</h3><p>In-app alerts and optional email/SMS delivery attempts for domain subscribers.</p></div><span className="table-count">{logs.length} records</span></div><div className="table-scroll"><table><thead><tr><th>RECIPIENT</th><th>JOB</th><th>CHANNEL</th><th>STATUS</th><th>CREATED</th></tr></thead><tbody>{logs.map((n) => <tr key={n.id}><td>{n.name}<small className="table-secondary">{n.email}</small></td><td>{n.jobTitle}</td><td>{n.channel}</td><td><span className={`delivery-tag ${n.status}`}>{n.status}</span></td><td>{new Date(n.createdAt).toLocaleString()}</td></tr>)}</tbody></table></div></div>}</section></main>;
}

function Stat({ label, value, icon, tint }) {
  return <div className="stat-card"><span className={`stat-icon ${tint}`}>{icon}</span><div><span>{label}</span><b>{value}</b></div><span className="stat-trend"><ArrowDown size={13} /></span></div>;
}

function Notifications({ token }) {
  const [items, setItems] = useState([]);
  const [domains, setDomains] = useState([]);
  const [preferences, setPreferences] = useState(null);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [saving, setSaving] = useState(false);

  const loadNotifications = async () => {
    const [{ notifications }, { preferences: currentPreferences }, { domains: availableDomains }] = await Promise.all([
      request("/notifications", { token }),
      request("/preferences", { token }),
      request("/domains"),
    ]);
    setItems(notifications);
    setPreferences(currentPreferences);
    setPhone(currentPreferences.phone || "");
    setDomains(availableDomains);
  };

  useEffect(() => {
    loadNotifications().catch((e) => setError(e.message));
  }, [token]);

  const savePreferences = async (event) => {
    event.preventDefault();
    setError("");
    setSaved("");
    setSaving(true);
    try {
      const { preferences: updated } = await request("/preferences", {
        token,
        method: "PUT",
        body: JSON.stringify({
          domainIds: preferences.domainIds,
          emailEnabled: preferences.emailEnabled,
          phoneEnabled: preferences.phoneEnabled,
          phone,
        }),
      });
      setPreferences(updated);
      setPhone(updated.phone || "");
      await loadNotifications();
      setSaved("Preferences saved. Matching jobs from your selected domains are in your notifications.");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const deliveryStatus = (item) => {
    if (item.status !== "pending") return item.status;
    if (item.channel === "email" && !preferences?.deliveryConfigured?.email) return "waiting for SMTP";
    if (item.channel === "sms" && !preferences?.deliveryConfigured?.sms) return "waiting for Twilio";
    return "queued";
  };

  return (
    <main className="subpage content-width">
      <div className="eyebrow eyebrow-light">YOUR DOMAIN UPDATES</div>
      <h1>Notifications<span className="blue-dot">.</span></h1>
      <p className="subpage-lede">Available jobs in the domains you follow, including roles posted before you joined.</p>
      {error && <div className="form-error" role="alert">{error}</div>}
      {saved && <div className="notification-saved" role="status">{saved}</div>}
      {preferences && (
        <form className="notification-settings" onSubmit={savePreferences}>
          <div className="notification-settings-heading">
            <div className="eyebrow eyebrow-light">DELIVERY PREFERENCES</div>
            <h2>Choose your domains and delivery channels</h2>
            <p>Matching published jobs appear here automatically. Email and SMS alerts are optional and require their respective provider setup.</p>
          </div>
          <div className="notification-domain-picker">
            <div className="notification-domain-heading">
              <b>Domains to follow</b>
              <button type="button" className="text-link" onClick={() => setPreferences({ ...preferences, domainIds: domains.map((domain) => Number(domain.id)) })}>
                {preferences.domainIds.length === domains.length ? "All domains selected" : "Select all domains"}
              </button>
            </div>
            <div className="picker-chips">
              {domains.map((domain) => {
                const selected = preferences.domainIds.map(Number).includes(Number(domain.id));
                return <button type="button" key={domain.id} className={`picker-chip ${selected ? "chip-selected" : ""}`} onClick={() => setPreferences({ ...preferences, domainIds: selected ? preferences.domainIds.filter((id) => Number(id) !== Number(domain.id)) : [...preferences.domainIds, Number(domain.id)] })}>{selected && <Check size={12} />}{domain.name}</button>;
              })}
            </div>
          </div>
          <div className="notification-settings-fields">
            <label className="field-label">Registered email<input type="email" value={preferences.email || ""} disabled /></label>
            <label className="field-label">Mobile number<input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 000 0000" /></label>
          </div>
          <div className="notification-channels">
            <label><input type="checkbox" checked={preferences.emailEnabled} onChange={(e) => setPreferences({ ...preferences, emailEnabled: e.target.checked })} /> Email job alerts</label>
            <label><input type="checkbox" checked={preferences.phoneEnabled} onChange={(e) => setPreferences({ ...preferences, phoneEnabled: e.target.checked })} /> SMS job alerts</label>
          </div>
          <p className="provider-status">In-app alerts are active · Email: {preferences.deliveryConfigured?.email ? "configured" : "SMTP setup required"} · SMS: {preferences.deliveryConfigured?.sms ? "configured" : "Twilio setup required"}</p>
          <button type="submit" className="button button-dark" disabled={saving}>{saving ? "Saving…" : "Save preferences"} <Check size={15} /></button>
        </form>
      )}
      <div className="notification-list">
        {items.length ? items.map((item) => (
          <article className="notification-item" key={item.id}>
            <span className="notification-symbol"><Bell size={18} /></span>
            <div><b>{item.jobTitle}</b><p>{item.company} · {item.domain} · {item.location}</p><small>{new Date(item.createdAt).toLocaleString()} · {item.channel === "in_app" ? "In-app job alert" : `${item.channel} · ${deliveryStatus(item)}`}</small></div>
          </article>
        )) : !error && <div className="empty-state"><Bell size={26} /><h3>No matching job notifications yet</h3><p>Follow a domain to get its existing and future job alerts.</p></div>}
      </div>
    </main>
  );
}

function Footer({ navigate }) {
  return <footer className="footer"><div className="footer-main content-width"><button className="brand footer-brand" onClick={() => navigate("home")}><span className="brand-mark"><Compass size={20} /></span><span>domainly<span className="brand-dot">.</span></span></button><span>Find a little more meaning in your next move.</span><div className="footer-links"><button onClick={() => navigate("all-jobs")}>All jobs</button><button onClick={() => navigate("register")}>Join Domainly</button><button onClick={() => navigate("admin-login")}>Admin sign in</button></div></div><div className="footer-bottom content-width"><span>© {new Date().getFullYear()} Domainly. Built for your next chapter.</span><span>Jobs that fit. Opportunities that matter.</span></div></footer>;
}

export default App;
