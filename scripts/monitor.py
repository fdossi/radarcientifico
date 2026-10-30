#!/usr/bin/env python3
"""Coleta conservadora: publica somente links de fontes originais, sem inventar metadados."""
import hashlib
import json
import os
import re
import sys
from datetime import datetime, timezone, date
from email.utils import format_datetime
from html import escape
from pathlib import Path
from urllib.parse import urljoin, urlsplit, urlunsplit, parse_qsl, urlencode

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
DATA = DOCS / "data"
SITE = os.getenv("SITE_URL", "https://fdossi.github.io/radarcientifico").rstrip("/")
SESSION = requests.Session()
SESSION.headers.update({"User-Agent": "RadarCientifico/0.1 (research opportunity aggregator; contact via repository issues)"})
TERMS = re.compile(r"\b(bolsa|bolsas|edital|chamada|oportunidade|seleção|selecao|pós.doc|post.doc|doutorado|mestrado|inovação|inovacao|startup|fomento|fellowship|funding|pesquisa|cientista|programa)\b", re.I)
STOP = re.compile(r"^(saiba mais|ler mais|acesse|clique aqui|detalhes|inscreva.se|home|início|próximo|anterior|next|previous|en|pt)$", re.I)

def canonical(url):
    p = urlsplit(url)
    query = urlencode([(k,v) for k,v in parse_qsl(p.query) if not k.lower().startswith(("utm_","fbclid","gclid"))])
    return urlunsplit((p.scheme.lower(),p.netloc.lower(),p.path.rstrip("/") or "/",query,""))

def classify(text):
    t = text.casefold()
    if any(x in t for x in ("startup", "acelera", "empreendedor")):
        return "Startups"
    if any(x in t for x in ("inovação", "inovacao", "subvenção", "subvencao", "tecnológ")):
        return "Inovação"
    if any(x in t for x in ("bolsa", "fellowship", "pós-doc", "post-doc", "doutorado", "mestrado")):
        return "Bolsas"
    if any(x in t for x in ("concurso", "seleção", "selecao")):
        return "Concursos"
    return "Fomento"

def level(text):
    t=text.casefold()
    for key,label in [("pós-doc","Pós-doutorado"),("post-doc","Pós-doutorado"),("doutorado","Doutorado"),("mestrado","Mestrado"),("iniciação científica","Iniciação científica"),("startup","Startup")]:
        if key in t:
            return label
    return None

def extract(source, html):
    soup=BeautifulSoup(html, "html.parser")
    for elem in soup(["script","style","nav","footer","header","aside"]):
        elem.decompose()
    # Escopo em regiões de conteúdo, quando existentes. Links de menus não passam no filtro.
    root = soup.select_one("main") or soup.select_one("#content") or soup.select_one(".entry-content") or soup.body or soup
    output=[]
    seen=set()
    for a in root.select("a[href]"):
        title=" ".join(a.get_text(" ",strip=True).split())
        href=urljoin(source["url"],a["href"])
        if not title or len(title)<16 or len(title)>230 or STOP.fullmatch(title) or not TERMS.search(title):
            continue
        if not href.startswith(("https://","http://")):
            continue
        if urlsplit(href).hostname != urlsplit(source["url"]).hostname:
            continue
        if canonical(href)==canonical(source["url"]) or re.search(r"\.(jpg|jpeg|png|gif|svg|css|js)$",urlsplit(href).path,re.I):
            continue
        # Descartar artefatos de navegação e âncoras genéricas.
        if a.find_parent(["nav","footer"]):
            continue
        url=canonical(href)
        if url in seen:
            continue
        seen.add(url)
        ident=hashlib.sha256((source["code"]+"|"+url).encode()).hexdigest()[:24]
        indication = source["mode"] in ("fapesp","govbr")
        output.append({
          "id":ident,"institution":source["name"],"source_code":source["code"],
          "title":title,"url":url,"uf":source["uf"],
          "category":classify(title),"level":level(title),
          "published_at":None,"deadline":None,"amount_brl":None,"award_count":None,
          "status":"fonte_indica_aberto" if indication else "nao_verificado"
        })
    return output

def load_json(path,default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError,ValueError):
        return default

