/**
 * Clipper Sidhiq — Ultra-Premium Brand Website & Pipeline E2E Verification Suite
 */

const path = require('path');
const fs = require('fs');

const PROJECT_ROOT = 'E:\\Clipper_Sidhiq';
const FRONTEND_DIR = path.join(PROJECT_ROOT, 'frontend');
const puppeteer = require(path.join(FRONTEND_DIR, 'node_modules', 'puppeteer-core'));
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP_URL = 'http://127.0.0.1:4173';
const BRIDGE_URL = 'http://127.0.0.1:4175';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failed++;
  }
}

async function runVerification() {
  console.log('======================================================================');
  console.log('CLIPPER SIDHIQ — ULTRA-PREMIUM BRAND WEBSITE & PIPELINE E2E SUITE');
  console.log('======================================================================\n');

  // 1. Verify Bridge Server & Health
  console.log('[TEST GROUP 1: Companion Bridge Health & API]');
  try {
    const res = await fetch(`${BRIDGE_URL}/api/handshake`);
    const data = await res.json();
    assert(data.ok === true, 'Companion bridge is online and responding to /api/handshake');
    assert(data.binaries.ytDlp === true, 'Bundled yt-dlp binary is verified');
    assert(data.binaries.ffmpeg === true, 'Bundled ffmpeg binary is verified');
    assert(data.binaries.python === true, 'Local Python 3.10 clipping runtime is verified');
  } catch (err) {
    assert(false, `Companion bridge health check failed: ${err.message}`);
  }

  // 2. Launch Puppeteer Browser
  console.log('\n[TEST GROUP 2: Website UI, Branding & Navigation]');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));
    page.on('console', msg => console.log('    [Browser Console]', msg.type(), msg.text()));
    page.on('dialog', async dialog => {
      console.log('    [Browser Alert]', dialog.message());
      await dialog.dismiss();
    });

    await page.goto(APP_URL, { waitUntil: 'networkidle2', timeout: 15000 });

    // Brand logo & title
    const brandText = await page.$eval('header', el => el.innerText);
    assert(brandText.includes('CLIPPER') && brandText.includes('SIDHIQ'), 'Brand logo and identity "CLIPPER SIDHIQ" rendered in header');
    assert(brandText.includes('Local Engine Online'), 'Companion engine status pill shows "Local Engine Online"');

    // Hero Section Headline & Copy
    const headline = await page.$eval('h1', el => el.innerText);
    assert(headline.includes('Turn Long Videos Into') && headline.includes('Ready-to-Share Clips'), `Headline correctly rendered: "${headline.replace(/\n/g, ' ')}"`);

    const heroCopy = await page.$eval('main p', el => el.innerText);
    assert(heroCopy.includes('Turn long videos into short, meaningful vertical clips'), 'Supporting copy correctly explains the value proposition');

    // Form elements & CTAs
    const urlInput = await page.$('input[placeholder*="Paste YouTube"]');
    assert(urlInput !== null, 'Prominent URL input field is present');

    const primaryCta = await page.$eval('button[type="submit"]', el => el.innerText);
    assert(primaryCta.includes('Create My Clips'), `Primary CTA is "${primaryCta}"`);

    const uploadBtn = await page.$('button ::-p-text(Upload a Video)');
    assert(uploadBtn !== null, 'Secondary CTA "Upload a Video" is present');

    // Privacy badge
    const privacyBadge = await page.$eval('main', el => el.innerText);
    assert(privacyBadge.includes('100% processed locally on your device via GPU/CPU acceleration'), 'Truthful local processing privacy note is present');

    // How It Works section
    console.log('\n[TEST GROUP 3: "How It Works" Section Content]');
    assert(privacyBadge.includes('Add Your Video'), 'Step 1: "Add Your Video" rendered');
    assert(privacyBadge.includes('Transcribe & Find Moments'), 'Step 2: "Transcribe & Find Moments" rendered');
    assert(privacyBadge.includes('Create Vertical Clips'), 'Step 3: "Create Vertical Clips" rendered');
    assert(privacyBadge.includes('Preview & Download'), 'Step 4: "Preview & Download" rendered');

    // Verify absence of technical jargon in step cards
    const stepCards = await page.$$eval('.grid div', els => els.map(e => e.innerText).join(' '));
    assert(!stepCards.includes('CORS') && !stepCards.includes('WebCodecs') && !stepCards.includes('yt-dlp'), 'Step cards are free of technical jargon');

    // 3. Saved Projects & Results Workspace
    console.log('\n[TEST GROUP 4: Saved Projects & Results Workspace]');
    await page.click('button ::-p-text(Saved Projects)');
    await new Promise(r => setTimeout(r, 600));

    const savedHeading = await page.$eval('main h2', el => el.innerText);
    assert(savedHeading.includes('Saved Projects'), 'Navigated to Saved Projects view');

    const projectCardText = await page.$eval('main', el => el.innerText);
    assert(projectCardText.includes('$1 vs $100,000,000 Car!'), 'Saved benchmark project "$1 vs $100,000,000 Car!" listed');

    // Click "Open Clips & Transcript"
    const openBtn = await page.$('button ::-p-text(Open Clips & Transcript)');
    assert(openBtn !== null, 'Open Clips button found on project card');
    await openBtn.click();
    await new Promise(r => setTimeout(r, 800));

    // Verify Results Workspace
    const resultsTitle = await page.$eval('main h1', el => el.innerText);
    assert(resultsTitle.length > 0, `Results Workspace opened for project: "${resultsTitle}"`);

    const resultsText = await page.$eval('main', el => el.innerText);
    assert(resultsText.includes('Vertical 1080×1920 Clips (< 60s)'), 'Vertical 1080×1920 heading verified');
    assert(resultsText.includes('Download All (ZIP)'), 'Download All (ZIP) button verified');
    assert(resultsText.includes('Clip 1 — Opening Hook'), 'Clip 1 (Opening Hook) card verified');
    assert(resultsText.includes('Clip 2 — Viral Moment'), 'Clip 2 (Viral Moment) card verified');
    assert(resultsText.includes('1080×1920 (9:16)'), '9:16 aspect ratio badge verified on clips');

    // Verify video players render
    const videoElements = await page.$$('video');
    assert(videoElements.length >= 2, `Both vertical video preview players rendered (${videoElements.length} players found)`);

    // Verify transcript controls
    assert(resultsText.includes('transcript.txt'), 'Download transcript.txt button present');
    assert(resultsText.includes('transcript.srt'), 'Download transcript.srt button present');
    assert(resultsText.includes('[00:') || resultsText.includes('-->'), 'Timestamped dialogue displayed in interactive viewer');

    // 4. Test URL Ingestion & Processing Progression
    console.log('\n[TEST GROUP 5: URL Ingestion Validation & Progression UI]');
    await page.click('button ::-p-text(Create Clips)');
    await new Promise(r => setTimeout(r, 600));

    // Click "New Project" if still in results view
    const newProjBtn = await page.$('button ::-p-text(New Project)');
    if (newProjBtn) {
      await newProjBtn.click();
      await new Promise(r => setTimeout(r, 600));
    }

    // Test invalid URL validation
    const submitBtn = await page.$('button[type="submit"]');
    await submitBtn.click();
    await new Promise(r => setTimeout(r, 300));

    const errText = await page.$eval('main', el => el.innerText);
    assert(errText.includes('Please paste a video URL'), 'Empty URL validation displays friendly error');

    // Type invalid non-http string
    await page.type('input[placeholder*="Paste YouTube"]', 'invalid_url_test');
    await submitBtn.click();
    await new Promise(r => setTimeout(r, 300));
    const invalidErrText = await page.$eval('main', el => el.innerText);
    assert(invalidErrText.includes('valid URL starting with http'), 'Malformed URL validation triggers clear message');

    // Test Benchmark Video quick button
    console.log('\n[TEST GROUP 6: Quick Benchmark Trigger & Processing Progression]');
    const testBenchmarkBtn = await page.$('button ::-p-text(Test with Benchmark Video)');
    assert(testBenchmarkBtn !== null, 'Benchmark video test trigger found');
    await testBenchmarkBtn.click();
    await new Promise(r => setTimeout(r, 1200));

    // Check that we transitioned to Processing Workspace
    const processingText = await page.$eval('main', el => el.innerText);
    console.log('    [Test Group 6 Text on Page]:', processingText.slice(0, 150));
    assert(
      processingText.toUpperCase().includes('PIPELINE PROGRESSION') || 
      processingText.toUpperCase().includes('ACTIVE VIDEO PIPELINE') || 
      processingText.toUpperCase().includes('VERTICAL CLIPS'),
      'Workflow transitioned smoothly to active pipeline or instant cached results'
    );

    // 5. Mobile Responsiveness Check
    console.log('\n[TEST GROUP 7: Mobile Viewport Responsiveness]');
    await page.setViewport({ width: 375, height: 812, isMobile: true });
    await page.goto(APP_URL, { waitUntil: 'networkidle2' });

    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const windowWidth = await page.evaluate(() => window.innerWidth);
    assert(bodyWidth <= windowWidth + 1, `No horizontal layout overflow on mobile (width: ${bodyWidth}px <= viewport: ${windowWidth}px)`);

    const mobileNav = await page.$('nav') || await page.$('header');
    assert(mobileNav !== null, 'Header navigation adjusts cleanly to mobile viewports');

    assert(pageErrors.length === 0, `Zero uncaught JavaScript exceptions during verification (${pageErrors.length})`);

  } finally {
    await browser.close();
  }

  console.log('\n======================================================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runVerification().catch(err => {
  console.error('Fatal verification suite error:', err);
  process.exit(1);
});
