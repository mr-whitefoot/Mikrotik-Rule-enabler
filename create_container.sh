#!/bin/bash     
docker buildx build --platform linux/arm/v7 -t mikrotik-route:latest --output type=docker .
docker save mikrotik-route:latest > mikrotik-route.tar 
scp mikrotik-route.tar admin@router.lan:/usb1/  