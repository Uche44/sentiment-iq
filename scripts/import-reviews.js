const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const pool = require('../src/db');
const config = require('../src/config');

const BATCH_SIZE = 500;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST_NAMES = [
  'Adaeze',
  'Chinedu',
  'Emeka',
  'Ngozi',
  'Ifeanyi',
  'Amaka',
  'Obinna',
  'Chioma',
  'Tunde',
  'Bola',
  'Yemi',
  'Kelechi',
  'Uche',
  'Nneka',
  'Femi',
  'Sade',
  'Ikenna',
  'Ada',
  'Chidi',
  'Nkem',
  'Efe',
  'Osas',
  'Zainab',
  'Aisha',
  'Musa',
  'Ibrahim',
  'Blessing',
  'Gift',
  'Precious',
  'Segun',
  'Kunle',
  'Yewande',
  'Temi',
  'Damilola',
  'Tolulope',
  'Onyeka',
  'Nnamdi',
  'Chinaza',
  'Somto',
  'Ezinne',
  'James',
  'Mary',
  'John',
  'Patricia',
  'Robert',
  'Jennifer',
  'Michael',
  'Linda',
  'William',
  'Elizabeth',
  'David',
  'Barbara',
  'Richard',
  'Susan',
  'Joseph',
  'Jessica',
  'Thomas',
  'Sarah',
  'Charles',
  'Karen',
  'Olivia',
  'Liam',
  'Emma',
  'Noah',
  'Ava',
  'Sophia',
  'Lucas',
  'Mia',
  'Mason',
  'Isabella',
  'Ethan',
  'Amelia',
  'Daniel',
  'Grace',
  'Henry',
  'Chloe',
  'Peter',
  'Hannah',
  'Samuel',
  'Laura',
];

const LAST_NAMES = [
  'Okonkwo',
  'Adeyemi',
  'Balogun',
  'Eze',
  'Okafor',
  'Nwosu',
  'Adebayo',
  'Ogundipe',
  'Chukwu',
  'Abubakar',
  'Ibrahim',
  'Oyelaran',
  'Afolabi',
  'Ibe',
  'Umeh',
  'Oni',
  'Akinyemi',
  'Nwachukwu',
  'Obi',
  'Danjuma',
  'Musa',
  'Bello',
  'Ogunleye',
  'Olawale',
  'Nnaji',
  'Ezeudu',
  'Aliyu',
  'Yakubu',
  'Ekpo',
  'Bassey',
  'Effiong',
  'Udo',
  'Etim',
  'Okoro',
  'Madu',
  'Ndukwe',
  'Anya',
  'Uche',
  'Ijeoma',
  'Nkemdirim',
  'Smith',
  'Johnson',
  'Williams',
  'Brown',
  'Jones',
  'Garcia',
  'Miller',
  'Davis',
  'Rodriguez',
  'Martinez',
  'Hernandez',
  'Lopez',
  'Gonzalez',
  'Wilson',
  'Anderson',
  'Thomas',
  'Taylor',
  'Moore',
  'Jackson',
  'Martin',
  'Lee',
  'Perez',
  'Thompson',
  'White',
  'Harris',
  'Sanchez',
  'Clark',
  'Ramirez',
  'Lewis',
  'Robinson',
  'Walker',
  'Young',
  'Allen',
  'King',
  'Wright',
  'Scott',
  'Torres',
  'Nguyen',
  'Hill',
  'Flores',
];

function pad(n) {
  return String(n).padStart(2, '0');
}

function formatDateTime(date) {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

function randomName(rng) {
  const first = FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)];
  const last = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)];
  return `${first} ${last}`;
}

function seededShuffle(items, rng) {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function productNameFor(record, clothingId) {
  const className = String(record['Class Name'] || '').trim();
  const name = className ? `${className} #${clothingId}` : `Item #${clothingId}`;
  return name.slice(0, 100);
}

function categoryFor(record) {
  const department = String(record['Department Name'] || '').trim();
  return (department || 'Uncategorised').slice(0, 50);
}

function buildReviewText(record) {
  const title = String(record['Title'] || '').trim();
  const body = String(record['Review Text'] || '').trim();
  return title ? `${title}. ${body}` : body;
}

async function resetTables(connection) {
  await connection.query('SET FOREIGN_KEY_CHECKS = 0');
  await connection.query('TRUNCATE TABLE SentimentResults');
  await connection.query('TRUNCATE TABLE Reviews');
  await connection.query('TRUNCATE TABLE Products');
  await connection.query('SET FOREIGN_KEY_CHECKS = 1');
}

async function insertBatches(connection, sql, rows) {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await connection.query(sql, [batch]);
  }
}

async function main() {
  const reset = process.argv.slice(2).includes('--reset');
  const csvPath = path.resolve(process.cwd(), config.import.csvPath);

  const records = parse(fs.readFileSync(csvPath, 'utf8'), {
    columns: true,
    bom: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
  });

  const rowsRead = records.length;
  const valid = records.filter((r) => String(r['Review Text'] || '').trim() !== '');
  const rowsDropped = rowsRead - valid.length;

  const rng = mulberry32(config.import.randomSeed);
  const shuffled = seededShuffle(valid, rng);
  const sampleSize = config.import.sampleSize;
  const sample = sampleSize > 0 ? shuffled.slice(0, sampleSize) : shuffled;

  const products = new Map();
  for (const record of sample) {
    const clothingId = Number(record['Clothing ID']);
    if (!Number.isFinite(clothingId) || products.has(clothingId)) continue;
    products.set(clothingId, {
      productID: clothingId,
      productName: productNameFor(record, clothingId),
      category: categoryFor(record),
    });
  }

  const now = Date.now();
  const windowMs = config.import.dateRangeDays * 24 * 60 * 60 * 1000;

  const reviews = [];
  for (const record of sample) {
    const clothingId = Number(record['Clothing ID']);
    if (!Number.isFinite(clothingId)) continue;

    const offset = Math.floor(rng() * windowMs);
    reviews.push([
      clothingId,
      randomName(rng),
      buildReviewText(record),
      formatDateTime(new Date(now - offset)),
    ]);
  }

  const connection = await pool.getConnection();
  try {
    if (reset) {
      await resetTables(connection);
    } else {
      const [[{ count }]] = await connection.query('SELECT COUNT(*) AS count FROM Reviews');
      if (count > 0) {
        throw new Error(
          `Reviews table is not empty (${count} rows). Re-run with --reset to truncate and re-import.`
        );
      }
    }

    await connection.beginTransaction();

    await insertBatches(
      connection,
      `INSERT INTO Products (productID, productName, category) VALUES ?
       ON DUPLICATE KEY UPDATE productName = VALUES(productName), category = VALUES(category)`,
      [...products.values()].map((p) => [p.productID, p.productName, p.category])
    );

    await insertBatches(
      connection,
      'INSERT INTO Reviews (productID, customerName, reviewText, dateSubmitted) VALUES ?',
      reviews
    );

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  const dates = reviews.map((r) => r[3]).sort();
  const dateRange = dates.length ? `${dates[0]} → ${dates[dates.length - 1]}` : 'n/a';

  console.log('Import summary');
  console.log(`  rows read:        ${rowsRead}`);
  console.log(`  rows dropped:     ${rowsDropped} (empty review text)`);
  console.log(`  rows imported:    ${reviews.length}`);
  console.log(`  products created: ${products.size}`);
  console.log(`  date range used:  ${dateRange}`);
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error(`import failed: ${err.message}`);
    process.exit(1);
  });
