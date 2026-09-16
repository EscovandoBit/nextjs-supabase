# CRUD de tarefas — arquitetura hexagonal com Next.js 16, Drizzle e Supabase

Regras de negócio em TypeScript, não em procedures. Escritas passam por Server Actions
com transação e lock no Postgres; leituras vão direto ao PostgREST sob RLS, paginadas
pela URL. Toda Server Action exige uma sessão verificada, e isso é garantido pelo
compilador.

## Os três pilares

**Pool singleton.** [`src/shared/infrastructure/db/pool.ts`](src/shared/infrastructure/db/pool.ts)
é o único arquivo que abre conexão. Driver `node-postgres` e não `postgres.js`, porque o
`attachDatabasePool` da Vercel é documentado para `pg` e porque o `pg` só usa prepared
statement quando a query recebe nome — o que torna o transaction mode do Supavisor seguro
por padrão em vez de seguro-se-você-lembrar.

**Sessão inforjável.** `AuthenticatedSession`
([`src/shared/domain/session.ts`](src/shared/domain/session.ts)) tem como chave de marca um
`unique symbol` declarado e nunca exportado, então nenhum outro módulo consegue escrever um
literal desse tipo. E `RlsUnitOfWork` exige uma no construtor. Sem sessão verificada não há
transação, logo não há escrita — erro de compilação, não comentário de code review.

**Leitura paginada pela URL.** Paginação, busca e ordenação vivem em `searchParams`, passam
por Zod com `.catch()` em cada campo (URL editada à mão deve renderizar a página 1, não um
500) e a coluna de ordenação passa por allowlist, porque interpolar ordenação vinda do
usuário é vetor de injeção.

```
src/
  modules/todos/
    domain/          entidades, invariantes, portas — importa nada
    application/     casos de uso — importa só portas
    infrastructure/  repositório Drizzle
    contracts/       DTOs Zod compartilhados com o browser
    read/            caminho de leitura via PostgREST, sem porta
  shared/
    domain/          ids branded, sessão opaca
    infrastructure/  pool, unit of work, clientes Supabase, auth
  composition/       o único lugar que conhece tipos concretos
  actions/           adaptadores primários ("use server")
  components/        UI
  proxy.ts           renovação de token (Next 16; ex-middleware.ts)
```

As fronteiras são verificadas no CI por `dependency-cruiser` — o equivalente ao
`import-linter` de um projeto Python. Sem isso, a arquitetura decai para pastas que só
parecem em camadas.

## Setup local

```bash
npm install
npx supabase start              # requer Docker
cp .env.example .env.local      # preencha as chaves com `supabase status`
npm run db:migrate
npm run dev
```

As migrations aplicam nesta ordem e a segunda importa:

1. `0000_todos_with_rls.sql` — gerada pelo Drizzle Kit: tabela, índices e as quatro policies.
2. `0001_rls_hardening_and_realtime.sql` — escrita à mão: `FORCE ROW LEVEL SECURITY`, o
   trigger de broadcast, a policy de `realtime.messages` **escopada por tópico** e o revoke
   dos default privileges de funções.

Depois de `supabase start`, desative **Allow public access** nas configurações de Realtime.
Sem isso, canal privado não é realmente exigido e a policy de `realtime.messages` deixa de
ser a barreira que você acha que é.

## Conexão e dimensionamento do pool

`DB_CONNECTION_MODE` precisa concordar com a porta em `DATABASE_URL`;
[`env.ts`](src/shared/config/env.ts) falha alto na divergência, porque esse é o tipo de erro
que só aparece em produção sob carga.

| Modo | Host:porta | Para quê | `DB_POOL_MAX` |
| --- | --- | --- | --- |
| `direct` | `127.0.0.1:54322` | Supabase CLI, migrations, `pg_dump` | 5 |
| `transaction` | pooler `:6543` | Vercel e serverless | 3 |
| `session` | pooler `:5432` | container Node de longa duração | 10 |

A conta que importa: `instâncias simultâneas × DB_POOL_MAX ≤ pool size do Supavisor`
(15 por padrão no plano free). Com `max: 3` você comporta cerca de cinco instâncias antes de
começar a enfileirar.

Duas propriedades caem de graça do desenho. Leituras vão por HTTP ao PostgREST, então **não
consomem conexão do pool** — só escritas consomem, e por isso o pool pode ser pequeno. E o
`lock_timeout` local da unit of work existe porque, com `FOR UPDATE`, esperar por lock segura
uma conexão; sem limite, um lock preso derruba a capacidade de escrita inteira.

