var languageData;
var statusMessage;
var spinner;
var hostName;

window.onload = async () => {
    statusMessage = document.getElementById("status-message");
    hostName = document.getElementById("host-name");
    spinner = document.querySelector(".spinner");

    window.api.getFromStore("lang");
    window.api.resultFromStore("lang", async (lang) => {
        languageData = await fetchLanguageData(lang);
        setConnecting();
    });

    window.api.getFromStore("uuid");
    window.api.resultFromStore("uuid", (uuid) => {
        document.querySelector(".random-id").innerHTML = uuid;
    });

    window.api.send("create_qr_code", { path: "/connect", lightColor: "#000000", darkColor: "#ffffff" });
    window.api.receive("finished_qr_code", (data) => {
        canvas.src = data;
    });

    window.api.send("check_server_connection");
    window.api.receive("connect_to_network_status", (data) => {
        resetSpinner();
        if (data.success && data.stdout.toString() == "1") {
            setConnected();
        } else {
            setNotConnected();
        }
    });

    updateHost();
};

function updateHost() {
    window.api.resultFromStore("host", (host) => {
        hostName.innerHTML = host;

        if (host == "app.infoskjermen.no") {
            changeLanguage("no");
        } else if (host == "app.pintomind.com") {
            changeLanguage("en");
        }
    });

    window.api.getFromStore("host");
}
