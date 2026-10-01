#!/usr/bin/env python3
"""Extrai as tabelas diárias por faixa horária dos relatórios de fiscalização eletrônica (PDF).

Uso: python3 scripts/extracao/extrair_tabelas.py <pdf> <FLUXOS|VELOCIDADE> <saida.json>
Requer: pip install pdfplumber

Cada coluna-dia vira um registro com: local, sentido, metadados (código CET, equipamento,
coordenada), data (validada pelo dia da semana impresso), 24 valores LITERAIS (null = célula vazia),
total/média impresso e V85 impresso. Nenhum valor é corrigido ou preenchido.
"""
import pdfplumber,re,json,sys,datetime,unicodedata
NUM=re.compile(r'^(\d{1,3}(?:\.\d{3})+|\d+)$')
DT=re.compile(r'^(\d{1,2})/(\d{1,2})/(\d{2}|\d{4})$')
MONTHS={'JANEIRO':1,'FEVEREIRO':2,'MARCO':3,'ABRIL':4,'MAIO':5,'JUNHO':6,'JULHO':7,'AGOSTO':8,'SETEMBRO':9,'OUTUBRO':10,'NOVEMBRO':11,'DEZEMBRO':12}
WD={'SEGUNDA':0,'TERCA':1,'QUARTA':2,'QUINTA':3,'SEXTA':4,'SABADO':5,'DOMINGO':6}
def norm(s): return unicodedata.normalize('NFD',s).encode('ascii','ignore').decode().upper()
def wd_of(tok):
    t=norm(tok)
    for k,v in WD.items():
        if t.startswith(k): return v
    return None
def lines_of(words,tol=3):
    rows=[]
    for w in sorted(words,key=lambda w:(w['top'],w['x0'])):
        for r in rows:
            if abs(r['top']-w['top'])<=tol: r['w'].append(w); break
        else: rows.append({'top':w['top'],'w':[w]})
    for r in rows: r['w'].sort(key=lambda w:w['x0']); r['text']=' '.join(w['text'] for w in r['w'])
    return sorted(rows,key=lambda r:r['top'])
def resolve(tok,month,wd):
    """Return ISO date: tries d/m and m/d (and day-only) and checks against weekday label."""
    cands=[]
    m=DT.match(tok)
    if m:
        a,b,y=int(m.group(1)),int(m.group(2)),int(m.group(3)); y=y+2000 if y<100 else y
        for d,mo in [(a,b),(b,a)]:
            try: cands.append(datetime.date(y,mo,d))
            except ValueError: pass
    elif tok.isdigit() and month:
        y,mo=map(int,month.split('-'))
        try: cands.append(datetime.date(y,mo,int(tok)))
        except ValueError: pass
    if month:
        y,mo=map(int,month.split('-'))
        inm=[c for c in cands if c.year==y and c.month==mo]
        if inm: cands=inm
    if wd is not None:
        ok=[c for c in cands if c.weekday()==wd]
        if ok: return ok[0].isoformat(),True
    return (cands[0].isoformat(),False) if cands else (None,False)
