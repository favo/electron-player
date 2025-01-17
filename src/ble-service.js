import bleno from "bleno";

// These can be any sequence of 32 hex digits
export const SERVICE_UUID = "89496822200000000000000000000000";

// Write
const ROTATION_CHARACTERISTIC_UUID = "89496822201000000000000000000000";
const WIFI_CHARACTERISTIC_UUID = "89496822202000000000000000000000";
const HOST_CHARACTERISTIC_UUID = "89496822204000000000000000000000";
const DNS_CHARACTERISTIC_UUID = "89496822213000000000000000000000"
const RESOLUTION_CHARACTERISTIC_UUID = "89496822210000000000000000000000";
const FINISH_CHARACTERISTIC_UUID = "89496822209000000000000000000000";
const FACTORY_RESET_CHARACTERISTIC_UUID = "89496822214000000000000000000000";
const GO_TO_SCREEN_CHARACTERISTIC_UUID = "89496822212000000000000000000000";

// Notify
const NOTIFY_NETWORK_LIST_CHARACTERISTIC_UUID =
    "89496822205000000000000000000000";
const NOTIFY_NETWORK_CONNECTION_CHARACTERISTIC_UUID =
    "89496822206000000000000000000000";
const NOTIFY_DEVICE_SETTINGS_CHARACTERISTIC_UUID =
    "89496822207000000000000000000000";
const NOTIFY_PINCODE_CHARACTERISTIC_UUID =
    "89496822211000000000000000000000";


export const bleCallbacks = {
  onSetRotation: (rotation) => {},
  onSetWIFI: (ssid) => {},
  onSetHost: (host) => {},
  onSetDns: (dns) => {},
  onSetResolution: (res) => {},
  sendNetworkList: (isSubscribed, maxValueSize, callback) => {},
  sendDeviceSettings: (isSubscribed, maxValueSize, callback) => {},
  notifyNetworkConnection: (isSubscribed, callback) => {},
  notifyPincode: (isSubscribed, callback) => {},
  finishSetup: () => {},
  factoryReset: () => {},
  goToScreen: () => {},
};

const setRotationCharacteristic = new bleno.Characteristic({
  uuid: ROTATION_CHARACTERISTIC_UUID,
  properties: ["write"],
  onWriteRequest: (data, _offset, _withoutResponse, callback) => {
    const dataString = data.toString("utf-8");
    console.log(
      "setRotationCharacteristic write request: " + data.toString("utf-8")
    );
    if (["normal", "left", "right", "inverted"].includes(dataString)) {
      bleCallbacks.onSetRotation(dataString);
      callback(bleno.Characteristic.RESULT_SUCCESS);
    } else {
      callback(bleno.Characteristic.RESULT_UNLIKELY_ERROR);
    }
  },
});

const setWIFICharacteristic = new bleno.Characteristic({
  uuid: WIFI_CHARACTERISTIC_UUID,
  properties: ["write"],
  onWriteRequest: (data, _offset, _withoutResponse, callback) => {
    console.log(
      "setWIFICharacteristic write request: " + data.toString("utf-8")
    );
    bleCallbacks.onSetWIFI(data.toString("utf-8"));
    callback(bleno.Characteristic.RESULT_SUCCESS);
  },
});

const setHostCharacteristic = new bleno.Characteristic({
  uuid: HOST_CHARACTERISTIC_UUID,
  properties: ["write"],
  onWriteRequest: (data, _offset, _withoutResponse, callback) => {
    console.log(
      "setHostCharacteristic write request: " + data.toString("utf-8")
    );
    bleCallbacks.onSetHost(data.toString("utf-8"));
    callback(bleno.Characteristic.RESULT_SUCCESS);
  },
});

const setDnsCharacteristic = new bleno.Characteristic({
  uuid: DNS_CHARACTERISTIC_UUID,
  properties: ["write"],
  onWriteRequest: (data, _offset, _withoutResponse, callback) => {
    console.log("setDnsCharacteristic write request: " + data.toString("utf-8"));
    bleCallbacks.onSetDns(data.toString("utf-8"));
    callback(bleno.Characteristic.RESULT_SUCCESS);
  },
});

const setResolutionCharacteristic = new bleno.Characteristic({
  uuid: RESOLUTION_CHARACTERISTIC_UUID,
  properties: ["write"],
  onWriteRequest: (data, _offset, _withoutResponse, callback) => {
    console.log(
      "setResolutionCharacteristic write request: " + data.toString("utf-8")
    );
    bleCallbacks.onSetResolution(data.toString("utf-8"));
    callback(bleno.Characteristic.RESULT_SUCCESS);
  },
});

