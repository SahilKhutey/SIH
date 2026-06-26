# server.py
# Main Server Entry Point: Runs Async Video Acquisition, YOLO Object Detection, 
# Sensor Fusion Alerts, and broadcasts Flask-SocketIO Telemetry

import time
import threading
import json
import random
import os
import cv2
import numpy as np
from flask import Flask, Response, jsonify, send_from_directory
from flask_socketio import SocketIO

# Import configuration and modules
from config import *
from utils.camera_thread import CameraThread
from utils.yolo_infer import YOLOOnnx
from utils.thermal import ThermalReader, overlay_thermal
from utils.notifier import Notifier
from utils.logger import CSVLogger
from sensors.radar_gpio import PIRSensor
from sensors.hb100_adc import HB100ADC

# Initialize Flask and SocketIO
# Supports serving the React bundle in production (Client/dist)
app = Flask(__name__, static_folder='../Client/dist', static_url_path='/')
socketio = SocketIO(app, cors_allowed_origins="*")

# State sharing dictionary across threads
shared = {
    "frame": None,
    "thermal_overlay": None,
    "last_motion_ts": 0,
    "radar_active": False,
    "pir_active": False,
    "detections": [],
    "hb100_val": 0,
    "max_temp": 24.0,
    "yolo_human_detected": False,
    "threat_level": 0
}

# Instantiate hardware and inference modules
logger = CSVLogger(LOG_CSV)
notifier = Notifier(TELEGRAM_TOKEN, TELEGRAM_CHAT_ID, buzzer_pin=BUZZER_PIN)
hb100 = HB100ADC(SPI_BUS, SPI_DEVICE, HB100_ADC_CHANNEL)
pir = PIRSensor(PIR_PIN)
thermal_reader = ThermalReader(enabled=THERMAL_ENABLED)

# Instantiate YOLOv8 model inference engine
# Uses models/best.onnx (falls back to simulation if missing)
yolo = YOLOOnnx(YOLO_ONNX_PATH, img_size=IMG_SIZE, conf_thresh=CONF_THRESH, iou_thresh=IOU_THRESH)

# Initialize asynchronous camera threads
cam0 = CameraThread(CAM0, name="cam0")
cam1 = CameraThread(CAM1, name="cam1")

# Global lock for frame composite operations
frame_lock = threading.Lock()

def hstack_frames(f0, f1):
    """Stacks two frames side-by-side, resizing height of second to match first if they differ."""
    h0, w0 = f0.shape[:2]
    h1, w1 = f1.shape[:2]
    if h0 != h1:
        new_w1 = int(w1 * (h0 / h1))
        f1_resized = cv2.resize(f1, (new_w1, h0))
        return np.hstack((f0, f1_resized))
    return np.hstack((f0, f1))

# ----------------- SENSOR FUSION LOOP -----------------

