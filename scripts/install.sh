#!/bin/bash

# Download upgrades
sudo apt-get update
sudo apt-get full-upgrade --yes

# Download necessary packages
sudo apt-get -y install --yes libgles2-mesa libgles2-mesa-dev xorg-dev unclutter sed openbox

# Increase gpu-ram to 256
sudo raspi-config nonint do_memory_split 256

wget https://github.com/favo/electron-player/releases/latest/download/pintomind-player.AppImage
chmod +x /home/pi/pintomind-player.AppImage

# Create kiosk service script
cat << EOS > /home/pi/kiosk.service
[Unit]
Description=PinToMind Player
Wants=graphical.target
After=graphical.target

[Service]
Environment=DISPLAY=:0.0
Environment=XAUTHORITY=/home/pi/.Xauthority
Type=simple
ExecStart=/home/pi/pintomind-player.AppImage
Restart=always
User=pi
Group=pi

[Install]
WantedBy=graphical.target
EOS

# Create simple lxde autostart script
cat << EOS > /home/pi/boot-lxde.sh
#!/bin/sh
export DISPLAY=:0.0

xset s off
xset -dpms
xset s noblank
/home/pi/resolution.sh
unclutter -idle 0.5 -root &
EOS

# Create resolution script
cat << EOS > /home/pi/resolution.sh
#!/bin/bash

# Set resolution (Note: Raspberry PI struggle with resolution higher than full HD)
RESOLUTION=1920x1080

# Set orientation of monitor
# Possible values:
# "normal": Screen is not rotated
# "left": Screen is rotated to left
# "right": Screen is rotated to right
# "inverted": Screen is rotated upside down
ORIENTATION=normal

xrandr --output HDMI-1 --mode "\$RESOLUTION"

if [[ "\$ORIENTATION" != "normal" ]]; then
  xrandr --orientation \$ORIENTATION
fi

EOS

chmod +x /home/pi/resolution.sh
chmod +x /home/pi/boot-lxde.sh

mkdir -p /home/pi/.config/lxsession/LXDE
mkdir -p /home/pi/.config/lxsession/LXDE-pi

# Create autostart script
cat << EOS > /home/pi/.config/lxsession/LXDE/autostart
@/home/pi/boot-lxde.sh
EOS

cp /home/pi/.config/lxsession/LXDE/autostart /home/pi/.config/lxsession/LXDE-pi/autostart

sudo ln -sf /home/pi/kiosk.service /lib/systemd/system

# Enable script
sudo systemctl enable kiosk.service

sudo reboot