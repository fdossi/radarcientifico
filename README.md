# Radar Científico Brasil

Portal automatizado de oportunidades de bolsas, editais, concursos, startups e inovação. Inclui catálogo claro, terminal estatístico escuro, feed RSS e coleta programada.

## Arquitetura
- GitHub Actions executa o monitor Python a cada 4 horas.
- Coletores HTTP/HTML para fontes oficiais; apenas fontes com status `active` são coletadas.
- Oportunidades ficam no Supabase PostgreSQL (opcional) e em snapshots versionados JSON.
- Site estático em `docs/`; API pública não é necessária.
- Feed `docs/feed.xml` pode ser conectado ao IFTTT → X.

## Implantação
1. Em **Settings → Pages**, selecione **Deploy from a branch**, `main`, pasta `/docs` (se disponível no seu plano).
2. Em **Actions**, habilite workflows e execute `Monitorar oportunidades` manualmente.
3. Opcional: execute `sql/schema.sql` no Supabase SQL Editor. Configure os secrets `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` apenas no GitHub Actions. Nunca exponha o segundo no front-end.
4. Conecte o RSS publicado (`https://fdossi.github.io/radarcientifico/feed.xml`) ao IFTTT RSS → X, se sua conta suportar a ação.
5. Consulte `data/sources.json`: fontes catalogadas como `planned` não têm coletor verificado. Adicione seletores/coletores e ative progressivamente após testes.

## Limites e integridade
- Sem dados fictícios em produção. Campos de prazo e valor são nulos quando não confirmados.
- Um link descoberto não equivale a edital aberto: o estado é `nao_verificado` até validação.
- A fonte pode mudar o HTML: veja `docs/data/status.json`.
- O front-end funciona com snapshots mesmo se o Supabase estiver pausado.
- Este primeiro marco fornece automação inicial para fontes habilitadas; **não garante** cobertura exaustiva de todas as agências.
- O histórico começa na primeira coleta bem-sucedida. Backups do Supabase devem ser configurados separadamente.

## Desenvolvimento local
```bash
python -m pip install -r requirements.txt
python scripts/monitor.py
python -m http.server 8000 -d docs
```
Abra http://localhost:8000.

## Fontes e metodologia
O catálogo agrega links de fontes oficiais e mantém os URLs originais. Contagem de editais é distinta da quantidade de bolsas, vagas ou projetos. Não estimamos valores financeiros a partir de títulos.

Licença MIT (código). Textos e documentos dos órgãos preservam seus direitos originais.
