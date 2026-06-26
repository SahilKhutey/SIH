# utils/thermal.py
# Thermal imaging reader (MLX90640 / AMG8833 I2C) with synthetic temperature grid fallback

import numpy as np
import cv2
import time

try:
    import board
    import busio
    from adafruit_mlx90640 import MLX90640
    HAS_MLX = True
except Exception:
    HAS_MLX = False

try:
    import adafruit_amg88xx
    HAS_AMG = True
except Exception:
    HAS_AMG = False

class ThermalReader:
    def __init__(self, enabled=True):
        self.enabled = enabled
        self.device = None
        self.type = None  # "mlx" or "amg"
        
        if not self.enabled:
            print("[Thermal] Thermal camera disabled in configuration.")
            return

        # Attempt to initialize MLX90640 (24x32 Grid)
        if HAS_MLX:
            try:
                i2c = busio.I2C(board.SCL, board.SDA, frequency=400000)
                self.device = MLX90640(i2c)
                self.device.refresh_rate = MLX90640.RefreshRate.REFRESH_8_HZ
                self.type = "mlx"
                print("[Thermal] MLX90640 thermal sensor initialized successfully via I2C.")
                return
            except Exception as e:
                print(f"[Thermal] Could not initialize MLX90640: {e}")

        # Attempt to initialize AMG8833 (8x8 Grid)
        if HAS_AMG:
            try:
                i2c = busio.I2C(board.SCL, board.SDA)
                self.device = adafruit_amg88xx.AMG88XX(i2c)
                self.type = "amg"
                print("[Thermal] AMG8833 thermal sensor initialized successfully via I2C.")
                return
            except Exception as e:
                print(f"[Thermal] Could not initialize AMG8833: {e}")

        print("[Thermal] Hardware thermal sensors not found or libraries unavailable. Operating in Simulation Fallback Mode.")

    def get_frame(self):
        """Returns a colored 320x240 BGR image for blending overlays."""
        matrix = self.get_matrix()
        arr = np.array(matrix, dtype=np.float32)
        
        # Normalize to 0-255 range
        min_val = np.min(arr)
        max_val = np.max(arr)
        diff = max_val - min_val
        if diff == 0:
            diff = 1.0
            
        norm = 255.0 * (arr - min_val) / diff
        norm = norm.astype(np.uint8)
        
        # Upsample grid using cubic interpolation
        resized = cv2.resize(norm, (320, 240), interpolation=cv2.INTER_CUBIC)
        # Apply JET colormap (blue = cold, red = hot)
        heatmap = cv2.applyColorMap(resized, cv2.COLORMAP_JET)
        return heatmap

    def get_matrix(self):
        """Returns a raw 2D list of temperatures (Celsius)."""
        if self.device is not None:
            try:
                if self.type == "mlx":
                    # MLX90640 outputs 24x32 (768 values)
                    frame = [0.0] * 768
                    self.device.getFrame(frame)
                    return np.array(frame).reshape((24, 32)).tolist()
                elif self.type == "amg":
                    # AMG8833 outputs 8x8 list of lists directly
                    return self.device.pixels
            except Exception as e:
                print(f"[Thermal] Sensor read failure: {e}. Switching to simulation fallback.")
                self.device = None  # Drop to simulated

        # Simulation Mode
        # Generate synthetic temperature values (12x16 matrix)
        t = time.time()
        matrix = np.full((12, 16), 24.0, dtype=np.float32)  # Ambient temp 24C
        
        # Overlay moving hotspots
        x1 = int((np.sin(t * 0.8) + 1) / 2 * 14 + 1)
        y1 = int((np.cos(t * 0.8) + 1) / 2 * 10 + 1)
        
        x2 = int((np.cos(t * 0.4) + 1) / 2 * 14 + 1)
        y2 = int((np.sin(t * 0.4) + 1) / 2 * 10 + 1)
        
        # Create Gaussian-like temperature distributions
        for y in range(12):
            for x in range(16):
                # Target 1 (Body heat: ~36.5C)
                d1 = (x - x1) ** 2 + (y - y1) ** 2
                temp1 = 36.5 * np.exp(-d1 / 3.0)
                
                # Target 2 (Engine/Device heat: ~48C)
                d2 = (x - x2) ** 2 + (y - y2) ** 2
                temp2 = 48.0 * np.exp(-d2 / 2.0)
                
                matrix[y, x] = max(matrix[y, x], temp1, temp2, float(np.random.normal(24.0, 0.2)))
                
        return matrix.tolist()

def overlay_thermal(frame, thermal_img, alpha=0.4):
    """Blends a thermal heatmap over a standard camera frame."""
    h, w = frame.shape[:2]
    # Resize thermal image to match frame dimensions
    th_resized = cv2.resize(thermal_img, (w, h))
    # Composite using weighted addition
    blended = cv2.addWeighted(frame, 1.0 - alpha, th_resized, alpha, 0)
    return blended
