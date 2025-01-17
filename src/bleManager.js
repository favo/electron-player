const bleno = require("bleno");
const { configurationService, bleCallbacks, SERVICE_UUID } = require("./ble-service");
const { setScreenRotation, findUniqueSSIDs, getDeviceSettings, readBluetoothID, setScreenResolution } = require("./utils");
const { ipcMain } = require("electron");
const NetworkManager = require("./networkManager");

const Store = require("electron-store");
const store = new Store();

let blenoReady = false;

let isSubscribed = false;
let networkConnectionCallback;

let pincodeIsSubscribed
let pincodeCallback

let networkStatusInterval
let restartOnDisconnect = false


bleCallbacks.onSetRotation = (rotation) => {
    setScreenRotation(rotation)
};

bleCallbacks.onSetWIFI = async (data) => {
    ipcMain.emit("is_connecting");
    const result = await NetworkManager.connectToNetwork(JSON.parse(data));
    ipcMain.emit("connecting_result", null, result);

    await bleManager.sendNetworkConnectionResult(result)
};

bleCallbacks.onSetHost = (host) => {
    ipcMain.emit("set_host", null, { host: host.toString(), reload: true });
};

bleCallbacks.onSetDns = (dns) => {
    NetworkManager.addDNS(dns)
};

bleCallbacks.onSetResolution = (resolution) => {
    setScreenResolution(resolution)
};

bleCallbacks.sendNetworkList = async (networkListSubscribed, maxValueSizeNetworkList, networkListCallback) => {
    const result = await NetworkManager.searchNetwork();

    if (result.success) {
        const networkList = findUniqueSSIDs(result.stdout.toString());

        if (networkListSubscribed && networkListCallback) {
            bleManager.sendDataInChunks(networkList, networkListCallback, maxValueSizeNetworkList)
        }
    }
};

bleCallbacks.sendDeviceSettings = async (deviceSettingsIsSubscribed, deviceSettingsMaxValue, deviceSettingsCallback) => {
    const data = await getDeviceSettings();

    if (deviceSettingsIsSubscribed && deviceSettingsCallback != null) {
        bleManager.sendDataInChunks(data, deviceSettingsCallback, deviceSettingsMaxValue)
    }
};

bleCallbacks.notifyPincode = (status, callback) => {
    pincodeIsSubscribed = status
    pincodeCallback = callback
}

bleCallbacks.notifyNetworkConnection = (status, callback) => {
    isSubscribed = status;
    networkConnectionCallback = callback;
};

bleCallbacks.finishSetup = () => {
    restartOnDisconnect = true
};

bleCallbacks.factoryReset = () => {
    ipcMain.emit("factory_reset");
};

bleCallbacks.goToScreen = () => {
    ipcMain.emit("go_to_screen");
};


const bleManager = (module.exports = {
    async enableBle(){
        bleno.on("stateChange", (state) => {
            console.log("on -> stateChange: " + state);
            if (state === "poweredOn") {
                blenoReady = true;
            }
        });

        bleno.on("advertisingStart", (err) => {
            if (err) {
                console.log(err);
                return;
            }
            console.log("advertising...");
            bleno.setServices([configurationService]);
        });

        bleno.on("accept", async () => {
            await this.checkNetworkStatus()
            restartOnDisconnect = false
            networkStatusInterval = setInterval(async () => {
                await this.checkNetworkStatus()
            }, 3000)
        });

        bleno.on("disconnect", () => {
            if (networkStatusInterval) {
                clearInterval(networkStatusInterval);
                networkStatusInterval = null;
            }

            if (restartOnDisconnect) {
                bleManager.restartBle()
            }
        });

        await this.startBle()
    },

    async checkNetworkStatus() {
        const result = await NetworkManager.checkNetworkStatus();
        await this.sendNetworkConnection(result)
    },

    async sendNetworkConnectionResult(result){
        if (result.success && result.stdout.trim() === "1") {
            if (isSubscribed && networkConnectionCallback != null) {
                if (result.connectionType === "Ethernet") {
                    await this.sendNetworkConnection(result, "e")
                } else if (result.connectionType === "Wi-Fi") {
                    await this.sendNetworkConnection(result, "w", result.connectionName)
                }
            }
        }
    },

    async sendNetworkConnection(data, type, name){
        const result = data.success && data.stdout === "1";
        const json = { s: result, t: type, name: name };
        const buffer = new Buffer.from(JSON.stringify(json), "utf8");

        networkConnectionCallback(buffer);
    },

    sendDataInChunks(data, callback, chunkSize) {
        const jsonData = JSON.stringify(data);

        let offset = 0;
        const sendNextChunk = () => {
            if (offset >= jsonData.length) return;

            const chunk = Buffer.from(
                jsonData.slice(offset, offset + chunkSize)
            );

            if (callback) {
                callback(chunk)
            }

            offset += chunkSize;
            setTimeout(sendNextChunk, 20);
        };

        sendNextChunk();
    },

    async restartBle(){
        await bleno.stopAdvertising();
        // Mulig vi må vente på bleno.on("disconnect") her
        this.startBle()
    },

    async startBle() {
        const deviceName = "rpi"
        const bluetooth_id = await readBluetoothID()
        const firstTime =  store.get("firstTime", true)

        if (blenoReady) {
            const firstTimeBuffer = Buffer.from([firstTime ? 1 : 0]);

            const advertisementData = Buffer.concat([
                Buffer.from([0x02, 0x01, 0x06]),
                Buffer.from([deviceName.length + 1, 0x09]),
                Buffer.from(deviceName),
                Buffer.from([bluetooth_id.length + 1 + 1, 0xff]),
                Buffer.from(bluetooth_id),
                firstTimeBuffer,
            ]);

            const scanResponseData = Buffer.concat([
                Buffer.from([0x11, 0x07]), // Length and type for complete list of 128-bit Service UUIDs
                Buffer.from(
                    SERVICE_UUID.match(/.{1,2}/g)
                        .reverse()
                        .join(""),
                    "hex"
                ), // Service UUID in little-endian format
            ]);

            bleno.startAdvertisingWithEIRData(
                advertisementData,
                scanResponseData,
                (err) => {
                    if (err) {
                        console.error("Failed to start advertising:", err);
                    } else {
                        console.log("Advertising started successfully");
                    }
                }
            );
        }
    },

    /*
     *  Sends pincode to bleSocket
     */
    sendPincodeToBluetooth(pincode) {
        if (pincodeIsSubscribed && pincodeCallback != null) {
            const buffer = new Buffer.from(JSON.stringify(pincode), "utf8");
            pincodeCallback(buffer);
        }
    },
})