#!/bin/bash
while true
do
    echo "Starting Userbot..."
    node scripts/userbot.js
    echo "Userbot crashed with exit code $?. Respawning in 3 seconds..."
    sleep 3
done
