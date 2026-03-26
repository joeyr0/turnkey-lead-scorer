// ============================================================
// PHASE 5: Audit System — 3 challenge prompts
// ============================================================

const CHALLENGE_1_PROMPT = `You are reviewing companies that were scored 3 (Credible Fit) in a first-pass ICP analysis for Turnkey, a crypto wallet infrastructure company.

YOUR JOB: Identify companies that should be scored HIGHER (4 or 5). Specifically look for:

1. FINTECH/PAYMENTS UNDER-SCORING ("crypto eats finance" thesis):
Companies in payments, payroll, remittances, cross-border transfers, corporate treasury, neobanking that were scored 3 but should be 4-5 because crypto/stablecoin adoption is likely or confirmed in their vertical.

2. CRYPTO SIGNAL MISSED:
Companies where the first pass missed a crypto signal — the company name, domain, or business description suggests crypto relevance that wasn't caught.

3. STRATEGIC LOGO VALUE:
Companies where the brand recognition alone justifies higher-touch outreach even if the direct ICP fit is moderate.

For each company, return: CONFIRM (keep score 3) or UPGRADE to 4 or 5, with reasoning.

SCORING REFERENCE:
Score 5: Crypto-native builder OR confirmed crypto-expansion (traditional company WITH crypto signal)
Score 4: Vertical where crypto likely but no confirmed signal. Payments, payroll, treasury, neobanks, AI agents, L1/L2.
Score 3: Specific articulable reason but unconfirmed.

OUTPUT — JSON object with key "reviews" containing an array:
{ "company": "Name", "domain": "domain.com", "verdict": "CONFIRM" | "UPGRADE", "newIcpScore": 4, "reasoning": "max 25 words" }

Return ONLY valid JSON.`;

const CHALLENGE_2_PROMPT = `You are reviewing companies that were scored 4-5 in a first-pass ICP analysis for Turnkey, a crypto wallet infrastructure company.

YOUR JOB: Identify companies that should be scored LOWER. Specifically look for:

1. AI-WASHING:
Companies with "AI" in the name scored high for "Agentic Wallets" but have ZERO crypto/onchain relevance. AI safety, AI security, AI analytics, AI content — these are NOT agentic wallet fits. Only companies building AI agents that perform onchain actions qualify.

2. STEALTH INFLATION:
Companies scored 4-5 but you cannot identify a specific engineering problem Turnkey solves for them. If you can't name it, the score is too high. Drop to 2-3.

3. DEV SHOP TRAP:
Consulting firms, agencies, development shops scored as product companies. Even if they do crypto work, they build for OTHERS — they're not Turnkey buyers. Score 1.

4. SOLUTION MAPPING ERRORS:
Companies where the primary solution mapping is wrong. Example: NFT marketplace mapped to "Payment Orchestration" (should be "Embedded Consumer Wallets"). Flag with correction.

5. EXCLUDED CATEGORIES MISSED:
Security/audit firms, events companies, research/analytics firms, legal, media, recruiting — any that slipped through to Score 4-5.

For each company, return: CONFIRM (keep score) or DOWNGRADE to specific score, with reasoning. If solution mapping is wrong, include correction.

OUTPUT — JSON object with key "reviews" containing an array:
{ "company": "Name", "domain": "domain.com", "verdict": "CONFIRM" | "DOWNGRADE", "newIcpScore": 2, "reasoning": "max 25 words", "solutionCorrection": null | "Correct solution: Embedded Consumer Wallets" }

Return ONLY valid JSON.`;

const CHALLENGE_3_PROMPT = `You are reviewing high-value companies (scored 4-5) from a prospecting list for Turnkey, a crypto wallet infrastructure company. Each company includes its contact list with scores.

YOUR JOB: For each company, assess whether the contacts on the list include a likely decision-maker for wallet/signing infrastructure. If not, recommend what role to search for.

DECISION-MAKER CRITERIA BY COMPANY TYPE:
- Crypto-native: CTO, VP/Head of Eng, VP Product, Co-founder (Contact 4-5)
- Web2/Fintech exploring crypto: Head of Crypto, Head of Digital Assets, VP Blockchain (Contact 5)
- Bank/Enterprise: Head of Digital Assets, MD Blockchain (Contact 5)
- Startup (<20 people): Any co-founder or CTO (Contact 5)

Also flag:
- Contacts that may be mis-scored (e.g., "Blockchain Engineer" at a consulting firm scored 4 — should be lower)
- Companies where ALL contacts are Score 1-2 (strongest RESEARCH signal)

OUTPUT — JSON object with key "reviews" containing an array:
{ "company": "Name", "domain": "domain.com", "contactsAdequate": true | false, "findRole": null | "Head of Crypto / VP Engineering", "contactCorrections": [{ "name": "...", "currentScore": 4, "suggestedScore": 2, "reason": "Consulting firm, not a buyer" }], "reasoning": "max 25 words" }

Return ONLY valid JSON.`;

