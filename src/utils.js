const nodeChildProcess = require("child_process");
const pjson = require("../package.json");
const si = require("systeminformation");
const fs = require("fs");
const quote = require("shell-quote/quote");

const { promisify } = require("util");
const execAsync = promisify(nodeChildProcess.exec);

const Store = require("electron-store");
const store = new Store();

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
    sendDeviceInfo(host) {
        var options = {};
        options["Host"] = host;
        options["App-version"] = pjson.version;
        options["Platform"] = "Electron";
        options["App-name"] = pjson.name;

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

    /*
     *   Simple to rotate the screen using scripts we have added
     */
    async setRotation(rotation) {
        fs.writeFileSync("./rotation", rotation);

        const command = "/home/pi/.adjust_video.sh";

        await utils.executeCommand(command);
    },

    async resetRotationFile() {
        fs.writeFileSync("./rotation", "normal");
    },

    /*
     *   Lists all possible screen resolutions
     */
    async getAllScreenResolution() {
        const command = "export DISPLAY=:0 | xrandr"
        const xrandrOutput = await utils.executeCommand(command);

        if (xrandrOutput.success) {
            const resolutionPattern = /\b\d{3,4}x\d{3,4}\b/g;
            const currentResolutionPattern = /\b\d{3,4}x\d{3,4}\b(?=\s+\d+.\d+\*)/;

            return {
                list: xrandrOutput.stdout.match(resolutionPattern),
                current: xrandrOutput.stdout.match(currentResolutionPattern)[0]
            };
        } else {
            return {
                list: null, 
                current: null
            }
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
