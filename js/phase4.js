// ============================================================
// PHASE 4: Action logic, sorting, table rendering
// ============================================================

// ---- Company Action ----

function getCompanyAction(group) {
  const score = Math.max(group.icpScore || 0, group.tvcScore || 0);

  if (group.flags.isExistingCustomer) return 'SKIP';
  if (group.flags.isCompetitor && !group.flags.isTvcEligibleCompetitor) return 'SKIP';
  if (group.flags.isTurnkeyEmployee) return 'SKIP';
  if (group.isReferralSource) return 'REFERRAL';
  if (score <= 2) return 'SKIP';
  if (score === 3) return 'MONITOR';

  if (APP_STATE.isCompanyOnlyList) return 'PURSUE';

  const hasDecisionMaker = (group.contacts || []).some(c => (c.contactScore || 0) >= 4);
  return hasDecisionMaker ? 'PURSUE' : 'RESEARCH_CONTACTS';
}

// ---- Contact Action ----

function jsContactScore(contact) {
  const t = (contact.title || '').toLowerCase();
  if (/\b(intern|internship|student|co-op)\b/.test(t)) return 1;
  if (/\b(hr |human resources|recruit|talent acquisition|talent partner)\b/.test(t)) return 1;
  if (/\b(journalist|reporter|media)\b/.test(t)) return 1;
  if (/\b(cto|ceo|coo|co-founder|cofounder|founder|president)\b/.test(t)) return 5;
  if (/\b(vp |vice president|chief |head of|director)\b/.test(t)) return 4;
  if (/\b(manager|lead |senior |principal |architect|engineer)\b/.test(t)) return 3;
  if (/\b(marketing|sales|finance|legal|ops|support|customer)\b/.test(t)) return 2;
  return 2;
}

function getContactAction(contact, group) {
  const companyScore = Math.max(group.icpScore || 0, group.tvcScore || 0);

  if (group.flags.isExistingCustomer) {
    const score = contact.contactScore != null ? contact.contactScore : jsContactScore(contact);
    return score >= 3 ? 'ROUTE_TO_CSM' : 'SKIP';
  }
  if (group.flags.isCompetitor && !group.flags.isTvcEligibleCompetitor) return 'SKIP';
  if (group.flags.isTurnkeyEmployee) return 'SKIP';

  if ((contact.contactScore || 0) <= 1) return 'SKIP';
  if (companyScore <= 2) return 'SKIP';

  if (companyScore >= 4 && (contact.contactScore || 0) >= 4) return 'OUTREACH';
  if (companyScore >= 4 && (contact.contactScore || 0) >= 2) return 'RESEARCH';
  if (companyScore === 3 && (contact.contactScore || 0) >= 3) return 'NURTURE';
  return 'SKIP';
}

function calculateAllActions() {
  for (const group of APP_STATE.companyGroups) {
    group.companyAction = getCompanyAction(group);
    for (const contact of (group.contacts || [])) {
      contact.contactAction = getContactAction(contact, group);
    }
  }
}

// ---- Sort ----

function getCompanySortBucket(group) {
  const action = group.companyAction;
  const isTier1 = group.flags.isTier1Target;
  if (group.isReferralSource) return 5;
  if (action === 'PURSUE' && isTier1) return 0;
  if (action === 'RESEARCH_CONTACTS' && isTier1) return 1;
  if (action === 'PURSUE') return 2;
  if (action === 'RESEARCH_CONTACTS') return 3;
  if (action === 'MONITOR') return 4;
  return 6;
}

function sortCompanies(groups) {
  return [...groups].sort((a, b) => {
    const bA = getCompanySortBucket(a), bB = getCompanySortBucket(b);
    if (bA !== bB) return bA - bB;
    const sA = Math.max(a.icpScore || 0, a.tvcScore || 0);
    const sB = Math.max(b.icpScore || 0, b.tvcScore || 0);
    if (sA !== sB) return sB - sA;
    const csA = Math.max(0, ...(a.contacts || []).map(c => c.contactScore || 0));
    const csB = Math.max(0, ...(b.contacts || []).map(c => c.contactScore || 0));
    return csB - csA;
  });
}

// ---- Flatten groups → table rows ----