// ---- Audit orchestration ----

async function runAudit() {
  const btn = document.getElementById('audit-btn');
  if (btn) { btn.disabled = true; btn.textContent = '🔍 Auditing…'; }

  const groups = APP_STATE.companyGroups;

  // Challenge 1: Score 3 companies
  const score3 = groups.filter(g =>
    g.icpScore === 3 &&
    !g.flags.isExistingCustomer &&
    !g.flags.isCompetitor &&
    !g.isReferralSource
  );

  // Challenge 2: Score 4-5 companies (non-Tier1)
  const score45 = groups.filter(g =>
    (g.icpScore >= 4 || g.tvcScore >= 4) &&
    !g.flags.isTier1Target &&
    !g.flags.isExistingCustomer &&
    !g.flags.isCompetitor &&
    !g.isReferralSource
  );

  // Challenge 3: Score 4-5 with contacts
  const score45WithContacts = groups.filter(g =>
    (g.icpScore >= 4 || g.tvcScore >= 4) &&
    !g.flags.isExistingCustomer &&
    !g.flags.isCompetitor &&
    g.contacts && g.contacts.length > 0
  );

  const auditStats = { reviewed: 0, upgraded: 0, downgraded: 0, solutionFixes: 0, contactGaps: 0, confirmed: 0 };

  // -- Challenge 1 --
  let c1Reviews = [];
  if (score3.length > 0) {
    try {
      const input = {
        companies: score3.map(g => ({
          company: g.companyName,
          domain: g.domain,
          icpScore: g.icpScore,
          tvcScore: g.tvcScore,
          outreachAngle: g.outreachAngle || '',
          primarySolution: g.primarySolution || '',
          reasoning: g.reasoning || ''
        }))
      };
      const result = await callOpenAI(CHALLENGE_1_PROMPT, JSON.stringify(input));
      c1Reviews = result.reviews || [];
    } catch (err) {
      console.error('Audit challenge 1 failed:', err);
    }
  }

  // -- Challenge 2 --
  let c2Reviews = [];
  if (score45.length > 0) {
    try {
      const input = {
        companies: score45.map(g => ({
          company: g.companyName,
          domain: g.domain,
          icpScore: g.icpScore,
          tvcScore: g.tvcScore,
          outreachAngle: g.outreachAngle || '',
          primarySolution: g.primarySolution || '',
          reasoning: g.reasoning || ''
        }))
      };
      const result = await callOpenAI(CHALLENGE_2_PROMPT, JSON.stringify(input));
      c2Reviews = result.reviews || [];
    } catch (err) {
      console.error('Audit challenge 2 failed:', err);
    }
  }

  // -- Challenge 3 --
  let c3Reviews = [];
  if (score45WithContacts.length > 0 && !APP_STATE.isCompanyOnlyList) {
    try {
      const input = {
        companies: score45WithContacts.map(g => ({
          company: g.companyName,
          domain: g.domain,
          icpScore: g.icpScore,
          contacts: (g.contacts || []).map(c => ({
            name: c.name || '',
            title: c.title || '',
            contactScore: c.contactScore || 0
          }))
        }))
      };
      const result = await callOpenAI(CHALLENGE_3_PROMPT, JSON.stringify(input));
      c3Reviews = result.reviews || [];
    } catch (err) {
      console.error('Audit challenge 3 failed:', err);
    }
  }

  // -- Apply results --
  const groupMap = new Map();
  for (const g of groups) {
    groupMap.set(normalizeDomain(g.domain), g);
    groupMap.set(normalizeCompanyName(g.companyName), g);
  }

  // Apply Challenge 1 (upgrades)
  for (const r of c1Reviews) {
    const g = groupMap.get(normalizeDomain(r.domain)) || groupMap.get(normalizeCompanyName(r.company));
    if (!g) continue;
    auditStats.reviewed++;
    g.auditVerdict   = r.verdict;
    g.auditReasoning = r.reasoning || '';
    if (r.verdict === 'UPGRADE' && r.newIcpScore > g.icpScore) {
      g.icpScore       = clamp(r.newIcpScore, 1, 5);
      g.icpLabel       = getIcpLabel(g.icpScore, false);
      auditStats.upgraded++;
    } else {
      g.auditVerdict   = 'CONFIRM';
      auditStats.confirmed++;
    }
  }

  // Apply Challenge 2 (downgrades)
  for (const r of c2Reviews) {
    const g = groupMap.get(normalizeDomain(r.domain)) || groupMap.get(normalizeCompanyName(r.company));
    if (!g) continue;
    if (!g.auditVerdict) auditStats.reviewed++;
    g.auditVerdict   = r.verdict;
    g.auditReasoning = (g.auditReasoning ? g.auditReasoning + ' | ' : '') + (r.reasoning || '');
    if (r.verdict === 'DOWNGRADE' && r.newIcpScore < g.icpScore) {
      g.icpScore = clamp(r.newIcpScore, 1, 5);
      g.icpLabel = getIcpLabel(g.icpScore, g.isReferralSource);
      auditStats.downgraded++;
    } else {
      if (g.auditVerdict !== 'UPGRADE') {
        g.auditVerdict = 'CONFIRM';
        auditStats.confirmed++;
      }
    }
    if (r.solutionCorrection) {
      g.auditSolutionCorrection = r.solutionCorrection;
      auditStats.solutionFixes++;
    }
  }

  // Apply Challenge 3 (contact gaps)
  for (const r of c3Reviews) {
    const g = groupMap.get(normalizeDomain(r.domain)) || groupMap.get(normalizeCompanyName(r.company));
    if (!g) continue;
    if (!r.contactsAdequate && r.findRole) {
      g.auditContactGap = r.findRole;
      auditStats.contactGaps++;
    }
    // Apply contact corrections
    for (const cc of (r.contactCorrections || [])) {
      const contact = (g.contacts || []).find(c =>
        c.name && normalizeCompanyName(c.name) === normalizeCompanyName(cc.name)
      );
      if (contact && cc.suggestedScore < contact.contactScore) {
        contact.contactScore = clamp(cc.suggestedScore, 1, 5);
        contact.contactLabel = getContactLabel(contact.contactScore);
        contact.contactReasoning = cc.reason || contact.contactReasoning;
      }
    }
  }

  // Re-calculate actions after audit score changes
  calculateAllActions();

  APP_STATE.auditRun  = true;
  APP_STATE.auditStats = auditStats;

  // Show audit banner
  renderAuditBanner(auditStats);

  // Re-render results
  renderResults();

  if (btn) { btn.textContent = '✓ Audit Complete'; }
  document.getElementById('export-btn')?.removeAttribute('disabled');
}

