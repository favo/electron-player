const { app, BrowserWindow, ipcMain, globalShortcut, net } = require('electron');
const nodeChildProcess = require('child_process');
const path = require('path');
const shutdown = require('electron-shutdown-command');
const si = require('systeminformation');
let pjson = require('./package.json');
let fs = require('fs');
const https = require('https');
const { resolve } = require('path');

app.disableHardwareAcceleration()

let mainWindow 

let host = "http://app.pintomind.com"
const appUpdateURL = "https://github.com/favo/electron-player/releases/latest/"
const dowlaodAppURL = "https://github.com/favo/electron-player/releases/latest/download/pintomind-player.deb"

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    alwaysOnTop: true,
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
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.webContents.setFrameRate(30)

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
  // Exits kiosk mode
  globalShortcut.register('CommandOrControl+U+P', () => {
    console.log('Cheching and Updating App..')
    updateApp()
  })
  // Updates Firmware
  globalShortcut.register('CommandOrControl+U+F', () => {
    console.log('Updating firmware...')
    upgradeFirmware()
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
ipcMain.on("upgrade_firmware", (event, arg) => {
  upgradeFirmware()
})
ipcMain.on("update_app", (event, arg) => {
  updateApp()
})
ipcMain.on("toMain", (event, arg) => {
  console.log(arg);
})

/*
*   Updates Firmware
*/
function upgradeFirmware() {
  const script = nodeChildProcess.spawn('bash', [path.join(__dirname, 'scripts/update_firmware.sh'), 'arg1', 'arg2']);

  script.stdout.on('data', (data) => {
    console.log('stdout: ' + data);
  });

  script.stderr.on('data', (err) => {
      console.log('stderr: ' + err);
  });

  script.on('exit', (code) => {
      console.log('Exit Code: ' + code);
  });
}

/*
*   Updates Player App
*/
async function updateApp() {

  const newAppVersion = await checkNewAppVersion()

  const AppVersion = pjson.version
  const updateApp = cmpVersions(newAppVersion, AppVersion)

  if (updateApp) {
    const script = nodeChildProcess.spawn('bash', [path.join(__dirname, 'scripts/update_app.sh'), dowlaodAppURL, __dirname]);
    
    script.stdout.on('data', (data) => {
      console.log('stdout: ' + data);
    });

    script.on('exit', (code) => {
        console.log('Exit Code: ' + code);
    });

  }
}

function checkNewAppVersion() {
  return new Promise(resolve => {
    const request = net.request({
      method: 'GET',
      protocol: 'https:',
      hostname: 'github.com',
      path: '/favo/electron-player/releases/latest',
      redirect: 'follow'
    })

    request.on('redirect', (statusCode, method, redirectUrl, responseHeaders) => {
      const list = redirectUrl.split("/")
      const newAppVersion = list[list.length - 1]
      resolve(newAppVersion)
    })

    request.on('error', (res) => {
      console.log(res);
    })

    request.setHeader('Content-Type', 'application/json');
    request.end();
  });
}

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
  options["Platform"] = "Electron"
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

function cmpVersions (a, b) {
  var i, diff;
  var regExStrip0 = /(\.0+)+$/;
  var segmentsA = a.replace(regExStrip0, '').split('.');
  var segmentsB = b.replace(regExStrip0, '').split('.');
  var l = Math.min(segmentsA.length, segmentsB.length);

  for (i = 0; i < l; i++) {
      diff = parseInt(segmentsA[i], 10) - parseInt(segmentsB[i], 10);
      if (diff) {
          return diff;
      }
  }
  return segmentsA.length - segmentsB.length;
}