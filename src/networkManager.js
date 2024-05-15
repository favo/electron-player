const quote = require("shell-quote/quote");
const { setRotation, executeCommand } = require("./utils.js");
const fs = require("fs");

const io = require("socket.io-client");
let bleSocket = io("ws://127.0.0.1:3333");

const { ipcMain } = require("electron");

const Store = require("electron-store");
const store = new Store();

// TODO: Slette eksisterende nettverk hvis man kobler til et nytt et.

const networkManager = (module.exports = {
    /*
     *   Function for searching after local networks
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
        let result = false;

        if (password) {
            if (data.security.includes("WPA3")) {
                result = networkManager.connectToWPA3Network(ssid, password);
            } else {
                result = networkManager.connectToWPANetwork(ssid, password);
            }
        } else {
            result = networkManager.connectToUnsecureNetwork(ssid);
        }

        return result;
    },

    /*
     * Function for connection to a unsecure network
     * @param {String} ssid
     * return {Boolean}
     */
    async connectToUnsecureNetwork(ssid) {
        const connectCommand = quote(["nmcli", "device", "wifi", "connect", ssid]);
        const grepCommand = quote(["grep", "-q", "activated"]);
        const fullCommand = connectCommand + " | " + grepCommand;

        const result = await executeCommand(fullCommand);

        if (result.success) {
            return await networkManager.checkConnectionToServer();
        } else {
            return false;
        }
    },

    /*
     * Function for connection to a WPA network
     * @param {String} ssid
     * @param {String} password
     * return {Boolean}
     */
    async connectToWPANetwork(ssid, password) {
        const connectCommand = quote(["nmcli", "device", "wifi", "connect", ssid, "password", password]);
        const grepCommand = quote(["grep", "-q", "activated"]);
        const fullCommand = connectCommand + " | " + grepCommand;

        const result = await executeCommand(fullCommand);

        if (result.success) {
            return await networkManager.checkConnectionToServer();
        } else {
            return false;
        }
    },

    /*
     * Function for connection to a hidden network. NOT WORKING
     * @param {String} ssid
     * @param {String} password
     * return {Boolean}
     */
    async connectToHiddenNetwork(ssid, password) {
        const connectCommand = quote(["nmcli", "device", "wifi", "connect", ssid, "password", password, "hidden", "yes"]);
        const grepCommand = quote(["grep", "-q", "activated"]);
        const fullCommand = connectCommand + " | " + grepCommand;

        const result = await executeCommand(fullCommand);

        if (result.success) {
            return await networkManager.checkConnectionToServer();
        } else {
            return false;
        }
    },

    /*
     * Function for connection to a WPA3 network
     * @param {String} ssid
     * @param {String} password
     * return {Boolean}
     */
    async connectToWPA3Network(ssid, password) {
        const connectCommand = quote(["nmcli", "connection", "add", "type", "wifi", "ifname", "wlan0", "con-name", ssid, "ssid", ssid, "--", "wifi-sec.key-mgmt", "wpa-psk", "wifi-sec.psk", password]);

        const connect = await executeCommand(connectCommand);

        if (connect.success) {
            /* Connection succesful added */
            /* Checks if connection is active */
            const activeConnectionCommand = quote(["nmcli", "connection", "show", "--active"]);
            const activeConnection = await executeCommand(activeConnectionCommand);

            if (activeConnection.success && activeConnection.stdout.includes(ssid)) {
                /* Connection is active, and attepts to ping server up to 10 times */
                const serverConnectionResult = await networkManager.attemptServerConnection();
                if (serverConnectionResult) {
                    /* Successfully pings server */
                    return true;
                } else {
                    /* cant connect to server, may be wrong password */
                    const deleteResult = networkManager.deleteConnectionBySSID(ssid);
                    return false;
                }
            } else {
                /* Connection is not active, deletes connection */
                const deleteResult = networkManager.deleteConnectionBySSID(ssid);
                return false;
            }
        } else {
            /* Connection unsuccesful added */
            return false;
        }
    },

    /*
     * Deletes ssid connection by SSID
     * @param {String} ssid
     */
    async deleteConnectionBySSID(ssid) {
        const deleteCommand = quote(["nmcli", "connection", "delete", ssid]);
        const deleteResult = await executeCommand(deleteCommand);
        return deleteResult.success;
    },

    /*
     *   Checks connection to server
     */
    async checkConnectionToServer() {
        const host = store.get("host");

        const command = `curl -I https://${host}/up | grep Status | grep -q 200 && echo 1 || echo 0`;

        const result = await executeCommand(command);

        if (result.success && result.stdout.toString() == "1") {
            bleSocket.emit("ble-disable");
            /* TODO: turn off io socket */
            if (this.ethernetInterval) {
                clearInterval(this.ethernetInterval);
                this.ethernetInterval = null;
            }
            return true;
        } else {
            return false;
        }
    },

    /*
     *   Attemps to connect to sever multiple times by running checkConnectionToServer
     */
    async attemptServerConnection() {
        let attempts = 0;
        while (attempts < 10) {
            const connection = await networkManager.checkConnectionToServer();

            if (connection) {
                return true;
            } else {
                attempts++;
                console.log(`Attempt ${attempts} failed. Retrying in 0.5 second...`);
                await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for 1 second before retrying
            }
        }

        console.log("Exceeded maximum attempts. Operation failed.");
        return false;
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
            const result = await connectToNetwork(JSON.parse(data));
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
                const networkList = networkManager.findUniqueSSIDs(result.stdout.toString());
                bleSocket.emit("list-of-networks", networkList);
            }
        });

        // setTimeout(() => {
        //     // Disable BLE after 10 minutes to prevent someone from changing the Wi-Fi
        //     bleSocket.emit("ble-disable");
        // }, 60*1000*10);

        bleSocket.emit("ble-enable", "pintomind player - abc123");
    },
});

// TODO: kommunikasjon tilbake til main
