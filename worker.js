// inspired by: https://amagiacademy.com/blog/posts/2021-04-09/node-worker-threads-pool

const { parentPort, threadId } = require('worker_threads');

const puppeteer = require('puppeteer');

parentPort.on('message', async (task) => {
  const { url, sample } = task
  // console.log(`Running task on thread: ${threadId}`)
  parentPort.postMessage(await measurePerformance(threadId, url, sample))
})

async function measurePerformance(threadId, url, sample) {
  // console.log(`${threadId}: Launching browser...`);
  const browser = await puppeteer.launch();
  // console.log(`${threadId}: Launching page...`);
  const page = await browser.newPage();
  await page.goto(url);

  // first load
  await page.evaluate(() => {
    return performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart;
  });

  const result = [];
  for (let i = 0; i < sample; i++) {
    await page.goto(url);
    const timeToLoad = await page.evaluate(() => {
      return performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart;
    });
    result.push(timeToLoad);
  }

  // console.log(`${threadId}: Closing browser...`);
  await browser.close();

  return result;
}

// // enable this to test performance without threads
// (async () => {
//   if (process.argv.length < 4) {
//     // node worker.js https://example.com 100
//     console.log('Usage: node worker.js <url> <sample>');
//     process.exit(1);
//   }
//
//   let url = process.argv[2];
//   try {
//     url = new URL(url);
//   } catch (e) {
//     console.log('Invalid URL', url);
//     process.exit(1);
//   }
//
//   const sample = parseInt(process.argv[3]);
//   if (sample < 10) {
//     console.log('Sample must be greater than 9');
//     process.exit(1);
//   }
//
//   const hrstart = process.hrtime()
//   await measurePerformance(1, url.href, sample);
//   const hrend = process.hrtime(hrstart);
//
//   console.info('Performance Test for "%s" has ended', url.href);
//   console.info('%d samples tested in %ds %dms', sample, hrend[0], Math.ceil(hrend[1] / 1000000));
//
//   process.exit(0);
// })();