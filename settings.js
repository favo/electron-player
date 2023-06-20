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
    
    updateShowNetworkSettings()

    const spinner = document.querySelector(".spinner")
    const refreshButton = document.getElementById("refresh-button");
    const letsGoButton = document.getElementById("lets-go-button");
    const connectButton = document.getElementById("connect-button");
    const rotationButtons = document.getElementById("rotation-buttons").querySelectorAll("button");
    const connectAnotherButton = document.getElementById("connect-another-button");

    refreshButton.addEventListener("click", () => window.api.send("search_after_networks"))
    letsGoButton.addEventListener("click", () => window.api.send("go_to_app"))
    connectButton.addEventListener("click", (e) => {
        const passwordstring = document.getElementById("password").value;
        const ssid = document.getElementById("network").value

        spinner.classList.add("spin")
        setStatusMessage("Kobler til nettverk")
        window.api.send("connect_to_network", {ssid: ssid, password: passwordstring})
    });

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
        window.document.body.dataset.isOnline = true
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
  
        // Check if the SSID is unique
        if (!uniqueSSIDNames.has(ssid)) {
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