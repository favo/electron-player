function updateContent(langData) {
    document.querySelectorAll("[data-i18n]").forEach((element) => {
        const key = element.getAttribute("data-i18n");
        element.textContent = langData[key];
    });
}

function setLanguagePreference(lang) {
    window.api.send("set_lang", lang);
}

async function fetchLanguageData(lang) {
    if (lang != undefined) {
        const response = await fetch(`../locales/${lang}.json`);
        return response.json();
    }
}

async function changeLanguage(lang) {
    await setLanguagePreference(lang);

    languageData = await fetchLanguageData(lang);
    updateContent(languageData);
}
