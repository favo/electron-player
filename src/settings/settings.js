var languageData;
var countdownInterval;
var isConnecting = false;
var statusMessage;
var pinToMindButton;
var infoskjermenButton;
var refreshButton;
var passwordField;
var errorMessage;
var hostAddress;
var hiddenSSID = false;
var ssidField;
var myStorage;
var hostName;
var spinner;
var canvas;
var dns;

window.onload = async () => {
    /* 
      Queryies all elemets neeeded
    */
    const letsGoButton = document.getElementById("lets-go-button");
    const connectButton = document.getElementById("connect-button");
    const rotationButtons = document.getElementById("rotation-buttons").querySelectorAll("button");
    const connectAnotherButton = document.getElementById("connect-another-button");
    const dnsButton = document.getElementById("register-dns");
    const connectHostButton = document.getElementById("connect-to-host");
    const toggleButton = document.getElementById("toggleButton");
    const hiddenNetworkButton = document.getElementById("hidden-network-button");

    /* 
    Queryies elements needed also later
    */
    hiddenSsidField = document.getElementById("hidden-network");
    statusMessage = document.getElementById("status-message");
    refreshButton = document.getElementById("refresh-button");
    errorMessage = document.getElementById("error-message");
    infoskjermenButton = document.getElementById("infoskjermen");
    pinToMindButton = document.getElementById("pintomind");
    hostAddress = document.getElementById("host-address");
    passwordField = document.getElementById("password");
    hostName = document.getElementById("host-name");
    ssidField = document.getElementById("network");
    spinner = document.querySelector(".spinner");
    canvas = document.getElementById("canvas");
    dns = document.getElementById("dns");
    myStorage = window.localStorage;

    /* 
        Sets language
    */
    window.api.getFromStore("lang");
    window.api.resultFromStore("lang", async (lang) => {
        languageData = await fetchLanguageData(lang);
        checkServerConnection();
    });

    /* 
      Adds events in elements
    */
    infoskjermenButton.addEventListener("click", (e) => {
        Array.from(e.target.parentElement.children).forEach((el) => el.classList.toggle("selected", el == e.target));
        setHost(e.target.value);
        changeLanguage("no");
        checkServerConnection();
    });

    pinToMindButton.addEventListener("click", (e) => {
        Array.from(e.target.parentElement.children).forEach((el) => el.classList.toggle("selected", el == e.target));
        setHost(e.target.value);
        changeLanguage("en");
        checkServerConnection();
    });

    toggleButton.addEventListener("click", () => {
        passwordField.type === "password" ? (passwordField.type = "text") : (passwordField.type = "password");
    });

    refreshButton.addEventListener("click", () => {
        window.api.send("search_after_networks");
        refreshButton.dataset.status = "pending";
        setInterval(() => {
            refreshButton.dataset.status = null;
        }, 5000);
    });

    hiddenNetworkButton.addEventListener("click", () => {
        const el = document.querySelector(".network-settings");
        if (el.dataset.hiddenSsid === "1") {
            el.dataset.hiddenSsid = "0";
            hiddenSSID = 0;
        } else {
            el.dataset.hiddenSsid = "1";
            hiddenSSID = 1;
        }
    });

    letsGoButton.addEventListener("click", () => window.api.send("go_to_app"));
    connectButton.addEventListener("click", () => connectToNetwork());
    dnsButton.addEventListener("click", () => registerDNS());
    connectHostButton.addEventListener("click", () => connectToHost());
    passwordField.addEventListener("input", () => (errorMessage.innerHTML = null));

    const dnsAddress = myStorage.getItem("dns");
    if (dnsAddress) {
        dns.value = dnsAddress;
    } else {
        dns.value = languageData["ip_address"];
    }

    updateHost();

    [...rotationButtons].forEach((button) => {
        button.addEventListener("click", changeRotation);
    });

    connectAnotherButton.addEventListener("click", () => {
        window.document.body.dataset.showNetworkSettings = true;
        window.api.send("search_after_networks");
    });

    window.api.receive("list_of_networks", (data) => {
        displayListOfNetworks(data);
    });

    window.api.getFromStore("devMode");
    window.api.resultFromStore("devMode", (devMode) => {
        window.document.body.dataset.devMode = devMode;
    });

    window.api.send("create_qr_code", { path: "/connect", lightColor: "#000000", darkColor: "#828282" });
    window.api.receive("finished_qr_code", (data) => {
        canvas.src = data;
    });

    // Callback for when connecting to a network
    window.api.receive("connect_to_network_status", (data) => {
        resetSpinner();
        isConnecting = false;
        if (data.success && data.stdout.toString() == "1") {
            setConnected();
            window.document.body.dataset.showNetworkSettings = false;
            window.document.body.dataset.hasHadConnection = "true";
            myStorage.setItem("has-had-connection", "true");
        } else {
            setNotConnected();
            window.document.body.dataset.showNetworkSettings = true;
            window.api.send("search_after_networks");

            if (isWrongPassword(data)) {
                errorMessage.innerHTML = languageData["wrong_password"];
            }
        }
    });

    const hasHadConnection = myStorage.getItem("has-had-connection", "false");
    window.document.body.dataset.hasHadConnection = hasHadConnection;
};

