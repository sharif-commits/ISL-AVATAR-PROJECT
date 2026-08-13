import os
import sys
import json

script_dir = os.path.dirname(os.path.abspath(__file__))
skinning_dir = os.path.join(script_dir, "skinning")
sys.path.insert(0, skinning_dir)

import server

def main():
    print("Generating static API data for GitHub Pages...")
    server.preload_sentence_cache()

    # Create directories
    api_dir = os.path.join(script_dir, "api")
    translate_dir = os.path.join(api_dir, "translate")
    os.makedirs(translate_dir, exist_ok=True)

    # Also create in skinning/api and skinning/ISLRTC-WEBSITE/api for relative paths
    skinning_api_dir = os.path.join(skinning_dir, "api")
    skinning_translate_dir = os.path.join(skinning_api_dir, "translate")
    os.makedirs(skinning_translate_dir, exist_ok=True)

    islrtc_api_dir = os.path.join(skinning_dir, "ISLRTC-WEBSITE", "api")
    islrtc_translate_dir = os.path.join(islrtc_api_dir, "translate")
    os.makedirs(islrtc_translate_dir, exist_ok=True)

    # 1. Export sentences.json
    sentences_data = {
        "sentences": [{"id": s["id"], "english": s["english"]} for s in server.SENTENCE_MAPPINGS]
    }
    with open(os.path.join(api_dir, "sentences.json"), "w", encoding="utf-8") as f:
        json.dump(sentences_data, f, indent=2)
    with open(os.path.join(skinning_api_dir, "sentences.json"), "w", encoding="utf-8") as f:
        json.dump(sentences_data, f, indent=2)
    with open(os.path.join(islrtc_api_dir, "sentences.json"), "w", encoding="utf-8") as f:
        json.dump(sentences_data, f, indent=2)
    print("Exported sentences.json")

    # 2. Export each sentence translation JSON
    for sid in server.CACHE_BY_ID_RAW:
        raw_bytes = server.CACHE_BY_ID_RAW[sid]
        json_obj = json.loads(raw_bytes.decode('utf-8'))
        
        # Save formatted / compact json
        file_path = os.path.join(translate_dir, f"{sid}.json")
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(json_obj, f)

        skinning_file_path = os.path.join(skinning_translate_dir, f"{sid}.json")
        with open(skinning_file_path, "w", encoding="utf-8") as f:
            json.dump(json_obj, f)

        islrtc_file_path = os.path.join(islrtc_translate_dir, f"{sid}.json")
        with open(islrtc_file_path, "w", encoding="utf-8") as f:
            json.dump(json_obj, f)
        
        print(f"Exported {file_path} ({len(raw_bytes)} bytes)")

    print("Export complete!")

if __name__ == "__main__":
    main()
