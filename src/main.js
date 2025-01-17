const { rebootDevice, sendDeviceInfo, updateApp, updateFirmware, getSystemStats, setScreenRotation, 
    setScreenResolution, getAllScreenResolution, readBluetoothID, turnDisplayOff, updateDisplayConfiguration, setBluetoothID, getPlayerConfig } = require("./utils");
const NetworkManager = require("./networkManager");
const BleManager = require("./bleManager");

const { app, BrowserWindow, ipcMain, globalShortcut } = require("electron");

const Appsignal = require("@appsignal/javascript").default;
let appsignal;

const { autoUpdater } = require("electron-updater");

const path = require("path");
const fs = require("fs");

const QRCode = require("qrcode");

const Store = require("electron-store");
const store = new Store();

const pjson = require("../package.json");



let mainWindow;
let systemStatsStream;

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.allowPrerelease = false;

//app.commandLine.appendSwitch("use-vulkan");
//app.commandLine.appendSwitch("enable-features", "Vulkan");
//app.commandLine.appendSwitch("disable-gpu-driver-workarounds");
//app.commandLine.appendSwitch("ignore-gpu-blocklist");

app.commandLine.appendSwitch('gl', 'egl')
app.commandLine.appendSwitch('enable-gpu-rasterization');  // GPU for video rendering
app.commandLine.appendSwitch('ignore-gpu-blocklist');  // Enable all GPU features
app.commandLine.appendSwitch('enable-zero-copy');  // Efficient video frame handling
app.commandLine.appendSwitch('disable-software-video-decoder');  // Force hardware decoding
app.commandLine.appendSwitch('enable-native-gpu-memory-buffers');
app.commandLine.appendSwitch('disable-gpu-driver-bug-workarounds');


const createWindow = async () => {

    await setSettingsFromPlayerConfig()

    mainWindow = new BrowserWindow({
        alwaysOnTop: false,
        backgroundColor: '#000000',
        width: 1920,
        height: 1080,
        frame: false,
        show: false, 
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, "preload.js"),
        },
    });

    mainWindow.once('ready-to-show', () => {
        mainWindow.kiosk = true
        mainWindow.show()
    })

    // use to debug gpu settings
    //mainWindow.loadURL("chrome://gpu")

    if (store.get("firstTime", true)) {
        NetworkManager.checkEthernetConnectionInterval()
        mainWindow.loadFile(path.join(__dirname, "get_started/get_started.html"));
    } else {
        mainWindow.loadFile(path.join(__dirname, "index/index.html"));
    }

    BleManager.enableBle();

    mainWindow.on("closed", () => {
        mainWindow = null;
    });

    updateApp(autoUpdater);
};

app.on("ready", () => {
    createWindow();
});

app.on("window-all-closed", () => {
    app.exit(1);
});

app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

async function setSettingsFromPlayerConfig() {
    const config = await getPlayerConfig()
    
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
        appsignal = new Appsignal({ key: config["appsignal-key"] });
    }
}

/*
 *   Listeners from user key commands
 */
app.whenReady().then(() => {
    /* reboot device */
    globalShortcut.register("CommandOrControl+A", () => {
        console.log("Rebooting device..");
        rebootDevice();
    });

    /* Opens devTools */
    globalShortcut.register("CommandOrControl+D+T", () => {
        console.log("Opening DevTools..");
        mainWindow.webContents.openDevTools();
    });

    /* Exits kiosk mode */
    globalShortcut.register("CommandOrControl+K", () => {
        console.log("Exiting kiosk mode..");
        mainWindow.kiosk = !mainWindow.kiosk;
    });

    /* Update app */
    globalShortcut.register("CommandOrControl+U", () => {
        console.log("Checking and Updating App..");
        updateApp(autoUpdater);
    });
    
    /* Opens settings page */
    globalShortcut.register("CommandOrControl+I", () => {
        mainWindow.loadFile(path.join(__dirname, "settings/settings.html"));
    });

    /* Opens player page */
    globalShortcut.register("CommandOrControl+P", () => {
        NetworkManager.stopEthernetInterval();
        mainWindow.loadFile(path.join(__dirname, "index/index.html"));
    });

    /* Opens get started page */
    globalShortcut.register("CommandOrControl+G", () => {
        mainWindow.loadFile(path.join(__dirname, "get_started/get_started.html"));
    });
    
    /* Toggle devMode */
    globalShortcut.register("CommandOrControl+D+M", () => {
        const devMode = store.get("devMode", false);

        if (devMode) {
            store.set("devMode", false);
            autoUpdater.allowPrerelease = false;
            mainWindow.webContents.send("devMode", false);
        } else {
            store.set("devMode", true);
            autoUpdater.allowPrerelease = true;
            mainWindow.webContents.send("devMode", true);
        }
    });

    /* Factory reset */
    globalShortcut.register("CommandOrControl+D+S", async () => {
        factoryReset()
    });
});

/*
 *   Listeners from renderer. Called when server sends message
 */
ipcMain.on("reboot_device", (event, arg) => {
    rebootDevice();
});

ipcMain.on("request_device_info", async (event, arg) => {
    const deviceInfo = await sendDeviceInfo();
    mainWindow.webContents.send("send_device_info", deviceInfo);
});

ipcMain.on("upgrade_firmware", (event, arg) => {
    updateFirmware();
});

ipcMain.on("update_app", (event, arg) => {
    updateApp();
});

ipcMain.on("pincode", (event, pincode) => {
    BleManager.sendPincodeToBluetooth(pincode)
});

ipcMain.on("wake", (event, arg) => {
    updateDisplayConfiguration();
});

ipcMain.on("sleep", (event, arg) => {
    turnDisplayOff();
});

