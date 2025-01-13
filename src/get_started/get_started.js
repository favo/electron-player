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

    getFromStore("host", null, (host) => {
        hostName.innerHTML = host;
        
        if (host == "app.infoskjermen.no") {
            changeLanguage("no");
        } else if (host == "app.pintomind.com") {
            changeLanguage("en");
        } else {
            changeLanguage("en");
        }
    });

    window.api.receive("dns_registred", (data) => {
        resetSpinner()
        if (data == true) {
            setStatusMessage(languageData["dns_registred"]);
            spinner.classList.add("success");
        } else {
            setStatusMessage(languageData["dns_error"]);
            spinner.classList.add("error");
        }
    });

    window.api.receive("dns_registerering", () => {
        resetSpinner()
        spinner.classList.add("spin");
        setStatusMessage(languageData["dns_registring"]);
    })

    window.api.receive("is_connecting", () => {
        resetSpinner();
        setConnecting();
    });

    window.api.receive("get_bluetooth_id", (bluetooth_id) => {
        const formattedString = bluetooth_id.slice(0, 9).match(/.{1,3}/g).join('-');
        Array.from(document.querySelectorAll(".bluetooth-id")).forEach(el => {
            el.innerHTML = formattedString;
        })
    });

    window.api.send("get_bluetooth_id");

    window.api.receive("finished_qr_code", (data) => canvas.src = data);
    window.api.send("create_qr_code", { lightColor: "#000000", darkColor: "#ffffff" });
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