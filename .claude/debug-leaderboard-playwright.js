const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

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

  try {
    console.log('Navigating to http://localhost:5173/...');
    await page.goto('http://localhost:5173/', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Wait for hydration
    await page.waitForTimeout(2000);

    // Take screenshots
    await page.screenshot({
      path: '.claude/debug-screenshot-full.png',
      fullPage: true
    });

    await page.screenshot({
      path: '.claude/debug-screenshot-viewport.png',
      fullPage: false
    });

    // Get leaderboard info
    const leaderboardInfo = await page.evaluate(() => {
      const section = document.querySelector('div.mt-16.w-full.max-w-6xl.pb-16');
      const tbody = document.querySelector('tbody');
      const rows = tbody ? tbody.querySelectorAll('tr') : [];

      if (!section) {
        return { exists: false, rowCount: 0 };
      }

      const rect = section.getBoundingClientRect();
      const styles = window.getComputedStyle(section);

      return {
        exists: true,
        rowCount: rows.length,
        visibility: {
          display: styles.display,
          visibility: styles.visibility,
          opacity: styles.opacity,
          height: rect.height,
          width: rect.width,
          top: rect.top,
          left: rect.left
        },
        tbodyHTML: tbody ? tbody.innerHTML.substring(0, 500) : 'NO TBODY',
        firstRowVisible: rows.length > 0 ? window.getComputedStyle(rows[0]).display !== 'none' : false
      };
    });

    // Get hydration warnings
    const hydrationWarnings = consoleMessages.filter(msg =>
      msg.text.toLowerCase().includes('hydrat') ||
      msg.text.toLowerCase().includes('mismatch') ||
      msg.text.toLowerCase().includes('expected server')
    );

    // Create report
    const report = {
      timestamp: new Date().toISOString(),
      url: 'http://localhost:5173/',
      leaderboard: leaderboardInfo,
      consoleMessages: consoleMessages.slice(0, 50),
      errors,
      hydrationWarnings
    };

    fs.writeFileSync(
      '.claude/debug-report.json',
      JSON.stringify(report, null, 2)
    );

    console.log('\n=== DEBUG REPORT ===');
    console.log('Screenshots saved to .claude/debug-screenshot-*.png');
    console.log('Report saved to .claude/debug-report.json');
    console.log('\nLeaderboard:');
    console.log('  - Exists:', leaderboardInfo.exists);
    console.log('  - Row Count:', leaderboardInfo.rowCount);
    console.log('  - Visibility:', JSON.stringify(leaderboardInfo.visibility, null, 2));
    console.log('\nConsole Messages:', consoleMessages.length);
    console.log('Errors:', errors.length);
    console.log('Hydration Warnings:', hydrationWarnings.length);

    if (errors.length > 0) {
      console.log('\n=== ERRORS ===');
      errors.forEach((err, i) => {
        console.log(`\nError ${i + 1}:`, err.message);
      });
    }

    if (hydrationWarnings.length > 0) {
      console.log('\n=== HYDRATION WARNINGS ===');
      hydrationWarnings.forEach((warn, i) => {
        console.log(`\nWarning ${i + 1}:`, warn.text);
      });
    }

    if (consoleMessages.length > 0) {
      console.log('\n=== ALL CONSOLE MESSAGES ===');
      consoleMessages.forEach((msg, i) => {
        console.log(`${i + 1}. [${msg.type}]`, msg.text);
      });
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
