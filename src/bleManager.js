const { setScreenRotation, parseWiFiScanResults, readBluetoothID, getDeviceSettings } = require("./utils.js");
const NetworkManager = require("./networkManager");

const io = require("socket.io-client");
let bleSocket = io("ws://127.0.0.1:3333");

const { ipcMain } = require("electron");

const Store = require("electron-store");
const store = new Store();

const bleManager = (module.exports = {

    async startBle() {
        const bluetooth_id = await readBluetoothID()
        bleSocket.emit("ble-enable", {bluetooth_id: bluetooth_id, firstTime: store.get("firstTime", true)});
    },

    /*
     *  Disables BLE
     */
    disableBLE() {
        bleSocket.emit("ble-disable");
    },

    /*
     *  Enables BLE by connecting to the local BLE bridge, and registers listeners for BLE events
     */
    async enableBLE() {
        let restartOnDisconnect = false
        let networkStatusInterval;

        bleSocket.on("ble-enabled", () => {
            restartOnDisconnect = false
            console.log("BLE enabled");
        });

        bleSocket.on("ble-disabled", () => {
            console.log("BLE disabled");

            if (restartOnDisconnect) {
                bleManager.startBle()
            }
        });

        bleSocket.io.on("reconnect", () => {
            console.log("Reconnecting to BLE bridge...");

            bleManager.startBle()
        })

        bleSocket.on("device-accepted", async () => {
            restartOnDisconnect = false;
    
            networkStatusInterval = setInterval(async () => {
                const result = await NetworkManager.checkNetworkConnection();

                if (result.success && result.stdout.trim() === "1") {
                    if (result.connectionType === "Ethernet") {
                        const json = { s: true, t: "e" };
                        bleSocket.emit("notify", {key: 5, data: json});
                    } else if (result.connectionType === "Wi-Fi") {
                        const json = { s: true, t: "w", name: result.connectionName };
                        bleSocket.emit("notify", {key: 5, data: json});
                    }
                }
            }, 3000);
        });

        bleSocket.on("device-disconnected", () => {
            if (networkStatusInterval) {
                clearInterval(networkStatusInterval)
                networkStatusInterval = null 
            }

            if (restartOnDisconnect) {
                // BLE disable
            }
        });

        bleSocket.on("write", async (data) => {
            const firstByte = data[0]; 
            const restOfString = String.fromCharCode(...data.slice(1));
            
            switch (firstByte) {
                case 1:
                    ipcMain.emit("set_host", null, { host: restOfString.toString(), reload: true });
                    break;
                case 2:
                    setScreenRotation(restOfString);
                case 3:
                    ipcMain.emit("set_screen_resolution", null, restOfString);
                    break;
                case 4:
                    ipcMain.emit("connect_to_dns", null, restOfString);
                    break;
                case 5:
                    //TODO: legge is_connecting til i funksjonen selv
                    ipcMain.emit("is_connecting");
                    const connectToNetwork = await NetworkManager.connectToNetwork(JSON.parse(restOfString));
                    ipcMain.emit("connecting_result", null, connectToNetwork);

                    bleSocket.emit("notify", {key: 3, data: connectToNetwork});
                    //bleSocket.emit("network-connection-result", result);
                    
                    break;
                case 6:
                    const availableNetworks = await NetworkManager.scanAvailableNetworks();

                    if (availableNetworks.success) {
                        const networkList = parseWiFiScanResults(availableNetworks.stdout.toString());
                        bleSocket.emit("notify", {key: 1, data: [networkList]});
                    }
                    break;
                case 7:
                    const deviceSettings = await getDeviceSettings();
                    bleSocket.emit("notify", {key: 3, data: deviceSettings});
                    break;
                case 8:
                    ipcMain.emit("go_to_screen");
                    break;
                case 9:
                    // Finish setup
                    break;
                case 10:
                    ipcMain.emit("factory_reset");
                    break;
                default:
                    break;
            }
        });

        bleManager.startBle()
    },

    /*
     *  Sends pincode to bleSocket
     */
    sendPincodeToBluetooth(pincode) {
        bleSocket.emit("notify", {key: 4, data: pincode});
    },
})