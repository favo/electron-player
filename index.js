const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const shutdown = require('electron-shutdown-command');
const si = require('systeminformation');
let pjson = require('./package.json');
let fs = require('fs');

let mainWindow 

var host = "http://app.infoskjermen.no"

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

};

/*
*   Listeners from user key commands
*/
app.whenReady().then(() => {
  //  Restarts app
  globalShortcut.register('CommandOrControl+J', () => {
    console.log('Restarting app..')
    app.relaunch()
    app.exit()
  })
  //  reboot device
  globalShortcut.register('CommandOrControl+A+J', () => {
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

/*
*   Listeners from renderer. Called when server sends message
*/
ipcMain.on("reboot_device", function() {
  rebootDevice()
})
ipcMain.on("restart_app", function() {
  app.relaunch()
  app.exit()
})
ipcMain.on("request_device_info", (event, arg) => {
  sendDeviceInfo()
})
ipcMain.on("toMain", (event, arg) => {
  console.log(arg);
})

/*
*   Reboots device
*/
function rebootDevice() {
  shutdown.reboot({
    force: true,
    timerseconds: 5,
    sudo: true,
    debug: false,
    quitapp: true,
  })
}

/*
*   Sends device info
*/
function sendDeviceInfo() {

  var options = {}
  options["Host"] = host
  options["App-version"] = pjson.version
  si.osInfo()
  .then(data => options["Platform-OS"] = data.platform)
  si.system()
  .then(data => options["Model"] = data.model)
  
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