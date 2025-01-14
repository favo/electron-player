const nodeChildProcess = require("child_process");
const pjson = require("../package.json");
const si = require("systeminformation");
const fs = require("fs");

const { promisify } = require("util");
const execAsync = promisify(nodeChildProcess.exec);

const Store = require("electron-store");
const store = new Store();

const crypto = require("crypto");

const Appsignal = require("@appsignal/javascript").default;
const appsignal = new Appsignal({
    key: "b2bdf969-f795-467e-b710-6b735163281f",
});

const utils = (module.exports = {
    /*
     * Helper function: runs command and returns object with success, stout, stderr and error
     */
    async executeCommand(command, type = null) {
        try {
            const { stdout, stderr } = await execAsync(command);
            const result = {
                type: type,
                success: true,
                stdout: stdout.trim(),
                stderr: stderr.trim(),
            };
            return result;
        } catch (error) {
            appsignal.sendError(error, (span) => {
                span.setAction(type || "unknown")
                span.setNamespace("executeCommand")
                span.setTags({host: store.get("host"), version: pjson.version });
            });
            const result = {
                type: type,
                success: false,
                stdout: null,
                stderr: null,
                error: error,
            };
            return result;
        }
    },

    /*
     * Get system stats and send back to mainWindow
     */
    async getSystemStats() {
        var stats = {};

        const cpuLoad = await si.currentLoad();
        stats["cpu_load"] = cpuLoad.currentLoad;

        const memory = await si.mem();
        stats["total_memory"] = memory.total;
        stats["active_memory"] = memory.active;

        const cpuTemp = await si.cpuTemperature();
        stats["cpu_temp"] = cpuTemp.main;

        const cpuSpeed = await si.cpuCurrentSpeed();
        stats["cpu_speed"] = cpuSpeed.avg;

        const time = await si.time();
        stats["uptime"] = time.uptime;

        return stats;
    },

    /*
     *  Function for updating firmware
     */
    async updateFirmware() {
        const command = "/home/pi/.system-upgrade.sh";

        const result = await utils.executeCommand(command);

        if (result.success) {
            utils.rebootDevice();
        }
    },

    /*
     *   Reboots device
     */
    rebootDevice() {
        try {
            nodeChildProcess.execSync("sudo reboot");
        } catch (error) {
            appsignal.sendError(error, (span) => {
                span.setAction("rebootDevice")
                span.setNamespace("utils")
                span.setTags({host: store.get("host"), version: pjson.version });
            });
        }
    },

    /*
     *   Restarts app
     */
    restartApp() {
        try {
            nodeChildProcess.execSync("killall xinit");
        } catch (error) {
            appsignal.sendError(error, (span) => {
                span.setAction("Restarting app");
                span.setNamespace("utils");
                span.setTags({ host: store.get("host"), version: pjson.version });
            });
        }
    },

    /*
     *   Sends device info to mainWindow
     */
    async sendDeviceInfo(host) {
        var options = {};
        options["Host"] = host;
        options["App-version"] = pjson.version;
        options["Platform"] = "Electron";
        options["App-name"] = pjson.name;
        options["Bluetooth-ID"] = await utils.readBluetoothID();
        const screenResolution = await utils.getAllScreenResolution()
        options["Screen-resolutions"] = screenResolution

        return options;
    },

    /*
     *   Updates Player App
     */
    updateApp(autoUpdater) {
        try {
            autoUpdater.checkForUpdates();
        } catch (error) {
            appsignal.sendError(error, (span) => {
                span.setAction("updateApp")
                span.setNamespace("utils")
                span.setTags({host: store.get("host"), version: pjson.version });
            });
        }
    },

    updateBleBridge() {

    },

    async getPlayerConfig() {
        try {
            const config = fs.readFileSync('./player-config.json', 'utf8').trim();
            return config ? JSON.parse(config) : { brand: "pintomind", host: "app.pintomind.com", language: "en" };
        } catch {
            return { brand: "pintomind", host: "app.pintomind.com", language: "nb" };
        }
    },
    

    /*
     *   Simple to rotate the screen using scripts we have added
     */
    async setRotation(rotation) {
        fs.writeFileSync("./rotation", rotation);   

        const command = "/home/pi/.adjust_video.sh";

        await utils.executeCommand(command);
    },

    async getRotation() {
        return fs.readFileSync('./rotation', { encoding: 'utf8', flag: 'r' });
    },

    async resetRotationFile() {
        fs.writeFileSync("./rotation", "normal");
    },

     /*
     *   sets bluetooth_id 
     */
    async setBluetoothID(id) {
        fs.writeFileSync("./bluetooth_id", id);
    },

    async turnDisplayOff() {
        const command = "/home/pi/.turn_off_display.sh";

        return await utils.executeCommand(command);
    },

    async turnDisplayOn() {
        const command = "/home/pi/.adjust_video.sh";

        return await utils.executeCommand(command);
    },

    /*
     *   Read bluetooth_id from frile
     */
    async readBluetoothID() {
        let bluetooth_id;

        try {
            // Try to read the file
            bluetooth_id = fs.readFileSync('./bluetooth_id', { encoding: 'utf8', flag: 'r' });
            
            if (bluetooth_id.trim() === "") {
                // If the file exists but is empty, generate a new ID
                bluetooth_id = crypto.randomBytes(10).toString("hex");
                fs.writeFileSync('./bluetooth_id', bluetooth_id); // Write the new ID to the file
            }
        } catch (err) {
            if (err.code === 'ENOENT') {
                // If the file does not exist, create it and write a new ID
                bluetooth_id = crypto.randomBytes(10).toString("hex");
                fs.writeFileSync('./bluetooth_id', bluetooth_id); // Write the new ID to the file
            } else {
                return null;
            }
        }
    
        return bluetooth_id;
    },

    /*
     *   Lists all possible screen resolutions
     */
    async getAllScreenResolution() {
        const command = "export DISPLAY=:0 | xrandr"
        const xrandrOutput = await utils.executeCommand(command);
        const rotation = await utils.getRotation()

        if (xrandrOutput.success) {
            const resolutionPattern = /\b\d{3,4}x\d{3,4}\b/g;
            const currentResolutionPattern = /\b\d{3,4}x\d{3,4}\b(?=\s+\d+.\d+\*)/;

            return {
                list: xrandrOutput.stdout.match(resolutionPattern),
                current: xrandrOutput.stdout.match(currentResolutionPattern)[0],
                rotation: rotation
            };
        } else {
            return {
                list: null, 
                current: null,
                rotation: null
            }
        }

    },

    async getDeviceSettings() {
        const screenSettings = await getAllScreenResolution()
        const dns = store.get("dns")
        const host = store.get("host")

        return {
            screen: screenSettings,
            dns: dns,
            host: host,
        }
    },

    /*
     *   Sets screen resolution
     */
    async setScreenResolution(resolution) {
        fs.writeFileSync("./resolution", resolution);

        const command = "/home/pi/.adjust_video.sh";

        await utils.executeCommand(command);
    },


    async resetScreenResolution() {
        fs.writeFileSync("./resolution", "1920x1080");
    },

    /*
     *   Screenshots mainWindow
     */
    screenShot() {
        mainWindow.webContents
            .capturePage({
                x: 0,
                y: 0,
                width: this.mainWindow.webContents.width,
                height: this.mainWindow.webContents.height,
            })
            .then((img) => {
                fs.writeFile("./screenshots/shot.png", img.toPNG(), "base64", function (err) {
                    if (err) throw err;
                    console.log("Saved!");
                });
            })
            .catch((err) => console.log(err));
    },

    /*
     *   Helper function for finding unique SSIDs and returning a list of jsons
     */
    findUniqueSSIDs(inputString) {
        const lines = inputString.split("\n");
        const uniqueSSIDs = [];
        const uniqueSSIDNames = new Set();

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.trim().startsWith("SSID:")) {
                const ssid = line.replace("SSID:", "").trim();
                let securityLine;
                for (let j = i + 1; j < lines.length; j++) {
                    if (lines[j].trim().startsWith("SECURITY:")) {
                        securityLine = lines[j];
                        break;
                    }
                }

                const security = securityLine ? securityLine.replace("SECURITY:", "").trim() : "";

                if (!uniqueSSIDNames.has(ssid) && ssid) {
                    uniqueSSIDNames.add(ssid);

                    const ssidObject = {
                        ssid: ssid,
                        security: security,
                    };

                    uniqueSSIDs.push(ssidObject);
                }
            }
        }
        return uniqueSSIDs;
    },
});
