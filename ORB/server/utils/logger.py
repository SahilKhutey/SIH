# utils/logger.py
# Thread-safe CSV logger for logging sensor activities and detected targets

import csv
import os
import threading
from datetime import datetime

class CSVLogger:
    def __init__(self, path="detections_log.csv"):
        self.path = path
        self.lock = threading.Lock()
        
        # Ensure directory path exists
        dir_name = os.path.dirname(self.path)
        if dir_name and not os.path.exists(dir_name):
            try:
                os.makedirs(dir_name)
            except Exception as e:
                print(f"[Logger] Error creating directories for log: {e}")

        try:
            header_needed = not os.path.exists(self.path)
            self.f = open(self.path, "a", newline="", encoding="utf-8")
            self.writer = csv.writer(self.f)
            
            if header_needed:
                with self.lock:
                    self.writer.writerow([
                        "timestamp", "sensor", "event", "class", 
                        "confidence", "x1", "y1", "x2", "y2", "note"
                    ])
                    self.f.flush()
            print(f"[Logger] Active and logging to file: '{self.path}'")
        except Exception as e:
            print(f"[Logger] Failed to open CSV file: {e}")
            self.f = None

    def log_detection(self, sensor, event, cls=None, conf=None, bbox=None, note=""):
        if not self.f:
            return
            
        ts = datetime.utcnow().isoformat()
        x1, y1, x2, y2 = ("", "", "", "")
        if bbox and len(bbox) == 4:
            x1, y1, x2, y2 = bbox
            
        try:
            with self.lock:
                self.writer.writerow([
                    ts, sensor, event, cls, 
                    conf, x1, y1, x2, y2, note
                ])
                self.f.flush()
        except Exception as e:
            print(f"[Logger] Error writing to CSV file: {e}")

    def close(self):
        if self.f:
            try:
                with self.lock:
                    self.f.close()
                print("[Logger] Log file closed successfully.")
            except Exception:
                pass
