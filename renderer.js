var host = "https://local.infoskjermen.no"
var myStorage
var webviewReady = false;
var webview


window.onload = function() {
    
    myStorage = window.localStorage;
    storagehost = myStorage.getItem("host") 
    webview = document.getElementById("iframe");
    
    webview.src = host + "/live/"

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
        console.log(e.data);
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
        }

    })

    function requestDeviceInfo() {
        window.api.send("request_device_info")
        window.api.receive("send_device_info", (data) => {
            webview.contentWindow.postMessage({action: "device_info", info: data}, "*");
        });
    }

}