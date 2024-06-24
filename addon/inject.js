document.addEventListener("lightningNavigate", (event) => {
    handleLightningNavigation(event.detail);
});

function handleLightningNavigation(details) {
    try {
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
        e.setParams({ "recordId": recordId });
        e.fire();
    }

    function navigateToURL(url) {
        const e = $A.get("e.force:navigateToURL");
        e.setParams({ url: url });
        e.fire();
    }
}