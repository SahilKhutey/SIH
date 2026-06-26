# 🛡️ ORB — Omni-Reconnaissance Bot | Smart India Hackathon (SIH)

<p align="center">
  <b>Production-Grade Multi-Sensor Smart Surveillance System</b><br>
  <i>SIH Problem Statement 25196 — Real-Time Threat Detection & Tactical Response</i>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Raspberry_Pi_4-C51A4A?style=for-the-badge&logo=raspberrypi&logoColor=white" alt="Raspberry Pi 4">
  <img src="https://img.shields.io/badge/AI-YOLOv8-00FFFF?style=for-the-badge&logo=pytorch&logoColor=white" alt="YOLOv8">
  <img src="https://img.shields.io/badge/Frontend-React_+_Vite-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React + Vite">
  <img src="https://img.shields.io/badge/Backend-Flask_SocketIO-000000?style=for-the-badge&logo=flask&logoColor=white" alt="Flask">
  <img src="https://img.shields.io/badge/Vision-OpenCV-5C3EE8?style=for-the-badge&logo=opencv&logoColor=white" alt="OpenCV">
</p>

---

## 📋 Overview

**ORB** is a professional, production-grade smart surveillance system built for the **Smart India Hackathon (SIH)**. It runs on a **Raspberry Pi 4** and integrates multiple sensor modalities into a unified threat detection and response pipeline with a real-time tactical HUD dashboard.

### Core Capabilities

