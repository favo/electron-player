let myStorage
let webview
let webviewReady = false;


window.onload = function() {
    
    myStorage = window.localStorage;
    host = myStorage.getItem("host")
    webview = document.getElementById("iframe");

    requestHost()

    /* 
    *   LOAD STOP - Called when page is finished loading
    */
   webview.addEventListener("load", (e) => {

       if (!webviewReady) {

            playerReadyInterval = setInterval(() => {
                var player_ready = {action: "player_ready", player: "electron_app"}
                webview.contentWindow.postMessage(player_ready, "*");
            },1000)

            webviewReady = true
        }

        window.api.receive("recieve_system_stats", (data) => {
            webview.contentWindow.postMessage({action: "system_stats", stats: data}, "*");
        });

    });

    /*
    *   Listener from server
    */
    window.addEventListener("message", (e) => {

        var request = e.data
        
        switch (request.action) {
            case "request_device_info": 
                requestDeviceInfo()
                break;
            case "player_ready_received": 
                if (playerReadyInterval) {
                    clearInterval(playerReadyInterval)
                    playerReadyInterval = null
                }
                break;
            case "reboot":
                sendMessageToMain("reboot_device")
                break;
            case "restart":
                sendMessageToMain("restart_app")
                break;
            case "update_app":
                sendMessageToMain("update_app")
                break;
            case "upgrade_firmware":
                sendMessageToMain("upgrade_firmware")
                break;
            case "current_physical_id":
                myStorage = window.localStorage;
                physicalID = myStorage.getItem("physicalID") 
                if (physicalID == null) {
                    myStorage.setItem("physicalID", request.physicalID)
                } else {
                    if (physicalID != request.physicalID) {
                        sendPhysicalID()
                    }
                }
                break;
            case "update_physical_id":
                if (request.physicalID != null) {
                    myStorage.setItem("physicalID", request.physicalID)
                }
                break;
            case "request_system_stats":
                sendMessageToMain("request_system_stats", request.options)
                break;
        }

    })

    function sendMessageToMain(action, data = {}) {
        window.api.send(action, data)
    }

    function requestDeviceInfo() {
        window.api.receive("send_device_info", (data) => {
            webview.contentWindow.postMessage({action: "device_info", info: data}, "*");
        });

        sendMessageToMain("request_device_info")
    }

    function sendPhysicalID() {
        physicalID = myStorage.getItem("physicalID") 
        webview.contentWindow.postMessage({action: "player_physical_id", physicalID: physicalID}, "*");
    }

    function requestHost() {
        window.api.receive("send_host", (host) => {
            webview.src = "https://" + host + "/live/"
            myStorage.setItem("host", host)
        });
      
        sendMessageToMain("request_host")
      }

}