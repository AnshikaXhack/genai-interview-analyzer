#!/usr/bin/env bash

# Install dependencies
npm install

# Install Chromium for Puppeteer
apt-get update && apt-get install -y chromium-browser