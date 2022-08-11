#! /bin/sh

if grep -q "Pi 4" /proc/cpuinfo; then
  EXTRAOPTS="--disable-gpu"
fi

exec $SNAP/pintomind-player/pintomind-player \
	--enable-features=UseOzonePlatform \
	--ozone-platform=wayland \
	--disable-dev-shm-usage \
	--enable-wayland-ime \
	--no-sandbox $EXTRAOPTS
