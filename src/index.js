'use strict';

require('dotenv').config();

const express = require('express');
const { proxyHandler } = require('./proxy');
const { logStartup } = require('./logger');
const { targets } = require('./config');

const PORT = parseInt(process.env.PORT || '3000', 10);

const app = express();

app.disable('x-powered-by');

app.use((req, res, next) => {
  res.removeHeader('x-powered-by');
  next();
});

app.use(proxyHandler);

app.listen(PORT, () => {
  logStartup(PORT, targets);
});
