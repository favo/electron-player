var myStorage
var countdownInterval
var errorMessage
var ssidField
var passwordField
var hostAddress
var spinner
var canvas
var dns

window.ononline = (event) => {
    resetSpinner()
    updateShowNetworkSettings()
    setStatusMessage("Connected!")
  };
window.onoffline = (event) => {
    resetSpinner()
    updateShowNetworkSettings()
    setStatusMessage("Not connected..")
};

window.onload = function() {
    const isOnline = window.navigator.onLine
    isOnline ? setStatusMessage("Connected!") : setStatusMessage("Not connected..")

    myStorage = window.localStorage;
    const hasHadConnection =  myStorage.getItem("has-had-connection")
    hasHadConnection || isOnline ? window.document.body.dataset.hasHadConnection = "true" : window.document.body.dataset.hasHadConnection = "false"

    updateShowNetworkSettings()
    
    /* 
      Queryies all elemets neeeded
    */
    const refreshButton = document.getElementById("refresh-button");
    const letsGoButton = document.getElementById("lets-go-button");
    const connectButton = document.getElementById("connect-button");
    const rotationButtons = document.getElementById("rotation-buttons").querySelectorAll("button");
    const connectAnotherButton = document.getElementById("connect-another-button");
    const pinToMindButton = document.getElementById("pintomind")
    const infoskjermenButton = document.getElementById("infoskjermen")
    const hostName = document.getElementById("host-name")
    const dnsButton = document.getElementById("register-dns")
    const connectHostButton = document.getElementById("connect-to-host")

    /* 
      Queryies elements needed also later
    */
    spinner = document.querySelector(".spinner")
    hostAddress = document.getElementById("host-address")
    passwordField = document.getElementById("password")
    errorMessage = document.getElementById("error-message");
    ssidField = document.getElementById("network")
    canvas = document.getElementById('canvas')
    dns = document.getElementById("dns")


    /* 
      Adds events in elements
    */
    infoskjermenButton.addEventListener("click", (e) => setHost(e.target.value))
    pinToMindButton.addEventListener("click", (e) => setHost(e.target.value))
    refreshButton.addEventListener("click", () => window.api.send("search_after_networks"))
    letsGoButton.addEventListener("click", () => window.api.send("go_to_app"))
    connectButton.addEventListener("click", () => connectToNetwork());
    dnsButton.addEventListener("click", () => registerDNS());
    connectHostButton.addEventListener("click", () => connectToHost());
    passwordField.addEventListener("input", () => errorMessage.innerHTML = null)

    const host = myStorage.getItem("host")
    if (host) {
      hostName.innerHTML = host
      hostAddress.value = host
    } else {
      updateHost()
    }

    const dnsAddress = myStorage.getItem("dns")
    if (dnsAddress) {
      dns.value = dnsAddress
    } else {
      dns.value = "Your IP Address"
    }

    window.api.send("get_dev_mode");
    window.api.send("get_qr_code");

    [...rotationButtons].forEach(button => {
        button.addEventListener(("click"), changeRotation)
    });

    connectAnotherButton.addEventListener("click", () =>{ 
      window.document.body.dataset.showNetworkSettings = true
      window.api.send("search_after_networks")
    })

    window.api.receive("list_of_networks", (data) => {
        displayListOfNetworks(data)
    });

    window.api.receive("send_dev_mode", (data) => {
      window.document.body.dataset.devMode = data
    });

    window.api.receive("ethernet_status", (data) => {
        if (data == "1") {
          const ethernet = document.querySelector(".ethernet-connected");
          const settings = document.querySelector(".settings");
          settings.style.display = "none"
          ethernet.style.display = "flex"
          startCountdown()
        }
    });

    window.api.receive("send_qr_code", (data) => {
      //canvas.src = data
    });

    
    window.api.receive("network_status", (data) => {
      resetSpinner()
      console.log("network_status: data: ", data);
      if (data == true) {
        setStatusMessage("Connected!")
        spinner.classList.add("success")
        window.document.body.dataset.hasHadConnection = "true"
        updateShowNetworkSettings()
        myStorage.setItem("has-had-connection", "true")
      } else {
        spinner.classList.add("error")
        errorMessage.innerHTML = "Could not connect to the network. Are you sure that you've entered your password correctly"
        setStatusMessage("Not connected..")
      }
    });
}

function resetSpinner() {
  spinner.classList.remove("error")
  spinner.classList.remove("success")
  spinner.classList.remove("spin")
}

