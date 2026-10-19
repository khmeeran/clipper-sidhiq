const puppeteer = require('./frontend/node_modules/puppeteer-core');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

async function runBrowserTest() {
  console.log('=== STARTING BROWSER E2E TEST IN REAL GOOGLE CHROME ===');

  const distDir = path.join(__dirname, 'frontend', 'dist');
  const sampleVideoPath = path.join(__dirname, 'test_data', 'sample_input.mp4');

  if (!fs.existsSync(sampleVideoPath)) {
    console.error('Sample video not found at:', sampleVideoPath);
    process.exit(1);
  }

  // 1. Launch Vite preview server
  console.log('Starting local Vite preview server on port 4173...');
  const server = spawn('npx', ['vite', 'preview', '--port', '4173', '--host', '127.0.0.1'], {
    cwd: path.join(__dirname, 'frontend'),
    shell: true
  });

  server.stdout.on('data', (d) => console.log(`[Preview Server]: ${d.toString().trim()}`));
  server.stderr.on('data', (d) => console.log(`[Preview Server Err]: ${d.toString().trim()}`));

  // Wait 3 seconds for server to bind
  await new Promise(r => setTimeout(r, 3000));

  // 2. Launch Google Chrome
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  console.log(`Launching Chrome from ${chromePath}...`);

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--autoplay-policy=no-user-gesture-required',
      '--disable-web-security',
      '--enable-features=SharedArrayBuffer'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  page.on('console', msg => console.log(`[Browser Console ${msg.type()}]: ${msg.text()}`));
  page.on('pageerror', err => console.error(`[Browser Page Error]: ${err.message}`));

  try {
    // 3. Navigate to application
    console.log('Navigating to http://127.0.0.1:4173 ...');
    await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle0' });

    const title = await page.title();
    console.log(`Page Loaded! Title: "${title}"`);

    // 4. Select Video File
    console.log(`Selecting local test video: ${sampleVideoPath}`);
    const fileInput = await page.$('input[type="file"]');
    if (!fileInput) throw new Error('File input not found on page.');

    await fileInput.uploadFile(sampleVideoPath);
    console.log('File uploaded to input element!');

    // Wait for client metadata preview card to appear
    await page.waitForSelector('h3', { timeout: 5000 });
    const fileNameText = await page.evaluate(() => document.querySelector('h3')?.textContent);
    console.log(`Detected client-side video card: "${fileNameText}"`);

    // 5. Click "Find My Best Clips (Process In-Browser)"
    console.log('Triggering in-browser processing...');
    const processBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find(b => b.textContent?.includes('Find My Best Clips'));
    });

    if (!processBtn) throw new Error('Action button not found.');
    await processBtn.click();
    console.log('Clicked "Find My Best Clips" button!');

    // 6. Monitor Processing View
    console.log('Waiting for in-browser processing to complete...');
    // Poll progress
    let completed = false;
    let attempts = 0;
    while (!completed && attempts < 120) { // 120 seconds max
      await new Promise(r => setTimeout(r, 1000));
      attempts++;

      const status = await page.evaluate(() => {
        const stageMsg = document.querySelector('.text-gray-300.font-medium')?.textContent || '';
        const pctText = document.querySelector('.text-purple-300.font-semibold')?.textContent || '';
        const isCompleted = document.body.innerText.includes('Browser Video Clipping Complete!') ||
                            document.body.innerText.includes('Viral Moment at') ||
                            document.body.innerText.includes('In-Browser AI Results');
        const hasFailed = document.body.innerText.includes('Browser Pipeline Interrupted');
        return { stageMsg, pctText, isCompleted, hasFailed };
      });

      console.log(`[Processing Step ${attempts}s]: ${status.pctText} - ${status.stageMsg}`);

      if (status.hasFailed) {
        throw new Error(`Pipeline failed during browser execution: ${status.stageMsg}`);
      }

      if (status.isCompleted) {
        completed = true;
        console.log('>>> IN-BROWSER PROCESSING FINISHED SUCCESSFULLY! <<<');
      }
    }

    if (!completed) {
      throw new Error('Pipeline timed out before completion.');
    }

    // 7. Click "View & Download Clips" if button exists
    const viewClipsBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find(b => b.textContent?.includes('View & Download Clips'));
    });
    if (viewClipsBtn) {
      try {
        await viewClipsBtn.click();
      } catch (_) {}
    }

    await new Promise(r => setTimeout(r, 2000));

    // 8. Inspect Generated Results Grid
    const results = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.rounded-2xl.bg-\\[\\#0f1118\\]'));
      return cards.map(c => {
        const title = c.querySelector('h3')?.textContent || '';
        const score = c.querySelector('.text-xs.font-bold')?.textContent || '';
        const duration = c.querySelector('.font-mono')?.textContent || '';
        const downloadHref = c.querySelector('a[download]')?.getAttribute('href') || '';
        return { title, score, duration, hasDownload: !!downloadHref };
      });
    });

    console.log('\n=== GENERATED CLIP RESULTS IN BROWSER ===');
    console.log(JSON.stringify(results, null, 2));

    if (results.length === 0) {
      throw new Error('No clip cards found in results grid.');
    }

    // 9. Download both the generated MP4 directly and the ZIP archive
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

    const testMp4Path = path.join(__dirname, 'test_data', 'direct_rendered_clip.mp4');
    fs.writeFileSync(testMp4Path, Buffer.from(clipBlobData));
    console.log(`Saved browser-rendered MP4 to ${testMp4Path} (${clipBlobData.length} bytes)`);

    console.log('Downloading generated ZIP package from browser memory...');
    const zipBlobData = await page.evaluate(async () => {
      const zipLink = document.querySelector('a[download$=".zip"]');
      if (!zipLink) return null;
      const href = zipLink.getAttribute('href');
      const res = await fetch(href);
      const arrayBuf = await res.arrayBuffer();
      return Array.from(new Uint8Array(arrayBuf));
    });

    if (zipBlobData && zipBlobData.length > 0) {
      const testZipPath = path.join(__dirname, 'test_data', 'browser_all_clips.zip');
      fs.writeFileSync(testZipPath, Buffer.from(zipBlobData));
      console.log(`Saved browser-rendered ZIP to ${testZipPath} (${zipBlobData.length} bytes)`);
    }

    console.log('\n=== ALL BROWSER E2E TESTS PASSED 100% ===');

  } catch (err) {
    console.error('Browser Test Error:', err);
    throw err;
  } finally {
    await browser.close();
    server.kill();
  }
}

runBrowserTest()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
