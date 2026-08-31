'use strict';

const { createRouter } = require('./routes');

function mountHub(app) {
  app.use('/hub/v1', createRouter());
}

module.exports = { mountHub };
