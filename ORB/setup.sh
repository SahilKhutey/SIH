#!/bin/bash
# setup.sh
# One-click automated setup script for deploying the ORB Sensor-Fusion system on a Raspberry Pi 4

echo "=========================================================="
echo "      ORB SYSTEM DEPLOYMENT: RASPBERRY PI 4 CONFIG"
echo "=========================================================="

# 1. Update system package repositories
echo "[1/6] Updating system package databases..."
sudo apt-get update -y

# 2. Install required system packages and dependencies
echo "[2/6] Installing hardware utilities, python-venv, and GStreamer dependencies..."
sudo apt-get install -y \
    python3-pip \
    python3-venv \
    libatlas-base-dev \
    libjpeg-dev \
    i2c-tools \
    python3-smbus \
    libcamera-apps \
    gstreamer1.0-plugins-base \
    gstreamer1.0-plugins-good \
    gstreamer1.0-plugins-bad \
    gstreamer1.0-plugins-ugly \
    git \
    nodejs \
    npm

# 3. Enable SPI and I2C interfaces
echo "[3/6] Configuring hardware buses (SPI and I2C) in boot files..."
if ! grep -q "dtparam=i2c_arm=on" /boot/config.txt; then
    echo "dtparam=i2c_arm=on" | sudo tee -a /boot/config.txt
fi
if ! grep -q "dtparam=spi=on" /boot/config.txt; then
    echo "dtparam=spi=on" | sudo tee -a /boot/config.txt
fi

# Add active user to the video/gpio groups
sudo usermod -a -G video $USER
sudo usermod -a -G gpio $USER
sudo usermod -a -G i2c $USER

# 4. Set up Python virtual environment
echo "[4/6] Creating Python virtual environment (venv) for server..."
cd server || exit 1
python3 -m venv venv
source venv/bin/activate

# Upgrade pip inside venv
pip install --upgrade pip

# Install python modules
echo "Installing required Python dependencies inside virtual env..."
pip install \
    opencv-python-headless \
    numpy \
    flask \
    flask-socketio \
    onnxruntime-headless \
    gpiozero \
    smbus2 \
    adafruit-circuitpython-mlx90640 \
    adafruit-circuitpython-amg88xx \
    requests \
    eventlet \
    spidev

cd ..

# 5. Build Vite React Client
echo "[5/6] Building React Client frontend dashboard..."
cd Client || exit 1
npm install
npm run build
cd ..

# 6. Verify Model Folder
echo "[6/6] Finalizing setup..."
if [ ! -d "server/models" ]; then
    mkdir -p server/models
fi

echo "=========================================================="
echo "SETUP COMPLETED SUCCESSFULLY!"
echo "Please place your 'best.onnx' model inside 'server/models/'."
echo "Enable SPI/I2C requires a system reboot. Restarting Pi is recommended."
echo "To run the server, execute: ./run.sh"
echo "=========================================================="
