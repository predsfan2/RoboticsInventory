'use strict';

function sendError(res, status, code, message) {
  return res.status(status).json({
    error: { code, message },
  });
}

function fromDomain(res, err) {
  if (err && err.name === 'DomainError') {
    return sendError(res, err.status || 400, err.code || 'invalid_request', err.message);
  }
  console.error('[hub]', err && err.message ? err.message : err);
  return sendError(res, 500, 'internal', 'Internal server error');
}

module.exports = { sendError, fromDomain };
