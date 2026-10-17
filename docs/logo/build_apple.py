# Apple-style silhouettes of the open seal. Run: python3 docs/logo/build_apple.py
import math,os
D=os.path.dirname(os.path.abspath(__file__))+'/apple';os.makedirs(D,exist_ok=True)
def squircle(cx,cy,r,n=5,k=96):
    pts=[]
    for i in range(k):
        t=2*math.pi*i/k;c,s=math.cos(t),math.sin(t)
        pts.append((cx+r*math.copysign(abs(c)**(2/n),c),cy+r*math.copysign(abs(s)**(2/n),s)))
    return 'M'+' L'.join(f'{x:.2f} {y:.2f}' for x,y in pts)+'Z'
SQ=squircle(32,37,23)
BITE=(51,22,10)
def leaf(x,y,s,rot):
    h=s/2
    return f'<path transform="rotate({rot} {x+h} {y+h})" d="M{x} {y} H{x+h} A{h} {h} 0 0 1 {x+s} {y+h} V{y+s} H{x+h} A{h} {h} 0 0 1 {x} {y+h}Z"/>'
def svg(inner,bg=None,fg='#B3382B'):
    b=f'<rect width="64" height="64" rx="14" fill="{bg}"/>' if bg else ''
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="240" height="240" role="img" aria-label="Clarity">{b}<g fill="{fg}">{inner}</g></svg>'
mask=lambda i:f'<mask id="m{i}"><rect width="64" height="64" fill="#fff"/><circle cx="{BITE[0]}" cy="{BITE[1]}" r="{BITE[2]}" fill="#000"/></mask>'
def v1(fg='#B3382B',hole='#F7F1E6'):  # bite + knocked-out square
    return f'<defs>{mask(1)}</defs><path d="{SQ}" mask="url(#m1)"/><rect x="27" y="32" width="10" height="10" fill="{hole}"/>'
def v2(): # bite + leaf, solid
    return f'<defs>{mask(2)}</defs><path d="{SQ}" mask="url(#m2)"/>{leaf(30,3,10,-8)}'
def v3(fg='#B3382B'): # outline frame with bite, solid centre
    return f'<defs>{mask(3)}</defs><path d="{squircle(32,37,20)}" fill="none" stroke="{fg}" stroke-width="5" mask="url(#m3)"/><rect x="27" y="32" width="10" height="10" rx="2"/>{leaf(30,3,10,-8)}'
V={'bite':(svg(v1()),'1 · Bite','Solid squircle with a circular bite where the seal opened; the inner square knocked out. Pure silhouette, no tile.'),
 'bite-leaf':(svg(v2()),'2 · Bite + leaf','Silhouette plus a leaf cut from the seal square. Most Apple-like; the leaf is the identifier.'),
 'frame':(svg(v3()),'3 · Open frame','Closest to your seal: frame, solid centre square, bite, leaf.'),
 'reverse':(svg('<g transform="translate(32 33) scale(.66) translate(-32 -33)">'+v1(hole='#B3382B').replace('<path d=','<path fill="#F7F1E6" d=',1)+'</g>','#B3382B','#F7F1E6'),'4 · Reverse','Bite seal in paper on a vermilion tile (app icon).')}
_old={'x':(svg(v2().replace('<path d=','<path fill="#F7F1E6" d=',1).replace('<path transform','<path fill="#F7F1E6" transform'),'#B3382B','#F7F1E6'),'4 · Reverse','Bite + leaf in paper on vermilion tile (app icon).')}
for k,(s,_,_) in V.items(): open(f'{D}/clarity-{k}.svg','w').write(s)
h='<!doctype html><meta charset="utf-8"><title>Clarity · Apple-style</title><style>body{margin:0;padding:32px 24px;background:#F7F1E6;font:14px system-ui;color:#14110C}h1{font:600 22px Georgia,serif;margin:0 0 4px}.s{color:#6b6456;margin:0 0 24px}.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:18px;max-width:1100px}.c{background:#FBF8F1;border:1px solid #e0d9c8;border-radius:16px;padding:16px}.c svg{display:block;margin:0 auto}h2{font-size:14px;margin:12px 0 2px}p{margin:0;color:#6b6456;font-size:13px}.sm{display:flex;gap:12px;align-items:end;justify-content:center;margin-top:10px;padding:10px;border-radius:10px}.k{background:#14110C}</style><h1>Clarity · Apple-style mark</h1><p class="s">One bold silhouette, no container. Shown at 240 / 48 / 32 / 16px, light and dark.</p><div class="g">'
for k,(s,n,d) in V.items():
    def sm(fgdark):
        t=s if not fgdark or k=='reverse' else s.replace('#B3382B','#F7F1E6').replace('fill="#F7F1E6"/></g>','fill="#14110C"/></g>')
        return ''.join(t.replace('width="240" height="240"',f'width="{z}" height="{z}"').replace('id="m','id="x%d_m'%z).replace('url(#m','url(#x%d_m'%z) for z in (48,32,16))
    h+=f'<div class="c">{s}<h2>{n}</h2><p>{d}</p><div class="sm">{sm(False)}</div><div class="sm k">{sm(True)}</div></div>'
open(f'{D}/concepts.html','w').write(h+'</div>')