function connectToNetwork() {
    /* If is connection then returning preventing mulitple calls */
    if (isConnecting == true) return;

    isConnecting = true;
    errorMessage.innerHTML = null;

    let ssid;
    let options = {};
    if (hiddenSSID) {
        ssid = hiddenSsidField.value;
        options["hidden"] = true;
    } else {
        ssid = ssidField.value;
    }

    const passwordstring = passwordField.value;
    const security = ssidField.options[ssidField.selectedIndex].dataset.security;

    resetSpinner();

    if (security.includes("WPA") && passwordstring) {
        /* Case 1: Password field is filled, network network requires it and we try to connect */

        setConnecting();
        window.api.send("connect_to_network", { ssid: ssid, password: passwordstring, security: security, options: options });
    } else if (security.includes("WPA") && !passwordstring) {
        /* Case 2: Password field is empty and network requires it */

        isConnecting = false;
        errorMessage.innerHTML = languageData["require_password"];
    } else if (!security) {
        /* Case 3: Network has no security */

        setConnecting();
        window.api.send("connect_to_network", { ssid: ssid });
    } else {
        /* Case 4: Something wrong happened.. */

        isConnecting = false;
        errorMessage.innerHTML = languageData["unexpected_error"];
    }
}

function checkServerConnection() {
    setConnecting();
    window.api.send("check_server_connection");
}

function updateHost() {
    window.api.resultFromStore("host", (host) => {
        hostName.innerHTML = host;
        hostAddress.value = host;
        myStorage.setItem("host", host);
        if (host == "app.infoskjermen.no") {
            changeLanguage("no");
            infoskjermenButton.classList.add("selected");
        } else if (host == "app.pintomind.com") {
            changeLanguage("en");
            pinToMindButton.classList.add("selected");
        }
    });

    window.api.getFromStore("host");
}

function setHost(host) {
    window.api.send("set_host", {host: host, reload: false});
    myStorage.setItem("host", host);
    document.getElementById("host-name").innerHTML = host;
    hostAddress.value = host;
}

function changeRotation(e) {
    const orientation = e.target.value;
    Array.from(e.target.parentElement.children).forEach((el) => {
        el.classList.toggle("selected", el == e.target);
    });
    window.api.send("change_rotation", orientation);
}

function displayListOfNetworks(data) {
    const select = document.getElementById("network");
    select.innerHTML = "";
    refreshButton.dataset.status = null;

    const list = findUniqueSSIDs(data);

    list.forEach((network) => {
        const option = document.createElement("option");
        option.textContent = `${network.ssid} - ${network.security}`;
        option.value = network.ssid;
        option.dataset.security = network.security;
        select.appendChild(option);
    });
}

function registerDNS() {
    const delay = Date.now();
    window.api.receive("dns_registred", (data) => {
        const waitTime = Date.now() - delay;
        if (waitTime) {
            setInterval(() => {
                if (data == true) {
                    setStatusMessage(languageData["dns_registred"]);
                } else {
                    setStatusMessage(languageData["dns_error"]);
                }
                resetSpinner();
            }, waitTime);
        }
    });

    const name = dns.value;
    dns.placeholder = name;
    setStatusMessage(languageData["dns_registring"]);
    spinner.classList.add("spin");

    myStorage.setItem("dns", name);
    window.api.send("connect_to_dns", name);
}

function connectToHost() {
    const name = hostAddress.value;
    setHost(name);
}

function findUniqueSSIDs(inputString) {
    const lines = inputString.split("\n");
    const uniqueSSIDs = [];
    const uniqueSSIDNames = new Set();

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim().startsWith("SSID:")) {
            const ssid = line.replace("SSID:", "").trim();
            let securityLine;
            for (let j = i + 1; j < lines.length; j++) {
                if (lines[j].trim().startsWith("SECURITY:")) {
                    securityLine = lines[j];
                    break;
                }
            }

            const security = securityLine ? securityLine.replace("SECURITY:", "").trim() : "";

            if (!uniqueSSIDNames.has(ssid) && ssid) {
                uniqueSSIDNames.add(ssid);

                const ssidObject = {
                    ssid: ssid,
                    security: security,
                };

                uniqueSSIDs.push(ssidObject);
            }
        }
    }
    return uniqueSSIDs;
}

function isWrongPassword(data) {
    if (data.type == "802-11-wireless-security.psk" || (data.error && data.error.toString().includes("802-11-wireless-security.psk"))) return true;
    return false;
}