def extract(path,doc):
    pdf=pdfplumber.open(path); out=[]; ctx={}
    for pn,page in enumerate(pdf.pages,1):
        L=lines_of(page.extract_words())
        for i,r in enumerate(L):
            if r['text'].startswith('PISTA E/OU SENTIDO') and ctx is not None:
                lab='PISTA E/OU SENTIDO:'; j=0; left=''
                for ch in r['text']:
                    if j<len(lab) and ch==lab[j]: j+=1
                    else: left+=ch
                left=left.replace(' ','')
                if left and left!='0': ctx['dir']=left
            t=r['text']
            m=re.match(r'LOGRADOURO:\s*(.+?)(\s+C[ÓO]DIGO CET:.*)?$',t)
            if m: ctx={'loc':m.group(1).strip(),'obs':[]}
            for key,pat in [('cet',r'C[ÓO]DIGO CET(?: da PISTA-SENTIDO-FAIXA)?:?\s*(\d{6,})'),('equip',r'(?:M[ÁA]QUINA|EQUIPAMENTO):?\s*([A-Z0-9][A-Z0-9-]+)'),('coord',r'COORDENADAS?(?: EM UTM)?:\s*(.+)$'),('ref',r'REFER[ÊE]NCIA:\s*(.+?)(\s+N[ºo] DO.*)?$'),('pista',r'PISTA[- E/OU]*SENTIDO[^:]*:\s*(.+?)(\s+COORDENADA.*)?$')]:
                mm=re.search(pat,t)
                if mm and mm.group(1).strip() and ctx is not None: ctx[key]=mm.group(1).strip()
            if re.match(r'^(Velocidade média das faixas|Total das faixas)',t): ctx.setdefault('obs',[]).append(t)
            mm=re.search(r'(?:FLUXO VEICULAR|VELOCIDADE M[ÉE]DIA)\s*-\s*(\d{2})\s*/\s*(\d{4})',t)
            if mm: ctx['month']=f"{mm.group(2)}-{mm.group(1)}"
            mm=re.search(r'([A-Za-zçÇ]+)\s*/\s*(\d{2,4})\b',t)
            if mm and norm(mm.group(1)) in MONTHS:
                y=int(mm.group(2)); y=y+2000 if y<100 else y
                ctx['month']=f"{y}-{MONTHS[norm(mm.group(1))]:02d}"
        # header detection
        heads=[]
        for i,r in enumerate(L):
            dts=[w for w in r['w'] if DT.match(w['text'])]
            if dts: heads.append((r,dts)); continue
            nxt=L[i+1]['text'] if i+1<len(L) else ''
            ints=[w for w in r['w'] if w['text'].isdigit() and int(w['text'])<=31]
            others=[w for w in r['w'] if not w['text'].isdigit() and norm(w['text'])!='DATA']
            if len(ints)>=1 and not others and sum(1 for w in L[i+1]['w'] if wd_of(w['text']) is not None)>=max(1,len(ints)-1) if i+1<len(L) else False:
                heads.append((r,ints))
        for hi,(h,cols) in enumerate(heads):
            centers=[(c['x0']+c['x1'])/2 for c in cols]
            gap=min([centers[i+1]-centers[i] for i in range(len(centers)-1)] or [80])
            ybot=heads[hi+1][0]['top'] if hi+1<len(heads) else 1e9
            body=[r for r in L if h['top']<r['top']<ybot]
            wdl=[None]*len(cols)
            for r in body[:3]:
                ws=[w for w in r['w'] if wd_of(w['text']) is not None]
                if ws:
                    for w in ws:
                        x=(w['x0']+w['x1'])/2; k=min(range(len(centers)),key=lambda i:abs(centers[i]-x))
                        if abs(centers[k]-x)<gap*0.7: wdl[k]=wd_of(w['text'])
                    break
            def assign(r):
                vals=[None]*len(cols)
                for w in r['w']:
                    if not NUM.match(w['text']): continue
                    x=(w['x0']+w['x1'])/2
                    k=min(range(len(centers)),key=lambda i:abs(centers[i]-x))
                    if abs(centers[k]-x)<gap*0.55: vals[k]=w['text']
                return vals
            data=[];summ=None;p85=None
            for r in body:
                t=r['text']
                vals=assign(r); has=any(v is not None for v in vals)
                if re.search(r'C[ÓO]DIGO|M[ÁA]QUINA|EQUIPAMENTO|COORDENADA|23K|Grupo',t): continue
                if re.search(r'85',t) and re.search(r'(?i)VEL|PERCENTIL',t):
                    if has: p85=vals
                    else: p85='NEXT'
                    continue
                if p85=='NEXT' and has: p85=vals; continue
                if re.search(r'(?i)SOMA|RESUMO|^\s*M[ÉE]DIA\b|TOTAL',t) and not re.search(r'(?i)faixas',t):
                    if has and len(data)>=12: summ=vals
                    continue
                if not has: continue
                if len(data)<24: data.append(vals)
                elif summ is None: summ=vals
                elif p85 is None: p85=vals
            if p85=='NEXT': p85=None
            for ci,c in enumerate(cols):
                iso,ok=resolve(c['text'],ctx.get('month'),wdl[ci])
                out.append(dict(doc=doc,page=pn,loc=ctx.get('loc')+(' - S.'+ctx['dir'] if ctx.get('dir') and ' - S.' not in ctx.get('loc','') else ''),pista=ctx.get('pista'),ref=ctx.get('ref'),cet=ctx.get('cet'),equip=ctx.get('equip'),coord=ctx.get('coord'),obs=ctx.get('obs'),
                  month=ctx.get('month'),dateRaw=c['text'],date=iso,weekdayChecked=ok,weekdayLabel=wdl[ci],
                  values=[row[ci] for row in data],nrows=len(data),summary=(summ[ci] if summ else None),p85=(p85[ci] if p85 else None)))
    return out
r=extract(sys.argv[1],sys.argv[2]); json.dump(r,open(sys.argv[3],'w'),ensure_ascii=False); print(len(r))
