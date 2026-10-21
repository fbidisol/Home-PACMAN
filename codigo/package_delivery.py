from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED

r=Path(__file__).parent
with ZipFile(r/'dist/IDISOL_Juego_Wix.zip','w',ZIP_DEFLATED) as z:
    z.write(r/'dist/IDISOL_Wix.html','IDISOL_Wix.html')
    z.write(r/'README.md','LEEME.md')
    z.write(r/'dist/index.html','web/index.html')
    for p in (r/'dist/audio').iterdir():z.write(p,'web/audio/'+p.name)
    for name in ['engine.mjs','app.mjs','shell.html','art.json','build.py','package_delivery.py','visuals.mjs','audio.mjs','engine.test.mjs','runtime.test.mjs','touch.test.mjs','visuals.test.mjs','audio.test.mjs','test-support.mjs']:
        z.write(r/name,'codigo/'+name)
    for folder in ['reference','audio']:
        for p in sorted((r/folder).iterdir()):z.write(p,'codigo/'+folder+'/'+p.name)
print('Paquete Wix actualizado')
