# 汤圆: flat single-colour fills + thick wobbly marker outline. Run: python3 docs/mascot/build_ink.py
import os
D=os.path.dirname(os.path.abspath(__file__))+'/ink';os.makedirs(D,exist_ok=True)
INK='#14110C'; BODY='#FBF1DB'; BLUSH='#F29A88'; BOWL='#B3382B'; BG='#F6DDD1'
DEFS='<defs><filter id="wob" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".04" numOctaves="2" seed="5" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="3.5"/></filter></defs>'
def S(w=4.5):return f'stroke="{INK}" stroke-width="{w}" stroke-linejoin="round" stroke-linecap="round"'
def limbs():
    return f'''<rect x="6" y="88" width="26" height="17" rx="8.5" transform="rotate(-18 19 96)" fill="{BODY}" {S()}/><rect x="128" y="88" width="26" height="17" rx="8.5" transform="rotate(18 141 96)" fill="{BODY}" {S()}/>
<rect x="54" y="122" width="20" height="18" rx="8" fill="{BODY}" {S()}/><rect x="86" y="122" width="20" height="18" rx="8" fill="{BODY}" {S()}/>'''
def body(): return f'<ellipse cx="80" cy="82" rx="54" ry="49" fill="{BODY}" {S(5)}/>'
def face():
    return f'''<rect x="61" y="70" width="9" height="17" rx="4.5" fill="{INK}"/><rect x="90" y="70" width="9" height="17" rx="4.5" fill="{INK}"/>
<ellipse cx="52" cy="95" rx="9" ry="5.5" fill="{BLUSH}"/><ellipse cx="108" cy="95" rx="9" ry="5.5" fill="{BLUSH}"/>
<path d="M73 94 Q80 102 87 94" fill="none" {S(3.4)}/>'''
def sesame(): return f'<ellipse cx="88" cy="38" rx="9" ry="5" transform="rotate(20 88 38)" fill="#4A3B30" {S(2.6)}/><ellipse cx="102" cy="46" rx="6" ry="3.5" transform="rotate(35 102 46)" fill="#4A3B30" {S(2.6)}/>'
def bowl(): return f'<path d="M22 104 H138 Q138 148 80 152 Q22 148 22 104 Z" fill="{BOWL}" {S()}/><ellipse cx="80" cy="104" rx="58" ry="9" fill="{BODY}" {S()}/><path d="M52 152 h56" {S(6)}/>'
steam=f'<g fill="none" {S(3.6)}><path d="M64 2 q-5 7 0 12 t0 12"/><path d="M96 0 q-5 7 0 12 t0 12"/></g>'
shadow=f'<ellipse cx="80" cy="146" rx="40" ry="5" fill="{BOWL}" opacity=".14"/>'
def svg(inner,bg,rx=28): return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="240" height="240" role="img" aria-label="汤圆">{DEFS}<rect width="160" height="160" rx="{rx}" fill="{bg}"/>{inner}</svg>'
W=lambda s:f'<g filter="url(#wob)">{s}</g>'
V={'stand':svg(shadow+W(limbs()+body()+face()),BG),
 'bowl':svg(steam and W(steam)+W('<g transform="translate(80 104) scale(.8) translate(-80 -104) translate(0 -16)">'+body()+face()+'</g>'+bowl()),BG),
 'avatar':svg(W('<g transform="translate(80 84) scale(1.12) translate(-80 -84)">'+body()+face()+'</g>'),BOWL,36),
 'sesame':svg(shadow+W(limbs()+body()+sesame()+face()),BG)}
for k,v in V.items(): open(f'{D}/tangyuan-ink-{k}.svg','w').write(v)
names={'stand':'1 · Standing','bowl':'2 · In the bowl','avatar':'3 · Avatar','sesame':'4 · Sesame'}
h='<!doctype html><meta charset="utf-8"><title>汤圆 · ink</title><style>body{margin:0;padding:28px 20px;background:#F2EEE3;font:14px system-ui;color:#14110C}h1{font:600 22px Georgia,serif;margin:0 0 4px}.s{color:#6b6456;margin:0 0 20px}.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:18px;max-width:1100px}.c{background:#FBF8F1;border:1px solid #e0d9c8;border-radius:16px;padding:16px}.c svg{display:block;margin:0 auto}h2{font-size:14px;margin:12px 0 8px}.sm{display:flex;gap:10px;align-items:end;justify-content:center}</style><h1>汤圆 · flat fill + marker outline</h1><p class="s">One flat body colour (same logic as the Claude Code mascot: single solid fill, dark eyes), thick wobbly ink outline. 240 / 64 / 32 / 16px.</p><div class="g">'
for k,v in V.items():
    sm=''.join(v.replace('width="240" height="240"',f'width="{z}" height="{z}"').replace('id="wob"',f'id="w{z}"').replace('url(#wob)',f'url(#w{z})') for z in (64,32,16))
    h+=f'<div class="c">{v}<h2>{names[k]}</h2><div class="sm">{sm}</div></div>'
open(f'{D}/concepts.html','w').write(h+'</div>')
