const html = document.documentElement;
const prefersDarkScheme = window.matchMedia("(prefers-color-scheme: dark)");

// set dataset dark/light to html tag and update localStorage
const reflectChanges = (theme) => {
    html.dataset.theme = theme;
    localStorage.setItem("theme", theme);
}

const savedTheme = localStorage.getItem("theme");
if(savedTheme != null){
    html.dataset.theme = savedTheme;
    let int = undefined;
    const updateTheme = () => {
        const light = document.getElementById("light-theme");
        const dark = document.getElementById("dark-theme");
        if(light == null || dark == null) return;
        clearInterval(int);

        savedTheme == "dark" ? light.classList.remove("hide") : dark.classList.remove("hide");
    }

    updateTheme()
    int = setInterval(updateTheme, 500);
} else {
    prefersDarkScheme.matches ? reflectChanges("dark") : reflectChanges("light");
}

// listen for changes to color scheme preference
prefersDarkScheme.addEventListener("change", mediaQuery => {
    const theme = mediaQuery.matches ? "dark" : "light";
    reflectChanges(theme);
});
