# utils/camera_thread.py
# Reliable multithreaded camera capture tool with automated simulation fallback

import cv2
import threading
import time
import numpy as np

class CameraThread(threading.Thread):
    def __init__(self, src=0, name="cam"):
        super().__init__(daemon=True)
        self.src = src
        self.name = name
        self.cap = None
        self.frame = None
        self.lock = threading.Lock()
        self.running = False
        self.simulated = False

    def open(self):
        print(f"[{self.name}] Attempting to open video source: {self.src}")
        # Try to capture from physical source
        try:
            self.cap = cv2.VideoCapture(self.src)
            # Set resolution configurations
            self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
            
            if not self.cap.isOpened():
                print(f"[{self.name}] WARNING: Camera source {self.src} could not be opened. Activating simulation fallback.")
                self.simulated = True
        except Exception as e:
            print(f"[{self.name}] Error opening camera: {e}. Activating simulation fallback.")
            self.simulated = True

    def run(self):
        self.open()
        self.running = True
        
        frame_counter = 0
        while self.running:
            if self.simulated:
                # Generate a simulated frame (e.g., dynamic color grid or static layout mockup)
                frame = self._generate_simulated_frame(frame_counter)
                frame_counter += 1
                with self.lock:
                    self.frame = frame
                time.sleep(0.04)  # ~25 FPS
                continue

            if not self.cap or not self.cap.isOpened():
                time.sleep(0.5)
                continue
                
            try:
                ret, frame = self.cap.read()
                if not ret:
                    # Occasional capture glitch, retry shortly
                    time.sleep(0.01)
                    continue
                with self.lock:
                    self.frame = frame
            except Exception as e:
                print(f"[{self.name}] Error reading frame: {e}")
                time.sleep(0.1)

        # Release resources upon exit
        if self.cap:
            try:
                self.cap.release()
            except Exception:
                pass
            print(f"[{self.name}] Video capture source released.")

    def read(self):
        with self.lock:
            return None if self.frame is None else self.frame.copy()

    def stop(self):
        self.running = False

    def _generate_simulated_frame(self, counter):
        # Create a black background frame
        h, w = 480, 640
        frame = np.zeros((h, w, 3), dtype=np.uint8)
        
        # Draw placeholder indicators
        cv2.putText(frame, f"ORB FEED: {self.name.upper()} (SIMULATED)", (20, 40),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        
        # Draw some moving decorative lines/objects to simulate motion
        cx = int(w / 2 + 100 * np.sin(counter * 0.05))
        cy = int(h / 2 + 50 * np.cos(counter * 0.05))
        
        # Draw a simulated "intruder" box to trigger YOLO if desired,
        # or a simple scanning radar circle
        cv2.circle(frame, (cx, cy), 30, (0, 0, 255) if self.name == "cam0" else (255, 255, 0), -1)
        cv2.putText(frame, "TARGET", (cx - 30, cy - 40),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
        
        # Grid lines
        for i in range(0, w, 80):
            cv2.line(frame, (i, 0), (i, h), (40, 40, 40), 1)
        for i in range(0, h, 60):
            cv2.line(frame, (0, i), (w, i), (40, 40, 40), 1)
            
        # Draw timestamp
        ts = time.strftime("%Y-%m-%d %H:%M:%S")
        cv2.putText(frame, ts, (w - 220, h - 20),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (180, 180, 180), 1)
                    
        return frame