function connectToNetwork() {
  errorMessage.innerHTML = null

  const passwordstring = passwordField.value;
  const ssid = ssidField.value
  const security = ssidField.options[ssidField.selectedIndex].dataset.security

  resetSpinner()

  if (security.includes("WPA") && passwordstring) {
    /* Case 1: Password field is filled, network network requires it and we try to connect */
    spinner.classList.add("spin")
    setStatusMessage("Connecting...")
    window.api.send("connect_to_network", {ssid: ssid, password: passwordstring})
  } else if (security.includes("WPA") && !passwordstring) {
    /* Case 2: Password field is empty and network requires it */
    errorMessage.innerHTML = "* This network requires a password"
  } else if (!security) {
    /* Case 3: Network has no security */
    window.api.send("connect_to_network", {ssid: ssid})
  } else {
    /* Case 4: Something wrong happened.. */
    errorMessage.innerHTML = "* An unexpected error happened.."
  }
}

function updateShowNetworkSettings() {
  if (window.navigator.onLine) {
    window.document.body.dataset.showNetworkSettings = false
  } else {
    window.document.body.dataset.showNetworkSettings = true
    window.api.send("search_after_networks")
  }
}

function updateHost() {
  window.api.receive("send_host", (data) => {
    document.getElementById("host-name").innerHTML = data
    hostAddress.value = data
    myStorage.setItem("host", data)
  });

  window.api.send("request_host")
}

function setHost(host) {
  window.api.send("set_host", host)
  document.getElementById("host-name").innerHTML = host
  hostAddress.value = host
}

function changeRotation(e) {
  const orientation = e.target.value
  window.api.send("change_rotation", orientation)
}

function displayListOfNetworks(data) {
  const select = document.getElementById("network")
  select.innerHTML = ""
  
  const list = findUniqueSSIDs(data)
  
  list.forEach(network => {
      const option = document.createElement('option');
      option.textContent = `${network.ssid} - ${network.security}`;
      option.value = network.ssid;
      option.dataset.security = network.security;
      select.appendChild(option);
  })
}

function setStatusMessage(message) {
    const statusMessage = document.getElementById("status-message")
    statusMessage.innerHTML = message
}

function startCountdown() {
  if (! countdownInterval) {
    document.addEventListener('keydown', keyboardEvent)

    const countDownNumber = document.getElementById("countdown")
    let number = 15
    countdownInterval = setInterval(() => {
      if (number == 0) {
        if (countdownInterval) {
          clearInterval(countdownInterval)
          countdownInterval == null
        }
        document.removeEventListener('keydown', keyboardEvent)
        window.api.send("go_to_app")
      } else {
        number = number - 1
        countDownNumber.innerHTML = number
      }
    }, 1000);
  }
}

function keyboardEvent() {
  if (countdownInterval) {
    clearInterval(countdownInterval)
    countdownInterval == null
  }

  document.removeEventListener('keydown', keyboardEvent)

  const ethernet = document.querySelector(".ethernet-connected");
  const settings = document.querySelector(".settings");
  settings.style.display = "flex"
  ethernet.style.display = "none"
}

function registerDNS() {
  const delay = Date.now()
  window.api.receive("dns_registred", (data) => {
      const waitTime = Date.now() - delay
      if (waitTime) {
        setInterval(() => {
          if (data == true) {
            setStatusMessage("DNS registred")
          } else {
            setStatusMessage("Could not register DNS")
          }
          resetSpinner()
        }, waitTime)
      }
  });

  const name = dns.value
  dns.placeholder = name
  setStatusMessage("Registring DNS..")
  spinner.classList.add("spin")

  myStorage.setItem("dns", name)
  window.api.send("connect_to_dns", name)

}

function connectToHost() {
  const name = hostAddress.value
  setHost(name)
}

function findUniqueSSIDs(inputString) {
    // Split the input string into an array of lines
    const lines = inputString.split('\n');
  
    // Create an empty array to store unique SSID objects
    const uniqueSSIDs = [];
  
    // Create a set to track unique SSID names
    const uniqueSSIDNames = new Set();
  
    // Iterate over each line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
  
      // Check if the line starts with "SSID:"
      if (line.trim().startsWith('SSID:')) {
        // Extract the SSID value by removing "SSID:" and trimming any whitespace
        const ssid = line.replace('SSID:', '').trim();
  

        // Find the next line that contains "SECURITY:"
        let securityLine;
        for (let j = i + 1; j < lines.length; j++) {
          if (lines[j].trim().startsWith('SECURITY:')) {
            securityLine = lines[j];
            break;
          }
        }
  
        // Extract the security value by removing "SECURITY:" and trimming any whitespace
        const security = securityLine ? securityLine.replace('SECURITY:', '').trim() : '';
  
        // Check if the SSID is unique and ssid is not empty string
        if (!uniqueSSIDNames.has(ssid) && ssid) {
          // Add the SSID name to the set of unique SSIDs
          uniqueSSIDNames.add(ssid);
  
          // Create a JSON object with ssid and security properties
          const ssidObject = {
            ssid: ssid,
            security: security
          };
  
          // Add the SSID object to the array
          uniqueSSIDs.push(ssidObject);
        }
      }
    }
  
    // Return the array containing unique SSID objects
    return uniqueSSIDs;
  }