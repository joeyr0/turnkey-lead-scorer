// ============================================================
// PHASE 2: Company Scoring
// ============================================================

const COMPANY_SCORER_SYSTEM_PROMPT = `You are a senior sales intelligence analyst at Turnkey, a crypto wallet and signing infrastructure company. Score companies against Turnkey's ICP and generate outreach materials.

ABOUT TURNKEY
Turnkey is wallet and signing infrastructure — the programmable, secure layer between applications and cryptographic key operations. Generate wallets, sign transactions, manage policies. Additionally, Turnkey Verifiable Cloud (TVC) is a verifiable compute platform for security-sensitive operations (custodians, exchanges, MPC providers).

Trusted by: Bridge ($1.1B Stripe acquisition), Polymarket, World App, Wealthsimple, Coinbase, Alchemy, Aave, Anchorage, dYdX, Flutterwave, Yellow Card, Moonshot, Axiom, Column Bank, Squads, Magic Eden.
Backed by: Sequoia, Faction (Lightspeed), Galaxy, Coinbase Ventures, Bain Capital Crypto. $52.5M raised.
Partnerships: Mastercard, Y Combinator, a16z Crypto.

10 NAMED SOLUTIONS (map every company to one or more):

Embedded Wallets:
1. Embedded Consumer Wallets — frictionless in-app wallets, no seed phrases, email/passkey/OAuth. Customers: Moonshot, Axiom
2. Embedded Business Wallets — non-custodial wallets for business accounts, RBAC, programmable approvals. Customers: Mural Pay, Flutterwave
3. Wallet-as-a-Service (WaaS) — infrastructure to build your own wallet product. Customers: Alchemy
4. Agentic Wallets — onchain wallets for AI agents, policy-scoped access, sub-100ms. Customers: Spectral Finance

Company Wallets:
5. Smart Contract Management — programmatic signing for minting, burning, onchain ops. Customers: Polymarket, Superstate
6. Payment Orchestration — automated deposit/withdrawal for high-volume crypto ops. Customers: Bridge, Squads
7. Issuance — policy-governed issuance of onchain capital. Customers: Superstate, Maple Finance
8. Treasury Management — company crypto treasury ops (early stage)

Key Management:
9. Encryption Key Escrow — secure key storage/retrieval. Customers: World App, Aave
10. Disaster Recovery — auditable wallet recovery. Customers: Ready

TURNKEY VERIFIABLE CLOUD (TVC):
TVC is Vercel for verifiable TEE applications. Developers deploy code that can be cryptographically verified for correctness. Used by Coinbase, Polymarket, Anchorage. Especially relevant post-Bybit hack ($1.5B stolen because the parsing layer was compromised — signers could not verify what they SAW matched what they SIGNED).

TVC categories: custodians (OCC/FINMA/MAS-regulated), regulated exchanges, MPC/wallet infra providers, prime brokers, white-label crypto infra, smart wallet/multisig providers.

FIVE OUTREACH ANGLES (pick one per company based on best fit):
1. USER_WALLETS — consumer apps, fintechs, neobanks needing user wallets
2. TRANSACTION_SIGNING — exchanges, payments, DeFi, RWA, high-volume signing
3. KEY_MANAGEMENT — institutional custody, enterprise crypto, key storage
4. AGENTIC_WALLETS — AI agent platforms, autonomous trading, AI+crypto
5. VERIFIABLE_COMPUTE — custodians, regulated exchanges, MPC providers needing provable operations

ICP SCORING RUBRIC (1-5):

Score 5 — DEFINITE TARGET:
5a: Crypto-native builder with direct need today. DeFi protocols, crypto exchanges, RWA platforms, consumer crypto apps, stablecoin infrastructure.
5b: Confirmed crypto-expansion. Traditional fintech/payments/banking WITH confirmed signal (hired crypto roles, announced crypto features, partnered with crypto infra). Examples: Wealthsimple, Column Bank, Flutterwave.
Also 5: Companies known to use a Turnkey competitor — they've validated the category.

Score 4 — STRONG FIT:
Vertical where crypto adoption is likely but no confirmed signal. Payments companies, payroll platforms, corporate treasury, neobanks (Series A+), AI agent builders, L1/L2 ecosystems, crypto exchanges.
Test: "Would a reasonable person expect this company to need wallet/signing infra within 12 months?"

Score 3 — CREDIBLE FIT:
Specific articulable reason Turnkey is relevant. NOT "possible" — SPECIFIC.
RULE: If you score 3, you MUST write a credible outreach hook. If you cannot, score 2.
Examples: Treasury platform that could add crypto. Cross-border payments where stablecoins help.

Score 2 — UNLIKELY FIT:
Traditional tech/SaaS, no crypto signal. Large banks without known digital assets team.

Score 1 — EXCLUDE (from direct outbound):
Wrong vertical or excluded category: security/audit firms, events companies, research/analytics/data firms, legal, accounting, government, academic, media, insurance, personal websites.

SPECIAL — REFERRAL SOURCE (icpScore=1, but set isReferralSource=true):
Consulting firms, dev shops, agencies, systems integrators (even crypto-focused) — they build for others and are not direct Turnkey buyers, BUT they recommend infra to their clients. Great referral/partner source. Set icpScore=1 and isReferralSource=true.
VC/investor firms — not buyers, but advise portcos on infrastructure. Set icpScore=1 and isReferralSource=true.

CRITICAL SCORING RULES:
- Large traditional banks (Wells Fargo, HSBC, Citi, JPMorgan) score 2-3 MAX
- Major crypto exchanges (OKX, Coinbase, Kraken, FalconX) score 4-5 for Payment Orchestration — NOT competitors
- "Crypto eats finance" thesis: fintechs/payments adding crypto rails score 4-5, NOT 2-3
- AI companies with zero crypto relevance score 1, NOT 4 for "Agentic Wallets"
- Dev shops/agencies get icpScore 1 BUT isReferralSource=true — they're not buyers but they refer clients
- Stealth companies with no public info score 2-3 MAX, never 4+. Confidence = LOW.
- A Score 3 without a credible hook MUST be downgraded to 2

TVC SCORING RUBRIC (1-5):
5: Regulated custodian or exchange with institutional clients
4: MPC/wallet infra provider or prime broker
3: Exchange or crypto company with significant tx volume
2: Crypto company where TVC isn't primary need
1: No TVC relevance

COMPETITOR LIST (always icpScore=1):
Privy, Fireblocks, Dynamic, Coinbase CDP, Crossmint, Dfns, Sodot, Cubist, Particle Network, Magic / Magic Labs, Eigen Cloud, Openfort, Para, Web3Auth, Capsule, Marlin, thirdweb, Lit Protocol, Zero Hash, Verve Wallet, Shield, Blade, Cilantro, Pay Protocol, Trilema Wallet, Tin Foil, BitGo

NEVER competitors (if you think these are competitors, you are WRONG):
Citi, OKX, Wells Fargo, HSBC, JPMorgan, Shift Markets, Sequence (sequence.xyz), Coinbase, Anchorage Digital, FalconX, Gemini

REFERENCE SELECTION — pick 3-4 from this logo wall ONLY:
Bridge, Polymarket, World App, Stripe, Coinbase, Alchemy, Wealthsimple, Moonshot, Axiom, Aave, Anchorage, dYdX, Flutterwave, Yellow Card, Superstate, Maple Finance, Magic Eden, Spectral Finance, Column Bank, Squads, Infinex, Mural Pay
Rules: Mirror the prospect's category. Lead with FOMO logos (Bridge, Polymarket, World). Credibility > exact solution match.

OUTPUT FORMAT — return a JSON object with key "companies" containing an array. Each element:
{
  "company": "Company Name",
  "domain": "domain.com",
  "icpScore": 4,
  "icpLabel": "Strong Fit",
  "tvcScore": 2,
  "tvcLabel": "Unlikely TVC Fit",
  "confidence": "HIGH",
  "isReferralSource": false,
  "outreachAngle": "USER_WALLETS",
  "primarySolution": "Embedded Business Wallets",
  "secondarySolutions": ["Payment Orchestration"],
  "outreachHook": "One sentence connecting their use case to Turnkey with relevant references.",
  "relevantReferences": ["Wealthsimple", "Flutterwave", "Bridge"],
  "reasoning": "Brief — max 20 words"
}

isReferralSource: true ONLY for consulting/dev shops/agencies/VC firms that could refer clients to Turnkey. These get icpScore=1 but are flagged separately from hard excludes.

ICP Labels: 5=Definite Target, 4=Strong Fit, 3=Credible Fit, 2=Unlikely Fit, 1=Exclude
For referral sources: icpLabel = "Referral Source"
TVC Labels: 5=Definite TVC Target, 4=Strong TVC Fit, 3=Moderate TVC Fit, 2=Unlikely TVC Fit, 1=No TVC Relevance
Confidence: HIGH, MEDIUM, LOW
Angles: USER_WALLETS, TRANSACTION_SIGNING, KEY_MANAGEMENT, AGENTIC_WALLETS, VERIFIABLE_COMPUTE

IMPORTANT: Return ONLY valid JSON. No markdown, no explanation outside JSON. Concise reasoning (max 20 words). Outreach hook must be one sentence with specific references.`;

