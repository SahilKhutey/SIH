#!/bin/bash
# run.sh
# Start the ORB sensor-fusion Flask-SocketIO backend server

echo "Starting ORB Sensor-Fusion Surveillance System..."
source server/venv/bin/activate
cd server || exit 1
python -u server.py
