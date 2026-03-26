// ============================================================
// APP STATE + MAIN FLOW + EVENT HANDLERS
// ============================================================

const APP_STATE = {
  apiKey: '',
  eventName: '',
  fileName: '',
  rawHeaders: [],
  rawRows: [],
  columnMap: { company: null, domain: null, name: null, title: null, email: null, linkedin: null },
  companyGroups: [],
  isCompanyOnlyList: false,
  auditRun: false,
  auditStats: null,
  scoringComplete: false,
  currentFilter: 'ALL',
  viewMode: 'bdr',
  visibleColumns: null,
  sortCol: null,
  sortDir: 'desc',
  additionalCustomers: [],
  additionalCompetitors: [],
  testMode: false,
  stopRequested: false,
  scoringProgress: {
    companyTotal: 0, companyDone: 0,
    contactTotal: 0, contactDone: 0
  }
};

// ---- Stop ----

function requestStop() {
  APP_STATE.stopRequested = true;
  const btn = document.getElementById('stop-btn');
  if (btn) { btn.textContent = 'Stopping…'; btn.disabled = true; }
  const title = document.getElementById('scoring-title');
  if (title) title.textContent = '⏸ Stopping after current batch…';
}

// ---- Main scoring flow ----

async function startScoring(testMode = false) {
  const apiKeyInput = document.getElementById('api-key-input');
  APP_STATE.apiKey = (apiKeyInput?.value || '').trim();
  if (!APP_STATE.apiKey) {
    alert('Please enter your OpenAI API key before scoring.');
    apiKeyInput?.focus();
    return;
  }

  APP_STATE.eventName     = (document.getElementById('event-name-input')?.value || '').trim();
  APP_STATE.additionalCustomers  = (document.getElementById('extra-customers')?.value || '')
    .split('\n').map(s => s.trim()).filter(Boolean);
  APP_STATE.additionalCompetitors = (document.getElementById('extra-competitors')?.value || '')
    .split('\n').map(s => s.trim()).filter(Boolean);
  APP_STATE.testMode      = testMode;
  APP_STATE.stopRequested = false;

  try { localStorage.setItem('tk_openai_key', APP_STATE.apiKey); } catch(e) {}

  // Re-build groups with any additional exclusions
  rebuildGroups();

  // If test mode, limit to first 20 scoreable companies
  if (testMode) {
    const scoreable = APP_STATE.companyGroups.filter(g =>
      !g.flags.isExistingCustomer &&
      !(g.flags.isCompetitor && !g.flags.isTvcEligibleCompetitor) &&
      !g.flags.isTurnkeyEmployee
    );
    const testSet = new Set(scoreable.slice(0, 20).map(g => g.domain));
    // Keep pre-flagged (customers/competitors) + first 20 scoreable
    APP_STATE.companyGroups = APP_STATE.companyGroups.filter(g =>
      g.flags.isExistingCustomer ||
      (g.flags.isCompetitor && !g.flags.isTvcEligibleCompetitor) ||
      g.flags.isTurnkeyEmployee ||
      testSet.has(g.domain)
    );
  }

  // Switch to scoring view
  showView('view-scoring');

  // Reset progress
  APP_STATE.scoringProgress = { companyTotal: 0, companyDone: 0, contactTotal: 0, contactDone: 0 };
  const title = document.getElementById('scoring-title');
  if (title) title.textContent = testMode ? '🔑 Validating API key…' : '🔑 Validating API key…';
  const stopBtn = document.getElementById('stop-btn');
  if (stopBtn) { stopBtn.textContent = '⏹ Stop'; stopBtn.disabled = false; }

  // Hide previous errors
  const errEl = document.getElementById('scoring-error');
  if (errEl) errEl.classList.add('hidden');

  updateScoringProgress();

  try {
    // Validate API key before starting
    const keyOk = await validateApiKey();
    if (!keyOk) return;

    if (title) title.textContent = testMode ? '⚡ Test scoring 20 companies…' : '⚡ Scoring your list…';

    await scoreCompanies();

    const compDone = document.getElementById('company-scoring-status');
    if (compDone) {
      const stopped = APP_STATE.stopRequested;
      compDone.textContent = stopped ? '⏸ Stopped early' : '✓ Company scoring complete';
      compDone.classList.add('status-done');
    }

    if (!APP_STATE.stopRequested) {
      await scoreContacts();
    }

    const contDone = document.getElementById('contact-scoring-status');
    if (contDone) {
      if (APP_STATE.isCompanyOnlyList) {
        contDone.textContent = '— Skipped (company-only list)';
      } else if (APP_STATE.stopRequested) {
        contDone.textContent = '⏸ Stopped';
      } else {
        contDone.textContent = '✓ Contact scoring complete';
      }
      contDone.classList.add('status-done');
    }

    calculateAllActions();
    APP_STATE.scoringComplete = true;

    showView('view-results');
    renderResults();

    document.getElementById('audit-btn')?.removeAttribute('disabled');
    document.getElementById('export-btn')?.removeAttribute('disabled');

    // Stop button no longer needed
    if (stopBtn) stopBtn.disabled = true;

  } catch (err) {
    console.error('Scoring error:', err);
    if (errEl) {
      errEl.textContent = `Error: ${err.message}`;
      errEl.classList.remove('hidden');
    }
  }
}

// ---- Filter + search ----

function setFilter(filter) {
  APP_STATE.currentFilter = filter;
  renderResults();
}

function setViewMode(mode) {
  APP_STATE.viewMode = mode;
  renderResults();
}

// ---- Upload zone ----

function initUploadZone() {
  const zone  = document.getElementById('drop-zone');
  const input = document.getElementById('file-input');
  if (!zone || !input) return;

  zone.addEventListener('click', () => input.click());
  input.addEventListener('change', e => { if (e.target.files[0]) handleFile(e.target.files[0]); });
  zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });
}

// ---- Init ----

function initApp() {
  try {
    const saved = localStorage.getItem('tk_openai_key');
    if (saved) {
      APP_STATE.apiKey = saved;
      const input = document.getElementById('api-key-input');
      if (input) input.value = saved;
    }
  } catch(e) {}

  const keyInput  = document.getElementById('api-key-input');
  const keyToggle = document.getElementById('api-key-toggle');
  if (keyInput && keyToggle) {
    keyToggle.addEventListener('click', () => {
      const isPw = keyInput.type === 'password';
      keyInput.type = isPw ? 'text' : 'password';
      keyToggle.textContent = isPw ? 'Hide' : 'Show';
    });
    keyInput.addEventListener('input', () => {
      APP_STATE.apiKey = keyInput.value.trim();
      try { localStorage.setItem('tk_openai_key', APP_STATE.apiKey); } catch(e) {}
    });
  }

  initUploadZone();
  showView('view-upload');
}

document.addEventListener('DOMContentLoaded', initApp);
