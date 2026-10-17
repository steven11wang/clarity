# Smooth-vector 汤圆 mascot. Run: python3 docs/mascot/build_soft.py
import os
D=os.path.dirname(os.path.abspath(__file__))+'/soft'
os.makedirs(D,exist_ok=True)
DEFS='''<defs>
<radialGradient id="bd" cx=".36" cy=".3" r=".85"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".55" stop-color="#FBF6EA"/><stop offset="1" stop-color="#E9DCC0"/></radialGradient>
<linearGradient id="bw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C4402F"/><stop offset="1" stop-color="#952D22"/></linearGradient>
</defs>'''
EYE='#2B211A'
def face(dy=0):
    return f'''<g transform="translate(0 {dy})">
<rect x="61" y="70" width="9" height="17" rx="4.5" fill="{EYE}"/><rect x="90" y="70" width="9" height="17" rx="4.5" fill="{EYE}"/>
<circle cx="65.5" cy="75" r="2" fill="#fff"/><circle cx="94.5" cy="75" r="2" fill="#fff"/>
<ellipse cx="52" cy="95" rx="9" ry="5.5" fill="#F29A88" opacity=".75"/><ellipse cx="108" cy="95" rx="9" ry="5.5" fill="#F29A88" opacity=".75"/>
<path d="M73 94 Q80 102 87 94" fill="none" stroke="{EYE}" stroke-width="3.2" stroke-linecap="round"/></g>'''
def body(dy=0):
    return f'''<g transform="translate(0 {dy})"><ellipse cx="80" cy="82" rx="54" ry="49" fill="url(#bd)"/>
<ellipse cx="60" cy="52" rx="14" ry="7" fill="#fff" opacity=".85" transform="rotate(-28 60 52)"/></g>'''
def limbs(dy=0):
    return f'''<g transform="translate(0 {dy})" fill="#EADBB8">
<rect x="6" y="88" width="26" height="17" rx="8.5" transform="rotate(-18 19 96)"/><rect x="128" y="88" width="26" height="17" rx="8.5" transform="rotate(18 141 96)"/>
<rect x="54" y="122" width="20" height="18" rx="8"/><rect x="86" y="122" width="20" height="18" rx="8"/></g>'''
def svg(inner,bg=None,rx=0):
    b=f'<rect width="160" height="160" rx="{rx}" fill="{bg}"/>' if bg else ''
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="240" height="240">{DEFS}{b}{inner}</svg>'
BG='#F6DDD1'
shadow='<ellipse cx="80" cy="144" rx="40" ry="5" fill="#B3382B" opacity=".14"/>'
stand=svg(shadow+limbs(0)+body(0)+face(0),BG,28)
steam='<g fill="none" stroke="#E3B9A9" stroke-width="4" stroke-linecap="round"><path d="M64 6 q-6 8 0 14 t0 14"/><path d="M96 4 q-6 8 0 14 t0 14"/></g>'
bowl='''<path d="M22 104 H138 Q138 148 80 152 Q22 148 22 104 Z" fill="url(#bw)"/><ellipse cx="80" cy="104" rx="58" ry="9" fill="#FBF6EA"/>
<path d="M22 104 H138 Q138 106 136 112 H24 Q22 106 22 104Z" fill="#B3382B" opacity="0"/><path d="M52 152 h56" stroke="#7A241B" stroke-width="6" stroke-linecap="round"/>
<path d="M34 118 Q36 132 50 140" fill="none" stroke="#fff" stroke-opacity=".25" stroke-width="4" stroke-linecap="round"/>'''
inbowl=svg(steam+f'<g transform="translate(80 104) scale(.8) translate(-80 -104) translate(0 -6)">{body(0)}{face(0)}</g>'+bowl,BG,28)
avatar=svg(f'<g transform="translate(80 84) scale(1.12) translate(-80 -84)">{body(0)}{face(0)}</g>','#B3382B',36)
sesame_bits='<g fill="#4A3B30"><ellipse cx="88" cy="38" rx="9" ry="5" transform="rotate(20 88 38)"/><ellipse cx="102" cy="46" rx="6" ry="3.5" transform="rotate(35 102 46)"/></g><g fill="#7a6858"><ellipse cx="86" cy="36" rx="2.5" ry="1.4"/><ellipse cx="100" cy="45" rx="1.8" ry="1"/></g><path d="M80 34 Q90 30 98 40" fill="none" stroke="#E0D0AE" stroke-width="2" stroke-linecap="round"/>'
sesame=svg(shadow+limbs(0)+body(0)+sesame_bits+face(0),BG,28)
V={'tangyuan-stand':stand,'tangyuan-bowl':inbowl,'tangyuan-avatar':avatar,'tangyuan-sesame':sesame}
for k,v in V.items(): open(f'{D}/{k}.svg','w').write(v)
cards=[('tangyuan-stand','1 · Standing','Soft round dumpling, tall rounded-square eyes and stub limbs (the terminal-critter nod), blush, small smile.'),('tangyuan-bowl','2 · In the bowl','Sitting in a vermilion soup bowl with steam.'),('tangyuan-avatar','3 · Avatar','Face only on vermilion for app icon / chat avatar.'),('tangyuan-sesame','4 · Sesame','Black-sesame filling peeking out, for streaks / rewards.')]
h='<!doctype html><meta charset="utf-8"><title>汤圆 mascot · soft</title><style>body{margin:0;padding:32px 24px;background:#F2EEE3;font:14px system-ui;color:#14110C}h1{font:600 22px Georgia,serif;margin:0 0 4px}.s{color:#6b6456;margin:0 0 24px}.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:18px;max-width:1100px}.c{background:#FBF8F1;border:1px solid #e0d9c8;border-radius:16px;padding:16px}.c svg{display:block;margin:0 auto}h2{font-size:14px;margin:12px 0 2px}p{margin:0;color:#6b6456;font-size:13px}.sm{display:flex;gap:10px;align-items:end;justify-content:center;margin-top:10px}</style><h1>汤圆 · Clarity mascot (smooth vector)</h1><p class="s">Shown at 240 / 64 / 32 / 16px.</p><div class="g">'
for k,n,d in cards:
    s=V[k]; sm=''.join(s.replace('width="240" height="240"',f'width="{z}" height="{z}"') for z in (64,32,16))
    h+=f'<div class="c">{s}<h2>{n}</h2><p>{d}</p><div class="sm">{sm}</div></div>'
open(f'{D}/concepts.html','w').write(h+'</div>')
