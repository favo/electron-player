const {
    contextBridge,
    ipcRenderer
} = require("electron");

contextBridge.exposeInMainWorld(
    "api", {
        send: (channel, data) => {
            // whitelist channels
            let validChannels = ["reboot_device", "restart_app", "request_device_info", "upgrade_firmware", "update_app", "change_rotation", "search_after_networks", 
                "connect_to_network", "go_to_app", "request_host", "set_host", "connect_to_dns", "get_dev_mode", "request_system_stats", "start_system_stats_stream", 
                "stop_system_stats_stream", "get_qr_code"];
            if (validChannels.includes(channel)) {
                ipcRenderer.send(channel, data);
            }
        },
        receive: (channel, func) => {
            let validChannels = ["send_device_info", "list_of_networks", "network_status", "request_physical_id", "send_host", "ethernet_status", "send_dev_mode", 
                "recieve_system_stats", "send_qr_code", "dns_registred"];
            if (validChannels.includes(channel)) {
                ipcRenderer.on(channel, (event, ...args) => func(...args));
            }
        }
    },
);