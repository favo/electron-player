SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
LAST_IP_FILE="$SCRIPT_DIR/last_ip_address.txt"

if [ -z "$SERVER" ]; then
  if [ -n "$1" ]; then
    if [ "scan" == "$1" ]; then
      echo "Skanner på lokalnettverket etter Raspberry Pi"
      SERVER=$("$SCRIPT_DIR/scan_for_pi" | grep "Found Raspberry Pi:" | cut -d':' -f2 | head -n 1)
      SERVER="${SERVER#"${SERVER%%[![:space:]]*}"}"  # Remove leading spaces
      SERVER="${SERVER%"${SERVER##*[![:space:]]}"}"  # Remove trailing spaces

      if [ -z "$SERVER" ]; then
        echo "FEIL: Fant ingen Raspberry Pi på det lokale nettverket"
        exit 1
      fi
    else
      SERVER="$1"
    fi
    echo "$SERVER" > "$LAST_IP_FILE"
    shift
  else
      if [ -f "$LAST_IP_FILE" ]; then
          SERVER=$(cat "$LAST_IP_FILE")
      else
          echo "FEIL: Oppgi ip addresse eller servernavn til pi'en du vil ssh'e til"
          exit 1
      fi
  fi

  export SERVER
fi