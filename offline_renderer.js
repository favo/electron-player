
window.onload = () => {
    window.api.send("qrcode")
    
    window.api.receive("qrcode", (data) => {
        var qrcode = document.getElementById("bottom-right")
        qrcode.src = data
    });

}