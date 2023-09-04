const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');

const nodeChildProcess = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(nodeChildProcess.exec);
async function executeCommand(command) {
  try {
    const { stdout, stderr } = await execAsync(command); 
    const result = {
      success: true,
      stdout: stdout.trim(),
      stderr: stderr.trim()
    }
    return result;
  } catch (error) {
    const result = {
      success: false,
      stdout: null,
      stderr: null,
      error: error
    }
    return result
  }
}

const { autoUpdater } = require("electron-updater")
const path = require('path');
const io = require("socket.io-client");
let pjson = require('../package.json');
let fs = require('fs');
const quote = require('shell-quote/quote');
const si = require('systeminformation');
const QRCode = require('qrcode')

const Store = require('electron-store');
const store = new Store();

let bleSocket = io("ws://127.0.0.1:3333");

let mainWindow 
let systemStatsStream

let host = "http://app.pintomind.com"

autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = true

app.commandLine.appendSwitch("use-vulkan")
app.commandLine.appendSwitch("enable-features", "Vulkan")
app.commandLine.appendSwitch("disable-gpu-driver-workarounds")
app.commandLine.appendSwitch("ignore-gpu-blacklist")

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    alwaysOnTop: false,
    width: 1920,
    height: 1080,
    kiosk: true,
    webPreferences: { 
      nodeIntegration: false, 
      contextIsolation: true, 
      enableRemoteModule: false,
      preload: path.join(__dirname, "preload.js")
    },
    frame: false,
    icon: path.join(__dirname, '../assets/icon/png/logo256.png')
  });
  
  if (! store.has('firstTime')) {
    mainWindow.loadFile(path.join(__dirname, 'settings/settings.html'));
    ethernetInterval = setInterval(() => checkForEthernetConnection(), 2000)
    enableBLE()
  } else {
    mainWindow.loadFile(path.join(__dirname, 'index/index.html'));
  }

  if (!store.has('host')) {
    store.set("host", "app.pintomind.com")
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })
  
  mainWindow.on("closed", function () {
    mainWindow = null
  })

  autoUpdater.checkForUpdates()
 
};

/*
*   Listeners from user key commands
*/
app.whenReady().then(() => {
  //  Restarts app
  globalShortcut.register('CommandOrControl+B', () => {
    console.log('Restarting app..')
    /* app.relaunch()
    app.exit() */
    nodeChildProcess.execSync("killall xinit");
  })
  //  reboot device
  globalShortcut.register('CommandOrControl+A', () => {
    console.log('Rebooting device..')
    rebootDevice()
  })
  //  Opens devTools
  globalShortcut.register('CommandOrControl+D+T', () => {
    console.log('Opening DevTools..')
    mainWindow.webContents.openDevTools()
  })
  // Exits kiosk mode
  globalShortcut.register('CommandOrControl+K', () => {
    console.log('Exiting kiosk mode..')
    mainWindow.kiosk = !mainWindow.kiosk
  })
  // Updates app
  globalShortcut.register('CommandOrControl+U', () => {
    console.log('Checking and Updating App..')
    updateApp()
  })
/*   // Updates Firmware
  globalShortcut.register('CommandOrControl+F', () => {
    console.log('Updating firmware...')
    updateFirmware()
  }) */
/*   // Takes screenshot
  globalShortcut.register('CommandOrControl+P', () => {
    screenShot()
  }) */

  // Opens settings page
  globalShortcut.register('CommandOrControl+I', () => {
    mainWindow.loadFile(path.join(__dirname, 'settings/settings.html'));
  })
  // Opens player page
  globalShortcut.register('CommandOrControl+P', () => {
    mainWindow.loadFile(path.join(__dirname, 'index/index.html'));
  })
  // Enables devmode
  globalShortcut.register('CommandOrControl+D+M', () => {
    const devMode = store.get("devMode", false)
    if (devMode) {
      store.set('devMode', false);
      mainWindow.webContents.send("send_dev_mode", false);
    } else {
      store.set('devMode', true);
      mainWindow.webContents.send("send_dev_mode", true);
    }
  })

});

app.on('ready', () => {
  createWindow()
});


