import os
import sys
import json
import cv2
import tkinter as tk
from tkinter import ttk, messagebox
from PIL import Image, ImageTk

class TimelineVisualizer(tk.Canvas):
    def __init__(self, parent, **kwargs):
        super().__init__(parent, height=30, bg="#121212", highlightthickness=0, **kwargs)
        self.total_frames = 0
        self.interpolate_start = None
        self.interpolate_end = None
        self.keyframes = []
        self.current_frame = 0

    def set_data(self, total_frames, start, end, keyframes, current):
        self.total_frames = total_frames
        self.interpolate_start = start
        self.interpolate_end = end
        self.keyframes = keyframes
        self.current_frame = current
        self.draw()

    def draw(self):
        self.delete("all")
        if self.total_frames <= 0:
            return
        
        w = self.winfo_width()
        h = self.winfo_height()
        if w <= 1:
            # If widget is not fully rendered yet, use a default width
            w = 600
        
        bar_y1 = h // 2 - 4
        bar_y2 = h // 2 + 4
        
        # Draw background track
        self.create_rectangle(10, bar_y1, w - 10, bar_y2, fill="#2d2d2d", outline="")
        
        def frame_to_x(f):
            if self.total_frames <= 1:
                return 10
            return int((f / (self.total_frames - 1)) * (w - 20)) + 10

        # Draw interpolation range shaded highlight
        if self.interpolate_start is not None and self.interpolate_end is not None:
            x_start = frame_to_x(self.interpolate_start)
            x_end = frame_to_x(self.interpolate_end)
            x_left = min(x_start, x_end)
            x_right = max(x_start, x_end)
            self.create_rectangle(x_left, bar_y1, x_right, bar_y2, fill="#00adb5", stipple="gray25", outline="")

        # Draw start marker (Green)
        if self.interpolate_start is not None:
            x = frame_to_x(self.interpolate_start)
            self.create_oval(x - 6, h // 2 - 6, x + 6, h // 2 + 6, fill="#2ecc71", outline="")

        # Draw end marker (Red)
        if self.interpolate_end is not None:
            x = frame_to_x(self.interpolate_end)
            self.create_oval(x - 6, h // 2 - 6, x + 6, h // 2 + 6, fill="#e74c3c", outline="")

        # Draw keyframes (Yellow)
        for kf in self.keyframes:
            if kf == self.interpolate_start or kf == self.interpolate_end:
                continue
            x = frame_to_x(kf)
            self.create_oval(x - 5, h // 2 - 5, x + 5, h // 2 + 5, fill="#f1c40f", outline="")

        # Draw current frame vertical pointer line
        x_curr = frame_to_x(self.current_frame)
        self.create_line(x_curr, 2, x_curr, h - 2, fill="#ffffff", width=2)


class VideoAnnotatorApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("ISL Video Frame Interpolation Annotator")
        self.geometry("1100x700")
        self.configure(bg="#121212")
        
        # Paths
        self.script_dir = os.path.dirname(os.path.abspath(__file__))
        self.videos_dir = os.path.join(self.script_dir, "videos")
        self.metadata_dir = os.path.join(self.script_dir, "meta-data")
        os.makedirs(self.metadata_dir, exist_ok=True)
        
        # State variables
        self.cap = None
        self.total_frames = 0
        self.fps = 30.0
        self.current_frame = 0
        self.is_playing = False
        self.current_cv_image = None
        
        self.interpolate_start = None
        self.interpolate_end = None
        self.keyframes = []
        
        self.init_style()
        self.init_ui()
        
        # Handle periodic timer updates
        self.timer_id = None
        
        # Load video list
        self.populate_videos()

    def init_style(self):
        self.style = ttk.Style()
        self.style.theme_use('clam')
        
        # Dark style configurations
        self.style.configure('.', background='#121212', foreground='#e0e0e0')
        self.style.configure('TLabel', background='#121212', foreground='#e0e0e0', font=('Segoe UI', 10))
        self.style.configure('Header.TLabel', font=('Segoe UI', 11, 'bold'))
        self.style.configure('Accent.TLabel', foreground='#00adb5', font=('Segoe UI', 10, 'bold'))
        
        self.style.configure('TButton', background='#1f1f1f', foreground='#e0e0e0', bordercolor='#393e46', font=('Segoe UI', 10, 'bold'))
        self.style.map('TButton',
            background=[('active', '#2a2a2a'), ('pressed', '#00adb5')],
            foreground=[('pressed', '#121212')]
        )
        
        self.style.configure('TCombobox', fieldbackground='#1f1f1f', background='#2a2a2a', foreground='#e0e0e0', bordercolor='#393e46')

    def init_ui(self):
        # Configure grid weight
        self.columnconfigure(0, weight=7)
        self.columnconfigure(1, weight=3)
        self.rowconfigure(0, weight=1)

        # ----------------- Left Section (Video Player) -----------------
        left_frame = tk.Frame(self, bg="#121212", padx=15, pady=15)
        left_frame.grid(row=0, column=0, sticky="nsew")
        left_frame.columnconfigure(0, weight=1)
        left_frame.rowconfigure(1, weight=1) # Video container gets the stretch

        # Selector Row
        selector_frame = tk.Frame(left_frame, bg="#121212")
        selector_frame.grid(row=0, column=0, sticky="ew", pady=(0, 10))
        
        lbl_sel = ttk.Label(selector_frame, text="Select Video:")
        lbl_sel.pack(side="left", padx=(0, 10))
        
        self.video_combo = ttk.Combobox(selector_frame, state="readonly", width=40, postcommand=self.populate_videos)
        self.video_combo.pack(side="left", fill="x", expand=True)
        self.video_combo.bind("<<ComboboxSelected>>", self.on_video_selected)

        # Video container label (drawn black)
        self.video_container = tk.Label(left_frame, bg="#080808", bd=1, relief="solid")
        self.video_container.grid(row=1, column=0, sticky="nsew", pady=5)
        self.video_container.bind("<Configure>", lambda e: self.redisplay_current_frame())

        # Timeline Slider Frame
        slider_frame = tk.Frame(left_frame, bg="#121212")
        slider_frame.grid(row=2, column=0, sticky="ew", pady=5)
        
        self.slider = tk.Scale(
            slider_frame, from_=0, to=100, orient=tk.HORIZONTAL, showvalue=False,
            bg="#121212", fg="#00adb5", troughcolor="#2d2d2d", activebackground="#00adb5",
            highlightthickness=0, bd=0
        )
        self.slider.pack(fill="x", expand=True)
        self.slider.bind("<ButtonRelease-1>", self.on_slider_released)
        self.slider.bind("<B1-Motion>", self.on_slider_dragged)

        # Timeline Visualizer (Canvas)
        self.timeline_viz = TimelineVisualizer(left_frame)
        self.timeline_viz.grid(row=3, column=0, sticky="ew", pady=5)

        # Playback controls Row
        controls_frame = tk.Frame(left_frame, bg="#121212")
        controls_frame.grid(row=4, column=0, sticky="ew", pady=(10, 0))

        self.play_btn = ttk.Button(controls_frame, text="▶ Play", command=self.toggle_play, width=10)
        self.play_btn.pack(side="left", padx=5)

        self.prev_btn = ttk.Button(controls_frame, text="⏮ Prev", command=self.prev_frame, width=8)
        self.prev_btn.pack(side="left", padx=5)

        self.next_btn = ttk.Button(controls_frame, text="⏭ Next", command=self.next_frame, width=8)
        self.next_btn.pack(side="left", padx=5)

        self.stop_btn = ttk.Button(controls_frame, text="⏹ Stop", command=self.stop_video, width=10)
        self.stop_btn.pack(side="left", padx=5)

        self.frame_label = ttk.Label(controls_frame, text="Frame: 0 / 0", style="Accent.TLabel")
        self.frame_label.pack(side="left", padx=15)

        # ----------------- Right Section (Metadata Panel) -----------------
        right_frame = tk.Frame(self, bg="#121212", padx=15, pady=15, bd=1, relief="solid", borderwidth=0)
        # Add visual divider line on the left of right_frame
        divider = tk.Frame(self, bg="#2d2d2d", width=1)
        divider.grid(row=0, column=0, sticky="nse", padx=(0, 0))
        right_frame.grid(row=0, column=1, sticky="nsew")

        # Active File Info Group
        info_grp = tk.LabelFrame(right_frame, text="Active File Info", bg="#121212", fg="#00adb5", font=('Segoe UI', 10, 'bold'), padx=10, pady=10)
        info_grp.pack(fill="x", pady=(0, 15))
        
        self.lbl_active_video = ttk.Label(info_grp, text="Video: None")
        self.lbl_active_video.pack(anchor="w", pady=2)
        self.lbl_start = ttk.Label(info_grp, text="Interpolate Start: N/A")
        self.lbl_start.pack(anchor="w", pady=2)
        self.lbl_end = ttk.Label(info_grp, text="Interpolate End: N/A")
        self.lbl_end.pack(anchor="w", pady=2)

        # Mark Boundaries Group
        bounds_grp = tk.LabelFrame(right_frame, text="Mark Boundaries", bg="#121212", fg="#00adb5", font=('Segoe UI', 10, 'bold'), padx=10, pady=10)
        bounds_grp.pack(fill="x", pady=10)
        
        # Style buttons with green/red outlines
        self.btn_mark_start = tk.Button(
            bounds_grp, text="🟢 Mark Start", command=self.mark_start,
            bg="#1f1f1f", fg="#2ecc71", activebackground="#2ecc71", activeforeground="#121212",
            relief="flat", bd=1, highlightthickness=0, font=('Segoe UI', 9, 'bold'), pady=6
        )
        self.btn_mark_start.pack(fill="x", pady=4)

        self.btn_mark_end = tk.Button(
            bounds_grp, text="🔴 Mark End", command=self.mark_end,
            bg="#1f1f1f", fg="#e74c3c", activebackground="#e74c3c", activeforeground="#121212",
            relief="flat", bd=1, highlightthickness=0, font=('Segoe UI', 9, 'bold'), pady=6
        )
        self.btn_mark_end.pack(fill="x", pady=4)

        # Keyframes annotation Group
        kf_grp = tk.LabelFrame(right_frame, text="Keyframe Annotations", bg="#121212", fg="#00adb5", font=('Segoe UI', 10, 'bold'), padx=10, pady=10)
        kf_grp.pack(fill="both", expand=True, pady=10)

        self.btn_mark_kf = tk.Button(
            kf_grp, text="🟡 Mark Keyframe", command=self.mark_keyframe,
            bg="#1f1f1f", fg="#f1c40f", activebackground="#f1c40f", activeforeground="#121212",
            relief="flat", bd=1, highlightthickness=0, font=('Segoe UI', 9, 'bold'), pady=6
        )
        self.btn_mark_kf.pack(fill="x", pady=4)

        ttk.Label(kf_grp, text="Marked Keyframes:").pack(anchor="w", pady=(10, 2))
        
        self.kf_list = tk.Listbox(
            kf_grp, bg="#181818", fg="#e0e0e0", selectbackground="#00adb5", selectforeground="#121212",
            highlightcolor="#00adb5", highlightbackground="#333333", bd=0, font=('Segoe UI', 10)
        )
        self.kf_list.pack(fill="both", expand=True, pady=4)
        self.kf_list.bind("<Double-Button-1>", self.jump_to_kf_item)

        self.btn_remove_kf = ttk.Button(kf_grp, text="🗑 Remove Selected", command=self.remove_selected_keyframe)
        self.btn_remove_kf.pack(fill="x", pady=4)

        # Actions Group
        save_grp = tk.Frame(right_frame, bg="#121212")
        save_grp.pack(fill="x", pady=(15, 0))
        
        self.btn_save = tk.Button(
            save_grp, text="💾 Save Metadata", command=self.save_metadata,
            bg="#00adb5", fg="#121212", activebackground="#00f0f8", activeforeground="#121212",
            relief="flat", font=('Segoe UI', 11, 'bold'), pady=10
        )
        self.btn_save.pack(fill="x")

    def populate_videos(self):
        if not os.path.exists(self.videos_dir):
            messagebox.showwarning("Warning", f"Videos folder does not exist at {self.videos_dir}")
            return
            
        videos = [f for f in os.listdir(self.videos_dir) if f.lower().endswith(('.mp4', '.avi', '.mov', '.mkv'))]
        videos.sort()
        
        current_selection = self.video_combo.get()
        combo_values = ["Select a video..."] + videos
        self.video_combo.config(values=combo_values)
        
        if current_selection in combo_values:
            idx = combo_values.index(current_selection)
            self.video_combo.current(idx)
        else:
            self.video_combo.current(0)

    def on_video_selected(self, event):
        index = self.video_combo.current()
        if index <= 0:
            return
        video_filename = self.video_combo.get()
        video_path = os.path.join(self.videos_dir, video_filename)
        self.load_video(video_path)

    def load_video(self, video_path):
        if self.cap:
            self.cap.release()
            self.stop_playback_loop()
            self.is_playing = False
            self.play_btn.config(text="▶ Play")

        self.cap = cv2.VideoCapture(video_path)
        if not self.cap.isOpened():
            messagebox.showerror("Error", f"Failed to open video: {video_path}")
            return

        self.total_frames = int(self.cap.get(cv2.CAP_PROP_FRAME_COUNT))
        self.fps = self.cap.get(cv2.CAP_PROP_FPS)
        if self.fps <= 0:
            self.fps = 30.0

        self.current_frame = 0
        
        self.slider.config(to=self.total_frames - 1)
        self.slider.set(0)

        # Reset annotations
        self.interpolate_start = None
        self.interpolate_end = None
        self.keyframes = []
        
        video_filename = os.path.basename(video_path)
        self.lbl_active_video.config(text=f"Video: {video_filename}")

        # Check for existing metadata file to load
        meta_filename = f"{video_filename}_meta-data.json"
        meta_filepath = os.path.join(self.metadata_dir, meta_filename)
        if os.path.exists(meta_filepath):
            try:
                with open(meta_filepath, 'r') as f:
                    data = json.load(f)
                    self.interpolate_start = data.get("interpolate_start")
                    self.interpolate_end = data.get("interpolate_end")
                    self.keyframes = sorted(list(set(data.get("keyframes", []))))
            except Exception as e:
                print(f"Error loading existing metadata: {e}")

        self.update_metadata_ui()
        self.seek_to_frame(0)

    def seek_to_frame(self, frame_idx):
        if not self.cap or not self.cap.isOpened():
            return
        
        if frame_idx < 0:
            frame_idx = 0
        elif frame_idx >= self.total_frames:
            frame_idx = self.total_frames - 1

        self.current_frame = frame_idx
        self.cap.set(cv2.CAP_PROP_POS_FRAMES, self.current_frame)
        ret, frame = self.cap.read()
        if ret:
            self.display_frame(frame)
            self.update_timeline_visualizer()
            self.frame_label.config(text=f"Frame: {self.current_frame} / {self.total_frames}")

    def display_frame(self, frame, save_image=True):
        if save_image:
            self.current_cv_image = frame.copy()

        # Get current container size
        w = self.video_container.winfo_width()
        h = self.video_container.winfo_height()
        if w <= 50 or h <= 50:
            # Fallback to standard proportions if not fully initialized
            w, h = 640, 480

        rgb_image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        height, width, channel = rgb_image.shape
        
        # Calculate aspect ratios to scale correctly
        frame_aspect = width / height
        container_aspect = w / h
        
        if frame_aspect > container_aspect:
            # Width limited
            new_w = w
            new_h = int(w / frame_aspect)
        else:
            # Height limited
            new_h = h
            new_w = int(h * frame_aspect)
            
        if new_w <= 0: new_w = 1
        if new_h <= 0: new_h = 1

        pil_img = Image.fromarray(rgb_image)
        pil_img_scaled = pil_img.resize((new_w, new_h), Image.Resampling.LANCZOS)
        
        photo = ImageTk.PhotoImage(image=pil_img_scaled)
        self.video_container.config(image=photo)
        self.video_container.image = photo

    def redisplay_current_frame(self):
        if self.current_cv_image is not None:
            self.display_frame(self.current_cv_image, save_image=False)

    def on_slider_dragged(self, event):
        if self.is_playing:
            self.toggle_play()
        val = int(self.slider.get())
        self.seek_to_frame(val)

    def on_slider_released(self, event):
        val = int(self.slider.get())
        self.seek_to_frame(val)

    def toggle_play(self):
        if not self.cap or not self.cap.isOpened():
            return
        
        if self.is_playing:
            self.stop_playback_loop()
            self.is_playing = False
            self.play_btn.config(text="▶ Play")
        else:
            self.is_playing = True
            self.play_btn.config(text="⏸ Pause")
            self.start_playback_loop()

    def stop_video(self):
        if not self.cap or not self.cap.isOpened():
            return
        self.stop_playback_loop()
        self.is_playing = False
        self.play_btn.config(text="▶ Play")
        self.slider.set(0)
        self.seek_to_frame(0)

    def prev_frame(self):
        if not self.cap or not self.cap.isOpened():
            return
        if self.is_playing:
            self.toggle_play()
        new_val = max(0, self.current_frame - 1)
        self.slider.set(new_val)
        self.seek_to_frame(new_val)

    def next_frame(self):
        if not self.cap or not self.cap.isOpened():
            return
        if self.is_playing:
            self.toggle_play()
        new_val = min(self.total_frames - 1, self.current_frame + 1)
        self.slider.set(new_val)
        self.seek_to_frame(new_val)

    def start_playback_loop(self):
        self.stop_playback_loop() # Ensure no multiple loops
        interval = max(5, int(1000 / self.fps))
        self.timer_id = self.after(interval, self.update_frame)

    def stop_playback_loop(self):
        if self.timer_id:
            self.after_cancel(self.timer_id)
            self.timer_id = None

    def update_frame(self):
        if not self.cap or not self.cap.isOpened() or not self.is_playing:
            return
            
        ret, frame = self.cap.read()
        if ret:
            self.current_frame += 1
            if self.current_frame >= self.total_frames:
                self.current_frame = self.total_frames - 1
                self.is_playing = False
                self.play_btn.config(text="▶ Play")
                self.stop_playback_loop()
            else:
                self.slider.set(self.current_frame)
                self.start_playback_loop() # schedule next frame
            
            self.display_frame(frame)
            self.update_timeline_visualizer()
            self.frame_label.config(text=f"Frame: {self.current_frame} / {self.total_frames}")
        else:
            self.is_playing = False
            self.play_btn.config(text="▶ Play")
            self.stop_playback_loop()

    def update_timeline_visualizer(self):
        self.timeline_viz.set_data(
            self.total_frames,
            self.interpolate_start,
            self.interpolate_end,
            self.keyframes,
            self.current_frame
        )

    def update_metadata_ui(self):
        # Update text labels
        start_txt = f"Interpolate Start: {self.interpolate_start}" if self.interpolate_start is not None else "Interpolate Start: N/A"
        end_txt = f"Interpolate End: {self.interpolate_end}" if self.interpolate_end is not None else "Interpolate End: N/A"
        self.lbl_start.config(text=start_txt)
        self.lbl_end.config(text=end_txt)

        # Update keyframes list widget
        self.kf_list.delete(0, tk.END)
        for kf in self.keyframes:
            self.kf_list.insert(tk.END, f"Frame {kf}")
            
        self.update_timeline_visualizer()

    def mark_start(self):
        if not self.cap or not self.cap.isOpened():
            return
        self.interpolate_start = self.current_frame
        self.update_metadata_ui()

    def mark_end(self):
        if not self.cap or not self.cap.isOpened():
            return
        self.interpolate_end = self.current_frame
        self.update_metadata_ui()

    def mark_keyframe(self):
        if not self.cap or not self.cap.isOpened():
            return
        if self.current_frame not in self.keyframes:
            self.keyframes.append(self.current_frame)
            self.keyframes.sort()
            self.update_metadata_ui()

    def remove_selected_keyframe(self):
        selected_indices = self.kf_list.curselection()
        if not selected_indices:
            return
        for index in reversed(selected_indices):
            kf_val = self.keyframes[index]
            self.keyframes.remove(kf_val)
        self.update_metadata_ui()

    def jump_to_kf_item(self, event):
        selected_indices = self.kf_list.curselection()
        if not selected_indices:
            return
        kf_val = self.keyframes[selected_indices[0]]
        self.slider.set(kf_val)
        self.seek_to_frame(kf_val)

    def save_metadata(self):
        if not self.cap or not self.cap.isOpened():
            messagebox.showwarning("Save Error", "Please select and load a video first.")
            return

        video_filename = self.video_combo.get()
        
        # Create output dictionary matching requested schema
        metadata = {
            "video_name": video_filename,
            "interpolate_start": self.interpolate_start,
            "interpolate_end": self.interpolate_end,
            "keyframes": self.keyframes
        }

        # Filename format: video_name_meta-data.json
        output_filename = f"{video_filename}_meta-data.json"
        output_filepath = os.path.join(self.metadata_dir, output_filename)

        try:
            with open(output_filepath, "w") as f:
                json.dump(metadata, f, indent=4)
            
            messagebox.showinfo(
                "Success", f"Metadata saved successfully to:\n{output_filename}"
            )
        except Exception as e:
            messagebox.showerror("Save Error", f"Could not save metadata file:\n{str(e)}")


if __name__ == "__main__":
    app = VideoAnnotatorApp()
    
    # Wait for window mapping to build canvas width properly
    app.update()
    app.timeline_viz.draw()
    
    app.mainloop()
