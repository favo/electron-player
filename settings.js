window.ononline = (event) => {
    console.log("You are now connected to the network.");
    window.document.body.dataset.isOnline = window.navigator.onLine
    const spinner = document.querySelector(".spinner")
    spinner.classList.remove("spin")
    setStatusMessage("Koblet til!")
};
window.onoffline = (event) => {
    console.log("The network connection has been lost.");
    window.document.body.dataset.isOnline = window.navigator.onLine
};

window.onload = function() {
    const isOnline = window.navigator.onLine

    const refreshButton = document.getElementById("refresh-button");
    refreshButton.addEventListener("click", () => window.api.send("search_after_networks"))

    const letsGoButton = document.getElementById("lets-go-button");
    letsGoButton.addEventListener("click", () => window.api.send("go_to_app"))

    const connectButton = document.getElementById("connect-button");
    connectButton.addEventListener("click", (e) => {
        const passwordstring = document.getElementById("password").value;
        const ssid = document.getElementById("network").value
        const spinner = document.querySelector(".spinner")
        spinner.classList.add("spin")
        setStatusMessage("Kobler til nettverk")
        window.api.send("connect_to_network", {ssid: ssid, password: passwordstring})
    })

    const buttons = document.getElementById("rotation-buttons").querySelectorAll("button");

    [...buttons].forEach(button => {
        button.addEventListener(("click"), changeRotation)
    });

    window.document.body.dataset.isOnline = isOnline
    
    window.api.receive("list_of_networks", (data) => {
        displayListOfNetworks(data)
    });

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