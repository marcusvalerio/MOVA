#!/usr/bin/env python3
"""Avaliação quantitativa dos dados extraídos (usada em docs/AVALIACAO_DOCUMENTOS.md).
Uso: python3 scripts/extracao/avaliar.py
"""
import json,collections,statistics,datetime,re
def n(s):
    if s is None: return None
    return int(s.replace('.',''))
F=json.load(open('data/extraido/fluxos.json')); V=json.load(open('data/extraido/velocidade.json'))
def key(x): 
    l=re.sub(r'COORDENADAS.*','',x['loc']); return l
def series(D):
    S=collections.defaultdict(list)
    for x in D:
        if x['date']: S[(key(x),x['date'][:7])].append(x)
    return S
SF=series(F); SV=series(V)
print('## Fluxo')
print('| Série | Mês | Dias | Dias c/ 24h | Células vazias | Zeros | Soma≠total | Cod CET | Equip | Coord |')
tot=collections.Counter()
for (l,m),xs in sorted(SF.items()):
    full=sum(1 for x in xs if x['nrows']==24 and all(v is not None for v in x['values']))
    blanks=sum((24-x['nrows'])+sum(1 for v in x['values'] if v is None) for x in xs)
    zeros=sum(1 for x in xs for v in x['values'] if v is not None and n(v)==0)
    mism=[]
    for x in xs:
        if x['summary'] and x['nrows']==24 and all(v is not None for v in x['values']):
            s=sum(n(v) for v in x['values'])
            if s!=n(x['summary']): mism.append((x['date'],s,n(x['summary'])))
    tot['dias']+=len(xs);tot['full']+=full;tot['blank']+=blanks;tot['zero']+=zeros;tot['mism']+=len(mism)
    print(f"| {l} | {m} | {len(xs)} | {full} | {blanks} | {zeros} | {len(mism)} | {xs[0]['cet'] or '—'} | {xs[0]['equip'] or '—'} | {(xs[0]['coord'] or '—')[:40]} |")
print(tot)
checked=sum(1 for x in F if x['summary'] and x['nrows']==24 and all(v is not None for v in x['values']))
print('dias completos com total impresso conferido:',checked)
# velocity mean definition
def canon(l):
    l=l.upper()
    l=re.sub(r'COORDENADAS.*','',l)
    return l.replace('TN ','TÚNEL ').replace('TUNEL','TÚNEL')
FI={(canon(key(x)),x['date']):x for x in F if x['date']}
arith=wt=both=tot=0; diffs=[]
for x in V:
    if not x['date'] or x['nrows']!=24 or not x['summary']: continue
    vs=[n(v) for v in x['values']]
    if any(v is None for v in vs): continue
    f=FI.get((canon(key(x)),x['date']))
    a=round(sum(vs)/24)
    w=None
    if f and f['nrows']==24 and all(v is not None for v in f['values']):
        fl=[n(v) for v in f['values']]
        if sum(fl)>0: w=round(sum(a_*b for a_,b in zip(vs,fl))/sum(fl))
    s=n(x['summary']); tot+=1
    if a==s: arith+=1
    if w is not None and w==s: wt+=1
    if w is not None and a==s and w==s: both+=1
print(f'velocidade: {tot} dias; média impressa = média aritmética das 24h em {arith}; = ponderada pelo fluxo em {wt}; ambas iguais em {both}')
# p85
P=collections.defaultdict(list)
for x in V:
    if x['p85'] and x['date']: P[(key(x),x['date'][:7])].append(n(x['p85']))
print('## V85 por série: valores distintos')
for k,v in sorted(P.items()): print(k, 'n=',len(v),'distintos=',sorted(set(v))[:8])
# tolerance
ok1=0;tt=0
for x in V:
    if not x['date'] or x['nrows']!=24 or not x['summary']: continue
    vs=[n(v) for v in x['values']]
    if any(v is None for v in vs): continue
    tt+=1
    if abs(sum(vs)/24-n(x['summary']))<=1: ok1+=1
print('velocidade: média impressa a ±1 km/h da média aritmética:',ok1,'/',tt)
HOL={'2019-03-04','2019-03-05','2019-03-06','2019-05-01','2022-05-01','2023-03-01'}
HOL={'2019-03-04','2019-03-05','2019-05-01','2022-05-01'}
print('## Totais diários (dias completos)')
print('| Série | Mês | Dias úteis: n · mín–máx · média | Fim de semana: n · mín–máx | Hora pico típica (dias úteis) |')
for (l,m),xs in sorted(SF.items()):
    wk=[];we=[];pk=collections.Counter()
    for x in xs:
        if x['nrows']!=24 or any(v is None for v in x['values']): continue
        vals=[n(v) for v in x['values']]
        if 0 in vals: continue
        d=datetime.date.fromisoformat(x['date'])
        s=sum(vals)
        if x['date'] in HOL: continue
        if d.weekday()<5: wk.append(s); pk[max(range(24),key=lambda h:vals[h])]+=1
        else: we.append(s)
    f=lambda a:f"{len(a)} · {min(a):,}–{max(a):,} · {round(statistics.mean(a)):,}".replace(',','.') if a else '—'
    print(f"| {l[:70]} | {m} | {f(wk)} | {f(we)} | {', '.join(f'{h:02d}h({c})' for h,c in pk.most_common(3))} |")
