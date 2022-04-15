// inspired by: https://amagiacademy.com/blog/posts/2021-04-09/node-worker-threads-pool

const path = require('path');
const os = require('os');

const WorkerPool = require('./worker_pool.js');

const pool = new WorkerPool(os.cpus().length, path.resolve(__dirname, 'worker.js'));

async function* asyncGenerator(size) {
  let i = 0;
  while (i < size) {
    yield i++;
  }
}

function calculatePercentiles(data) {
  const distribution = data.sort((a, b) => a - b);
  // console.log({ distribution });

  return {
    p50: distribution[Math.floor(distribution.length / 2) - 1],
    p75: distribution[Math.floor(distribution.length * 3 / 4) - 1],
    p80: distribution[Math.floor(distribution.length * 8 / 10) - 1],
    p90: distribution[Math.floor(distribution.length * 9 / 10) - 1],
    p95: distribution[Math.floor(distribution.length * 95 / 100) - 1],
    p99: distribution[Math.floor(distribution.length * 99 / 100) - 1],
  };
}

(async () => {
  if (process.argv.length < 4) {
    // node index.js https://example.com 1000
    console.log('Usage: node index.js <url> <sample>');
    process.exit(1);
  }

  let url = process.argv[2];
  try {
    url = new URL(url);
  } catch (e) {
    console.log('Invalid URL', url);
    process.exit(1);
  }

  const sample = parseInt(process.argv[3]);
  if (sample < 10) {
    console.log('Sample must be greater than 9');
    process.exit(1);
  }

  const numberOfPartitions = Math.floor(sample / 10);
  const rest = sample % 10;


  // const start = new Date()
  const hrstart = process.hrtime()

  let allPromises = [];
  for await (const i of asyncGenerator(numberOfPartitions)) {
    const result = new Promise((resolve, reject) => {
      pool.runTask({ url: url.href, sample: 10 }, (err, result) => {
        if (err) return reject(err)
        return resolve(result)
      })
    })
    allPromises = allPromises.concat(result);
  }

  if (rest > 0) {
    const result = new Promise((resolve, reject) => {
      pool.runTask({ url: url.href, sample: rest }, (err, result) => {
        if (err) return reject(err)
        return resolve(result)
      })
    })
    allPromises = allPromises.concat(result);
  }

  const chunks = await Promise.all(allPromises);
  const data = chunks.reduce((acc, chunk) => acc.concat(chunk), []);

  const percentiles = calculatePercentiles(data);

  // const end = new Date() - start;
  const hrend = process.hrtime(hrstart);

  console.info('Performance Test for "%s" has ended', url.href);
  console.info('%d samples tested in %ds %dms', sample, hrend[0], Math.ceil(hrend[1] / 1000000));
  console.log('Percentiles (ms)');
  console.table(percentiles);

  process.exit(0);
})();