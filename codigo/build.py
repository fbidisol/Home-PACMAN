from pathlib import Path
import json,re,shutil
root=Path(__file__).parent
parts=[]
for name in ['engine.mjs','visuals.mjs','audio.mjs','app.mjs']:
    src=(root/name).read_text()
    src=re.sub(r'^export ', '',src,flags=re.M)
    src=re.sub(r'^import .*?;\n','',src,flags=re.M)
    parts.append(src)
art=json.loads((root/'art.json').read_text())
art.pop('digits',None)
paths=[f'audio/idisol-{v}-20s.mp3' for v in [3,4,5]]
def html(data):
    code='(()=>{\n"use strict";\nconst ART='+json.dumps(data,separators=(',',':'))+';\n'+'\n'.join(parts)+'\n})();'
    assert '</script' not in code.lower()
    return (root/'shell.html').read_text().replace('/*__BUNDLE__*/',code)
(root/'dist').mkdir(exist_ok=True)
(root/'dist/audio').mkdir(exist_ok=True)
for path in paths:shutil.copy(root/path,root/'dist'/path)
hosted={**art,'audioUrls':paths};hosted.pop('audios',None)
(root/'dist/index.html').write_text(html(hosted))
standalone={**art,'audioUrls':['https://idisol-juego.felipe786089.chatgpt.site/'+p for p in paths]}
(root/'dist/IDISOL_Wix.html').write_text(html(standalone))
print('HTML web:',(root/'dist/index.html').stat().st_size,'bytes; HTML Wix:',(root/'dist/IDISOL_Wix.html').stat().st_size,'bytes')
