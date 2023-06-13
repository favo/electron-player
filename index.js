const { app, BrowserWindow, ipcMain, globalShortcut, net } = require('electron');
const nodeChildProcess = require('child_process');
const { autoUpdater } = require("electron-updater")
const path = require('path');
let pjson = require('./package.json');
let fs = require('fs');


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
    alwaysOnTop: true,
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
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

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
  globalShortcut.register('CommandOrControl+U+B', () => {
    console.log('Restarting app..')
    app.relaunch()
    app.exit()
  })
  //  reboot device
  globalShortcut.register('CommandOrControl+A', () => {
    console.log('Rebooting device..')
    rebootDevice()
  })
  globalShortcut.register("CommandOrControl+R+J", () => {
    setRotation("normal");
  })
  globalShortcut.register("CommandOrControl+R+K", () => {
    setRotation("inverted");
  })
  globalShortcut.register("CommandOrControl+R+H", () => {
    setRotation("left");
  })
  globalShortcut.register("CommandOrControl+R+L", () => {
    setRotation("right");
  })
  //  Opens devTools
  globalShortcut.register('CommandOrControl+D+C', () => {
    console.log('Opening DevTools..')
    mainWindow.webContents.openDevTools()
  })
  // Exits kiosk mode
  globalShortcut.register('CommandOrControl+K', () => {
    console.log('Exiting kiosk mode..')
    mainWindow.kiosk = !mainWindow.kiosk
  })
  // Exits kiosk mode
  globalShortcut.register('CommandOrControl+U+P', () => {
    console.log('Checking and Updating App..')
    updateApp()
  })
  // Updates Firmware
  globalShortcut.register('CommandOrControl+U+F', () => {
    console.log('Updating firmware...')
    updateFirmware()
  })
  // Takes screenshot
  globalShortcut.register('CommandOrControl+P', () => {
    screenShot()
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
*   Simple function to rotate the screen using scripts we have added 
*/
function setRotation(rotation) {
  fs.writeFileSync("./rotation", rotation);
  nodeChildProcess.execSync("killall xinit");
}

/*
*   Updates Firmware
*/

/* TODO */
/* Finne en bedre måte enn å fjerne /app.asar path */
function updateFirmware() {
  const script = nodeChildProcess.spawn('bash', [path.join(__dirname.replace("/app.asar", ""), 'scripts/update_firmware.sh'), 'arg1', 'arg2']);

  script.stdout.on('data', (data) => {
    console.log("stdout" + data);
  });

  script.stderr.on('data', (err) => {
      console.log('stderr: ' + err);
  });

  script.on('exit', (code) => {
      console.log('Exit Code: ' + code);
      rebootDevice()
  });

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
  const script = nodeChildProcess.spawn('bash', [path.join(__dirname.replace("/app.asar", ""), 'scripts/reboot.sh'), 'arg1', 'arg2']);

  script.stdout.on('data', (data) => {
    console.log("stdout" + data);
  });

  script.stderr.on('data', (err) => {
      console.log('stderr: ' + err);
  });

  script.on('exit', (code) => {
      console.log('Exit Code: ' + code);
  });
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
