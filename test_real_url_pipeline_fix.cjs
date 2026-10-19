/**
 * Test script verifying that real URL ingestion, merge completion,
 * transcription, moment selection, vertical clipping, and export work without crashing.
 */

const BRIDGE_URL = 'http://127.0.0.1:4175';

async function testRealUrlPipeline() {
  console.log('===============================================================');
  console.log('TESTING REAL PIPELINE EXECUTION FOR ZERO CITY VIDEO');
  console.log('===============================================================\n');

  // Step 1: Healthcheck
  const hsRes = await fetch(`${BRIDGE_URL}/api/handshake`);
  const hsData = await hsRes.json();
  console.log('[1/4] Companion Bridge Status:', hsData.ok ? 'ONLINE' : 'OFFLINE');
  if (!hsData.ok) throw new Error('Bridge is not online');

  // Step 2: Trigger Create Clips with the real video that previously crashed
  console.log('[2/4] Triggering POST /api/create-clips for: Zero City video...');
  const createRes = await fetch(`${BRIDGE_URL}/api/create-clips`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: 'https://youtu.be/An4R9yCEeuI'
    })
  });

  const createData = await createRes.json();
  console.log('      Response:', createData);
  if (!createData.ok || !createData.jobId) {
    throw new Error(`Failed to create job: ${createData.error}`);
  }

  const jobId = createData.jobId;
  console.log(`      Job ID: ${jobId}`);

  // Step 3: Poll Pipeline Progression
  console.log('[3/4] Polling job progression through all 5 stages...');
  let lastStage = '';
  let lastPct = -1;
  const startTime = Date.now();

  while (true) {
    await new Promise(r => setTimeout(r, 1500));

    const pollRes = await fetch(`${BRIDGE_URL}/api/pipeline-job/${jobId}`);
    if (!pollRes.ok) {
      console.warn(`[WARN] Poll HTTP ${pollRes.status}`);
      continue;
    }

    const pollData = await pollRes.json();
    const job = pollData.job;

    if (!job) {
      console.warn('[WARN] No job returned');
      continue;
    }

    if (job.stage !== lastStage || job.percent !== lastPct) {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.log(`      [+${elapsed}s] Stage: ${job.stage} (${job.percent}%) — "${job.stageMessage}"`);
      lastStage = job.stage;
      lastPct = job.percent;
    }

    if (job.status === 'COMPLETED') {
      console.log('\n[4/4] SUCCESS! Pipeline completed successfully.');
      console.log('      Video Name   :', job.videoName);
      console.log('      Folder       :', job.folder);
      console.log('      Clips Count  :', job.clips.length);
      for (const clip of job.clips) {
        console.log(`      -> ${clip.title}: ${clip.duration}s (${clip.width}x${clip.height}, ${clip.sizeMB} MB)`);
      }
      console.log('      Transcript   :', job.transcriptTxt);
      console.log('      SRT Subtitles:', job.transcriptSrt);
      console.log('      ZIP Archive  :', job.zipFile, `(${job.zipSizeMB} MB)`);
      break;
    }

    if (job.status === 'FAILED') {
      throw new Error(`Pipeline job failed: ${job.error || job.stageMessage}`);
    }

    if (job.status === 'CANCELLED') {
      throw new Error('Pipeline job was cancelled.');
    }

    // Safety timeout: 10 minutes
    if (Date.now() - startTime > 600000) {
      throw new Error('Pipeline timed out after 10 minutes.');
    }
  }

  console.log('\n===============================================================');
  console.log('TEST COMPLETE — ALL STAGES VERIFIED WITH REAL OUTPUTS');
  console.log('===============================================================\n');
}

testRealUrlPipeline().catch(err => {
  console.error('\n[FATAL TEST FAILURE]:', err.message);
  process.exit(1);
});
