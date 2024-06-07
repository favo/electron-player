function setStatusMessage(message) {
    statusMessage.innerHTML = message;
}

function setConnected() {
    setStatusMessage(languageData["connected"]);
    spinner.classList.add("success");
}

function setConnecting() {
    setStatusMessage(languageData["connecting"]);
    spinner.classList.add("spin");
}

function setNotConnected() {
    setStatusMessage(languageData["not_connected"]);
    spinner.classList.add("error");
}

function resetSpinner() {
    spinner.classList.remove("error");
    spinner.classList.remove("success");
    spinner.classList.remove("spin");
}
