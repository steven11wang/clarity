# Hand-inked manga-style 汤圆 (thick wobbly ink line, watercolour + pencil fill). Run: python3 docs/mascot/build_manga.py
import os
D=os.path.dirname(os.path.abspath(__file__))+'/manga';os.makedirs(D,exist_ok=True)
INK='#14110C'
DEFS=f'''<defs>
<filter id="wob" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="2" seed="7" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="5"/></filter>
<filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="2"/><feColorMatrix type="matrix" values="0 0 0 0 .55  0 0 0 0 .4  0 0 0 0 .3  0 0 0 .9 -.25"/></filter>
<filter id="streak" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".012 .22" numOctaves="3" seed="4"/><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .9 -.35"/></filter>
<filter id="soft"><feGaussianBlur stdDeviation="3"/></filter>
<radialGradient id="wash" cx=".38" cy=".32" r=".8"><stop offset="0" stop-color="#FFF3DF"/><stop offset=".6" stop-color="#F8DDBB"/><stop offset="1" stop-color="#EBB992"/></radialGradient>
<linearGradient id="bowlg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#D4553F"/><stop offset="1" stop-color="#9B2F22"/></linearGradient>
<pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(38)"><line x1="0" y1="0" x2="0" y2="5" stroke="#D9674E" stroke-width="1.1" opacity=".55"/></pattern>
<radialGradient id="shm" cx=".8" cy=".85" r=".6"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/></radialGradient>
<mask id="shade"><rect width="200" height="200" fill="url(#shm)"/></mask>
<clipPath id="cb"><ellipse cx="100" cy="98" rx="64" ry="58"/></clipPath>
</defs>'''
def ink(w=5):return f'stroke="{INK}" stroke-width="{w}" stroke-linejoin="round" stroke-linecap="round"'
def character(sweat=True,limbs=True,mouth='o'):
    o=[]
    if limbs:
        o+=[f'<rect x="76" y="148" width="20" height="20" rx="8" fill="#F2CFA8" {ink()}/>',f'<rect x="106" y="148" width="20" height="20" rx="8" fill="#F2CFA8" {ink()}/>',
            f'<ellipse cx="34" cy="116" rx="13" ry="9" transform="rotate(-25 34 116)" fill="#F2CFA8" {ink()}/>',f'<ellipse cx="168" cy="116" rx="13" ry="9" transform="rotate(25 168 116)" fill="#F2CFA8" {ink()}/>']
    o+=[f'<ellipse cx="100" cy="98" rx="64" ry="58" fill="url(#wash)"/>',
        '<g clip-path="url(#cb)"><rect width="200" height="200" fill="url(#hatch)" mask="url(#shade)"/><rect width="200" height="200" filter="url(#grain)" opacity=".5"/></g>',
        f'<ellipse cx="100" cy="98" rx="64" ry="58" fill="none" {ink()}/>',
        '<ellipse cx="60" cy="114" rx="15" ry="9.5" fill="#EE5A55" opacity=".7" filter="url(#soft)"/><ellipse cx="140" cy="114" rx="15" ry="9.5" fill="#EE5A55" opacity=".7" filter="url(#soft)"/>',
        f'<ellipse cx="80" cy="98" rx="4" ry="5.5" fill="{INK}"/><ellipse cx="120" cy="98" rx="4" ry="5.5" fill="{INK}"/>',
        f'<path d="M68 84 q9 -6 17 -2 M115 82 q9 -4 17 2" fill="none" {ink(3.6)}/>']
    if mouth=='o': o.append(f'<ellipse cx="100" cy="118" rx="8" ry="5.5" fill="#E8453C" {ink(3.4)}/>')
    else: o.append(f'<path d="M88 114 q12 12 24 0" fill="#E8453C" {ink(3.4)}/>')
    o+=['<path d="M54 74 Q66 56 88 50" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round"/><circle cx="50" cy="86" r="3.2" fill="#fff"/><path d="M130 52 q8 3 12 9" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round" opacity=".9"/>']
    if sweat: o.append(f'<path d="M152 66 q-9 13 0 19 q9 -6 0 -19z" fill="#BFE3F2" stroke="{INK}" stroke-width="3.4" stroke-linejoin="round"/><path d="M151 76 q-2 4 0 6" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/>')
    return '<g filter="url(#wob)">'+''.join(o)+'</g>'