function flattenToTableRows(groups) {
  const rows = [];
  for (const g of groups) {
    const compScore = Math.max(g.icpScore || 0, g.tvcScore || 0);
    const base = {
      company:       g.companyName || '',
      domain:        g.domain || '',
      icpScore:      g.icpScore || '',
      tvcScore:      g.tvcScore || '',
      icpLabel:      g.icpLabel || '',
      confidence:    g.confidence || '',
      companyAction: g.companyAction || '',
      companyScore:  compScore,
      outreachAngle: g.outreachAngle || '',
      solution:      g.primarySolution || '',
      outreachHook:  g.outreachHook || '',
      warmPath:      g.flags.warmPath || '',
      isTier1:       g.flags.isTier1Target,
      isCustomer:    g.flags.isExistingCustomer,
      isCompetitor:  g.flags.isCompetitor || g.flags.isTvcEligibleCompetitor,
      isReferral:    g.isReferralSource || false,
      reasoning:     g.reasoning || '',
      auditVerdict:  g.auditVerdict || '',
      auditReasoning:g.auditReasoning || '',
      auditContactGap: g.auditContactGap || '',
      originalScore: g.originalIcpScore,
      // reference to group for badge rendering
      _group: g,
    };

    if (!APP_STATE.isCompanyOnlyList && g.contacts && g.contacts.length > 0) {
      for (const c of g.contacts) {
        rows.push({
          ...base,
          contactName:    c.name || '',
          title:          c.title || '',
          email:          c.email || '',
          linkedin:       c.linkedin || '',
          contactScore:   c.contactScore != null ? c.contactScore : '',
          contactLabel:   c.contactLabel || '',
          contactAction:  c.contactAction || '',
          linkedinReq:    c.linkedinRequest || '',
          contactReasoning: c.contactReasoning || '',
          championPath:   c.championPath || '',
        });
      }
    } else {
      rows.push({
        ...base,
        contactName: '', title: '', email: '', linkedin: '',
        contactScore: '', contactLabel: '', contactAction: '',
        linkedinReq: '', contactReasoning: '', championPath: '',
      });
    }
  }
  return rows;
}

// ---- Column definitions ----

const COLUMN_DEFS = [
  { key: 'company',        label: 'Company',         defaultOn: true  },
  { key: 'domain',         label: 'Domain',          defaultOn: true  },
  { key: 'contactName',    label: 'Contact',         defaultOn: true  },
  { key: 'title',          label: 'Title',           defaultOn: true  },
  { key: 'email',          label: 'Email',           defaultOn: false },
  { key: 'icpScore',       label: 'ICP',             defaultOn: true  },
  { key: 'tvcScore',       label: 'TVC',             defaultOn: false },
  { key: 'companyAction',  label: 'Action',          defaultOn: true  },
  { key: 'contactAction',  label: 'Contact Action',  defaultOn: true  },
  { key: 'contactScore',   label: 'Contact Score',   defaultOn: false },
  { key: 'warmPath',       label: 'Warm Path',       defaultOn: true  },
  { key: 'outreachHook',   label: 'Hook',            defaultOn: true  },
  { key: 'linkedinReq',    label: 'LinkedIn Request',defaultOn: true  },
  { key: 'solution',       label: 'Solution',        defaultOn: false },
  { key: 'confidence',     label: 'Confidence',      defaultOn: false },
  { key: 'reasoning',      label: 'Reasoning',       defaultOn: false },
];

function initVisibleColumns() {
  if (!APP_STATE.visibleColumns) {
    APP_STATE.visibleColumns = new Set(
      COLUMN_DEFS.filter(c => c.defaultOn).map(c => c.key)
    );
  }
}

// ---- Stats ----

function computeStats(groups) {
  const s = { total: 0, pursue: 0, research: 0, monitor: 0, referral: 0, skip: 0, customers: 0 };
  for (const g of groups) {
    s.total++;
    const a = g.companyAction;
    if (g.flags.isExistingCustomer) s.customers++;
    if (a === 'PURSUE') s.pursue++;
    else if (a === 'RESEARCH_CONTACTS') s.research++;
    else if (a === 'MONITOR') s.monitor++;
    else if (a === 'REFERRAL') s.referral++;
    else if (a === 'SKIP') s.skip++;
  }
  return s;
}

// ---- Main render ----