def fusion_loop():
    """Main background loop combining video frames, running inference on active triggers,
    and rendering overlays to be streamed by Flask."""
    last_infer_time = 0
    print("[Fusion Loop] Active and running.")
    
    while True:
        try:
            # 1. Read motion indicators
            hb_val = hb100.read_raw()
            shared["hb100_val"] = hb_val
            radar_active = hb_val > HB100_THRESHOLD
            pir_active = pir.is_active() if pir else False
            
            shared["radar_active"] = radar_active
            shared["pir_active"] = pir_active
            
            # Determine if we should activate object detection
            now = time.time()
            motion_present = radar_active or pir_active
            
            if motion_present:
                shared["last_motion_ts"] = now
                
            # YOLO runs if:
            # - YOLO_ON_RADAR_ONLY is disabled
            # - Motion is currently active
            # - We are within the cooldown window after last motion
            do_yolo = (not YOLO_ON_RADAR_ONLY) or motion_present or (now - shared["last_motion_ts"] < RADAR_POST_TRIGGER_SECONDS)
            
            # 2. Acquire latest camera frames
            f0 = cam0.read()
            f1 = cam1.read()
            
            if f0 is None and f1 is None:
                # No video frames captured yet, wait shortly
                time.sleep(0.02)
                continue
                
            # Select display baseline frame
            display_frame = None
            if f0 is not None and f1 is not None:
                display_frame = hstack_frames(f0, f1)
            elif f0 is not None:
                display_frame = f0
            else:
                display_frame = f1
                
            # 3. Read thermal overlay frame
            thermal_frame = None
            max_temp = 24.0
            if THERMAL_ENABLED:
                try:
                    thermal_frame = thermal_reader.get_frame()
                    shared["thermal_overlay"] = thermal_frame
                    
                    thermal_matrix = thermal_reader.get_matrix()
                    max_temp = float(np.max(thermal_matrix))
                except Exception as e:
                    print(f"[Thermal Overlay] Error getting frame: {e}")
            shared["max_temp"] = max_temp
                    
            # 4. Perform YOLO Detection
            active_detections = []
            
            if do_yolo:
                # Throttle inference FPS to reduce Pi CPU usage
                if now - last_infer_time >= (1.0 / INFER_FPS_LIMIT):
                    last_infer_time = now
                    
                    # Run inference on Cam0
                    if f0 is not None:
                        det0 = yolo.infer(f0)
                        for d in det0:
                            x1, y1, x2, y2, conf, cls_id = d
                            label = CLASS_NAMES[cls_id]
                            active_detections.append({
                                "cam": "cam0", "class": label, "conf": conf, "bbox": [x1, y1, x2, y2]
                            })
                            
                            # Draw box on f0
                            cv2.rectangle(f0, (int(x1), int(y1)), (int(x2), int(y2)), (0, 255, 0), 2)
                            cv2.putText(f0, f"{label} {conf:.2f}", (int(x1), int(y1) - 6),
                                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
                                        
                            # Log and alert on weapon classes
                            if label in ["gun", "knife", "other_weapon"]:
                                logger.log_detection("cam0", "threat", label, conf, [x1, y1, x2, y2], "weapon_detected")
                                # Send Telegram alert (photo with caption)
                                _, jpg_bytes = cv2.imencode('.jpg', f0)
                                socketio.start_background_task(
                                    notifier.send_telegram_photo, 
                                    jpg_bytes.tobytes(), 
                                    caption=f"⚠️ THREAT WEAPON DETECTED on Cam0: {label.upper()} ({conf*100:.1f}%)"
                                )
                                # Trigger physical buzzer warning
                                socketio.start_background_task(notifier.buzz_alert)
                                
                    # Run inference on Cam1
                    if f1 is not None:
                        det1 = yolo.infer(f1)
                        for d in det1:
                            x1, y1, x2, y2, conf, cls_id = d
                            label = CLASS_NAMES[cls_id]
                            active_detections.append({
                                "cam": "cam1", "class": label, "conf": conf, "bbox": [x1, y1, x2, y2]
                            })
                            
                            # Draw box on f1
                            cv2.rectangle(f1, (int(x1), int(y1)), (int(x2), int(y2)), (0, 255, 0), 2)
                            cv2.putText(f1, f"{label} {conf:.2f}", (int(x1), int(y1) - 6),
                                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
                                        
                            # Log and alert on weapon classes
                            if label in ["gun", "knife", "other_weapon"]:
                                logger.log_detection("cam1", "threat", label, conf, [x1, y1, x2, y2], "weapon_detected")
                                # Send Telegram alert
                                _, jpg_bytes = cv2.imencode('.jpg', f1)
                                socketio.start_background_task(
                                    notifier.send_telegram_photo, 
                                    jpg_bytes.tobytes(), 
                                    caption=f"⚠️ THREAT WEAPON DETECTED on Cam1: {label.upper()} ({conf*100:.1f}%)"
                                )
                                # Trigger physical buzzer warning
                                socketio.start_background_task(notifier.buzz_alert)

                    # Update local state list of active detections
                    shared["detections"] = active_detections

            # Calculate Threat Level Score
            yolo_human_detected = any(d["class"] == "person" for d in shared["detections"])
            shared["yolo_human_detected"] = yolo_human_detected
            
            score = 0
            if shared["hb100_val"] > HB100_THRESHOLD:
                score += 25
            if shared["pir_active"]:
                score += 25
            if shared["max_temp"] > THERMAL_TEMP_THRESHOLD:
                score += 25
            if shared["yolo_human_detected"]:
                score += 25
                
            shared["threat_level"] = score
            
            # 5. Composite combined frame for streaming
            # Combine side-by-side again now that boxes have been drawn
            if f0 is not None and f1 is not None:
                display_frame = hstack_frames(f0, f1)
            elif f0 is not None:
                display_frame = f0
            else:
                display_frame = f1
                
            # Apply thermal overlay blending if frame exists
            if thermal_frame is not None:
                display_frame = overlay_thermal(display_frame, thermal_frame, alpha=0.45)
                
            # Scale frame for optimized browser streaming (max width 960px)
            orig_h, orig_w = display_frame.shape[:2]
            target_w = 960
            target_h = int(orig_h * (target_w / orig_w))
            display_frame = cv2.resize(display_frame, (target_w, target_h))
            
            # Save frame securely using thread-lock
            with frame_lock:
                shared["frame"] = display_frame

        except Exception as e:
            print(f"[Fusion Loop] Runtime exception: {e}")
            
        time.sleep(0.03)  # Maintain loop ~30Hz

# ----------------- TELEMETRY SERVER THREAD -----------------

def telemetry_loop():
    """Background thread emitting sensor telemetry via SocketIO every second.
    Broadcasts radar polar coordinates, thermal arrays, and warnings."""
    print("[Telemetry Node] Active and emitting.")
    radar_counter = 0
    
    while True:
        try:
            # 1. Radar Telemetry
            radar_active = shared["radar_active"]
            
            if radar_active:
                # Trigger target movement trajectory
                radar_counter += 1
                angle = int(180 + 90 * np.sin(radar_counter * 0.1) + random.randint(-5, 5)) % 360
                distance = round(2.5 + 1.8 * np.cos(radar_counter * 0.05) + random.uniform(-0.1, 0.1), 2)
                strength = round(0.7 + 0.25 * np.cos(radar_counter * 0.2), 2)
            else:
                # Idle state
                angle = 0
                distance = 0.0
                strength = 0.0
                
            radar_data = {
                "angle": angle,
                "distance_m": distance,
                "strength": strength,
                "ts": time.time(),
                "motion": radar_active
            }
            socketio.emit('telemetry', {"type": "radar", "payload": radar_data})
            
            # 2. Thermal Telemetry (2D matrix data)
            thermal_matrix = thermal_reader.get_matrix()
            socketio.emit('telemetry', {"type": "thermal", "payload": thermal_matrix})
            
            # 3. Unified Sensor Data (Threat Level bar sync)
            socketio.emit('sensor_data', {
                'hb100': int(shared["hb100_val"]),
                'pir': int(shared["pir_active"]),
                'thermal': int(shared["max_temp"]),
                'camera': int(shared["yolo_human_detected"]),
                'threat': int(shared["threat_level"])
            })
            
            # 3. Dynamic Alerts Warning Emitting
            alerts = []
            for det in shared["detections"]:
                if det["class"] in ["gun", "knife", "other_weapon"]:
                    alerts.append({
                        "level": "danger",
                        "msg": f"WEAPON THREAT DETECTED: {det['class'].upper()} ({det['conf']*100:.0f}%)",
                        "ts": time.time()
                    })
                    
            if len(alerts) == 0 and (radar_active or shared["pir_active"]):
                alerts.append({
                    "level": "warning", 
                    "msg": "Unverified Motion Detected", 
                    "ts": time.time()
                })
                
            for alert in alerts:
                socketio.emit('telemetry', {"type": "alert", "payload": alert})
                
        except Exception as e:
            print(f"[Telemetry Node] Broadcasting error: {e}")
            
        socketio.sleep(0.25)

# ----------------- FLASK ENDPOINTS -----------------

def generate_video():
    """Generates continuous MJPEG stream boundary blocks from the shared frame buffer."""
    while True:
        with frame_lock:
            frame = shared.get("frame", None)
            
        if frame is None:
            # Serve dark empty screen if camera frames are initializing
            frame = np.zeros((360, 640, 3), dtype=np.uint8)
            cv2.putText(frame, "INITIALIZING ORB CAMERAS...", (100, 180),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (120, 120, 120), 2)
                        
        ret, buf = cv2.imencode('.jpg', frame, [int(cv2.IMWRITE_JPEG_QUALITY), 75])
        if not ret:
            time.sleep(0.04)
            continue
            
        b = buf.tobytes()
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + b + b'\r\n')
        time.sleep(0.04)  # ~25 FPS stream

def generate_thermal_only():
    """Generates continuous MJPEG stream of the standalone thermal heatmap camera."""
    while True:
        heatmap = None
        if THERMAL_ENABLED:
            with frame_lock:
                heatmap = shared.get("thermal_overlay", None)
                
        if heatmap is None:
            heatmap = np.zeros((240, 320, 3), dtype=np.uint8)
            cv2.putText(heatmap, "THERMAL DATA CALIBRATING", (20, 120),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (120, 120, 120), 1)
                        
        ret, buf = cv2.imencode('.jpg', heatmap, [int(cv2.IMWRITE_JPEG_QUALITY), 75])
        if not ret:
            time.sleep(0.15)
            continue
            
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + buf.tobytes() + b'\r\n')
        time.sleep(0.15)  # Thermal sensor updates are typically slower

