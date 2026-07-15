# smooth_and_rerender_v6.py — run from SMPLer-X/main/, inside the smplerx conda env
#
# Requires reference_stance.json (run calibrate_reference.py once first).
#
# Every clip is rendered with the SAME fixed transl/global_orient/focal/princpt,
# so the avatar stands in one consistent "statue" position/orientation/scale
# across all sign clips, regardless of how the original signer was framed.
#
# Only body_pose, left_hand_pose, right_hand_pose, jaw_pose (the actual sign
# articulation) still vary per frame — smoothed the same rotation-aware way as v5.
#
# Usage:
#   set OUTPUT_FOLDER below to the clip you're processing, then run.

import os, glob, json
import numpy as np
import pandas as pd
import cv2
import torch
import smplx
from scipy.spatial.transform import Rotation as R

from render import render_pose, smplx_shape
import pyrender

OUTPUT_FOLDER = '../../output/school_test'   # <-- change per clip
SMOOTH_WINDOW = 5
BG_COLOR = (60, 60, 60)
REFERENCE_JSON = 'reference_stance.json'

# canvas size to render at — should match whatever your source frames' resolution is,
# since focal/princpt from the reference were computed relative to that resolution
CANVAS_WIDTH = 1920
CANVAS_HEIGHT = 1080

device = torch.device('cuda') if torch.cuda.is_available() else torch.device('cpu')
smplx_model = smplx.create(
    '../common/utils/human_model_files', 'smplx',
    gender='male', num_betas=10, use_face_contour=True,
    flat_hand_mean=False, use_pca=False, batch_size=1
).to(device)

ref = json.load(open(REFERENCE_JSON))
REF_FOCAL = ref['focal']
REF_PRINCPT = ref['princpt']
REF_TRANSL = np.array(ref['transl'], dtype=np.float32)
REF_ORIENT = np.array(ref['global_orient'], dtype=np.float32)

meta_dir  = os.path.join(OUTPUT_FOLDER, 'meta')
smplx_dir = os.path.join(OUTPUT_FOLDER, 'smplx')
save_dir  = os.path.join(OUTPUT_FOLDER, 'img_smoothed_v6')
os.makedirs(save_dir, exist_ok=True)

meta_paths = sorted(glob.glob(os.path.join(meta_dir, '*_0.json')))

frames, img_paths = [], []
pose_l, lhand_l, rhand_l, jaw_l = [], [], [], []

for mp in meta_paths:
    meta = json.load(open(mp))
    frame = os.path.basename(mp).split('_')[0]
    npz = dict(np.load(os.path.join(smplx_dir, f'{frame}_0.npz'), allow_pickle=True))

    frames.append(frame)
    img_paths.append(meta['img_path'])
    pose_l.append(np.array(npz['body_pose']).reshape(-1))          # 63
    lhand_l.append(np.array(npz['left_hand_pose']).reshape(-1))    # 45
    rhand_l.append(np.array(npz['right_hand_pose']).reshape(-1))   # 45
    jaw_l.append(np.array(npz['jaw_pose']).reshape(-1))            # 3

pose_arr  = np.stack(pose_l)
lhand_arr = np.stack(lhand_l)
rhand_arr = np.stack(rhand_l)
jaw_arr   = np.stack(jaw_l)


def smooth_cols(arr, window):
    df = pd.DataFrame(arr)
    return df.rolling(window, center=True, min_periods=1).mean().values


def smooth_rotations_quat(axis_angle_arr, window):
    quats = R.from_rotvec(axis_angle_arr).as_quat()
    for i in range(1, len(quats)):
        if np.dot(quats[i], quats[i - 1]) < 0:
            quats[i] = -quats[i]
    df = pd.DataFrame(quats)
    smoothed = df.rolling(window, center=True, min_periods=1).mean().values
    smoothed = smoothed / np.linalg.norm(smoothed, axis=1, keepdims=True)
    return R.from_quat(smoothed).as_rotvec()


def smooth_pose_quat(pose_arr_flat, window, num_joints):
    T = pose_arr_flat.shape[0]
    reshaped = pose_arr_flat.reshape(T, num_joints, 3)
    smoothed = np.zeros_like(reshaped)
    for j in range(num_joints):
        smoothed[:, j, :] = smooth_rotations_quat(reshaped[:, j, :], window)
    return smoothed.reshape(T, num_joints * 3)


pose_s  = smooth_pose_quat(pose_arr, SMOOTH_WINDOW, num_joints=21)
lhand_s = smooth_pose_quat(lhand_arr, SMOOTH_WINDOW, num_joints=15)
rhand_s = smooth_pose_quat(rhand_arr, SMOOTH_WINDOW, num_joints=15)
jaw_s   = smooth_cols(jaw_arr, SMOOTH_WINDOW)   # jaw is small/simple, linear is fine

for i, f in enumerate(frames):
    body_model_param = {
        'betas': torch.zeros((1, 10), device=device, dtype=torch.float32),
        'transl': torch.tensor([REF_TRANSL], device=device, dtype=torch.float32),
        'global_orient': torch.tensor([REF_ORIENT], device=device, dtype=torch.float32),
        'body_pose': torch.tensor(pose_s[i].reshape(1, 21, 3), device=device, dtype=torch.float32),
        'left_hand_pose': torch.tensor(lhand_s[i].reshape(1, 15, 3), device=device, dtype=torch.float32),
        'right_hand_pose': torch.tensor(rhand_s[i].reshape(1, 15, 3), device=device, dtype=torch.float32),
        'jaw_pose': torch.tensor([jaw_s[i]], device=device, dtype=torch.float32),
        'leye_pose': torch.zeros((1, 3), device=device, dtype=torch.float32),
        'reye_pose': torch.zeros((1, 3), device=device, dtype=torch.float32),
    }

    camera = pyrender.camera.IntrinsicsCamera(
        fx=REF_FOCAL[0], fy=REF_FOCAL[1], cx=REF_PRINCPT[0], cy=REF_PRINCPT[1],
    )

    blank_img = np.full((CANVAS_HEIGHT, CANVAS_WIDTH, 3), BG_COLOR, dtype=np.uint8)

    rendered = render_pose(img=blank_img, body_model_param=body_model_param,
                            body_model=smplx_model, camera=camera)
    cv2.imwrite(os.path.join(save_dir, f'{f}.jpg'), rendered)

print(f'Done -> {save_dir}')