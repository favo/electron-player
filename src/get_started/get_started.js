var languageData;
var statusMessage;
var spinner;
var hostName;

window.onload = async () => {
    statusMessage = document.getElementById("status-message");
    hostName = document.getElementById("host-name");
    spinner = document.querySelector(".spinner");

    window.api.receive("connect_to_network_status", (data) => {
        resetSpinner();
        if (data.success && data.stdout.toString() == "1") {
            setConnected();
        } else {
            setNotConnected();
        }
    });

    getFromStore("lang", null, async (lang) => {
        languageData = await fetchLanguageData(lang);
        setConnecting();
        window.api.send("check_server_connection");
    });

    getFromStore("uuid", null, (uuid) => {
        console.log(uuid);
        document.querySelector(".random-id").innerHTML = uuid;
    });

    getFromStore("host", null, (host) => {
        hostName.innerHTML = host;

        if (host == "app.infoskjermen.no") {
            changeLanguage("no");
        } else if (host == "app.pintomind.com") {
            changeLanguage("en");
        }
    });

    window.api.send("create_qr_code", { path: "/connect", lightColor: "#000000", darkColor: "#ffffff" });
    window.api.receive("finished_qr_code", (data) => {
        canvas.src = data;
    });
};

/*
 * Function from getting value from Store in main prosess based on key. Key needs to be whitelisted in preload.js
 * @param {String} key
 * @param {JSONObject} data
 * @param {function} callback
 */
function getFromStore(key, data = null, callback) {
    window.api.getFromStore(key, data);
    window.api.resultFromStore(key, callback);
}
