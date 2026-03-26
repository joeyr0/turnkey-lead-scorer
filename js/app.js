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
  additionalCustomers: [],
  additionalCompetitors: [],
  scoringProgress: {
    companyTotal: 0, companyDone: 0,
    contactTotal: 0, contactDone: 0
  }
};

// ---- Main scoring flow ----

async function startScoring() {
  // Read form values
  const apiKeyInput = document.getElementById('api-key-input');
  APP_STATE.apiKey = (apiKeyInput?.value || '').trim();
  if (!APP_STATE.apiKey) {
    alert('Please enter your OpenAI API key before scoring.');
    apiKeyInput?.focus();
    return;
  }

  // Read event name
  APP_STATE.eventName = (document.getElementById('event-name-input')?.value || '').trim();

  // Read additional exclusions
  const extraCust = (document.getElementById('extra-customers')?.value || '')
    .split('\n').map(s => s.trim()).filter(Boolean);
  const extraComp = (document.getElementById('extra-competitors')?.value || '')
    .split('\n').map(s => s.trim()).filter(Boolean);
  APP_STATE.additionalCustomers  = extraCust;
  APP_STATE.additionalCompetitors = extraComp;

  // Re-build groups with any additional exclusions
  rebuildGroups();

  // Save API key to localStorage
  try { localStorage.setItem('tk_openai_key', APP_STATE.apiKey); } catch(e) {}

  // Switch to scoring view
  showView('view-scoring');
  APP_STATE.scoringProgress = { companyTotal: 0, companyDone: 0, contactTotal: 0, contactDone: 0 };
  updateScoringProgress();

  try {
    // Phase 2: Company scoring
    await scoreCompanies();

    // Mark company scoring done in UI
    const compDone = document.getElementById('company-scoring-status');
    if (compDone) {
      compDone.textContent = '✓ Company scoring complete';
      compDone.classList.add('status-done');
    }

    // Phase 3: Contact scoring
    await scoreContacts();

    const contDone = document.getElementById('contact-scoring-status');
    if (contDone) {
      contDone.textContent = APP_STATE.isCompanyOnlyList
        ? '— Contact scoring skipped (company-only list)'
        : '✓ Contact scoring complete';
      contDone.classList.add('status-done');
    }

    // Phase 4: Calculate actions + render results
    calculateAllActions();
    APP_STATE.scoringComplete = true;

    // Build results view
    showView('view-results');
    renderResults();

    // Enable audit + export buttons
    const auditBtn = document.getElementById('audit-btn');
    if (auditBtn) auditBtn.disabled = false;
    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) exportBtn.disabled = false;

  } catch (err) {
    console.error('Scoring error:', err);
    const errEl = document.getElementById('scoring-error');
    if (errEl) {
      errEl.textContent = `Error: ${err.message}`;
      errEl.classList.remove('hidden');
    }
  }
}

// ---- Filter handler ----

function setFilter(filter) {
  APP_STATE.currentFilter = filter;
  renderResults();
}

// ---- View mode toggle ----

function setViewMode(mode) {
  APP_STATE.viewMode = mode;
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  renderResults();
}

// ---- Upload view drag/drop ----

function initUploadZone() {
  const zone = document.getElementById('drop-zone');
  const input = document.getElementById('file-input');

  if (!zone || !input) return;

  zone.addEventListener('click', () => input.click());
  input.addEventListener('change', e => {
    if (e.target.files[0]) handleFile(e.target.files[0]);
  });

  zone.addEventListener('dragover', e => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });
}

// ---- Init ----

function initApp() {
  // Restore API key from localStorage
  try {
    const saved = localStorage.getItem('tk_openai_key');
    if (saved) {
      APP_STATE.apiKey = saved;
      const input = document.getElementById('api-key-input');
      if (input) input.value = saved;
    }
  } catch(e) {}

  // API key show/hide toggle
  const keyInput = document.getElementById('api-key-input');
  const keyToggle = document.getElementById('api-key-toggle');
  if (keyInput && keyToggle) {
    keyToggle.addEventListener('click', () => {
      const isPassword = keyInput.type === 'password';
      keyInput.type = isPassword ? 'text' : 'password';
      keyToggle.textContent = isPassword ? 'Hide' : 'Show';
    });
    keyInput.addEventListener('input', () => {
      APP_STATE.apiKey = keyInput.value.trim();
      try { localStorage.setItem('tk_openai_key', APP_STATE.apiKey); } catch(e) {}
    });
  }

  // Init upload zone
  initUploadZone();

  // Start on upload view
  showView('view-upload');
}

// Run on DOM ready
document.addEventListener('DOMContentLoaded', initApp);
