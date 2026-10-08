from pathlib import Path
from zipfile import ZipFile
destination=Path("public")
destination.mkdir(exist_ok=True)
with ZipFile("sites-bundle.zip") as bundle:
    for info in bundle.infolist():
        target=(destination/info.filename).resolve()
        if not target.is_relative_to(destination.resolve()):
            raise ValueError("Unsafe archive path")
    bundle.extractall(destination)
for site in ("north","signal","forma","sever","turbo"):
    assert (destination/site/"index.html").exists()
print("Five static portfolio projects ready")
