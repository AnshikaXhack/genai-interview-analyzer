#!/usr/bin/env bash

npm install

# Force Puppeteer to install Chrome
PUPPETEER_SKIP_DOWNLOAD=0 npx puppeteer install