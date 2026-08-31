'use strict';

class DomainError extends Error {
  constructor(message, { status = 400, code = 'invalid_request' } = {}) {
    super(message);
    this.name = 'DomainError';
    this.status = status;
    this.code = code;
  }
}

function sendDomainError(res, err) {
  if (err instanceof DomainError) {
    return res.status(err.status).json({ error: err.message });
  }
  throw err;
}

module.exports = { DomainError, sendDomainError };
