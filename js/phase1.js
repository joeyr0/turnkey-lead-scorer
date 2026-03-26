// ============================================================
// PHASE 1: File parsing, column mapping, grouping, pre-flagging
// ============================================================

// ---- Matching functions ----

function isExistingCustomer(companyName, domain) {
  const norm = normalizeCompanyName(companyName);
  const d = normalizeDomain(domain);

  if (norm.length > 2) {
    for (const name of TURNKEY_CUSTOMERS) {
      if (normalizeCompanyName(name) === norm) return true;
    }
    // Also check additional customers added at preflight
    for (const name of (APP_STATE.additionalCustomers || [])) {
      if (normalizeCompanyName(name) === norm && norm.length > 2) return true;
    }
  }
  if (d && CUSTOMER_DOMAINS.includes(d)) return true;
  return false;
}

function isHardCompetitor(companyName, domain) {
  const norm = normalizeCompanyName(companyName);
  const d = normalizeDomain(domain);
  for (const name of COMPETITORS_HARD) {
    if (normalizeCompanyName(name) === norm && norm.length > 1) return true;
  }
  for (const name of (APP_STATE.additionalCompetitors || [])) {
    if (normalizeCompanyName(name) === norm && norm.length > 2) return true;
  }
  if (d && ALWAYS_EXCLUDE_DOMAINS.includes(d)) return true;
  for (const name of ALWAYS_EXCLUDE_COMPANIES) {
    if (normalizeCompanyName(name) === norm) return true;
  }
  return false;
}

function isTvcEligible(companyName, domain) {
  const norm = normalizeCompanyName(companyName);
  const d = normalizeDomain(domain);
  for (const name of COMPETITORS_TVC_ELIGIBLE) {
    if (normalizeCompanyName(name) === norm && norm.length > 1) return true;
  }
  return false;
}

function isNeverCompetitor(companyName, domain) {
  const norm = normalizeCompanyName(companyName);
  const d = normalizeDomain(domain);
  for (const name of NEVER_COMPETITORS) {
    if (normalizeCompanyName(name) === norm) return true;
  }
  if (d && NEVER_COMPETITOR_DOMAINS.includes(d)) return true;
  return false;
}

function isTier1(companyName, domain) {
  const norm = normalizeCompanyName(companyName);
  const d = normalizeDomain(domain);
  for (const name of TIER_1_TARGETS) {
    if (normalizeCompanyName(name) === norm && norm.length > 1) return true;
  }
  if (d && TIER_1_DOMAINS.includes(d)) return true;
  return false;
}

function getWarmPath(companyName, domain) {
  const norm = normalizeCompanyName(companyName);
  for (const [program, data] of Object.entries(PARTNERSHIP_PROGRAMS)) {
    for (const co of data.companies) {
      if (normalizeCompanyName(co) === norm) return data.signal;
    }
  }
  if (CONFIRMED_INVESTOR_PORTCOS[norm]) {
    return `Shared investor — ${CONFIRMED_INVESTOR_PORTCOS[norm]}`;
  }
  return null;
}

function isTurnkeyEmployee(email, companyName) {
  if (!email && !companyName) return false;
  if (email && email.toLowerCase().endsWith('@turnkey.com')) return true;
  if (companyName && normalizeCompanyName(companyName) === 'turnkey') return true;
  return false;
}

// ---- File handling ----

function handleFile(file) {
  APP_STATE.fileName = file.name;
  const ext = file.name.split('.').pop().toLowerCase();

  if (ext === 'csv') {
    const reader = new FileReader();
    reader.onload = e => processRawText(e.target.result);
    reader.readAsText(file);
  } else if (ext === 'xlsx' || ext === 'xls') {
    const reader = new FileReader();
    reader.onload = e => {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_csv(ws);
      processRawText(data);
    };
    reader.readAsArrayBuffer(file);
  } else {
    showError('Unsupported file type. Please upload a CSV or XLSX file.');
  }
}

