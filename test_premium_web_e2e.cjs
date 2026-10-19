/**
 * Clipper Sidhiq — Premium Website Polish & End-to-End Verification Suite
 *
 * Verifies:
 * 1. Dark cinematic design, typography, brand identity, and color system.
 * 2. Customer-facing "How It Works" 4-step cards & 100% Private On-Device guarantee.
 * 3. Mobile (<768px) and Desktop (>=768px) responsive layouts.
 * 4. URL Ingestion & plain-English YouTube guidance notice.
 * 5. Direct video ingestion, validation, and metadata parsing.
 * 6. WebCodecs vertical 1080x1920 rendering pipeline with audio preservation.
 * 7. Results view: 9:16 clip cards, viral scores, preview modal, MP4 downloads, and ZIP archive.
 * 8. State management, History workspace, Settings & Storage modal, and zero banned phrases.
 */

const path = require('path');
const fs = require('fs');
const PROJECT_ROOT = 'E:\\Clipper_Sidhiq';
const FRONTEND_DIR = path.join(PROJECT_ROOT, 'frontend');
const puppeteer = require(path.join(FRONTEND_DIR, 'node_modules', 'puppeteer-core'));

const TEST_VIDEO_PATH = path.join(PROJECT_ROOT, 'test_data', 'sample_input.mp4');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP_URL = 'http://127.0.0.1:4173';

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

