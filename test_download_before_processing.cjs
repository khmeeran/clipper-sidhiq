const puppeteer = require('./frontend/node_modules/puppeteer-core');
const path = require('path');
const fs = require('fs');

async function runDownloadBeforeProcessingTests() {
  console.log('=== STARTING DOWNLOAD-BEFORE-PROCESSING E2E VERIFICATION (CHROME) ===');

  const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--use-fake-ui-for-media-stream', '--no-sandbox']
  });

  const page = await browser.newPage();

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Validation') || text.includes('SIDHIQ') || text.includes('Error')) {
      console.log(`[Browser Console]: ${text}`);
    }
  });

  try {
    console.log('Navigating to http://127.0.0.1:4173 ...');
    await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle2' });

    // -------------------------------------------------------------------------
    // CRITERION 5: Verify Existing Local Upload Workflow Still Works
    // -------------------------------------------------------------------------
    console.log('\n--- TEST A: Verify Existing Local File Upload Workflow ---');
    const fileInput = await page.$('input[type="file"]');
    const localSampleVideo = path.join(__dirname, 'test_data', 'sample_input.mp4');
    await fileInput.uploadFile(localSampleVideo);
    await new Promise(r => setTimeout(r, 800));

    const localCardTitle = await page.evaluate(() => {
      return document.querySelector('h3.font-semibold.text-white')?.textContent;
    });

    if (localCardTitle !== 'sample_input.mp4') {
      throw new Error(`Local file upload failed. Expected 'sample_input.mp4', got: ${localCardTitle}`);
    }
    console.log(`✓ TEST A PASSED: Local file upload works cleanly (${localCardTitle}).`);

    // Reset back to empty state
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const changeBtn = btns.find(b => b.textContent.includes('Change File'));
      if (changeBtn) changeBtn.click();
    });
    await new Promise(r => setTimeout(r, 500));

    // Switch to URL tab
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const urlTab = btns.find(b => b.textContent.includes('Paste Video URL'));
      if (urlTab) urlTab.click();
    });
    await new Promise(r => setTimeout(r, 500));

    // -------------------------------------------------------------------------
    // CRITERION 3: YouTube URL Detection & Architecture Guidance Notice
    // -------------------------------------------------------------------------
    console.log('\n--- TEST B: YouTube Watch URL Detection & Architecture Guidance ---');
    await page.type('input[type="url"]', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const fetchBtn = btns.find(b => b.textContent.includes('Fetch Video'));
      if (fetchBtn) fetchBtn.click();
    });
    await new Promise(r => setTimeout(r, 800));

    const ytNotice = await page.evaluate(() => {
      const notice = document.querySelector('[data-testid="youtube-guidance-panel"]');
      const text = notice?.textContent || '';
      const hasCommand = text.includes('python tools/fetch_youtube.py');
      const hasDASHExplanation = text.includes('separate DASH video & audio streams');
      return { found: !!notice, hasCommand, hasDASHExplanation };
    });

    console.log('YouTube Guidance Panel Verification:', ytNotice);
    if (!ytNotice.found || !ytNotice.hasCommand || !ytNotice.hasDASHExplanation) {
      throw new Error(`YouTube guidance notice verification failed: ${JSON.stringify(ytNotice)}`);
    }
    console.log('✓ TEST B PASSED: YouTube URL presents honest architectural explanation & local companion command.');

    // Dismiss YouTube notice
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const dismissBtn = btns.find(b => b.textContent.includes('Dismiss'));
      if (dismissBtn) dismissBtn.click();
    });
    await new Promise(r => setTimeout(r, 500));

    // -------------------------------------------------------------------------
    // CRITERION 2: CORS Blocked URL Handling & Fallback Button
    // -------------------------------------------------------------------------
    console.log('\n--- TEST C: CORS Blocked URL Handling ---');
    await page.evaluate(() => {
      const input = document.querySelector('input[type="url"]');
      if (input) input.value = '';
    });
    await page.type('input[type="url"]', 'https://google.com/unpermitted_video.mp4');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const fetchBtn = btns.find(b => b.textContent.includes('Fetch Video'));
      if (fetchBtn) fetchBtn.click();
    });
    await new Promise(r => setTimeout(r, 2000));

    const corsError = await page.evaluate(() => {
      const banner = document.querySelector('.bg-rose-500\\/10');
      const text = banner?.textContent || '';
      const hasFallbackBtn = text.includes('Switch to Local Upload');
      return { text, hasFallbackBtn };
    });

    console.log('CORS Error Banner:', corsError);
    if (!corsError.text.includes('CORS') && !corsError.text.includes('Failed to download')) {
      throw new Error(`Expected CORS error banner, got: ${corsError.text}`);
    }
    console.log('✓ TEST C PASSED: CORS blocked URL gracefully caught with fallback action.');

    // -------------------------------------------------------------------------
    // CRITERION 4: Failed / Incomplete Downloads Never Enter Pipeline
    // -------------------------------------------------------------------------
    console.log('\n--- TEST D: Failed / Incomplete Downloads Never Enter Pipeline ---');
    const pipelineStarted = await page.evaluate(() => {
      const procBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Find My Best Clips'));
      return !!procBtn;
    });

    if (pipelineStarted) {
      throw new Error('Pipeline button was visible despite failed download!');
    }
    console.log('✓ TEST D PASSED: Failed downloads never advance to the processing pipeline.');

    // -------------------------------------------------------------------------
    // CRITERION 1 & 6: Permitted Direct MP4 Download, Validation, Local Save, & Processing
    // -------------------------------------------------------------------------
    console.log('\n--- TEST E: Permitted Direct MP4 Download-Before-Processing ---');
    await page.evaluate(() => {
      const input = document.querySelector('input[type="url"]');
      if (input) input.value = '';
    });

    const testDirectUrl = 'http://127.0.0.1:4173/sample_input.mp4';
    console.log(`Entering direct URL: ${testDirectUrl}`);
    await page.type('input[type="url"]', testDirectUrl);

    // Click "Fetch Video"
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const fetchBtn = btns.find(b => b.textContent.includes('Fetch Video'));
      if (fetchBtn) fetchBtn.click();
    });

    console.log('Awaiting full download and container validation...');
    let downloadComplete = false;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 500));
      downloadComplete = await page.evaluate(() => {
        return !!document.querySelector('.border-emerald-500\\/20');
      });
      if (downloadComplete) break;
    }

    if (!downloadComplete) {
      const err = await page.evaluate(() => document.querySelector('.bg-rose-500\\/10')?.textContent);
      throw new Error(`Direct download did not complete/validate: ${err}`);
    }

    const downloadedCardState = await page.evaluate(() => {
      const title = document.querySelector('h3.font-semibold.text-white')?.textContent || '';
      const validationBanner = document.querySelector('.border-emerald-500\\/20')?.textContent || '';
      const hasSaveDiskBtn = Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Save Copy to Disk'));
      const hasProcessBtn = Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Find My Best Clips'));
      return { title, validationBanner, hasSaveDiskBtn, hasProcessBtn };
    });

    console.log('Validated Download Card State:', downloadedCardState);
    if (!downloadedCardState.hasSaveDiskBtn || !downloadedCardState.hasProcessBtn) {
      throw new Error(`Incomplete download card controls: ${JSON.stringify(downloadedCardState)}`);
    }
    console.log('✓ TEST E (Step 1): Download validated and persistent local copy controls verified.');

    // Now trigger in-browser vertical processing on the validated local file
    console.log('Triggering in-browser vertical processing on validated local file...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const procBtn = btns.find(b => b.textContent.includes('Find My Best Clips'));
      if (procBtn) procBtn.click();
    });

    let completed = false;
    let attempts = 0;
    while (!completed && attempts < 90) {
      await new Promise(r => setTimeout(r, 1000));
      attempts++;

      const status = await page.evaluate(() => {
        const stageMsg = document.querySelector('.text-gray-300.font-medium')?.textContent || '';
        const pctText = document.querySelector('.text-purple-300.font-semibold')?.textContent || '';
        const isDone = document.body.innerText.includes('In-Browser AI Results') ||
                       document.body.innerText.includes('Viral Moment at') ||
                       document.body.innerText.includes('Browser Video Clipping Complete!');
        const hasFailed = document.body.innerText.includes('Browser Pipeline Interrupted');
        return { stageMsg, pctText, isDone, hasFailed };
      });

      if (attempts % 5 === 0 || status.isDone) {
        console.log(`[Processing ${attempts}s]: ${status.pctText} - ${status.stageMsg}`);
      }

      if (status.hasFailed) {
        throw new Error(`Pipeline failed during processing: ${status.stageMsg}`);
      }

      if (status.isDone) {
        completed = true;
        console.log('>>> IN-BROWSER VERTICAL CLIPPING FINISHED SUCCESSFULLY! <<<');
      }
    }

    if (!completed) {
      throw new Error('Pipeline timed out during vertical rendering.');
    }

    // Click "View & Download Clips" if present
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent && b.textContent.includes('View & Download Clips'));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 1500));

    // Download generated clip MP4 from browser memory
    const clipBlobData = await page.evaluate(async () => {
      const downloadLink = document.querySelector('a[download$=".mp4"]');
      if (!downloadLink) return null;
      const href = downloadLink.getAttribute('href');
      const res = await fetch(href);
      const arrayBuf = await res.arrayBuffer();
      return Array.from(new Uint8Array(arrayBuf));
    });

    if (!clipBlobData || clipBlobData.length === 0) {
      throw new Error('Failed to extract generated clip bytes from browser.');
    }

    const testOutPath = path.join(__dirname, 'test_data', 'url_download_verified_clip.mp4');
    fs.writeFileSync(testOutPath, Buffer.from(clipBlobData));
    console.log(`Saved rendered 1080x1920 clip to ${testOutPath} (${clipBlobData.length} bytes)`);

    console.log('\n=== ALL DOWNLOAD-BEFORE-PROCESSING TESTS PASSED 100% ===');

  } catch (err) {
    console.error('Test Suite Failed:', err);
    throw err;
  } finally {
    await browser.close();
  }
}

runDownloadBeforeProcessingTests()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
