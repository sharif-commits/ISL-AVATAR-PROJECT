import json
import os
import matplotlib.pyplot as plt
from matplotlib.animation import FuncAnimation

# Path to your smoothed JSON file (script-relative -> src/output)
BASE_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))
FILE_PATH = os.path.join(BASE_DIR, "src", "output", "features_Apple_ready.json")

# Load the JSON data
try:
    with open(FILE_PATH, 'r') as f:
        frames_data = json.load(f)
except FileNotFoundError:
    print(f"Error: Could not find {FILE_PATH}. Make sure you run this from the project root.")
    exit()

# Initialize the plot
fig = plt.figure(figsize=(8, 8))
ax = fig.add_subplot(111, projection='3d')

def update(frame_index):
    ax.clear()
    
    # Set static axis limits to prevent the camera from jumping around.
    # MediaPipe normalizes X and Y from 0.0 to 1.0. 
    ax.set_xlim([-0.5, 1.5])
    
    # Invert Y-axis because MediaPipe's Y=0 is the top of the image
    ax.set_ylim([1.5, -0.5]) 
    
    # Z-axis is relative depth; usually ranges around -1 to 1
    ax.set_zlim([-1, 1])
    
    ax.set_xlabel('X Axis')
    ax.set_ylabel('Y Axis')
    ax.set_zlabel('Z Axis (Depth)')
    ax.set_title(f"Animation Frame: {frame_index}/{len(frames_data)}")

    frame = frames_data[frame_index]
    xs, ys, zs = [], [], []

    # Extract coordinates based on standard MediaPipe dictionary structure
    # (e.g., {'pose': [{'x': 0.1, 'y': 0.2, 'z': 0.3}, ...], 'left_hand': [...]})
    if isinstance(frame, dict):
        for part_name, landmarks in frame.items():
            if isinstance(landmarks, list):
                for lm in landmarks:
                    if isinstance(lm, dict) and 'x' in lm and 'y' in lm and 'z' in lm:
                        xs.append(lm['x'])
                        ys.append(lm['y'])
                        zs.append(lm['z'])
                        
    # Fallback in case your JSON is just a flat list of landmarks per frame
    elif isinstance(frame, list):
        for lm in frame:
            if isinstance(lm, dict) and 'x' in lm and 'y' in lm and 'z' in lm:
                xs.append(lm['x'])
                ys.append(lm['y'])
                zs.append(lm['z'])

    # Plot the points
    # We use zdir='z' to maintain proper depth orientation
    ax.scatter(xs, ys, zs, c='cyan', marker='o', edgecolors='blue', s=20)

# Create the animation (interval is in milliseconds)
# Decrease interval to speed up the animation, increase to slow down
ani = FuncAnimation(fig, update, frames=len(frames_data), interval=30, repeat=True)

plt.show()