ipcMain.on("factory_reset", (event, arg) => {
    factoryReset();
});

ipcMain.on("check_server_connection", async (event, arg) => {
    const status = await NetworkManager.checkConnectionToServer();
    mainWindow.webContents.send("connect_to_network_status", status);
});

ipcMain.on("connect_to_network", async (_event, arg) => {
    const result = await NetworkManager.connectToNetwork(arg);
    mainWindow.webContents.send("connect_to_network_status", result);
});

ipcMain.on("search_after_networks", async (event, arg) => {
    const result = await NetworkManager.searchNetwork();

    if (result.success) {
        mainWindow.webContents.send("list_of_networks", result.stdout.toString());
    }
});

ipcMain.on("request_system_stats", (event, arg) => {
    if (arg.interval) {
        if (systemStatsStream) {
            clearInterval(systemStatsStream);
        }

        systemStatsStream = setInterval(async () => {
            const systemStats = await getSystemStats();
            mainWindow.webContents.send("recieve_system_stats", systemStats);
        }, arg.interval);
    }

    const systemStats = getSystemStats();
    mainWindow.webContents.send("recieve_system_stats", systemStats);
});

ipcMain.on("is_connecting", async (_event, arg) => {
    mainWindow.webContents.send("is_connecting");
});

ipcMain.on("connecting_result", async (_event, arg) => {
    mainWindow.webContents.send("connect_to_network_status", arg);
});

/* 
  Listeners from settings page.
*/
ipcMain.on("getFromStore", (_event, key) => {
    const value = store.get(key);
    mainWindow.webContents.send(key, value);
});

ipcMain.on("set_screen_rotation", (_event, rotation) => {
    setScreenRotation(rotation);
});

ipcMain.on("set_screen_resolution", (event, resolution) => {
    setScreenResolution(resolution);
});

ipcMain.on("get_screen_resolutions", async (event, arg) => {
    const screenResolutions = await getAllScreenResolution();
    mainWindow.webContents.send("get_screen_resolutions", screenResolutions);    
});

ipcMain.on("set_lang", (_event, lang) => {
    store.set("lang", lang);
});

ipcMain.on("get_bluetooth_id", async () => {
    const bluetooth_id = await readBluetoothID()
    mainWindow.webContents.send("get_bluetooth_id", bluetooth_id);    
});

ipcMain.on("set_host", (event, data) => {
    store.set("host", data.host);

    if (data.reload) {
        mainWindow.webContents.reload();
    }
});

ipcMain.on("go_to_screen", (_event, _arg) => {
    store.set("firstTime", false);
    NetworkManager.stopEthernetInterval();
    mainWindow.loadFile(path.join(__dirname, "index/index.html"));
});

ipcMain.on("connect_to_dns", async (event, dns) => {
    mainWindow.webContents.send("dns_registerering");
    const result = await NetworkManager.addDNS(dns);
    if (result.success) {
        store.set("dns", dns)
    }
    mainWindow.webContents.send("dns_registred", result.success);
});

ipcMain.on("ethernet_status", (_event, result) => {
    mainWindow.webContents.send("connect_to_network_status", result);
});

ipcMain.on("remove_mouse", (_event, _arg) => {
    mainWindow.webContents.sendInputEvent({
        type: "mouseMove",
        x: 100,
        y: 100,
    });
});

ipcMain.on("create_qr_code", async (event, options) => {
    const host = store.get("host");
    const uuid = await readBluetoothID()
    const qrcodeURI =  `https://${host}/remote/connect?device=rpi&code=${uuid}`;

    const opts = {
        errorCorrectionLevel: "H",
        type: "image/jpeg",
        quality: 0.8,
        margin: 1,
        color: {
            light: options.lightColor,
            dark: options.darkColor,
        },
    };

    QRCode.toDataURL(qrcodeURI, opts, (err, url) => {
        mainWindow.webContents.send("create_qr_code", url);
    });
});

/*
 *   AutoUpdater callbacks
 */
autoUpdater.on("error", (error) => {
    appsignal.sendError(error, (span) => {
        span.setAction("autoUpdater");
        span.setNamespace("main");
        span.setTags({ host: store.get("host"), version: pjson.version });
    });
});

autoUpdater.on("checking-for-update", (info) => {
    console.log(info);
    mainWindow.webContents.send("open_toaster", "Checking for update");
});

autoUpdater.on("update-not-available", (info) => {
    console.log(info);
    mainWindow.webContents.send("open_toaster", "No updates available");
});

autoUpdater.on("update-available", (info) => {
    console.log(info);
    autoUpdater.downloadUpdate();
    mainWindow.webContents.send("open_toaster", "Update available");
});

autoUpdater.on("download-progress", (info) => {
    console.log(info);
    mainWindow.webContents.send("open_toaster", `Download progress ${info.percent.toFixed(2)}%`);
});

autoUpdater.on("update-downloaded", (info) => {
    console.log(info);
    autoUpdater.quitAndInstall();
    mainWindow.webContents.send("open_toaster", "Update downloaded");
});


async function factoryReset() {
    /* https://medium.com/how-to-electron/how-to-reset-application-data-in-electron-48bba70b5a49 */
    store.clear();

    const ses = mainWindow.webContents.session;

    ses.clearStorageData({
      storages: ['localstorage']
    }).then(() => {
      console.log('Local storage cleared!');
    });

    ses.clearCache(() => {
        console.log('Cache cleared!');
    });

    await NetworkManager.resetAllConnections();
    await setScreenRotation("normal");
    await setScreenResolution("1920x1080");
    await setBluetoothID("");

    const getAppPath = path.join(app.getPath("appData"), pjson.name);
    fs.unlink(getAppPath, () => {
        rebootDevice();
    });
}
