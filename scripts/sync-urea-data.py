import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT = (
    ROOT.parent.parent / "Desktop" / "G drive" / "ART" /
    "ART-Urea-IL-Visual-Library" / ".obsidian" / "plugins" /
    "urea-il-visual-library" / "data.json"
)
SOURCE = Path(os.environ.get("UREA_VAULT_DATA", str(DEFAULT)))
TARGET = ROOT / "manual-site" / "manual-data.json"

PUBLIC_KEYS = [
    "schemaVersion", "project", "tails", "intermediates",
    "singleCore", "doubleCore", "controlCore",
]

if not SOURCE.exists():
    raise SystemExit(
        "UREA source data not found. Set UREA_VAULT_DATA to the plugin data.json path."
    )

with SOURCE.open("r", encoding="utf-8") as f:
    data = json.load(f)
public_data = {key: data[key] for key in PUBLIC_KEYS if key in data}
TARGET.parent.mkdir(parents=True, exist_ok=True)
with TARGET.open("w", encoding="utf-8") as f:
    json.dump(public_data, f, ensure_ascii=False, separators=(",", ":"))

single = len(public_data.get("singleCore", {}).get("cards", []))
double = len(public_data.get("doubleCore", {}).get("cards", []))
control = len(public_data.get("controlCore", {}).get("cards", []))
print(f"Synced UREA Manual data: single={single}, double={double}, control={control}")
print(f"Output: {TARGET}")
