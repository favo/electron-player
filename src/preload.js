const {
    contextBridge,
    ipcRenderer
} = require("electron");

contextBridge.exposeInMainWorld(
    "api", {
        send: (channel, data) => {
            // whitelist channels
            let validChannels = ["reboot_device", "restart_app", "request_device_info", "upgrade_firmware", "update_app", "change_rotation", "search_after_networks", "connect_to_network", "go_to_app", "send_physical_id"];
            if (validChannels.includes(channel)) {
                ipcRenderer.send(channel, data);
            }
        },
        receive: (channel, func) => {
            let validChannels = ["send_device_info", "list_of_networks", "network_status", "request_physical_id"];
            if (validChannels.includes(channel)) {
                ipcRenderer.on(channel, (event, ...args) => func(...args));
            }
        }
    },
);