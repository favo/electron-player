const { rebootDevice, restartApp, sendDeviceInfo, updateApp, updateFirmware, getSystemStats, setRotation, deleteRotationFile } = require("./utils");
const NetworkManager = require("./networkManager");

const { app, BrowserWindow, ipcMain, globalShortcut } = require("electron");
const nodeChildProcess = require("child_process");

const Appsignal = require("@appsignal/javascript").default;
const appsignal = new Appsignal({ key: "b2bdf969-f795-467e-b710-6b735163281f" });

const { autoUpdater } = require("electron-updater");

const path = require("path");
const fs = require("fs");

const QRCode = require("qrcode");

const Store = require("electron-store");
const store = new Store();

const pjson = require("../package.json");

const crypto = require("crypto");

let mainWindow;
let systemStatsStream;

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.allowPrerelease = false;

app.commandLine.appendSwitch("use-vulkan");
app.commandLine.appendSwitch("enable-features", "Vulkan");
app.commandLine.appendSwitch("disable-gpu-driver-workarounds");
app.commandLine.appendSwitch("ignore-gpu-blacklist");

const createWindow = () => {
    mainWindow = new BrowserWindow({
        alwaysOnTop: false,
        width: 1920,
        height: 1080,
        kiosk: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, "preload.js"),
        },
        frame: false,
        icon: path.join(__dirname, "../assets/icon/png/logo256.png"),
    });

    if (!store.has("host")) {
        store.set("host", "app.pintomind.com");
    }

    if (!store.has("uuid")) {
        const uuid = crypto.randomBytes(3).toString("hex");
        store.set("uuid", uuid);
    }

    if (!store.has("lang")) {
        store.set("lang", "en");
    }

    //TODO Flytte denne inn
    NetworkManager.enableBLE();
    if (!store.has("firstTime")) {
        mainWindow.loadFile(path.join(__dirname, "get_started/get_started.html"));
    } else {
        mainWindow.loadFile(path.join(__dirname, "index/index.html"));
    }

    mainWindow.once("ready-to-show", () => {
        mainWindow.show();
    });

    mainWindow.on("closed", function () {
        mainWindow = null;
    });

    updateApp(autoUpdater);
};

/*
 *   Listeners from user key commands
 */
app.whenReady().then(() => {
    //  Restarts app
    globalShortcut.register("CommandOrControl+B", () => {
        console.log("Restarting app..");
        restartApp();
    });
    //  reboot device
    globalShortcut.register("CommandOrControl+A", () => {
        console.log("Rebooting device..");
        rebootDevice();
    });
    //  Opens devTools
    globalShortcut.register("CommandOrControl+D+T", () => {
        console.log("Opening DevTools..");
        mainWindow.webContents.openDevTools();
    });
    // Exits kiosk mode
    globalShortcut.register("CommandOrControl+K", () => {
        console.log("Exiting kiosk mode..");
        mainWindow.kiosk = !mainWindow.kiosk;
    });
    // Updates app
    globalShortcut.register("CommandOrControl+U", () => {
        console.log("Checking and Updating App..");
        updateApp(autoUpdater);
    });
    //Updates firmware
    globalShortcut.register("CommandOrControl+F", () => {
        console.log("Updating firmware...");
        updateFirmware();
    });
    // Opens settings page
    globalShortcut.register("CommandOrControl+I", () => {
        mainWindow.loadFile(path.join(__dirname, "settings/settings.html"));
    });
    // Opens player page
    globalShortcut.register("CommandOrControl+P", () => {
        mainWindow.loadFile(path.join(__dirname, "index/index.html"));
    });
    // Opens get started page
    globalShortcut.register("CommandOrControl+G", () => {
        mainWindow.loadFile(path.join(__dirname, "get_started/get_started.html"));
    });
    // Enables devmode
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
        autoUpdater.allowPrerelease = true;
    });

    /* https://medium.com/how-to-electron/how-to-reset-application-data-in-electron-48bba70b5a49 */
    globalShortcut.register("CommandOrControl+D+S", async () => {
        store.clear();
        await NetworkManager.deleteAllConnections();
        await deleteRotationFile();

        const getAppPath = path.join(app.getPath("appData"), pjson.name);
        fs.unlink(getAppPath, () => {
            rebootDevice();
        });
    });
});

app.on("ready", () => {
    createWindow();
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
    printInfo = false;
});

app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

/*
 *   Listeners from renderer. Called when server sends message
 */
ipcMain.on("reboot_device", (event, arg) => {
    rebootDevice();
});

ipcMain.on("restart_app", (event, arg) => {
    app.relaunch();
    app.exit();
});

ipcMain.on("request_device_info", (event, arg) => {
    const host = store.get("host")
    const deviceInfo = sendDeviceInfo(host);
    mainWindow.webContents.send("send_device_info", deviceInfo);
});

ipcMain.on("upgrade_firmware", (event, arg) => {
    updateFirmware();
});

ipcMain.on("update_app", (event, arg) => {
    updateApp();
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

        systemStatsStream = setInterval(() => {
            const systemStats = getSystemStats();
            mainWindow.webContents.send("recieve_system_stats", systemStats);
        }, arg.interval);
    }

    const systemStats = getSystemStats();
    mainWindow.webContents.send("recieve_system_stats", systemStats);
});

/* 
  Listeners from settings page.
*/
ipcMain.on("getFromStore", (_event, key) => {
    const value = store.get(key);
    mainWindow.webContents.send(key, value);
});

ipcMain.on("change_rotation", (_event, arg) => {
    setRotation(arg);
});

ipcMain.on("set_lang", (_event, lang) => {
    store.set("lang", lang);
});

ipcMain.on("set_host", (_event, data) => {
    store.set("host", data.host);

    if (data.reload) {
        mainWindow.webContents.reload();
    }
});

ipcMain.on("go_to_app", (_event, _arg) => {
    store.set("firstTime", "false");
    mainWindow.loadFile(path.join(__dirname, "index/index.html"));
});

ipcMain.on("connect_to_dns", (event, arg) => {
    const result = NetworkManager.addDNS(arg);
    mainWindow.webContents.send("dns_registred", result.success);
});

ipcMain.on("ethernet_status", (event, arg) => {
    console.log(arg);
});

ipcMain.on("remove_mouse", (_event, _arg) => {
    mainWindow.webContents.sendInputEvent({
        type: "mouseMove",
        x: 100,
        y: 100,
    });
});

ipcMain.on("create_qr_code", (event, options) => {
    const host = store.get("host");
    const qrcodeURI = host + options.path || "";

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
        mainWindow.webContents.send("finished_qr_code", url);
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
