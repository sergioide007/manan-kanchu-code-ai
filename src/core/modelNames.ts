/** Human-friendly labels for model IDs, shown in the dashboard. Unknown IDs are shown as-is. */
const KNOWN_MODELS: Record<string, string> = {
  // OpenAI
  'gpt-6-astra': 'GPT-6 Astra',
  'gpt-4o': 'GPT-4o',
  // Anthropic
  'claude-sonnet-5': 'Claude Sonnet 5',
  'claude-opus-5': 'Claude Opus 5',
  'claude-sonnet-4-6': 'Claude Sonnet 4.6',
  // Google
  'gemini-3.1-pro-preview': 'Gemini 3.1 Pro (preview)',
  'gemini-3.1-flash-lite': 'Gemini 3.1 Flash-Lite',
  'gemini-2.5-pro': 'Gemini 2.5 Pro',
  'gemini-2.5-flash': 'Gemini 2.5 Flash',
};

export function friendlyModelName(modelId: string): string {
  if (!modelId) return '';
  const id = modelId.trim();
  const known = KNOWN_MODELS[id.toLowerCase()];
  if (known) return known;

  // claude-haiku-4-5-20251001 → Claude Haiku 4.5
  const claude = /^claude-([a-z]+)-(\d+)(?:-(\d+))?(?:-\d{8})?$/i.exec(id);
  if (claude) {
    const family = claude[1].charAt(0).toUpperCase() + claude[1].slice(1);
    return `Claude ${family} ${claude[2]}${claude[3] ? '.' + claude[3] : ''}`;
  }
  return id;
}
