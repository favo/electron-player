function updateContent(langData) {
    document.querySelectorAll("[data-i18n]").forEach((element) => {
        const key = element.getAttribute("data-i18n");
        element.innerHTML = langData[key];
    });

    document.querySelectorAll("[data-i18n-src]").forEach((element) => {
        const key = element.getAttribute("data-i18n-src");
        element.src = langData[key];
    });
}

function setLanguagePreference(lang) {
    window.api.send("set_lang", lang);
}

async function fetchLanguageData(lang) {
    try {
        const response = await fetch(`../locales/${lang}.json`);
        return response.json();
    } catch {
        const response = await fetch(`../locales/en.json`);
        return response.json();
    }
}

async function changeLanguage(lang) {
    await setLanguagePreference(lang);

    languageData = await fetchLanguageData(lang);
    updateContent(languageData);
}
