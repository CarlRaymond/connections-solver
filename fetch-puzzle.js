// fetch-puzzle.js
// Usage: node fetch-puzzle.js <gameId>
// Fetches a NYT Connections puzzle solution from connectionsplus.io and prints CSV to stdout.
// CSV format: "word1", "word2", "word3", "word4"  (one group per line, 4 lines total)

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function fetchPuzzle(gameId) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`https://connectionsplus.io/game/${gameId}`, { waitUntil: 'networkidle', timeout: 30000 });

  // Dismiss any modal
  try { await page.keyboard.press('Escape'); await page.waitForTimeout(300); } catch {}

  // Get the 16 word tiles to determine if puzzle loaded properly
  const words = await page.evaluate(() =>
    Array.from(document.querySelectorAll('button'))
      .map(b => b.textContent.trim())
      .filter(t => t.length >= 1 && t.length <= 20 && t === t.toUpperCase() && /^[A-Z0-9][A-Z0-9\s',\-&.]*$/.test(t))
  );

  if (words.length < 16) {
    await browser.close();
    throw new Error(`Expected 16 words, found ${words.length} — puzzle ${gameId} may not exist`);
  }

  // Keep guessing until "Reveal Answer" appears. Rotate the offset each round so we
  // never submit the same 4 tiles twice (which would waste the mistake counter).
  for (let round = 0; round < 12; round++) {
    const remaining = await page.evaluate(() =>
      Array.from(document.querySelectorAll('button'))
        .map(b => b.textContent.trim())
        .filter(t => t.length >= 1 && t.length <= 20 && t === t.toUpperCase() && /^[A-Z0-9][A-Z0-9\s',\-&.]*$/.test(t))
    );
    if (remaining.length < 4) break;

    const off = (round * 4) % remaining.length;
    const pick = [0, 1, 2, 3].map(i => remaining[(off + i) % remaining.length]);

    for (const word of pick) {
      await page.evaluate(w => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === w);
        if (btn) btn.click();
      }, word);
      await page.waitForTimeout(150);
    }
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Submit');
      if (btn) btn.click();
    });
    await page.waitForTimeout(2500);

    const hasReveal = await page.evaluate(() =>
      Array.from(document.querySelectorAll('button')).some(b => /reveal answer/i.test(b.textContent))
    );
    if (hasReveal) break;

    await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll('button')).find(b => /deselect/i.test(b.textContent));
      if (b) b.click();
    });
    await page.waitForTimeout(200);
  }

  // Click "Reveal Answer" via JS to bypass modal overlay
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => /reveal answer/i.test(b.textContent));
    if (btn) btn.click();
  });
  await page.waitForTimeout(5000);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1000);

  const bodyText = await page.evaluate(() => document.body.innerText);
  await browser.close();

  // Parse the 4 groups from body text
  // Pattern: CATEGORY NAME\nWORD1, WORD2, WORD3, WORD4
  const groups = [];
  const lines = bodyText.split('\n').map(l => l.trim()).filter(Boolean);

  for (let i = 0; i < lines.length - 1; i++) {
    const wordLine = lines[i + 1];
    const parts = wordLine.split(', ');
    if (parts.length === 4 && parts.every(w => /^[A-Z0-9][A-Z0-9\s',\-&.]*$/.test(w))) {
      groups.push(parts);
    }
  }

  if (groups.length !== 4) {
    throw new Error(`Expected 4 groups, found ${groups.length}.\nBody:\n${bodyText.substring(0, 2000)}`);
  }

  return groups;
}

function toCSV(groups) {
  return groups.map(g => g.map(w => `"${w}"`).join(', ')).join('\n') + '\n';
}

const gameId = parseInt(process.argv[2] || '1', 10);
const outFile = process.argv[3]; // optional output file path

fetchPuzzle(gameId).then(groups => {
  const csv = toCSV(groups);
  if (outFile) {
    fs.writeFileSync(outFile, csv);
    console.error(`Wrote puzzle ${gameId} to ${outFile}`);
  } else {
    process.stdout.write(csv);
  }
}).catch(err => {
  console.error(`Error fetching puzzle ${gameId}:`, err.message);
  process.exit(1);
});