def bowl():
    return f'''<g filter="url(#wob)"><path d="M26 112 H174 Q172 170 100 178 Q28 170 26 112Z" fill="url(#bowlg)" {ink()}/>
<ellipse cx="100" cy="112" rx="74" ry="11" fill="#FFF3DF" {ink()}/><path d="M44 128 Q48 150 66 160" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".7"/>
<path d="M70 178 h60" stroke="{INK}" stroke-width="7" stroke-linecap="round"/></g>'''
def steam():
    return f'<g filter="url(#wob)" fill="none" stroke="{INK}" stroke-width="3.6" stroke-linecap="round"><path d="M78 20 q-9 11 0 20 t0 20"/><path d="M118 12 q-9 11 0 20 t0 20"/></g>'
def wrap(inner,bg,size,rx=0):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="{size}" height="{size}">{DEFS}<rect width="200" height="200" rx="{rx}" fill="{bg}"/>{inner}</svg>'
def black_bg():
    return '<rect width="200" height="200" fill="#1a1612"/><rect width="200" height="200" filter="url(#streak)" opacity=".18"/>'
stand=wrap(black_bg()+character(),'#1a1612',320)
sc_bowl=wrap('<rect width="200" height="200" fill="#F3E4C6"/><rect width="200" height="200" filter="url(#grain)" opacity=".25"/>'+steam()+'<g transform="translate(100 98) scale(.74) translate(-100 -112) translate(0 -22)">'+character(False,False,'smile')+'</g>'+bowl(),'#F3E4C6',320)
face=wrap('<rect width="200" height="200" fill="#B3382B"/><rect width="200" height="200" filter="url(#grain)" opacity=".3"/><g transform="translate(100 100) scale(1.15) translate(-100 -98)">'+character(False,False)+'</g>','#B3382B',320,40)
open(f'{D}/tangyuan-manga-stand.svg','w').write(stand);open(f'{D}/tangyuan-manga-bowl.svg','w').write(sc_bowl);open(f'{D}/tangyuan-manga-avatar.svg','w').write(face)
bubble='<div style="width:62px;height:120px;background:#fff;border:4px solid #14110C;border-radius:50%;display:flex;align-items:center;justify-content:center;line-height:1.1"><span style="writing-mode:vertical-rl;font:700 22px Hiragino Mincho ProN,Songti SC,serif;color:#14110C">好烫……</span></div>'
h=f'''<!doctype html><meta charset="utf-8"><title>汤圆 · manga</title><style>body{{margin:0;padding:28px 20px;background:#F2EEE3;font:14px system-ui;color:#14110C}}h1{{font:600 22px Georgia,serif;margin:0 0 4px}}.s{{color:#6b6456;margin:0 0 20px}}.row{{display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start}}.p{{border:5px solid #14110C;background:#fff;position:relative;line-height:0}}.p .b{{position:absolute;left:10px;top:10px}}figure{{margin:0}}figcaption{{font-size:12px;color:#6b6456;margin-top:6px}}.sm{{display:flex;gap:10px;margin-top:14px;align-items:end}}</style>
<h1>汤圆 · hand-inked manga style</h1><p class="s">Thick wobbly ink line, watercolour wash with pencil hatching, blush, white highlight strokes (after your reference).</p>
<div class="row"><figure><div class="p">{stand}<div class="b">{bubble}</div></div><figcaption>1 · Panel: 好烫……</figcaption></figure>
<figure><div class="p">{sc_bowl}</div><figcaption>2 · In the bowl</figcaption></figure>
<figure><div class="p">{face}</div><figcaption>3 · Avatar</figcaption></figure></div>
<div class="sm">{face.replace('width="320" height="320"','width="64" height="64"')}{face.replace('width="320" height="320"','width="32" height="32"')}{face.replace('width="320" height="320"','width="16" height="16"')}</div>'''
open(f'{D}/concepts.html','w').write(h)