function processRawText(text) {
  const result = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    trimHeaders: true
  });

  if (!result.data || result.data.length === 0) {
    showError('File appears to be empty or could not be parsed.');
    return;
  }

  APP_STATE.rawHeaders = result.meta.fields || [];
  APP_STATE.rawRows = result.data;

  // Detect column mappings
  const h = APP_STATE.rawHeaders;
  APP_STATE.columnMap = {
    company:  findField(h, 'company', 'organization', 'account name', 'account', 'company name', 'org'),
    domain:   findField(h, 'domain', 'website', 'company domain', 'url', 'web', 'site'),
    name:     findField(h, 'contact name', 'full name', 'name', 'first name', 'contact'),
    title:    findField(h, 'title', 'job title', 'position', 'role', 'job role'),
    email:    findField(h, 'email', 'email address', 'work email', 'e-mail'),
    linkedin: findField(h, 'linkedin', 'linkedin url', 'profile url', 'li url', 'linkedin profile'),
  };

  // Build and flag groups
  rebuildGroups();
  renderPreFlight();
  showView('view-preflight');
}

// ---- Grouping ----

function rebuildGroups() {
  const cm = APP_STATE.columnMap;
  const rows = APP_STATE.rawRows;

  // Build contact list from rows
  const contacts = rows.map(row => ({
    name:     row[cm.name]    || '',
    title:    row[cm.title]   || '',
    email:    row[cm.email]   || '',
    linkedin: row[cm.linkedin]|| '',
    rawCompany: row[cm.company] || '',
    rawDomain:  row[cm.domain]  || '',
  })).filter(c => c.rawCompany || c.rawDomain); // need at least one

  // Group by normalized domain (fall back to company name for personal emails)
  const groups = new Map(); // key → {domain, companyName, contacts}
  const emailSeen = new Map(); // email → domainKey (for dedup)

  for (const c of contacts) {
    const rawDomain = normalizeDomain(c.rawDomain);
    // Use domain as group key unless it's a personal email domain
    let groupKey;
    if (rawDomain && !PERSONAL_EMAIL_DOMAINS.has(rawDomain)) {
      groupKey = rawDomain;
    } else {
      // Fall back to normalized company name
      groupKey = 'co:' + normalizeCompanyName(c.rawCompany || 'unknown');
    }

    if (!groupKey || groupKey === 'co:') continue;

    // Dedup by email within same group
    if (c.email && emailSeen.has(c.email.toLowerCase())) {
      continue; // skip duplicate email
    }
    if (c.email) emailSeen.set(c.email.toLowerCase(), groupKey);

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        domain: rawDomain || '',
        companyName: c.rawCompany || rawDomain || groupKey,
        contacts: [],
        flags: {
          isExistingCustomer: false,
          isCompetitor: false,
          isTvcEligibleCompetitor: false,
          isTier1Target: false,
          warmPath: null,
          isTurnkeyEmployee: false,
        },
        // Scoring fields (populated later)
        icpScore: null,
        icpLabel: null,
        tvcScore: null,
        tvcLabel: null,
        confidence: null,
        isReferralSource: false,
        outreachAngle: null,
        primarySolution: null,
        secondarySolutions: [],
        outreachHook: null,
        relevantReferences: [],
        reasoning: null,
        companyAction: null,
        scoringFailed: false,
        // Audit fields
        auditVerdict: null,
        auditNewIcpScore: null,
        auditReasoning: null,
        auditContactGap: null,
        auditSolutionCorrection: null,
        originalIcpScore: null,
      });
    }

    const group = groups.get(groupKey);
    // Always use first encountered company name
    if (!group.companyName && c.rawCompany) group.companyName = c.rawCompany;

    // Add contact if it has any useful data
    if (c.name || c.title || c.email) {
      group.contacts.push({
        name: c.name,
        title: c.title,
        email: c.email,
        linkedin: c.linkedin,
        // Scoring fields
        contactScore: null,
        contactLabel: null,
        contactReasoning: null,
        linkedinRequest: null,
        championPath: null,
        contactAction: null,
      });
    }
  }

  // Run pre-flagging on all groups
  const groupArr = Array.from(groups.values());
  for (const g of groupArr) {
    runPreFlagging(g);
  }

  APP_STATE.companyGroups = groupArr;

  // Detect if this is a company-only list
  const hasAnyContacts = groupArr.some(g => g.contacts.length > 0 && (
    g.contacts.some(c => c.name || c.email)
  ));
  APP_STATE.isCompanyOnlyList = !hasAnyContacts;
}

