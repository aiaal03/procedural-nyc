// Headless Chrome for the capture tools (puppeteer-core, a dev dependency). CHROME: the browser to drive; by default
// Google Chrome where macOS keeps it. The GPU is asked for, so WebGL runs on the graphics card (Metal on a Mac).
import puppeteer from 'puppeteer-core';

const DEFAULT = {
  darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  linux: '/usr/bin/google-chrome',
  win32: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
}[process.platform];

export const launch = (extraArgs = []) => puppeteer.launch({
  executablePath: process.env.CHROME ?? DEFAULT,
  headless: 'new', protocolTimeout: 600000,
  args: [process.platform === 'darwin' ? '--use-angle=metal' : '--use-angle=default', '--enable-gpu', '--ignore-gpu-blocklist', ...extraArgs],
});
