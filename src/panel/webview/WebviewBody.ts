export function buildBody(): string {
  return `
  <div class="header">
    <div class="logo">
      <span class="logo-icon">&#x1F50D;</span>
      <div>
        <div>manan-kanchu</div>
        <div class="logo-sub">AI Code Detector</div>
      </div>
    </div>
    <div id="providerBadge" class="provider-badge">&#x26A1; No provider</div>
    <div class="header-actions">
      <button class="btn-icon" id="btnHeaderScanFile">&#x1F4C4; Scan File</button>
      <button class="btn-icon" id="btnHeaderExport">&#x1F4CA; Export</button>
      <button class="btn-icon" id="btnHeaderSettings">&#x2699;&#xFE0F;</button>
    </div>
  </div>

  <div class="tabs">
    <div class="tab active" data-tab="dashboard">Dashboard</div>
    <div class="tab" data-tab="findings">Findings</div>
    <div class="tab" data-tab="files">Files</div>
    <div class="tab" data-tab="shell">Shell</div>
    <div class="tab" data-tab="policies">Policies</div>
    <div class="tab" data-tab="settings">Settings</div>
  </div>

  <div class="main">
    <div class="sidebar">
      <div class="sidebar-section">
        <div class="sidebar-title">Scan Actions</div>
        <button class="scan-btn primary" id="btnScanProject">&#x1F50E; Scan Project</button>
        <button class="scan-btn secondary" id="btnScanFile">&#x1F4C4; Scan Current File</button>
        <button class="scan-btn secondary" id="btnScanSelection">&#x2702;&#xFE0F; Scan Selection</button>
        <button class="scan-btn browse" id="btnBrowseFiles">&#x1F4C2; Browse &amp; Select File</button>
      </div>
      <div class="sidebar-section" id="scanProgress" style="display:none">
        <div class="sidebar-title">Scanning&#x2026;</div>
        <div style="display:flex;align-items:center;gap:8px;">
          <div class="spinner"></div>
          <span id="scanProgressText" style="font-size:12px;color:var(--fg1)">Analyzing files&#x2026;</span>
        </div>
        <div class="progress-bar" style="margin-top:10px;">
          <div class="progress-fill" id="progressFill" style="width:0%;background:var(--accent);"></div>
        </div>
      </div>
      <div class="sidebar-section">
        <div class="sidebar-title">AI Detection Score</div>
        <div id="sidebarAiScore" style="display:flex;flex-direction:column;align-items:center;gap:6px;padding:8px 0;">
          <div class="score-circle low" id="scoreCircle">
            <div id="scoreVal" style="font-size:20px;">&#x2014;</div>
            <div style="font-size:10px;opacity:0.7;">AI Score</div>
          </div>
          <div style="font-size:11px;color:var(--fg1);text-align:center;" id="scoreLabel">Run a scan to see results</div>
        </div>
      </div>
      <div class="sidebar-files" id="sidebarFiles">
        <div class="sidebar-title" style="padding:4px 0;">File Results</div>
        <div id="fileListSidebar" style="font-size:12px;color:var(--fg1);">No files scanned</div>
      </div>
    </div>

    <div class="content">
      <div class="tab-panel active" id="tab-dashboard">
        <div id="dashboardEmpty" class="empty-state">
          <div class="empty-icon">&#x1F50D;</div>
          <div class="empty-title">manan-kanchu &#x2014; AI Code Detector</div>
          <div class="empty-desc">7-signal hybrid analysis with explainable scores. Not a black-box number &#x2014; every flag comes with evidence you can verify.</div>
          <div style="display:flex;gap:24px;justify-content:center;margin:4px 0 8px;font-size:12px;color:var(--fg1);">
            <span>&#x1F916; AI authorship detection</span>
            <span>&#x1F6E1;&#xFE0F; OWASP scanning</span>
            <span>&#x1F512; 100% offline via Ollama</span>
          </div>
          <button class="scan-btn primary" style="width:200px;" id="btnDashboardStartScan">&#x1F50E; Start Project Scan</button>
        </div>
        <div id="dashboardResults" style="display:none;">
          <div class="section-header">
            <div>
              <div class="section-title">Scan Summary</div>
              <div class="section-subtitle" id="dashSubtitle">&#x2014;</div>
            </div>
            <button class="btn-icon" id="btnGenerateReport">&#x1F4CA; Generate Report</button>
          </div>
          <div class="stats-grid">
            <div class="stat-card total"><div class="stat-value" id="statTotal">0</div><div class="stat-label">Total Findings</div></div>
            <div class="stat-card ai"><div class="stat-value" id="statAI">0%</div><div class="stat-label">Avg AI Score</div></div>
            <div class="stat-card critical"><div class="stat-value" id="statCritical">0</div><div class="stat-label">Critical</div></div>
            <div class="stat-card high"><div class="stat-value" id="statHigh">0</div><div class="stat-label">High</div></div>
            <div class="stat-card medium"><div class="stat-value" id="statMedium">0</div><div class="stat-label">Medium</div></div>
            <div class="stat-card clean"><div class="stat-value" id="statFiles">0</div><div class="stat-label">Files Scanned</div></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
            <div class="detail-panel" style="margin-top:0;">
              <div class="sidebar-title" style="margin-bottom:10px;">Findings by Category</div>
              <div id="categoryChart"></div>
            </div>
            <div class="detail-panel" style="margin-top:0;">
              <div class="sidebar-title" style="margin-bottom:10px;">Severity Distribution</div>
              <div id="severityChart"></div>
            </div>
          </div>
          <div class="section-header"><div class="section-title">Top Findings</div></div>
          <div id="topFindings"></div>
        </div>
      </div>

      <div class="tab-panel" id="tab-findings">
        <div id="findingsEmpty" class="empty-state">
          <div class="empty-icon">&#x1F6E1;&#xFE0F;</div>
          <div class="empty-title">No Findings Yet</div>
          <div class="empty-desc">Run a scan to see detailed security findings, AI detection results, and policy violations.</div>
        </div>
        <div id="findingsContent" style="display:none;">
          <div class="section-header" style="align-items:flex-start;flex-wrap:wrap;gap:10px;">
            <div class="section-title">All Findings <span id="findingsCount" style="font-size:13px;color:var(--fg1);font-weight:400;"></span></div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
              <input class="search-input" id="findingsSearch" placeholder="Search findings&#x2026;" title="Search by title, file, description, snippet">
              <select id="findingsFilter" style="background:var(--bg1);color:var(--fg0);border:1px solid var(--border);padding:4px 8px;border-radius:var(--radius-sm);font-size:12px;">
                <option value="all">All Categories</option>
                <option value="ai-generated">AI Generated</option>
                <option value="vulnerability">Vulnerabilities</option>
                <option value="malicious">Malicious</option>
                <option value="policy-violation">Policy</option>
                <option value="secret-exposure">Secrets</option>
              </select>
              <select id="severityFilter" style="background:var(--bg1);color:var(--fg0);border:1px solid var(--border);padding:4px 8px;border-radius:var(--radius-sm);font-size:12px;">
                <option value="all">All Severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <button class="fp-toggle" id="fpToggle" title="Show/hide false positives">&#x2691; FP: <span id="fpCount">0</span></button>
            </div>
          </div>
          <div id="findingsList"></div>
        </div>
      </div>

      <div class="tab-panel" id="tab-files">
        <div id="filesEmpty" class="empty-state">
          <div class="empty-icon">&#x1F4C1;</div>
          <div class="empty-title">No Files Analyzed</div>
          <div class="empty-desc">Run a project scan to see per-file AI detection scores and findings.</div>
        </div>
        <div id="filesContent" style="display:none;">
          <div class="section-header">
            <div class="section-title">File Analysis</div>
            <div style="font-size:12px;color:var(--fg1);">Click a file to see detailed analysis</div>
          </div>
          <div id="fileTable"></div>
          <div id="fileDetailPanel" style="display:none;"></div>
        </div>
      </div>

      <div class="tab-panel" id="tab-shell">
        <div class="section-header">
          <div>
            <div class="section-title">Shell Command Analyzer</div>
            <div class="section-subtitle">Analyze shell commands for security risks and get safer alternatives</div>
          </div>
        </div>
        <div class="shell-input-row">
          <input class="shell-input" id="shellInput" placeholder="Enter shell command to analyze...">
          <button class="scan-btn primary" style="width:120px;margin:0;" id="btnShellAnalyze">&#x1F50D; Analyze</button>
        </div>
        <div id="shellResult" style="display:none;"></div>
        <div class="section-header" style="margin-top:24px;"><div class="section-title">Common Risky Patterns</div></div>
        <div class="policy-grid" id="shellExamples"></div>
      </div>

      <div class="tab-panel" id="tab-policies">
        <div class="section-header">
          <div class="section-title">Policy Evaluation</div>
          <div class="section-subtitle">Compliance rules applied during code analysis</div>
        </div>
        <div id="policySummary"></div>
        <div id="policyGrid" class="policy-grid"></div>
      </div>

      <div class="tab-panel" id="tab-settings">
        <div class="section-header"><div class="section-title">Detection Settings</div></div>
        <div class="detail-panel" style="margin-top:0;margin-bottom:16px;">
          <div class="threshold-row" style="background:transparent;border:none;padding:0;margin-bottom:12px;">
            <div class="threshold-label">AI Detection Threshold</div>
            <input type="range" min="0" max="100" value="65" id="thresholdSlider">
            <div class="threshold-value" id="thresholdDisplay">0.65</div>
          </div>
          <div style="font-size:12px;color:var(--fg1);">Files scoring above this threshold are flagged as AI-generated. Higher = stricter detection.</div>
        </div>
        <div class="section-header"><div class="section-title">AI Providers</div></div>
        <div id="providersGrid"></div>
        <div class="section-header" style="margin-top:20px;"><div class="section-title">About</div></div>
        <div class="detail-panel" style="margin-top:0;">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
            <span style="font-size:32px;">&#x1F50D;</span>
            <div>
              <div style="font-size:16px;font-weight:700;">manan-kanchu AI Code Detector</div>
              <div style="font-size:12px;color:var(--fg1);">v1.0.0 &#x2014; MIT License</div>
            </div>
          </div>
          <div style="font-size:12px;color:var(--fg1);line-height:1.7;">
            <p><strong style="color:var(--fg0);">manan-kanchu</strong> (mah-nan-KAHN-chu) is Quechua for <em>there isn't</em> &#x2014; detecting what doesn't belong.</p>
            <br>
            <p style="color:var(--fg0);font-weight:600;margin-bottom:4px;">What makes it different:</p>
            <p>&#x2022; <strong style="color:var(--fg0);">Explainable scores</strong> &#x2014; 7 independent signals combined with AI semantic analysis.</p>
            <p style="margin-top:4px;">&#x2022; <strong style="color:var(--fg0);">100% offline</strong> &#x2014; Ollama and LM Studio keep your code on-device.</p>
            <p style="margin-top:4px;">&#x2022; <strong style="color:var(--fg0);">One panel</strong> &#x2014; AI authorship, OWASP scanning, malicious code, policy compliance, and shell analysis.</p>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="notification" id="notification"></div>

  <div class="modal-overlay" id="fileBrowserModal" style="display:none;">
    <div class="modal-box">
      <div class="modal-header">
        <div class="modal-title">&#x1F4C2; Browse Workspace Files</div>
        <button class="modal-close" id="fileBrowserClose">&#x2715;</button>
      </div>
      <div class="modal-search-wrap">
        <input class="modal-search-input" id="fileSearchInput" placeholder="&#x1F50D; Filter by name or path&#x2026;" autocomplete="off" spellcheck="false">
      </div>
      <div class="modal-stats" id="fileListStats"></div>
      <div class="modal-file-list" id="modalFileList">
        <div class="modal-empty">Loading workspace files&#x2026;</div>
      </div>
      <div class="region-selector" id="regionSelector" style="display:none;">
        <div class="region-title">Selected: <strong id="regionFilePath"></strong></div>
        <div class="region-meta" id="regionMeta">&#x2014;</div>
        <div class="region-controls">
          <div class="region-input-group">
            <label>From line</label>
            <input type="number" class="region-input" id="regionStart" min="1" value="1">
          </div>
          <span style="color:var(--fg2);">&#x2013;</span>
          <div class="region-input-group">
            <label>To line</label>
            <input type="number" class="region-input" id="regionEnd" min="1" value="50">
          </div>
          <button class="select-all-btn" id="btnSelectAll">All lines</button>
        </div>
        <div class="region-preview-box" id="regionPreviewBox"></div>
        <div class="region-actions">
          <button class="scan-btn primary" id="btnScanRegion" style="width:auto;margin:0;">&#x1F50D; Analyze Region</button>
          <button class="scan-btn secondary" id="btnScanFullFile" style="width:auto;margin:0;">&#x1F4C4; Analyze Full File</button>
        </div>
      </div>
    </div>
  </div>
`;
}
