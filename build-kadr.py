from pathlib import Path
from zipfile import ZipFile
destination=Path("public");destination.mkdir(exist_ok=True)
with ZipFile("kadr-demo.zip") as bundle:
    for info in bundle.infolist():
        target=(destination/info.filename).resolve()
        if not target.is_relative_to(destination.resolve()): raise ValueError("Unsafe archive path")
    bundle.extractall(destination)
assert (destination/"kadr/index.html").exists()
print("KADR standalone demo ready")
