const quote = require("shell-quote/quote");
const { setRotation, executeCommand, findUniqueSSIDs } = require("./utils.js");
const fs = require("fs");

const io = require("socket.io-client");
let bleSocket = io("ws://127.0.0.1:3333");

const { ipcMain } = require("electron");

const Store = require("electron-store");
const store = new Store();

let lastConnectionSSID;

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
        console.log("resolveNetworkConnection", connection);
        if (connection.success) {
            /* Connection succesful added */

            /* Checks and wait if connection is active */
            const activeConnection = await networkManager.waitForActiveConnection(ssid);

            if (activeConnection) {
                /* Connection is active */

                /* Attemps to connect to server */
                const serverConnectionResult = await networkManager.attemptServerConnection();

                if (serverConnectionResult.success && serverConnectionResult.stdout.toString() == "1") {
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

                if (serverConnectionResult.success && serverConnectionResult.stdout.toString() == "1") {
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
        while (attempts < 50) {
            connectionState = await executeCommand(connectionStateCommand);

            console.log("waitForActiveConnection", connectionState);
            if (connectionState.success && connectionState.stdout.includes("activated")) {
                return true;
            } else if (connectionState.success && connectionState.stdout.includes("activating")) {
                attempts++;
                console.log(`waitForActiveConnection: Attempt ${attempts} failed. Retrying in 0.5 second...`);
                await new Promise((resolve) => setTimeout(resolve, 500));
            } else if (connectionState.success && connectionState.stdout.includes("deactivated")) {
                return false;
            } else {
                attempts++;
                console.log(`waitForActiveConnection: Attempt ${attempts} failed. Retrying in 0.5 second...`);
                await new Promise((resolve) => setTimeout(resolve, 500));
            }
        }

        console.log("Exceeded maximum attempts. Operation failed.");
        return false;
    },

    /*
     *   Checks connection to server
     */
    async checkConnectionToServer() {
        const host = store.get("host");

        const command = `curl -I https://${host}/up | grep Status | grep -q 200 && echo 1 || echo 0`;

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

            if (connection.success && connection.stdout.toString() == "1") {
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

    /*
     * Deletes ssid connection by SSID
     * @param {String} ssid
     */
    async deleteConnectionBySSID(ssid) {
        console.log("Deleting connection:", ssid);
        const deleteCommand = quote(["nmcli", "connection", "delete", ssid]);
        const deleteResult = await executeCommand(deleteCommand, "delete ssid");
        lastConnectionSSID = null;
        console.log("Connection deleted:", deleteResult);
        return deleteResult.success;
    },

    /*
     *   Checks if device is connected with etherenet
     */
    async checkForEthernetConnection() {
        const command = "nmcli device status | grep ethernet | grep -q connected && echo 1 || echo 0";

        return await executeCommand(command);
    },

    /*
     *   Adds dns address to /etc/resolv
     */
    async addDNS(name) {
        const command = quote(["sudo", "sed", "-i", `3inameserver ${name}`, "/etc/resolv.conf"]);

        return await executeCommand(command);
    },

    /*
     *  Enables BLE by connecting to the local BLE bridge, and registers listeners for BLE events
     */
    enableBLE() {
        bleSocket.on("ble-enabled", () => {
            console.log("BLE enabled");
        });

        bleSocket.on("rotation", (rotation) => {
            setRotation(rotation);
        });

        bleSocket.on("wifi", async (data) => {
            const result = await networkManager.connectToNetwork(JSON.parse(data));
            bleSocket.emit("network-connection-result", result);
        });

        bleSocket.on("host", (host) => {
            ipcMain.emit("set_host", host);
        });

        bleSocket.on("finish-setup", () => {
            ipcMain.emit("go_to_app");
        });

        bleSocket.on("get-network-list", async () => {
            const result = await networkManager.searchNetwork();

            if (result.success) {
                const networkList = findUniqueSSIDs(result.stdout.toString());
                bleSocket.emit("list-of-networks", networkList);
            }
        });

        // setTimeout(() => {
        //     // Disable BLE after 10 minutes to prevent someone from changing the Wi-Fi
        //     bleSocket.emit("ble-disable");
        // }, 60*1000*10);

        bleSocket.emit("ble-enable");
    },
});
