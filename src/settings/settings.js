var countdownInterval
var isConnecting = false
var statusMessage
var refreshButton
var passwordField
var errorMessage
var hostAddress
var ssidField
var myStorage
var spinner
var canvas
var dns


window.onload = function() {
    /* 
      Queryies all elemets neeeded
    */
    const letsGoButton = document.getElementById("lets-go-button");
    const connectButton = document.getElementById("connect-button");
    const rotationButtons = document.getElementById("rotation-buttons").querySelectorAll("button");
    const connectAnotherButton = document.getElementById("connect-another-button");
    const pinToMindButton = document.getElementById("pintomind")
    const infoskjermenButton = document.getElementById("infoskjermen")
    const hostName = document.getElementById("host-name")
    const dnsButton = document.getElementById("register-dns")
    const connectHostButton = document.getElementById("connect-to-host")
    const toggleButton = document.getElementById('toggleButton');
    
    /* 
    Queryies elements needed also later
    */
    statusMessage = document.getElementById("status-message");
    refreshButton = document.getElementById("refresh-button");
    errorMessage = document.getElementById("error-message");
    hostAddress = document.getElementById("host-address")
    passwordField = document.getElementById("password")
    ssidField = document.getElementById("network")
    spinner = document.querySelector(".spinner")
    canvas = document.getElementById('canvas')
    dns = document.getElementById("dns")
    myStorage = window.localStorage;

    /* 
      Adds events in elements
    */
    infoskjermenButton.addEventListener("click", (e) => {
      Array.from(e.target.parentElement.children).forEach(el => el.classList.toggle("selected", el == e.target))
      setHost(e.target.value)
    })
    pinToMindButton.addEventListener("click", (e) => {
      Array.from(e.target.parentElement.children).forEach(el => el.classList.toggle("selected", el == e.target))
      setHost(e.target.value)
    })
    toggleButton.addEventListener('click', () => {
      passwordField.type === 'password' ? passwordField.type = 'text' : passwordField.type = 'password';
    });
    refreshButton.addEventListener("click", () => {
      window.api.send("search_after_networks")
      refreshButton.dataset.status = "pending"
      setInterval(() => {
        refreshButton.dataset.status = null
      }, 5000)
    })

    letsGoButton.addEventListener("click", () => window.api.send("go_to_app"))
    connectButton.addEventListener("click", () => connectToNetwork());
    dnsButton.addEventListener("click", () => registerDNS());
    connectHostButton.addEventListener("click", () => connectToHost());
    passwordField.addEventListener("input", () => errorMessage.innerHTML = null)


    const host = myStorage.getItem("host")
    if (host) {
      hostName.innerHTML = host
      hostAddress.value = host

      if (host == "app.infoskjermen.no") {
        infoskjermenButton.classList.add("selected")
      } else if (host == "app.pintomind.com") {
        pinToMindButton.classList.add("selected")
      }
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
    checkServerConnection();

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
      canvas.src = data
    });

    window.api.receive("send_connection_status", (data) => {
      resetSpinner();
      if (data == true) {
        setStatusMessage("Connected!")
        spinner.classList.add("success")
        window.document.body.dataset.showNetworkSettings = false
      } else {
        setStatusMessage("Not connected..")
        spinner.classList.add("error")
        window.document.body.dataset.showNetworkSettings = true
        window.api.send("search_after_networks")
      }
    });

    window.api.receive("network_status", (data) => {
      resetSpinner()
      isConnecting = false
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
  isConnecting = true 
  errorMessage.innerHTML = null

  const passwordstring = passwordField.value;
  const ssid = ssidField.value
  const security = ssidField.options[ssidField.selectedIndex].dataset.security

  resetSpinner()

  if (security.includes("WPA") && passwordstring) {
    /* Case 1: Password field is filled, network network requires it and we try to connect */
    spinner.classList.add("spin")
    setStatusMessage("Connecting...")
    window.api.send("connect_to_network", {ssid: ssid, password: passwordstring, security: security})
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

function checkServerConnection() {
  spinner.classList.add("spin")
  setStatusMessage("Connecting...")
  window.api.send("check_server_connection")
}

function updateHost() {
  window.api.receive("send_host", (data) => {
    document.getElementById("host-name").innerHTML = data
    hostAddress.value = data
    myStorage.setItem("host", data)
    if (data == "app.infoskjermen.no") {
      infoskjermenButton.classList.add("selected")
    } else if (data == "app.pintomind.com") {
      pinToMindButton.classList.add("selected")
    }
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
  Array.from(e.target.parentElement.children).forEach(el => {
    el.classList.toggle("selected", el == e.target)
  })
  window.api.send("change_rotation", orientation)
}

function displayListOfNetworks(data) {
  const select = document.getElementById("network")
  select.innerHTML = ""
  refreshButton.dataset.status = null
  
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
    const lines = inputString.split('\n');
    const uniqueSSIDs = [];
    const uniqueSSIDNames = new Set();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith('SSID:')) {
        const ssid = line.replace('SSID:', '').trim();
        let securityLine;
        for (let j = i + 1; j < lines.length; j++) {
          if (lines[j].trim().startsWith('SECURITY:')) {
            securityLine = lines[j];
            break;
          }
        }
  
        const security = securityLine ? securityLine.replace('SECURITY:', '').trim() : '';
  
        if (!uniqueSSIDNames.has(ssid) && ssid) {
          uniqueSSIDNames.add(ssid);
  
          const ssidObject = {
            ssid: ssid,
            security: security
          };
  
          uniqueSSIDs.push(ssidObject);
        }
      }
    }
    return uniqueSSIDs;
  }