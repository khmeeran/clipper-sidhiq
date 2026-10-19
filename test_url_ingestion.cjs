const puppeteer = require('./frontend/node_modules/puppeteer-core');
const path = require('path');
const fs = require('fs');

async function testUrlIngestion() {
  console.log('=== STARTING URL INGESTION E2E TEST IN GOOGLE CHROME ===');
  
  const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--use-fake-ui-for-media-stream', '--no-sandbox']
  });

  const page = await browser.newPage();

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('SIDHIQ') || text.includes('Audio') || text.includes('Video') || text.includes('Error')) {
      console.log(`[Browser Console]: ${text}`);
    }
  });

  try {
    console.log('Navigating to http://127.0.0.1:4173 ...');
    await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle2' });

    // 1. Click "Paste Video URL" Tab
    console.log('Switching to "Paste Video URL" tab...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const urlTab = btns.find(b => b.textContent.includes('Paste Video URL'));
      if (urlTab) urlTab.click();
    });

    await new Promise(r => setTimeout(r, 500));

    // -------------------------------------------------------------------------
    // TEST 1: YouTube Watch URL Detection
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 1: Testing YouTube Streaming URL (Blocked with Guidance) ---');
    await page.type('input[type="url"]', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    
    // Click "Fetch Video"
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const fetchBtn = btns.find(b => b.textContent.includes('Fetch Video'));
      if (fetchBtn) fetchBtn.click();
    });

    await new Promise(r => setTimeout(r, 500));

    const ytError = await page.evaluate(() => {
      const banner = document.querySelector('.bg-rose-500\\/10');
      return banner ? banner.textContent : null;
    });

    console.log('YouTube Error Result:', ytError);
    if (!ytError || !ytError.includes('YouTube watch URLs are streaming webpages')) {
      throw new Error(`Expected YouTube streaming explanation, got: ${ytError}`);
    }
    console.log('✓ TEST 1 PASSED: YouTube streaming URLs correctly rejected with guidance to use local upload.');

    // -------------------------------------------------------------------------
    // TEST 2: CORS Blocked URL Handling
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: Testing CORS Blocked External URL ---');
    // Clear URL input
    await page.evaluate(() => {
      const input = document.querySelector('input[type="url"]');
      if (input) input.value = '';
    });
    // Type an external URL known to restrict cross-origin requests
    await page.type('input[type="url"]', 'https://google.com/test_video.mp4');
    
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const fetchBtn = btns.find(b => b.textContent.includes('Fetch Video'));
      if (fetchBtn) fetchBtn.click();
    });

    await new Promise(r => setTimeout(r, 2000));

    const corsError = await page.evaluate(() => {
      const banner = document.querySelector('.bg-rose-500\\/10');
      return banner ? banner.textContent : null;
    });

    console.log('CORS Error Result:', corsError);
    if (!corsError || (!corsError.includes('CORS') && !corsError.includes('Failed to retrieve'))) {
      throw new Error(`Expected CORS or network error, got: ${corsError}`);
    }
    console.log('✓ TEST 2 PASSED: CORS restrictions caught with clear fallback messaging.');

    // -------------------------------------------------------------------------
    // TEST 3: Permitted Direct MP4 Ingestion & In-Browser Vertical Processing
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: Testing Permitted Direct MP4 Ingestion ---');
    await page.evaluate(() => {
      const input = document.querySelector('input[type="url"]');
      if (input) input.value = '';
    });

    const directMp4Url = 'http://127.0.0.1:4173/sample_input.mp4';
    console.log(`Entering direct URL: ${directMp4Url}`);
    await page.type('input[type="url"]', directMp4Url);

    // Click "Fetch Video"
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const fetchBtn = btns.find(b => b.textContent.includes('Fetch Video'));
      if (fetchBtn) fetchBtn.click();
    });

    console.log('Fetching direct MP4 into browser memory...');

    // Wait for file card to appear
    let fileLoaded = false;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 500));
      fileLoaded = await page.evaluate(() => {
        return !!document.querySelector('.w-12.h-12.rounded-xl.bg-purple-500\\/20');
      });
      if (fileLoaded) break;
    }

    if (!fileLoaded) {
      const errMsg = await page.evaluate(() => document.querySelector('.bg-rose-500\\/10')?.textContent);
      throw new Error(`Failed to ingest direct MP4: ${errMsg}`);
    }

    const videoCardInfo = await page.evaluate(() => {
      const title = document.querySelector('h3.font-semibold.text-white')?.textContent || '';
      const details = document.querySelector('.flex.items-center.space-x-3.text-xs.text-gray-400')?.textContent || '';
      return { title, details };
    });

    console.log('Successfully ingested direct MP4 into client memory:');
    console.log(`  Filename: ${videoCardInfo.title}`);
    console.log(`  Metadata: ${videoCardInfo.details}`);

    // Trigger full clipping pipeline
    console.log('\nTriggering in-browser vertical processing on ingested URL video...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const procBtn = btns.find(b => b.textContent.includes('Find My Best Clips'));
      if (procBtn) procBtn.click();
    });

    // Wait for in-browser rendering to complete
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
        throw new Error(`Pipeline failed during URL video execution: ${status.stageMsg}`);
      }

      if (status.isDone) {
        completed = true;
        console.log('>>> URL VIDEO INGESTION & VERTICAL CLIPPING FINISHED SUCCESSFULLY! <<<');
      }
    }

    if (!completed) {
      throw new Error('Pipeline timed out during URL video rendering.');
    }

    // Click "View & Download Clips" if present
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent && b.textContent.includes('View & Download Clips'));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 1500));

    // Download rendered clip directly from browser memory
    console.log('Downloading generated clip MP4 from browser memory...');
    const clipBlobData = await page.evaluate(async () => {
      const downloadLink = document.querySelector('a[download$=".mp4"]');
      if (!downloadLink) return null;
      const href = downloadLink.getAttribute('href');
      const res = await fetch(href);
      const arrayBuf = await res.arrayBuffer();
      return Array.from(new Uint8Array(arrayBuf));
    });

    if (!clipBlobData || clipBlobData.length === 0) {
      throw new Error('Failed to extract generated MP4 bytes from browser.');
    }

    const exportPath = path.join(__dirname, 'test_data', 'url_ingested_rendered_clip.mp4');
    fs.writeFileSync(exportPath, Buffer.from(clipBlobData));
    console.log(`Saved URL-ingested vertical MP4 to ${exportPath} (${clipBlobData.length} bytes)`);

    console.log('\n=== ALL URL INGESTION TESTS PASSED 100% ===');

  } catch (err) {
    console.error('URL Ingestion Test Error:', err);
    throw err;
  } finally {
    await browser.close();
  }
}

testUrlIngestion()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
