#!/usr/bin/env python3
"""
extract_keyframes.py

Given a video's meta-data JSON (containing a "keyframes" list of frame
numbers), this script copies the matching *.npz files from that video's
`smplx` output folder into a new `smplx_keyframes` folder, sitting inside
the same video output directory.

Example directory layout this script assumes:

    <project_root>/skinning/src/intepolation_code/meta-data/school.mp4_meta-data.json
    <project_root>/skinning/output/school_test/smplx/00001_0.npz
                                                ...
    <project_root>/skinning/output/school_test/smplx_keyframes/   <-- created by this script

Usage
-----
Basic (relies on the default project layout baked in below):

    python extract_keyframes.py --video school.mp4 --video-folder school_test

Fully explicit (works for any layout):

    python extract_keyframes.py \
        --meta-json /path/to/school.mp4_meta-data.json \
        --smplx-dir /path/to/output/school_test/smplx \
        --out-dir   /path/to/output/school_test/smplx_keyframes
"""

import argparse
import json
import re
import shutil
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Default project paths (edit if your layout differs) --------------------
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path("/home2/sharif/ISL-AVATAR-PROJECT/skinning")
META_DATA_DIR = PROJECT_ROOT / "src" / "intepolation_code" / "meta-data"
OUTPUT_DIR = PROJECT_ROOT / "output"

# npz files look like: 00001_0.npz  -> frame 1, person index 0
FRAME_FILE_RE = re.compile(r"^(\d+)_(\d+)\.npz$")

# meta-data keyframe numbers are 0-based, but smplx npz files are 1-based
# (frame 0 in the meta-data corresponds to 00001_*.npz), so we add 1 when
# looking up the corresponding file.
FRAME_INDEX_OFFSET = 1


def load_keyframes(meta_json_path: Path):
    with open(meta_json_path, "r") as f:
        meta = json.load(f)
    keyframes = meta.get("keyframes")
    if not keyframes:
        raise ValueError(f"No 'keyframes' field found in {meta_json_path}")
    return keyframes, meta


def build_frame_index(smplx_dir: Path):
    """
    Scan the smplx directory once and build a mapping:
        frame_number (int) -> list of matching file paths (all person indices)
    """
    index = {}
    for p in smplx_dir.iterdir():
        if not p.is_file():
            continue
        m = FRAME_FILE_RE.match(p.name)
        if not m:
            continue
        frame_num = int(m.group(1))
        index.setdefault(frame_num, []).append(p)
    return index


def extract_keyframes(meta_json_path: Path, smplx_dir: Path, out_dir: Path,
                       frame_width: int = 5, dry_run: bool = False):
    keyframes, meta = load_keyframes(meta_json_path)
    print(f"Video: {meta.get('video_name')}")
    print(f"Keyframes to extract: {keyframes}")

    if not smplx_dir.is_dir():
        raise FileNotFoundError(f"smplx directory not found: {smplx_dir}")

    out_dir.mkdir(parents=True, exist_ok=True)

    frame_index = build_frame_index(smplx_dir)

    missing = []
    copied = []

    for kf in keyframes:
        smplx_frame_num = kf + FRAME_INDEX_OFFSET
        matches = frame_index.get(smplx_frame_num)
        if not matches:
            missing.append(kf)
            continue
        for src in matches:
            dst = out_dir / src.name
            if dry_run:
                print(f"[dry-run] meta-data keyframe {kf} -> smplx frame {smplx_frame_num}: "
                      f"would copy {src} -> {dst}")
            else:
                shutil.copy2(src, dst)
            copied.append(src.name)

    print(f"\nCopied {len(copied)} file(s) to: {out_dir}")
    if copied:
        for name in sorted(copied):
            print(f"  - {name}")

    if missing:
        print(f"\nWARNING: no npz file found for these meta-data keyframe numbers: {missing}")
        example = missing[0] + FRAME_INDEX_OFFSET
        print(f"  (looked for smplx frame numbers = keyframe + {FRAME_INDEX_OFFSET}, "
              f"e.g. expected filename pattern like {str(example).zfill(frame_width)}_0.npz)")

    return copied, missing


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                      formatter_class=argparse.RawDescriptionHelpFormatter)

    parser.add_argument("--video", type=str, default=None,
                         help="Video filename, e.g. school.mp4. "
                              "Used to locate meta-data/{video}_meta-data.json "
                              "if --meta-json is not given.")
    parser.add_argument("--video-folder", type=str, default=None,
                         help="Output folder name for this video, e.g. school_test. "
                              "Used to locate output/{video_folder}/smplx "
                              "if --smplx-dir is not given.")

    parser.add_argument("--meta-json", type=str, default=None,
                         help="Explicit path to the *_meta-data.json file. "
                              "Overrides --video.")
    parser.add_argument("--smplx-dir", type=str, default=None,
                         help="Explicit path to the smplx folder containing the npz files. "
                              "Overrides --video-folder.")
    parser.add_argument("--out-dir", type=str, default=None,
                         help="Explicit path to write keyframe npz files. "
                              "Defaults to <smplx-dir's parent>/smplx_keyframes")

    parser.add_argument("--dry-run", action="store_true",
                         help="Show what would be copied without actually copying.")

    args = parser.parse_args()

    # Resolve meta-data json path
    if args.meta_json:
        meta_json_path = Path(args.meta_json)
    elif args.video:
        meta_json_path = META_DATA_DIR / f"{args.video}_meta-data.json"
    else:
        parser.error("Provide either --meta-json or --video")

    if not meta_json_path.is_file():
        sys.exit(f"ERROR: meta-data json not found: {meta_json_path}")

    # Resolve smplx dir
    if args.smplx_dir:
        smplx_dir = Path(args.smplx_dir)
    elif args.video_folder:
        smplx_dir = OUTPUT_DIR / args.video_folder / "smplx"
    else:
        parser.error("Provide either --smplx-dir or --video-folder")

    # Resolve output dir (sibling of smplx dir, inside the video's output folder)
    if args.out_dir:
        out_dir = Path(args.out_dir)
    else:
        out_dir = smplx_dir.parent / "smplx_keyframes"

    extract_keyframes(meta_json_path, smplx_dir, out_dir, dry_run=args.dry_run)


if __name__ == "__main__":
    main()