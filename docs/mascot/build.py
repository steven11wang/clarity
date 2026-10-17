# Builds the tangyuan mascot SVGs + preview sheet. Run: python3 docs/mascot/build.py
import os
D=os.path.dirname(os.path.abspath(__file__))
body={1:(6,9),2:(4,11),3:(3,12),4:(2,13),5:(2,13),6:(2,13),7:(2,13),8:(2,13),9:(2,13),10:(3,12),11:(4,11),12:(5,10)}
C=dict(b='#FBF6EA',s='#E6DAC0',limb='#D4C29B',eye='#2B211A',bl='#E98F7F',bowl='#B3382B',bowld='#952D22',rim='#F7F1E6',sesame='#4A3B30',steam='#E3B9A9',bg='#F1D5C8')
R=lambda x,y,w=1,h=1,f='#000':f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{f}"/>'
def tang(dy=0,legs=True,arms=True):
    o=[]
    for y,(a,b) in body.items():
        o.append(R(a,y+dy,b-a+1,1,C['b']))
        if y>=8: o.append(R(b-1,y+dy,2,1,C['s']))
        if y==12: o.append(R(a,y+dy,b-a+1,1,C['s']))
    if arms: o+=[R(0,9+dy,2,2,C['limb']),R(14,9+dy,2,2,C['limb'])]
    if legs: o+=[R(5,13+dy,2,2,C['limb']),R(9,13+dy,2,2,C['limb'])]
    o+=[R(5,6+dy,1,2,C['eye']),R(10,6+dy,1,2,C['eye']),R(3,8+dy,2,1,C['bl']),R(11,8+dy,2,1,C['bl']),R(7,8+dy,2,1,C['eye']),R(5,3+dy,2,1,'#fff')]
    return ''.join(o)
bowl=''.join([R(1,11,14,1,C['rim']),R(1,12,14,1,C['bowl']),R(2,13,12,1,C['bowl']),R(3,14,10,1,C['bowld']),R(5,15,6,1,C['bowld']),R(2,12,2,1,'#C9503F')])
def svg(inner,bg,size=240):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="{size}" height="{size}" shape-rendering="crispEdges"><rect width="16" height="16" fill="{bg}"/>{inner}</svg>'
steam=''.join(R(x,y,1,1,C['steam']) for x,y in [(5,0),(6,1),(10,0),(9,1)])
V={'tangyuan-a':svg(tang(1),C['bg']),
 'tangyuan-bowl':svg(steam+tang(-1,False,False)+bowl,C['bg']),
 'tangyuan-avatar':svg(tang(0,False,False),'#B3382B'),
 'tangyuan-sesame':svg(tang(1)+R(8,3,2,1,C['sesame'])+R(9,4,1,1,C['sesame'])+R(7,3,1,1,'#6b5a4b'),C['bg'])}
for k,v in V.items(): open(f'{D}/{k}.svg','w').write(v)
cards=[('tangyuan-a','1 · Standing','Stub arms + legs and tall square eyes (the terminal-critter half) on a round stepped-pixel dumpling body with blush and tiny smile.'),
('tangyuan-bowl','2 · In the bowl','Same body in a vermilion soup bowl, steam pixels. Pairs with the Clarity red.'),
('tangyuan-avatar','3 · Avatar','Face only on vermilion: app icon, chat avatar, favicon.'),
('tangyuan-sesame','4 · Sesame','Black-sesame filling peeking out. Variant for streaks / rewards.')]
h='<!doctype html><meta charset="utf-8"><title>汤圆 mascot</title><style>body{margin:0;padding:32px 24px;background:#F2EEE3;font:14px system-ui;color:#14110C}h1{font:600 22px Georgia,serif;margin:0 0 4px}.s{color:#6b6456;margin:0 0 24px}.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:18px;max-width:1100px}.c{background:#FBF8F1;border:1px solid #e0d9c8;border-radius:16px;padding:16px}.c svg{display:block;margin:0 auto;border-radius:12px}h2{font-size:14px;margin:12px 0 2px}p{margin:0;color:#6b6456;font-size:13px}.sm{display:flex;gap:10px;align-items:end;justify-content:center;margin-top:10px}</style><h1>汤圆 · Clarity mascot</h1><p class="s">16×16 pixel grid, flat colour. Shown at 240 / 64 / 32 / 16px.</p><div class="g">'
for k,n,d in cards:
    s=V[k]; sm=''.join(s.replace('width="240" height="240"',f'width="{z}" height="{z}"') for z in (64,32,16))
    h+=f'<div class="c">{s}<h2>{n}</h2><p>{d}</p><div class="sm">{sm}</div></div>'
open(f'{D}/concepts.html','w').write(h+'</div>')