### Transaction mode não quebra os locks

A documentação de self-hosting da Supabase diz que transaction mode "não suporta `SET` nem
advisory locks". É atalho de linguagem. A regra real: em transaction mode a **transação** é a
unidade de pooling, então o que é transaction-scoped funciona e o que é session-scoped não.
Tudo o que a unit of work usa está do lado certo — `set_config(..., is_local => true)`,
`SET LOCAL`, `pg_advisory_xact_lock` — e as variantes de sessão (`SET` sem `LOCAL`,
`pg_advisory_lock`) estão proibidas. `tests/integration/concurrency.test.ts` prova em vez de
argumentar.

## Testes

Três camadas, porque cada uma alcança algo que as outras não.

```bash
npm run test:unit          # domínio, casos de uso, contratos — sem banco
npm run test:integration   # RLS, transação e lock contra o Postgres local
npm run test:e2e           # Playwright: fluxos, isolamento entre usuários, axe
```

**Unitário** (32 testes) roda em ~1s sem banco, sem Supabase e sem Next. É o retorno de ter
domínio livre de framework: `InMemoryUnitOfWork` substitui `RlsUnitOfWork` sem o caso de uso
perceber, inclusive emulando serialização por chave.

**Integração** exige `supabase start`. Cobre o que unitário não alcança e E2E não observa:
que as claims chegam na transação e `auth.uid()` resolve; que uma escrita cruzada entre
usuários é barrada pelo RLS com **zero linhas afetadas** e o repositório converte isso em
erro em vez de sucesso silencioso; que o advisory lock serializa duas criações concorrentes
no limite de pendentes; e que `FOR UPDATE` bloqueia a segunda transação e o `lock_timeout` a
aborta no prazo. Sem banco, a suíte **pula com aviso em destaque** — uma suíte de integração
que passa silenciosamente é pior que nenhuma.

**E2E** (40 testes) roda contra `next build && next start`, não contra `next dev`, e isso é
proposital: o Next censura mensagens de erro em produção e não em desenvolvimento. O
`ActionState` existe por causa disso, então testar em dev validaria um comportamento que o
usuário nunca vê.

Contas de teste são criadas por worker via admin API, porque o Realtime é assinado por id de
usuário e duas specs compartilhando conta veriam as escritas uma da outra chegando no meio da
asserção.

A `service_role` key aparece em exatamente dois lugares no repositório —
[`drizzle.config.ts`](drizzle.config.ts) e as fixtures de teste. Ela ignora RLS por completo e
nunca deve ser alcançável de `src/`.

## Verificação

```bash
npm run verify        # typecheck + dependency-cruiser + unitários
npm run build
```

## Notas de manutenção

**TypeScript está pinado em 6.x.** O `dependency-cruiser` 18 ainda não suporta TS 7: com TS 7
instalado ele percorre **zero módulos** e passa sem checar nada. Como as fronteiras de camada
são a tese central deste projeto, um enforcement que virou no-op é pior que compilador lento.
Quando o `dependency-cruiser` ganhar suporte, dá para voltar — confirme que
`npx depcruise src` continua relatando ~60 módulos, e não zero.

**Busca usa `ilike` com curinga à esquerda**, que não aproveita índice btree. Para volume
real, o upgrade é um índice GIN com `pg_trgm`:

```sql
create extension if not exists pg_trgm;
create index todos_title_trgm_idx on public.todos using gin (title gin_trgm_ops);
```

**`count: "exact"`** faz contagem completa. Aceitável aqui porque o RLS já restringe a um
usuário; em escala, troque para `planned` ou `estimated`.

**Sem `revalidatePath` nas actions de tarefa.** As rotas são dinâmicas (dependem de
`cookies()`), então o Server Component já re-renderiza com dados frescos depois de uma action,
o que cobre o caminho sem JavaScript. Com JavaScript, o refetch do Realtime é o canal de
atualização; fazer os dois brigaria com o estado otimista e atualizaria a lista duas vezes.

**Mutação de item exige JavaScript.** É a única lacuna deliberada de progressive enhancement:
o overlay otimista vive na lista e precisa de uma transição no cliente. Criar tarefa, buscar,
filtrar e paginar continuam funcionando sem JavaScript.

## Fora de escopo

Recuperação de senha, multi-tenancy, exportação de dados e Lighthouse CI.
