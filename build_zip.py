"""Teslim ZIP'i: python build_zip.py OGRENCI_NO  ->  OGRENCI_NO-WEB.zip (+ .PDF kopyasi)"""
import sys, zipfile, shutil, pathlib

no = sys.argv[1] if len(sys.argv) > 1 else "OGRENCI_NO"
root = pathlib.Path(__file__).parent
skip_dirs = {".git", "admin", "tests", "node_modules"}
skip_files = {"_worker.js", "_redirects", "build_zip.py", "build_deploy.py", "README.md"}
out = root / f"{no}-WEB.zip"
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for p in sorted(root.rglob("*")):
        rel = p.relative_to(root)
        # Dot folders/files (.git, .wrangler with Cloudflare account data, .gitignore) never ship.
        # world/: only the 3D source goes in (no node_modules or build output).
        if p.is_dir() or rel.parts[0] in skip_dirs or any(part.startswith(".") for part in rel.parts) \
                or "node_modules" in rel.parts or rel.parts[:2] in {("world", "dist"), ("world", "dist-masa")} or p.suffix == ".wav" \
                or p.name in skip_files or p.suffix in {".zip", ".PDF"}:
            continue
        if p.suffix == ".html":  # in the delivered ZIP the 3D world link must point to the live site (/ is not the classic home there)
            z.writestr(rel.as_posix(), p.read_text(encoding="utf-8").replace('href="/"', 'href="https://onurcanorhan.pages.dev/"'))
        else:
            z.write(p, rel.as_posix())
# The classic home moved to anasayfa.html ("/" is the 3D world on the live site); the delivered ZIP still needs a root index.html.
with zipfile.ZipFile(out, "a", zipfile.ZIP_DEFLATED) as z:
    z.writestr("index.html", '<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=anasayfa.html"><title>Onur Can Orhan</title></head><body><a href="anasayfa.html">Anasayfa</a></body></html>')
shutil.copy(out, out.with_suffix(".PDF"))
print(out, round(out.stat().st_size / 1e6, 2), "MB")
