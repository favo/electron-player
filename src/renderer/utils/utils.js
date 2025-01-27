/*
 * Function from getting value from Store in main prosess based on key. Key needs to be whitelisted in preload.js
 * @param {String} key
 * @param {JSONObject} data
 * @param {function} callback
 */
function sendRecieveToMain(key, data = {}, callback) {
    window.api.send(key, data);
    window.api.receive(key, callback);
}

/*
 * Function from getting value from Store in main prosess based on key. Key needs to be whitelisted in preload.js
 * @param {String} key
 * @param {JSONObject} data
 * @param {function} callback
 */
function getFromStore(key, data = null, callback) {
    window.api.getFromStore(key, data);
    window.api.resultFromStore(key, callback);
}