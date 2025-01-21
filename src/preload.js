const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
    send: (channel, data) => {
        // whitelist channels
        const validChannels = [
            "reboot_device",
            "restart_app",
            "request_device_info",
            "upgrade_firmware",
            "update_app",
            "pincode",
            "factory_reset",
            "set_screen_rotation",
            "get_screen_resolutions",
            "set_screen_resolution",
            "search_after_networks",
            "connect_to_network",
            "go_to_screen",
            "set_host",
            "set_lang",
            "connect_to_dns",
            "request_system_stats",
            "start_system_stats_stream",
            "stop_system_stats_stream",
            "create_qr_code",
            "check_server_connection",
            "remove_mouse",
            "ethernet_status",
            "is_connecting",
            "connecting_result",
            "get_bluetooth_id",
            "wake",
            "sleep"
        ];
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    },
    receive: (channel, func) => {
        const validChannels = [
            "send_device_info",
            "list_of_networks",
            "connect_to_network_status",
            "is_connecting",
            "request_physical_id",
            "ethernet_status",
            "recieve_system_stats",
            "create_qr_code",
            "dns_registred",
            "dns_registerering",
            "get_screen_resolutions",
            "open_toaster",
            "get_bluetooth_id"
        ];
        if (validChannels.includes(channel)) {
            ipcRenderer.on(channel, (event, ...args) => func(...args));
        }
    },

    getFromStore: (key) => {
        const validKeys = ["host", "dns", "uuid", "lang", "devMode"];

        if (validKeys.includes(key)) {
            ipcRenderer.send("getFromStore", key);
        }
    },
    resultFromStore: (key, func) => {
        const validKeys = ["host", "dns", "uuid", "lang", "devMode"];
        if (validKeys.includes(key)) {
            ipcRenderer.on(key, (event, ...args) => func(...args));
        }
    },
});