function renderResults() {
  calculateAllActions();
  initVisibleColumns();

  const allGroups = sortCompanies(APP_STATE.companyGroups);
  const stats = computeStats(allGroups);
  const filter = APP_STATE.currentFilter || 'ALL';
  const search = (document.getElementById('table-search')?.value || '').toLowerCase().trim();

  // Filter groups
  let filtered = allGroups.filter(g => {
    if (filter === 'ALL') return true;
    if (filter === 'PURSUE')   return g.companyAction === 'PURSUE';
    if (filter === 'RESEARCH') return g.companyAction === 'RESEARCH_CONTACTS';
    if (filter === 'MONITOR')  return g.companyAction === 'MONITOR';
    if (filter === 'REFERRAL') return g.isReferralSource;
    if (filter === 'SKIP')     return g.companyAction === 'SKIP';
    return true;
  });

  // Flatten to rows
  let rows = flattenToTableRows(filtered);

  // Search filter
  if (search) {
    rows = rows.filter(r =>
      [r.company, r.domain, r.contactName, r.title, r.email,
       r.outreachHook, r.linkedinReq, r.solution, r.warmPath,
       r.reasoning, r.icpLabel].some(v => String(v).toLowerCase().includes(search))
    );
  }

  // Summary
  const testBadge = APP_STATE.testMode ? `<span class="test-mode-badge">Test mode — ${allGroups.length} of ${APP_STATE.companyGroups.length} companies</span>` : '';
  document.getElementById('results-summary').innerHTML = `
    <span class="summary-count">Showing <strong>${fmt(rows.length)}</strong> of <strong>${fmt(flattenToTableRows(allGroups).length)}</strong></span>
    <span class="summary-divider">·</span>
    <span class="summary-pursue">${fmt(stats.pursue)} Pursue</span>
    <span class="summary-divider">·</span>
    <span class="summary-research">${fmt(stats.research)} Research</span>
    <span class="summary-divider">·</span>
    <span class="summary-monitor">${fmt(stats.monitor)} Monitor</span>
    ${stats.referral ? `<span class="summary-divider">·</span><span class="summary-referral">${fmt(stats.referral)} Referral</span>` : ''}
    <span class="summary-divider">·</span>
    <span class="summary-skip">${fmt(stats.skip)} Skip</span>
    ${stats.customers ? `<span class="summary-divider">·</span><span class="summary-customers">${fmt(stats.customers)} Customers</span>` : ''}
    ${testBadge}
  `;

  // Update filter pill active state
  document.querySelectorAll('.filter-pill').forEach(p => {
    p.classList.toggle('active', p.dataset.filter === filter);
  });

  // Render table
  renderTable(rows);

  // Columns menu
  renderColumnsMenu();

  // Enable export if we have rows
  if (rows.length > 0) {
    document.getElementById('export-btn')?.removeAttribute('disabled');
  }
}

// ---- Table rendering ----

