const quote = require("shell-quote/quote");

const { executeCommand } = require("./utils.js");
const { ipcMain } = require("electron");
const { store } = require("./store");

let lastConnectionSSID;
let ethernetInterval;

const networkManager = (module.exports = {
    /**
     * Scans available Wi-Fi networks and retrieves the SSID and security information.
     * 
     * This function runs the `nmcli` command to list available Wi-Fi networks, including their SSID
     * and security settings, in a terse format. It returns the output of the scan, which can then be 
     * parsed to extract relevant network details such as network names (SSIDs) and their security protocols.
     * 
     * @returns {Promise<string>} A promise that resolves with the output of the `nmcli` command, which includes
     *   a list of available Wi-Fi networks along with their SSID and security information.
     * 
     * @example
     * const networkList = await scanAvailableNetworks();
     * console.log(networkList);
     * // Output: "SSID: Network1\nSECURITY: WPA2\nSSID: Network2\nSECURITY: WEP"
     */
    async scanAvailableNetworks() {
        const command = "nmcli --fields SSID,SECURITY --terse --mode multiline dev wifi list";
        return await executeCommand(command);
    },

    /**
     * Retrieves the SSID of the active Wi-Fi network.
     * 
     * This function runs the `nmcli` command to get the SSID of the active Wi-Fi connection.
     * It returns the SSID as a string.
     * 
     * @returns {Promise<string>} A promise that resolves with the SSID of the active Wi-Fi network.
     * 
     * @example
     * const activeSSID = await getActiveSSID();
     * console.log(activeSSID);
     * // Output: "MyNetwork"
     */
    async getActiveSSID() {
        return await executeCommand("nmcli -t -f active,ssid dev wifi | grep '^yes' | cut -d':' -f2");
    },

    /**
     * Retrieves the UUID of the active network connection.
     * 
     * This function runs the `nmcli` command to retrieve the UUID of the active connection.
     * It returns the UUID as a string.
     * 
     * @returns {Promise<string>} A promise that resolves with the UUID of the active network connection.
     * 
     * @example
     * const activeConnectionUUID = await getActiveConnectionUUID();
     * console.log(activeConnectionUUID);
     * // Output: "123e4567-e89b-12d3-a456-426614174000"
     */
    async getActiveConnectionUUID() {
        return await executeCommand("nmcli -g active,uuid con | grep '^yes' | cut -d':' -f2 | head -n 1");
    },

    /**
     * Connects to a specified Wi-Fi network based on its security type and other options.
     * 
     * This function determines the security type of the network (e.g., WPA or unsecured) and 
     * connects to the network accordingly. If the network is hidden, it will attempt to connect 
     * to the hidden network. If the network is WPA secured, it will require a password. 
     * For unsecured networks, no password is required. 
     * 
     * It also ensures that any previous active connection (from a different SSID) is deleted 
     * before connecting to the new network.
     * 
     * @param {Object} data - The data object containing network connection details.
     * @param {string} data.ssid - The SSID (network name) of the Wi-Fi network to connect to.
     * @param {string} [data.password] - The password for the Wi-Fi network (if secured).
     * @param {string} [data.security=""] - The security type of the Wi-Fi network (e.g., WPA, WEP).
     * @param {Object} [data.options={}] - Additional options for network connection.
     * @param {boolean} [data.options.hidden=false] - Whether the network is a hidden SSID.
     * 
     * @returns {Promise} A promise that resolves when the network connection is successful.
     * 
     * @example
     * const connectionData = {
     *     ssid: "MyNetwork",
     *     password: "password123",
     *     security: "WPA2",
     *     options: { hidden: false }
     * };
     * await connectToNetwork(connectionData);
     */
    async connectToNetwork(data) {
        const ssid = data.ssid;
        const password = data.password;
        const security = data.security || "";
        const options = data.options || {};
        let result;

        ipcMain.emit("is_connecting");

        // Disconnect from previous network if any
        if (lastConnectionSSID != null) {
            await networkManager.deleteConnectionBySSID(lastConnectionSSID);
        }

        lastConnectionSSID = ssid;

        if (options.hidden) {
            // Connect to hidden network if specified
            result = await networkManager.connectToHiddenNetwork(ssid, password);
        } else if (security.includes("WPA") && password) {
            // Connect to WPA secured network if password is provided
            result = await networkManager.connectToWPANetwork(ssid, password);
        } else {
            // Connect to unsecured network
            result = await networkManager.connectToUnsecureNetwork(ssid);
        }

        ipcMain.emit("connecting_result", null, result);
        return result;
    },

    /**
     * Function for resolving a connection attempt
     * @param {JSONObject} connection
     * @param {String} ssid
     * @returns {JSONObject}
     */
    async resolveNetworkConnection(connection, ssid) {
        if (connection.success) {
            /* Connection succesful added */

            /* Checks and wait if connection is active */
            const activeConnection = await networkManager.waitForActiveConnection(ssid);

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

    /**
     * Function for connection to a unsecure network
     * @param {String} ssid
     * @returns {JSONObject}
     */
    async connectToUnsecureNetwork(ssid) {
        const connectCommand = quote(["nmcli", "device", "wifi", "connect", ssid]);

        const connection = await executeCommand(connectCommand, "Unsecure network connection");

        return await networkManager.resolveNetworkConnection(connection, ssid);
    },

    /**
     * Function for connection to a WPA3 network
     * @param {String} ssid
     * @param {String} password
     * @returns {JSONObject}
     */
    async connectToWPANetwork(ssid, password) {
        const connectCommand = quote(["nmcli", "connection", "add", "type", "wifi", "ifname", "wlan0", "con-name", ssid, "ssid", ssid, "--", "wifi-sec.key-mgmt", "wpa-psk", "wifi-sec.psk", password]);

        const connection = await executeCommand(connectCommand, "WPA network connection");

        return await networkManager.resolveNetworkConnection(connection, ssid);
    },

    /**
     * Function for connection to a hidden network. NOT WORKING
     * @param {String} ssid
     * @param {String} password
     * @returns {Boolean}
     */
    async connectToHiddenNetwork(ssid, password) {
        const addConnectionCommand = quote(["nmcli", "conn", "add", "type", "wifi", "ifname", "wlan0", "con-name", ssid, "ssid", ssid, "--", "wifi-sec.key-mgmt", "wpa-psk", "wifi-sec.psk", password]);

        const connectionResult = await executeCommand(addConnectionCommand, "Network connection");

        if (connectionResult.success && connectionResult.stdout.includes("successfully added")) {
            const connectCommand = quote(["nmcli", "conn", "up", ssid]);

            const connectResult = await executeCommand(connectCommand);

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

    /**
     *   Checks and waits for connection to be activated
     *   @param {String} ssid
     *   @returns {Boolean}
     */
    async waitForActiveConnection(ssid) {
        const connectionStateCommand = quote(["nmcli", "-f", "GENERAL.STATE", "connection", "show", ssid]);

        let attempts = 0;
        let connectionState;
        let lastConnectionState = null;
        while (attempts < 75) {
            connectionState = await executeCommand(connectionStateCommand);

            if (connectionState.success && connectionState.stdout.includes("activated")) {
                return connectionState;
            } else if (connectionState.success && connectionState.stdout.includes("activating")) {
                lastConnectionState = "activating";
                attempts++;
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
                    await new Promise((resolve) => setTimeout(resolve, 500));
                }
            }
        }

        connectionState.success = false;
        connectionState.stderr = "Exceeded maximum attempts. Operation failed.";
        return connectionState;
    },

    /**
     *   Checks connection to server
     */
    async checkConnectionToServer() {
        const host = store.get("host");

        const command = `curl -sI https://${host}/up | grep HTTP | grep -q 200 && echo 1 || echo 0`;

        return await executeCommand(command, "server connection");
    },

    /**
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
                await new Promise((resolve) => setTimeout(resolve, 500)); // Wait for 1 second before retrying
            }
        }

        return connection;
    },

    /**
     *  Deletes connection by ssid
     *  @param {String} ssid
     */
    async deleteConnectionBySSID(ssid) {
        const deleteCommand = quote(["nmcli", "connection", "delete", ssid]);
        const deleteResult = await executeCommand(deleteCommand, "delete ssid");
        lastConnectionSSID = null;
        return deleteResult.success;
    },

    /**
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

    /**
     *   Checks if device is connected with etherenet
     */
    async checkEthernetConnection() {
        const command = "nmcli device status | grep ethernet | grep -q connected && echo 1 || echo 0";

        const result = await executeCommand(command);

        if (result.success && result.stdout === "1") {
            return await networkManager.attemptServerConnection();
        } else {
            return result;
        }
    },

    /**
     *   Checks if device is connected via Wi-Fi
     */
    async checkWifiConnection() {
        const command = "nmcli device status | grep wifi | grep -q connected && echo 1 || echo 0";

        const result = await executeCommand(command);

        if (result.success && result.stdout === "1") {
            return await networkManager.attemptServerConnection();
        } else {
            return result;
        }
    },

    /**
     *   Check overall network status and connection type
     */
    async checkNetworkConnection() {
        const ethernetResult = await networkManager.checkEthernetConnection();

        if (ethernetResult.success && ethernetResult.stdout === "1") {
            return { connectionType: "Ethernet", ...ethernetResult };
        }

        const wifiResult = await networkManager.checkWifiConnection();

        if (wifiResult.success && wifiResult.stdout === "1") {
            const connectionName = await networkManager.getActiveSSID()
            return { connectionType: "Wi-Fi", connectionName: connectionName.stdout, ...wifiResult };
        }

        return { success: false, error: "No active network connection" };
    },

    /**
     *   Checks if device is connected with etherenet in interval
     */
    async checkEthernetConnectionInterval() {
        ethernetInterval = setInterval(async () => {
            try {
                const result = await networkManager.checkEthernetConnection();
                
                if (result.success && result.stdout === "1") {
                    ipcMain.emit("ethernet_status", result)
                    networkManager.stopEthernetInterval()
                }
            } catch {}
        }, 2000);
    },

    /**
     *   Stops ethernetinterval
     */
    async stopEthernetInterval() {
        if (ethernetInterval) {
            clearInterval(ethernetInterval);
            ethernetInterval = null;
        }
    },

    /**
     *   Adds dns address 
     */
    async addDNS(dns) {
        const connectionNameResult = await networkManager.getActiveConnectionUUID()
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

});
