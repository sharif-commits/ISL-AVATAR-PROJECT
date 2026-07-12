# diagnose_jitter.py
import os, glob, json
import numpy as np

OUTPUT_FOLDER = '../../output/apple_test'
smplx_dir = os.path.join(OUTPUT_FOLDER, 'smplx')

npz_paths = sorted(glob.glob(os.path.join(smplx_dir, '*_0.npz')))

keys = ['global_orient', 'body_pose', 'transl', 'betas', 'left_hand_pose', 'right_hand_pose', 'jaw_pose']
series = {k: [] for k in keys}

for p in npz_paths:
    anno = dict(np.load(p, allow_pickle=True))
    for k in keys:
        if k in anno:
            series[k].append(np.array(anno[k]).reshape(-1))

print(f"{'param':<18}{'dim':<6}{'mean |frame-to-frame delta|':<30}{'max |delta|'}")
for k in keys:
    if len(series[k]) < 2:
        continue
    arr = np.stack(series[k])  # (T, dim)
    deltas = np.abs(np.diff(arr, axis=0))  # (T-1, dim)
    mean_delta = deltas.mean()
    max_delta = deltas.max()
    print(f"{k:<18}{arr.shape[1]:<6}{mean_delta:<30.5f}{max_delta:.5f}")