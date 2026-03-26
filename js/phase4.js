// ============================================================
// PHASE 4: Action logic, sorting, results rendering
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

  // Score 4-5
  if (APP_STATE.isCompanyOnlyList) return 'PURSUE'; // no contacts to evaluate

  const hasDecisionMaker = (group.contacts || []).some(c => (c.contactScore || 0) >= 4);
  return hasDecisionMaker ? 'PURSUE' : 'RESEARCH_CONTACTS';
}

// JS-based title scoring for contacts that weren't scored via API
// (customer contacts, or any contact where contactScore is null)
function jsContactScore(contact) {
  const t = (contact.title || '').toLowerCase();
  // Always exclude
  if (/\b(intern|internship|student|co-op)\b/.test(t)) return 1;
  if (/\b(hr|human resources|recruit|talent acquisition|talent partner)\b/.test(t)) return 1;
  if (/\b(journalist|reporter|media|analyst)\b/.test(t)) return 1;
  // High value
  if (/\b(cto|ceo|coo|co-founder|cofounder|founder|president)\b/.test(t)) return 5;
  if (/\b(vp |vice president|chief |head of|director of)\b/.test(t)) return 4;
  // Mid value
  if (/\b(manager|lead |senior |principal |architect|engineer)\b/.test(t)) return 3;
  // Low value
  if (/\b(marketing|sales|finance|legal|accounting|operations|support|customer)\b/.test(t)) return 2;
  return 2; // default
}

// ---- Contact Action ----