function renderAuditBanner(stats) {
  const banner = document.getElementById('audit-banner');
  if (!banner) return;
  banner.innerHTML = `
    <div class="audit-banner-inner">
      <div class="audit-banner-title">Audit complete — ${fmt(stats.reviewed)} companies reviewed</div>
      <div class="audit-banner-stats">
        ${stats.upgraded   ? `<span class="audit-up">⬆ ${stats.upgraded} upgraded</span>` : ''}
        ${stats.downgraded ? `<span class="audit-down">⬇ ${stats.downgraded} downgraded</span>` : ''}
        ${stats.solutionFixes ? `<span class="audit-fix">🔧 ${stats.solutionFixes} solution correction${stats.solutionFixes > 1 ? 's' : ''}</span>` : ''}
        ${stats.contactGaps   ? `<span class="audit-gap">⚠ ${stats.contactGaps} contact gap${stats.contactGaps > 1 ? 's' : ''}</span>` : ''}
        ${stats.confirmed     ? `<span class="audit-confirm-stat">✓ ${stats.confirmed} confirmed</span>` : ''}
        ${!stats.upgraded && !stats.downgraded && !stats.solutionFixes ? '<span class="audit-confirm-stat">All scores confirmed — no changes needed</span>' : ''}
      </div>
    </div>`;
  banner.classList.remove('hidden');
}
