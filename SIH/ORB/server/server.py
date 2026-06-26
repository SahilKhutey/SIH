# server/server.py
# Flask + Flask-SocketIO server for MJPEG streams + telemetry
import time, threading, json
from flask import Flask, Response, jsonify, send_from_directory
from flask_socketio import SocketIO
import cv2
import numpy as np

app = Flask(__name__, static_folder='../client/dist', static_url_path='/')
socketio = SocketIO(app, cors_allowed_origins="*")  # allow all for local LAN

# ---------- VIDEO capture (visible camera) ----------
# Change camera index/path if needed.
cap = cv2.VideoCapture(0, cv2.CAP_V4L2)

def mjpeg_generator_from_capture(capture, resize_to=None, color_map=None):
    while True:
        ret, frame = capture.read()
        if not ret:
            # return a single black frame if camera fails
            h, w = (240, 320)
            frame = np.zeros((h, w, 3), dtype=np.uint8)
        if resize_to:
            frame = cv2.resize(frame, resize_to)
        if color_map is not None:
            frame = cv2.applyColorMap(frame, color_map)
        ret2, jpg = cv2.imencode('.jpg', frame, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
        if not ret2:
            continue
        b = jpg.tobytes()
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + b + b'\r\n')
        # small sleep to reduce CPU; adjust as needed
        time.sleep(0.04)

@app.route('/video_feed')
def video_feed():
    # main visible camera feed (MJPEG)
    return Response(mjpeg_generator_from_capture(cap, resize_to=(640,360)),
                    mimetype='multipart/x-mixed-replace; boundary=frame')

# ---------- THERMAL feed (simulated or actual sensor) ----------
# If you have a thermal sensor (MLX90640), replace simulated code below
def thermal_generator():
    # Simulate thermal matrix -> generate colored image
    while True:
        # simulated small thermal matrix (16x12)
        mat = np.random.randint(20, 80, (12,16)).astype(np.uint8)
        mat_resized = cv2.resize(mat, (320,240), interpolation=cv2.INTER_LINEAR)
        heat = cv2.applyColorMap(mat_resized, cv2.COLORMAP_JET)
        ret, jpg = cv2.imencode('.jpg', heat, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + jpg.tobytes() + b'\r\n')
        time.sleep(0.15)

@app.route('/thermal_feed')
def thermal_feed():
    return Response(thermal_generator(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')

# ---------- Simple system info + snapshot ----------
@app.route('/api/system')
def api_system():
    info = {
        "battery": None,
        "uptime": round(time.time()),
        "sensors": {"radar":"ok", "thermal":"ok", "camera":"ok"},
        "signal": "good",
        "warnings": []
    }
    return jsonify(info)

@app.route('/api/snapshot')
def api_snapshot():
    ret, frame = cap.read()
    if not ret:
        return jsonify({"error": "no frame"}), 500
    _, jpg = cv2.imencode('.jpg', frame)
    return Response(jpg.tobytes(), mimetype='image/jpeg')

# ---------- Serve frontend build (optional) ----------
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_frontend(path):
    if path != "" and (app.static_folder / path).exists():
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, 'index.html')

# ---------- SocketIO telemetry ----------
def telemetry_loop():
    """Background thread that emits telemetry periodically.
       Replace with real sensor reading code for radar/thermal/alerts."""
    import random
    while True:
        # Radar sample event
        radar = {
            "angle": random.randint(0,359),
            "distance_m": round(random.uniform(0.3,8.0), 2),
            "strength": round(random.uniform(0.1,1.0), 2),
            "ts": time.time()
        }
        socketio.emit('telemetry', {"type": "radar", "payload": radar})
        # Thermal sample (small matrix)
        therm = np.random.randint(20,80,(12,16)).tolist()
        socketio.emit('telemetry', {"type": "thermal", "payload": therm})
        # Random alert occasionally
        if random.random() > 0.92:
            socketio.emit('telemetry', {
                "type": "alert",
                "payload": {"level": "warning", "msg": "Motion detected", "ts": time.time()}
            })
        socketio.sleep(1.0)

@socketio.on('connect')
def handle_connect():
    print('Client connected')
    socketio.emit('telemetry', {"type": "info", "payload": "welcome"})

if __name__ == '__main__':
    # start background telemetry thread
    socketio.start_background_task(telemetry_loop)
    # Use eventlet for production on Pi
    socketio.run(app, host='0.0.0.0', port=5000)
