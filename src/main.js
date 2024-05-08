const Utils = require('./utils')
const NetworkManager = require("./networkManager")

const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const nodeChildProcess = require('child_process');

const { autoUpdater } = require("electron-updater")

const path = require('path');

const QRCode = require('qrcode')

const Store = require('electron-store');
const store = new Store();

let host = "http://app.pintomind.com"
let utils
let networkManager
let mainWindow 
let systemStatsStream

autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = true

app.commandLine.appendSwitch("use-vulkan")
app.commandLine.appendSwitch("enable-features", "Vulkan")
app.commandLine.appendSwitch("disable-gpu-driver-workarounds")
app.commandLine.appendSwitch("ignore-gpu-blacklist")

const createWindow = () => {

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

  networkManager = new NetworkManager(mainWindow, store)
  utils = new Utils(mainWindow)
  
  if (! store.has('firstTime')) {
    mainWindow.loadFile(path.join(__dirname, 'settings/settings.html'));
    networkManager.checkForEthernetConnection()
    networkManager.enableBLE()
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

  try {
    autoUpdater.checkForUpdates()
  } catch(err) {
    console.log(err);
  }
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
    utils.rebootDevice()
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
    utils.updateApp(autoUpdater)
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


/*
*   AutoUpdater callbacks
*/
autoUpdater.on('error', (error) => {
  console.log(error);
}) 
autoUpdater.on('checking-for-update', (info) => {
  console.log(info);
  mainWindow.webContents.send("open_toaster", "Checking for update")
}) 
autoUpdater.on('update-not-available', (info) => {
  console.log(info);
  mainWindow.webContents.send("open_toaster", "No updates available")
}) 
autoUpdater.on('update-available', (info) => {
  console.log(info);
  autoUpdater.downloadUpdate()
  mainWindow.webContents.send("open_toaster", "Update available")
}) 
autoUpdater.on('download-progress', (info) => {
  console.log(info);
  mainWindow.webContents.send("open_toaster", `Download progress ${info.percent.toFixed(2)}%`)
}) 
autoUpdater.on('update-downloaded', (info) => {
  console.log(info);
  autoUpdater.quitAndInstall()
  mainWindow.webContents.send("open_toaster", "Update downloaded")
}) 


/*
*   Listeners from renderer. Called when server sends message
*/
ipcMain.on("reboot_device", (event, arg) => {
  utils.rebootDevice()
})
ipcMain.on("restart_app", (event, arg) => {
  app.relaunch()
  app.exit()
})
ipcMain.on("request_device_info", (event, arg) => {
  utils.sendDeviceInfo(host)
})
ipcMain.on("upgrade_firmware", (event, arg) => {
  utils.updateFirmware()
})
ipcMain.on("update_app", (event, arg) => {
  utils.updateApp()
})
ipcMain.on("check_server_connection", async (event, arg) => {
  const status = await networkManager.checkConnectionToServer();
  mainWindow.webContents.send("send_connection_status", status);
})
ipcMain.on("request_system_stats", (event, arg) => {
  if (arg.interval) {
    if (systemStatsStream) {
      clearInterval(systemStatsStream)
    } 

    systemStatsStream = setInterval(() => {
      utils.getSystemStats()
    }, arg.interval)
  }

  utils.getSystemStats()
})

/* 
  Listeners from settings page.
*/
ipcMain.on("change_rotation", (event, arg) => {
  utils.setRotation(arg)
})
ipcMain.on("search_after_networks", (event, arg) => {
  networkManager.searchNetwork()
})
ipcMain.on("connect_to_network", (event, arg) => {
  networkManager.connectToNetwork(arg)
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
  networkManager.addDNS(arg)
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