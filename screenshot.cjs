const puppeteer = require('puppeteer');

(async () => {
  try {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setViewport({ width: 2000, height: 1200 });
    
    console.log('Navigating to http://localhost:5173/test-flyer...');
    await page.goto('http://localhost:5173/test-flyer', { waitUntil: 'networkidle0' });
    
    await new Promise(r => setTimeout(r, 2000));
    
    console.log('Taking screenshot...');
    await page.screenshot({ path: 'test_flyer_screenshot.png', fullPage: true });
    
    await browser.close();
    console.log('Screenshot saved to test_flyer_screenshot.png');
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();
