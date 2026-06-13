import subprocess
import sys
from pathlib import Path

# Find the root directory
ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT_DIR / "scripts"

def run_script(script_path):
    print(f"\n{'='*50}")
    print(f"🚀 RUNNING: {script_path.name}")
    print(f"{'='*50}")
    
    # Run the script using the current Python environment
    result = subprocess.run([sys.executable, str(script_path)])
    
    # Check if the script failed
    if result.returncode != 0:
        print(f"\n❌ Error encountered while running {script_path.name}. Halting pipeline.")
        sys.exit(1)

def main():
    print("Initializing Data Pipeline...")
    
    # Define the strict execution order
    pipeline_steps = [
        SCRIPTS_DIR / "extract.py",
        SCRIPTS_DIR / "smoother.py",
        SCRIPTS_DIR / "converter.py" # (This is the npz_to_json script you renamed)
    ]

    # Verify all scripts exist before starting
    for script in pipeline_steps:
        if not script.exists():
            print(f"❌ Error: Cannot find {script}. Check your file paths.")
            sys.exit(1)

    # Execute them one by one
    for script in pipeline_steps:
        run_script(script)

    print("\n" + "="*50)
    print("✅ PIPELINE COMPLETED SUCCESSFULLY!")
    print("You can now run: python prototype/visualize.py")
    print("="*50 + "\n")

if __name__ == "__main__":
    main()