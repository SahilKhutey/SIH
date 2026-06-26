# utils/yolo_infer.py
# YOLOv8 ONNX Runtime inference wrapper with automatic model-missing simulation fallback

import cv2
import numpy as np
import time
import os

# Try importing ONNX Runtime
try:
    import onnxruntime as ort
    HAS_ONNX = True
except ImportError:
    HAS_ONNX = False

def letterbox(img, new_shape=(640, 640), color=(114, 114, 114)):
    shape = img.shape[:2]  # h,w
    r = min(new_shape[0] / shape[0], new_shape[1] / shape[1])
    new_unpad = (int(round(shape[1] * r)), int(round(shape[0] * r)))
    dw = new_shape[1] - new_unpad[0]
    dh = new_shape[0] - new_unpad[1]
    dw /= 2
    dh /= 2
    resized = cv2.resize(img, new_unpad, interpolation=cv2.INTER_LINEAR)
    top, bottom = int(round(dh - 0.1)), int(round(dh + 0.1))
    left, right = int(round(dw - 0.1)), int(round(dw + 0.1))
    img_padded = cv2.copyMakeBorder(resized, top, bottom, left, right, cv2.BORDER_CONSTANT, value=color)
    return img_padded, r, (left, top)

def xywh2xyxy(x):
    y = x.copy()
    y[0] = x[0] - x[2] / 2
    y[1] = x[1] - x[3] / 2
    y[2] = x[0] + x[2] / 2
    y[3] = x[1] + x[3] / 2
    return y

def nms(boxes, scores, iou_thres):
    idxs = np.argsort(scores)[::-1]
    keep = []
    while len(idxs) > 0:
        i = idxs[0]
        keep.append(i)
        if len(idxs) == 1:
            break
        ious = bbox_iou(boxes[i], boxes[idxs[1:]])
        idxs = idxs[1:][ious <= iou_thres]
    return keep

def bbox_iou(box, boxes):
    x1 = np.maximum(box[0], boxes[:, 0])
    y1 = np.maximum(box[1], boxes[:, 1])
    x2 = np.minimum(box[2], boxes[:, 2])
    y2 = np.minimum(box[3], boxes[:, 3])
    inter = np.maximum(0, x2 - x1) * np.maximum(0, y2 - y1)
    area1 = (box[2] - box[0]) * (box[3] - box[1])
    area2 = (boxes[:, 2] - boxes[:, 0]) * (boxes[:, 3] - boxes[:, 1])
    union = area1 + area2 - inter
    return inter / (union + 1e-6)

class YOLOOnnx:
    def __init__(self, model_path, img_size=640, conf_thresh=0.35, iou_thresh=0.45):
        self.img_size = img_size
        self.conf_thresh = conf_thresh
        self.iou_thresh = iou_thresh
        self.simulated = False
        
        if not HAS_ONNX:
            print("[YOLO] ONNX Runtime library is missing. Operating in Simulation Fallback Mode.")
            self.simulated = True
            return

        if not os.path.exists(model_path):
            print(f"[YOLO] WARNING: Model path '{model_path}' not found. Operating in Simulation Fallback Mode.")
            self.simulated = True
            return
            
        try:
            # Set up session
            self.session = ort.InferenceSession(model_path, providers=['CPUExecutionProvider'])
            self.input_name = self.session.get_inputs()[0].name
            print(f"[YOLO] Successfully loaded model from '{model_path}'")
        except Exception as e:
            print(f"[YOLO] Failed to load model session: {e}. Activating Simulation Fallback Mode.")
            self.simulated = True

    def preprocess(self, frame):
        img, ratio, pad = letterbox(frame, new_shape=(self.img_size, self.img_size))
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        img = img.astype(np.float32) / 255.0
        img = np.transpose(img, (2, 0, 1))
        img = np.expand_dims(img, 0)
        return img, ratio, pad

    def infer(self, frame):
        if self.simulated:
            return self._run_simulated_inference(frame)
            
        try:
            h_orig, w_orig = frame.shape[:2]
            img, ratio, pad = self.preprocess(frame)
            preds = self.session.run(None, {self.input_name: img})
            
            out = preds[0]
            if out.ndim == 3:
                out = out[0]
                
            # If the format is YOLOv8 exported with shape e.g. [N, 8400]
            # out shape can be (84, 8400) or similar. Transpose it to (8400, 84) if needed.
            # Typically out has bounding boxes + classes scores
            if out.shape[0] < out.shape[1] and out.shape[0] <= 100:
                out = out.T
                
            dets = []
            for row in out:
                # [x, y, w, h, class_scores...]
                # Bounding box coordinates are centered (xywh)
                # Find best class score
                class_scores = row[4:]
                cls_id = np.argmax(class_scores)
                conf = class_scores[cls_id]
                
                if conf < self.conf_thresh:
                    continue
                    
                x, y, w, h = row[:4]
                xyxy = xywh2xyxy(np.array([x, y, w, h]))
                
                # Undo padding and scaling
                left, top = pad
                xyxy[0] -= left
                xyxy[1] -= top
                xyxy[2] -= left
                xyxy[3] -= top
                xyxy = xyxy / ratio
                
                # Clip to original image boundaries
                xyxy[0] = max(0, xyxy[0])
                xyxy[1] = max(0, xyxy[1])
                xyxy[2] = min(w_orig, xyxy[2])
                xyxy[3] = min(h_orig, xyxy[3])
                
                dets.append([float(xyxy[0]), float(xyxy[1]), float(xyxy[2]), float(xyxy[3]), float(conf), int(cls_id)])

            if len(dets) == 0:
                return []
                
            boxes = np.array([d[:4] for d in dets])
            scores = np.array([d[4] for d in dets])
            keep = nms(boxes, scores, self.iou_thresh)
            
            return [dets[i] for i in keep]
            
        except Exception as e:
            print(f"[YOLO] Inference error: {e}. Falling back to simulation.")
            return self._run_simulated_inference(frame)

    def _run_simulated_inference(self, frame):
        # We search the frame for simulated colored blobs to return mock boxes
        # This aligns YOLO boxes with the circles drawn in `camera_thread.py`!
        h, w = frame.shape[:2]
        detections = []
        
        # Color segment to find red regions (cam0 intruder) or blue regions (cam1)
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        
        # Mask for red (intruder in cam0 simulated frame)
        lower_red1 = np.array([0, 70, 50])
        upper_red1 = np.array([10, 255, 255])
        lower_red2 = np.array([170, 70, 50])
        upper_red2 = np.array([180, 255, 255])
        
        mask1 = cv2.inRange(hsv, lower_red1, upper_red1)
        mask2 = cv2.inRange(hsv, lower_red2, upper_red2)
        mask = mask1 | mask2
        
        # Find contours
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for c in contours:
            if cv2.contourArea(c) > 300:
                x, y, box_w, box_h = cv2.boundingRect(c)
                # Mock a classified warning (cls=1 is "gun", cls=2 is "knife", cls=0 is "person")
                # Classify as a threat with high confidence
                detections.append([float(x), float(y), float(x + box_w), float(y + box_h), 0.89, 1]) # 1 = Gun
                
        # Also occasionally mock a person walking around
        # (if no red blob found, we can occasionally create a mock person detection)
        if len(detections) == 0 and int(time.time()) % 15 in [3, 4, 5, 6]:
            detections.append([float(w*0.2), float(h*0.3), float(w*0.45), float(h*0.8), 0.76, 0]) # 0 = Person
            
        return detections
