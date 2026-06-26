# sensors/radar_gpio.py
# GPIO interface for RC-WL0516 Radar and PIR sensors with simulated motion fallback

import time
import random

try:
    from gpiozero import InputDevice
    HAS_GPIO = True
except Exception:
    HAS_GPIO = False

class RadarSensor:
    def __init__(self, pin):
        self.sensor = None
        self.simulated = False
        
        if pin is None:
            print("[Radar] Sensor disabled in configurations.")
            return

        if HAS_GPIO:
            try:
                self.sensor = InputDevice(pin)
                print(f"[Radar] Physical sensor initialized on BCM GPIO pin {pin}.")
            except Exception as e:
                print(f"[Radar] Failed to init GPIO pin {pin}: {e}. Switching to simulation fallback.")
                self.simulated = True
        else:
            print(f"[Radar] GPIO library unavailable. Operating in Simulation Mode.")
            self.simulated = True

    def is_active(self):
        if self.simulated:
            # Simulated radar activity: trigger motion periodically
            # Trigger motion 20% of the time, keeping it high for a few seconds
            t = time.time()
            # Generate a wave behavior (active for 5 seconds every 20 seconds)
            cycle = t % 20
            return cycle < 5
            
        if self.sensor is None:
            return False
            
        try:
            return self.sensor.is_active
        except Exception as e:
            print(f"[Radar] Error reading sensor: {e}")
            return False


class PIRSensor:
    def __init__(self, pin):
        self.sensor = None
        self.simulated = False
        
        if pin is None:
            return

        if HAS_GPIO:
            try:
                self.sensor = InputDevice(pin)
                print(f"[PIR] Physical PIR sensor initialized on BCM GPIO pin {pin}.")
            except Exception as e:
                print(f"[PIR] Failed to init GPIO pin {pin}: {e}. Switching to simulation fallback.")
                self.simulated = True
        else:
            self.simulated = True

    def is_active(self):
        if self.simulated:
            # Mock PIR sensor behavior: matches radar but with slight variance
            t = time.time()
            cycle = t % 20
            return 1.0 < cycle < 4.5
            
        if self.sensor is None:
            return False
            
        try:
            return self.sensor.is_active
        except Exception as e:
            print(f"[PIR] Error reading sensor: {e}")
            return False
