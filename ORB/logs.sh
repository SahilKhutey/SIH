#!/bin/bash
# logs.sh
# Helper script to view live journalctl logs for the ORB systemd service daemon

echo "=========================================================="
echo "    ORB SYSTEM DAEMON LOGS: Tailing 'orb.service'"
echo "    Press Ctrl+C to exit log view."
echo "=========================================================="

sudo journalctl -u orb.service -f -n 100
