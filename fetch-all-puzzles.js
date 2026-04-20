// fetch-all-puzzles.js
// Harvests all NYT Connections puzzle solutions from connectionsplus.io
// Saves each as puzzle-YYYY-MM-DD.csv in the script's directory
// Usage: node fetch-all-puzzles.js [startId] [endId] [concurrency]

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT_DIR = __dirname;
const BASE_DATE = new Date('2023-06-12T00:00:00Z'); // Puzzle #1 date

function puzzleDate(id) {
  const d = new Date(BASE_DATE);
  d.setUTCDate(d.getUTCDate() + (id - 1));
  return d.toISOString().substring(0, 10);
}

function outPath(id) {
  return path.join(OUT_DIR, `puzzle-${puzzleDate(id)}.csv`);
}

function toCSV(groups) {
  return groups.map(g => g.map(w => `"${w}"`).join(', ')).join('\n') + '\n';
}

async function fetchPuzzle(browser, gameId) {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto(`https://connectionsplus.io/game/${gameId}`, { waitUntil: 'networkidle', timeout: 30000 });
    // Dismiss any modal with Escape — all subsequent clicks use JS so overlays don't matter
    try { await page.keyboard.press('Escape'); await page.waitForTimeout(200); } catch {}

    const words = await page.evaluate(() =>
      Array.from(document.querySelectorAll('button'))
        .map(b => b.textContent.trim())
        .filter(t => t.length >= 1 && t.length <= 20 && t === t.toUpperCase() && /^[A-Z0-9][A-Z0-9\s',\-&.]*$/.test(t))
    );

    if (words.length < 16) return null; // Puzzle doesn't exist

    for (let round = 0; round < 12; round++) {
      const remaining = await page.evaluate(() =>
        Array.from(document.querySelectorAll('button'))
          .map(b => b.textContent.trim())
          .filter(t => t.length >= 1 && t.length <= 20 && t === t.toUpperCase() && /^[A-Z0-9][A-Z0-9\s',\-&.]*$/.test(t))
      );
      if (remaining.length < 4) break;

      // Pick 4 consecutive tiles starting at a rotating offset — always distinct, never the same guess twice
      const off = (round * 4) % remaining.length;
      const pick = [0, 1, 2, 3].map(i => remaining[(off + i) % remaining.length]);

      for (const word of pick) {
        await page.evaluate(w => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === w);
          if (btn) btn.click();
        }, word);
        await page.waitForTimeout(120);
      }
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Submit');
        if (btn) btn.click();
      });
      await page.waitForTimeout(2200);

      const hasReveal = await page.evaluate(() =>
        Array.from(document.querySelectorAll('button')).some(b => /reveal answer/i.test(b.textContent))
      );
      if (hasReveal) break;

      await page.evaluate(() => {
        const b = Array.from(document.querySelectorAll('button')).find(b => /deselect/i.test(b.textContent));
        if (b) b.click();
      });
      await page.waitForTimeout(150);
    }

    // Click Reveal Answer
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => /reveal answer/i.test(b.textContent));
      if (btn) btn.click();
    });
    await page.waitForTimeout(4500);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(800);

    const bodyText = await page.evaluate(() => document.body.innerText);

    // Parse groups: CATEGORY\nWORD1, WORD2, WORD3, WORD4
    const groups = [];
    const lines = bodyText.split('\n').map(l => l.trim()).filter(Boolean);
    for (let i = 0; i < lines.length - 1; i++) {
      const parts = lines[i + 1].split(', ');
      if (parts.length === 4 && parts.every(w => /^[A-Z0-9][A-Z0-9\s',\-&.]*$/.test(w))) {
        groups.push(parts);
      }
    }

    if (groups.length !== 4) return null;
    return groups;
  } finally {
    await context.close();
  }
}

async function main() {
  const startId   = parseInt(process.argv[2] || '1',  10);
  const endId     = parseInt(process.argv[3] || '1100', 10);
  const concurrency = parseInt(process.argv[4] || '3', 10);

  // Determine which puzzles still need fetching
  const todo = [];
  for (let id = startId; id <= endId; id++) {
    if (!fs.existsSync(outPath(id))) todo.push(id);
  }

  console.log(`Fetching ${todo.length} puzzles (${startId}–${endId}), concurrency=${concurrency}`);

  const browser = await chromium.launch({ headless: true });
  let done = 0;
  let consecutiveNulls = 0;

  async function worker(ids) {
    for (const id of ids) {
      try {
        const groups = await fetchPuzzle(browser, id);
        if (groups === null) {
          consecutiveNulls++;
          console.log(`[${id}] ${puzzleDate(id)} — not found`);
          if (consecutiveNulls >= 5) {
            console.log('5 consecutive missing puzzles — stopping');
            process.exit(0);
          }
        } else {
          consecutiveNulls = 0;
          const csv = toCSV(groups);
          fs.writeFileSync(outPath(id), csv);
          done++;
          console.log(`[${id}] ${puzzleDate(id)} — saved (${done}/${todo.length})`);
        }
      } catch (err) {
        console.error(`[${id}] error: ${err.message}`);
      }
    }
  }

  // Split work across concurrent workers
  const chunkSize = Math.ceil(todo.length / concurrency);
  const chunks = [];
  for (let i = 0; i < concurrency; i++) {
    chunks.push(todo.slice(i * chunkSize, (i + 1) * chunkSize));
  }

  await Promise.all(chunks.map(worker));
  await browser.close();
  console.log(`Done. ${done} puzzles saved.`);
}

main().catch(err => { console.error(err); process.exit(1); });
