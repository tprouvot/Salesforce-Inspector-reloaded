const html = document.documentElement;

let savedTheme = localStorage.getItem("enableDarkMode");
if (savedTheme == null){
  savedTheme = window.matchMedia("(prefers-color-scheme: dark)").matches;
}
html.dataset.theme = (savedTheme === "true" ? "dark" : "light");

const savedAccent = localStorage.getItem("enableAccentColors");
html.dataset.accent = (accentBool === "true" ? "accent" : "default");
