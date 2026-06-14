const puppeteer = require('puppeteer');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/jaria/.gemini/antigravity/brain/3e7262d7-9ee1-4906-9192-cc15b66a50f1';

(async () => {
  console.log('🚀 Launching VISIBLE browser for User Experience Test (Watch your screen)...');
  const browser = await puppeteer.launch({
    headless: false, // Set to false so you can see the browser open and navigate!
    slowMo: 80,      // Slows down actions by 80ms so they are easily visible to human eyes
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  // Set window size
  await page.setViewport({ width: 1366, height: 768 });

  try {
    // ── STAGE 1: Login Page ──
    console.log('🔗 Navigating to login page...');
    await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded' });
    
    // Take a screenshot
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'step_1_login_page.png') });
    await new Promise(r => setTimeout(r, 1500)); // Pause to let you look at the screen

    // Fill in credentials
    console.log('🔑 Entering master credentials...');
    await page.type('#email', 'jarias7604@gmail.com');
    await new Promise(r => setTimeout(r, 500));
    await page.type('#password', 'Arias2026!');
    await new Promise(r => setTimeout(r, 1000));
    
    // Click submit
    console.log('Submit login...');
    await page.click('button[type="submit"]');
    
    // Wait for the URL to change to contain /dashboard
    console.log('⏳ Waiting for dashboard redirect...');
    await page.waitForFunction(() => window.location.href.includes('/dashboard'), { timeout: 15000 });
    await new Promise(r => setTimeout(r, 3000)); // Wait 3s to let dashboard draw

    // ── STAGE 2: Dashboard ──
    console.log('🔗 Arrived at dashboard.');
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'step_2_dashboard.png') });

    // ── STAGE 3: Flyer Studio ──
    console.log('🔗 Navigating to Flyer Studio...');
    await page.goto('http://localhost:5173/marketing/flyers', { waitUntil: 'domcontentloaded' });
    
    // Wait for prompt textarea
    await page.waitForSelector('#textarea-prompt', { timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000)); // Wait for styles

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'step_3_flyer_studio_loaded.png') });

    // ── STAGE 4: Enter Prompt ──
    console.log('✍️ Entering CRM brief prompt...');
    const brief = 'crm leads master. incluye: Facturación, Inventario, Reportes. HOY, OFERTA LIMITADA, SOLO ESTA SEMANA.';
    
    // Clear textarea first
    await page.click('#textarea-prompt', { clickCount: 3 });
    await page.keyboard.press('Backspace');
    await page.type('#textarea-prompt', brief);
    await new Promise(r => setTimeout(r, 1500));

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'step_4_prompt_entered.png') });

    // ── STAGE 5: Click Generate ──
    console.log('✨ Clicking "Generar Flyer con IA (Autocorregido)"...');
    await page.click('#btn-generate-flyer');
    
    // Wait for the loader
    console.log('⏳ Waiting for generating overlay to appear...');
    await page.waitForSelector('#generating-overlay', { visible: true, timeout: 5000 });
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'step_5_generating_loader.png') });

    // Wait for the loader to disappear
    console.log('⏳ Waiting for flyer generation to complete (calls DALL-E 3 on backend)...');
    await page.waitForSelector('#generating-overlay', { hidden: true, timeout: 90000 });
    await new Promise(r => setTimeout(r, 3000)); // Wait 3s for layout to render

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'step_6_flyer_generated.png') });

    // ── STAGE 6: Switch templates to test persistence ──
    console.log('🔄 Selecting Template 2 (Cinematic) from the catalog...');
    await page.select('#select-template', 'cinematic');
    await new Promise(r => setTimeout(r, 3000)); // Pause so user can look at the screen
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'step_7_template_switched_cinematic.png') });

    console.log('🔄 Selecting Template 4 (Magazine Dark) from the catalog...');
    await page.select('#select-template', 'magazine');
    await new Promise(r => setTimeout(r, 4000)); // Pause so user can look at the screen
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'step_8_template_switched_magazine.png') });

    console.log('✅ Automated test successfully completed.');

  } catch (err) {
    console.error('❌ Error during UX test execution:', err);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'test_error_state.png') });
  } finally {
    console.log('👋 Closing browser in 3 seconds...');
    await new Promise(r => setTimeout(r, 3000));
    await browser.close();
  }
})();
