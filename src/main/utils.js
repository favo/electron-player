const nodeChildProcess = require("child_process");
const pjson = require("../../package.json");
const si = require("systeminformation");
const fs = require("fs");
const crypto = require("crypto");

const { promisify } = require("util");
const execAsync = promisify(nodeChildProcess.exec);

const { getWebContents } = require('./windowManager');
const { autoUpdater } = require("./autoUpdater");
const { logger} = require("./appsignal");
const { store } = require("./store");

const utils = (module.exports = {

    /**
     * Executes a shell command asynchronously and returns the result.
     * 
     * Executes the specified command using an asynchronous process, capturing both
     * standard output (stdout) and standard error (stderr). If the command execution fails,
     * it logs the error using AppSignal and returns a failure result.
     *
     * @async
     * @param {string} command - The shell command to execute.
     * @param {string|null} [type=null] - An optional identifier for the command, used for logging purposes.
     * @returns {Promise<object>} A promise that resolves to an object containing:
     *   - `type` {string|null}: The command type or identifier.
     *   - `success` {boolean}: Indicates whether the command execution was successful.
     *   - `stdout` {string|null}: The trimmed standard output of the command, or `null` if execution failed.
     *   - `stderr` {string|null}: The trimmed standard error of the command, or `null` if execution failed.
     *   - `error` {Error|null}: The error object if execution failed, otherwise `null`.
     * 
     * @throws {Error} The error is logged using AppSignal but not rethrown.
     */
    async executeCommand(command, type = null) {
        try {
            const { stdout, stderr } = await execAsync(command);

            return {
                type: type,
                success: true,
                stdout: stdout.trim(),
                stderr: stderr.trim(),
            };
        } catch (error) {
            logger.logError(error, type || "executeCommand", "utils")

            return {
                type: type,
                success: false,
                stdout: null,
                stderr: null,
                error: error,
            };
        }
    },

    /**
     * Retrieves system statistics including CPU load, memory usage, CPU temperature, CPU speed, and system uptime.
     * 
     * Uses the `systeminformation` library to gather real-time system metrics. If an error occurs during data retrieval,
     * the error is logged using AppSignal, and an empty object is returned.
     *
     * @async
     * @returns {Promise<object>} A promise that resolves to an object containing the following keys:
     *   - `cpu_load` {number}: The current CPU load percentage.
     *   - `total_memory` {number}: The total memory available on the system (in bytes).
     *   - `active_memory` {number}: The currently active memory in use (in bytes).
     *   - `cpu_temp` {number|null}: The current CPU temperature (in Celsius), or `null` if unavailable.
     *   - `cpu_speed` {number}: The average CPU clock speed (in GHz).
     *   - `uptime` {number}: The system uptime (in seconds).
     * 
     * @throws {Error} Errors during system information retrieval are logged using AppSignal but not rethrown.
     */
    async getSystemStats() {
        try {
            const stats = {};

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
        } catch (error) {
            logger.logError(error,  "getSystemStats", "utils")
            return {}
        }
    },

    /**
     * Updates the device firmware by executing a system upgrade script.
     * 
     * Executes the firmware upgrade command located at `/home/pi/.system-upgrade.sh`. 
     * If the command executes successfully, the device is rebooted to apply the updates.
     *
     * @async
     * @returns {Promise<void>} Resolves when the firmware update process is complete.
     */
    async updateFirmware() {
        const command = "/home/pi/.system-upgrade.sh";

        const result = await utils.executeCommand(command);

        if (result.success) {
            utils.rebootDevice();
        }
        else {
            logger.logError("Failed to update firmware: " + result.stderr + result.stdout,  "updateFirmware", "utils")
        }
    },


    /**
     * Reboots the device using a system command.
     * 
     * Executes the `sudo reboot` command to restart the device. If an error occurs during
     * the reboot process, the error is logged using AppSignal.
     *
     * @returns {void}
     * @throws {Error} Errors during the reboot command execution are logged but not rethrown.
     */
    rebootDevice() {
        try {
            nodeChildProcess.execSync("sudo reboot");
        } catch (error) {
            logger.logError(error,  "rebootDevice", "utils")
        }
    },

    /**
     * Sends device information to the main window.
     * 
     * Gathers and returns a collection of system-related information, including:
     * - Host information
     * - App version and name
     * - Bluetooth ID
     * - Screen resolution details
     * - Kernel version
     * 
     * The gathered data is packaged into an object and can be sent to the main window for further processing or display.
     * If an error occurs while fetching or compiling the information, the error is logged using AppSignal and an empty object is returned.
     *
     * @async
     * @returns {Promise<object>}
     * 
     * @throws {Error} If any of the system information retrieval steps fail, an empty object is returned and the error is logged.
     */
    async sendDeviceInfo() {
        try {
            const options = {};
            const osInfo = await si.osInfo();
            options["Host"] = store.get("host");
            options["App-version"] = pjson.version;
            options["Platform"] = "PinToMind OS";
            options["Build"] = utils.readBuildVersion()
            options["App-name"] = pjson.name;
            options["Screen-resolutions"] =  await utils.getAllScreenResolution()
            options["Bluetooth-ID"] =  await utils.readBluetoothID()
            options["Kernel-version"] = osInfo["kernel"]
            const model = await utils.executeCommand("cat /proc/cpuinfo | grep 'Model' | awk -F': ' '{print $2}'")
            options["Model"]  = model.stdout

            return options;
        } catch(error) {
            logger.logError(error,  "sendDeviceInfo", "utils")
            return {}
        }
    },

    async sendDeviceInfoToMainWindow() {
        const deviceInfo = await utils.sendDeviceInfo();
        getWebContents().send("send_device_info", deviceInfo);
    },

    /**
     * Checks for app updates using the autoUpdater.
     * 
     * @throws {Error} If there is an issue with the `checkForUpdates` method, the error is logged but not rethrown.
     */
    updateApp() {
        try {
            autoUpdater.checkForUpdates();
        } catch (error) {
            logger.logError(error,  "updateApp", "utils")
        }
    },

    async updateBleBridge() {
        const devMode = store.get("devMode", false);
        const branch = devMode ? "develop" : "main"
        const url = `git+https://github.com/favo/ble-bridge.git\#${branch}`

        await utils.executeCommand("sudo systemctl stop ble-bridge")
        await utils.executeCommand(`sudo npm install -g ${url}`)
        await utils.executeCommand("sudo systemctl start ble-bridge")
    },

    /**
     * Reads and returns the configuration from the `player-config.json` file.
     * 
     * This function attempts to read the `player-config.json` file, parse it, and return the configuration
     * object. If the file is not found, or an error occurs during reading or parsing, the function returns 
     * a default configuration with predefined values for the brand, host, and language.
     * 
     * @async
     * @returns {Promise<object>} A promise that resolves to an object containing the player configuration:
     *   - `brand` {string}: The brand name (default: "pintomind").
     *   - `host` {string}: The host URL (default: "app.pintomind.com").
     *   - `language` {string}: The language code (default: "en").
     * 
     * @throws {Error} If the file is not accessible or the JSON is invalid, the function returns a default config instead.
     */
    async getPlayerConfig() {
        const defaultConfig = { 
            brand: "pintomind", 
            host: "app.pintomind.com", 
            language: "en" 
        }

        try {
            const config = fs.readFileSync('./player-config.json', 'utf8').trim();
            return config ? JSON.parse(config) : defaultConfig;
        } catch(error) {
            logger.logError(error,  "getPlayerConfig", "utils")

            return defaultConfig;
        }
    },

    async setSettingsFromPlayerConfig() {
        const config = await utils.getPlayerConfig()
        
        if (! store.has("host")) {
            store.set("host", config["host"]);
        }
    
        if (! store.has("lang")) {
            store.set("lang", config["language"]);
        }
    
        if (! store.has("lang") && config["devMode"]) {
            store.set("devMode", config["devMode"]);
        }
    
        if (config["appsignal-key"]) {
            logger.setAppsignalKey(config["appsignal-key"]);
        }
    },

    /**
     * Sets the screen rotation by writing the rotation value to a file and updating the display configuration.
     * 
     * Valid rotation values are:
     * - "normal"
     * - "left"
     * - "right"
     * - "inverted"
     * 
     * If an invalid rotation value is provided, an error is thrown.
     *
     * @async
     * @param {string} rotation - The desired rotation value. Must be one of "normal", "left", "right", or "inverted".
     * @throws {Error} Throws an error if the rotation value is invalid.
     * @returns {Promise<void>} Resolves when the rotation is successfully set and the display configuration is updated.
     */
    async setScreenRotation(rotation) {
        const validRotations = ["normal", "left", "right", "inverted"];

        try {
            if (!validRotations.includes(rotation)) {
                throw new Error(`Invalid rotation value: ${rotation}. Valid values are: ${validRotations.join(", ")}`);
            }

            fs.writeFileSync("./rotation", rotation);   
            
            await utils.updateDisplayConfiguration()
        } catch(error) {
            logger.logError(error,  "setScreenRotation", "utils")
        }
    },
    
    /**
     * Retrieves the current screen rotation value from the rotation file.
     * 
     * @async
     * @returns {Promise<string>} A promise that resolves to the rotation value read from the file, or an empty string if an error occurs.
     */
    async getScreenRotation() {
        try {
            return fs.readFileSync('./rotation', { encoding: 'utf8', flag: 'r' });
        } catch(error) {
            logger.logError(error,  "getScreenRotation", "utils")
            return "";
        }
    },

    /**
     * Turns off the connected display using a system script.
     * 
     * Executes the `/home/pi/.turn_off_display.sh` script to power off the connected display.
     * This command is executed asynchronously, and its result is returned.
     *
     * @async
     * @returns {Promise<object>} 
     */
    async turnDisplayOff() {
        const command = "/home/pi/.turn_off_display.sh";

        return await utils.executeCommand(command);
    },

    /**
     * Updates the display configuration using a system script.
     * 
     * Executes the `/home/pi/.adjust_video.sh` script to adjust the video output settings
     * of the connected display. This command is executed asynchronously, and its result is returned.
     *
     * @async
     * @returns {Promise<object>}
     */
    async updateDisplayConfiguration() {
        const command = "/home/pi/.adjust_video.sh";

        return await utils.executeCommand(command);
    },

    /**
     * Sets the Bluetooth ID by writing it to a file.
     * 
     * @async
     * @param {string} id - The Bluetooth ID to save.
     * @throws {Error} Logs any error encountered while writing the file.
     * @returns {Promise<void>} Resolves when the Bluetooth ID is successfully saved.
     */
    async setBluetoothID(id) {
        try {
            fs.writeFileSync("./bluetooth_id", id);
        } catch(error) {
            logger.logError(error,  "setBluetoothID", "utils")
        }
    },

    /**
     * Reads the Bluetooth ID from a file. If the file is empty or does not exist, generates a new ID and writes it to the file.
     * 
     * This function attempts to read the Bluetooth ID stored in the `./bluetooth_id` file. If the file is:
     * - **Empty**: A new random ID is generated, saved to the file, and returned.
     * - **Missing**: A new random ID is generated, saved to the file, and returned.
     * - **Unreadable for other reasons**: Returns `null` without rethrowing the error.
     * 
     * @async
     * @returns {Promise<string|null>} The Bluetooth ID read from the file or a newly generated ID. Returns `null` if an error occurs.
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

    readBuildVersion(){
        try {
            return fs.readFileSync('./BUILD_VERSION', { encoding: 'utf8', flag: 'r' }).trim();
        } catch (err) {
            return ""
        }
    },

    /**
     * Sets the screen resolution by writing to the `resolution` file and updating the display configuration.
     * 
     * This function takes a resolution string, writes it to the `resolution` file, and then calls the
     * `updateDisplayConfiguration` function to apply the changes. If an error occurs during the process, 
     * the error is logged via AppSignal.
     * 
     * @async
     * @param {string} resolution The resolution to set (e.g., "1920x1080").
     * 
     * @returns {Promise<void>} A promise that resolves once the screen resolution has been set and 
     * the display configuration has been updated.
     * 
     * @throws {Error} If there is an error during the process (writing to file or updating the configuration),
     * the error is logged but not rethrown.
     */
    async setScreenResolution(resolution) {
        try {
            fs.writeFileSync("./resolution", resolution);
            return await utils.updateDisplayConfiguration()
        } catch(error) {
            logger.logError(error,  "setScreenResolution", "utils")
        }
    },
    

    /**
     * Retrieves all available screen resolutions and the current screen resolution along with rotation information.
     * 
     * This function uses the `xrandr` command to fetch a list of available screen resolutions. It also determines
     * the current screen resolution and retrieves the screen rotation. The output is returned as an object containing
     * a list of all available resolutions, the current resolution, and the current rotation state.
     * 
     * @async
     * @returns {Promise<object>} An object containing:
     *   - `list` {Array<string>|null}: A list of available screen resolutions (e.g., ["1920x1080", "1280x720"]). Returns `null` if there is an error or no available resolutions.
     *   - `current` {string|null}: The current screen resolution (e.g., "1920x1080"). Returns `null` if unable to determine the current resolution.
     *   - `rotation` {string|null}: The current screen rotation (e.g., "normal", "left", "right", "inverted"). Returns `null` if unable to retrieve the rotation.
     * 
     * @throws {Error} If the `xrandr` command fails or an error occurs while retrieving rotation information, a default object with `null` values will be returned.
     */
    async getAllScreenResolution() {
        const command = "export DISPLAY=:0 | xrandr"
        const xrandrOutput = await utils.executeCommand(command);
        const rotation = await utils.getScreenRotation()

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

    /**
     * Retrieves the device settings, including screen resolution and DNS/host configuration.
     * 
     * This function combines information from the screen resolution (obtained from `getAllScreenResolution`), 
     * DNS settings (from the `store`), and host settings (also from the `store`). It returns an object containing 
     * all of this information.
     * 
     * @async
     * @returns {Promise<object>} An object containing the following settings:
     *   - `screen` {object}: An object with screen resolution and rotation data, containing:
     *     - `list` {Array<string>|null}: A list of available screen resolutions.
     *     - `current` {string|null}: The current screen resolution.
     *     - `rotation` {string|null}: The current screen rotation.
     *   - `dns` {string}: The DNS server settings.
     *   - `host` {string}: The host configuration.
     * 
     * @throws {Error} If there is an issue retrieving any of the settings (screen resolution, DNS, or host), the function may return partial or default values.
     */
    async getDeviceSettings() {
        const screenSettings = await utils.getAllScreenResolution()
        const dns = store.get("dns")
        const host = store.get("host")

        return {
            screen: screenSettings,
            dns: dns,
            host: host,
        }
    },

    /**
     * Extracts unique SSID names and their corresponding security information from a given input string.
     * 
     * This function processes the input string line by line, looking for SSID and security information. 
     * It adds each unique SSID with its associated security information to an array of objects. Duplicate 
     * SSIDs are ignored, ensuring that only unique SSIDs are included in the result.
     * 
     * @param {string} inputString - The input string containing SSID and security information, typically output from a Wi-Fi scan.
     * @returns {Array<object>} An array of objects where each object represents a unique SSID and its security type:
     *   - `ssid` {string}: The name of the Wi-Fi SSID.
     *   - `security` {string}: The security type of the SSID (e.g., WPA2, WEP).
     * 
     * @example
     * const inputString = "SSID: MyNetwork\nSECURITY: WPA2\nSSID: AnotherNetwork\nSECURITY: WEP\nSSID: MyNetwork\nSECURITY: WPA2";
     * const uniqueSSIDs = parseWiFiScanResults(inputString);
     * console.log(uniqueSSIDs);
     * // Output: [{ ssid: 'MyNetwork', security: 'WPA2' }, { ssid: 'AnotherNetwork', security: 'WEP' }]
     */
     parseWiFiScanResults(inputString) {
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
