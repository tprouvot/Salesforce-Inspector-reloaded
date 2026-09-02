/* global $A */
// This file was created to avoid requesting the "scripting" permission, which can lead to the extension being blacklisted by some companies.

document.addEventListener("lightningNavigate", (event) => {
  handleLightningNavigation(event.detail);
});

function handleLightningNavigation(details) {
  try {
    if (details.fallbackURL && /\/analytics\b|\/tableau\b|AnalyticsStudio/i.test(window.location.pathname || "")) {
      window.open(details.fallbackURL, "_top");
      return;
    }
    switch (details.navigationType) {
      case "recordId":
        navigateToSObject(details.recordId);
        break;
      case "url":
        navigateToURL(details.url);
        break;
      default:
        throw new Error("Invalid navigation type");
    }
  } catch (error) {
    console.error("Lightning navigation failed, falling back to default navigation:", error.message);
    window.open(details.fallbackURL, "_top");
  }

  function navigateToSObject(recordId) {
    const e = $A.get("e.force:navigateToSObject");
    e.setParams({recordId});
    e.fire();
  }

  function navigateToURL(url) {
    const e = $A.get("e.force:navigateToURL");
    e.setParams({url});
    e.fire();
  }
}