function getContactAction(contact, group) {
  const companyScore = Math.max(group.icpScore || 0, group.tvcScore || 0);

  if (group.flags.isExistingCustomer) {
    // Use API score if available, otherwise fall back to JS title scoring
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

// ---- Calculate all actions ----

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
  const isReferral = group.isReferralSource;

  if (isReferral) return 5;
  if (action === 'PURSUE' && isTier1) return 0;
  if (action === 'RESEARCH_CONTACTS' && isTier1) return 1;
  if (action === 'PURSUE') return 2;
  if (action === 'RESEARCH_CONTACTS') return 3;
  if (action === 'MONITOR') return 4;
  return 6; // SKIP
}

function sortCompanies(groups) {
  return [...groups].sort((a, b) => {
    const bA = getCompanySortBucket(a);
    const bB = getCompanySortBucket(b);
    if (bA !== bB) return bA - bB;

    const sA = Math.max(a.icpScore || 0, a.tvcScore || 0);
    const sB = Math.max(b.icpScore || 0, b.tvcScore || 0);
    if (sA !== sB) return sB - sA;

    const csA = Math.max(0, ...(a.contacts || []).map(c => c.contactScore || 0));
    const csB = Math.max(0, ...(b.contacts || []).map(c => c.contactScore || 0));
    return csB - csA;
  });
}

// ---- Suggested role (for RESEARCH_CONTACTS) ----

function getSuggestedRole(group) {
  if (group.auditContactGap) return group.auditContactGap;
  const angle = group.outreachAngle || '';
  if (angle === 'VERIFIABLE_COMPUTE') return 'Head of Digital Assets / CISO';
  const score = group.icpScore || 0;
  if (score >= 5) {
    // Crypto-native vs web2
    const isCryptoNative = ['TRANSACTION_SIGNING','KEY_MANAGEMENT','AGENTIC_WALLETS'].includes(angle) ||
      (angle === 'USER_WALLETS' && score === 5);
    if (isCryptoNative) return 'CTO, VP Engineering, or Head of Protocol';
    return 'Head of Crypto / Head of Digital Assets';
  }
  return 'CTO or Head of Engineering';
}

// ---- Stats ----

function computeStats(groups) {
  const stats = { total: 0, pursue: 0, research: 0, monitor: 0, referral: 0, skip: 0, customers: 0 };
  for (const g of groups) {
    stats.total++;
    const a = g.companyAction;
    if (g.flags.isExistingCustomer) stats.customers++;
    if (a === 'PURSUE') stats.pursue++;
    else if (a === 'RESEARCH_CONTACTS') stats.research++;
    else if (a === 'MONITOR') stats.monitor++;
    else if (a === 'REFERRAL') stats.referral++;
    else if (a === 'SKIP') stats.skip++;
  }
  return stats;
}

// ---- Results Rendering ----

function renderResults() {
  calculateAllActions();
  const groups = sortCompanies(APP_STATE.companyGroups);
  const stats = computeStats(groups);
  const filter = APP_STATE.currentFilter || 'ALL';

  // Stats bar
  document.getElementById('stats-bar').innerHTML = renderStatsBar(stats);

  // Company cards
  const container = document.getElementById('company-cards');

  // Apply filter
  let visible = groups.filter(g => {
    if (filter === 'ALL') return g.companyAction !== 'SKIP' && !g.isReferralSource;
    if (filter === 'PURSUE') return g.companyAction === 'PURSUE';
    if (filter === 'RESEARCH') return g.companyAction === 'RESEARCH_CONTACTS';
    if (filter === 'MONITOR') return g.companyAction === 'MONITOR';
    if (filter === 'REFERRAL') return g.isReferralSource;
    if (filter === 'SKIP') return g.companyAction === 'SKIP';
    return true;
  });

  const skipped = groups.filter(g => g.companyAction === 'SKIP' && !g.isReferralSource);
  const referrals = groups.filter(g => g.isReferralSource);

  let html = '';

  if (filter === 'ALL') {
    html += visible.map(g => renderCompanyCard(g)).join('');

    if (referrals.length > 0) {
      html += `<div class="section-divider"><span>🤝 REFERRAL SOURCES (${referrals.length})</span></div>`;
      html += referrals.map(g => renderCompanyCard(g)).join('');
    }

    if (skipped.length > 0) {
      html += `
        <div class="skip-toggle" id="skip-toggle" onclick="toggleSkipSection()">
          <span>▼ Show ${skipped.length} excluded compan${skipped.length === 1 ? 'y' : 'ies'} (customers, competitors, low scores)</span>
        </div>
        <div id="skip-section" class="hidden">
          ${skipped.map(g => renderCompanyCard(g)).join('')}
        </div>`;
    }
  } else {
    html += visible.map(g => renderCompanyCard(g)).join('');
    if (visible.length === 0) {
      html = `<div class="empty-state">No companies match this filter.</div>`;
    }
  }

  container.innerHTML = html;

  // Update filter pills active state
  document.querySelectorAll('.filter-pill').forEach(pill => {
    pill.classList.toggle('active', pill.dataset.filter === filter);
  });

  // Activate copy buttons
  activateCopyButtons();
}

function renderStatsBar(stats) {
  return `
    <div class="stat-item stat-total">${fmt(stats.total)} Total</div>
    <div class="stat-item stat-pursue">✓ ${fmt(stats.pursue)} Pursue</div>
    <div class="stat-item stat-research">🔍 ${fmt(stats.research)} Research</div>
    <div class="stat-item stat-monitor">○ ${fmt(stats.monitor)} Monitor</div>
    ${stats.referral ? `<div class="stat-item stat-referral">🤝 ${fmt(stats.referral)} Referral</div>` : ''}
    <div class="stat-item stat-skip">× ${fmt(stats.skip)} Skip</div>
    ${stats.customers ? `<div class="stat-item stat-customers">★ ${fmt(stats.customers)} Customers</div>` : ''}
  `;
}

function renderCompanyCard(group) {
  const isBdr = APP_STATE.viewMode === 'bdr';
  const compScore = Math.max(group.icpScore || 0, group.tvcScore || 0);
  const action = group.companyAction;

  const badges = renderBadges(group);
  const scoreDisplay = renderScoreDisplay(group);
  const auditIndicator = renderAuditIndicator(group);

  let contactsHtml = '';
  if (!APP_STATE.isCompanyOnlyList && group.contacts && group.contacts.length > 0) {
    const coverage = renderCoverageIndicator(group);
    if (action === 'RESEARCH_CONTACTS') {
      const suggestedRole = getSuggestedRole(group);
      contactsHtml = `
        <div class="research-callout">
          ⚠ No decision-maker found → Find: <strong>${escHtml(suggestedRole)}</strong>
        </div>
        <div class="coverage-line">${coverage}</div>
        <div class="contact-list">
          ${group.contacts.map(c => renderContactRow(c, group)).join('')}
        </div>`;
    } else {
      contactsHtml = `
        <div class="coverage-line">${coverage}</div>
        <div class="contact-list">
          ${group.contacts.map(c => renderContactRow(c, group)).join('')}
        </div>`;
    }
  } else if (APP_STATE.isCompanyOnlyList) {
    contactsHtml = `<div class="no-contacts-note">No contacts on list</div>`;
  }

  const hookHtml = group.outreachHook ? `
    <div class="hook-row">
      <span class="hook-label">Hook:</span>
      <span class="hook-text">${escHtml(group.outreachHook)}</span>
      <button class="copy-btn" data-text="${escHtml(group.outreachHook)}">📋 Copy</button>
    </div>` : '';

  // Full view extras
  let fullExtras = '';
  if (!isBdr && action !== 'SKIP') {
    fullExtras = `
      <div class="full-extras">
        ${group.tvcScore > 1 ? `<div class="extra-row"><span class="extra-label">TVC Score:</span> <span class="score-badge ${scoreColorClass(group.tvcScore)}">${group.tvcScore} — ${escHtml(group.tvcLabel || '')}</span></div>` : ''}
        ${group.confidence ? `<div class="extra-row"><span class="extra-label">Confidence:</span> <span class="conf-badge conf-${(group.confidence||'').toLowerCase()}">${group.confidence}</span></div>` : ''}
        ${group.outreachAngle ? `<div class="extra-row"><span class="extra-label">Angle:</span> ${escHtml(group.outreachAngle)}</div>` : ''}
        ${group.primarySolution ? `<div class="extra-row"><span class="extra-label">Solution:</span> ${escHtml(group.primarySolution)}${group.secondarySolutions?.length ? ' · ' + group.secondarySolutions.map(escHtml).join(' · ') : ''}</div>` : ''}
        ${group.relevantReferences?.length ? `<div class="extra-row"><span class="extra-label">Refs:</span> ${group.relevantReferences.map(escHtml).join(', ')}</div>` : ''}
        ${group.reasoning ? `<div class="extra-row"><span class="extra-label">Why:</span> <em>${escHtml(group.reasoning)}</em></div>` : ''}
        ${group.auditVerdict && group.auditReasoning ? `<div class="extra-row audit-reasoning"><span class="extra-label">Audit:</span> ${escHtml(group.auditReasoning)}</div>` : ''}
        ${group.auditSolutionCorrection ? `<div class="extra-row audit-correction"><span class="extra-label">Solution corrected:</span> ${escHtml(group.auditSolutionCorrection)}</div>` : ''}
      </div>`;
  }

  const cardClass = `company-card action-card-${(action||'skip').toLowerCase()} ${group.flags.isExistingCustomer ? 'card-customer' : ''} ${group.isReferralSource ? 'card-referral' : ''}`;

  return `
    <div class="${cardClass}" data-domain="${escHtml(group.domain)}">
      <div class="card-header">
        <div class="card-header-left">
          <span class="company-name">${escHtml(group.companyName)}</span>
          <span class="company-domain">${escHtml(group.domain)}</span>
          <div class="badge-row">${badges}</div>
        </div>
        <div class="card-header-right">
          ${scoreDisplay}
          ${auditIndicator}
          <div class="action-pill">${actionBadge(action)}</div>
        </div>
      </div>
      ${hookHtml}
      ${fullExtras}
      ${contactsHtml}
    </div>`;
}

function renderContactRow(contact, group) {
  const isBdr = APP_STATE.viewMode === 'bdr';
  const scoreClass = scoreColorClass(contact.contactScore || 0);
  const liHtml = contact.linkedinRequest ? `
    <div class="li-row">
      <span class="li-text">${escHtml(contact.linkedinRequest)}</span>
      <button class="copy-btn copy-btn-sm" data-text="${escHtml(contact.linkedinRequest)}">📋</button>
    </div>` : '';

  let extraContact = '';
  if (!isBdr) {
    extraContact = `
      ${contact.contactReasoning ? `<div class="contact-reasoning">${escHtml(contact.contactReasoning)}</div>` : ''}
      ${contact.championPath ? `<div class="champion-path">💡 ${escHtml(contact.championPath)}</div>` : ''}`;
  }

  return `
    <div class="contact-row contact-score-${contact.contactScore || 0}">
      <div class="contact-row-top">
        <span class="contact-name">${escHtml(contact.name || '—')}</span>
        <span class="contact-title">${escHtml(contact.title || '')}</span>
        <span class="contact-score ${scoreClass}">${contact.contactScore || '—'}</span>
        ${actionBadge(contact.contactAction)}
      </div>
      ${liHtml}
      ${extraContact}
    </div>`;
}

function renderBadges(group) {
  const badges = [];
  if (group.flags.isTier1Target && !group.flags.isExistingCustomer) {
    badges.push('<span class="badge badge-tier1">⭐ TIER 1</span>');
  }
  if (group.flags.isExistingCustomer) {
    badges.push('<span class="badge badge-customer">★ CUSTOMER</span>');
  }
  if (group.flags.isCompetitor && !group.flags.isTvcEligibleCompetitor) {
    badges.push('<span class="badge badge-competitor">⚠ COMPETITOR</span>');
  }
  if (group.flags.isTvcEligibleCompetitor) {
    badges.push('<span class="badge badge-tvc-comp">🔒 TVC PROSPECT</span>');
  }
  if (group.isReferralSource) {
    badges.push('<span class="badge badge-referral">🤝 REFERRAL SOURCE</span>');
  }
  if (group.flags.warmPath) {
    badges.push(`<span class="badge badge-warm">🔗 ${escHtml(group.flags.warmPath)}</span>`);
  }
  if (group.flags.isTurnkeyEmployee) {
    badges.push('<span class="badge badge-employee">🏢 TURNKEY</span>');
  }
  if (group.scoringFailed) {
    badges.push('<span class="badge badge-failed">⚠ SCORING FAILED</span>');
  }
  return badges.join('');
}

function renderScoreDisplay(group) {
  const icpScore = group.icpScore || 0;
  const tvcScore = group.tvcScore || 0;
  const compScore = Math.max(icpScore, tvcScore);
  const isBdr = APP_STATE.viewMode === 'bdr';

  let html = `<div class="score-display">`;
  html += `<span class="score-icp ${scoreColorClass(icpScore)}">ICP: ${icpScore}</span>`;
  if (!isBdr && tvcScore > 1) {
    html += `<span class="score-tvc ${scoreColorClass(tvcScore)}">TVC: ${tvcScore}</span>`;
  } else if (tvcScore > 1) {
    html += `<span class="score-tvc ${scoreColorClass(tvcScore)}">TVC: ${tvcScore}</span>`;
  }
  html += `</div>`;
  return html;
}

function renderAuditIndicator(group) {
  if (!group.auditVerdict) return '';
  if (group.auditVerdict === 'UPGRADE') {
    return `<div class="audit-indicator audit-upgrade">${group.originalIcpScore} → ${group.icpScore} ⬆</div>`;
  }
  if (group.auditVerdict === 'DOWNGRADE') {
    return `<div class="audit-indicator audit-downgrade">${group.originalIcpScore} → ${group.icpScore} ⬇</div>`;
  }
  return `<div class="audit-indicator audit-confirm">✓ Confirmed</div>`;
}

function renderCoverageIndicator(group) {
  const contacts = group.contacts || [];
  if (contacts.length === 0) return '';
  const decisionMakers = contacts.filter(c => (c.contactScore || 0) >= 4).length;
  const best = Math.max(0, ...contacts.map(c => c.contactScore || 0));
  let icon, cls;
  if (decisionMakers > 0) { icon = '✓'; cls = 'coverage-good'; }
  else if (best >= 3)     { icon = '⚠'; cls = 'coverage-warn'; }
  else                    { icon = '✗'; cls = 'coverage-bad'; }
  return `<span class="coverage-indicator ${cls}">${icon} ${decisionMakers} of ${contacts.length} decision-maker${contacts.length !== 1 ? 's' : ''}</span>`;
}

function toggleSkipSection() {
  const sec = document.getElementById('skip-section');
  const btn = document.getElementById('skip-toggle');
  if (!sec || !btn) return;
  const isHidden = sec.classList.contains('hidden');
  sec.classList.toggle('hidden', !isHidden);
  btn.querySelector('span').textContent = isHidden
    ? `▲ Hide excluded companies`
    : `▼ Show ${sec.querySelectorAll('.company-card').length} excluded compan${sec.querySelectorAll('.company-card').length === 1 ? 'y' : 'ies'} (customers, competitors, low scores)`;
}

function activateCopyButtons() {
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.onclick = () => copyToClipboard(btn.dataset.text, btn);
  });
}

// ---- Progress update ----

function updateScoringProgress() {
  const { companyTotal, companyDone, contactTotal, contactDone } = APP_STATE.scoringProgress;

  const cBar = document.getElementById('company-progress-bar');
  const cText = document.getElementById('company-progress-text');
  if (cBar && companyTotal > 0) {
    cBar.style.width = `${Math.round((companyDone / companyTotal) * 100)}%`;
  }
  if (cText) {
    cText.textContent = companyTotal > 0
      ? `${companyDone} / ${companyTotal} companies`
      : 'Preparing…';
  }

  const coBar = document.getElementById('contact-progress-bar');
  const coText = document.getElementById('contact-progress-text');
  if (coBar && contactTotal > 0) {
    coBar.style.width = `${Math.round((contactDone / contactTotal) * 100)}%`;
  }
  if (coText) {
    if (contactTotal === 0 && companyDone < companyTotal) {
      coText.textContent = 'Waiting for company scoring…';
    } else if (contactTotal === 0 && APP_STATE.isCompanyOnlyList) {
      coText.textContent = 'Skipped (company-only list)';
    } else {
      coText.textContent = contactTotal > 0 ? `${contactDone} / ${contactTotal} contacts` : 'Preparing…';
    }
  }
}