// ---- OpenAI API call ----

async function callOpenAI(systemPrompt, userContent, retries = 1) {
  const body = {
    model: 'gpt-4.1-2025-04-14',
    temperature: 0,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent }
    ],
    response_format: { type: 'json_object' }
  };

  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(2000);
    try {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${APP_STATE.apiKey}`
        },
        body: JSON.stringify(body)
      });
      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`API ${resp.status}: ${errText}`);
      }
      const data = await resp.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error('Empty API response');
      return JSON.parse(content);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

// ---- Company scoring orchestration ----

async function scoreCompanies() {
  const all = APP_STATE.companyGroups;

  // Separate: companies that need API vs pre-flagged (already handled)
  const toScore = all.filter(g =>
    !g.flags.isExistingCustomer &&
    !(g.flags.isCompetitor && !g.flags.isTvcEligibleCompetitor) &&
    !g.flags.isTurnkeyEmployee
  );

  APP_STATE.scoringProgress.companyTotal = toScore.length;
  APP_STATE.scoringProgress.companyDone  = 0;
  updateScoringProgress();

  if (toScore.length === 0) {
    updateScoringProgress();
    return;
  }

  // Batch by 10
  for (let i = 0; i < toScore.length; i += 10) {
    const batch = toScore.slice(i, i + 10);

    const input = {
      companies: batch.map(g => ({
        company: g.companyName,
        domain: g.domain,
        isTier1: g.flags.isTier1Target,
        isTvcEligibleCompetitor: g.flags.isTvcEligibleCompetitor
      }))
    };

    try {
      const result = await callOpenAI(COMPANY_SCORER_SYSTEM_PROMPT, JSON.stringify(input));
      const scored = result.companies || [];

      for (const s of scored) {
        // Match back to group by domain or company name
        const match = batch.find(g =>
          normalizeDomain(g.domain) === normalizeDomain(s.domain) ||
          normalizeCompanyName(g.companyName) === normalizeCompanyName(s.company)
        );
        if (match) {
          applyCompanyScore(match, s);
          applyPostScoringOverrides(match);
        }
      }

      // Any in batch that didn't get a match → mark failed
      for (const g of batch) {
        if (g.icpScore === null) {
          g.scoringFailed = true;
          g.icpScore = 2;
          g.icpLabel = 'Unlikely Fit';
          g.tvcScore = 1;
          g.tvcLabel = 'No TVC Relevance';
          g.confidence = 'LOW';
          g.outreachHook = '';
          g.reasoning = 'Scoring failed — no match returned';
        }
      }
    } catch (err) {
      console.error('Company scoring batch error:', err);
      for (const g of batch) {
        g.scoringFailed = true;
        g.icpScore = 2;
        g.icpLabel = 'Unlikely Fit';
        g.tvcScore = 1;
        g.tvcLabel = 'No TVC Relevance';
        g.confidence = 'LOW';
        g.outreachHook = '';
        g.reasoning = `Scoring failed: ${err.message}`;
      }
    }

    APP_STATE.scoringProgress.companyDone += batch.length;
    updateScoringProgress();

    // Rate limiting: 800ms between batches (skip after last)
    if (i + 10 < toScore.length) {
      await sleep(800);
    }

    // Check for stop request
    if (APP_STATE.stopRequested) break;
  }
}

function applyCompanyScore(group, s) {
  group.icpScore         = clamp(s.icpScore, 1, 5);
  group.icpLabel         = s.icpLabel || getIcpLabel(group.icpScore, s.isReferralSource);
  group.tvcScore         = clamp(s.tvcScore, 1, 5);
  group.tvcLabel         = s.tvcLabel || getTvcLabel(group.tvcScore);
  group.confidence       = s.confidence || 'MEDIUM';
  group.isReferralSource = !!s.isReferralSource;
  group.outreachAngle    = s.outreachAngle || null;
  group.primarySolution  = s.primarySolution || null;
  group.secondarySolutions = Array.isArray(s.secondarySolutions) ? s.secondarySolutions : [];
  group.outreachHook     = s.outreachHook || '';
  group.relevantReferences = Array.isArray(s.relevantReferences) ? s.relevantReferences : [];
  group.reasoning        = s.reasoning || '';
}

function applyPostScoringOverrides(group) {
  // Tier 1 → force icpScore = 5
  if (group.flags.isTier1Target) {
    group.icpScore = 5;
    group.icpLabel = 'Definite Target';
  }

  // TVC-eligible competitor → force icpScore = 1
  if (group.flags.isTvcEligibleCompetitor) {
    group.icpScore = 1;
    group.icpLabel = 'Competitor (TVC Prospect)';
  }

  // Never-competitor safelist override
  if (group.isReferralSource === false) {
    // If model tried to classify as competitor but shouldn't
    if (isNeverCompetitor(group.companyName, group.domain)) {
      group.flags.isCompetitor = false;
    }
  }

  // Score 3 without credible hook → downgrade to 2
  if (group.icpScore === 3 && isGenericHook(group.outreachHook)) {
    group.icpScore = 2;
    group.icpLabel = 'Unlikely Fit';
    group.hookDowngraded = true;
  }

  // Save original score (before audit)
  group.originalIcpScore = group.icpScore;
}
