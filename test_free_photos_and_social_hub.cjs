const puppeteer = require('puppeteer');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/jaria/.gemini/antigravity/brain/3e7262d7-9ee1-4906-9192-cc15b66a50f1';

(async () => {
  console.log('🚀 Launching VISIBLE browser for Free Photos and Social Hub test...');
  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 100,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });

  try {
    // ── STAGE 1: Login ──
    console.log('🔗 Navigating to login page...');
    await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded' });
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'step_free_1_login.png') });

    console.log('🔑 Entering credentials...');
    await page.type('#email', 'jarias7604@gmail.com');
    await page.type('#password', 'Arias2026!');
    await new Promise(r => setTimeout(r, 500));
    await page.click('button[type="submit"]');

    console.log('⏳ Waiting for dashboard...');
    await page.waitForFunction(() => window.location.href.includes('/dashboard'), { timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));

    // ── STAGE 2: Flyer Studio ──
    console.log('🔗 Navigating to Flyer Studio...');
    await page.goto('http://localhost:5173/marketing/flyers', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#textarea-prompt', { timeout: 15000 });
    await new Promise(r => setTimeout(r, 1000));

    // ── STAGE 3: Enter Brief for Pizza and Click Free Button ──
    console.log('✍️ Entering brief about pizza to match food stock photo...');
    await page.click('#textarea-prompt', { clickCount: 3 });
    await page.keyboard.press('Backspace');
    await page.type('#textarea-prompt', 'Pizza especial familiar. 2x1 los viernes.');
    await new Promise(r => setTimeout(r, 1000));

    console.log('📸 Clicking "Generar con Fotos Gratis (Sin Créditos)"...');
    await page.click('#btn-generate-free');
    await new Promise(r => setTimeout(r, 2000)); // Should render instantly locally

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'step_free_2_generated.png') });

    // ── STAGE 4: Click Send to Social Hub ──
    console.log('📤 Clicking "Enviar a Publicación (Redes Sociales)"...');
    await page.click('#btn-send-to-social');

    // Wait for the redirect to /marketing/social
    console.log('⏳ Waiting for redirect to social hub...');
    await page.waitForFunction(() => window.location.href.includes('/marketing/social'), { timeout: 15000 });
    await new Promise(r => setTimeout(r, 3000)); // Wait to load page content

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'step_free_3_social_hub.png') });
    console.log('✅ Success! Arrived at social publishing dashboard without quota errors.');

  } catch (err) {
    console.error('❌ Error during E2E test execution:', err);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'step_free_error.png') });
  } finally {
    console.log('👋 Closing browser in 3 seconds...');
    await new Promise(r => setTimeout(r, 3000));
    await browser.close();
  }
})();
