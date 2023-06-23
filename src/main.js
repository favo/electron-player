const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const nodeChildProcess = require('child_process');
const { autoUpdater } = require("electron-updater")
const path = require('path');
let pjson = require('../package.json');
let fs = require('fs');
const quote = require('shell-quote/quote');

const Store = require('electron-store');
const store = new Store();

let mainWindow 

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
    kiosk: false,
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
  } else {
    mainWindow.loadFile(path.join(__dirname, 'index/index.html'));
    ethernetInterval = setInterval(() => checkForEthernetConnection(), 2000)
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
  globalShortcut.register('CommandOrControl+D', () => {
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
}) 
autoUpdater.on('update-available', (info) => {
  autoUpdater.downloadUpdate()
  console.log(info);
}) 
autoUpdater.on('download-progress', (info) => {
  console.log(info);
}) 
autoUpdater.on('update-downloaded', (info) => {
  autoUpdater.quitAndInstall()
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
})

/* 
*   Simple function to rotate the screen using scripts we have added 
*/
function setRotation(rotation) {
  fs.writeFileSync("./rotation", rotation);

  const command = "/home/pi/.adjust_video.sh"

  nodeChildProcess.exec(command, (err, stdout, stderr) => {
    if (err) {
      console.error(`exec error: ${err}`);
      return;
    }
    console.log(`stdout ${stdout.toString()}`);
    console.log(`stderr ${stderr.toString()}`);
  });
}

/* 
*   Function for connection to a network
*/
function connectToNetwork(data) {
  const ssid = data.ssid
  const password = data.password
  let command1
  if (password) {
    command1 = quote(['nmcli', 'device', 'wifi', 'connect', ssid, 'password', password]);
  } else {
    command1 = quote(['nmcli', 'device', 'wifi', 'connect', ssid]);
  }
  let command2 = quote(['grep', '-q', 'activated']);

  let fullCommand = command1 + ' | ' + command2;

  console.log(fullCommand);
  
  nodeChildProcess.exec(fullCommand, (err, stdout, stderr) => {
    if (err) {
      console.error(`exec error: ${err}`);
      mainWindow.webContents.send("network_status", false);
      return;
    }
    console.log(`stdout ${stdout.toString()}`);
    console.log(`stderr ${stderr.toString()}`);
    
    mainWindow.webContents.send("network_status", true);
  });
}

/* 
*   Function for searching after local networks
*/
function searchNetwork() {
  const command = "nmcli --fields SSID,SECURITY --terse --mode multiline dev wifi list"

  nodeChildProcess.exec(command, (err, stdout, stderr) => {
    if (err) {
      console.error(`exec error: ${err}`);
      return;
    }
    console.log(`stdout ${stdout.toString()}`);
    console.log(`stderr ${stderr.toString()}`);
    
    mainWindow.webContents.send("list_of_networks", stdout.toString());
  });
}

function checkForEthernetConnection() {
  const command = "nmcli device status | grep ethernet | grep -q connected && echo 1 || echo 0"

  nodeChildProcess.exec(command, (err, stdout, stderr) => {
    if (err) {
      console.error(`exec error: ${err}`);
      if (ethernetInterval) {
        clearInterval(ethernetInterval)
        ethernetInterval = null
      }
      return;
    }
    console.log(`stdout ${stdout.toString()}`);
    console.log(`stderr ${stderr.toString()}`);
    /* TODO REMOVE ELSE */
    if (stdout == "1") {
      if (ethernetInterval) {
        clearInterval(ethernetInterval)
        ethernetInterval = null
      }
      mainWindow.webContents.send("ethernet_status", stdout.toString());
    } else {
      if (ethernetInterval) {
        clearInterval(ethernetInterval)
        ethernetInterval = null
      }
      mainWindow.webContents.send("ethernet_status", '1');
    }
  });
}

/*
*   Updates Firmware
*/
function updateFirmware() {
  console.log("NOT IMPLEMENTED");
}

/*
*   Updates Player App
*/
function updateApp() {
  autoUpdater.checkForUpdates()
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
