# interpolate_and_render_word.py — run from SMPLer-X/main/, inside the smplerx conda env
import os, json
import sys
import numpy as np
import torch
import cv2
import smplx

script_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(script_dir, "SMPLer-X", "main"))
from scipy.spatial.transform import Rotation as R, Slerp
from render import render_pose
import pyrender
Red_SMPLX_DIR = 'output/red_test/smplx'
Apple_SMPLX_DIR = 'output/apple_test/smplx'

SAVE_DIR_NPZ = 'output/apple_red/smplx_interp'
SAVE_DIR_IMG = 'output/apple_red/img_interp'
REFERENCE_JSON = 'SMPLer-X/main/reference_stance.json'   # same file v6 uses
CANVAS_WIDTH, CANVAS_HEIGHT = 1920, 1080
BG_COLOR = (60, 60, 60)

os.makedirs(SAVE_DIR_NPZ, exist_ok=True)
os.makedirs(SAVE_DIR_IMG, exist_ok=True)

device = torch.device('cuda') if torch.cuda.is_available() else torch.device('cpu')


def load_word_pose_sequence(smplx_dir, num_frames, start_idx):
    orient, pose, lhand, rhand, jaw, betas, expr = [], [], [], [], [], [], []
    for f in range(start_idx, start_idx + num_frames):
        npz = dict(np.load(os.path.join(smplx_dir, f'{f:05}_0.npz'), allow_pickle=True))
        orient.append(np.array(npz['global_orient']).reshape(3))
        pose.append(np.array(npz['body_pose']).reshape(21, 3))
        lhand.append(np.array(npz['left_hand_pose']).reshape(15, 3))
        rhand.append(np.array(npz['right_hand_pose']).reshape(15, 3))
        jaw.append(np.array(npz['jaw_pose']).reshape(3))
        betas.append(np.array(npz['betas']).reshape(10))
        expr.append(np.array(npz['expression']).reshape(10))
    return {
        'global_orient': np.stack(orient), 'body_pose': np.stack(pose),
        'left_hand_pose': np.stack(lhand), 'right_hand_pose': np.stack(rhand),
        'jaw_pose': np.stack(jaw), 'betas': np.stack(betas), 'expression': np.stack(expr),
    }

appleParams = load_word_pose_sequence(Apple_SMPLX_DIR, 84, start_idx=2)   # local idx 0-83
redParams_only = load_word_pose_sequence(Red_SMPLX_DIR, 132, start_idx=1)  # local idx 0-131

# concatenate: combined idx 0-83 = apple, combined idx 84-215 = red
redParams = {
    key: np.concatenate([appleParams[key], redParams_only[key]], axis=0)
    for key in appleParams
}


# frame 44,52,55,58 -> array idx = frame - start_idx
KEYFRAME_INDICES = [16,18,25,28,31,130,138,141,144]
key_times = np.array([0,2,9,12,15,25,33,36,39], dtype=float)
query_times = np.linspace(0, key_times[-1], 40)

def slerp_array(keyframe_rotvecs, key_times, query_times):
    K, J, _ = keyframe_rotvecs.shape
    out = np.zeros((len(query_times), J, 3))
    for j in range(J):
        rot = R.from_rotvec(keyframe_rotvecs[:, j, :])
        out[:, j, :] = Slerp(key_times, rot)(query_times).as_rotvec()
    return out

kf_body  = redParams['body_pose'][KEYFRAME_INDICES]
kf_lhand = redParams['left_hand_pose'][KEYFRAME_INDICES]
kf_rhand = redParams['right_hand_pose'][KEYFRAME_INDICES]
kf_jaw   = redParams['jaw_pose'][KEYFRAME_INDICES].reshape(len(KEYFRAME_INDICES), 1, 3)

interp_body  = slerp_array(kf_body,  key_times, query_times)
interp_lhand = slerp_array(kf_lhand, key_times, query_times)
interp_rhand = slerp_array(kf_rhand, key_times, query_times)
interp_jaw   = slerp_array(kf_jaw,   key_times, query_times)[:, 0, :]

# --- fixed stance (option A) — same reference used by v6 ---
ref = json.load(open(REFERENCE_JSON))
REF_FOCAL   = ref['focal']
REF_PRINCPT = ref['princpt']
REF_TRANSL  = np.array(ref['transl'], dtype=np.float32)
REF_ORIENT  = np.array(ref['global_orient'], dtype=np.float32)
betas_fixed = np.zeros((1, 10), dtype=np.float32)   # canonical shape, matches v6

smplx_model = smplx.create(
    '/home2/sharif/ISL-AVATAR-PROJECT/skinning/SMPLer-X/common/utils/human_model_files', 'smplx',
    gender='male', num_betas=10, use_face_contour=True,
    flat_hand_mean=False, use_pca=False, batch_size=1
).to(device)
camera = pyrender.camera.IntrinsicsCamera(
    fx=REF_FOCAL[0], fy=REF_FOCAL[1], cx=REF_PRINCPT[0], cy=REF_PRINCPT[1],
)
blank_img = np.full((CANVAS_HEIGHT, CANVAS_WIDTH, 3), BG_COLOR, dtype=np.uint8)

for i in range(len(query_times)):
    # save npz (useful for reuse/debugging even though we render directly below)
    np.savez(os.path.join(SAVE_DIR_NPZ, f'{i:05}_0.npz'),
        global_orient=REF_ORIENT.reshape(1, 3),
        body_pose=interp_body[i].reshape(1, 21, 3),
        left_hand_pose=interp_lhand[i].reshape(1, 15, 3),
        right_hand_pose=interp_rhand[i].reshape(1, 15, 3),
        jaw_pose=interp_jaw[i].reshape(1, 3),
        betas=betas_fixed, transl=REF_TRANSL.reshape(1, 3),
        expression=np.zeros((1, 10), dtype=np.float32))

    body_model_param = {
        'betas': torch.tensor(betas_fixed, device=device, dtype=torch.float32),
        'transl': torch.tensor([REF_TRANSL], device=device, dtype=torch.float32),
        'global_orient': torch.tensor([REF_ORIENT], device=device, dtype=torch.float32),
        'body_pose': torch.tensor(interp_body[i].reshape(1, 21, 3), device=device, dtype=torch.float32),
        'left_hand_pose': torch.tensor(interp_lhand[i].reshape(1, 15, 3), device=device, dtype=torch.float32),
        'right_hand_pose': torch.tensor(interp_rhand[i].reshape(1, 15, 3), device=device, dtype=torch.float32),
        'jaw_pose': torch.tensor([interp_jaw[i]], device=device, dtype=torch.float32),
        'leye_pose': torch.zeros((1, 3), device=device, dtype=torch.float32),
        'reye_pose': torch.zeros((1, 3), device=device, dtype=torch.float32),
    }
    rendered = render_pose(img=blank_img, body_model_param=body_model_param,
                            body_model=smplx_model, camera=camera)
    cv2.imwrite(os.path.join(SAVE_DIR_IMG, f'{i:05}.jpg'), rendered)

print(f'Done -> {SAVE_DIR_IMG} ({len(query_times)} frames)')