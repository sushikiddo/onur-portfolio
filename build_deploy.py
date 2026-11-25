"""Cloudflare Pages yayın klasörü: python build_deploy.py  ->  .deploy/

Klasik site (kökteki sayfalar, assets, _worker.js, admin) + 3D Kömür'ün Masası v3 (world/dist-masa).
"/" Anasayfa'ya (/anasayfa.html) yönlenir, 3D Kömür'ün Masası "/3d" yolunda sunulur (.deploy/index.html).
Yayın: npx wrangler pages deploy .deploy --project-name onurcanorhan --branch main --commit-dirty=true
"""
import pathlib, shutil, subprocess, sys

root = pathlib.Path(__file__).parent
out = root / ".deploy"
world = root / "world"

if "--skip-build" not in sys.argv:
    subprocess.run("npm run build:masa", cwd=world, shell=True, check=True)

dist = world / "dist-masa"
if not (dist / "index.html").exists():
    sys.exit("world/dist-masa bulunamadı: önce world içinde npm run build:masa çalıştır")

skip_dirs = {"tests", "world", "node_modules"}
skip_files = {"build_zip.py", "build_deploy.py", "README.md"}

if out.exists():
    shutil.rmtree(out)
out.mkdir()

count = 0
for p in sorted(root.rglob("*")):
    rel = p.relative_to(root)
    if p.is_dir() or rel.parts[0] in skip_dirs or any(part.startswith(".") for part in rel.parts) \
            or p.name in skip_files or p.suffix in {".zip", ".PDF", ".py"}:
        continue
    target = out / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(p, target)
    count += 1

for p in sorted(dist.rglob("*")):
    if p.is_dir() or p.suffix == ".wav" or p.name == "license.md":
        continue
    rel = p.relative_to(dist)
    target = out / rel
    if target.exists() and rel.as_posix() != "index.html":
        sys.exit(f"Çakışma: {rel} hem klasik sitede hem 3D dünyada var")
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(p, target)
    count += 1

too_big = [p for p in out.rglob("*") if p.is_file() and p.stat().st_size > 25 * 1024 * 1024]
if too_big:
    sys.exit("25 MB sınırını aşan dosyalar: " + ", ".join(str(p.relative_to(out)) for p in too_big))

size = sum(p.stat().st_size for p in out.rglob("*") if p.is_file())
print(f"{out}: {count} dosya, {size / 1e6:.2f} MB")