function runPreFlagging(group) {
  const { companyName, domain } = group;
  const f = group.flags;

  f.isExistingCustomer    = isExistingCustomer(companyName, domain);
  f.isCompetitor          = !f.isExistingCustomer && isHardCompetitor(companyName, domain);
  f.isTvcEligibleCompetitor = !f.isExistingCustomer && isTvcEligible(companyName, domain);
  f.isTier1Target         = !f.isExistingCustomer && isTier1(companyName, domain);
  f.warmPath              = getWarmPath(companyName, domain);
  f.isTurnkeyEmployee     = group.contacts.some(c => isTurnkeyEmployee(c.email, companyName));

  // Pre-assign scores for non-API companies
  if (f.isExistingCustomer) {
    group.icpScore    = 5;
    group.icpLabel    = 'Existing Customer';
    group.tvcScore    = 1;
    group.tvcLabel    = 'No TVC Relevance';
    group.confidence  = 'HIGH';
    group.companyAction = 'SKIP';
  } else if (f.isCompetitor && !f.isTvcEligibleCompetitor) {
    group.icpScore    = 1;
    group.icpLabel    = 'Competitor';
    group.tvcScore    = 1;
    group.tvcLabel    = 'No TVC Relevance';
    group.confidence  = 'HIGH';
    group.companyAction = 'SKIP';
  } else if (f.isTier1Target) {
    group.icpScore    = 5;
    group.icpLabel    = 'Definite Target';
  }
}

// ---- Pre-flight UI ----

