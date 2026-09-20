import * as crypto from 'crypto';
import { buildStyles } from './WebviewStyles';
import { buildBody } from './WebviewBody';
import { buildScript } from './WebviewScript';

export function buildWebviewHtml(): string {
  const nonce = crypto.randomBytes(16).toString('hex');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src 'unsafe-inline'; font-src data:; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>manan-kanchu</title>
  <style>${buildStyles()}</style>
</head>
<body>
${buildBody()}
<script nonce="${nonce}">${buildScript()}</script>
</body>
</html>`;
}
