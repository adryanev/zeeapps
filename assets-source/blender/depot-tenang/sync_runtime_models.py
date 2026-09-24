"""Compress the Blender GLBs used by DepotTenang3D into the web app."""

from pathlib import Path
import re
import subprocess


ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / "assets-source/blender/depot-tenang/exports"
TARGET = ROOT / "public/assets/depot-tenang-3d"
GAME = ROOT / "src/game/DepotTenang3D.ts"
GLTF_TRANSFORM = ROOT / "node_modules/.bin/gltf-transform"

match = re.search(r"const MODEL_NAMES = \[(.*?)\] as const", GAME.read_text(), re.S)
if match is None:
    raise RuntimeError("DepotTenang3D MODEL_NAMES is missing")

names = set(re.findall(r'"([\w-]+)"', match.group(1)))
if not GLTF_TRANSFORM.is_file():
    raise RuntimeError("Run npm install before syncing GLB models")
TARGET.mkdir(parents=True, exist_ok=True)
for name in sorted(names):
    source = SOURCE / f"{name}.glb"
    if not source.is_file():
        raise FileNotFoundError(source)
    subprocess.run(
        [str(GLTF_TRANSFORM), "meshopt", str(source), str(TARGET / source.name), "--level", "high"],
        check=True,
    )

for path in TARGET.glob("*.glb"):
    if path.stem not in names:
        path.unlink()

print(f"Synced {len(names)} GLB files to {TARGET}")