function renderPreFlight() {
  const groups = APP_STATE.companyGroups;
  const totalContacts = APP_STATE.rawRows.length;
  const totalCompanies = groups.length;

  const customers   = groups.filter(g => g.flags.isExistingCustomer).length;
  const competitors = groups.filter(g => g.flags.isCompetitor && !g.flags.isTvcEligibleCompetitor).length;
  const tvcEligible = groups.filter(g => g.flags.isTvcEligibleCompetitor).length;
  const tier1       = groups.filter(g => g.flags.isTier1Target && !g.flags.isExistingCustomer).length;
  const employees   = groups.filter(g => g.flags.isTurnkeyEmployee).length;
  const warmPaths   = groups.filter(g => g.flags.warmPath).length;
  const toScore     = groups.filter(g =>
    !g.flags.isExistingCustomer &&
    !(g.flags.isCompetitor && !g.flags.isTvcEligibleCompetitor) &&
    !g.flags.isTurnkeyEmployee
  ).length;

  const h = APP_STATE.rawHeaders;
  const cm = APP_STATE.columnMap;

  function colSelect(field, label) {
    const opts = ['— not mapped —', ...h].map(hdr => {
      const sel = hdr === (cm[field] || '') ? 'selected' : '';
      return `<option value="${escHtml(hdr)}" ${sel}>${escHtml(hdr)}</option>`;
    }).join('');
    return `
      <div class="col-map-row">
        <label class="col-map-label">${label}</label>
        <select class="col-map-select" data-field="${field}" onchange="onColMapChange()">
          ${opts}
        </select>
      </div>`;
  }

  document.getElementById('preflight-content').innerHTML = `
    <div class="preflight-header">
      <div class="preflight-file">
        <span class="file-icon">📄</span>
        <span class="file-name">${escHtml(APP_STATE.fileName || 'file.csv')}</span>
      </div>
      <div class="preflight-counts">
        <span>${fmt(totalContacts)} rows · ${fmt(totalCompanies)} unique companies</span>
      </div>
    </div>

    <div class="preflight-section">
      <div class="section-title">Column Mapping</div>
      <div class="col-map-grid">
        ${colSelect('company',  'Company')}
        ${colSelect('domain',   'Domain *')}
        ${colSelect('name',     'Contact Name')}
        ${colSelect('title',    'Title')}
        ${colSelect('email',    'Email')}
        ${colSelect('linkedin', 'LinkedIn')}
      </div>
      ${!cm.domain ? '<div class="error-inline">⚠ Domain column is required. Please map it above.</div>' : ''}
    </div>

    <div class="preflight-section">
      <div class="section-title">Pre-flagged</div>
      <div class="flag-list">
        ${customers   ? `<div class="flag-item flag-customer">● ${customers} existing customer${customers>1?'s':''} (auto-exclude)</div>` : ''}
        ${competitors ? `<div class="flag-item flag-competitor">● ${competitors} competitor${competitors>1?'s':''} (auto-exclude)</div>` : ''}
        ${tvcEligible ? `<div class="flag-item flag-tvc">● ${tvcEligible} TVC-eligible competitor${tvcEligible>1?'s':''} (score for TVC only)</div>` : ''}
        ${tier1       ? `<div class="flag-item flag-tier1">● ${tier1} Tier 1 target${tier1>1?'s':''} (auto-score 5)</div>` : ''}
        ${employees   ? `<div class="flag-item flag-employee">● ${employees} Turnkey employee${employees>1?'s':''}</div>` : ''}
        ${warmPaths   ? `<div class="flag-item flag-warm">● ${warmPaths} warm path connection${warmPaths>1?'s':''}</div>` : ''}
        <div class="flag-item flag-score">● ${fmt(toScore)} compan${toScore===1?'y':'ies'} to score via API</div>
      </div>
    </div>

    <div class="preflight-section">
      <div class="section-title">Additional Exclusions <span class="optional">(optional)</span></div>
      <div class="extras-grid">
        <div>
          <label class="extras-label">Paste customer names to exclude (one per line)</label>
          <textarea id="extra-customers" class="extras-textarea" placeholder="Acme Corp&#10;Another Company" rows="4"></textarea>
        </div>
        <div>
          <label class="extras-label">Paste competitor names to exclude (one per line)</label>
          <textarea id="extra-competitors" class="extras-textarea" placeholder="CompetitorX&#10;CompetitorY" rows="4"></textarea>
        </div>
      </div>
    </div>

    <div class="preflight-section">
      <div class="section-title">Event Context <span class="optional">(optional)</span></div>
      <div class="event-row">
        <input type="text" id="event-name-input" class="event-input"
          placeholder="e.g. Money 20/20, Consensus 2025"
          value="${escHtml(APP_STATE.eventName || '')}">
        <span class="event-hint">If provided, LinkedIn requests will reference this event.</span>
      </div>
    </div>

    <div class="preflight-actions">
      <button class="btn-secondary btn-large" onclick="startScoring(true)"
        ${!cm.domain ? 'disabled title="Map the Domain column first"' : ''}
        title="Score the first 20 companies to preview results before running the full list">
        🧪 Test Score (20)
      </button>
      <button id="score-btn" class="btn-primary btn-large" onclick="startScoring(false)"
        ${!cm.domain ? 'disabled title="Map the Domain column first"' : ''}>
        ⚡ Score Full List
      </button>
      ${APP_STATE.isCompanyOnlyList ? '<div class="company-only-note">Company-only list detected — contact scoring will be skipped</div>' : ''}
    </div>
  `;
}

function onColMapChange() {
  // Read updated column map from dropdowns
  document.querySelectorAll('.col-map-select').forEach(sel => {
    const field = sel.dataset.field;
    const val = sel.value === '— not mapped —' ? null : sel.value;
    APP_STATE.columnMap[field] = val;
  });
  // Rebuild groups with new mappings
  rebuildGroups();
  // Re-render preflight
  renderPreFlight();
}

function escHtml(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showError(msg) {
  const el = document.getElementById('upload-error');
  if (el) {
    el.textContent = msg;
    el.classList.remove('hidden');
  }
}
