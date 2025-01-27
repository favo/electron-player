const { rebootDevice, updateApp, updateFirmware, updateBleBridge, getSystemStats, setScreenRotation,
    setScreenResolution, getAllScreenResolution, readBluetoothID, turnDisplayOff, updateDisplayConfiguration, 
    setSettingsFromPlayerConfig, parseWiFiScanResults, sendDeviceInfoToMainWindow, setBluetoothID } = require("./utils");

const NetworkManager = require("./networkManager");
const BleManager = require("./bleManager");

const { app, BrowserWindow, ipcMain, globalShortcut } = require("electron");

const { store } = require("./store");
const { autoUpdater } = require("./autoUpdater");
const { setMainWindow, getWebContents, getMainWindow } = require('./windowManager');

const pjson = require("../../package.json");
const QRCode = require("qrcode");
const path = require("path");
const fs = require("fs");


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

let systemStatsStream;

const createWindow = async () => {

    await setSettingsFromPlayerConfig()

    const mainWindow = new BrowserWindow({
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
        mainWindow.loadFile(path.join(__dirname, "../renderer/get_started/get_started.html"));
    } else {
        mainWindow.loadFile(path.join(__dirname, "../renderer/index/index.html"));
    }

    BleManager.enableBLE();

    setMainWindow(mainWindow)

    mainWindow.on("closed", () => {
        setMainWindow(null);
    });

    updateApp();
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


app.whenReady().then(() => {
    /* reboot device */
    globalShortcut.register("CommandOrControl+A", () => {
        console.log("Rebooting device..");
        rebootDevice();
    });

    /* Opens devTools */
    globalShortcut.register("CommandOrControl+D+T", () => {
        console.log("Opening DevTools..");
        getWebContents().openDevTools();
    });

    /* Exits kiosk mode */
    globalShortcut.register("CommandOrControl+K", () => {
        console.log("Exiting kiosk mode..");
        getMainWindow().kiosk = !getMainWindow().kiosk;
    });

    /* Update app */
    globalShortcut.register("CommandOrControl+U", () => {
        console.log("Checking and Updating App..");
        updateApp();
    });
    
    /* Opens settings page */
    globalShortcut.register("CommandOrControl+I", () => {
        getMainWindow().loadFile(path.join(__dirname, "../renderer/settings/settings.html"));
    });

    /* Opens player page */
    globalShortcut.register("CommandOrControl+P", () => {
        NetworkManager.stopEthernetInterval();
        getMainWindow().loadFile(path.join(__dirname, "../renderer/index/index.html"));
    });

    /* Opens get started page */
    globalShortcut.register("CommandOrControl+G", () => {
        getMainWindow().loadFile(path.join(__dirname, "../renderer/get_started/get_started.html"));
    });
    
    /* Toggle devMode */
    globalShortcut.register("CommandOrControl+D+M", () => {
        const devMode = store.get("devMode", false);

        if (devMode) {
            store.set("devMode", false);
            autoUpdater.allowPrerelease = false;
            getWebContents().send("devMode", false);
        } else {
            store.set("devMode", true);
            autoUpdater.allowPrerelease = true;
            getWebContents().send("devMode", true);
        }
    });

    /* Factory reset */
    globalShortcut.register("CommandOrControl+D+S", async () => {
        factoryReset()
    });
});


ipcMain.on("reboot_device", (event, arg) => {
    rebootDevice();
});

ipcMain.on("request_device_info", async (event, arg) => {
    sendDeviceInfoToMainWindow()
});

ipcMain.on("upgrade_firmware", async (event, arg) => {
    await updateBleBridge();
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
    getWebContents().send("connect_to_network_status", status);
});

ipcMain.on("connect_to_network", async (_event, arg) => {
    const result = await NetworkManager.connectToNetwork(arg);
    getWebContents().send("connect_to_network_status", result);
});

ipcMain.on("search_after_networks", async (event, arg) => {
    const result = await NetworkManager.scanAvailableNetworks();

    if (result.success) {
        const listOfNetworks = parseWiFiScanResults(result.stdout.toString());
        getWebContents().send("list_of_networks", listOfNetworks);
    }
});

ipcMain.on("request_system_stats", (event, arg) => {
    if (arg.interval) {
        if (systemStatsStream) {
            clearInterval(systemStatsStream);
        }

        systemStatsStream = setInterval(async () => {
            const systemStats = await getSystemStats();
            getWebContents().send("recieve_system_stats", systemStats);
        }, arg.interval);
    }

    const systemStats = getSystemStats();
    getWebContents().send("recieve_system_stats", systemStats);
});

ipcMain.on("is_connecting", async (_event, arg) => {
    getWebContents().send("is_connecting");
});

ipcMain.on("connecting_result", async (_event, arg) => {
    getWebContents().send("connect_to_network_status", arg);
});


ipcMain.on("getFromStore", (_event, key) => {
    const value = store.get(key);
    getWebContents().send(key, value);
});

ipcMain.on("set_screen_rotation", async (_event, rotation) => {
    setScreenRotation(rotation);
    sendDeviceInfoToMainWindow()
});

ipcMain.on("set_screen_resolution", async (event, resolution) => {
    setScreenResolution(resolution);
    sendDeviceInfoToMainWindow()
});

ipcMain.on("get_screen_resolutions", async (event, arg) => {
    const screenResolutions = await getAllScreenResolution();
    getWebContents().send("get_screen_resolutions", screenResolutions);    
});

ipcMain.on("set_lang", (_event, lang) => {
    store.set("lang", lang);
});

ipcMain.on("get_bluetooth_id", async () => {
    const bluetooth_id = await readBluetoothID()
    getWebContents().send("get_bluetooth_id", bluetooth_id);    
});

ipcMain.on("set_host", (event, data) => {
    store.set("host", data.host);

    if (data.reload) {
        getWebContents().reload();
    }
});

ipcMain.on("go_to_screen", (_event, _arg) => {
    store.set("firstTime", false);
    NetworkManager.stopEthernetInterval();
    getMainWindow().loadFile(path.join(__dirname, "../renderer/index/index.html"));
});

ipcMain.on("connect_to_dns", async (event, dns) => {
    getWebContents().send("dns_registerering");
    const result = await NetworkManager.addDNS(dns);
    if (result.success) {
        store.set("dns", dns)
    }
    getWebContents().send("dns_registred", result.success);
});

ipcMain.on("ethernet_status", (_event, result) => {
    getWebContents().send("connect_to_network_status", result);
});

ipcMain.on("remove_mouse", (_event, _arg) => {
    getWebContents().sendInputEvent({
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
        getWebContents().send("create_qr_code", url);
    });
});


async function factoryReset() {
    /* https://medium.com/how-to-electron/how-to-reset-application-data-in-electron-48bba70b5a49 */
    store.clear();

    const ses = getWebContents().session;

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