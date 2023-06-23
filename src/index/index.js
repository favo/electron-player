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

    });

    /*
    *   Listener from server
    */
    window.addEventListener("message", function(e) {
        var request = JSON.parse(e.data);
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
                window.api.send("reboot_device")
                break;
            case "restart":
                window.api.send("restart_app")
                break;
            case "update_app":
                window.api.send("update_app")
                break;
            case "upgrade_firmware":
                window.api.send("upgrade_firmware")
                break;
            case "current_physical_id":
                console.log("current_physical_id");
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
        }

    })

    function requestDeviceInfo() {
        window.api.receive("send_device_info", (data) => {
            webview.contentWindow.postMessage({action: "device_info", info: data}, "*");
        });

        window.api.send("request_device_info")
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
      
        window.api.send("request_host")
      }

}