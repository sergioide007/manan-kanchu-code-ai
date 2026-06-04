export function buildScript(): string {
  // NOTE: Regex literals like /</g inside embedded HTML scripts can cause
  // "Invalid regular expression: missing /" errors in some webview parsers.
  // We use split/join throughout to avoid all regex literals in this output.
  return `(function() {
  'use strict';
  var vscode = acquireVsCodeApi();

  var S = {
    tab: 'dashboard',
    summary: null,
    fileResult: null,
    allFindings: [],
    scanBusy: false,
    threshold: 0.65,
    provider: null,
    falsePositives: new Set(),
    sanitizedResults: {},
    fixedFindings: new Set(),
    showFalsePositives: false,
    workspaceFiles: [],
    selectedFile: null,
    filePreviewLines: [],
    filePreviewTotal: 0
  };

  function esc(str) {
    if (!str) return '';
    return String(str)
      .split('&').join('&amp;')
      .split('<').join('&lt;')
      .split('>').join('&gt;')
      .split('"').join('&quot;')
      .split("'").join('&#39;');
  }

  function slugify(str) {
    return String(str || '').split('-').join('');
  }

  function deslug(str) {
    return String(str || '').split('-').join(' ');
  }

  document.querySelectorAll('.tab').forEach(function(t) {
    t.addEventListener('click', function() {
      switchTab(t.dataset.tab);
    });
  });

  window.addEventListener('message', function(e) {
    var msg = e.data;
    switch (msg.type) {
      case 'provider-info': onProviderInfo(msg.provider); break;
      case 'scan-started': onScanStarted(msg.target); break;
      case 'scan-file-result': onFileScanResult(msg.result); break;
      case 'scan-project-result': onProjectScanResult(msg.summary); break;
      case 'scan-error': onScanError(msg.message); break;
      case 'scan-busy': showNotif('Scan already in progress...', 'error'); break;
      case 'shell-result': renderShellResult(msg.analysis); break;
      case 'report-ready': showNotif('Report generated! Opening...', 'success'); break;
      case 'report-error': showNotif(msg.message, 'error'); break;
      case 'sanitize-result': onSanitizeResult(msg.result); break;
      case 'sanitize-error': showNotif(msg.message, 'error'); break;
      case 'fix-applied': onFixApplied(msg.findingId, msg.filePath); break;
      case 'fix-error': showNotif('Apply failed: ' + msg.message, 'error'); break;
      case 'findings-cleared': onFindingsCleared(); break;
      case 'threshold-updated': S.threshold = msg.value; break;
      case 'scan-history': onScanHistory(msg.summary, msg.fileResult); break;
      case 'workspace-files': onWorkspaceFiles(msg.files); break;
      case 'file-preview': onFilePreview(msg.filePath, msg.lines, msg.total); break;
      case 'file-preview-error': showNotif(msg.message, 'error'); break;
    }
  });

  function post(type, extra) {
    vscode.postMessage(Object.assign({ type: type }, extra || {}));
  }

  function onProviderInfo(provider) {
    S.provider = provider;
    var badge = document.getElementById('providerBadge');
    if (provider) {
      badge.textContent = String.fromCodePoint(0x26A1) + ' ' + provider.name;
      badge.style.borderColor = 'var(--green)';
      badge.style.color = 'var(--green)';
    } else {
      badge.textContent = String.fromCodePoint(0x26A1) + ' No provider';
      badge.style.borderColor = 'var(--border)';
      badge.style.color = 'var(--fg1)';
    }
    renderProvidersGrid(provider);
  }

  function onScanStarted(target) {
    S.scanBusy = true;
    document.getElementById('scanProgress').style.display = 'block';
    document.getElementById('btnScanProject').disabled = true;
    document.getElementById('scanProgressText').textContent = target === 'project' ? 'Scanning project files...' : 'Analyzing file...';
    document.getElementById('scoreCircle').classList.add('scanning');
    var progress = 0;
    var timer = setInterval(function() {
      progress = Math.min(progress + Math.random() * 5, 90);
      document.getElementById('progressFill').style.width = progress + '%';
      if (!S.scanBusy) { clearInterval(timer); document.getElementById('progressFill').style.width = '100%'; }
    }, 200);
  }

  function onFileScanResult(result) {
    S.scanBusy = false;
    S.fileResult = result;
    S.allFindings = result.findings;
    hideScanProgress();
    updateScoreCircle(result.aiScore);
    renderFileDetail(result);
    renderFindingsList();
    switchTab('findings');
    showNotif('File analysis complete', 'success');
  }

  function onProjectScanResult(summary) {
    S.scanBusy = false;
    S.summary = summary;
    S.allFindings = summary.fileResults.flatMap(function(r) { return r.findings; });
    hideScanProgress();
    updateScoreCircle(summary.averageAiScore);
    renderDashboard(summary);
    renderFilesTab(summary.fileResults);
    renderFindingsList();
    renderPoliciesTab(summary);
    renderSidebarFiles(summary.fileResults);
    switchTab('dashboard');
    showNotif('Project scan complete: ' + summary.filesScanned + ' files analyzed', 'success');
  }

  function onScanError(message) {
    S.scanBusy = false;
    hideScanProgress();
    showNotif(message || 'Scan failed', 'error');
  }

  function onFindingsCleared() {
    S.summary = null; S.fileResult = null; S.allFindings = [];
    S.falsePositives.clear(); S.sanitizedResults = {}; S.fixedFindings.clear(); S.showFalsePositives = false;
    document.getElementById('dashboardEmpty').style.display = 'flex';
    document.getElementById('dashboardResults').style.display = 'none';
    document.getElementById('findingsEmpty').style.display = 'flex';
    document.getElementById('findingsContent').style.display = 'none';
    showNotif('Findings cleared', 'success');
  }

  function onScanHistory(summary, fileResult) {
    if (summary) onProjectScanResult(summary);
    else if (fileResult) onFileScanResult(fileResult);
  }

  function onSanitizeResult(result) {
    var sanitizedCode = result.sanitizedCode;
    var originalFinding = result.originalFinding;
    S.sanitizedResults[originalFinding.id] = { before: originalFinding.snippet, after: sanitizedCode };
    renderFindingsList();
    showNotif('Fix ready - review the Before/After diff below', 'success');
  }

  function onFixApplied(findingId, filePath) {
    S.fixedFindings.add(findingId);
    renderFindingsList();
    var fileName = (filePath || '').split('\\\\').pop().split('/').pop() || filePath;
    showNotif('Fix applied - ' + fileName + ' saved', 'success');
  }

  function renderDashboard(summary) {
    document.getElementById('dashboardEmpty').style.display = 'none';
    document.getElementById('dashboardResults').style.display = 'block';
    document.getElementById('dashSubtitle').textContent =
      summary.filesScanned + ' files ' + (summary.scanDurationMs / 1000).toFixed(1) + 's ' + new Date(summary.completedAt).toLocaleTimeString();
    document.getElementById('statTotal').textContent = summary.totalFindings;
    document.getElementById('statAI').textContent = (summary.averageAiScore * 100).toFixed(0) + '%';
    document.getElementById('statCritical').textContent = summary.criticalCount;
    document.getElementById('statHigh').textContent = summary.highCount;
    document.getElementById('statMedium').textContent = summary.mediumCount;
    document.getElementById('statFiles').textContent = summary.filesScanned;

    var cats = {};
    summary.fileResults.flatMap(function(r) { return r.findings; }).forEach(function(f) {
      cats[f.category] = (cats[f.category] || 0) + 1;
    });
    var maxCat = Math.max.apply(null, Object.values(cats).concat([1]));
    document.getElementById('categoryChart').innerHTML = Object.entries(cats).map(function(entry) {
      var cat = entry[0], count = entry[1];
      return '<div class="chart-row"><div class="chart-label">' + deslug(cat) + '</div>' +
        '<div class="chart-bar"><div class="chart-fill" style="width:' + (count / maxCat * 100) + '%;background:var(--accent);"></div></div>' +
        '<div class="chart-count">' + count + '</div></div>';
    }).join('');

    var sevs = [
      { label: 'Critical', key: 'criticalCount', color: 'var(--critical)' },
      { label: 'High', key: 'highCount', color: 'var(--high)' },
      { label: 'Medium', key: 'mediumCount', color: 'var(--medium)' },
      { label: 'Low', key: 'lowCount', color: 'var(--low)' }
    ];
    var maxSev = Math.max.apply(null, sevs.map(function(s) { return summary[s.key]; }).concat([1]));
    document.getElementById('severityChart').innerHTML = sevs.map(function(s) {
      return '<div class="chart-row"><div class="chart-label">' + s.label + '</div>' +
        '<div class="chart-bar"><div class="chart-fill" style="width:' + (summary[s.key] / maxSev * 100) + '%;background:' + s.color + ';"></div></div>' +
        '<div class="chart-count">' + summary[s.key] + '</div></div>';
    }).join('');

    document.getElementById('topFindings').innerHTML = summary.topFindings.slice(0, 5).map(renderFindingCard).join('');
  }

  function renderFindingCard(f) {
    var isFP = S.falsePositives.has(f.id);
    var fpClass = isFP ? ' fp-marked' : '';

    var evidenceHtml = '';
    if (f.category === 'ai-generated' && f.indicators && f.indicators.length) {
      var rows = f.indicators.map(function(ind) {
        var scoreColor = ind.score > 0.7 ? 'var(--red)' : ind.score > 0.4 ? 'var(--yellow)' : 'var(--green)';
        return '<div class="indicator-row">' +
          '<div class="indicator-name" style="min-width:130px;">' + esc(deslug(ind.type)) + '</div>' +
          '<div class="indicator-bar"><div class="indicator-fill" style="width:' + (ind.score * 100).toFixed(0) + '%;background:' + scoreColor + ';"></div></div>' +
          '<div class="indicator-score">' + (ind.score * 100).toFixed(0) + '%</div>' +
          '<div style="flex:2;font-size:11px;color:var(--fg2);padding-left:8px;overflow:hidden;">' + esc(ind.description) + '</div>' +
          '</div>';
      }).join('');
      evidenceHtml =
        '<div class="evidence-panel" id="ev-' + f.id + '">' +
        '<div class="evidence-title">&#x1F52C; AI Detection Evidence</div>' +
        (f.aiReason ? '<div class="evidence-reason">' + esc(f.aiReason) + '</div>' : '') +
        '<div class="indicators-list" style="margin-bottom:0;">' + rows + '</div>' +
        '</div>';
    }

    var diff = S.sanitizedResults[f.id];
    var isApplied = S.fixedFindings.has(f.id);
    var diffHtml = diff
      ? '<div class="sanitized-diff">' +
          '<div style="font-size:11px;font-weight:600;color:var(--fg1);margin:8px 0 6px;">&#x2728; Suggested Fix</div>' +
          '<div class="diff-view">' +
            '<div class="diff-section diff-before"><div class="diff-label">Before</div><pre class="diff-code">' + esc(diff.before) + '</pre></div>' +
            '<div class="diff-section diff-after">' +
              '<div class="diff-label" style="display:flex;align-items:center;justify-content:space-between;">' +
                '<span>After</span>' +
                (isApplied
                  ? '<span class="apply-fix-btn applied">&#x2713; Applied</span>'
                  : '<button class="apply-fix-btn" data-action="apply-fix"' +
                    ' data-finding-id="' + f.id + '"' +
                    ' data-filepath="' + esc(f.filePath) + '"' +
                    ' data-start-line="' + f.startLine + '"' +
                    ' data-end-line="' + f.endLine + '">Apply</button>') +
              '</div>' +
              '<pre class="diff-code">' + esc(diff.after) + '</pre>' +
            '</div>' +
          '</div>' +
        '</div>'
      : '';

    var catSlug = slugify(f.category);
    return '<div class="finding-card ' + f.severity + fpClass + '" data-finding-id="' + f.id + '">' +
      '<div class="finding-header">' +
        '<span class="badge ' + catSlug + '">' + deslug(f.category) + '</span>' +
        '<span class="finding-title">' + esc(f.title) + '</span>' +
        '<span class="badge ' + f.severity + '">' + f.severity + '</span>' +
        (isFP ? '<span class="badge medium" style="opacity:0.8;font-size:10px;">FP</span>' : '') +
      '</div>' +
      '<div class="finding-meta">' +
        '<span>&#x1F4C4; ' + esc((f.filePath || '').split('\\\\').pop().split('/').pop() || f.filePath) + ':' + f.startLine + '</span>' +
        '<span>&#x1F3AF; ' + (f.confidence * 100).toFixed(0) + '% confidence</span>' +
        (f.cveId ? '<span>&#x1F3F7;&#xFE0F; ' + esc(f.cveId) + '</span>' : '') +
      '</div>' +
      '<div class="snippet-wrap">' +
        '<div class="finding-snippet">' + esc(f.snippet) + '</div>' +
        '<button class="copy-btn" data-action="copy-snippet" data-snippet="' + esc(f.snippet) + '">Copy</button>' +
      '</div>' +
      (f.recommendation ? '<div class="finding-rec">&#x1F4A1; ' + esc(f.recommendation) + '</div>' : '') +
      evidenceHtml +
      diffHtml +
      '<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">' +
        '<button class="sanitize-btn" data-action="sanitize" data-finding-id="' + f.id + '">&#x2728; Auto-fix</button>' +
        (f.category === 'ai-generated' && f.indicators && f.indicators.length
          ? '<button class="evidence-btn" data-action="toggle-evidence" data-finding-id="' + f.id + '">&#x1F52C; Evidence</button>'
          : '') +
        '<button class="fp-btn' + (isFP ? ' marked' : '') + '" data-action="mark-fp" data-finding-id="' + f.id + '">' +
          (isFP ? '&#x2713; Marked FP' : '&#x2691; False Positive') + '</button>' +
      '</div>' +
    '</div>';
  }

  function renderFindingsList() {
    var catFilter = (document.getElementById('findingsFilter') || {}).value || 'all';
    var sevFilter = (document.getElementById('severityFilter') || {}).value || 'all';
    var search = ((document.getElementById('findingsSearch') || {}).value || '').toLowerCase().trim();
    var fpCount = S.falsePositives.size;
    var fpCountEl = document.getElementById('fpCount');
    if (fpCountEl) fpCountEl.textContent = fpCount;
    var fpToggleEl = document.getElementById('fpToggle');
    if (fpToggleEl) fpToggleEl.classList.toggle('active', S.showFalsePositives);

    if (!S.allFindings.length) {
      document.getElementById('findingsEmpty').style.display = 'flex';
      document.getElementById('findingsContent').style.display = 'none';
      return;
    }

    var filtered = S.allFindings.filter(function(f) {
      if (!S.showFalsePositives && S.falsePositives.has(f.id)) return false;
      if (catFilter !== 'all' && f.category !== catFilter) return false;
      if (sevFilter !== 'all' && f.severity !== sevFilter) return false;
      if (search) {
        var hay = ((f.title || '') + ' ' + (f.description || '') + ' ' + (f.filePath || '') + ' ' + (f.recommendation || '') + ' ' + (f.snippet || '')).toLowerCase();
        if (hay.indexOf(search) === -1) return false;
      }
      return true;
    });

    document.getElementById('findingsEmpty').style.display = 'none';
    document.getElementById('findingsContent').style.display = 'block';
    var visibleTotal = S.allFindings.length - (S.showFalsePositives ? 0 : fpCount);
    var fpNote = fpCount > 0 && !S.showFalsePositives ? ', ' + fpCount + ' FP hidden' : '';
    document.getElementById('findingsCount').textContent = '(' + filtered.length + ' of ' + visibleTotal + fpNote + ')';
    document.getElementById('findingsList').innerHTML = filtered.map(renderFindingCard).join('');
  }

  function renderFilesTab(fileResults) {
    if (!fileResults || !fileResults.length) return;
    document.getElementById('filesEmpty').style.display = 'none';
    document.getElementById('filesContent').style.display = 'block';

    var sorted = fileResults.slice().sort(function(a, b) { return b.aiScore - a.aiScore; });
    document.getElementById('fileTable').innerHTML = '<div class="file-list">' +
      sorted.map(function(f) {
        var score = (f.aiScore * 100).toFixed(0);
        var scoreColor = f.aiScore > 0.8 ? 'var(--critical)' : f.aiScore > 0.65 ? 'var(--high)' : f.aiScore > 0.4 ? 'var(--medium)' : 'var(--green)';
        return '<div class="file-item" data-action="file-detail" data-filepath="' + esc(f.filePath) + '">' +
          '<span style="font-size:14px;">' + langIcon(f.language) + '</span>' +
          '<span class="file-name">' + esc(f.filePath) + '</span>' +
          '<div class="ai-score-bar" style="width:100px;">' +
            '<div class="ai-score-track"><div class="ai-score-fill" style="width:' + score + '%;"></div></div>' +
          '</div>' +
          '<span class="file-score" style="color:' + scoreColor + '">' + score + '%</span>' +
          '<span class="badge ' + f.severity + '">' + f.severity + '</span>' +
        '</div>';
      }).join('') + '</div>';
  }

  function renderFileDetailHtml(r) {
    var nameParts = (r.filePath || '').split('\\\\').pop().split('/');
    var name = nameParts[nameParts.length - 1] || r.filePath;
    return '<div class="detail-panel">' +
      '<div class="detail-header">' +
        '<div class="score-circle ' + scoreClass(r.aiScore) + '">' +
          '<div style="font-size:18px;">' + (r.aiScore * 100).toFixed(0) + '</div>' +
          '<div style="font-size:10px;">AI%</div>' +
        '</div>' +
        '<div class="detail-info">' +
          '<div class="detail-title">' + esc(name) + '</div>' +
          '<div class="detail-path">' + esc(r.filePath) + '</div>' +
          '<div style="margin-top:4px;"><span class="badge">' + esc(r.language) + '</span></div>' +
        '</div>' +
      '</div>' +
      '<div class="metrics-row">' +
        metric(r.linesOfCode, 'Lines') +
        metric(r.vulnerabilities, 'Vulns') +
        metric(r.policyViolations, 'Violations') +
        metric(r.findings.length, 'Total') +
      '</div>' +
      (r.findings.length
        ? '<div>' + r.findings.slice(0, 5).map(renderFindingCard).join('') + '</div>'
        : '<div style="color:var(--green);font-size:13px;">&#x2705; No findings in this file</div>') +
    '</div>';
  }

  function metric(val, label) {
    return '<div class="metric"><div class="metric-val">' + val + '</div><div class="metric-label">' + label + '</div></div>';
  }

  function renderFileDetail(result) {
    document.getElementById('filesEmpty').style.display = 'none';
    document.getElementById('filesContent').style.display = 'block';
    document.getElementById('fileDetailPanel').style.display = 'block';
    document.getElementById('fileDetailPanel').innerHTML = renderFileDetailHtml(result);
  }

  function renderSidebarFiles(fileResults) {
    if (!fileResults || !fileResults.length) return;
    var sorted = fileResults.slice().sort(function(a, b) { return b.aiScore - a.aiScore; }).slice(0, 20);
    document.getElementById('fileListSidebar').innerHTML = sorted.map(function(f) {
      var score = (f.aiScore * 100).toFixed(0);
      var color = f.aiScore > 0.65 ? 'var(--red)' : 'var(--green)';
      var parts = (f.filePath || '').split('\\\\').pop().split('/');
      var name = parts[parts.length - 1] || f.filePath;
      return '<div style="display:flex;align-items:center;gap:6px;padding:4px 2px;cursor:pointer;font-size:11px;" data-action="file-detail" data-filepath="' + esc(f.filePath) + '">' +
        '<span style="font-family:var(--mono);color:' + color + ';min-width:30px;text-align:right;">' + score + '%</span>' +
        '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--fg1);">' + esc(name) + '</span>' +
      '</div>';
    }).join('');
  }

  function renderShellResult(analysis) {
    var colorMap = { critical: 'var(--critical)', high: 'var(--high)', medium: 'var(--medium)', low: 'var(--low)', info: 'var(--info)' };
    var color = colorMap[analysis.riskLevel] || 'var(--fg1)';
    var el = document.getElementById('shellResult');
    el.style.display = 'block';
    el.innerHTML = '<div class="shell-result">' +
      '<div class="shell-risk"><span style="color:' + color + ';font-size:18px;">&#x26A0;</span><span style="color:' + color + ';text-transform:uppercase;">' + analysis.riskLevel + ' Risk</span></div>' +
      '<div class="shell-issues">' + (analysis.issues.length
        ? analysis.issues.map(function(i) {
            return '<div class="shell-issue"><strong>' + esc(deslug(i.type)) + '</strong>: ' + esc(i.description) + '</div>';
          }).join('')
        : '<div class="shell-issue" style="color:var(--green);">&#x2705; No issues detected</div>') +
      '</div>' +
      (analysis.suggestion ? '<div class="shell-suggestion">&#x1F4A1; ' + esc(analysis.suggestion) + '</div>' : '') +
      (analysis.saferAlternative ? '<div class="shell-alt">$ ' + esc(analysis.saferAlternative) + '</div>' : '') +
    '</div>';
  }

  function renderPoliciesTab(summary) {
    var policies = [
      { id: 'no-hardcoded-secrets', name: 'No Hardcoded Secrets', desc: 'API keys and passwords not in source' },
      { id: 'no-eval', name: 'No eval() Usage', desc: 'Dynamic code execution forbidden' },
      { id: 'no-innerHTML', name: 'Safe innerHTML', desc: 'No direct innerHTML assignment' },
      { id: 'license-compliance', name: 'License Headers', desc: 'SPDX identifiers in source files' },
      { id: 'no-weak-crypto', name: 'No Weak Crypto', desc: 'MD5/SHA1 forbidden' },
      { id: 'gdpr-personal-data-logging', name: 'GDPR Logging', desc: 'No PII in log statements' }
    ];

    var violatedRules = new Set(
      summary.fileResults.flatMap(function(r) { return r.findings; })
        .filter(function(f) { return f.category === 'policy-violation'; })
        .map(function(f) { return f.policyRule; })
    );

    document.getElementById('policyGrid').innerHTML = policies.map(function(p) {
      var pass = !violatedRules.has(p.id);
      return '<div class="policy-card ' + (pass ? 'pass' : 'fail') + '">' +
        '<div class="policy-status">' + (pass ? '&#x2705;' : '&#x274C;') + '</div>' +
        '<div><div class="policy-name">' + p.name + '</div><div class="policy-desc">' + p.desc + '</div></div>' +
      '</div>';
    }).join('');

    var passing = policies.filter(function(p) { return !violatedRules.has(p.id); }).length;
    var pct = Math.round(passing / policies.length * 100);
    document.getElementById('policySummary').innerHTML =
      '<div class="detail-panel" style="margin-top:0;margin-bottom:16px;display:flex;align-items:center;gap:16px;">' +
        '<div class="score-circle ' + (pct >= 80 ? 'low' : pct >= 50 ? 'medium' : 'critical') + '">' +
          '<div style="font-size:20px;">' + pct + '</div><div style="font-size:10px;">% Pass</div>' +
        '</div>' +
        '<div><div style="font-size:16px;font-weight:700;">' + passing + '/' + policies.length + ' policies passing</div>' +
        '<div style="font-size:12px;color:var(--fg1);margin-top:4px;">' +
          (pct === 100 ? 'All policies satisfied &#x2705;' : (policies.length - passing) + ' violations found across project') +
        '</div></div>' +
      '</div>';
  }

  function renderProvidersGrid(activeProvider) {
    var providers = [
      { name: 'Anthropic Claude', icon: '&#x1F7E3;', local: false },
      { name: 'OpenAI GPT', icon: '&#x1F7E2;', local: false },
      { name: 'Google Gemini', icon: '&#x1F535;', local: false },
      { name: 'Ollama (Local)', icon: '&#x1F7E1;', local: true },
      { name: 'LM Studio (Local)', icon: '&#x1F7E0;', local: true }
    ];
    var el = document.getElementById('providersGrid');
    if (!el) return;
    el.innerHTML = '<div class="policy-grid">' + providers.map(function(p) {
      var active = activeProvider && activeProvider.name === p.name;
      return '<div class="policy-card ' + (active ? 'pass' : '') + '" style="cursor:pointer;" data-action="configure-provider">' +
        '<div class="policy-status">' + p.icon + '</div>' +
        '<div><div class="policy-name">' + p.name + '</div><div class="policy-desc">' + (p.local ? 'Local model' : 'Cloud API') + '</div></div>' +
        (active ? '<span class="badge low">Active</span>' : '') +
      '</div>';
    }).join('') + '</div>';
  }

  function hideScanProgress() {
    S.scanBusy = false;
    document.getElementById('scanProgress').style.display = 'none';
    document.getElementById('btnScanProject').disabled = false;
    document.getElementById('scoreCircle').classList.remove('scanning');
  }

  function updateScoreCircle(score) {
    var pct = (score * 100).toFixed(0);
    var circle = document.getElementById('scoreCircle');
    circle.className = 'score-circle ' + scoreClass(score);
    document.getElementById('scoreVal').textContent = pct + '%';
    document.getElementById('scoreLabel').textContent =
      score > 0.8 ? '&#x1F534; High AI probability' :
      score > 0.65 ? '&#x1F7E0; Likely AI-generated' :
      score > 0.4 ? '&#x1F7E1; Possibly AI-assisted' : '&#x1F7E2; Likely human-written';
  }

  function scoreClass(score) {
    if (score > 0.8) return 'critical';
    if (score > 0.65) return 'high';
    if (score > 0.4) return 'medium';
    return 'low';
  }

  function langIcon(lang) {
    var icons = { TypeScript: '&#x1F537;', JavaScript: '&#x1F7E8;', Python: '&#x1F40D;', Java: '&#x2615;', Go: '&#x1F439;', Rust: '&#x1F980;', Ruby: '&#x1F48E;', HTML: '&#x1F310;', CSS: '&#x1F3A8;', Shell: '&#x2699;&#xFE0F;', SQL: '&#x1F5C4;&#xFE0F;' };
    return icons[lang] || '&#x1F4C4;';
  }

  function extIcon(ext) {
    var m = { ts: '&#x1F537;', tsx: '&#x1F537;', js: '&#x1F7E8;', jsx: '&#x1F7E8;', py: '&#x1F40D;', java: '&#x2615;', go: '&#x1F439;', rs: '&#x1F980;', rb: '&#x1F48E;', html: '&#x1F310;', css: '&#x1F3A8;', sh: '&#x2699;&#xFE0F;', sql: '&#x1F5C4;&#xFE0F;' };
    return m[ext] || '&#x1F4C4;';
  }

  function switchTab(tab) {
    S.tab = tab;
    document.querySelectorAll('.tab').forEach(function(x) { x.classList.toggle('active', x.dataset.tab === tab); });
    document.querySelectorAll('.tab-panel').forEach(function(x) { x.classList.toggle('active', x.id === 'tab-' + tab); });
  }

  var notifTimer;
  function showNotif(msg, type) {
    var el = document.getElementById('notification');
    el.textContent = msg;
    el.className = 'notification show ' + (type || '');
    clearTimeout(notifTimer);
    notifTimer = setTimeout(function() { el.classList.remove('show'); }, 3000);
  }

  function on(id, evt, fn) {
    var el = document.getElementById(id);
    if (el) el.addEventListener(evt, fn);
  }

  on('providerBadge',       'click',  function() { post('configure-provider'); });
  on('btnHeaderScanFile',   'click',  function() { post('scan-file'); });
  on('btnHeaderExport',     'click',  function() { post('export-report'); });
  on('btnHeaderSettings',   'click',  function() { post('configure-provider'); });
  on('btnScanProject',      'click',  function() { post('scan-project'); });
  on('btnScanFile',         'click',  function() { post('scan-file'); });
  on('btnScanSelection',    'click',  function() { post('scan-selection'); });
  on('btnBrowseFiles',      'click',  openFileBrowser);
  on('fileBrowserClose',    'click',  closeFileBrowser);
  on('btnScanRegion',       'click',  scanRegion);
  on('btnScanFullFile',     'click',  scanFullFile);
  on('regionStart',         'input',  updateRegionPreview);
  on('regionEnd',           'input',  updateRegionPreview);
  on('btnSelectAll', 'click', function() {
    if (!S.filePreviewTotal) return;
    document.getElementById('regionStart').value = 1;
    document.getElementById('regionEnd').value = S.filePreviewTotal;
    updateRegionPreview();
  });
  on('fileSearchInput', 'input', function(e) {
    var q = e.target.value.trim().toLowerCase();
    renderModalFileList(q ? S.workspaceFiles.filter(function(f) { return f.relativePath.toLowerCase().indexOf(q) !== -1; }) : S.workspaceFiles);
  });
  on('btnShellAnalyze', 'click', analyzeShell);
  on('shellInput', 'keydown', function(e) { if (e.key === 'Enter') analyzeShell(); });
  on('findingsSearch',   'input',  renderFindingsList);
  on('findingsFilter',   'change', renderFindingsList);
  on('severityFilter',   'change', renderFindingsList);
  on('fpToggle', 'click', function() { S.showFalsePositives = !S.showFalsePositives; renderFindingsList(); });
  on('thresholdSlider', 'input', function(e) {
    var v = Number(e.target.value) / 100;
    document.getElementById('thresholdDisplay').textContent = v.toFixed(2);
    S.threshold = v;
    post('update-threshold', { value: v });
  });
  on('btnGenerateReport', 'click', function() { post('generate-report', { format: 'markdown' }); });
  on('btnDashboardStartScan', 'click', function() { post('scan-project'); });

  var modalOverlay = document.getElementById('fileBrowserModal');
  if (modalOverlay) {
    modalOverlay.addEventListener('click', function(e) { if (e.target === modalOverlay) closeFileBrowser(); });
  }
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeFileBrowser(); });

  document.addEventListener('click', function(e) {
    var target = e.target.closest('[data-action]');
    if (!target) return;
    var action = target.dataset.action;
    if (action === 'sanitize') {
      var f = S.allFindings.find(function(x) { return x.id === target.dataset.findingId; });
      if (f) post('sanitize-finding', { finding: f, code: '' });
    } else if (action === 'apply-fix') {
      var diff = S.sanitizedResults[target.dataset.findingId];
      if (!diff) return;
      post('apply-fix', {
        findingId: target.dataset.findingId,
        filePath: target.dataset.filepath,
        startLine: parseInt(target.dataset.startLine, 10),
        endLine: parseInt(target.dataset.endLine, 10),
        fixedCode: diff.after
      });
    } else if (action === 'mark-fp') {
      var id = target.dataset.findingId;
      if (S.falsePositives.has(id)) { S.falsePositives.delete(id); showNotif('False positive unmarked', 'success'); }
      else { S.falsePositives.add(id); showNotif('Marked as false positive', 'success'); }
      renderFindingsList();
    } else if (action === 'toggle-evidence') {
      var panel = document.getElementById('ev-' + target.dataset.findingId);
      if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    } else if (action === 'pick-file') {
      pickFile(target.dataset.path, target.dataset.relpath, target.dataset.name, target.dataset.ext);
    } else if (action === 'copy-snippet') {
      var btn = target;
      navigator.clipboard.writeText(target.dataset.snippet || '').then(function() {
        btn.textContent = '&#x2713;'; btn.classList.add('copied');
        setTimeout(function() { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 1500);
      }).catch(function() {});
    } else if (action === 'file-detail') {
      var data = S.summary && S.summary.fileResults && S.summary.fileResults.find(function(r) { return r.filePath === target.dataset.filepath; });
      if (data) {
        document.getElementById('fileDetailPanel').style.display = 'block';
        document.getElementById('fileDetailPanel').innerHTML = renderFileDetailHtml(data);
      }
    } else if (action === 'shell-example') {
      var inp = document.getElementById('shellInput');
      if (inp) inp.value = target.dataset.cmd;
      analyzeShell();
    } else if (action === 'configure-provider') {
      post('configure-provider');
    }
  });

  function analyzeShell() {
    var cmd = document.getElementById('shellInput').value.trim();
    if (!cmd) return;
    post('scan-shell', { command: cmd });
  }

  function openFileBrowser() {
    S.selectedFile = null;
    document.getElementById('regionSelector').style.display = 'none';
    document.getElementById('modalFileList').innerHTML = '<div class="modal-empty">Loading workspace files...</div>';
    document.getElementById('fileSearchInput').value = '';
    document.getElementById('fileBrowserModal').style.display = 'flex';
    post('list-workspace-files', { query: '' });
  }

  function closeFileBrowser() {
    document.getElementById('fileBrowserModal').style.display = 'none';
  }

  function onWorkspaceFiles(files) {
    S.workspaceFiles = files || [];
    renderModalFileList(S.workspaceFiles);
  }

  function renderModalFileList(files) {
    var stats = document.getElementById('fileListStats');
    if (stats) stats.textContent = files.length ? files.length + ' file' + (files.length !== 1 ? 's' : '') + ' - click to select' : '';
    var el = document.getElementById('modalFileList');
    if (!files.length) { el.innerHTML = '<div class="modal-empty">No matching files found</div>'; return; }
    el.innerHTML = files.map(function(f) {
      var isSelected = S.selectedFile && S.selectedFile.path === f.path;
      var lastSlash = Math.max(f.relativePath.lastIndexOf('/'), f.relativePath.lastIndexOf('\\\\'));
      var dir = lastSlash !== -1 ? f.relativePath.substring(0, lastSlash) : '';
      return '<div class="modal-file-item' + (isSelected ? ' selected' : '') + '" data-action="pick-file"' +
        ' data-path="' + esc(f.path) + '" data-relpath="' + esc(f.relativePath) + '"' +
        ' data-name="' + esc(f.name) + '" data-ext="' + esc(f.ext) + '">' +
        '<div class="modal-file-icon">' + extIcon(f.ext) + '</div>' +
        '<div style="flex:1;overflow:hidden;">' +
          '<div class="modal-file-name">' + esc(f.name) + '</div>' +
          (dir ? '<div class="modal-file-path">' + esc(dir) + '</div>' : '') +
        '</div>' +
      '</div>';
    }).join('');
  }

  function pickFile(filePath, relativePath, name, ext) {
    S.selectedFile = { path: filePath, relativePath: relativePath, name: name, ext: ext };
    renderModalFileList(S.workspaceFiles);
    document.getElementById('regionFilePath').textContent = relativePath;
    document.getElementById('regionMeta').textContent = 'Loading...';
    document.getElementById('regionSelector').style.display = 'block';
    document.getElementById('regionPreviewBox').innerHTML =
      '<div style="padding:8px 12px;">' +
        '<div class="skeleton skeleton-line" style="width:80%;"></div>' +
        '<div class="skeleton skeleton-line" style="width:60%;"></div>' +
        '<div class="skeleton skeleton-line" style="width:70%;"></div>' +
      '</div>';
    post('get-file-preview', { filePath: filePath });
  }

  function onFilePreview(filePath, lines, total) {
    if (!S.selectedFile || S.selectedFile.path !== filePath) return;
    S.filePreviewLines = lines || [];
    S.filePreviewTotal = total || 0;
    document.getElementById('regionMeta').textContent = total + ' lines total - specify a range or select all';
    var endEl = document.getElementById('regionEnd');
    endEl.max = total;
    endEl.value = Math.min(50, total);
    document.getElementById('regionStart').max = total;
    updateRegionPreview();
  }

  function updateRegionPreview() {
    if (!S.filePreviewLines.length) return;
    var start = Math.max(1, parseInt(document.getElementById('regionStart').value, 10) || 1);
    var end = Math.min(S.filePreviewTotal, parseInt(document.getElementById('regionEnd').value, 10) || 50);
    var preview = S.filePreviewLines.filter(function(l) {
      return l.n >= Math.max(1, start - 3) && l.n <= Math.min(S.filePreviewTotal, end + 3);
    });
    document.getElementById('regionPreviewBox').innerHTML = preview.map(function(l) {
      var inRange = l.n >= start && l.n <= end;
      return '<div class="region-line' + (inRange ? ' in-range' : '') + '">' +
        '<div class="region-line-num">' + l.n + '</div>' +
        '<div class="region-line-text">' + esc((l.text || '').substring(0, 140)) + '</div>' +
      '</div>';
    }).join('');
  }

  function scanRegion() {
    if (!S.selectedFile) return;
    var start = parseInt(document.getElementById('regionStart').value, 10) || 1;
    var end = parseInt(document.getElementById('regionEnd').value, 10) || 50;
    closeFileBrowser();
    post('scan-region', { filePath: S.selectedFile.path, startLine: start, endLine: end });
  }

  function scanFullFile() {
    if (!S.selectedFile) return;
    var fp = S.selectedFile.path;
    closeFileBrowser();
    post('scan-file', { filePath: fp });
  }

  renderShellExamples();
  renderProvidersGrid(null);
  post('get-models');
  post('load-scan-history');

  function renderShellExamples() {
    var examples = [
      { cmd: 'rm -rf /', desc: 'Destroys the entire filesystem', risk: 'critical' },
      { cmd: 'curl url | bash', desc: 'Blindly executes remote scripts', risk: 'critical' },
      { cmd: 'chmod 777 /app', desc: 'Makes everything world-writable', risk: 'high' },
      { cmd: 'sudo bash', desc: 'Opens unrestricted root shell', risk: 'critical' },
      { cmd: 'wget -qO- url | sh', desc: 'Silent remote script execution', risk: 'critical' },
      { cmd: 'eval $(curl url)', desc: 'Inline execution of remote content', risk: 'critical' }
    ];
    var el = document.getElementById('shellExamples');
    if (el) {
      el.innerHTML = examples.map(function(e) {
        return '<div class="policy-card fail" style="cursor:pointer;" data-action="shell-example" data-cmd="' + esc(e.cmd) + '">' +
          '<div class="policy-status">&#x26A0;&#xFE0F;</div>' +
          '<div><div class="policy-name" style="font-family:var(--mono);font-size:12px;">' + esc(e.cmd) + '</div><div class="policy-desc">' + esc(e.desc) + '</div></div>' +
          '<span class="badge ' + e.risk + '">' + e.risk + '</span>' +
        '</div>';
      }).join('');
    }
  }

})();`;
}