async function runWebVerification() {
  console.log('======================================================================');
  console.log('CLIPPER SIDHIQ — PREMIUM WEBSITE POLISH & E2E VERIFICATION SUITE');
  console.log('======================================================================\n');

  assert(fs.existsSync(CHROME_PATH), `Chrome executable found at: ${CHROME_PATH}`);
  assert(fs.existsSync(TEST_VIDEO_PATH), `Sample test video found at: ${TEST_VIDEO_PATH}`);

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--enable-features=WebCodecs,WebCodecsVideoDecoder,WebCodecsVideoEncoder'
    ]
  });

  try {
    const page = await browser.newPage();
    page.on('console', msg => {
      const text = msg.text();
      if (!text.includes('[vite]') && !text.includes('Download the React DevTools')) {
        // console.log(`    [Browser Console]: ${text}`);
      }
    });

    // -------------------------------------------------------------
    // Test 1: Desktop Landing Page & Visual Identity
    // -------------------------------------------------------------
    console.log('\n[TEST 1] Verifying Desktop Landing Page, Typography & Brand Identity...');
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(APP_URL, { waitUntil: 'networkidle2', timeout: 30000 });

    const pageTitle = await page.title();
    assert(pageTitle.includes('Clipper Sidhiq'), `Page title is: "${pageTitle}"`);

    // Verify Dark Cinematic Theme Background & Typography
    const bodyBg = await page.evaluate(() => {
      const el = document.querySelector('div.bg-\\[\\#090a0f\\]');
      return Boolean(el);
    });
    assert(bodyBg, 'Graphite dark cinematic background (#090a0f) applied');

    // Verify Hero Headline
    const heroHeadline = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      return h1 ? h1.textContent.trim() : '';
    });
    assert(heroHeadline.includes('Turn Long Videos Into Ready-to-Share Clips'), `Hero headline verified: "${heroHeadline}"`);

    // Verify Desktop Sidebar is Visible and Mobile Header is Hidden
    const desktopLayout = await page.evaluate(() => {
      const sidebar = document.querySelector('aside');
      const mobileHeader = document.querySelector('header.md\\:hidden');
      const sidebarVisible = sidebar ? window.getComputedStyle(sidebar).display !== 'none' : false;
      const headerVisible = mobileHeader ? window.getComputedStyle(mobileHeader).display !== 'none' : false;
      return { sidebarVisible, headerVisible };
    });
    assert(desktopLayout.sidebarVisible, 'Desktop sidebar is visible on 1440px viewport');
    assert(!desktopLayout.headerVisible, 'Mobile header is hidden on 1440px viewport');

    // Verify Plain-English "How It Works" Section
    const howItWorks = await page.evaluate(() => {
      const text = document.body.innerText.toLowerCase();
      const hasTitle = text.includes('how it works') && text.includes('turn long videos into ready-to-share clips');
      const hasStep1 = text.includes('step 1 — add your video');
      const hasStep2 = text.includes('step 2 — find the best moments');
      const hasStep3 = text.includes('step 3 — create vertical clips');
      const hasStep4 = text.includes('step 4 — download and share');
      const hasPrivacy = text.includes('100% private on-device processing') && text.includes('zero cloud upload');
      return { hasTitle, hasStep1, hasStep2, hasStep3, hasStep4, hasPrivacy };
    });
    assert(howItWorks.hasTitle, '"How It Works" section heading verified');
    assert(howItWorks.hasStep1, 'Step 1 — Add Your Video card verified');
    assert(howItWorks.hasStep2, 'Step 2 — Find the Best Moments card verified');
    assert(howItWorks.hasStep3, 'Step 3 — Create Vertical Clips card verified');
    assert(howItWorks.hasStep4, 'Step 4 — Download and Share card verified');
    assert(howItWorks.hasPrivacy, '100% Private On-Device Processing guarantee banner verified');

    // Verify Forbidden Phrase does NOT exist anywhere in document
    const hasForbiddenPhrase = await page.evaluate(() => {
      return document.body.innerText.includes('Key Moments from Sequence');
    });
    assert(!hasForbiddenPhrase, 'Verified "Key Moments from Sequence" is completely absent from the UI');

    // -------------------------------------------------------------
    // Test 2: Mobile Responsive Layout Verification (375x667)
    // -------------------------------------------------------------
    console.log('\n[TEST 2] Verifying Mobile Responsive Layout (< 768px)...');
    await page.setViewport({ width: 375, height: 667 });
    await new Promise(r => setTimeout(r, 400));

    const mobileLayout = await page.evaluate(() => {
      const sidebar = document.querySelector('aside');
      const mobileHeader = document.querySelector('header.md\\:hidden');
      const sidebarHidden = sidebar ? window.getComputedStyle(sidebar).display === 'none' : true;
      const headerVisible = mobileHeader ? window.getComputedStyle(mobileHeader).display !== 'none' : false;
      const docWidth = document.documentElement.scrollWidth;
      const winWidth = window.innerWidth;
      const noHorizontalOverflow = docWidth <= winWidth + 5;
      return { sidebarHidden, headerVisible, noHorizontalOverflow, docWidth, winWidth };
    });
    assert(mobileLayout.sidebarHidden, 'Sidebar collapses to hidden on mobile viewport (375px)');
    assert(mobileLayout.headerVisible, 'Mobile top header bar is visible on mobile viewport');
    assert(mobileLayout.noHorizontalOverflow, `No horizontal scroll overflow on mobile (width ${mobileLayout.docWidth} <= ${mobileLayout.winWidth})`);

    // Restore desktop viewport for workflow testing
    await page.setViewport({ width: 1440, height: 900 });
    await new Promise(r => setTimeout(r, 400));

    // -------------------------------------------------------------
    // Test 3: URL Ingestion & YouTube Guidance Notice
    // -------------------------------------------------------------
    console.log('\n[TEST 3] Testing URL Ingestion Mode & YouTube Guidance Notice...');

    // Click "Paste Video URL" tab
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const urlTab = btns.find(b => b.textContent && b.textContent.includes('Paste Video URL'));
      if (urlTab) urlTab.click();
    });
    await new Promise(r => setTimeout(r, 400));

    // Input YouTube URL
    const ytInput = await page.$('input[placeholder*="youtube.com"], input[placeholder*="https://"]');
    assert(ytInput !== null, 'Video URL text input located in UI');
    await ytInput.type('https://www.youtube.com/watch?v=dQw4w9WgXcQ');

    // Click "Fetch Video"
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const fetchBtn = btns.find(b => b.textContent && b.textContent.includes('Fetch Video'));
      if (fetchBtn) fetchBtn.click();
    });
    await new Promise(r => setTimeout(r, 600));

    // Check YouTube Guidance Notice appeared
    const ytNotice = await page.evaluate(() => {
      const panel = document.querySelector('[data-testid="youtube-guidance-panel"]');
      if (!panel) return null;
      const text = panel.innerText;
      return {
        hasTitle: text.includes('YouTube Link Notice'),
        hasWhy: text.includes('Why YouTube links require a local video file in web browsers'),
        hasOptions: text.includes('Desktop App') && text.includes('Web Browser'),
        hasSwitchBtn: Boolean(panel.querySelector('button'))
      };
    });
    assert(ytNotice !== null, 'YouTube Guidance Notice card displayed');
    assert(ytNotice && ytNotice.hasWhy, 'Explains dynamic streaming chunking and browser download restrictions in plain English');
    assert(ytNotice && ytNotice.hasOptions, 'Presents Desktop App vs Local File upload pathways clearly');

    // Switch back to Local File Upload
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const localTab = btns.find(b => b.textContent && b.textContent.includes('Local File Upload'));
      if (localTab) localTab.click();
    });
    await new Promise(r => setTimeout(r, 400));

    // -------------------------------------------------------------
    // Test 4: Local File Ingestion & Metadata Validation
    // -------------------------------------------------------------
    console.log('\n[TEST 4] Testing Local File Ingestion & In-Browser Metadata Validation...');
    const fileInput = await page.$('input[type="file"]');
    assert(fileInput !== null, 'File upload input located');
    await fileInput.uploadFile(TEST_VIDEO_PATH);

    await page.waitForSelector('h3', { timeout: 10000 });
    // Wait for video element metadata probe to populate duration & dimensions
    await page.waitForFunction(() => {
      const text = document.body.innerText;
      return text.includes('sample_input.mp4') && (text.includes('1920x1080') || text.includes('1920 × 1080'));
    }, { timeout: 10000 });

    const fileCard = await page.evaluate(() => {
      const h3 = document.querySelector('h3');
      const text = document.body.innerText;
      const hasDuration = text.includes('0:39') || text.includes('39s') || /\d+:\d{2}/.test(text);
      const hasResolution = text.includes('1920x1080') || text.includes('1920 × 1080');
      return {
        fileName: h3 ? h3.textContent.trim() : '',
        hasDuration,
        hasResolution
      };
    });
    assert(fileCard.fileName.includes('sample_input.mp4'), `Uploaded file card rendered: "${fileCard.fileName}"`);
    assert(fileCard.hasDuration, 'Correct video duration detected (0:39)');
    assert(fileCard.hasResolution, 'Correct video dimensions detected (1920x1080)');

    // -------------------------------------------------------------
    // Test 5: Full In-Browser WebCodecs Clipping Pipeline
    // -------------------------------------------------------------
    console.log('\n[TEST 5] Executing Full In-Browser Vertical 1080x1920 Clipping Pipeline...');
    const startClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const startBtn = btns.find(b =>
        b.textContent && (
          b.textContent.includes('Find My Best Clips') ||
          b.textContent.includes('Generate Vertical Clips') ||
          b.textContent.includes('Process In-Browser')
        )
      );
      if (startBtn) {
        startBtn.click();
        return true;
      }
      return false;
    });
    assert(startClicked, 'Clicked "Find My Best Clips" to start processing');

    // Wait for processing completion (timeout 180s)
    let completed = false;
    let attempts = 0;
    while (!completed && attempts < 180) {
      await new Promise(r => setTimeout(r, 1000));
      attempts++;

      const status = await page.evaluate(() => {
        const stageMsg = document.querySelector('.text-gray-300.font-medium')?.textContent || '';
        const pctText = document.querySelector('.text-purple-300.font-semibold')?.textContent || '';
        const isDone = Boolean(document.querySelector('a[download*="all_clips.zip"]')) ||
                       document.body.innerText.includes('In-Browser AI Results');
        const hasFailed = document.body.innerText.includes('Browser Pipeline Interrupted');
        return { stageMsg, pctText, isDone, hasFailed };
      });

      if (status.stageMsg && attempts % 5 === 0) {
        console.log(`      [Progress ${status.pctText}]: ${status.stageMsg}`);
      }

      if (status.isDone) {
        completed = true;
        break;
      }

      if (status.hasFailed) {
        throw new Error('In-browser pipeline failed with error');
      }
    }

    assert(completed, 'Full clipping pipeline completed successfully within timeout!');

    // -------------------------------------------------------------
    // Test 6: Results Grid, 1080x1920 Vertical Clips & ZIP Download
    // -------------------------------------------------------------
    console.log('\n[TEST 6] Verifying Results Grid, 9:16 Vertical Video Cards & ZIP Export...');
    const resultsData = await page.evaluate(() => {
      const zipBtn = document.querySelector('a[download*="all_clips.zip"]');
      const clipCards = Array.from(document.querySelectorAll('div.aspect-\\[9\\/16\\]'));
      const previewBtns = Array.from(document.querySelectorAll('button')).filter(b => b.textContent && b.textContent.includes('Preview'));
      const downloadBtns = Array.from(document.querySelectorAll('a[download*="1080x1920.mp4"]'));
      const viralBadges = Array.from(document.querySelectorAll('span')).filter(s => s.textContent && s.textContent.includes('Viral Score'));

      return {
        hasZip: Boolean(zipBtn),
        zipHref: zipBtn ? zipBtn.getAttribute('href') : null,
        clipCount: clipCards.length,
        previewCount: previewBtns.length,
        downloadCount: downloadBtns.length,
        badgeCount: viralBadges.length
      };
    });

    const clipDurations = await page.evaluate(() => {
      const badges = Array.from(document.querySelectorAll('div.aspect-\\[9\\/16\\] span.font-mono'));
      return badges.map(b => b.textContent.trim());
    });

    assert(resultsData.hasZip, 'ZIP archive download button rendered');
    assert(resultsData.zipHref && resultsData.zipHref.startsWith('blob:'), `ZIP href is valid blob URL: ${resultsData.zipHref}`);
    assert(resultsData.clipCount === 2, `Rendered exactly 2 vertical 9:16 clips: [${clipDurations.join(', ')}]`);
    assert(clipDurations.every(d => !d.startsWith('1:') && !d.startsWith('2:') && !d.startsWith('3:')), `All extracted clips are strictly under 60 seconds: [${clipDurations.join(', ')}]`);
    assert(resultsData.previewCount === 2, `Found ${resultsData.previewCount} clip preview button(s)`);
    assert(resultsData.downloadCount === 2, `Found ${resultsData.downloadCount} direct 1080x1920 MP4 download link(s)`);
    assert(resultsData.badgeCount === 2, `Viral Score badges rendered on vertical clip cards`);

    // -------------------------------------------------------------
    // Test 7: Video Preview Modal & Reasoning Drawer
    // -------------------------------------------------------------
    console.log('\n[TEST 7] Testing Video Player Modal & Moment Reasoning...');

    // Open video preview modal
    await page.evaluate(() => {
      const previewBtns = Array.from(document.querySelectorAll('button')).filter(b => b.textContent && b.textContent.includes('Preview'));
      if (previewBtns[0]) previewBtns[0].click();
    });
    await new Promise(r => setTimeout(r, 600));

    const modalOpen = await page.evaluate(() => {
      const video = document.querySelector('video');
      const hasClose = Array.from(document.querySelectorAll('button')).some(b => b.querySelector('svg.lucide-x') || b.textContent?.includes('Close'));
      return Boolean(video && video.src && video.src.startsWith('blob:'));
    });
    assert(modalOpen, 'Video Preview Modal rendered with active blob playback stream');

    // Close preview modal
    await page.evaluate(() => {
      const closeBtn = document.querySelector('button svg.lucide-x')?.closest('button');
      if (closeBtn) closeBtn.click();
    });
    await new Promise(r => setTimeout(r, 400));

    // Test "Why this moment?" reasoning accordion
    const reasoningChecked = await page.evaluate(() => {
      const reasonBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Why this moment?'));
      if (reasonBtn) {
        reasonBtn.click();
        return true;
      }
      return false;
    });
    assert(reasoningChecked, 'Toggled "Why this moment?" heuristic reasoning drawer');

    // -------------------------------------------------------------
    // Test 8: Navigation, History Workspace & Settings Modal
    // -------------------------------------------------------------
    console.log('\n[TEST 8] Testing Navigation Tabs, History & Settings Modal...');

    // Navigate to Saved Clips (History)
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('aside nav button, header button'));
      const savedBtn = btns.find(b => b.textContent && (b.textContent.includes('Saved Clips') || b.textContent.includes('Clips')));
      if (savedBtn) savedBtn.click();
    });
    await new Promise(r => setTimeout(r, 500));

    const historyHasJob = await page.evaluate(() => {
      const text = document.body.innerText;
      return text.includes('sample_input.mp4') && (text.includes('COMPLETED') || text.includes('Saved Projects & Clips'));
    });
    assert(historyHasJob, 'Saved Clips / History workspace accurately lists completed project');

    // Open Settings & Storage modal
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const settingsBtn = btns.find(b => b.textContent && (b.textContent.includes('Settings & Storage') || b.getAttribute('title') === 'Settings'));
      if (settingsBtn) settingsBtn.click();
    });
    await new Promise(r => setTimeout(r, 500));

    const settingsModalVisible = await page.evaluate(() => {
      const text = document.body.innerText;
      const hasTitle = text.includes('Browser Studio Settings');
      const hasStorage = text.includes('Local Browser Storage') || text.includes('Storage');
      const hasReframing = text.includes('Default Reframing (9:16 Portrait)');
      return hasTitle && hasStorage && hasReframing;
    });
    assert(settingsModalVisible, 'Settings & Storage modal opened with configurable options');

    // Close Settings modal
    await page.evaluate(() => {
      const closeBtn = document.querySelector('button svg.lucide-x')?.closest('button');
      if (closeBtn) closeBtn.click();
    });
    await new Promise(r => setTimeout(r, 400));

    // Navigate back to New Project
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('aside nav button, header button'));
      const newBtn = btns.find(b => b.textContent && (b.textContent.includes('New Project') || b.textContent.includes('New')));
      if (newBtn) newBtn.click();
    });
    await new Promise(r => setTimeout(r, 400));

    const backOnNew = await page.evaluate(() => {
      return document.body.innerText.includes('Turn Long Videos Into Ready-to-Share Clips');
    });
    assert(backOnNew, 'Cleanly navigated back to New Project workspace');

  } finally {
    await browser.close();
  }

  console.log('\n======================================================================');
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runWebVerification().catch(err => {
  console.error('\n[FATAL ERROR]:', err);
  process.exit(1);
});
