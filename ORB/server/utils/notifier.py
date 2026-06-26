# utils/notifier.py
# Threat alerting interface: triggers Telegram photo notifications and local GPIO buzzer warning patterns

import requests
import time

try:
    from gpiozero import Buzzer
    HAS_BUZZER = True
except Exception:
    HAS_BUZZER = False

class Notifier:
    def __init__(self, token, chat_id, buzzer_pin=None):
        self.token = token
        self.chat_id = chat_id
        self.buzzer = None
        self.simulated = False
        
        if buzzer_pin and HAS_BUZZER:
            try:
                self.buzzer = Buzzer(buzzer_pin)
                print(f"[Notifier] Physical buzzer initialized on BCM GPIO pin {buzzer_pin}.")
            except Exception as e:
                print(f"[Notifier] Buzzer pin initialization failed: {e}. Switching to simulation fallback.")
                self.simulated = True
        else:
            print("[Notifier] Physical buzzer library not found or BCM pin omitted. Operating in Simulation Mode.")
            self.simulated = True

    def send_telegram_photo(self, image_bytes, caption="ALERT: Threat Detected!"):
        # Check for placeholder values
        if not self.token or not self.chat_id or "YOUR_TELEGRAM_BOT_TOKEN" in self.token:
            print("[Notifier] Telegram API configuration is unconfigured/skipped.")
            return False
            
        url = f"https://api.telegram.org/bot{self.token}/sendPhoto"
        files = {'photo': ('alert.jpg', image_bytes)}
        data = {'chat_id': self.chat_id, 'caption': caption}
        try:
            r = requests.post(url, files=files, data=data, timeout=8)
            print(f"[Notifier] Telegram photo alert sent. Server response status: {r.status_code}")
            return r.ok
        except Exception as e:
            print(f"[Notifier] Telegram API connection error: {e}")
            return False

    def buzz_short(self, duration=0.2):
        if self.buzzer:
            try:
                self.buzzer.on()
                time.sleep(duration)
                self.buzzer.off()
            except Exception as e:
                print(f"[Notifier] Buzzer write failure: {e}")
        else:
            # Simulated print representation
            print(f"[Notifier] BUZZER BIP ({duration}s)")
            time.sleep(duration)

    def buzz_alert(self, repeats=3):
        print(f"[Notifier] Triggering buzzer alarm pattern ({repeats} cycles)...")
        # Run buzzer sweeps in separate threads or blocks
        for _ in range(repeats):
            self.buzz_short(0.15)
            time.sleep(0.1)
