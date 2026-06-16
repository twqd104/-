import puppeteer from 'puppeteer';

(async () => {
  console.log("Launching browser...");
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
  
  console.log("Going to page...");
  await page.goto('http://localhost:5174');
  
  await page.waitForTimeout(1000);
  console.log("Clicking...");
  await page.click('#instructions');
  
  await page.waitForTimeout(1000);
  console.log("Pressing W...");
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(1000);
  await page.keyboard.up('KeyW');
  
  console.log("Done.");
  await browser.close();
})();
