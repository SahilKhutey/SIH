# config.py
# Central configuration settings for ORB sensor fusion system

# Cameras (cv2.VideoCapture index or v4l2 paths)
CAM0 = 0  # USB camera (left)
CAM1 = 1  # CSI camera (right) or /dev/video2

# Radar GPIO pin (BCM)
RADAR_PIN = 17

# Optional PIR sensor pin (set to None if not used)
PIR_PIN = None

# HB-100 SPI configuration (MCP3008 ADC)
SPI_BUS = 0
SPI_DEVICE = 0
HB100_ADC_CHANNEL = 0

# Buzzer pin (BCM) or None to disable buzzer
BUZZER_PIN = 27

# YOLO model (ONNX) - place your exported onnx model here
YOLO_ONNX_PATH = "models/best.onnx"

# Class names in same order as model classes
CLASS_NAMES = ["person", "gun", "knife", "other_weapon"]

# Detection thresholds
IMG_SIZE = 640
CONF_THRESH = 0.35
IOU_THRESH = 0.45

# Blueprint Hardware Thresholds
HB100_THRESHOLD = 500  # Doppler shift ADC threshold (0-1023)
THERMAL_TEMP_THRESHOLD = 35.0  # Hotspot trigger temperature in Celsius

# Telegram config (create bot via BotFather)
TELEGRAM_TOKEN = "YOUR_TELEGRAM_BOT_TOKEN"
TELEGRAM_CHAT_ID = "YOUR_CHAT_ID"

# Dashboard settings
FLASK_HOST = "0.0.0.0"
FLASK_PORT = 5000

# Logging file
LOG_CSV = "detections_log.csv"

# Thermal sensor enable (True/False). If True, script will try to init MLX90640/AMG8833
THERMAL_ENABLED = True

# Fusion behavior
YOLO_ON_RADAR_ONLY = True  # If True, YOLO runs only when radar or PIR triggers
RADAR_POST_TRIGGER_SECONDS = 8  # Keep YOLO active for N seconds after last motion

# FPS settings
INFER_FPS_LIMIT = 5  # Max inference runs per second to reduce CPU
