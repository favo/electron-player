let myStorage

window.ononline = (event) => {
    const spinner = document.querySelector(".spinner")
    spinner.classList.remove("spin")
    updateShowNetworkSettings()
    setStatusMessage("Koblet til!")
  };
window.onoffline = (event) => {
    updateShowNetworkSettings()
    setStatusMessage("Ikke tilkoblet..")
};

window.onload = function() {
    const isOnline = window.navigator.onLine
    isOnline ? setStatusMessage("Tilkoblet!") : setStatusMessage("Ingen nettverk!")

    myStorage = window.localStorage;
    const hasHadConnection =  myStorage.getItem("has-had-connection")
    hasHadConnection || isOnline ? window.document.body.dataset.hasHadConnection = "true" : window.document.body.dataset.hasHadConnection = "false"

    updateShowNetworkSettings()
    
    const spinner = document.querySelector(".spinner")
    const refreshButton = document.getElementById("refresh-button");
    const letsGoButton = document.getElementById("lets-go-button");
    const connectButton = document.getElementById("connect-button");
    const rotationButtons = document.getElementById("rotation-buttons").querySelectorAll("button");
    const connectAnotherButton = document.getElementById("connect-another-button");
    const errorMessage = document.getElementById("error-message");
    const passwordField = document.getElementById("password")
    const ssidField = document.getElementById("network")
    const pinToMindButton = document.getElementById("pintomind")
    const infoskjermenButton = document.getElementById("infoskjermen")
    const hostName = document.getElementById("host-name")

    infoskjermenButton.addEventListener("click", (e) => setHost(e))
    pinToMindButton.addEventListener("click", (e) => setHost(e))
    refreshButton.addEventListener("click", () => window.api.send("search_after_networks"))
    letsGoButton.addEventListener("click", () => window.api.send("go_to_app"))
    passwordField.addEventListener("input", () => errorMessage.innerHTML = null)
    connectButton.addEventListener("click", (e) => {
        errorMessage.innerHTML = null

        const passwordstring = passwordField.value;
        const ssid = ssidField.value
        const security = ssidField.options[ssidField.selectedIndex].dataset.security

        spinner.classList.remove("error")
        spinner.classList.remove("success")

        if (security.includes("WPA") && passwordstring) {
          /* Case 2: Password field is filled, network network requires it and we try to connect */
          spinner.classList.add("spin")
          setStatusMessage("Kobler til nettverk")
          window.api.send("connect_to_network", {ssid: ssid, password: passwordstring})
        } else if (security.includes("WPA") && !passwordstring) {
          /* Case 1: Password field is empty and network requires it */
          errorMessage.innerHTML = "*Nettverket krever et passord"
        } else if (!security) {
          /* Case 3: Network has no security */
          window.api.send("connect_to_network", {ssid: ssid})
        } else {
          /* Case 4: Something wrong happened.. */
          errorMessage.innerHTML = "*Noe feil skjedde.."
        }
    });

    const host = myStorage.getItem("host")
    if (host) {
      hostName.innerHTML = host
    } else {
      updateHost()
    }

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
    
    window.api.receive("network_status", (data) => {
      if (data == true) {
        setStatusMessage("Tilkoblet!")
        spinner.classList.add("success")
        window.document.body.dataset.hasHadConnection = "true"
        myStorage.setItem("has-had-connection", "true")
      } else {
        spinner.classList.add("error")
        setStatusMessage("Kunne ikke koble til..")
      }
      spinner.classList.remove("spin")
    });
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
    myStorage.setItem("host", data)
  });

  window.api.send("request_host")
}

function setHost(e) {
  const hostname = e.target.value
  window.api.send("set_host", hostname)
  document.getElementById("host-name").innerHTML = hostname
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