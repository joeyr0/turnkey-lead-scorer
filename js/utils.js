// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function normalizeCompanyName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|corp|co|limited|incorporated|corporation|group|holdings|technologies|technology|labs|lab|solutions|services|global|international|ventures|capital|digital|finance|financial|ai|io)\b\.?/g, ' ')
    .replace(/[^a-z0-9]/g, '')
    .replace(/\s+/g, '')
    .trim();
}

function normalizeDomain(raw) {
  if (!raw) return '';
  let d = raw.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, '');
  d = d.replace(/^www\./, '');
  d = d.split('/')[0];
  d = d.split('?')[0];
  d = d.split('#')[0];
  return d.trim();
}

// Find a column header matching any of the candidate strings
function findField(headers, ...candidates) {
  const lower = headers.map(h => (h || '').toLowerCase().trim());
  for (const c of candidates) {
    const idx = lower.findIndex(x => x === c.toLowerCase() || x.includes(c.toLowerCase()));
    if (idx >= 0) return headers[idx];
  }
  return null;
}

// Render star string for a score 1-5
function renderStars(score) {
  const filled = Math.max(0, Math.min(5, score || 0));
  return '★'.repeat(filled) + '☆'.repeat(5 - filled);
}

// Score badge color class
function scoreColorClass(score) {
  if (score >= 5) return 'score-5';
  if (score >= 4) return 'score-4';
  if (score >= 3) return 'score-3';
  if (score >= 2) return 'score-2';
  return 'score-1';
}

// Copy text to clipboard, briefly change button label
function copyToClipboard(text, btn) {
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent;
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    btn.disabled = true;
    setTimeout(() => {
      btn.textContent = orig;
      btn.classList.remove('copied');
      btn.disabled = false;
    }, 2000);
  }).catch(() => {
    // Fallback for older browsers
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    const orig = btn.textContent;
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.textContent = orig;
      btn.classList.remove('copied');
    }, 2000);
  });
}

// Show a view section, hide all others
function showView(id) {
  document.querySelectorAll('.view').forEach(el => el.classList.add('hidden'));
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}

// Format large numbers
function fmt(n) {
  return (n || 0).toLocaleString();
}

// Get first name from full name
function firstName(fullName) {
  if (!fullName) return '';
  return fullName.trim().split(/\s+/)[0];
}

// Clamp number to [min, max]
function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val || 0));
}

// Check if a hook is generic/empty (triggers score-3 downgrade)
function isGenericHook(hook) {
  if (!hook || hook.trim().length < 25) return true;
  const generic = [
    /could (explore|consider|benefit|potentially|possibly)/i,
    /might (benefit|be relevant|consider)/i,
    /potential (synergy|fit|opportunity|match)/i,
    /may be (relevant|interested|applicable)/i,
    /no specific hook/i,
    /not enough (info|information|data)/i,
    /unclear relevance/i,
    /generic/i
  ];
  return generic.some(re => re.test(hook));
}

// Action display config
const ACTION_CONFIG = {
  PURSUE:             { label: 'PURSUE',    icon: '✓', cls: 'action-pursue' },
  RESEARCH_CONTACTS:  { label: 'RESEARCH',  icon: '🔍', cls: 'action-research' },
  MONITOR:            { label: 'MONITOR',   icon: '○', cls: 'action-monitor' },
  REFERRAL:           { label: 'REFERRAL',  icon: '🤝', cls: 'action-referral' },
  SKIP:               { label: 'SKIP',      icon: '×', cls: 'action-skip' },
  ROUTE_TO_CSM:       { label: 'CSM',       icon: '→', cls: 'action-csm' },
  OUTREACH:           { label: 'OUTREACH',  icon: '✉', cls: 'action-outreach' },
  RESEARCH:           { label: 'RESEARCH',  icon: '🔍', cls: 'action-research' },
  NURTURE:            { label: 'NURTURE',   icon: '○', cls: 'action-monitor' },
};

function actionBadge(action) {
  const cfg = ACTION_CONFIG[action] || { label: action || '—', icon: '', cls: 'action-skip' };
  return `<span class="badge ${cfg.cls}">${cfg.icon} ${cfg.label}</span>`;
}

// ICP label map
const ICP_LABELS = {
  5: 'Definite Target',
  4: 'Strong Fit',
  3: 'Credible Fit',
  2: 'Unlikely Fit',
  1: 'Exclude'
};

const TVC_LABELS = {
  5: 'Definite TVC Target',
  4: 'Strong TVC Fit',
  3: 'Moderate TVC Fit',
  2: 'Unlikely TVC Fit',
  1: 'No TVC Relevance'
};

function getIcpLabel(score, isReferral) {
  if (isReferral) return 'Referral Source';
  return ICP_LABELS[score] || 'Unknown';
}

function getTvcLabel(score) {
  return TVC_LABELS[score] || 'Unknown';
}
