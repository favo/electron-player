const { setScreenRotation, setScreenResolution, parseWiFiScanResults, readBluetoothID, getDeviceSettings } = require("./utils.js");
const NetworkManager = require("./networkManager");

const io = require("socket.io-client");
let bleSocket = io("ws://127.0.0.1:3333");

const { ipcMain } = require("electron");
const { store } = require("./store");

const RECEIVE_SET_HOST = 1
const RECEIVE_SET_ROTATION = 2
const RECEIVE_SET_RESOLUTION = 3
const RECEIVE_SET_DNS = 4
const RECEIVE_CONNECT_TO_WIFI = 5
const RECEIVE_SCAN_AVAILABLE_NETWORKS = 6
const RECEIVE_GET_DEVICE_SETTINGS = 7
const RECEIVE_GO_TO_SCREEN = 8
const RECEIVE_FINISH_SETUP = 9
const RECEIVE_FACTORY_RESET = 10

const SEND_AVAILABLE_NETWORK_LIST = 1
const SEND_CONNECT_WIFI_RESPONSE = 2
const SEND_NETWORK_STATUS = 3
const SEND_DEVICE_SETTINGS = 4
const SEND_PINCODE = 5
const SEND_FINISHED_SETUP = 6
let networkStatusInterval;

const bleManager = (module.exports = {
    async startBle() {
        const bluetooth_id = await readBluetoothID()
        bleSocket.emit("ble-enable", {bluetooth_id: bluetooth_id, firstTime: store.get("firstTime", true)});
    },

    /*
     *  Enables BLE by connecting to the local BLE bridge, and registers listeners for BLE events
     */
    async enableBLE() {
        bleSocket.io.on("reconnect", () => {
            console.log("Reconnecting to BLE bridge...");

            bleManager.startBle()
        })

        bleSocket.on("device-accepted", async () => {
            networkStatusInterval = setInterval(async () => {
                const result = await NetworkManager.checkNetworkConnection();

                if (result.success && result.stdout === "1") {
                    if (result.connectionType === "Ethernet") {
                        bleManager.send(SEND_NETWORK_STATUS, { s: true, t: "e" })
                    } else if (result.connectionType === "Wi-Fi") {
                        bleManager.send(SEND_NETWORK_STATUS, { s: true, t: "w", name: result.connectionName })
                    }
                }
            }, 3000);
        });

        bleSocket.on("device-disconnected", () => {
            bleManager.stopNetworkStatusInterval()
            bleManager.startBle()
        });

        bleSocket.on("write", async (data) => {
            const dataType = data[0]; 
            const content = String.fromCharCode(...data.slice(1));
            
            switch (dataType) {
                case RECEIVE_SET_HOST:
                    ipcMain.emit("set_host", null, { host: content.toString(), reload: true });
                    break;
                case RECEIVE_SET_ROTATION:
                    setScreenRotation(content);
                    break;
                case RECEIVE_SET_RESOLUTION:
                    setScreenResolution(content);
                    break;
                case RECEIVE_SET_DNS:
                    ipcMain.emit("connect_to_dns", null, content);
                    break;
                case RECEIVE_CONNECT_TO_WIFI:
                    const connectToNetwork = await NetworkManager.connectToNetwork(JSON.parse(content));
                    bleManager.send(SEND_CONNECT_WIFI_RESPONSE, connectToNetwork)
                    break;
                case RECEIVE_SCAN_AVAILABLE_NETWORKS:
                    const availableNetworks = await NetworkManager.scanAvailableNetworks();

                    if (availableNetworks.success) {
                        const networkList = parseWiFiScanResults(availableNetworks.stdout.toString());
                        bleManager.send(SEND_AVAILABLE_NETWORK_LIST, networkList)
                    }
                    break;
                case RECEIVE_GET_DEVICE_SETTINGS:
                    const deviceSettings = await getDeviceSettings();
                    bleManager.send(SEND_DEVICE_SETTINGS, deviceSettings)

                    break;
                case RECEIVE_GO_TO_SCREEN:
                    ipcMain.emit("go_to_screen");
                    break;
                case RECEIVE_FINISH_SETUP:
                    store.set("firstTime", false)
                    bleManager.send(SEND_FINISHED_SETUP, "FINISH_SETUP")
                    bleManager.stopNetworkStatusInterval()
                    break;
                case RECEIVE_FACTORY_RESET:
                    ipcMain.emit("factory_reset");
                    break;
                default:
                    break;
            }
        });

        bleManager.startBle()
    },

    stopNetworkStatusInterval() {
        if (networkStatusInterval) {
            clearInterval(networkStatusInterval)
            networkStatusInterval = null 
        }
    },

    send(key, data) {
        bleSocket.emit("notify", {key: key, data: data});
    },

    /*
     *  Sends pincode to bleSocket
     */
    sendPincodeToBluetooth(pincode) {
        bleManager.send(SEND_PINCODE, pincode)
    },
})