// ============================================================
// PHASE 3: Contact Scoring
// ============================================================

const CONTACT_SCORER_SYSTEM_PROMPT = `You are scoring contacts for outbound sales relevance at Turnkey, a crypto wallet infrastructure company. Each contact has company context from a prior scoring pass. Score the CONTACT, not the company.

CONTACT SCORING (1-5) — depends on title AND company type:

The company's outreachAngle tells you the company type:
- USER_WALLETS / TRANSACTION_SIGNING / KEY_MANAGEMENT / AGENTIC_WALLETS with icpScore 5 → crypto-native
- USER_WALLETS with icpScore 4-5 and traditional company name → web2 exploring crypto
- VERIFIABLE_COMPUTE → institutional/enterprise
- icpScore 2-3 → evaluate based on company name

AT CRYPTO-NATIVE COMPANIES:
5: CTO, VP/Head of Eng, Co-founder, CEO (<200 ppl), CPO, VP Product, Head of Crypto/Blockchain/Web3, titles with "wallet"/"infrastructure"
4: Eng Manager, Staff/Principal/Lead Engineer, Blockchain/Protocol Engineer, Solutions Architect, Head of BD
3: DevRel, BD/Partnerships, Product Manager, general "Engineer", CEO at 500+ orgs
2: Marketing, Finance, Legal, Ops, Support, Sales
1: HR, Recruiting, Investors/VCs, Journalists, Interns, Students

AT WEB2/FINTECH EXPLORING CRYPTO:
5: "Head of Crypto"/"Head of Digital Assets"/"VP Blockchain" — hired for the crypto initiative, THE buyer
4: CTO, VP/Head of Eng, Co-founder/CEO (<100 ppl)
3: VP Product, Product Lead — champion to connect to crypto team lead
2: Generic VP/Director at 500+ company, Marketing, Finance, Legal
1: HR, Recruiting, Investors/VCs, Journalists, Interns

AT BANKS/TRADITIONAL ENTERPRISE:
5: "Head of Digital Assets", "MD Blockchain", "Head of Crypto"
4: "Innovation Lab"/"Emerging Technology" leadership
3: General tech leadership if company has crypto initiative
2: Generic title at large institution
1: HR, Recruiting, Investors/VCs, Journalists, Interns

AT STARTUPS (<20 people):
5: Co-founder, CEO, CTO
4: First eng hire, "Head of" technical
3: Any technical role
2: Non-technical
1: HR, Recruiting, Investors/VCs, Journalists, Interns

BLANK/MISSING TITLE: Score based on company score: Company 5 → Contact 3, Company 4 → Contact 2, Company 3 → Contact 2, Company 1-2 → Contact 1

LINKEDIN REQUEST (under 300 characters, STRICT limit):
Use warmest applicable pattern:
1. If warmPath provided: "{{firstName}}, we're both in the [NETWORK] — I'm with Turnkey, we power wallet infra for [2-3 refs]. Would love to connect."
2. If eventName provided: "{{firstName}}, saw you're at [EVENT]. I'm with Turnkey — wallet/signing infra for [2-3 refs]. Would love to connect."
3. If company has crypto signal: "{{firstName}}, been following what [COMPANY] is building. We power wallet infra for [2-3 refs] — would love to connect."
4. Fallback: "{{firstName}}, I'm with Turnkey — wallet and signing infra behind [2-3 refs]. Would love to connect."

CHAMPION PATH: If contact scores 3 at a web2/enterprise company AND company icpScore is 4-5, set championPath to "Potential champion — could connect to [specific role]". Otherwise null.

OUTPUT FORMAT — return JSON object with key "contacts" containing an array:
{
  "contactName": "Full Name",
  "email": "email@domain.com",
  "contactScore": 5,
  "contactLabel": "Decision Maker",
  "contactReasoning": "Brief — max 15 words",
  "linkedinRequest": "Under 300 chars, use warmest pattern",
  "championPath": null
}

Contact Labels: 5=Decision Maker, 4=Strong Influencer, 3=Potential Path, 2=Low Relevance, 1=Exclude

IMPORTANT: Return ONLY valid JSON. LinkedIn request MUST be under 300 characters — count carefully. Concise reasoning (max 15 words).`;

// ---- Contact scoring orchestration ----

