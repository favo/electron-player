const quote = require("shell-quote/quote");
const { setRotation, executeCommand, findUniqueSSIDs, readBluetoothID, getDeviceSettings } = require("./utils.js");

const io = require("socket.io-client");
let bleSocket = io("ws://127.0.0.1:3333");

const { ipcMain } = require("electron");

const Store = require("electron-store");
const store = new Store();

let lastConnectionSSID;
let ethernetInterval;

const networkManager = (module.exports = {
    /*
     *  Function for searching after local networks
     *  return {String} string with ssid and security
     */
    async searchNetwork() {
        const command = "nmcli --fields SSID,SECURITY --terse --mode multiline dev wifi list";

        return await executeCommand(command);
    },

    /*
     * Base function. Decides security and type of network
     * @param {Object} data
     */
    async connectToNetwork(data) {
        const ssid = data.ssid;
        const password = data.password;
        const security = data.security || "";
        const options = data.options || {};

        if (lastConnectionSSID != null) {
            await networkManager.deleteConnectionBySSID(lastConnectionSSID);
        }

        lastConnectionSSID = ssid;

        if (options.hidden) {
            return await networkManager.connectToHiddenNetwork(ssid, password);
        }

        if (security.includes("WPA") && password) {
            return await networkManager.connectToWPANetwork(ssid, password);
        } else {
            return await networkManager.connectToUnsecureNetwork(ssid);
        }
    },

    /*
     * Function for resolving a connection attempt
     * @param {JSONObject} connection
     * @param {String} ssid
     * return {JSONObject}
     */
    async resolveNetworkConnection(connection, ssid) {
        if (connection.success) {
            /* Connection succesful added */

            /* Checks and wait if connection is active */
            const activeConnection = await networkManager.waitForActiveConnection(ssid);
            console.log("activeConnection", activeConnection);

            if (activeConnection.success) {
                /* Connection is active */

                /* Attemps to connect to server */
                const serverConnectionResult = await networkManager.attemptServerConnection();

                if (serverConnectionResult.success && serverConnectionResult.stdout.toString() === "1") {
                    /* Successfully pings server */
                    return serverConnectionResult;
                } else {
                    /* cant connect to server, may be wrong password */
                    networkManager.deleteConnectionBySSID(ssid);

                    return serverConnectionResult;
                }
            } else {
                /* Connection is not active, deletes connection */
                networkManager.deleteConnectionBySSID(ssid);

                return activeConnection;
            }
        } else {
            /* Connection unsuccesful added */
            return connection;
        }
    },

    /*
     * Function for connection to a unsecure network
     * @param {String} ssid
     * return {JSONObject}
     */
    async connectToUnsecureNetwork(ssid) {
        const connectCommand = quote(["nmcli", "device", "wifi", "connect", ssid]);

        const connection = await executeCommand(connectCommand, "Unsecure network connection");

        return await networkManager.resolveNetworkConnection(connection, ssid);
    },

    /*
     * Function for connection to a WPA3 network
     * @param {String} ssid
     * @param {String} password
     * return {JSONObject}
     */
    async connectToWPANetwork(ssid, password) {
        const connectCommand = quote(["nmcli", "connection", "add", "type", "wifi", "ifname", "wlan0", "con-name", ssid, "ssid", ssid, "--", "wifi-sec.key-mgmt", "wpa-psk", "wifi-sec.psk", password]);

        const connection = await executeCommand(connectCommand, "WPA network connection");

        return await networkManager.resolveNetworkConnection(connection, ssid);
    },

    /*
     * Function for connection to a hidden network. NOT WORKING
     * @param {String} ssid
     * @param {String} password
     * return {Boolean}
     */
    async connectToHiddenNetwork(ssid, password) {
        const addConnectionCommand = quote(["nmcli", "conn", "add", "type", "wifi", "ifname", "wlan0", "con-name", ssid, "ssid", ssid, "--", "wifi-sec.key-mgmt", "wpa-psk", "wifi-sec.psk", password]);

        const connectionResult = await executeCommand(addConnectionCommand, "Network connection");

        console.log("connectionResult", connectionResult);
        if (connectionResult.success && connectionResult.stdout.includes("successfully added")) {
            const connectCommand = quote(["nmcli", "conn", "up", ssid]);

            const connectResult = await executeCommand(connectCommand);

            console.log("connectResult", connectResult);
            if (connectResult.success && connectResult.stdout.includes("Connection successfully activated")) {
                /* Attemps to connect to server */
                const serverConnectionResult = await networkManager.attemptServerConnection();

                if (serverConnectionResult.success && serverConnectionResult.stdout.toString() === "1") {
                    /* Successfully pings server */
                    return serverConnectionResult;
                } else {
                    /* cant connect to server, may be wrong password */
                    networkManager.deleteConnectionBySSID(ssid);

                    return serverConnectionResult;
                }
            } else {
                /* Connection not successfully activated, possible wrong password */

                networkManager.deleteConnectionBySSID(ssid);
                return connectResult;
            }
        } else {
            return connectionResult;
        }
    },

    /*
     *   Checks and waits for connection to be activated
     *   @param {String} ssid
     *   return {Boolean}
     */
    async waitForActiveConnection(ssid) {
        const connectionStateCommand = quote(["nmcli", "-f", "GENERAL.STATE", "connection", "show", ssid]);

        let attempts = 0;
        let connectionState;
        let lastConnectionState = null;
        while (attempts < 75) {
            connectionState = await executeCommand(connectionStateCommand);

            console.log("waitForActiveConnection", connectionState);
            if (connectionState.success && connectionState.stdout.includes("activated")) {
                return connectionState;
            } else if (connectionState.success && connectionState.stdout.includes("activating")) {
                lastConnectionState = "activating";
                attempts++;
                console.log(`waitForActiveConnection: Attempt ${attempts} failed. Retrying in 0.5 second...`);
                await new Promise((resolve) => setTimeout(resolve, 500));
            } else if (connectionState.success && connectionState.stdout.includes("deactivated")) {
                connectionState.success = false;
                connectionState.stdout = "Connection state deactivating";
                return false;
            } else {
                if (lastConnectionState === "activating") {
                    connectionState.success = false;
                    connectionState.stderr = "Operation went from activating to null. Most likely wrong password";
                    connectionState.type = "802-11-wireless-security.psk";
                    return connectionState;
                } else {
                    attempts++;
                    console.log(`waitForActiveConnection: Attempt ${attempts} failed. Retrying in 0.5 second...`);
                    await new Promise((resolve) => setTimeout(resolve, 500));
                }
            }
        }

        connectionState.success = false;
        connectionState.stderr = "Exceeded maximum attempts. Operation failed.";
        return connectionState;
    },

    /*
     *   Checks connection to server
     */
    async checkConnectionToServer() {
        const host = store.get("host");

        const command = `curl -sI https://${host}/up | grep HTTP | grep -q 200 && echo 1 || echo 0`;

        return await executeCommand(command, "server connection");
    },

    /*
     *   Attemps to connect to sever multiple times by running checkConnectionToServer
     */
    async attemptServerConnection() {
        let attempts = 0;
        let connection;

        while (attempts < 20) {
            connection = await networkManager.checkConnectionToServer();

            if (connection.success && connection.stdout.toString() === "1") {
                return connection;
            } else {
                attempts++;
                console.log(`Attempt ${attempts} failed. Retrying in 0.5 second...`);
                await new Promise((resolve) => setTimeout(resolve, 500)); // Wait for 1 second before retrying
            }
        }

        console.log("Exceeded maximum attempts. Operation failed.");
        return connection;
    },

    async deleteConnectionBySSID(ssid) {
        const deleteCommand = quote(["nmcli", "connection", "delete", ssid]);
        const deleteResult = await executeCommand(deleteCommand, "delete ssid");
        lastConnectionSSID = null;
        return deleteResult.success;
    },

    /*
     * Resets all wifi connections and reset dns settings for ethernet connections
     */
    async resetAllConnections() {
        const deleteAllCommand = "nmcli -t -f name,type connection show";

        const result = await executeCommand(deleteAllCommand, "Delete all connections");

        const lines = result.stdout.split("\n");

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].split(":");
            const name = line[0];
            const type = line[1];

            if (type === "802-11-wireless") {
                await networkManager.deleteConnectionBySSID(name);
            }
            else if(type === "802-3-ethernet") {
                await executeCommand(`nmcli con mod "${name}" ipv4.dns ""`)
                await executeCommand(`nmcli con mod "${name}" ipv4.ignore-auto-dns no`)
            }
        }
    },

    /*
     *   Checks if device is connected with etherenet
     */
    async checkEthernetConnection() {
        const command = "nmcli device status | grep ethernet | grep -q connected && echo 1 || echo 0";

        const result = await executeCommand(command);

        if (result.success && result.stdout.trim() === "1") {
            return await networkManager.attemptServerConnection();
        } else {
            return result;
        }
    },

    /*
    *   Checks if device is connected via Wi-Fi
    */
    async checkWifiConnection() {
        const command = "nmcli device status | grep wifi | grep -q connected && echo 1 || echo 0";

        const result = await executeCommand(command);

        if (result.success && result.stdout.trim() === "1") {
            return await networkManager.attemptServerConnection();
        } else {
            return result;
        }
    },

    /*
    *   Check overall network status and connection type
    */
    async checkNetworkStatus() {
        const ethernetResult = await networkManager.checkEthernetConnection();

        if (ethernetResult.success && ethernetResult.stdout.trim() === "1") {
            return { connectionType: "Ethernet", ...ethernetResult };
        }

        const wifiResult = await networkManager.checkWifiConnection();

        if (wifiResult.success && wifiResult.stdout.trim() === "1") {
            const connectionName = await networkManager.getSSID()
            return { connectionType: "Wi-Fi", connectionName: connectionName.stdout.trim(), ...wifiResult };
        }

        return { success: false, error: "No active network connection" };
    },

    /*
     *   Checks if device is connected with etherenet in interval
     */
    async checkEthernetConnectionInterval() {
        ethernetInterval = setInterval(async () => {
            try {
                const result = await networkManager.checkEthernetConnection();
                if (result.success && result.stdout === "1") {
                    ipcMain.emit("ethernet_status", result)
                    
                    if (ethernetInterval) {
                        clearInterval(ethernetInterval);
                        ethernetInterval = null;
                    }
                }
            } catch {}
        }, 2000);
    },

    /*
     *   Stops ethernetinterval
     */
    async stopEthernetInterval() {
        if (ethernetInterval) {
            clearInterval(ethernetInterval);
            ethernetInterval = null;
        }
    },

    /*
     *   Adds dns address to /etc/resolv
     */
    async addDNS(dns) {
        const connectionNameResult = await networkManager.getActiveConnection()
        if (connectionNameResult.success) {
            const connectionName = connectionNameResult.stdout
            
            const modifyDNS = await executeCommand(`nmcli con mod "${connectionName}" ipv4.dns ${dns}`)
            if (modifyDNS.success) {
                const disableAutoDNS = await executeCommand(`nmcli con mod "${connectionName}" ipv4.ignore-auto-dns yes`);
                
                if (disableAutoDNS) {
                    return await executeCommand(`nmcli con down "${connectionName}" && nmcli con up "${connectionName}"`);
                } else {
                    return disableAutoDNS
                }
            } else {
                return modifyDNS
            }
        }
    },


    /*
     *   Returns execute command object with connection name
     */
    async getSSID() {
        return await executeCommand("nmcli -t -f active,ssid dev wifi | grep '^yes' | cut -d':' -f2")
    },

    async getActiveConnection(){
        return await executeCommand("nmcli -g active,uuid con | grep '^yes' | cut -d':' -f2 | head -n 1")
    },

    /*
     *  Enables BLE by connecting to the local BLE bridge, and registers listeners for BLE events
     */
    async enableBLE() {
        let restartOnDisconnect = false

        bleSocket.on("ble-enabled", () => {
            restartOnDisconnect = false
            console.log("BLE enabled");
        });

        bleSocket.on("ble-disabled", () => {
            console.log("BLE disabled");

            if (restartOnDisconnect) {
                networkManager.startBle()
            }
        });

        bleSocket.on("rotation", (rotation) => {
            setRotation(rotation);
        });

        bleSocket.on("get-network-list", async () => {
            const result = await networkManager.searchNetwork();

            if (result.success) {
                const networkList = findUniqueSSIDs(result.stdout.toString());
                bleSocket.emit("list-of-networks", networkList);
            }
        });

        bleSocket.on("wifi", async (data) => {
            ipcMain.emit("is_connecting");
            const result = await networkManager.connectToNetwork(JSON.parse(data));
            ipcMain.emit("connecting_result", null, result);

            bleSocket.emit("network-connection-result", result);
        });

        bleSocket.on("host", (host) => {
            ipcMain.emit("set_host", null, { host: host.toString(), reload: true });
        });
        
        bleSocket.on("dns", (dns) => {
            ipcMain.emit("connect_to_dns", null, dns);
        });
        
        bleSocket.on("check-network-status", async () => {
            const result = await networkManager.checkNetworkStatus();

            if (result.success && result.stdout.trim() === "1") {
                if (result.connectionType === "Ethernet") {
                    bleSocket.emit("ethernet-status", result);
                } else if (result.connectionType === "Wi-Fi") {
                    bleSocket.emit("network-connection-result", result);
                }
            }
        });

        bleSocket.on("get-device-settings", async () => {
            const result = await getDeviceSettings();

            bleSocket.emit("device-settings", result);
        });

        bleSocket.on("resolution", (res) => {
            ipcMain.emit("set_screen_resolution", null, res);
        });

        bleSocket.on("restart-bluetooth", () => {
            restartOnDisconnect = true
            bleSocket.emit("ble-disable");
        });

        bleSocket.on("factory-reset", () => {
            ipcMain.emit("factory_reset");
        });

        bleSocket.on("go-to-screen", () => {
            ipcMain.emit("go_to_screen");
        });

        networkManager.startBle()
    },

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
     *  Sends pincode to bleSocket
     */
    sendPincodeToBluetooth(pincode) {
        bleSocket.emit("pincode", pincode)
    },

});
