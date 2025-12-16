/**
 * Collect coverage from Chrome extension contexts using CDP
 */
export async function collectExtensionCoverage(context) {
  const allCoverage = [];

  try {
    // Get all pages including extension pages
    const pages = context.pages();

    for (const page of pages) {
      try {
        // Try to collect coverage from this page
        const client = await context.newCDPSession(page);
        await client.send("Profiler.enable");
        await client.send("Profiler.startPreciseCoverage", {
          callCount: true,
          detailed: true
        });

        // Store client for later collection
        page._coverageClient = client;
      } catch (error) {
        // Some pages might not support CDP
        console.warn(`Could not start coverage for page: ${error.message}`);
      }
    }

    // Also try to collect from service workers
    const serviceWorkers = context.serviceWorkers();
    for (const sw of serviceWorkers) {
      try {
        const client = await context.newCDPSession(sw);
        await client.send("Profiler.enable");
        await client.send("Profiler.startPreciseCoverage", {
          callCount: true,
          detailed: true
        });
        sw._coverageClient = client;
      } catch (error) {
        console.warn(`Could not start coverage for service worker: ${error.message}`);
      }
    }

    return {
      stop: async () => {
        // Collect coverage from all pages
        for (const page of pages) {
          if (page._coverageClient) {
            try {
              const {result} = await page._coverageClient.send("Profiler.takePreciseCoverage");
              await page._coverageClient.send("Profiler.stopPreciseCoverage");
              await page._coverageClient.send("Profiler.disable");

              if (result && result.length > 0) {
                // Convert to V8 format
                const v8Coverage = result.map(entry => ({
                  url: entry.url,
                  functions: entry.functions || [],
                  ranges: entry.functions?.flatMap(f => f.ranges) || []
                }));
                allCoverage.push(...v8Coverage);
              }
            } catch (error) {
              console.warn(`Could not collect coverage from page: ${error.message}`);
            }
          }
        }

        // Collect from service workers
        for (const sw of serviceWorkers) {
          if (sw._coverageClient) {
            try {
              const {result} = await sw._coverageClient.send("Profiler.takePreciseCoverage");
              await sw._coverageClient.send("Profiler.stopPreciseCoverage");
              await sw._coverageClient.send("Profiler.disable");

              if (result && result.length > 0) {
                const v8Coverage = result.map(entry => ({
                  url: entry.url,
                  functions: entry.functions || [],
                  ranges: entry.functions?.flatMap(f => f.ranges) || []
                }));
                allCoverage.push(...v8Coverage);
              }
            } catch (error) {
              console.warn(`Could not collect coverage from service worker: ${error.message}`);
            }
          }
        }

        return allCoverage;
      }
    };
  } catch (error) {
    console.warn("Could not initialize extension coverage collection:", error.message);
    return {
      stop: async () => []
    };
  }
}