app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
  printInfo = false
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

autoUpdater.on('checking-for-update', (info) => {
  console.log(info);
  mainWindow.webContents.send("open_toaster", "Checking for update")
}) 
autoUpdater.on('update-not-available', (info) => {
  console.log(info);
  mainWindow.webContents.send("open_toaster", "No updates available")
}) 
autoUpdater.on('update-available', (info) => {
  autoUpdater.downloadUpdate()
  mainWindow.webContents.send("open_toaster", "Update available")
  console.log(info);
}) 
autoUpdater.on('download-progress', (info) => {
  console.log(info);
  mainWindow.webContents.send("open_toaster", `Download progress ${info.percent.toFixed(2)}%`)
}) 
autoUpdater.on('update-downloaded', (info) => {
  autoUpdater.quitAndInstall()
  mainWindow.webContents.send("open_toaster", "Update downloaded")
}) 


/*
*   Listeners from renderer. Called when server sends message
*/
ipcMain.on("reboot_device", (event, arg) => {
  rebootDevice()
})
ipcMain.on("restart_app", (event, arg) => {
  app.relaunch()
  app.exit()
})
ipcMain.on("request_device_info", (event, arg) => {
  sendDeviceInfo()
})
ipcMain.on("upgrade_firmware", (event, arg) => {
  updateFirmware()
})
ipcMain.on("update_app", (event, arg) => {
  updateApp()
})
ipcMain.on("request_system_stats", (event, arg) => {
  if (arg.interval) {
    if (systemStatsStream) {
      clearInterval(systemStatsStream)
    } 

    systemStatsStream = setInterval(() => {
      getSystemStats()
    }, arg.interval)
  }

  getSystemStats()
})

/* 
  Listeners from settings page.
*/
ipcMain.on("change_rotation", (event, arg) => {
  setRotation(arg)
})
ipcMain.on("search_after_networks", (event, arg) => {
  searchNetwork()
})
ipcMain.on("connect_to_network", (event, arg) => {
  connectToNetwork(arg)
})
ipcMain.on("go_to_app", (event, arg) => {
  store.set('firstTime', 'false');
  mainWindow.loadFile(path.join(__dirname, 'index/index.html'));
})
ipcMain.on("set_host", (event, arg) => {
  console.log("Settings host to:", arg);
  store.set('host', arg);
})
ipcMain.on("request_host", (event, arg) => {
  const host = store.get("host")
  mainWindow.webContents.send("send_host", host);
  mainWindow.webContents.sendInputEvent({type: 'mouseMove', x: 100, y: 100})
})
ipcMain.on("connect_to_dns", (event, arg) => {
  addDNS(arg)
})
ipcMain.on("get_dev_mode", (event, arg) => {
  const devMode = store.get("devMode", false)
  mainWindow.webContents.send("send_dev_mode", devMode);
})
ipcMain.on("get_qr_code", (event, arg) => {
  const host = store.get("host")
  const qrcodeURI = host + "/connect"
  var opts = {
    errorCorrectionLevel: 'H',
    type: 'image/jpeg',
    quality: 0.8,
    margin: 1,
    color: {
      light:"#000000",
      dark:"#828282"
    }
  }
  QRCode.toDataURL(qrcodeURI, opts, function (err, url) {
    mainWindow.webContents.send("send_qr_code", url);
  })
})

/* 
*   Simple function to rotate the screen using scripts we have added 
*/
async function setRotation(rotation) {
  fs.writeFileSync("./rotation", rotation);

  const command = "/home/pi/.adjust_video.sh"

  const result = await executeCommand(command);
}

