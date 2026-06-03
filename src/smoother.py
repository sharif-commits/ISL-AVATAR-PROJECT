import json
import math
import numpy as np
import os
import glob

# ==========================================
# 1. TEMPORAL SMOOTHING (One Euro Filter)
# ==========================================
class OneEuroFilter:
    def __init__(self, t0, x0, dx0=0.0, min_cutoff=1.0, beta=0.01, d_cutoff=1.0):
        self.min_cutoff = float(min_cutoff)
        self.beta = float(beta)
        self.d_cutoff = float(d_cutoff)
        self.x_prev = float(x0)
        self.dx_prev = float(dx0)
        self.t_prev = float(t0)

    def smoothing_factor(self, t_e, cutoff):
        r = 2 * math.pi * cutoff * t_e
        return r / (r + 1)

    def __call__(self, t, x):
        t_e = t - self.t_prev
        if t_e <= 0.0:
            return self.x_prev
        a_d = self.smoothing_factor(t_e, self.d_cutoff)
        dx = (x - self.x_prev) / t_e
        dx_hat = a_d * dx + (1.0 - a_d) * self.dx_prev
        cutoff = self.min_cutoff + self.beta * abs(dx_hat)
        a = self.smoothing_factor(t_e, cutoff)
        x_hat = a * x + (1.0 - a) * self.x_prev
        self.x_prev = x_hat
        self.dx_prev = dx_hat
        self.t_prev = t
        return x_hat

# ==========================================
# 2. SPATIAL CORRECTION (Planar Math)
# ==========================================
def calculate_palm_plane_z(x, y, p0, p1, p2):
    v1 = p1 - p0
    v2 = p2 - p0
    normal = np.cross(v1, v2)
    if abs(normal[2]) < 1e-6:
        normal[2] = 1e-6
    A, B, C = normal
    z = p0[2] - ((A * (x - p0[0]) + B * (y - p0[1])) / C)
    return float(z)

def apply_planar_projection(hand_landmarks):
    if not hand_landmarks or len(hand_landmarks) < 21:
        return hand_landmarks
    try:
        p0 = np.array([hand_landmarks[0]['x'], hand_landmarks[0]['y'], hand_landmarks[0]['z']])
        p5 = np.array([hand_landmarks[5]['x'], hand_landmarks[5]['y'], hand_landmarks[5]['z']])
        p17 = np.array([hand_landmarks[17]['x'], hand_landmarks[17]['y'], hand_landmarks[17]['z']])
    except KeyError:
        return hand_landmarks
    new_landmarks = []
    BLEND_FACTOR = 0.85
    for i, lm in enumerate(hand_landmarks):
        new_lm = lm.copy()
        if i in [0, 5, 9, 13, 17]:
            new_landmarks.append(new_lm)
            continue
        projected_z = calculate_palm_plane_z(lm['x'], lm['y'], p0, p5, p17)
        new_lm['z'] = (projected_z * BLEND_FACTOR) + (lm['z'] * (1.0 - BLEND_FACTOR))
        new_landmarks.append(new_lm)
    return new_landmarks

# ==========================================
# 3. MASTER PROCESSING LOOP
# ==========================================
def process_data():
    BASE_DIR = os.path.dirname(__file__)
    INPUT_DIR = os.path.join(BASE_DIR, "output")
    files = glob.glob(os.path.join(INPUT_DIR, "*.json"))
    files = [f for f in files if not f.endswith("_ready.json")]
    ARM_DEPTH_MULTIPLIER = 2.5
    for file_path in files:
        print(f"\nProcessing: {file_path}")
        with open(file_path, 'r') as f:
            data = json.load(f)
        filters = {}
        processed_data = []
        for frame_data in data:
            t_sec = frame_data["timestamp_ms"] / 1000.0
            # --- PHASE 1: SPATIAL CORRECTION (GEOMETRY) ---
            # Fix Chest Clipping
            if "pose_landmarks" in frame_data and frame_data["pose_landmarks"]:
                for idx in [13, 14, 15, 16, 17, 18, 19, 20, 21, 22]:
                    if idx < len(frame_data["pose_landmarks"]):
                        frame_data["pose_landmarks"][idx]["z"] *= ARM_DEPTH_MULTIPLIER
            # Fix Exploding Fingers
            if "left_hand_landmarks" in frame_data:
                frame_data["left_hand_landmarks"] = apply_planar_projection(frame_data["left_hand_landmarks"])
            if "right_hand_landmarks" in frame_data:
                frame_data["right_hand_landmarks"] = apply_planar_projection(frame_data["right_hand_landmarks"])
            # --- PHASE 2: TEMPORAL SMOOTHING (TIME) ---
            new_frame_data = {
                "frame": frame_data["frame"],
                "timestamp_ms": frame_data["timestamp_ms"],
            }
            for group in ["left_hand_landmarks", "right_hand_landmarks", "pose_landmarks"]:
                landmarks = frame_data.get(group, [])
                new_landmarks = []
                for idx, lm in enumerate(landmarks):
                    new_lm = {}
                    for axis in ['x', 'y', 'z']:
                        val = lm[axis]
                        filter_key = (group, idx, axis)
                        if filter_key not in filters:
                            if axis == 'z':
                                filters[filter_key] = OneEuroFilter(t_sec, val, min_cutoff=3.0, beta=0.005)
                            else:
                                filters[filter_key] = OneEuroFilter(t_sec, val, min_cutoff=1.0, beta=0.01)
                            new_val = val
                        else:
                            new_val = filters[filter_key](t_sec, val)
                        new_lm[axis] = new_val
                    for k, v in lm.items():
                        if k not in ['x', 'y', 'z']:
                            new_lm[k] = v
                    new_landmarks.append(new_lm)
                new_frame_data[group] = new_landmarks
            processed_data.append(new_frame_data)
        # Save output
        out_path = file_path.replace(".json", "_ready.json")
        with open(out_path, 'w') as f:
            json.dump(processed_data, f)
        print(f"Success! Saved IK-ready data to: {out_path}")

if __name__ == "__main__":
    process_data()