def save(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")

def sync_supabase(changed, runs):
    url=os.getenv("SUPABASE_URL")
    key=os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not (url and key):
        return "disabled"
    from supabase import create_client
    client=create_client(url,key)
    for row in changed:
        client.table("opportunities").upsert(row,on_conflict="id").execute()
    if runs:
        client.table("collection_runs").insert(runs).execute()
    return "ok"

def write_rss(rows):
    # Itens de fontes que explicitamente apresentam oportunidades abertas.
    # O RSS não afirma que o prazo de cada publicação foi verificado.
    filtered=[r for r in rows if r["status"]=="fonte_indica_aberto"]
    filtered.sort(key=lambda r:r.get("first_seen") or "",reverse=True)
    lines=['<?xml version="1.0" encoding="UTF-8"?>','<rss version="2.0"><channel>',
      '<title>Radar Científico Brasil</title>',f'<link>{escape(SITE+"/")}</link>',
      '<description>Oportunidades encontradas em páginas oficiais; consulte o prazo diretamente na fonte.</description>']
    for r in filtered[:150]:
        link=SITE+"/?id="+r["id"]
        timestamp=datetime.fromisoformat(r["first_seen"].replace("Z","+00:00"))
        lines.extend(["<item>",f'<title>{escape(r["institution"]+" — "+r["title"])}</title>',
            f'<link>{escape(link)}</link>',f'<guid isPermaLink="false">{r["id"]}</guid>',
            f'<pubDate>{format_datetime(timestamp)}</pubDate>',
            f'<description>{escape("Fonte: "+r["institution"]+". Consulte o edital oficial para prazo, condições e valores.")}</description>',"</item>"])
    lines.append("</channel></rss>")
    (DOCS/"feed.xml").write_text("\n".join(lines)+"\n",encoding="utf-8")

def main():
    sources=load_json(ROOT/"data"/"sources.json",[])
    old=load_json(DATA/"opportunities.json",[])
    by_id={r["id"]:r for r in old}
    now=datetime.now(timezone.utc).isoformat()
    runs=[]; errors=[]; successes=0; inserted=0; changed=[]
    for src in sources:
        if not src.get("enabled") or not src.get("url"):
            continue
        try:
            response=SESSION.get(src["url"],timeout=25)
            response.raise_for_status()
            found=extract(src,response.text)
            if not found:
                raise RuntimeError("Nenhum link de oportunidade compatível encontrado; revisar seletor")
            successes+=1
            for item in found:
                existing=by_id.get(item["id"])
                if existing:
                    item["first_seen"]=existing.get("first_seen",now)
                    # Preserva campos revisados/enriquecidos manualmente por processos confiáveis.
                    for attr in ("published_at","deadline","amount_brl","award_count"):
                        if existing.get(attr) is not None:
                            item[attr]=existing[attr]
                    item["last_seen"]=now
                    if any(existing.get(k)!=item.get(k) for k in ("title","category","level","status","deadline","amount_brl")):
                        item["updated_at"]=now
                    else:
                        item["updated_at"]=existing.get("updated_at",now)
                else:
                    inserted+=1
                    item.update(first_seen=now,last_seen=now,updated_at=now)
                by_id[item["id"]]=item
                if existing is None or any(existing.get(k)!=item.get(k) for k in ("title","category","level","status","deadline","amount_brl")):
                    changed.append(item)
            runs.append({"source_code":src["code"],"success":True,"discovered":len(found)})
        except Exception as exc:
            msg=str(exc)[:400]
            errors.append({"source":src["code"],"error":msg})
            runs.append({"source_code":src["code"],"success":False,"discovered":0,"error":msg})
    rows=sorted(by_id.values(),key=lambda r:r.get("first_seen",""),reverse=True)
    save(DATA/"opportunities.json",rows)
    save(DATA/"status.json",{"updated_at":now,"records":len(rows),"new_records":inserted,
        "sources_total":len([s for s in sources if s.get("enabled")]),"sources_ok":successes,
        "sources_catalogued":len(sources),"errors":errors,
        "note":"Cobertura parcial; situações, valores e prazos devem ser conferidos na fonte oficial."})
    write_rss(rows)
    try:
        sync_supabase(changed,runs)
    except Exception as exc:
        print("Supabase sync failed:",exc,file=sys.stderr)
        # Arquivos estáticos continuam utilizáveis, mas indicar falha no status.
        current=load_json(DATA/"status.json",{})
        current["errors"].append({"source":"supabase","error":str(exc)[:400]})
        save(DATA/"status.json",current)
        sys.exit(1)
    print(f"Sources OK: {successes}; discovered records: {len(rows)}; new: {inserted}; errors: {len(errors)}")
    if not successes:
        sys.exit(2)

if __name__=="__main__":
    main()
