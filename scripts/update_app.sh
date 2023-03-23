#!/bin/sh
echo "updating app"

wget -P $2 $1

sudo apt install $2 + "/pintomind-player.deb"
rm $2 + "/pintomind-player.deb"
sudo reboot