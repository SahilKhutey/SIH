# ORB (OmniReconnaissance Bot) Smart Surveillance System

A professional, production-grade smart surveillance system designed to run on a Raspberry Pi 4. It integrates multithreaded dual-feed video streams (CSI + USB), YOLOv8 object and weapon classification (human, gun, knife), 2D I2C thermal radiometry overlays (MLX90640 or AMG8833), and Doppler Microwave Radar tracking (HB-100 Doppler shift via MCP3008 SPI ADC). 

It features a 0-100 weighted Threat Level Scoring model and streams live telemetry to a tactical dark-themed HUD dashboard.

---

## 🛠️ Hardware Connection Blueprint

Ensure the Raspberry Pi 4 is powered off before connecting sensors. Align connections with the BCM GPIO pin configurations:

### 1. HB-100 Doppler Radar via MCP3008 SPI ADC
* **Doppler Radar Connections**:
  * HB-100 `Vcc` &rarr; Pi **5V** (Pin 2 or 4)
  * HB-100 `GND` &rarr; Pi **GND** (Pin 6, 9, etc.)
  * HB-100 `IF / OUT` (analog shift) &rarr; MCP3008 **CH0** (Pin 1)
* **ADC Chip Connections (SPI)**:
  * MCP3008 `VDD` &rarr; Pi **3.3V** (Pin 1 or 17)
  * MCP3008 `VREF` &rarr; Pi **3.3V** (Pin 1 or 17)
  * MCP3008 `AGND` &rarr; Pi **GND** (Pin 9)
  * MCP3008 `DGND` &rarr; Pi **GND** (Pin 9)
  * MCP3008 `CLK` &rarr; Pi **SCLK** (GPIO11 / Pin 23)
  * MCP3008 `DOUT` &rarr; Pi **MISO** (GPIO9 / Pin 21)
  * MCP3008 `DIN` &rarr; Pi **MOSI** (GPIO10 / Pin 19)
  * MCP3008 `CS` &rarr; Pi **CE0** (GPIO8 / Pin 24)

### 2. Thermal Camera via I2C (MLX90640 / AMG8833)
* `VDD` / `VIN` &rarr; Pi **3.3V** (Pin 1) or **5V** (Pin 2)
* `GND` &rarr; Pi **GND** (Pin 6)
* `SDA` &rarr; Pi **SDA** (GPIO2 / Pin 3)
* `SCL` &rarr; Pi **SCL** (GPIO3 / Pin 5)

### 3. PIR Presence Sensor
* `Vcc` &rarr; Pi **5V** or **3.3V**
* `GND` &rarr; Pi **GND**
* `OUT` (digital presence) &rarr; Pi **None** (Configured as `PIR_PIN = None` by default in `config.py`; assign a BCM GPIO pin if connected).

### 4. Active Warning Buzzer
* Terminal `+` (positive) &rarr; Pi **GPIO27** (Pin 13)
* Terminal `-` (ground) &rarr; Pi **GND** (Pin 14)

---

## 📂 Project Directory Structure

```text
ORB/
├── setup.sh                 # One-click system dependency installer & compiler
├── run.sh                   # Launcher script inside python virtualenv
├── README.md                # Deployment documentation
├── server/                  # Python Flask-SocketIO backend engine
│   ├── server.py            # Main runner, fusion loop, and API endpoints
│   ├── config.py            # Central thresholds and hardware pins config
│   ├── sensors/
│   │   ├── __init__.py
│   │   ├── hb100_adc.py     # Doppler shift raw reading interface (SPI)
│   │   └── radar_gpio.py    # PIR digital input wrapper
│   └── utils/
│       ├── __init__.py
│       ├── camera_thread.py # Multithreaded OpenCV camera frame grabber
│       ├── yolo_infer.py    # YOLOv8 ONNX inference engine
│       ├── thermal.py       # I2C temperature grid upsampler & overlay blender
│       ├── notifier.py      # Telegram API notifications & GPIO buzzer controls
│       └── logger.py        # Thread-safe CSV log writer
└── Client/                  # Vite + React frontend dashboard
    ├── src/
    │   ├── pages/
    │   │   ├── VideoOnly.jsx # Main HUD, threat scores, and alerts log
    │   │   ├── Microwave.jsx # Sonar scope sweep & scrolling Doppler line graph
    │   │   ├── Thermal.jsx   # Heatmap viewer and min/max metrics console
    │   │   ├── Overlay.jsx   # Camera feed with vector-mapped hotspot crosshairs
    │   │   └── SystemInfo.jsx# Health checklist
    │   ├── socket.js        # Socket.IO connection manager
    │   └── main.jsx
    ├── package.json
    └── vite.config.js
```

---

## ⚡ Deployment & Running Steps

Follow these steps to deploy and run the system on your Raspberry Pi 4:

### 1. Enable SPI & I2C Overlays
The hardware interfaces require kernel overlays. Enable them by opening the configuration tool:
```bash
sudo raspi-config
```
Navigate to **Interface Options**, select both **I2C** and **SPI**, enable them, and exit. Reboot the Pi to apply changes:
```bash
sudo reboot
```

### 2. Run the One-Click Installer
Exceute the installer script to automatically fetch system dependencies, configure GPIO groups, set up the python virtual environment, install python libraries, and build the React frontend:
```bash
cd ORB
chmod +x setup.sh run.sh
./setup.sh
```

### 3. Deploy YOLOv8 Model Weights
Compile or train your custom YOLOv8 model (detecting `person`, `gun`, `knife`) and export it to ONNX format. Name it `best.onnx` and place it inside the models folder:
```bash
# Path: ORB/server/models/best.onnx
```

### 4. Configure Notifications & Alert Thresholds
Open `server/config.py` to customize BCM GPIO pins, ADC thresholds, and Telegram bot keys:
```python
# server/config.py
TELEGRAM_TOKEN = "YOUR_BOT_TOKEN_FROM_BOTFATHER"
TELEGRAM_CHAT_ID = "YOUR_CHAT_ID"
HB100_THRESHOLD = 500  # Shift spikes trigger
THERMAL_TEMP_THRESHOLD = 35.0  # Hotspot trigger
```

### 5. Launch the Dashboard
Run the launcher script to start the Flask-SocketIO server:
```bash
./run.sh
```
Open a browser and navigate to `http://<PI_IP>:5000` to access the tactical HUD dashboard console.

---

## 🛡️ Fused Threat Scoring Model
The system calculates a Threat Level Score (0-100) based on weighted triggers from the four active subsystems:

| Subsystem Component | Trigger Condition | Weight |
|:---|:---|:---|
| **Doppler Radar (HB-100)** | Raw ADC frequency shift > 500 | **25%** |
| **PIR Presence Sensor** | GPIO state matches High | **25%** |
| **Thermal Heatmap (MLX90640)** | Max temp pixel > 35°C (hotspot threshold) | **25%** |
| **Vision AI (YOLOv8)** | Person class identified in either feed | **25%** |

* **Low Threat (0-25%)**: Safe environment. Visual scanning active.
* **Moderate Threat (26-50%)**: Motion or presence detected. Auto-wakes YOLO.
* **High Threat (51-75%)**: Fused motion and body heat verified. Pulsing alarms.
* **Critical Threat (76-100%)**: Multiple triggers active, including YOLO target confirmation. Dispatches Telegram notification with captured JPEG frames and sounds the GPIO buzzer.
