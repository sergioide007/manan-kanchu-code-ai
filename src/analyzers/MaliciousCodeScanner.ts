import { CodeFinding, SeverityLevel } from '../core/interfaces';
import { uuid } from './utils';

interface MaliciousPattern {
  id: string;
  title: string;
  pattern: RegExp;
  severity: SeverityLevel;
  description: string;
  recommendation: string;
  category: 'keylogger' | 'data-exfiltration' | 'form-hijacking' | 'crypto-miner' | 'clipboard-hijack' | 'obfuscation' | 'tracking';
}

const MALICIOUS_PATTERNS: MaliciousPattern[] = [
  // Keyloggers
  {
    id: 'KL-001', title: 'Keylogger Pattern: keydown Listener',
    pattern: /addEventListener\s*\(\s*['"`]keydown['"`][^)]*\)\s*\{[^}]*(?:fetch|XMLHttpRequest|sendBeacon|ajax)/gi,
    severity: 'critical',
    description: 'Keyboard event listener combined with data transmission — potential keylogger.',
    recommendation: 'Audit this code for unauthorized data collection. Remove if not legitimate.',
    category: 'keylogger',
  },
  {
    id: 'KL-002', title: 'Keylogger Pattern: keystroke capture',
    pattern: /(?:keyCode|which|key)\s*.*(?:fetch|xhr|send|post)\s*\([^)]*keylog/gi,
    severity: 'critical',
    description: 'Keystroke data being sent to a remote endpoint.',
    recommendation: 'Immediately investigate and remove unauthorized keystroke collection.',
    category: 'keylogger',
  },
  // Data exfiltration
  {
    id: 'EXFIL-001', title: 'Credential Exfiltration',
    pattern: /(?:password|passwd|credential|token|apikey|secret)[^=]*=\s*[^;]+;\s*(?:fetch|XMLHttpRequest\.prototype\.send|sendBeacon|axios\.post)/gi,
    severity: 'critical',
    description: 'Credentials being captured and transmitted to an external server.',
    recommendation: 'This is likely malicious. Remove immediately and audit authentication flows.',
    category: 'data-exfiltration',
  },
  {
    id: 'EXFIL-002', title: 'Local Storage Exfiltration',
    pattern: /localStorage\.getItem[^;]*(?:fetch|sendBeacon|XMLHttpRequest)/gi,
    severity: 'high',
    description: 'LocalStorage data being sent to an external endpoint.',
    recommendation: 'Verify this is legitimate feature, not data theft.',
    category: 'data-exfiltration',
  },
  {
    id: 'EXFIL-003', title: 'Cookie Exfiltration',
    pattern: /(?:document\.cookie[^;]*(?:fetch|sendBeacon|XMLHttpRequest|image\.src)|(?:fetch|sendBeacon|new XMLHttpRequest)\s*\([^;]*document\.cookie)/gi,
    severity: 'critical',
    description: 'Cookie data being transmitted to an external server — session hijacking risk.',
    recommendation: 'Remove immediately. Use HttpOnly cookies to prevent JS cookie access.',
    category: 'data-exfiltration',
  },
  // Form hijacking
  {
    id: 'FORM-001', title: 'Form Submit Hijacking',
    pattern: /addEventListener\s*\(\s*['"`]submit['"`][^)]*\)\s*\{[^}]*(?:fetch|XMLHttpRequest)[^}]*(?:password|email|credit|card|ssn)/gi,
    severity: 'critical',
    description: 'Form submission intercepted and sensitive fields transmitted externally.',
    recommendation: 'Classic web skimmer pattern. Remove and audit all payment/auth forms.',
    category: 'form-hijacking',
  },
  {
    id: 'FORM-002', title: 'Input Field Monitoring',
    pattern: /querySelectorAll\s*\(\s*['"`]input\[type=['"](password|text|email|tel)/gi,
    severity: 'high',
    description: 'Selecting all sensitive input fields — potential credential harvesting setup.',
    recommendation: 'Verify legitimate purpose. Often used in web skimmers.',
    category: 'form-hijacking',
  },
  // Crypto miners
  {
    id: 'MINER-001', title: 'Crypto Mining Code (CoinHive-style)',
    pattern: /(?:coinhive|cryptoloot|deepminer|jsecoin|minero|webminepool)\.(?:Anonymous|User|mine|start)/gi,
    severity: 'critical',
    description: 'Cryptocurrency mining library detected. Uses visitor CPU without consent.',
    recommendation: 'Remove immediately. This is unauthorized resource usage.',
    category: 'crypto-miner',
  },
  {
    id: 'MINER-002', title: 'WebAssembly Mining Pattern',
    pattern: /WebAssembly\.instantiate[^;]*(?:fetch|import)[^;]*\.wasm/gi,
    severity: 'medium',
    description: 'WebAssembly loaded from external source — possible crypto miner.',
    recommendation: 'Audit the .wasm source. Mining typically uses WASM for performance.',
    category: 'crypto-miner',
  },
  // Clipboard hijacking
  {
    id: 'CLIP-001', title: 'Clipboard Hijacking',
    pattern: /addEventListener\s*\(\s*['"`]copy['"`][^)]*\)\s*\{[^}]*clipboardData\.setData/gi,
    severity: 'high',
    description: 'Clipboard copy event intercepted and data modified — clipboard hijacking.',
    recommendation: 'Remove if not an intentional copy-format feature.',
    category: 'clipboard-hijack',
  },
  // Obfuscation
  {
    id: 'OBF-001', title: 'Code Obfuscation Detected',
    pattern: /(?:eval\s*\(atob|eval\s*\(unescape|eval\s*\(decodeURIComponent|String\.fromCharCode\([0-9,\s]{50,}\))/g,
    severity: 'critical',
    description: 'Obfuscated code using eval+decode patterns — classic malware hiding technique.',
    recommendation: 'Deobfuscate and review. Legitimate code has no reason to be obfuscated.',
    category: 'obfuscation',
  },
  {
    id: 'OBF-002', title: 'Hex-encoded Script Injection',
    pattern: /\\x[0-9a-f]{2}(\\x[0-9a-f]{2}){10,}/gi,
    severity: 'high',
    description: 'Large hex-encoded string — often used to hide malicious JavaScript.',
    recommendation: 'Decode and review the embedded string.',
    category: 'obfuscation',
  },
  // Tracking / fingerprinting
  {
    id: 'TRACK-001', title: 'Browser Fingerprinting',
    pattern: /(?:navigator\.plugins|navigator\.mimeTypes|screen\.colorDepth|canvas\.toDataURL|AudioContext|RTCPeerConnection)[^;]{0,100}(?:fetch|sendBeacon)/gi,
    severity: 'medium',
    description: 'Browser fingerprinting data being collected and sent to server.',
    recommendation: 'Disclose to users via privacy policy. May violate GDPR without consent.',
    category: 'tracking',
  },
  // Invisible iframe
  {
    id: 'IFRAME-001', title: 'Invisible Iframe Injection',
    pattern: /(?:width\s*[:=]\s*['"`]?0['"`]?|height\s*[:=]\s*['"`]?0['"`]?|display\s*:\s*none)[^;]*src\s*=/gi,
    severity: 'high',
    description: 'Hidden iframe with external source — can load malicious content.',
    recommendation: 'Remove invisible iframes pointing to external sources.',
    category: 'data-exfiltration',
  },
];

export class MaliciousCodeScanner {
  scan(code: string, filePath: string): CodeFinding[] {
    const lines = code.split('\n');
    const findings: CodeFinding[] = [];

    for (const mp of MALICIOUS_PATTERNS) {
      const pattern = new RegExp(mp.pattern.source, mp.pattern.flags);
      let match: RegExpExecArray | null;

      while ((match = pattern.exec(code)) !== null) {
        const lineIndex = code.substring(0, match.index).split('\n').length;
        const snippet = lines[lineIndex - 1]?.trim() ?? match[0].trim();

        findings.push({
          id: uuid(),
          category: 'malicious',
          severity: mp.severity,
          title: mp.title,
          description: mp.description,
          filePath,
          startLine: lineIndex,
          endLine: lineIndex,
          snippet,
          confidence: 0.80,
          recommendation: mp.recommendation,
        });
      }
    }

    return findings;
  }
}