/* 
*   Function for connection to a network
*/
async function connectToNetwork(data) {
  const ssid = data.ssid
  const password = data.password


  let command1
  if (password) {
    if (data.security.includes("WPA3")) {
      command1 =  quote(['nmcli', 'connection', 'add', 'type', 'wifi', 'ifname', 'wlan0', 'con-name', ssid, 'ssid', ssid, '--', 'wifi-sec.key-mgmt', 'wpa-psk', 'wifi-sec.psk', password]);
    } else {
      command1 =  quote(['nmcli', 'device', 'wifi', 'connect', ssid, 'password', password]);
    }
  } else {
    command1 = quote(['nmcli', 'device', 'wifi', 'connect', ssid]);
  }
  let command2 = quote(['grep', '-q', 'activated']);

  let fullCommand = command1 + ' | ' + command2;

  const result = await executeCommand(fullCommand);
  console.log(result);
  if (result.success) {
    const connection = await checkConnectionToServer()
    mainWindow.webContents.send("network_status", connection);
  } else {
    mainWindow.webContents.send("network_status", false);
  }
}

async function checkConnectionToServer() {
  const host = store.get("host")

  const command = `curl -I https://${host}/up | grep Status | grep -q 200 && echo 1 || echo 0`
  
  const result = await executeCommand(command);
  console.log(result);
  if (result.success && result.stdout.toString() == "1") {
    bleSocket.emit("ble-disable");
    /* TODO: turn off io socket */
    if (ethernetInterval) {
      clearInterval(ethernetInterval)
      ethernetInterval = null
    }
    return true
  } else {
    return false
  }

}

/* 
* get system stats
*/
async function getSystemStats() {
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

    mainWindow.webContents.send("recieve_system_stats", stats);
}

/* 
*   Function for searching after local networks
*/
async function searchNetwork() {
  const command = "nmcli --fields SSID,SECURITY --terse --mode multiline dev wifi list"
  
  const result = await executeCommand(command);

  mainWindow.webContents.send("list_of_networks", result.stdout.toString());
}

async function checkForEthernetConnection() {
  const command = "nmcli device status | grep ethernet | grep -q connected && echo 1 || echo 0"

  const result = await executeCommand(command);

  if (result.success && result.stdout == "1") {
    if (ethernetInterval) {
      clearInterval(ethernetInterval)
      ethernetInterval = null
    }
    mainWindow.webContents.send("ethernet_status", result.stdout.toString());
  }
}

/* 
  Adds dns address to /etc/resolv
*/
async function addDNS(name) {
  const command =  quote(['sudo','sed', '-i', `3inameserver ${name}`, '/etc/resolv.conf']);

  const result = await executeCommand(command);

  console.log(result);
  mainWindow.webContents.send("dns_registred", result.success)
}

/*
*   Updates Firmware
*/
async function updateFirmware() {
  const command = "/home/pi/.system-upgrade.sh"

  const result = await executeCommand(command);

  if (result.success) {
    rebootDevice()
  }
}

/*
*   Updates Player App
*/
function updateApp() {
  autoUpdater.checkForUpdates()
}

/*
*  Enables BLE by connecting to the local BLE bridge, and registers listeners for BLE events
*/
function enableBLE() {
  console.log('Enabling BLE support..')

  bleSocket.on("ble-enabled", () => {
    console.log("BLE enabled");
  });
  bleSocket.on("rotation", (rotation) => {
    setRotation(rotation);
  });
  bleSocket.on("wifi", (data) => {
    connectToNetwork(JSON.parse(data));
  });
  setTimeout(() => {
    // Disable BLE after 10 minutes to prevent someone from changing the Wi-Fi
    bleSocket.emit("ble-disable");
  }, 60*1000*10);
  bleSocket.emit("ble-enable");
}

/*
*   Reboots device
*/
function rebootDevice() {
  nodeChildProcess.execSync("sudo reboot");
}

/*
*   Sends device info
*/
function sendDeviceInfo() {
  
  var options = {}
  options["Host"] = host
  options["App-version"] = pjson.version
  options["Platform"] = "Electron"
  options["App-name"] = pjson.name
    
  mainWindow.webContents.send("send_device_info", options);
}

function screenShot() {
  mainWindow.webContents.capturePage({
    x: 0,
    y: 0,
    width: mainWindow.webContents.width,
    height: mainWindow.webContents.height,
  })
  .then((img) => {
    fs.writeFile("./screenshots/shot.png", img.toPNG(), "base64", function (err) {
      if (err) throw err;
      console.log("Saved!");
    });
  })
  .catch((err) => {
    console.log(err);
  });
}
