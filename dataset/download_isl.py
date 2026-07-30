import subprocess
from pathlib import Path

OUTPUT_DIR = Path(r"C:\Users\shariff\Downloads\CVIT\CVIT\ISL-AVATAR\ISL-AVATAR-PROJECT\dataset")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

VIDEOS = {
    "Like": "https://divyangjan.depwd.gov.in/islrtc/search.php?type=list&id=1986&search=Like",
    "Good": "https://divyangjan.depwd.gov.in/islrtc/search.php?type=list&id=1418&search=Good",

    "White": "https://divyangjan.depwd.gov.in/islrtc/search.php?type=list&id=3704&search=White",
    "Today": "https://divyangjan.depwd.gov.in/islrtc/search.php?type=list&id=3420&search=Today",
    "Tomorrow": "https://divyangjan.depwd.gov.in/islrtc/search.php?type=list&id=3431&search=Tomorrow",
    "Yesterday": "https://divyangjan.depwd.gov.in/islrtc/search.php?type=list&id=3774&search=Yesterday",
    "Morning": "https://divyangjan.depwd.gov.in/islrtc/search.php?type=list&id=2176&search=Morning",
    "Night": "https://divyangjan.depwd.gov.in/islrtc/search.php?type=list&id=2276&search=Night",
    "Day": "https://divyangjan.depwd.gov.in/islrtc/search.php?type=list&id=927&search=Day",
    "Week": "https://divyangjan.depwd.gov.in/islrtc/search.php?type=list&id=3671&search=Week,%20One%20Week",
    "Year": "https://divyangjan.depwd.gov.in/islrtc/search.php?type=list&id=3766&search=Year",

    "Water": "https://divyangjan.depwd.gov.in/islrtc/search.php?type=list&id=3639&search=Water",
    "Food": "https://divyangjan.depwd.gov.in/islrtc/search.php?type=list&id=1276&search=Food",
    "Book": "https://divyangjan.depwd.gov.in/islrtc/search.php?type=list&id=474&search=Book",
    "Pen": "https://divyangjan.depwd.gov.in/islrtc/search.php?type=list&id=2485&search=Pen",
    "Door": "https://divyangjan.depwd.gov.in/islrtc/search.php?type=list&id=1054&search=Door",
    "Chair": "https://divyangjan.depwd.gov.in/islrtc/search.php?type=list&id=685&search=Chair",
    "Table": "https://divyangjan.depwd.gov.in/islrtc/search.php?type=list&id=3314&search=Table,%20Desk",
    "Bus": "https://divyangjan.depwd.gov.in/islrtc/search.php?type=list&id=568&search=Bus",
    "Car": "https://divyangjan.depwd.gov.in/islrtc/search.php?type=list&id=624&search=Car",
    "Phone": "https://divyangjan.depwd.gov.in/islrtc/search.php?type=list&id=2523&search=Phone",

    "Who": "https://divyangjan.depwd.gov.in/islrtc/search.php?type=list&id=3706&search=Who,%20Whom",
    "When": "https://divyangjan.depwd.gov.in/islrtc/search.php?type=list&id=3697&search=When%20(For%20Days)",
    "Where": "https://divyangjan.depwd.gov.in/islrtc/search.php?type=list&id=3698&search=Where",
    "Why": "https://divyangjan.depwd.gov.in/islrtc/search.php?type=list&id=3707&search=Why",

    "Big": "https://divyangjan.depwd.gov.in/islrtc/search.php?type=list&id=423&search=Big",
    "Small": "https://divyangjan.depwd.gov.in/islrtc/search.php?type=list&id=3118&search=Small",
    "Hot": "https://divyangjan.depwd.gov.in/islrtc/search.php?type=list&id=1611&search=Hot",
    "Cold": "https://divyangjan.depwd.gov.in/islrtc/search.php?type=list&id=787&search=Cold%20(Weather)",
    "New": "https://divyangjan.depwd.gov.in/islrtc/search.php?type=list&id=2260&search=New",
}

for name, url in VIDEOS.items():
    print(f"\nDownloading {name}...")

    subprocess.run([
        "py", "-m", "yt_dlp",
        "--embed-metadata",
        "--no-playlist",
        "-o", str(OUTPUT_DIR / f"{name}.%(ext)s"),
        url
    ])

print("\nDone!")