function renderTable(rows) {
  const cols = COLUMN_DEFS.filter(c => APP_STATE.visibleColumns.has(c.key));

  // Header
  document.getElementById('table-head').innerHTML = `
    <tr>
      ${cols.map(c => `<th class="th-${c.key}" onclick="sortByColumn('${c.key}')">${c.label}${APP_STATE.sortCol === c.key ? (APP_STATE.sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</th>`).join('')}
    </tr>`;

  // Body
  let prevCompany = null;
  const tbody = document.getElementById('table-body');
  tbody.innerHTML = rows.map((r, i) => {
    const isNewCompany = r.company !== prevCompany;
    prevCompany = r.company;
    const rowClass = isNewCompany ? 'tr-company-start' : 'tr-same-company';
    return `<tr class="${rowClass} tr-action-${(r.companyAction||'skip').toLowerCase()}" data-row="${i}">
      ${cols.map(c => renderCell(c.key, r)).join('')}
    </tr>`;
  }).join('');

  // Bind copy buttons
  tbody.querySelectorAll('.copy-btn').forEach(btn => {
    btn.onclick = e => { e.stopPropagation(); copyToClipboard(btn.dataset.text, btn); };
  });
}

function renderCell(key, r) {
  switch (key) {
    case 'company':
      return `<td class="td-company">
        <div class="cell-company-name">${escHtml(r.company)}</div>
        ${renderRowBadges(r)}
      </td>`;

    case 'domain':
      return `<td class="td-domain"><span class="cell-muted">${escHtml(r.domain)}</span></td>`;

    case 'contactName':
      return `<td class="td-contact">${escHtml(r.contactName)}</td>`;

    case 'title':
      return `<td class="td-title"><span class="cell-muted">${escHtml(r.title)}</span></td>`;

    case 'email':
      return `<td class="td-email"><span class="cell-muted">${escHtml(r.email)}</span></td>`;

    case 'icpScore': {
      const s = r.icpScore;
      const changed = r.auditVerdict === 'UPGRADE' || r.auditVerdict === 'DOWNGRADE';
      const diff = changed ? `<span class="audit-diff">${r.originalScore}→${s}</span>` : '';
      return `<td class="td-score"><span class="score-chip ${scoreColorClass(s)}">${s}</span>${diff}</td>`;
    }

    case 'tvcScore': {
      const s = r.tvcScore;
      return `<td class="td-score"><span class="score-chip ${scoreColorClass(s)}">${s || '—'}</span></td>`;
    }

    case 'contactScore': {
      const s = r.contactScore;
      return `<td class="td-score">${s !== '' ? `<span class="score-chip ${scoreColorClass(s)}">${s}</span>` : '<span class="cell-muted">—</span>'}</td>`;
    }

    case 'companyAction':
      return `<td class="td-action">${actionChip(r.companyAction)}</td>`;

    case 'contactAction':
      return `<td class="td-action">${r.contactAction ? actionChip(r.contactAction) : '<span class="cell-muted">—</span>'}</td>`;

    case 'warmPath':
      return `<td class="td-warm">${r.warmPath ? `<span class="warm-chip">🔗 ${escHtml(r.warmPath)}</span>` : '<span class="cell-muted">—</span>'}</td>`;

    case 'outreachHook':
      return `<td class="td-hook">
        ${r.outreachHook
          ? `<span class="cell-truncate">${escHtml(r.outreachHook)}</span>
             <button class="copy-btn" data-text="${escHtml(r.outreachHook)}">Copy</button>`
          : '<span class="cell-muted">—</span>'}
      </td>`;

    case 'linkedinReq':
      return `<td class="td-li">
        ${r.linkedinReq
          ? `<span class="cell-truncate">${escHtml(r.linkedinReq)}</span>
             <button class="copy-btn" data-text="${escHtml(r.linkedinReq)}">Copy</button>`
          : '<span class="cell-muted">—</span>'}
      </td>`;

    case 'solution':
      return `<td class="td-solution"><span class="cell-muted">${escHtml(r.solution)}</span></td>`;

    case 'confidence':
      return `<td class="td-conf"><span class="conf-chip conf-${(r.confidence||'').toLowerCase()}">${r.confidence || '—'}</span></td>`;

    case 'reasoning':
      return `<td class="td-reasoning"><span class="cell-truncate cell-muted">${escHtml(r.reasoning)}</span></td>`;

    default:
      return `<td>${escHtml(r[key] || '')}</td>`;
  }
}

function renderRowBadges(r) {
  const badges = [];
  if (r.isTier1 && !r.isCustomer)  badges.push(`<span class="row-badge rb-tier1">T1</span>`);
  if (r.isCustomer)                 badges.push(`<span class="row-badge rb-customer">Customer</span>`);
  if (r.isCompetitor && !r.isReferral) badges.push(`<span class="row-badge rb-competitor">Competitor</span>`);
  if (r.isReferral)                 badges.push(`<span class="row-badge rb-referral">Referral</span>`);
  if (r._group?.flags?.isTvcEligibleCompetitor) badges.push(`<span class="row-badge rb-tvc">TVC</span>`);
  if (r.auditVerdict === 'UPGRADE') badges.push(`<span class="row-badge rb-audit-up">⬆ Upgraded</span>`);
  if (r.auditVerdict === 'DOWNGRADE') badges.push(`<span class="row-badge rb-audit-down">⬇ Downgraded</span>`);
  if (!badges.length) return '';
  return `<div class="row-badges">${badges.join('')}</div>`;
}

function actionChip(action) {
  const cfg = ACTION_CONFIG[action] || { label: action || '—', cls: 'action-skip' };
  return `<span class="action-chip ${cfg.cls}">${cfg.label}</span>`;
}

// ---- Columns menu ----

function renderColumnsMenu() {
  const menu = document.getElementById('columns-menu');
  if (!menu) return;
  menu.innerHTML = COLUMN_DEFS.map(c => `
    <label class="col-toggle">
      <input type="checkbox" ${APP_STATE.visibleColumns.has(c.key) ? 'checked' : ''}
        onchange="toggleColumn('${c.key}', this.checked)">
      ${c.label}
    </label>`).join('');
}

function toggleColumnsMenu() {
  const menu = document.getElementById('columns-menu');
  if (menu) menu.classList.toggle('hidden');
  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', function closeMenu(e) {
      if (!e.target.closest('.btn-columns') && !e.target.closest('.columns-menu')) {
        menu?.classList.add('hidden');
        document.removeEventListener('click', closeMenu);
      }
    });
  }, 0);
}

