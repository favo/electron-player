# Use Node.js with Alpine for a small image
FROM node:20-bookworm

# Install dependencies for Electron and X11
RUN apt-get update && apt-get install -y build-essential clang libdbus-1-dev libgtk-3-dev \
                           libnotify-dev libasound2-dev libcap-dev bluetooth bluez libbluetooth-dev libudev-dev libusb-1.0-0-dev libcap2-bin \
                           libcups2-dev libxtst-dev \
                           libxss1 libnss3-dev curl \
                           gperf bison python3-dbusmock libc6-dev-arm64-cross linux-libc-dev-arm64-cross g++-aarch64-linux-gnu

# Create and set app directory
WORKDIR /usr/src/app

# Set environment variables for headless build
ENV DISPLAY=:99

# Run the Electron build command
CMD ["npm", "run", "build"]