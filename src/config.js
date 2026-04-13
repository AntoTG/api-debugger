'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const TARGETS_FILE = path.resolve(process.cwd(), 'targets.yaml');

function loadTargets() {
  if (!fs.existsSync(TARGETS_FILE)) {
    console.error('ERROR: targets.yaml not found.');
    console.error(`Expected at: ${TARGETS_FILE}`);
    console.error('Copy targets.example.yaml to targets.yaml and fill in your project mappings.');
    process.exit(1);
  }

  let raw;
  try {
    raw = fs.readFileSync(TARGETS_FILE, 'utf8');
  } catch (err) {
    console.error(`ERROR: Could not read targets.yaml — ${err.message}`);
    process.exit(1);
  }

  let parsed;
  try {
    parsed = yaml.load(raw);
  } catch (err) {
    console.error(`ERROR: targets.yaml is not valid YAML — ${err.message}`);
    process.exit(1);
  }

  const targets = parsed && parsed.targets;

  if (!targets || typeof targets !== 'object' || Array.isArray(targets) || Object.keys(targets).length === 0) {
    console.error('ERROR: targets.yaml must have a non-empty "targets" key.');
    console.error('Example:\n  targets:\n    my-project: https://api.example.com');
    process.exit(1);
  }

  for (const [id, url] of Object.entries(targets)) {
    if (typeof url !== 'string' || !url.startsWith('http')) {
      console.error(`ERROR: Invalid URL for project "${id}": ${url}`);
      console.error('Each value must be a valid http/https URL.');
      process.exit(1);
    }
  }

  return targets;
}

const targets = loadTargets();

module.exports = { targets };
