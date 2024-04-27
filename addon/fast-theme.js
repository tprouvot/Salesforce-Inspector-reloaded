const html = document.documentElement;

const savedTheme = localStorage.getItem("enableDarkMode");
html.dataset.theme = savedTheme === "true" ? "dark" : "light";

const savedAccent = localStorage.getItem("enableAccentColors");
html.dataset.accent = savedAccent === "true" ? "accent" : "default";
