"""Compatibility entry point for the measured fleet renderer.

Run build_vehicle_fleet.py to rebuild sprites, GLBs and their shared anchors.
This entry point keeps sprites and their geometry in the same build.
"""
from pathlib import Path
import runpy

runpy.run_path(str(Path(__file__).with_name("build_vehicle_fleet.py")), run_name="__main__")