async function scoreContacts() {
  if (APP_STATE.isCompanyOnlyList) return;

  const eventName = APP_STATE.eventName || '';

  // Build flat list of scoreable contacts with company context
  const toScore = [];

  for (const group of APP_STATE.companyGroups) {
    // Skip customers, hard competitors, employees
    if (group.flags.isExistingCustomer) {
      // Flag contacts for CSM routing instead
      for (const c of group.contacts) {
        c.contactScore  = group.contacts.indexOf(c) >= 0 ? null : null;
        c.contactAction = null; // will be set in action calculation
      }
      continue;
    }
    if (group.flags.isCompetitor && !group.flags.isTvcEligibleCompetitor) continue;
    if (group.flags.isTurnkeyEmployee) continue;
    if (!group.contacts || group.contacts.length === 0) continue;

    // Build company context for this group
    const companyContext = buildCompanyContext(group, eventName);

    for (const contact of group.contacts) {
      // Skip contacts that clearly don't need scoring
      if (isAutoExcludeContact(contact)) {
        contact.contactScore = 1;
        contact.contactLabel = 'Exclude';
        contact.contactReasoning = 'Auto-excluded';
        contact.linkedinRequest = '';
        contact.championPath = null;
        continue;
      }

      toScore.push({ contact, group, companyContext });
    }
  }

  APP_STATE.scoringProgress.contactTotal = toScore.length;
  APP_STATE.scoringProgress.contactDone  = 0;
  updateScoringProgress();

  if (toScore.length === 0) return;

  // Batch by 15
  for (let i = 0; i < toScore.length; i += 15) {
    const batch = toScore.slice(i, i + 15);

    const input = {
      contacts: batch.map(({ contact, group, companyContext }) => ({
        contactName: contact.name || '',
        title:       contact.title || '',
        email:       contact.email || '',
        linkedin:    contact.linkedin || '',
        company:     group.companyName,
        domain:      group.domain,
        companyContext,
        eventName
      }))
    };

    try {
      const result = await callOpenAI(CONTACT_SCORER_SYSTEM_PROMPT, JSON.stringify(input));
      const scored = result.contacts || [];

      for (const s of scored) {
        // Match back to contact by email or name
        const match = batch.find(({ contact }) =>
          (contact.email && s.email && contact.email.toLowerCase() === s.email.toLowerCase()) ||
          (contact.name && s.contactName && normalizeCompanyName(contact.name) === normalizeCompanyName(s.contactName))
        );
        if (match) {
          applyContactScore(match.contact, s);
        }
      }

      // Any contacts that didn't match → default low score
      for (const { contact } of batch) {
        if (contact.contactScore === null) {
          contact.contactScore = 1;
          contact.contactLabel = 'Exclude';
          contact.contactReasoning = 'Could not score';
          contact.linkedinRequest = '';
          contact.championPath = null;
        }
      }
    } catch (err) {
      console.error('Contact scoring batch error:', err);
      for (const { contact } of batch) {
        contact.contactScore = 1;
        contact.contactLabel = 'Exclude';
        contact.contactReasoning = `Scoring failed`;
        contact.linkedinRequest = '';
        contact.championPath = null;
      }
    }

    APP_STATE.scoringProgress.contactDone += batch.length;
    updateScoringProgress();

    if (i + 15 < toScore.length) {
      await sleep(800);
    }
  }
}

function buildCompanyContext(group, eventName) {
  return {
    icpScore:           group.icpScore || 1,
    tvcScore:           group.tvcScore || 1,
    outreachAngle:      group.outreachAngle || '',
    primarySolution:    group.primarySolution || '',
    relevantReferences: group.relevantReferences || [],
    outreachHook:       group.outreachHook || '',
    warmPath:           group.flags.warmPath || null,
    isTier1:            group.flags.isTier1Target || false,
  };
}

function applyContactScore(contact, s) {
  contact.contactScore     = clamp(s.contactScore, 1, 5);
  contact.contactLabel     = s.contactLabel || getContactLabel(contact.contactScore);
  contact.contactReasoning = s.contactReasoning || '';
  contact.championPath     = s.championPath || null;

  // Enforce 300 char limit on LinkedIn request
  let li = s.linkedinRequest || '';
  if (li.length > 300) {
    // Truncate at last complete sentence under 300 chars
    const truncated = li.substring(0, 300);
    const lastPeriod = Math.max(
      truncated.lastIndexOf('. '),
      truncated.lastIndexOf('! '),
      truncated.lastIndexOf('? ')
    );
    li = lastPeriod > 200 ? truncated.substring(0, lastPeriod + 1) : truncated.substring(0, 297) + '...';
  }
  contact.linkedinRequest = li;
}

// Check if contact should be auto-excluded without API call
function isAutoExcludeContact(contact) {
  const title = (contact.title || '').toLowerCase();
  if (/\b(intern|internship|student|co-op)\b/.test(title)) return true;
  return false;
}

function getContactLabel(score) {
  const labels = { 5: 'Decision Maker', 4: 'Strong Influencer', 3: 'Potential Path', 2: 'Low Relevance', 1: 'Exclude' };
  return labels[score] || 'Unknown';
}
