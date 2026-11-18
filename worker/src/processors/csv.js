const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const config = require('../config');
const { sleep, log, progress } = require('../lib');

/** Stream-parse a CSV and report row/column statistics without loading it into memory. */
function analyseCsv(file) {
  return new Promise((resolve, reject) => {
    let rows = 0;
    let empty = 0;
    let columns = [];
    fs.createReadStream(file)
      .pipe(csv())
      .on('headers', (h) => (columns = h))
      .on('data', (row) => {
        rows += 1;
        if (Object.values(row).some((v) => String(v).trim() === '')) empty += 1;
      })
      .on('end', () => resolve({ rows, columns, rowsWithEmptyCells: empty, validRows: rows - empty }))
      .on('error', reject);
  });
}

async function processCsv(job) {
  const { file, originalName } = job.data;
  if (!file) throw new Error('No CSV file attached to this job');

  const root = path.resolve(config.dataDir);
  const full = path.resolve(root, file);
  if (!full.startsWith(root + path.sep)) throw new Error('Invalid file path');
  if (!fs.existsSync(full)) throw new Error(`Uploaded file not found: ${originalName || file}`);

  await log(job, 'info', `Parsing ${originalName || path.basename(full)}`);
  await progress(job, 15);
  await sleep(config.simulateWorkMs / 2);

  const stats = await analyseCsv(full);
  if (!stats.columns.length) throw new Error('CSV has no header row');
  await progress(job, 85);
  await log(job, 'info', `Parsed ${stats.rows} rows across ${stats.columns.length} columns (${stats.rowsWithEmptyCells} with empty cells)`);

  await progress(job, 100);
  return stats;
}

module.exports = { processCsv, analyseCsv };
