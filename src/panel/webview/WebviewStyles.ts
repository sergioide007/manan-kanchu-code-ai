export function buildStyles(): string {
  return `
    :root {
      --bg0: #0d1117; --bg1: #161b22; --bg2: #21262d; --bg3: #30363d;
      --fg0: #e6edf3; --fg1: #8b949e; --fg2: #6e7681;
      --accent: #58a6ff; --accent2: #79c0ff;
      --green: #3fb950; --yellow: #d29922; --orange: #f0883e;
      --red: #ff4444; --purple: #bc8cff; --teal: #39d353;
      --critical: #ff4444; --high: #f0883e; --medium: #d29922; --low: #3fb950; --info: #58a6ff;
      --border: #30363d; --radius: 8px; --radius-sm: 4px;
      --font: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      --mono: 'JetBrains Mono', 'Cascadia Code', 'Consolas', monospace;
      --transition: all 0.15s ease;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: var(--font); background: var(--bg0); color: var(--fg0); font-size: 13px; height: 100vh; display: flex; flex-direction: column; overflow: hidden; }

    .header { background: var(--bg1); border-bottom: 1px solid var(--border); padding: 0 16px; display: flex; align-items: center; gap: 12px; height: 48px; flex-shrink: 0; }
    .logo { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 15px; color: var(--fg0); }
    .logo-icon { font-size: 18px; }
    .logo-sub { font-size: 11px; color: var(--fg1); font-weight: 400; }
    .provider-badge { background: var(--bg2); border: 1px solid var(--border); border-radius: 20px; padding: 2px 10px; font-size: 11px; color: var(--fg1); cursor: pointer; transition: var(--transition); }
    .provider-badge:hover { border-color: var(--accent); color: var(--accent); }
    .header-actions { margin-left: auto; display: flex; gap: 8px; }
    .btn-icon { background: var(--bg2); border: 1px solid var(--border); color: var(--fg0); padding: 5px 10px; border-radius: var(--radius-sm); cursor: pointer; font-size: 12px; transition: var(--transition); }
    .btn-icon:hover { background: var(--bg3); border-color: var(--accent); }

    .tabs { background: var(--bg1); border-bottom: 1px solid var(--border); display: flex; padding: 0 16px; flex-shrink: 0; }
    .tab { padding: 10px 16px; cursor: pointer; font-size: 12px; font-weight: 500; color: var(--fg1); border-bottom: 2px solid transparent; transition: var(--transition); white-space: nowrap; }
    .tab:hover { color: var(--fg0); }
    .tab.active { color: var(--accent); border-bottom-color: var(--accent); }

    .main { flex: 1; display: flex; overflow: hidden; }
    .sidebar { width: 280px; background: var(--bg1); border-right: 1px solid var(--border); display: flex; flex-direction: column; overflow: hidden; flex-shrink: 0; }
    .content { flex: 1; overflow-y: auto; padding: 20px; }
    .tab-panel { display: none; }
    .tab-panel.active { display: block; }

    .sidebar-section { border-bottom: 1px solid var(--border); padding: 12px; }
    .sidebar-title { font-size: 11px; font-weight: 600; color: var(--fg2); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 10px; }
    .scan-btn { width: 100%; padding: 10px 12px; border-radius: var(--radius-sm); border: none; cursor: pointer; font-size: 13px; font-weight: 600; transition: var(--transition); display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
    .scan-btn.primary { background: var(--accent); color: #0d1117; }
    .scan-btn.primary:hover { background: var(--accent2); }
    .scan-btn.secondary { background: var(--bg2); color: var(--fg0); border: 1px solid var(--border); }
    .scan-btn.secondary:hover { background: var(--bg3); }
    .scan-btn:disabled { opacity: 0.4; cursor: not-allowed; }

    .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 20px; }
    .stat-card { background: var(--bg1); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px; }
    .stat-value { font-size: 28px; font-weight: 700; line-height: 1; }
    .stat-label { font-size: 11px; color: var(--fg1); margin-top: 4px; font-weight: 500; }
    .stat-card.critical .stat-value { color: var(--critical); }
    .stat-card.high .stat-value { color: var(--high); }
    .stat-card.medium .stat-value { color: var(--medium); }
    .stat-card.ai .stat-value { color: var(--purple); }
    .stat-card.total .stat-value { color: var(--accent); }
    .stat-card.clean .stat-value { color: var(--green); }

    .progress-bar { height: 6px; background: var(--bg3); border-radius: 3px; overflow: hidden; margin-top: 6px; }
    .progress-fill { height: 100%; border-radius: 3px; transition: width 0.5s ease; }

    .badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
    .badge.critical { background: rgba(255,68,68,0.15); color: var(--critical); }
    .badge.high { background: rgba(240,136,62,0.15); color: var(--high); }
    .badge.medium { background: rgba(210,153,34,0.15); color: var(--medium); }
    .badge.low { background: rgba(63,185,80,0.15); color: var(--low); }
    .badge.info { background: rgba(88,166,255,0.15); color: var(--info); }
    .badge.ai { background: rgba(188,140,255,0.15); color: var(--purple); }

    .finding-card { background: var(--bg1); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px; margin-bottom: 10px; transition: var(--transition); cursor: pointer; }
    .finding-card:hover { border-color: var(--accent); }
    .finding-card.critical { border-left: 3px solid var(--critical); }
    .finding-card.high { border-left: 3px solid var(--high); }
    .finding-card.medium { border-left: 3px solid var(--medium); }
    .finding-card.low { border-left: 3px solid var(--low); }
    .finding-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
    .finding-title { font-weight: 600; font-size: 13px; flex: 1; }
    .finding-meta { font-size: 11px; color: var(--fg1); display: flex; gap: 12px; margin-bottom: 8px; }
    .finding-snippet { background: var(--bg0); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 8px 10px; font-family: var(--mono); font-size: 11px; color: var(--fg1); overflow-x: auto; max-height: 60px; }
    .finding-rec { font-size: 12px; color: var(--fg1); margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border); }

    .file-list { display: flex; flex-direction: column; gap: 4px; }
    .file-item { display: flex; align-items: center; gap: 10px; padding: 8px 10px; background: var(--bg1); border: 1px solid var(--border); border-radius: var(--radius-sm); cursor: pointer; transition: var(--transition); }
    .file-item:hover { border-color: var(--accent); background: var(--bg2); }
    .file-name { flex: 1; font-family: var(--mono); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .file-score { font-family: var(--mono); font-size: 11px; width: 48px; text-align: right; }

    .ai-score-bar { display: flex; align-items: center; gap: 8px; }
    .ai-score-track { flex: 1; height: 4px; background: var(--bg3); border-radius: 2px; overflow: hidden; }
    .ai-score-fill { height: 100%; border-radius: 2px; background: linear-gradient(90deg, var(--green), var(--yellow), var(--red)); }

    .shell-input-row { display: flex; gap: 8px; margin-bottom: 16px; }
    .shell-input { flex: 1; background: var(--bg1); border: 1px solid var(--border); color: var(--fg0); padding: 8px 12px; border-radius: var(--radius-sm); font-family: var(--mono); font-size: 13px; outline: none; }
    .shell-input:focus { border-color: var(--accent); }
    .shell-result { background: var(--bg1); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; }
    .shell-risk { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; font-weight: 600; }
    .shell-issues { display: flex; flex-direction: column; gap: 8px; }
    .shell-issue { padding: 8px 12px; background: var(--bg2); border-radius: var(--radius-sm); font-size: 12px; }
    .shell-suggestion { margin-top: 12px; padding: 10px 12px; background: rgba(88,166,255,0.1); border: 1px solid rgba(88,166,255,0.3); border-radius: var(--radius-sm); font-size: 12px; }
    .shell-alt { margin-top: 8px; font-family: var(--mono); font-size: 12px; color: var(--green); }

    .policy-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px; }
    .policy-card { background: var(--bg1); border: 1px solid var(--border); border-radius: var(--radius); padding: 12px 14px; display: flex; align-items: center; gap: 10px; }
    .policy-status { font-size: 16px; }
    .policy-name { font-weight: 600; font-size: 13px; }
    .policy-desc { font-size: 11px; color: var(--fg1); margin-top: 2px; }
    .policy-card.pass { border-left: 3px solid var(--green); }
    .policy-card.fail { border-left: 3px solid var(--red); }

    .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
    .section-title { font-size: 15px; font-weight: 700; }
    .section-subtitle { font-size: 12px; color: var(--fg1); margin-top: 2px; }

    .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 60px 20px; text-align: center; color: var(--fg1); }
    .empty-icon { font-size: 48px; }
    .empty-title { font-size: 16px; font-weight: 600; color: var(--fg0); }
    .empty-desc { font-size: 13px; max-width: 340px; line-height: 1.6; }

    @keyframes spin { to { transform: rotate(360deg); } }
    .spinner { width: 24px; height: 24px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.7s linear infinite; }
    .loading-state { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 40px; color: var(--fg1); }

    .score-circle { width: 80px; height: 80px; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 700; border: 3px solid; }
    .score-circle.low { border-color: var(--green); color: var(--green); }
    .score-circle.medium { border-color: var(--yellow); color: var(--yellow); }
    .score-circle.high { border-color: var(--high); color: var(--high); }
    .score-circle.critical { border-color: var(--critical); color: var(--critical); }

    .threshold-row { display: flex; align-items: center; gap: 12px; background: var(--bg1); border: 1px solid var(--border); border-radius: var(--radius); padding: 12px 16px; margin-bottom: 16px; }
    .threshold-label { font-size: 12px; color: var(--fg1); min-width: 160px; }
    .threshold-value { font-family: var(--mono); font-size: 13px; font-weight: 600; color: var(--accent); min-width: 40px; }
    input[type=range] { flex: 1; accent-color: var(--accent); }

    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: var(--bg0); }
    ::-webkit-scrollbar-thumb { background: var(--bg3); border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: var(--fg2); }

    .detail-panel { background: var(--bg1); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; margin-top: 16px; }
    .detail-header { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 14px; }
    .detail-info { flex: 1; }
    .detail-title { font-size: 16px; font-weight: 700; margin-bottom: 4px; }
    .detail-path { font-family: var(--mono); font-size: 11px; color: var(--fg1); }
    .metrics-row { display: flex; gap: 16px; margin-bottom: 14px; }
    .metric { display: flex; flex-direction: column; gap: 2px; }
    .metric-val { font-size: 20px; font-weight: 700; }
    .metric-label { font-size: 11px; color: var(--fg1); }
    .indicators-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
    .indicator-row { display: flex; align-items: center; gap: 10px; font-size: 12px; }
    .indicator-name { min-width: 160px; color: var(--fg1); }
    .indicator-bar { flex: 1; height: 6px; background: var(--bg3); border-radius: 3px; overflow: hidden; }
    .indicator-fill { height: 100%; background: var(--accent); border-radius: 3px; }
    .indicator-score { font-family: var(--mono); font-size: 11px; min-width: 36px; text-align: right; }

    .sanitize-btn { background: var(--bg2); border: 1px solid var(--accent); color: var(--accent); padding: 4px 10px; border-radius: var(--radius-sm); cursor: pointer; font-size: 12px; transition: var(--transition); }
    .sanitize-btn:hover { background: rgba(88,166,255,0.1); }
    .apply-fix-btn { background: rgba(63,185,80,0.12); border: 1px solid var(--green); color: var(--green); padding: 2px 10px; border-radius: var(--radius-sm); cursor: pointer; font-size: 11px; font-weight: 600; transition: var(--transition); white-space: nowrap; line-height: 1.6; }
    .apply-fix-btn:hover { background: rgba(63,185,80,0.28); }
    .apply-fix-btn.applied { opacity: 0.55; cursor: default; pointer-events: none; }
    .sanitized-code { background: var(--bg0); border: 1px solid var(--green); border-radius: var(--radius-sm); padding: 10px; font-family: var(--mono); font-size: 12px; color: var(--green); margin-top: 8px; white-space: pre-wrap; }

    .chart-row { display: flex; gap: 8px; margin-bottom: 8px; align-items: center; }
    .chart-label { min-width: 100px; font-size: 12px; color: var(--fg1); }
    .chart-bar { flex: 1; height: 18px; background: var(--bg3); border-radius: var(--radius-sm); overflow: hidden; position: relative; }
    .chart-fill { height: 100%; border-radius: var(--radius-sm); }
    .chart-count { font-size: 12px; font-family: var(--mono); min-width: 30px; text-align: right; }

    .sidebar-files { flex: 1; overflow-y: auto; padding: 8px; }
    .notification { position: fixed; bottom: 16px; right: 16px; background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius); padding: 10px 14px; font-size: 13px; z-index: 999; opacity: 0; transition: opacity 0.3s; }
    .notification.show { opacity: 1; }
    .notification.success { border-left: 3px solid var(--green); }
    .notification.error { border-left: 3px solid var(--critical); }

    .sanitized-diff { margin-top: 10px; }
    .diff-view { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .diff-section { border-radius: var(--radius-sm); overflow: hidden; }
    .diff-label { padding: 4px 10px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
    .diff-before .diff-label { background: rgba(255,68,68,0.15); color: var(--critical); }
    .diff-after .diff-label { background: rgba(63,185,80,0.15); color: var(--green); }
    .diff-code { background: var(--bg0); border: 1px solid var(--border); padding: 8px 10px; font-family: var(--mono); font-size: 11px; color: var(--fg1); white-space: pre-wrap; overflow-x: auto; max-height: 200px; overflow-y: auto; margin: 0; }
    .diff-before .diff-code { border-color: rgba(255,68,68,0.3); }
    .diff-after .diff-code { border-color: rgba(63,185,80,0.3); color: var(--green); }

    .finding-card.fp-marked { opacity: 0.45; }
    .fp-btn { background: var(--bg2); border: 1px solid var(--border); color: var(--fg1); padding: 4px 10px; border-radius: var(--radius-sm); cursor: pointer; font-size: 11px; transition: var(--transition); }
    .fp-btn:hover { border-color: var(--yellow); color: var(--yellow); }
    .fp-btn.marked { background: rgba(210,153,34,0.1); border-color: var(--yellow); color: var(--yellow); }

    .evidence-panel { background: var(--bg0); border: 1px solid rgba(188,140,255,0.3); border-radius: var(--radius-sm); padding: 10px 12px; margin-top: 8px; }
    .evidence-title { font-size: 11px; font-weight: 600; color: var(--purple); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
    .evidence-reason { font-size: 12px; color: var(--fg1); margin-bottom: 8px; font-style: italic; padding: 6px 8px; background: var(--bg1); border-radius: var(--radius-sm); border-left: 2px solid var(--purple); }
    .evidence-btn { background: none; border: 1px solid rgba(188,140,255,0.4); color: var(--purple); padding: 3px 8px; border-radius: var(--radius-sm); cursor: pointer; font-size: 11px; transition: var(--transition); }
    .evidence-btn:hover { background: rgba(188,140,255,0.1); }

    .search-input { background: var(--bg1); border: 1px solid var(--border); color: var(--fg0); padding: 5px 10px; border-radius: var(--radius-sm); font-size: 12px; outline: none; width: 180px; }
    .search-input:focus { border-color: var(--accent); }
    .search-input::placeholder { color: var(--fg2); }
    .fp-toggle { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--fg1); cursor: pointer; padding: 4px 8px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--bg1); white-space: nowrap; }
    .fp-toggle:hover { border-color: var(--yellow); color: var(--yellow); }
    .fp-toggle.active { border-color: var(--yellow); color: var(--yellow); background: rgba(210,153,34,0.1); }

    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideUp { from { transform: translateY(24px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    @keyframes slideInDown { from { transform: translateY(-6px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    @keyframes pulse-glow { 0%,100% { box-shadow: 0 0 0 0 transparent; } 50% { box-shadow: 0 0 12px 2px rgba(88,166,255,0.25); } }
    @keyframes shimmer { 0% { background-position: -600px 0; } 100% { background-position: 600px 0; } }
    .finding-card { animation: slideInDown 0.18s ease both; }
    .tab-panel.active { animation: fadeIn 0.18s ease; }
    .scan-btn:not(:disabled) { transition: all 0.15s ease; }
    .scan-btn:not(:disabled):hover { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(0,0,0,0.35); }
    .scan-btn:not(:disabled):active { transform: translateY(0); box-shadow: none; }
    .score-circle.scanning { animation: pulse-glow 1.4s ease-in-out infinite; }

    .skeleton { background: linear-gradient(90deg, var(--bg2) 25%, var(--bg3) 50%, var(--bg2) 75%); background-size: 600px 100%; animation: shimmer 1.4s infinite; border-radius: var(--radius-sm); }
    .skeleton-line { height: 12px; margin-bottom: 8px; border-radius: 6px; }
    .skeleton-card { height: 90px; margin-bottom: 10px; border-radius: var(--radius); }

    .snippet-wrap { position: relative; }
    .copy-btn { position: absolute; top: 4px; right: 4px; background: var(--bg2); border: 1px solid var(--border); color: var(--fg1); padding: 2px 7px; border-radius: var(--radius-sm); cursor: pointer; font-size: 10px; opacity: 0; transition: opacity 0.15s, color 0.15s; }
    .snippet-wrap:hover .copy-btn { opacity: 1; }
    .copy-btn:hover { color: var(--accent); border-color: var(--accent); }
    .copy-btn.copied { color: var(--green); border-color: var(--green); opacity: 1; }

    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.72); z-index: 1000; display: flex; align-items: center; justify-content: center; animation: fadeIn 0.15s ease; }
    .modal-box { background: var(--bg1); border: 1px solid var(--border); border-radius: 12px; width: 700px; max-width: 96vw; max-height: 85vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 32px 80px rgba(0,0,0,0.6); animation: slideUp 0.2s cubic-bezier(0.16,1,0.3,1); }
    .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
    .modal-title { font-weight: 700; font-size: 14px; display: flex; align-items: center; gap: 8px; }
    .modal-close { background: none; border: none; color: var(--fg1); cursor: pointer; font-size: 18px; line-height: 1; padding: 2px 8px; border-radius: var(--radius-sm); transition: var(--transition); }
    .modal-close:hover { background: var(--bg3); color: var(--fg0); }
    .modal-search-wrap { padding: 12px 20px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
    .modal-search-input { width: 100%; background: var(--bg0); border: 1px solid var(--border); color: var(--fg0); padding: 9px 14px; border-radius: var(--radius-sm); font-size: 13px; font-family: var(--mono); outline: none; transition: border-color 0.15s; }
    .modal-search-input:focus { border-color: var(--accent); }
    .modal-search-input::placeholder { color: var(--fg2); }
    .modal-stats { padding: 6px 20px; font-size: 11px; color: var(--fg2); border-bottom: 1px solid var(--border); flex-shrink: 0; }
    .modal-file-list { overflow-y: auto; flex: 1; min-height: 180px; }
    .modal-file-item { display: flex; align-items: center; gap: 10px; padding: 9px 20px; cursor: pointer; transition: background 0.1s; border-left: 2px solid transparent; }
    .modal-file-item:hover { background: var(--bg2); }
    .modal-file-item.selected { background: rgba(88,166,255,0.08); border-left-color: var(--accent); }
    .modal-file-icon { font-size: 15px; width: 22px; text-align: center; flex-shrink: 0; }
    .modal-file-name { font-family: var(--mono); font-size: 12px; font-weight: 600; color: var(--fg0); white-space: nowrap; }
    .modal-file-path { font-size: 11px; color: var(--fg2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 1px; }
    .modal-empty { padding: 40px 20px; text-align: center; color: var(--fg2); font-size: 12px; }

    .region-selector { border-top: 1px solid var(--border); padding: 16px 20px; background: var(--bg0); flex-shrink: 0; animation: slideInDown 0.18s ease; }
    .region-title { font-size: 12px; color: var(--fg1); margin-bottom: 4px; }
    .region-title strong { color: var(--accent); font-family: var(--mono); font-weight: 600; }
    .region-meta { font-size: 11px; color: var(--fg2); margin-bottom: 12px; }
    .region-controls { display: flex; gap: 14px; align-items: center; flex-wrap: wrap; margin-bottom: 10px; }
    .region-input-group { display: flex; align-items: center; gap: 8px; }
    .region-input-group label { font-size: 12px; color: var(--fg1); white-space: nowrap; }
    .region-input { background: var(--bg1); border: 1px solid var(--border); color: var(--fg0); padding: 5px 10px; border-radius: var(--radius-sm); font-size: 13px; font-family: var(--mono); width: 76px; outline: none; transition: border-color 0.15s; }
    .region-input:focus { border-color: var(--accent); }
    .region-preview-box { background: var(--bg1); border: 1px solid var(--border); border-radius: var(--radius-sm); font-family: var(--mono); font-size: 11px; overflow-y: auto; max-height: 160px; margin-bottom: 12px; }
    .region-line { display: flex; padding: 1px 0; }
    .region-line.in-range { background: rgba(88,166,255,0.1); }
    .region-line-num { color: var(--fg2); min-width: 38px; text-align: right; padding: 0 10px; user-select: none; flex-shrink: 0; }
    .region-line-text { color: var(--fg1); overflow: hidden; text-overflow: ellipsis; white-space: pre; padding-right: 8px; }
    .region-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .select-all-btn { background: none; border: 1px solid var(--border); color: var(--fg1); padding: 5px 10px; border-radius: var(--radius-sm); font-size: 11px; cursor: pointer; transition: var(--transition); }
    .select-all-btn:hover { border-color: var(--accent); color: var(--accent); }

    .scan-btn.browse { background: var(--bg2); border: 1px solid var(--purple); color: var(--purple); }
    .scan-btn.browse:hover { background: rgba(188,140,255,0.1); }
  `;
}
