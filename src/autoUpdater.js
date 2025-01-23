const { BrowserWindow } = require("electron");

const { autoUpdater } = require("electron-updater");
const { logger } = require("./appsignal");

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.allowPrerelease = false;

function getWebContents() {
    const mainWindow = BrowserWindow.getFocusedWindow()
    if (mainWindow) {
        return mainWindow.webContents
    }
    return null
}

autoUpdater.on("error", (error) => {
    logger.logError(error, "autoUpdater", "main")
});

autoUpdater.on("checking-for-update", (info) => {
    console.log(info);
    getWebContents().send("open_toaster", "Checking for update");
});

autoUpdater.on("update-not-available", (info) => {
    console.log(info);
    getWebContents().send("open_toaster", "No updates available");
});

autoUpdater.on("update-available", (info) => {
    console.log(info);
    autoUpdater.downloadUpdate();
    getWebContents().send("open_toaster", "Update available");
});

autoUpdater.on("download-progress", (info) => {
    console.log(info);
    getWebContents().send("open_toaster", `Download progress ${info.percent.toFixed(2)}%`);
});

autoUpdater.on("update-downloaded", (info) => {
    console.log(info);
    autoUpdater.quitAndInstall();
    getWebContents().send("open_toaster", "Update downloaded");
});

exports.autoUpdater = autoUpdater;