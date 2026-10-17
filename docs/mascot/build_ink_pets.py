# The seven accessory pets in the 汤圆 ink style -> public/avatars/*.svg. Run: python3 docs/mascot/build_ink_pets.py
import os,sys
HERE=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,HERE)
import build_ink as b
ROOT=os.path.abspath(HERE+'/../..'); OUT=ROOT+'/public/avatars'
INK=b.INK; S=b.S; BODY=b.BODY
def eyes(kind):
    if kind=='rect': return f'<rect x="61" y="70" width="9" height="17" rx="4.5" fill="{INK}"/><rect x="90" y="70" width="9" height="17" rx="4.5" fill="{INK}"/>'
    if kind=='happy': return f'<path d="M58 84 q7.5 -13 15 0 M87 84 q7.5 -13 15 0" fill="none" {S(4)}/>'
    if kind=='sleep': return f'<path d="M58 79 q7.5 7 15 0 M87 79 q7.5 7 15 0" fill="none" {S(4)}/>'
def face(kind,mouth='smile'):
    m=f'<path d="M73 94 Q80 102 87 94" fill="none" {S(3.4)}/>' if mouth=='smile' else f'<ellipse cx="80" cy="97" rx="3.6" ry="2.8" fill="{INK}"/>'
    return eyes(kind)+f'<ellipse cx="52" cy="95" rx="9" ry="5.5" fill="{b.BLUSH}"/><ellipse cx="108" cy="95" rx="9" ry="5.5" fill="{b.BLUSH}"/>'+m
CAP='#3B332B'; GOLD='#E3B53C'; RED='#B3382B'
PETS={
 'scholar':('Scholar','#E5DCC6','rect','smile',
   f'<path d="M54 36 v16 q26 11 52 0 v-16Z" fill="{CAP}" {S(4)}/><path d="M80 12 L130 28 L80 44 L30 28Z" fill="{CAP}" {S(4)}/><path d="M126 30 V58" fill="none" stroke="{GOLD}" stroke-width="4" stroke-linecap="round"/><circle cx="126" cy="61" r="5" fill="{RED}" {S(3)}/>',''),
 'specs':('Specs','#F0D9CF','rect','smile','',
   f'<circle cx="64" cy="79" r="14" fill="#CFE6F2" fill-opacity=".55" {S(4)}/><circle cx="96" cy="79" r="14" fill="#CFE6F2" fill-opacity=".55" {S(4)}/><path d="M78 77 q2 -3 4 0 M50 76 L32 71 M110 76 L128 71" fill="none" {S(4)}/>'),
 'beats':('Beats','#D5DEE6','happy','smile','',
   f'<path d="M28 80 Q28 26 80 26 Q132 26 132 80" fill="none" stroke="{INK}" stroke-width="12" stroke-linecap="round"/><path d="M28 80 Q28 26 80 26 Q132 26 132 80" fill="none" stroke="#6C655B" stroke-width="5" stroke-linecap="round"/><rect x="16" y="64" width="20" height="38" rx="9" fill="{RED}" {S(4)}/><rect x="124" y="64" width="20" height="38" rx="9" fill="{RED}" {S(4)}/>'),
 'nap':('Nap','#DCE7E1','sleep','o','',
   f'<path d="M108 24 h14 l-14 16 h14 M126 8 h9 l-9 10 h9" fill="none" {S(3.6)}/>'),
 'spark':('Spark','#F1E3B8','happy','smile','',
   f'<path d="M122 14 L127 26 L139 31 L127 36 L122 48 L117 36 L105 31 L117 26Z" fill="{GOLD}" {S(3.4)}/><path d="M40 28 L43 36 L51 39 L43 42 L40 50 L37 42 L29 39 L37 36Z" fill="{GOLD}" {S(3)}/>'),
 'reader':('Reader','#EBD0C7','rect','smile','',
   f'<path d="M34 108 L80 118 L126 108 V148 L80 158 L34 148Z" fill="{RED}" {S(4)}/><path d="M42 114 L80 122 V150 L42 142Z M118 114 L80 122 V150 L118 142Z" fill="#FFFDF6" {S(3)}/><path d="M80 122 V152" fill="none" {S(3)}/>'),
 'streak':('Streak','#F2D6CA','happy','smile',
   f'<path d="M80 2 C94 16 104 22 100 38 C98 48 62 48 60 38 C56 22 68 16 80 2Z" fill="#E8743B" {S(4)}/><path d="M80 20 C87 28 89 33 86 39 C84 43 76 43 74 39 C71 33 74 28 80 20Z" fill="#F3C54B" {S(2.6)}/>',''),
}
def pet(id):
    label,bg,ek,mk,back,front=PETS[id]
    inner=f'<g transform="translate(80 92) scale(.96) translate(-80 -88)"><g filter="url(#wob)">{b.body()}{face(ek,mk)}{back}{front}</g></g>'
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="128" height="128" role="img" aria-label="{label}">{b.DEFS}<rect width="160" height="160" fill="{bg}"/>{inner}</svg>'
for id in PETS:
    open(f'{OUT}/{id}.svg','w').write(pet(id))
# preview sheet
NAMES={**{k:v[0] for k,v in PETS.items()},'clawd':'Tangyuan'}
cards=''.join(f'<figure style="margin:0;text-align:center"><img src="../../public/avatars/{i}.svg" width="120" style="border-radius:50%"><figcaption style="font:12px system-ui">{NAMES.get(i)}</figcaption></figure>' for i in ['clawd']+list(PETS))
open(HERE+'/ink/pets.html','w').write(f'<!doctype html><meta charset="utf-8"><title>pets</title><body style="background:#F2EEE3;padding:24px"><div style="display:flex;gap:16px;flex-wrap:wrap">{cards}</div>')
