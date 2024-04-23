const html = document.documentElement;
setThemeHtml = themeBool => html.dataset.theme = (themeBool === "true" ? "light" : "dark");
setAccentHtml = accentBool => html.dataset.accent = (accentBool === "false" ? "accent" : "");

let savedTheme = localStorage.getItem("prefersLightColorScheme");
if (savedTheme == null){
  savedTheme = window.matchMedia("(prefers-color-scheme: light)").matches;
}
setThemeHtml(savedTheme);

const savedAccent = localStorage.getItem("prefersPureAccentScheme");
setAccentHtml(savedAccent);
