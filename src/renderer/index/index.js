let myStorage;
let webview;
let webviewReady = false;
let toaster;
let toasterInterval;

window.onload = function () {
    myStorage = window.localStorage;
    webview = document.getElementById("iframe");
    toaster = document.getElementById("toaster");

    requestHost();

    /*
     *   LOAD STOP - Called when page is finished loading
     */
    webview.addEventListener("load", (e) => {
        if (!webviewReady) {
            playerReadyInterval = setInterval(() => {
                var player_ready = { action: "player_ready", player: "electron_app" };
                webview.contentWindow.postMessage(player_ready, "*");
            }, 1000);

            webviewReady = true;
        }

        window.api.receive("recieve_system_stats", (data) => {
            webview.contentWindow.postMessage({ action: "system_stats", stats: data }, "*");
        });

        window.api.receive("open_toaster", (data) => {
            openToaster(data);
        });
    });

    /*
     *   Listener from server
     */
    window.addEventListener("message", (e) => {
        var request = e.data;

        switch (request.action) {
            case "request_device_info":
                requestDeviceInfo();
                break;
            case "player_ready_received":
                if (playerReadyInterval) {
                    clearInterval(playerReadyInterval);
                    playerReadyInterval = null;
                }
                break;
            case "reboot":
                sendMessageToMain("reboot_device");
                break;
            case "update_app":
                sendMessageToMain("update_app");
                break;
            case "pincode":
                // Gets pincode from butler
                sendMessageToMain("pincode", {pincode: request.pincode});
                break;
            case "wake":
                sendMessageToMain("wake");
                break;
            case "sleep":
                sendMessageToMain("sleep");
                break;
            case "set_screen_resolution":
                sendMessageToMain("set_screen_resolution", request.resolution);
                break;
            case "set_screen_rotation":
                sendMessageToMain("set_screen_rotation", request.rotation);
                break;
            case "factory_reset":
                sendMessageToMain("factory_reset");
                break;
            case "upgrade_firmware":
                sendMessageToMain("upgrade_firmware");
                break;
            case "current_physical_id":
                myStorage = window.localStorage;
                physicalID = myStorage.getItem("physicalID");

                if (physicalID == null) {
                    myStorage.setItem("physicalID", request.physicalID);
                } else {
                    if (physicalID != request.physicalID) {
                        sendPhysicalID();
                    }
                }
                break;
            case "update_physical_id":
                if (request.physicalID != null) {
                    myStorage.setItem("physicalID", request.physicalID);
                }
                break;
            case "request_system_stats":
                sendMessageToMain("request_system_stats", request.options);
                break;
        }
    });

    function sendMessageToMain(action, data = {}) {
        window.api.send(action, data);
    }

    function requestDeviceInfo() {
        window.api.receive("send_device_info", (data) => {
            webview.contentWindow.postMessage({ action: "device_info", info: data }, "*");
        });

        sendMessageToMain("request_device_info");
    }

    function sendPhysicalID() {
        physicalID = myStorage.getItem("physicalID");
        webview.contentWindow.postMessage({ action: "player_physical_id", physicalID: physicalID }, "*");
    }

    function requestHost() {
        window.api.resultFromStore("host", (host) => {
            webview.src = "https://" + host + "/live/";
            myStorage.setItem("host", host);

            sendMessageToMain("remove_mouse");
        });

        window.api.getFromStore("host");
    }

    function showToaster() {
        if (toasterInterval) {
            clearInterval(toasterInterval);
            toasterInterval = null;
        }

        toaster.classList.add("active");

        toasterInterval = setInterval(() => {
            hideToaster();
        }, 4000);
    }

    function hideToaster() {
        toaster.classList.remove("active");
    }

    function setToasterText(text) {
        toaster.innerHTML = text;
    }

    function openToaster(text) {
        setToasterText(text);
        showToaster();
    }
};
