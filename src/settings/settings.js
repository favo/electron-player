var languageData;
var countdownInterval;
var isConnecting = false;
var isRegistringDns = false;
var rotationButtons;
var statusMessage;
var screenResolution
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
    *  Queryies elements needed also later
    */
    rotationButtons = document.getElementById("rotation-buttons").querySelectorAll("button");
    screenResolution = document.getElementById("screen-resolution");
    hiddenSsidField = document.getElementById("hidden-network");
    statusMessage = document.getElementById("status-message");
    refreshButton = document.getElementById("refresh-button");
    errorMessage = document.getElementById("error-message");
    hostAddress = document.getElementById("host-address");
    passwordField = document.getElementById("password");
    hostName = document.getElementById("host-name");
    ssidField = document.getElementById("network");
    spinner = document.querySelector(".spinner");
    canvas = document.getElementById("canvas");
    dns = document.getElementById("dns");
    myStorage = window.localStorage;

    setButtonEvents()

    getFromStore("lang", null, async (lang) => {
        languageData = await changeLanguage(lang);

        checkServerConnection();

        const dnsAddress = myStorage.getItem("dns");
        if (dnsAddress) {
            dns.value = dnsAddress;
        } else {
            dns.value = languageData["ip_address"];
        }
    })

    getFromStore("host", null, (host) => {
        hostName.innerHTML = host;
        hostAddress.value = host;
    })

    window.api.receive("list_of_networks", (data) => {
        displayListOfNetworks(data);
    });

    window.api.receive("is_connecting", () => {
        resetSpinner();
        setConnecting();
    });

    window.api.receive("dns_registred", (data) => {
        isRegistringDns = false

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
        isRegistringDns = true
        resetSpinner()
        spinner.classList.add("spin");
        setStatusMessage(languageData["dns_registring"]);
    })

    window.api.resultFromStore("devMode", (devMode) => {
        window.document.body.dataset.devMode = devMode;
    });
    window.api.getFromStore("devMode");

    sendRecieveToMain("create_qr_code", { lightColor: "#000000", darkColor: "#828282" }, (data) => {
        canvas.src = data;
    })

    sendRecieveToMain("get_screen_resolutions", {}, (data) => {
        if (data) {
            data.list.forEach((res) => {
                const option = document.createElement("option");
                option.textContent = res
                option.value = res;
                if (data.current == res) {
                    option.selected = true
                }
                screenResolution.appendChild(option)
            })

            Array.from(rotationButtons).forEach((button) => {
                button.classList.toggle("selected", button.value === data.rotation )
            });
        }
    })

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

    window.document.body.dataset.hasHadConnection = myStorage.getItem("has-had-connection", "false");;
};

function setButtonEvents() {
    const letsGoButton = document.getElementById("lets-go-button");
    const connectButton = document.getElementById("connect-button");
    const connectAnotherButton = document.getElementById("connect-another-button");
    const screenResolutionButton = document.getElementById("set-screen-resolution");
    const dnsButton = document.getElementById("register-dns");
    const connectHostButton = document.getElementById("connect-to-host");
    const toggleButton = document.getElementById("toggleButton");
    const hiddenNetworkButton = document.getElementById("hidden-network-button");

    connectAnotherButton.addEventListener("click", () => {
        window.document.body.dataset.showNetworkSettings = true;
        window.api.send("search_after_networks");
    });

    refreshButton.addEventListener("click", () => {
        window.api.send("search_after_networks");
        refreshButton.dataset.status = "pending";
        setTimeout(() => {
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

    toggleButton.addEventListener("click", () => passwordField.type === "password" ? (passwordField.type = "text") : (passwordField.type = "password"));
    letsGoButton.addEventListener("click", () => window.api.send("go_to_screen"));
    connectButton.addEventListener("click", () => connectToNetwork());
    dnsButton.addEventListener("click", () => registerDNS());
    connectHostButton.addEventListener("click", () => connectToHost());
    screenResolutionButton.addEventListener("click", () => setScreenResolution());
    [...rotationButtons].forEach((button) => button.addEventListener("click", changeRotation));
}

function connectToNetwork() {
    /* If is connection then returning preventing mulitple calls */
    if (isConnecting) return;

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
        window.api.send("connect_to_network", { ssid: ssid, password: passwordstring, security: security, options: options });
    } else if (security.includes("WPA") && !passwordstring) {
        /* Case 2: Password field is empty and network requires it */
        isConnecting = false;
        errorMessage.innerHTML = languageData["require_password"];
    } else if (!security) {
        /* Case 3: Network has no security */
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

function setHost(host) {
    window.api.send("set_host", { host: host, reload: false });
    hostName.innerHTML = host;
    hostAddress.value = host;
}

function changeRotation(e) {
    const orientation = e.target.value;
    Array.from(e.target.parentElement.children).forEach((el) => el.classList.toggle("selected", el == e.target) );

    window.api.send("set_screen_rotation", orientation);
}

function displayListOfNetworks(data) {
    const select = document.getElementById("network");
    select.innerHTML = "";
    refreshButton.dataset.status = null;

    data.forEach((network) => {
        const option = document.createElement("option");
        option.textContent = `${network.ssid} - ${network.security}`;
        option.value = network.ssid;
        option.dataset.security = network.security;
        select.appendChild(option);
    });
}

function registerDNS() {
    if (isRegistringDns) return

    const name = dns.value;
    dns.placeholder = name;

    myStorage.setItem("dns", name);
    window.api.send("connect_to_dns", name);
}

function connectToHost() {
    const name = hostAddress.value;
    setHost(name);
}

function setScreenResolution() {
    const res = screenResolution.value 
    window.api.send("set_screen_resolution", res);
}

function isWrongPassword(data) {
    if (data.type == "802-11-wireless-security.psk" || (data.error && data.error.toString().includes("802-11-wireless-security.psk"))) return true;
    return false;
}
