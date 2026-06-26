# sensors/hb100_adc.py
# Actual Hardware Doppler Radar Interface using MCP3008 SPI ADC with simulation fallback

import time
import random
import numpy as np

try:
    import spidev
    HAS_SPIDEV = True
except ImportError:
    HAS_SPIDEV = False

class HB100ADC:
    def __init__(self, bus=0, device=0, channel=0):
        self.bus = bus
        self.device = device
        self.channel = channel
        self.spi = None
        self.simulated = False

        if HAS_SPIDEV:
            try:
                self.spi = spidev.SpiDev()
                self.spi.open(self.bus, self.device)
                self.spi.max_speed_hz = 1350000
                print(f"[HB-100] Successfully initialized spidev on SPI Bus {self.bus}, Device {self.device}.")
            except Exception as e:
                print(f"[HB-100] Failed to initialize SPI interface: {e}. Activating Simulation Mode.")
                self.simulated = True
        else:
            print("[HB-100] spidev library not found. Activating Simulation Mode.")
            self.simulated = True

    def read_raw(self):
        """Reads raw 10-bit analog values (0-1023) from the MCP3008 ADC channel."""
        if self.simulated:
            return self._generate_simulated_reading()

        try:
            # MCP3008 single-ended input channel read configuration:
            # Send 3 bytes: start bit, channel selection config, and dummy byte.
            adc = self.spi.xfer2([1, (8 + self.channel) << 4, 0])
            # Reconstruct 10-bit value from returned bytes
            data = ((adc[1] & 3) << 8) + adc[2]
            return data
        except Exception as e:
            print(f"[HB-100] SPI read error: {e}. Switching to simulation fallback.")
            self.simulated = True
            return self._generate_simulated_reading()

    def close(self):
        if self.spi:
            try:
                self.spi.close()
                print("[HB-100] SPI connection closed.")
            except Exception:
                pass

    def _generate_simulated_reading(self):
        """Generates dynamic analog Doppler shift data.
        Produces baseline noise (50-100) with periodic spikes (500-980) representing Doppler motion."""
        t = time.time()
        # Motion occurs for 5 seconds every 20 seconds
        cycle = t % 20
        motion_active = cycle < 5

        if motion_active:
            # Motion frequency shift spikes + random frequency oscillation
            base = 650.0 + 200.0 * np.sin(t * 12.0)
            noise = random.randint(-80, 80)
            val = int(max(0, min(1023, base + noise)))
        else:
            # Passive ambient signal noise
            val = random.randint(45, 95)
            
        return val
