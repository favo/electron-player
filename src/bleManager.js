const bleno = require("@stoprocent/bleno");

// These can be any sequence of 32 hex digits
const SERVICE_UUID = "89496822200000000000000000000000";

// Write
const ROTATION_CHARACTERISTIC_UUID = "89496822201000000000000000000000";
const WIFI_CHARACTERISTIC_UUID = "89496822202000000000000000000000";
const HOST_CHARACTERISTIC_UUID = "89496822204000000000000000000000";
const DNS_CHARACTERISTIC_UUID = "89496822213000000000000000000000"
const RESOLUTION_CHARACTERISTIC_UUID = "89496822210000000000000000000000";
const FINISH_CHARACTERISTIC_UUID = "89496822209000000000000000000000";
const FACTORY_RESET_CHARACTERISTIC_UUID = "89496822214000000000000000000000";
const GO_TO_SCREEN_CHARACTERISTIC_UUID = "89496822212000000000000000000000";

// Notify
const NOTIFY_NETWORK_LIST_CHARACTERISTIC_UUID =
    "89496822205000000000000000000000";
const NOTIFY_NETWORK_CONNECTION_CHARACTERISTIC_UUID =
    "89496822206000000000000000000000";
const NOTIFY_DEVICE_SETTINGS_CHARACTERISTIC_UUID =
    "89496822207000000000000000000000";
const NOTIFY_PINCODE_CHARACTERISTIC_UUID =
    "89496822211000000000000000000000";

const bleCallbacks = {
    onSetRotation: (rotation) => {},
    onSetWIFI: (ssid) => {},
    onSetHost: (host) => {},
    onSetDns: (dns) => {},
    onSetResolution: (res) => {},
    sendNetworkList: (isSubscribed, maxValueSize, callback) => {},
    sendDeviceSettings: (isSubscribed, maxValueSize, callback) => {},
    notifyNetworkConnection: (isSubscribed, callback) => {},
    notifyPincode: (isSubscribed, callback) => {},
    finishSetup: () => {},
    factoryReset: () => {},
    goToScreen: () => {},
};

const setRotationCharacteristic = new bleno.Characteristic({
    uuid: ROTATION_CHARACTERISTIC_UUID,
    properties: ["write"],
    onWriteRequest: (data, _offset, _withoutResponse, callback) => {
        const dataString = data.toString("utf-8");
        console.log(
            "setRotationCharacteristic write request: " + data.toString("utf-8")
        );
        if (["normal", "left", "right", "inverted"].includes(dataString)) {
            bleCallbacks.onSetRotation(dataString);
            callback(bleno.Characteristic.RESULT_SUCCESS);
        } else {
            callback(bleno.Characteristic.RESULT_UNLIKELY_ERROR);
        }
    },
});

const setWIFICharacteristic = new bleno.Characteristic({
    uuid: WIFI_CHARACTERISTIC_UUID,
    properties: ["write"],
    onWriteRequest: (data, _offset, _withoutResponse, callback) => {
        console.log(
            "setWIFICharacteristic write request: " + data.toString("utf-8")
        );
        bleCallbacks.onSetWIFI(data.toString("utf-8"));
        callback(bleno.Characteristic.RESULT_SUCCESS);
    },
});

const setHostCharacteristic = new bleno.Characteristic({
    uuid: HOST_CHARACTERISTIC_UUID,
    properties: ["write"],
    onWriteRequest: (data, _offset, _withoutResponse, callback) => {
        console.log(
            "setHostCharacteristic write request: " + data.toString("utf-8")
        );
        bleCallbacks.onSetHost(data.toString("utf-8"));
        callback(bleno.Characteristic.RESULT_SUCCESS);
    },
});

const setDnsCharacteristic = new bleno.Characteristic({
    uuid: DNS_CHARACTERISTIC_UUID,
    properties: ["write"],
    onWriteRequest: (data, _offset, _withoutResponse, callback) => {
        console.log("setDnsCharacteristic write request: " + data.toString("utf-8"));
        bleCallbacks.onSetDns(data.toString("utf-8"));
        callback(bleno.Characteristic.RESULT_SUCCESS);
    },
});

const setResolutionCharacteristic = new bleno.Characteristic({
    uuid: RESOLUTION_CHARACTERISTIC_UUID,
    properties: ["write"],
    onWriteRequest: (data, _offset, _withoutResponse, callback) => {
        console.log(
            "setResolutionCharacteristic write request: " + data.toString("utf-8")
        );
        bleCallbacks.onSetResolution(data.toString("utf-8"));
        callback(bleno.Characteristic.RESULT_SUCCESS);
    },
});

