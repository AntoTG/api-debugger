'use strict';

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { logRequest, logResponse, logTimeout, logNetworkError } = require('./logger');
const { targets } = require('./config');

const TIMEOUT_MS = parseInt(process.env.REQUEST_TIMEOUT_MS || '30000', 10);

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'host',
]);

function buildForwardHeaders(incomingHeaders, requestId) {
  const headers = {};
  for (const [key, value] of Object.entries(incomingHeaders)) {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      headers[key] = value;
    }
  }
  headers['x-request-id'] = requestId;
  return headers;
}

function filterResponseHeaders(headers) {
  const out = {};
  for (const [key, value] of Object.entries(headers)) {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      out[key] = value;
    }
  }
  return out;
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function parseProjectId(rawUrl) {
  const pathname = rawUrl.split('?')[0];
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return { projectId: null, remainingPath: '/' };
  const projectId = segments[0];
  const rest = '/' + segments.slice(1).join('/');
  const query = rawUrl.includes('?') ? '?' + rawUrl.split('?').slice(1).join('?') : '';
  return { projectId, remainingPath: rest + query };
}

async function proxyHandler(req, res) {
  const requestId = uuidv4();
  const start = Date.now();

  const rawUrl = req.originalUrl || req.url;
  const { projectId, remainingPath } = parseProjectId(rawUrl);

  if (!projectId) {
    return res.status(400).json({
      error: 'Missing project ID',
      message: 'Requests must include a project ID as the first path segment: /:projectId/...',
      example: `http://localhost:${process.env.PORT || 3000}/${Object.keys(targets)[0]}/api/v1/endpoint`,
      available_ids: Object.keys(targets),
    });
  }

  const targetUrl = targets[projectId];
  if (!targetUrl) {
    return res.status(404).json({
      error: 'Unknown project ID',
      project_id: projectId,
      message: `No target configured for project "${projectId}".`,
      available_ids: Object.keys(targets),
    });
  }

  res.setHeader('x-request-id', requestId);
  res.setHeader('x-project-id', projectId);

  const bodyBuffer = await readBody(req);

  logRequest(requestId, projectId, req, remainingPath, bodyBuffer);

  const forwardUrl = targetUrl.replace(/\/$/, '') + remainingPath;
  const forwardHeaders = buildForwardHeaders(req.headers, requestId);

  let axiosResponse;
  try {
    axiosResponse = await axios({
      method: req.method,
      url: forwardUrl,
      headers: forwardHeaders,
      data: bodyBuffer.length > 0 ? bodyBuffer : undefined,
      timeout: TIMEOUT_MS,
      responseType: 'arraybuffer',
      validateStatus: () => true,
      decompress: false,
      maxRedirects: 0,
    });
  } catch (err) {
    const elapsed = Date.now() - start;

    if (axios.isAxiosError(err) && err.code === 'ECONNABORTED') {
      logTimeout(requestId, projectId, req.method, forwardUrl, elapsed);
      return res.status(504).json({
        error: 'Gateway Timeout',
        request_id: requestId,
        project_id: projectId,
        elapsed_ms: elapsed,
        message: `Target did not respond within ${TIMEOUT_MS}ms`,
      });
    }

    logNetworkError(requestId, projectId, req.method, forwardUrl, err, elapsed);
    return res.status(502).json({
      error: 'Bad Gateway',
      request_id: requestId,
      project_id: projectId,
      elapsed_ms: elapsed,
      code: err.code || 'UNKNOWN',
      message: err.message,
    });
  }

  const elapsed = Date.now() - start;

  const responseHeaders = filterResponseHeaders(axiosResponse.headers);
  const responseBodyBuffer = Buffer.from(axiosResponse.data);
  const contentType = axiosResponse.headers['content-type'] || '';

  let responseBodyForLog;
  if (contentType.includes('application/json') || contentType.includes('text/')) {
    responseBodyForLog = responseBodyBuffer.toString('utf8');
  } else {
    responseBodyForLog = null;
  }

  logResponse(requestId, projectId, axiosResponse.status, responseHeaders, responseBodyForLog, elapsed);

  for (const [key, value] of Object.entries(responseHeaders)) {
    res.setHeader(key, value);
  }
  res.setHeader('x-request-id', requestId);
  res.setHeader('x-project-id', projectId);

  res.status(axiosResponse.status).end(responseBodyBuffer);
}

module.exports = { proxyHandler };
