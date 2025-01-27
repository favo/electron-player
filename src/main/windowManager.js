let mainWindow = null;

function setMainWindow(window) {
  mainWindow = window;
}

function getMainWindow() {
  return mainWindow;
}

function getWebContents() {
  if (mainWindow) {
    return mainWindow.webContents
  } 
  return null
}

module.exports = {
  setMainWindow,
  getMainWindow,
  getWebContents
};
