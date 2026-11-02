"""Builds the proposal: python3 pitches/westside/build.py (add STRICT=1 to fail on placeholders, banned words or orange). Runs v4/build.py."""
import runpy, pathlib
runpy.run_path(str(pathlib.Path(__file__).resolve().parent / 'v4' / 'build.py'), run_name='__main__')
