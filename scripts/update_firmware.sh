#!/bin/sh
echo "updating firmware"

sudo apt-get update
sudo apt-get full-upgrade --yes

sudu reboot