const notifyNetworkListCharacteristic = new bleno.Characteristic({
    uuid: NOTIFY_NETWORK_LIST_CHARACTERISTIC_UUID,
    properties: ["notify"],
    onSubscribe: (maxValueSize, updateValueCallback) => {
        console.log("notifyNetworkListCharacteristic - onSubscribe");
        bleCallbacks.sendNetworkList(true, maxValueSize, updateValueCallback);
    },
    onUnsubscribe: () => {
        console.log("notifyNetworkListCharacteristic - onUnsubscribe");
        bleCallbacks.sendNetworkList(false, null, null);
    },
});

const notifyNetworkConnectionCharacteristic = new bleno.Characteristic({
    uuid: NOTIFY_NETWORK_CONNECTION_CHARACTERISTIC_UUID,
    properties: ["notify"],
    onSubscribe: (maxValueSize, updateValueCallback) => {
        console.log("notifyNetworkConnectionCharacteristic - onSubscribe");
        bleCallbacks.notifyNetworkConnection(true, updateValueCallback);
    },
    onUnsubscribe: () => {
        console.log("notifyNetworkConnectionCharacteristic - onUnsubscribe");
        bleCallbacks.notifyNetworkConnection(false, null);
    },
});

const notifyDeviceSettingsCharecteristic = new bleno.Characteristic({
    uuid: NOTIFY_DEVICE_SETTINGS_CHARACTERISTIC_UUID,
    properties: ["notify"],
    onSubscribe: (maxValueSize, updateValueCallback) => {
        console.log("notifyDeviceSettingsCharecteristic - onSubscribe");
        bleCallbacks.sendDeviceSettings(true, maxValueSize, updateValueCallback);
    },
    onUnsubscribe: () => {
        console.log("notifyDeviceSettingsCharecteristic - onUnsubscribe");
        bleCallbacks.sendDeviceSettings(false, null, null);
    },
});

const notifyPincodeCharacteristic = new bleno.Characteristic({
    uuid: NOTIFY_PINCODE_CHARACTERISTIC_UUID,
    properties: ["notify"],
    onSubscribe: (_maxValueSize, updateValueCallback) => {
        console.log("notifyPincodeCharacteristic - onSubscribe");
        bleCallbacks.notifyPincode(true, updateValueCallback);
    },
    onUnsubscribe: () => {
        console.log("notifyPincodeCharacteristic - onUnsubscribe");
        bleCallbacks.notifyPincode(false, null);
    },
});

const finishCharacteristic = new bleno.Characteristic({
    uuid: FINISH_CHARACTERISTIC_UUID,
    properties: ["write"],
    onWriteRequest: (data, _offset, _withoutResponse, callback) => {
        console.log("finishCharacteristic write request: " + data.toString("utf-8"));
        bleCallbacks.finishSetup();
        callback(bleno.Characteristic.RESULT_SUCCESS);
    },
});

const factoryResetCharacteristic = new bleno.Characteristic({
    uuid: FACTORY_RESET_CHARACTERISTIC_UUID,
    properties: ["write"],
    onWriteRequest: (data, _offset, _withoutResponse, callback) => {
        console.log("factoryResetCharacteristic write request: " + data.toString("utf-8"));
        bleCallbacks.factoryReset();
        callback(bleno.Characteristic.RESULT_SUCCESS);
    },
});


const goToScreenCharacteristic = new bleno.Characteristic({
    uuid: GO_TO_SCREEN_CHARACTERISTIC_UUID,
    properties: ["write"],
    onWriteRequest: (data, _offset, _withoutResponse, callback) => {
        console.log("goToScreenCharacteristic write request: " + data.toString("utf-8") );
        bleCallbacks.goToScreen();
        callback(bleno.Characteristic.RESULT_SUCCESS);
    },
});

console.log("initial state: " + bleno.state)
bleno.on("stateChange", (state) => {
    console.log("on -> stateChange: " + state);
    if (state === "poweredOn") {
        blenoReady = true;

        bleManager.startBle()
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
    console.log("accept");
    await bleManager.checkNetworkStatus()
    restartOnDisconnect = false
    networkStatusInterval = setInterval(async () => {
        await bleManager.checkNetworkStatus()
    }, 3000)
});

bleno.on("disconnect", () => {
    console.log("disconnect");
    if (networkStatusInterval) {
        clearInterval(networkStatusInterval);
        networkStatusInterval = null;
    }

    if (restartOnDisconnect) {
        bleManager.restartBle()
    }
});

const configurationService = new bleno.PrimaryService({
    uuid: SERVICE_UUID,
    characteristics: [
        setRotationCharacteristic,
        setWIFICharacteristic,
        setHostCharacteristic,
        setDnsCharacteristic,
        setResolutionCharacteristic,
        notifyNetworkListCharacteristic,
        notifyDeviceSettingsCharecteristic,
        notifyNetworkConnectionCharacteristic,
        notifyPincodeCharacteristic,
        finishCharacteristic,
        factoryResetCharacteristic,
        goToScreenCharacteristic
    ],
});

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