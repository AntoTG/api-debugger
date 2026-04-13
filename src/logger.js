'use strict';

const chalk = require('chalk');

const BODY_MAX_CHARS = 4000;

function timestamp() {
  return new Date().toISOString();
}

function formatId(requestId) {
  return chalk.gray(`[${requestId.slice(0, 8)}]`);
}

function formatProject(projectId) {
  return chalk.bold.magenta(`{${projectId}}`);
}

function truncateBody(body) {
  if (typeof body === 'string') {
    if (body.length > BODY_MAX_CHARS) {
      return body.slice(0, BODY_MAX_CHARS) + chalk.gray(` ... [truncated ${body.length - BODY_MAX_CHARS} chars]`);
    }
    return body;
  }
  return body;
}

function formatHeaders(headers, redactAuth = false) {
  const lines = [];
  for (const [key, value] of Object.entries(headers)) {
    const lower = key.toLowerCase();
    let displayValue = value;
    if (redactAuth && lower === 'authorization') {
      const parts = String(value).split(' ');
      if (parts.length > 1) {
        displayValue = `${parts[0]} ${'*'.repeat(8)}`;
      } else {
        displayValue = '*'.repeat(8);
      }
    }
    lines.push(`  ${chalk.gray(key + ':')} ${displayValue}`);
  }
  return lines.join('\n');
}

function formatBody(body, contentType) {
  if (!body) return null;

  const ct = (contentType || '').toLowerCase();

  if (ct.includes('application/json')) {
    try {
      const parsed = typeof body === 'string' ? JSON.parse(body) : body;
      return truncateBody(JSON.stringify(parsed, null, 2));
    } catch {
      return truncateBody(String(body));
    }
  }

  if (typeof body === 'string' || Buffer.isBuffer(body)) {
    const str = body.toString();
    return truncateBody(str);
  }

  return null;
}

const REDACT_AUTH = process.env.REDACT_AUTH !== 'false';

function logRequest(requestId, projectId, req, forwardedPath, bodyBuffer) {
  const id = formatId(requestId);
  const proj = formatProject(projectId);
  const method = chalk.bold.cyan(req.method);
  const path = chalk.white(forwardedPath);
  const ts = chalk.gray(timestamp());

  console.log('');
  console.log(
    chalk.bold.blue('┌── [REQ] →') +
    ` ${id} ${proj} ${ts} ${method} ${path}`
  );
  console.log(chalk.blue('│') + chalk.gray(' Headers:'));
  console.log(
    formatHeaders(req.headers, REDACT_AUTH)
      .split('\n')
      .map(l => chalk.blue('│') + ' ' + l)
      .join('\n')
  );

  if (bodyBuffer && bodyBuffer.length > 0) {
    const contentType = req.headers['content-type'] || '';
    const formatted = formatBody(bodyBuffer.toString(), contentType);
    if (formatted) {
      console.log(chalk.blue('│') + chalk.gray(' Body:'));
      formatted.split('\n').forEach(line => {
        console.log(chalk.blue('│') + '   ' + line);
      });
    }
  }

  console.log(chalk.bold.blue('└───────────────'));
}

function logResponse(requestId, projectId, status, headers, body, elapsedMs) {
  const id = formatId(requestId);
  const proj = formatProject(projectId);
  const statusColor =
    status >= 500 ? chalk.bold.red(status) :
    status >= 400 ? chalk.bold.yellow(status) :
    status >= 300 ? chalk.bold.magenta(status) :
    chalk.bold.green(status);

  const elapsed = chalk.gray(`${elapsedMs}ms`);

  console.log('');
  console.log(
    chalk.bold.green('┌── [RES] ←') +
    ` ${id} ${proj} ${statusColor} ${elapsed}`
  );

  if (headers && Object.keys(headers).length > 0) {
    console.log(chalk.green('│') + chalk.gray(' Headers:'));
    formatHeaders(headers)
      .split('\n')
      .forEach(l => console.log(chalk.green('│') + ' ' + l));
  }

  if (body) {
    const contentType = (headers && headers['content-type']) || '';
    const formatted = formatBody(body, contentType);
    if (formatted) {
      console.log(chalk.green('│') + chalk.gray(' Body:'));
      formatted.split('\n').forEach(line => {
        console.log(chalk.green('│') + '   ' + line);
      });
    }
  }

  console.log(chalk.bold.green('└───────────────'));
}

function logTimeout(requestId, projectId, method, url, elapsedMs) {
  const id = formatId(requestId);
  const proj = formatProject(projectId);

  console.log('');
  console.error(chalk.bgRed.white.bold(' TIMEOUT ') + ` ${id} ${proj}`);
  console.error(chalk.red(`  ✕ ${method} ${url}`));
  console.error(chalk.red(`  Elapsed: ${elapsedMs}ms`));
  console.error(chalk.red(`  → 504 Gateway Timeout returned to caller`));
  console.log('');
}

function logNetworkError(requestId, projectId, method, url, error, elapsedMs) {
  const id = formatId(requestId);
  const proj = formatProject(projectId);

  console.log('');
  console.error(chalk.bgYellow.black.bold(' NET ERROR ') + ` ${id} ${proj}`);
  console.error(chalk.yellow(`  ✕ ${method} ${url}`));
  console.error(chalk.yellow(`  Code: ${error.code || 'UNKNOWN'} — ${error.message}`));
  console.error(chalk.yellow(`  Elapsed: ${elapsedMs}ms`));
  console.error(chalk.yellow(`  → 502 Bad Gateway returned to caller`));
  console.log('');
}

function logStartup(port, targets) {
  console.log('');
  console.log(chalk.bold.white('  ╔══════════════════════════════════════╗'));
  console.log(chalk.bold.white('  ║') + chalk.bold.cyan('          API Proxy Debugger          ') + chalk.bold.white('║'));
  console.log(chalk.bold.white('  ╚══════════════════════════════════════╝'));
  console.log('');
  console.log(`  ${chalk.gray('Listening on:')}  ${chalk.cyan(`http://localhost:${port}`)}`);
  console.log(`  ${chalk.gray('Projects:')}`);
  for (const [id, url] of Object.entries(targets)) {
    console.log(`    ${chalk.bold.magenta(`{${id}}`)}  ${chalk.gray('→')}  ${chalk.cyan(url)}`);
  }
  console.log('');
}

module.exports = {
  logRequest,
  logResponse,
  logTimeout,
  logNetworkError,
  logStartup,
};
