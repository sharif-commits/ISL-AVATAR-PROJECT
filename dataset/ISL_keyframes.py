#!/usr/bin/env python3
"""
img_keyframes.py

Given a video's meta-data JSON (containing a "keyframes" list of frame
numbers), this script copies the matching keyframe *.jpg images from that
video's frames folder (e.g. dataset/Apple/000001.jpg ...) into a new
`ISL_keyframes` folder inside the video's output directory.

Example directory layout this script assumes:

    /home2/sharif/ISL-AVATAR-PROJECT/dataset/Apple/000001.jpg
                                                    ...
    /home2/sharif/ISL-AVATAR-PROJECT/skinning/src/intepolation_code/meta-data/Apple.mp4_meta-data.json
    /home2/sharif/ISL-AVATAR-PROJECT/skinning/output/school_test/ISL_keyframes/   <-- created by this script

Frame numbering: the jpg frames are 1-based (000001.jpg = frame 1), while
the "keyframes" numbers in the meta-data JSON are 0-based, so by default
we add 1 (same convention as the smplx keyframe extraction). Use --offset
to override if needed.

Usage
-----
Basic:

    python img_keyframes.py --video Apple.mp4 --video-folder school_test

Fully explicit:

    python img_keyframes.py \
        --meta-json  /path/to/Apple.mp4_meta-data.json \
        --frames-dir /path/to/dataset/Apple \
        --out-dir    /path/to/output/school_test/ISL_keyframes
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

DATASET_ROOT = Path("/home2/sharif/ISL-AVATAR-PROJECT/dataset")

# jpg frames are 1-based (000001.jpg -> frame 1), meta-data keyframes are
# 0-based, so we add 1 when looking up the corresponding file.
FRAME_INDEX_OFFSET = 1

# Matches filenames like: 000001.jpg -> captures the digit run.
FRAME_FILE_RE = re.compile(r"(\d+)")


def load_keyframes(meta_json_path: Path):
    with open(meta_json_path, "r") as f:
        meta = json.load(f)
    keyframes = meta.get("keyframes")
    if not keyframes:
        raise ValueError(f"No 'keyframes' field found in {meta_json_path}")
    return keyframes, meta


def build_frame_index(frames_dir: Path, extensions=(".jpg", ".jpeg")):
    """
    Scan the frames directory once and build a mapping:
        frame_number (int) -> list of matching file paths

    Frame number is taken as the integer value of the digit run in the
    filename (leading zeros stripped), so 000001.jpg maps to 1.
    """
    index = {}
    for p in frames_dir.iterdir():
        if not p.is_file():
            continue
        if p.suffix.lower() not in extensions:
            continue
        m = FRAME_FILE_RE.search(p.stem)
        if not m:
            continue
        frame_num = int(m.group(1))
        index.setdefault(frame_num, []).append(p)
    return index


def extract_keyframes(meta_json_path: Path, frames_dir: Path, out_dir: Path,
                       frame_width: int = 6, offset: int = FRAME_INDEX_OFFSET,
                       dry_run: bool = False):
    keyframes, meta = load_keyframes(meta_json_path)
    print(f"Video: {meta.get('video_name')}")
    print(f"Keyframes to extract: {keyframes}")

    if not frames_dir.is_dir():
        raise FileNotFoundError(f"frames directory not found: {frames_dir}")

    out_dir.mkdir(parents=True, exist_ok=True)

    frame_index = build_frame_index(frames_dir)

    missing = []
    copied = []

    for kf in keyframes:
        frame_num = kf + offset
        matches = frame_index.get(frame_num)
        if not matches:
            missing.append(kf)
            continue
        for src in matches:
            dst = out_dir / src.name
            if dry_run:
                print(f"[dry-run] meta-data keyframe {kf} -> frame {frame_num}: "
                      f"would copy {src} -> {dst}")
            else:
                shutil.copy2(src, dst)
            copied.append(src.name)

    print(f"\nCopied {len(copied)} file(s) to: {out_dir}")
    if copied:
        for name in sorted(copied):
            print(f"  - {name}")

    if missing:
        print(f"\nWARNING: no jpg file found for these meta-data keyframe numbers: {missing}")
        example = missing[0] + offset
        print(f"  (looked for frame numbers = keyframe + {offset}, "
              f"e.g. expected filename pattern like {str(example).zfill(frame_width)}.jpg)")

    return copied, missing


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                      formatter_class=argparse.RawDescriptionHelpFormatter)

    parser.add_argument("--video", type=str, default=None,
                         help="Video filename, e.g. Apple.mp4. Used to locate "
                              "meta-data/{video}_meta-data.json, and to guess "
                              "the frames folder dataset/{video_stem}/ if "
                              "--frames-dir is not given.")
    parser.add_argument("--video-folder", type=str, default=None,
                         help="Output folder name for this video, e.g. school_test. "
                              "Used to build the default output path "
                              "output/{video_folder}/ISL_keyframes.")

    parser.add_argument("--meta-json", type=str, default=None,
                         help="Explicit path to the *_meta-data.json file. "
                              "Overrides --video.")
    parser.add_argument("--frames-dir", type=str, default=None,
                         help="Explicit path to the folder containing the pre-extracted "
                              "jpg frames for this video, e.g. dataset/Apple. "
                              "Overrides --video.")
    parser.add_argument("--out-dir", type=str, default=None,
                         help="Explicit path to write keyframe jpg files. "
                              "Defaults to output/{video_folder}/ISL_keyframes")

    parser.add_argument("--offset", type=int, default=FRAME_INDEX_OFFSET,
                         help=f"Frame index offset added to each keyframe number "
                              f"before lookup (default {FRAME_INDEX_OFFSET}).")

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

    # Resolve frames dir
    if args.frames_dir:
        frames_dir = Path(args.frames_dir)
    elif args.video:
        video_stem = Path(args.video).stem  # e.g. "Apple" from "Apple.mp4"
        frames_dir = DATASET_ROOT / video_stem
    else:
        parser.error("Provide either --frames-dir or --video")

    if not frames_dir.is_dir():
        sys.exit(f"ERROR: frames directory not found: {frames_dir}")

    # Resolve output dir
    if args.out_dir:
        out_dir = Path(args.out_dir)
    elif args.video_folder:
        out_dir = OUTPUT_DIR / args.video_folder / "ISL_keyframes"
    else:
        parser.error("Provide either --out-dir or --video-folder")

    extract_keyframes(meta_json_path, frames_dir, out_dir,
                       offset=args.offset, dry_run=args.dry_run)


if __name__ == "__main__":
    main()