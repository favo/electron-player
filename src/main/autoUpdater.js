const { autoUpdater } = require("electron-updater");
const { logger } = require("./appsignal");
const { getMainWindow } = require('./windowManager');

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.allowPrerelease = false;

function sendToToaster(msg) {
    getMainWindow().send("open_toaster", msg);
}

autoUpdater.on("error", (error) => {
    logger.logError(error, "autoUpdater", "main")
});

autoUpdater.on("checking-for-update", (info) => {
    console.log(info);
    sendToToaster("Checking for update")
});

autoUpdater.on("update-not-available", (info) => {
    console.log(info);
    sendToToaster("No updates available")
});

autoUpdater.on("update-available", (info) => {
    console.log(info);
    autoUpdater.downloadUpdate();
    sendToToaster("Update available")
});

autoUpdater.on("download-progress", (info) => {
    console.log(info);
    sendToToaster(`Download progress ${info.percent.toFixed(2)}%`)
});

autoUpdater.on("update-downloaded", (info) => {
    console.log(info);
    autoUpdater.quitAndInstall();
    sendToToaster("Update downloaded")
});

exports.autoUpdater = autoUpdater;