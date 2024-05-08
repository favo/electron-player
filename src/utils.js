const { executeCommand } = require('./executeCommand.js');
const nodeChildProcess = require('child_process');
const pjson = require('../package.json');
const si = require('systeminformation');
const fs = require('fs');

class Utils {

    constructor(mainWindow) {
        this.mainWindow = mainWindow
    }

    /* 
    * Get system stats and send back to mainWindow
    */
    async getSystemStats() {
        var stats = {}

        const cpuLoad = await si.currentLoad()
        stats["cpu_load"] = cpuLoad.currentLoad

        const memory = await si.mem()
        stats["total_memory"] = memory.total
        stats["active_memory"] = memory.active

        const cpuTemp = await si.cpuTemperature()
        stats["cpu_temp"] = cpuTemp.main

        const cpuSpeed = await si.cpuCurrentSpeed()
        stats["cpu_speed"] = cpuSpeed.avg

        const time = await si.time()
        stats["uptime"] = time.uptime

        this.mainWindow.webContents.send("recieve_system_stats", stats);
    }

    /*
    *  Function for updating firmware
    */
    async updateFirmware() {
        const command = "/home/pi/.system-upgrade.sh"
    
        const result = await executeCommand(command);
    
        if (result.success) {
            rebootDevice()
        }
    }

    /*
    *   Reboots device
    */
    rebootDevice() {
        nodeChildProcess.execSync("sudo reboot");
    }
    
    /*
    *   Sends device info to mainWindow
    */
    sendDeviceInfo(host) {
        
        var options = {}
        options["Host"] = host
        options["App-version"] = pjson.version
        options["Platform"] = "Electron"
        options["App-name"] = pjson.name
        
        this.mainWindow.webContents.send("send_device_info", options);
    }
    
    /*
    *   Updates Player App
    */
    updateApp(autoUpdater) {
        autoUpdater.checkForUpdates()
    }

    /* 
    *   Simple to rotate the screen using scripts we have added 
    */
    async setRotation(rotation) {
        fs.writeFileSync("./rotation", rotation);
    
        const command = "/home/pi/.adjust_video.sh"
    
        const result = await executeCommand(command);
    }

    /*
    *   Screenshots mainWindow
    */
    screenShot() {
        this.mainWindow.webContents.capturePage({
            x: 0,   
            y: 0,
            width: this.mainWindow.webContents.width,
            height: this.mainWindow.webContents.height,
        }).then((img) => {
            fs.writeFile("./screenshots/shot.png", img.toPNG(), "base64", function (err) {
                if (err) throw err;
                console.log("Saved!");
            });
        }).catch((err) => console.log(err));
    }
}

module.exports = Utils;