function toggleColumn(key, visible) {
  if (visible) APP_STATE.visibleColumns.add(key);
  else APP_STATE.visibleColumns.delete(key);
  renderTable(getCurrentRows());
  renderColumnsMenu();
}

function getCurrentRows() {
  const filter = APP_STATE.currentFilter || 'ALL';
  const search = (document.getElementById('table-search')?.value || '').toLowerCase().trim();
  const allGroups = sortCompanies(APP_STATE.companyGroups);
  let filtered = allGroups.filter(g => {
    if (filter === 'ALL') return true;
    if (filter === 'PURSUE')   return g.companyAction === 'PURSUE';
    if (filter === 'RESEARCH') return g.companyAction === 'RESEARCH_CONTACTS';
    if (filter === 'MONITOR')  return g.companyAction === 'MONITOR';
    if (filter === 'REFERRAL') return g.isReferralSource;
    if (filter === 'SKIP')     return g.companyAction === 'SKIP';
    return true;
  });
  let rows = flattenToTableRows(filtered);
  if (search) {
    rows = rows.filter(r =>
      [r.company, r.domain, r.contactName, r.title, r.email,
       r.outreachHook, r.linkedinReq, r.solution, r.warmPath,
       r.reasoning, r.icpLabel].some(v => String(v).toLowerCase().includes(search))
    );
  }
  return rows;
}

// ---- Sort by column ----

function sortByColumn(key) {
  if (APP_STATE.sortCol === key) {
    APP_STATE.sortDir = APP_STATE.sortDir === 'asc' ? 'desc' : 'asc';
  } else {
    APP_STATE.sortCol = key;
    APP_STATE.sortDir = 'desc';
  }
  renderResults();
}

// ---- Search handler ----

function onSearchChange() {
  renderResults();
}

// ---- Progress update ----

function updateScoringProgress() {
  const { companyTotal, companyDone, contactTotal, contactDone } = APP_STATE.scoringProgress;

  const cBar  = document.getElementById('company-progress-bar');
  const cText = document.getElementById('company-progress-text');
  if (cBar && companyTotal > 0) cBar.style.width = `${Math.round((companyDone / companyTotal) * 100)}%`;
  if (cText) cText.textContent = companyTotal > 0 ? `${companyDone} / ${companyTotal} companies` : 'Preparing…';

  const coBar  = document.getElementById('contact-progress-bar');
  const coText = document.getElementById('contact-progress-text');
  if (coBar && contactTotal > 0) coBar.style.width = `${Math.round((contactDone / contactTotal) * 100)}%`;
  if (coText) {
    if (APP_STATE.isCompanyOnlyList) coText.textContent = 'Skipped (company-only list)';
    else if (contactTotal === 0 && companyDone < companyTotal) coText.textContent = 'Waiting for company scoring…';
    else coText.textContent = contactTotal > 0 ? `${contactDone} / ${contactTotal} contacts` : 'Preparing…';
  }
}

function getSuggestedRole(group) {
  if (group.auditContactGap) return group.auditContactGap;
  const angle = group.outreachAngle || '';
  if (angle === 'VERIFIABLE_COMPUTE') return 'Head of Digital Assets / CISO';
  const score = group.icpScore || 0;
  if (score >= 5) {
    const isCrypto = ['TRANSACTION_SIGNING','KEY_MANAGEMENT','AGENTIC_WALLETS'].includes(angle) || angle === 'USER_WALLETS';
    return isCrypto ? 'CTO, VP Engineering, or Head of Protocol' : 'Head of Crypto / Head of Digital Assets';
  }
  return 'CTO or Head of Engineering';
}
