import { test, expect } from '@playwright/test';

test.describe('Performance Tests', () => {
  test('should load homepage within performance budget', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const loadTime = Date.now() - startTime;
    
    // Performance assertions
    expect(loadTime).toBeLessThan(3000); // 3 seconds
    
    // Check Core Web Vitals
    const metrics = await page.evaluate(() => {
      return new Promise((resolve) => {
        const vitals: any = {};
        let hasLCP = false;
        let hasFID = false;
        
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          
          entries.forEach((entry) => {
            if (entry.entryType === 'largest-contentful-paint') {
              vitals.lcp = entry.startTime;
              hasLCP = true;
            } else if (entry.entryType === 'first-input') {
              const fidEntry = entry as any;
              vitals.fid = fidEntry.processingStart - fidEntry.startTime;
              hasFID = true;
            } else if (entry.entryType === 'layout-shift') {
              const clsEntry = entry as any;
              if (!clsEntry.hadRecentInput) {
                vitals.cls = (vitals.cls || 0) + clsEntry.value;
              }
            }
          });
          
          // Resolve when we have key metrics or timeout
          if (hasLCP && hasFID) {
            resolve(vitals);
          }
        });
        
        observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift'] });
        
        // Fallback timeout
        setTimeout(() => resolve(vitals), 5000);
      });
    });
    
    // Assert Core Web Vitals
    const vitals = metrics as any;
    if (vitals.lcp) expect(vitals.lcp).toBeLessThan(2500); // 2.5s
    if (vitals.fid) expect(vitals.fid).toBeLessThan(100); // 100ms
    if (vitals.cls) expect(vitals.cls).toBeLessThan(0.1); // 0.1
  });

  test('should have efficient bundle size', async ({ page }) => {
    const responses: any[] = [];
    
    page.on('response', (response) => {
      if (response.url().includes('.js') || response.url().includes('.css')) {
        responses.push({
          url: response.url(),
          size: parseInt(response.headers()['content-length'] || '0'),
        });
      }
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const totalJS = responses
      .filter(r => r.url.includes('.js'))
      .reduce((sum, r) => sum + r.size, 0);
    
    const totalCSS = responses
      .filter(r => r.url.includes('.css'))
      .reduce((sum, r) => sum + r.size, 0);
    
    // Bundle size assertions (in bytes)
    expect(totalJS).toBeLessThan(500 * 1024); // 500KB for JS
    expect(totalCSS).toBeLessThan(50 * 1024); // 50KB for CSS
  });

  test('should handle concurrent requests efficiently', async ({ page }) => {
    const startTime = Date.now();
    
    // Simulate multiple concurrent requests
    await Promise.all([
      page.goto('/'),
      page.waitForSelector('[data-testid="hero-section"]'),
      page.waitForSelector('[data-testid="features-section"]'),
      page.waitForSelector('[data-testid="pricing-section"]'),
    ]);
    
    const loadTime = Date.now() - startTime;
    
    // Should handle concurrent loading efficiently
    expect(loadTime).toBeLessThan(4000); // 4 seconds for concurrent load
  });

  test('should maintain performance with large datasets', async ({ page }) => {
    // Mock large dataset
    await page.route('/api/dashboard/data', (route) => {
      const largeData = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        description: `Description for item ${i}`.repeat(10),
        value: Math.random() * 1000,
      }));
      
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(largeData),
      });
    });
    
    const startTime = Date.now();
    
    await page.goto('/auth/dashboard');
    await page.waitForLoadState('networkidle');
    
    const renderTime = Date.now() - startTime;
    
    // Should handle large datasets efficiently
    expect(renderTime).toBeLessThan(5000); // 5 seconds for large dataset
  });
});