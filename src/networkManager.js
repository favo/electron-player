const quote = require('shell-quote/quote');
const { executeCommand } = require('./executeCommand.js');

const io = require("socket.io-client");
let bleSocket = io("ws://127.0.0.1:3333");



class NetworkManager {

    constructor(mainWindow, store) {
        this.mainWindow = mainWindow
        this.store = store
        this.ethernetInterval = null
    }

    /* 
    *   Function for searching after local networks
    */
    async searchNetwork() {
        const command = "nmcli --fields SSID,SECURITY --terse --mode multiline dev wifi list"
        
        const result = await executeCommand(command);
    
        if (result.success) {
            this.mainWindow.webContents.send("list_of_networks", result.stdout.toString());
        }
    }

    /* 
    * Base function. Decides security and type of network
    * @param {Object} data
    */
    async connectToNetwork(data) {
        const ssid = data.ssid
        const password = data.password

        if (password) {
            if (data.security.includes("WPA3")) {
                this.connectToWPA3Network(ssid, password)
            } else {
                this.connectToWPANetwork(ssid, password)
            }
        } else {
                this.connectToUnsecureNetwork(ssid)
        }
    }


    /* 
    * Function for connection to a unsecure network
    * @param {String} ssid
    */
    async connectToUnsecureNetwork(ssid) {
        const connectCommand = quote(['nmcli', 'device', 'wifi', 'connect', ssid]);
        const grepCommand = quote(['grep', '-q', 'activated']);
        const fullCommand = connectCommand + ' | ' + grepCommand;

        const result = await executeCommand(fullCommand);

        if (result.success) {
            const connection = await this.checkConnectionToServer()
            this.mainWindow.webContents.send("network_status", connection);
        } else {
            this.mainWindow.webContents.send("network_status", false);
        }
    }

    /* 
    * Function for connection to a WPA network
    * @param {String} ssid
    * @param {String} password
    */
    async connectToWPANetwork(ssid, password) {
        const connectCommand = quote(['nmcli', 'device', 'wifi', 'connect', ssid, 'password', password]);
        const grepCommand = quote(['grep', '-q', 'activated']);
        const fullCommand = connectCommand + ' | ' + grepCommand;

        const result = await executeCommand(fullCommand);

        if (result.success) {
            const connection = await this.checkConnectionToServer()
            this.mainWindow.webContents.send("network_status", connection);
        } else {
            this.mainWindow.webContents.send("network_status", false);
        }
    }

    /* 
    * Function for connection to a hidden network. NOT WORKING
    * @param {String} ssid
    * @param {String} password
    */
    async connectToHiddenNetwork(ssid, password) {
        const connectCommand = quote(['nmcli', 'device', 'wifi', 'connect', ssid, 'password', password, 'hidden', 'yes']);
        const grepCommand = quote(['grep', '-q', 'activated']);
        const fullCommand = connectCommand + ' | ' + grepCommand;

        const result = await executeCommand(fullCommand);

        if (result.success) {
            const connection = await this.checkConnectionToServer()
            this.mainWindow.webContents.send("network_status", connection);
        } else {
            this.mainWindow.webContents.send("network_status", false);
        }
    }

    /* 
    * Function for connection to a WPA3 network
    * @param {String} ssid
    * @param {String} password
    */
    async connectToWPA3Network(ssid, password) {
        const connectCommand =  quote(['nmcli', 'connection', 'add', 'type', 'wifi', 'ifname', 'wlan0', 'con-name', ssid, 'ssid', ssid, '--', 'wifi-sec.key-mgmt', 'wpa-psk', 'wifi-sec.psk', password]);

        const connect = await executeCommand(connectCommand);
        console.log("connect",connect);

        if (connect.success) {
            /* Connection succesful added */
            /* Checks if connection is active */
            const activeConnectionCommand =  quote(['nmcli', 'connection', 'show', '--active']);
            const activeConnection = await executeCommand(activeConnectionCommand);
            
            if (activeConnection.success && activeConnection.stdout.includes(ssid)) {
                /* Connection is active, and attepts to ping server up to 10 times */
                const serverConnectionResult = await this.attemptServerConnection()
                if (serverConnectionResult) {
                    /* Successfully pings server */
                    this.mainWindow.webContents.send("network_status", true);
                } else {
                    /* cant connect to server, may be wrong password */
                    const deleteResult = this.deleteConnectionBySSID(ssid)
                    this.mainWindow.webContents.send("network_status", false);
                }
            } else {
                /* Connection is not active, deletes connection */
                const deleteResult = this.deleteConnectionBySSID(ssid)
                this.mainWindow.webContents.send("network_status", false);
            }
        } else {
            /* Connection unsuccesful added */
            this.mainWindow.webContents.send("network_status", false);
        }
    }

    /* 
    * Deletes ssid connection by SSID
    * @param {String} ssid
    */
    async deleteConnectionBySSID(ssid) {
        const deleteCommand =  quote(['nmcli', 'connection', 'delete', ssid]);
        const deleteResult = await executeCommand(deleteCommand);
        return deleteResult.success
    }

    /* 
    *   Checks connection to server
    */
    async checkConnectionToServer() {
        const host = this.store.get("host")
    
        const command = `curl -I https://${host}/up | grep Status | grep -q 200 && echo 1 || echo 0`
        
        const result = await executeCommand(command);
        console.log(result);
        if (result.success && result.stdout.toString() == "1") {
            bleSocket.emit("ble-disable");
            /* TODO: turn off io socket */
            if (this.ethernetInterval) {
                clearInterval(this.ethernetInterval)
                this.ethernetInterval = null
            }
            return true
        } else {
            return false
        }
    }

    /* 
    *   Attemps to connect to sever multiple times by running checkConnectionToServer 
    */
    async attemptServerConnection() {
        let attempts = 0
        while (attempts < 10) {
            const connection = await this.checkConnectionToServer()
        
            if (connection) {
                return true;
            } else {
                attempts++;
                console.log(`Attempt ${attempts} failed. Retrying in 0.5 second...`);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for 1 second before retrying
            }
        }
    
        console.log("Exceeded maximum attempts. Operation failed.");
        return false;
    }

    /* 
    *   Checks if device is connected with etherenet
    */
    async checkForEthernetConnection() {
        const command = "nmcli device status | grep ethernet | grep -q connected && echo 1 || echo 0"

        this.ethernetInterval = setInterval(async () => {
            const result = await executeCommand(command);
            
            if (result.success && result.stdout == "1") {
                if (this.ethernetInterval) {
                    clearInterval(this.ethernetInterval)
                    this.ethernetInterval = null
                }
                this.mainWindow.webContents.send("ethernet_status", result.stdout.toString());
            }
        }, 2000)
    }
    
    /* 
    *   Adds dns address to /etc/resolv
    */
    async addDNS(name) {
        const command =  quote(['sudo','sed', '-i', `3inameserver ${name}`, '/etc/resolv.conf']);
    
        const result = await executeCommand(command);
    
        this.mainWindow.webContents.send("dns_registred", result.success)
    }

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

        bleSocket.on("wifi", (data) => {
            this.connectToNetwork(JSON.parse(data));
        });

        setTimeout(() => {
            // Disable BLE after 10 minutes to prevent someone from changing the Wi-Fi
            bleSocket.emit("ble-disable");
        }, 60*1000*10);

        bleSocket.emit("ble-enable");
    }
}

module.exports = NetworkManager;