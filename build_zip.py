"""Teslim ZIP'i: python build_zip.py OGRENCI_NO  ->  OGRENCI_NO-WEB.zip (+ .PDF kopyasi)"""
import sys, zipfile, shutil, pathlib

no = sys.argv[1] if len(sys.argv) > 1 else "OGRENCI_NO"
root = pathlib.Path(__file__).parent
skip_dirs = {".git", "admin", "tests", "node_modules"}
skip_files = {"_worker.js", "_redirects", "build_zip.py", "README.md"}
out = root / f"{no}-WEB.zip"
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for p in sorted(root.rglob("*")):
        rel = p.relative_to(root)
        # Dot folders/files (.git, .wrangler with Cloudflare account data, .gitignore) never ship.
        if p.is_dir() or rel.parts[0] in skip_dirs or any(part.startswith(".") for part in rel.parts) \
                or p.name in skip_files or p.suffix in {".zip", ".PDF"}:
            continue
        z.write(p, rel.as_posix())
shutil.copy(out, out.with_suffix(".PDF"))
print(out, round(out.stat().st_size / 1e6, 2), "MB")