| Capability | Technology | Description |
|:---|:---|:---|
| 🎥 **Dual Video Streams** | OpenCV (CSI + USB) | Multithreaded dual-camera frame acquisition |
| 🧠 **AI Object Detection** | YOLOv8 ONNX | Real-time human, gun, & knife classification |
| 🌡️ **Thermal Imaging** | MLX90640 / AMG8833 (I2C) | 2D thermal radiometry with heatmap overlays |
| 📡 **Doppler Radar** | HB-100 via MCP3008 SPI ADC | Microwave motion detection & frequency shift tracking |
| 🔔 **Alert System** | Telegram API + GPIO Buzzer | Instant photo alerts with weapon threat notifications |
| 📊 **Tactical Dashboard** | React + Vite + Socket.IO | Live HUD with threat scores, radar sweep, thermal view |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        ORB SURVEILLANCE SYSTEM                  │
├──────────────────────┬──────────────────────────────────────────┤
│                      │                                          │
│   SENSOR LAYER       │   PROCESSING ENGINE                      │
│                      │                                          │
│  ┌───────────────┐   │   ┌──────────────────────────────────┐   │
│  │ CSI Camera    │───┼──▶│  Fusion Loop (~30 Hz)            │   │
│  │ USB Camera    │───┼──▶│  ├─ Frame Acquisition            │   │
│  │ HB-100 Radar  │───┼──▶│  ├─ YOLOv8 Inference             │   │
│  │ MLX90640/AMG  │───┼──▶│  ├─ Thermal Overlay Blending     │   │
│  │ PIR Sensor    │───┼──▶│  ├─ Threat Level Scoring          │   │
│  │ GPIO Buzzer   │◀──┼───│  └─ Alert Dispatch               │   │
│  └───────────────┘   │   └──────────────────────────────────┘   │
│                      │              │                            │
│                      │              ▼                            │
│                      │   ┌──────────────────────────────────┐   │
│                      │   │  Flask-SocketIO Server            │   │
│                      │   │  ├─ /video_feed (MJPEG)           │   │
│                      │   │  ├─ /thermal_feed (MJPEG)         │   │
│                      │   │  ├─ /api/system (Health)          │   │
│                      │   │  ├─ /api/snapshot (JPEG)          │   │
│                      │   │  ├─ /api/logs (CSV JSON)          │   │
│                      │   │  └─ WebSocket Telemetry           │   │
│                      │   └──────────────┬───────────────────┘   │
│                      │                  │                        │
│                      │                  ▼                        │
│                      │   ┌──────────────────────────────────┐   │
│                      │   │  React Tactical HUD Dashboard     │   │
│                      │   │  ├─ VideoOnly  (Main Feed + HUD)  │   │
│                      │   │  ├─ Microwave  (Radar Sweep)      │   │
│                      │   │  ├─ Thermal    (Heatmap View)     │   │
│                      │   │  ├─ Overlay    (Fused Crosshairs) │   │
│                      │   │  └─ SystemInfo (Health Panel)     │   │
│                      │   └──────────────────────────────────┘   │
└──────────────────────┴──────────────────────────────────────────┘
```

---

## 🛡️ Fused Threat Scoring Model

The system calculates a **Threat Level Score (0–100)** using weighted contributions from four sensor subsystems:

| Subsystem | Trigger Condition | Weight |
|:---|:---|:---|
| **Doppler Radar (HB-100)** | ADC frequency shift > 500 | **25%** |
| **PIR Presence Sensor** | GPIO HIGH detected | **25%** |
| **Thermal Heatmap** | Max pixel temp > 35°C | **25%** |
| **Vision AI (YOLOv8)** | Person class detected | **25%** |

### Threat Levels

| Level | Range | Response |
|:---|:---|:---|
| 🟢 **Low** | 0–25% | Visual scanning active |
| 🟡 **Moderate** | 26–50% | Motion or presence detected, auto-wakes YOLO |
| 🟠 **High** | 51–75% | Fused motion + body heat verified, pulsing alarms |
| 🔴 **Critical** | 76–100% | YOLO target confirmed, Telegram alert + GPIO buzzer |

---

## 📂 Project Structure

```
SIH/
├── README.md                                    # This file
├── .gitignore                                   # Git exclusions
│
├── ORB/                                         # ═══ MAIN APPLICATION ═══
│   ├── setup.sh                                 # One-click system dependency installer
│   ├── run.sh                                   # Launcher script (virtualenv)
│   ├── logs.sh                                  # Log viewing utility
│   ├── orb.service                              # Systemd service for auto-start
│   ├── README.md                                # Deployment & hardware wiring guide
│   │
│   ├── Client/                                  # ─── React Frontend Dashboard ───
│   │   ├── index.html                           # Entry HTML
│   │   ├── package.json                         # Dependencies (React, Socket.IO)
│   │   ├── vite.config.js                       # Vite dev server config
│   │   └── src/
│   │       ├── App.jsx                          # Root component with routing
│   │       ├── main.jsx                         # React entry point
│   │       ├── socket.js                        # Socket.IO connection manager
│   │       ├── styles.css                       # Tactical HUD styles
│   │       └── pages/
│   │           ├── VideoOnly.jsx                # Main HUD — threat scores & alerts
│   │           ├── Microwave.jsx                # Sonar sweep & Doppler graph
│   │           ├── Thermal.jsx                  # Heatmap viewer & temp metrics
│   │           ├── Overlay.jsx                  # Camera + thermal crosshairs
│   │           └── SystemInfo.jsx               # System health checklist
│   │
│   └── server/                                  # ─── Python Backend Engine ───
│       ├── server.py                            # Main: fusion loop, API, streaming
│       ├── config.py                            # Thresholds, GPIO pins, API keys
│       ├── detections_log.csv                   # Detection event log
│       ├── models/                              # YOLOv8 ONNX weights (best.onnx)
│       ├── sensors/
│       │   ├── hb100_adc.py                     # HB-100 Doppler radar via SPI ADC
│       │   └── radar_gpio.py                    # PIR digital input wrapper
│       └── utils/
│           ├── camera_thread.py                 # Multithreaded OpenCV frame grabber
│           ├── yolo_infer.py                    # YOLOv8 ONNX inference engine
│           ├── thermal.py                       # I2C thermal grid upsampler
│           ├── notifier.py                      # Telegram alerts + GPIO buzzer
│           └── logger.py                        # Thread-safe CSV log writer
│
├── SIH/                                         # ═══ PROJECT ASSETS ═══
│   ├── CODE/                                    # Standalone component source files
│   │   ├── App.js, Thermal.js, Microwave.js     # React components
│   │   ├── Overlay.js, VideoOnly.js             # Dashboard views
│   ├── LAYOUT/                                  # UI layout reference images
│   ├── BILLS/                                   # Procurement invoices
│   ├── ORB/                                     # Alternate ORB code snapshots
│   ├── New folder/                              # BOM, consent forms, docs
│   ├── RCWL Sensor YOLO fusion.ipynb            # Sensor fusion Jupyter notebook
│   └── *.pdf                                    # Presentations & documentation
│
├── AMG 8833 Thermal sensors.pdf                 # AMG8833 setup guide
├── MLX90640 thermal sensors.pdf                 # MLX90640 setup guide
├── HB-100 Connections.pdf                       # Doppler radar wiring guide
├── Dashboard setup.pdf                          # Dashboard configuration guide
├── Pi , RCWL , Fusion Code setup FOR ORB.pdf    # Pi + RCWL + fusion code guide
├── Setup FILE.pdf                               # General setup instructions
├── Survelliance SIH 25196.pdf                   # Problem statement document
├── Survelliance SIH Final Design.pptx           # Final presentation deck
└── ORB.pdf                                      # ORB system documentation
```

---

## 🛠️ Hardware Requirements

| Component | Model | Interface | Purpose |
|:---|:---|:---|:---|
| **SBC** | Raspberry Pi 4 (4GB+) | — | Main compute unit |
| **Camera 1** | CSI Camera Module | CSI ribbon | Primary video feed |
| **Camera 2** | USB Webcam | USB 2.0/3.0 | Secondary video feed |
| **Thermal Sensor** | MLX90640 or AMG8833 | I2C (SDA/SCL) | Temperature heatmap |
| **Doppler Radar** | HB-100 | Analog → MCP3008 SPI | Motion detection |
| **ADC** | MCP3008 | SPI (SCLK/MOSI/MISO/CE0) | Analog-to-digital conversion |
| **PIR Sensor** | HC-SR501 (optional) | GPIO | Presence detection |
| **Buzzer** | Active Buzzer | GPIO27 | Audible threat alarm |

### Wiring Summary

```
HB-100 → MCP3008 CH0 → Pi SPI (GPIO 8,9,10,11)
MLX90640/AMG8833 → Pi I2C (GPIO 2,3)
PIR → Pi GPIO (configurable in config.py)
Buzzer → Pi GPIO27
```

> Detailed pin-by-pin wiring diagrams are in `ORB/README.md` and `HB-100 Connections.pdf`.

---

## ⚡ Quick Start

### 1. Enable Hardware Interfaces
```bash
sudo raspi-config
# → Interface Options → Enable I2C and SPI
sudo reboot
```

### 2. Install Dependencies
```bash
cd ORB
chmod +x setup.sh run.sh
./setup.sh
```

### 3. Deploy YOLO Model
Train/export your YOLOv8 model (detecting `person`, `gun`, `knife`) to ONNX format:
```bash
# Place as: ORB/server/models/best.onnx
```

### 4. Configure Alerts
Edit `ORB/server/config.py`:
```python
TELEGRAM_TOKEN = "YOUR_BOT_TOKEN"
TELEGRAM_CHAT_ID = "YOUR_CHAT_ID"
HB100_THRESHOLD = 500
THERMAL_TEMP_THRESHOLD = 35.0
```

### 5. Launch
```bash
./run.sh
# Access dashboard at http://<PI_IP>:5000
```

---

## 🌐 API Endpoints

| Method | Endpoint | Description |
|:---|:---|:---|
| `GET` | `/video_feed` | MJPEG live video stream (dual camera + overlays) |
| `GET` | `/thermal_feed` | MJPEG standalone thermal heatmap stream |
| `GET` | `/api/system` | System health & sensor status JSON |
| `GET` | `/api/snapshot` | Single JPEG frame capture |
| `GET` | `/api/logs` | Last 50 detection events (JSON) |
| `GET` | `/api/logs/download` | Download full detection CSV log |
| `WS` | `telemetry` | Real-time sensor telemetry (radar, thermal, alerts) |
| `WS` | `sensor_data` | Fused threat level broadcast |

---

## 🧪 Tech Stack

| Layer | Technologies |
|:---|:---|
| **AI/ML** | YOLOv8, ONNX Runtime, OpenCV, NumPy |
| **Backend** | Python 3, Flask, Flask-SocketIO, Threading |
| **Frontend** | React 18, Vite, Socket.IO Client |
| **Hardware** | Raspberry Pi 4, SPI (MCP3008), I2C (MLX90640/AMG8833), GPIO |
| **Alerts** | Telegram Bot API, GPIO Active Buzzer |
| **Deployment** | Bash scripts, systemd service, virtualenv |

---

## 👥 Team

**SIH Problem Statement**: 25196 — Advanced Surveillance System  
**Hackathon**: Smart India Hackathon (SIH)

---

## 📄 License

This project was developed as part of the Smart India Hackathon. All rights reserved.