@app.route('/video_feed')
@app.route('/video')
def video_feed():
    """MJPEG visible stream endpoint."""
    return Response(generate_video(), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/thermal_feed')
@app.route('/thermal')
def thermal_feed():
    """MJPEG thermal stream endpoint."""
    return Response(generate_thermal_only(), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/api/system')
def api_system():
    """System health status checking endpoint."""
    radar_active = shared["radar_active"]
    pir_active = shared["pir_active"]
    
    info = {
        "battery": "100%",
        "uptime": round(time.time()),
        "signal": "excellent",
        "sensors": {
            "radar": "simulated" if radar.simulated else "ok",
            "pir": "disabled" if PIR_PIN is None else ("simulated" if pir.simulated else "ok"),
            "thermal": "disabled" if not THERMAL_ENABLED else ("simulated" if thermal_reader.device is None else "ok"),
            "camera": "ok"
        },
        "warnings": []
    }
    
    if radar_active or pir_active:
        info["warnings"].append("Active motion warning")
    if len(shared["detections"]) > 0:
        info["warnings"].append(f"Objects detected: {len(shared['detections'])}")
        
    return jsonify(info)

@app.route('/api/snapshot')
def api_snapshot():
    """Captures a single snapshot image from the main display buffer."""
    with frame_lock:
        frame = shared.get("frame", None)
        
    if frame is None:
        return jsonify({"error": "System is booting; frame buffer empty."}), 503
        
    _, jpg = cv2.imencode('.jpg', frame)
    return Response(jpg.tobytes(), mimetype='image/jpeg')

@app.route('/api/logs')
def api_logs():
    """Reads detections_log.csv and returns the last 50 entries as JSON."""
    import csv
    if not os.path.exists(LOG_CSV):
        return jsonify([])
    
    logs = []
    try:
        with open(LOG_CSV, mode='r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                logs.append(row)
        logs.reverse()
        return jsonify(logs[:50])
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/logs/download')
def api_logs_download():
    """Serves detections_log.csv as a downloadable file attachment."""
    from flask import send_file
    if not os.path.exists(LOG_CSV):
        return jsonify({"error": "No log file has been created yet."}), 404
    try:
        return send_file(
            os.path.abspath(LOG_CSV),
            mimetype='text/csv',
            as_attachment=True,
            download_name='orb_detections_log.csv'
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_frontend(path):
    """Fallback route serving compiled index.html pages from dist."""
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, 'index.html')

@socketio.on('connect')
def handle_connect():
    print('[SocketIO] Dashboard client connected.')
    socketio.emit('telemetry', {"type": "info", "payload": "Connected to ORB fusion telemetry engine."})

# ----------------- RUN SERVER -----------------

if __name__ == '__main__':
    # Create empty models folder if not present
    if not os.path.exists("models"):
        os.makedirs("models")
        print("[Server] Created empty 'models' folder. Place your 'best.onnx' file inside.")
        
    # Start video capture threads
    cam0.start()
    cam1.start()
    
    # Start background execution threads
    fusion_thread = threading.Thread(target=fusion_loop, daemon=True)
    fusion_thread.start()
    
    # Start SocketIO background telemetry loop
    socketio.start_background_task(telemetry_loop)
    
    # Start Flask Server
    print(f"[Server] Starting Flask-SocketIO server on http://{FLASK_HOST}:{FLASK_PORT}")
    socketio.run(app, host=FLASK_HOST, port=FLASK_PORT)
