const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Collect console messages
  const consoleMessages = [];
  page.on('console', msg => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text(),
      location: msg.location()
    });
  });

  // Collect errors
  const errors = [];
  page.on('pageerror', error => {
    errors.push({
      message: error.message,
      stack: error.stack
    });
  });

  // Set viewport
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    console.log('Navigating to http://localhost:5173/...');
    await page.goto('http://localhost:5173/', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Wait a bit for hydration
    await page.waitForTimeout(2000);

    // Take full page screenshot
    await page.screenshot({
      path: '/Users/duynguyen/www/claudekit/skillx/.claude/debug-screenshot-full.png',
      fullPage: true
    });

    // Take viewport screenshot
    await page.screenshot({
      path: '/Users/duynguyen/www/claudekit/skillx/.claude/debug-screenshot-viewport.png',
      fullPage: false
    });

    // Check if leaderboard section exists
    const leaderboardExists = await page.$('div.mt-16.w-full.max-w-6xl.pb-16');

    // Get leaderboard HTML
    const leaderboardHTML = await page.evaluate(() => {
      const section = document.querySelector('div.mt-16.w-full.max-w-6xl.pb-16');
      return section ? section.innerHTML : 'NOT FOUND';
    });

    // Count table rows
    const rowCount = await page.evaluate(() => {
      const tbody = document.querySelector('tbody');
      return tbody ? tbody.querySelectorAll('tr').length : 0;
    });

    // Check visibility
    const visibility = await page.evaluate(() => {
      const section = document.querySelector('div.mt-16.w-full.max-w-6xl.pb-16');
      if (!section) return { exists: false };

      const rect = section.getBoundingClientRect();
      const styles = window.getComputedStyle(section);

      return {
        exists: true,
        display: styles.display,
        visibility: styles.visibility,
        opacity: styles.opacity,
        height: rect.height,
        width: rect.width,
        top: rect.top,
        left: rect.left
      };
    });

    // Get React hydration warnings
    const hydrationWarnings = consoleMessages.filter(msg =>
      msg.text.toLowerCase().includes('hydrat') ||
      msg.text.toLowerCase().includes('mismatch')
    );

    // Create report
    const report = {
      timestamp: new Date().toISOString(),
      url: 'http://localhost:5173/',
      leaderboardSection: {
        exists: !!leaderboardExists,
        rowCount,
        visibility
      },
      consoleMessages: consoleMessages.slice(0, 50), // First 50 messages
      errors,
      hydrationWarnings,
      leaderboardHTMLPreview: leaderboardHTML.substring(0, 1000)
    };

    // Save report
    fs.writeFileSync(
      '/Users/duynguyen/www/claudekit/skillx/.claude/debug-report.json',
      JSON.stringify(report, null, 2)
    );

    console.log('\n=== DEBUG REPORT ===');
    console.log('Screenshots saved to .claude/debug-screenshot-*.png');
    console.log('Report saved to .claude/debug-report.json');
    console.log('\nLeaderboard Section:');
    console.log('  - Exists:', report.leaderboardSection.exists);
    console.log('  - Row Count:', report.leaderboardSection.rowCount);
    console.log('  - Visibility:', JSON.stringify(report.leaderboardSection.visibility, null, 2));
    console.log('\nConsole Messages:', consoleMessages.length);
    console.log('Errors:', errors.length);
    console.log('Hydration Warnings:', hydrationWarnings.length);

    if (errors.length > 0) {
      console.log('\n=== ERRORS ===');
      errors.forEach((err, i) => {
        console.log(`\nError ${i + 1}:`);
        console.log(err.message);
        if (err.stack) console.log(err.stack);
      });
    }

    if (hydrationWarnings.length > 0) {
      console.log('\n=== HYDRATION WARNINGS ===');
      hydrationWarnings.forEach((warn, i) => {
        console.log(`\nWarning ${i + 1}:`);
        console.log(warn.text);
      });
    }

  } catch (error) {
    console.error('Navigation error:', error);
  } finally {
    await browser.close();
  }
})();