const notifyNetworkListCharacteristic = new bleno.Characteristic({
  uuid: NOTIFY_NETWORK_LIST_CHARACTERISTIC_UUID,
  properties: ["notify"],
  onSubscribe: (maxValueSize, updateValueCallback) => {
    console.log("notifyNetworkListCharacteristic - onSubscribe");
    bleCallbacks.sendNetworkList(true, maxValueSize, updateValueCallback);
  },
  onUnsubscribe: () => {
    console.log("notifyNetworkListCharacteristic - onUnsubscribe");
    bleCallbacks.sendNetworkList(false, null, null);
  },
});

const notifyNetworkConnectionCharacteristic = new bleno.Characteristic({
  uuid: NOTIFY_NETWORK_CONNECTION_CHARACTERISTIC_UUID,
  properties: ["notify"],
  onSubscribe: (maxValueSize, updateValueCallback) => {
    console.log("notifyNetworkConnectionCharacteristic - onSubscribe");
    bleCallbacks.notifyNetworkConnection(true, updateValueCallback);
  },
  onUnsubscribe: () => {
    console.log("notifyNetworkConnectionCharacteristic - onUnsubscribe");
    bleCallbacks.notifyNetworkConnection(false, null);
  },
});

const notifyDeviceSettingsCharecteristic = new bleno.Characteristic({
  uuid: NOTIFY_DEVICE_SETTINGS_CHARACTERISTIC_UUID,
  properties: ["notify"],
  onSubscribe: (maxValueSize, updateValueCallback) => {
    console.log("notifyDeviceSettingsCharecteristic - onSubscribe");
    bleCallbacks.sendDeviceSettings(true, maxValueSize, updateValueCallback);
  },
  onUnsubscribe: () => {
    console.log("notifyDeviceSettingsCharecteristic - onUnsubscribe");
    bleCallbacks.sendDeviceSettings(false, null, null);
  },
});

const notifyPincodeCharacteristic = new bleno.Characteristic({
  uuid: NOTIFY_PINCODE_CHARACTERISTIC_UUID,
  properties: ["notify"],
  onSubscribe: (_maxValueSize, updateValueCallback) => {
    console.log("notifyPincodeCharacteristic - onSubscribe");
    bleCallbacks.notifyPincode(true, updateValueCallback);
  },
  onUnsubscribe: () => {
    console.log("notifyPincodeCharacteristic - onUnsubscribe");
    bleCallbacks.notifyPincode(false, null);
  },
});

const finishCharacteristic = new bleno.Characteristic({
  uuid: FINISH_CHARACTERISTIC_UUID,
  properties: ["write"],
  onWriteRequest: (data, _offset, _withoutResponse, callback) => {
    console.log("finishCharacteristic write request: " + data.toString("utf-8"));
    bleCallbacks.finishSetup();
    callback(bleno.Characteristic.RESULT_SUCCESS);
  },
});

const factoryResetCharacteristic = new bleno.Characteristic({
  uuid: FACTORY_RESET_CHARACTERISTIC_UUID,
  properties: ["write"],
  onWriteRequest: (data, _offset, _withoutResponse, callback) => {
    console.log("factoryResetCharacteristic write request: " + data.toString("utf-8"));
    bleCallbacks.factoryReset();
    callback(bleno.Characteristic.RESULT_SUCCESS);
  },
});


const goToScreenCharacteristic = new bleno.Characteristic({
  uuid: GO_TO_SCREEN_CHARACTERISTIC_UUID,
  properties: ["write"],
  onWriteRequest: (data, _offset, _withoutResponse, callback) => {
    console.log("goToScreenCharacteristic write request: " + data.toString("utf-8") );
    bleCallbacks.goToScreen();
    callback(bleno.Characteristic.RESULT_SUCCESS);
  },
});


export const configurationService = new bleno.PrimaryService({
  uuid: SERVICE_UUID,
  characteristics: [
    setRotationCharacteristic,
    setWIFICharacteristic,
    setHostCharacteristic,
    setDnsCharacteristic,
    setResolutionCharacteristic,
    notifyNetworkListCharacteristic,
    notifyDeviceSettingsCharecteristic,
    notifyNetworkConnectionCharacteristic,
    notifyPincodeCharacteristic,
    finishCharacteristic,
    factoryResetCharacteristic,
    goToScreenCharacteristic
  ],
});
