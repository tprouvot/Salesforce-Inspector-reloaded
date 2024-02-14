const html = document.documentElement;
let savedTheme = localStorage.getItem("preferredColorScheme");
if (savedTheme == null){
  const prefersDarkScheme = window.matchMedia("(prefers-color-scheme: dark)");
  savedTheme = prefersDarkScheme.matches ? "dark" : "light";
}
html.dataset.theme = savedTheme;
const savedAccent = localStorage.getItem("preferredAccentScheme");
html.dataset.accent = savedAccent;
