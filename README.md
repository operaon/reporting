# Operaon Reporting & Analytics

Standalone responsável pelo **read model analítico** da Operaon. O serviço recebe fatos clínicos por ingestão idempotente, mantém banco próprio para consultas e produz relatórios operacionais, métricas agregadas, tendências e exportações. O módulo não substitui os sistemas de origem nem altera dados clínicos transacionais.

## Fronteira do domínio

O serviço materializa dados necessários para reporting a partir de eventos ou lotes emitidos por módulos de origem, como Clinical, Agend e Identity. A escrita aceita somente operações de ingestão e é somente-aditiva: a origem continua sendo a autoridade dos dados transacionais, enquanto o Reporting é a autoridade do seu read model e dos seus metadados de processamento.

| Responsabilidade | Reporting & Analytics | Serviço de origem |
| --- | --- | --- |
| Armazenar fatos para consulta analítica | Sim, no banco `operaon_reporting` | Não é o objetivo do módulo |
| Criar ou alterar prontuário transacional | Não | Sim |
| Consolidar pacientes, avaliações, questionários, sessões, terapeutas e atividade | Sim, por ingestão versionada | Emite os fatos |
| Garantir idempotência de reprocessamentos | Sim, por `sourceSystem` + `sourceId` | Deve reenviar identificadores estáveis |
| Autorizar o consumidor | `X-Service-Key` e JWT do Identity | Emite o JWT e configura a chave de serviço |
| Exportar PDF e XLSX | Sim, dentro dos limites operacionais | Não |

## Segurança e escopo

Todas as rotas em `/api` exigem autenticação backend-a-backend dual:

```http
X-Service-Key: <chave-configurada-no-ambiente>
Authorization: Bearer <jwt-emitido-pelo-Identity>
X-Tenant-Id: <tenant-opcional-e-consistente-com-o-jwt>
```

O JWT é validado com `issuer=operaon-identity` e uma audiência configurada para incluir `operaon-api`, `operaon-identity` e `operaon-reporting`. O contexto de autorização usa os claims dinâmicos `tenantId`, `organizationIds`, `permissions` e, quando aplicável, o marcador de token de serviço. Não há bypass por nome fixo de role.

As permissões são verificadas por recurso e ação:

| Permissão | Uso |
| --- | --- |
| `reporting:read` | Consultas, métricas, progresso, aderência, tendências, distribuição e atividade |
| `reporting:write` | Ingestão de lotes e consulta do status de ingestão |
| `reporting:export` | Exportações PDF e XLSX |

O tenant do lote precisa coincidir com o tenant do contexto JWT quando a chamada não é de serviço. Cada evento também é validado antes da criação do batch; portanto, um evento fora do tenant ou da organização autorizados rejeita o lote inteiro e não deixa um batch parcialmente aceito. A validação de organização usa os `organizationIds` do contexto e o `organizationId` recebido no lote ou no evento.

## Contrato HTTP

O processo responde em `PORT` (por padrão, `4760`) e expõe health checks sem autenticação:

| Método | Endpoint | Permissão | Finalidade |
| --- | --- | --- | --- |
| `GET` | `/health` | — | Liveness do processo |
| `GET` | `/ready` | — | Readiness, incluindo autenticação no PostgreSQL |
| `POST` | `/api/internal/ingestion/batch` | `reporting:write` | Ingestão idempotente de um lote |
| `GET` | `/api/internal/ingestion/status/:batchId` | `reporting:read` | Status e contagens do lote |
| `GET` | `/api/reports/patients` | `reporting:read` | Lista paginada de pacientes materializados |
| `GET` | `/api/reports/patient/:patientId/progress` | `reporting:read` | Progresso clínico do paciente |
| `GET` | `/api/reports/patient/:patientId/assessments` | `reporting:read` | Avaliações do paciente |
| `GET` | `/api/reports/patient/:patientId/questionnaires` | `reporting:read` | Questionários do paciente |
| `GET` | `/api/reports/assessment/:assessmentId/export/pdf` | `reporting:export` | Exportação PDF de progresso |
| `GET` | `/api/reports/patient/:patientId/export/questionnaires/excel` | `reporting:export` | Exportação XLSX de questionários |
| `GET` | `/api/reports/patient/:patientId/export/complete/pdf` | `reporting:export` | Exportação PDF completa |
| `GET` | `/api/analytics/overview` | `reporting:read` | Visão geral de métricas |
| `GET` | `/api/analytics/patient/:patientId/progress` | `reporting:read` | Série de progresso do paciente |
| `GET` | `/api/analytics/patient/:patientId/adherence` | `reporting:read` | Aderência a sessões ou atividades |
| `GET` | `/api/analytics/therapist/:therapistId/performance` | `reporting:read` | Desempenho agregado do terapeuta |
| `GET` | `/api/analytics/classification-distribution` | `reporting:read` | Distribuição de classificações |
| `GET` | `/api/analytics/monthly-trends` | `reporting:read` | Tendências mensais |
| `GET` | `/api/activity/users/:userId` | `reporting:read` | Atividade agregada do usuário |

A resposta de ingestão informa o identificador do batch, o status, as contagens de eventos aplicados, ignorados e falhos, além de indicar replay idempotente quando o mesmo batch já foi concluído. Erros de autenticação retornam `401`; violações de permissão ou escopo retornam `403`; falhas de validação retornam `400`.

Um exemplo mínimo de lote é:

```json
{
  "batchId": "batch-clinical-2026-08-14-0001",
  "sourceSystem": "clinical",
  "tenantId": "tenant-uuid",
  "organizationId": "organization-uuid",
  "events": [
    {
      "sourceSystem": "clinical",
      "sourceId": "assessment-uuid",
      "type": "assessment.upserted",
      "tenantId": "tenant-uuid",
      "organizationId": "organization-uuid",
      "occurredAt": "2026-08-14T12:00:00.000Z",
      "data": {}
    }
  ]
}
```

Os campos específicos de cada evento são validados pelo contrato de ingestão e devem conservar `sourceSystem` e `sourceId` estáveis. Reenvios do mesmo fato não criam duplicidade porque as tabelas do read model possuem chaves únicas de idempotência por origem.

## Persistência e migrations

O serviço usa PostgreSQL próprio e Sequelize 6. A migration inicial cria as tabelas de pacientes, avaliações, questionários, sessões terapêuticas, terapeutas, fatos de atividade e lotes de ingestão, com índices de consulta e chaves únicas de idempotência. O banco de teste recomendado é `operaon_reporting_test`.

```bash
cp .env.example .env
npm install
npm run migrate
npm run seed
npm test
npm run lint:syntax
npm start
```

As migrations são versionadas em `src/migrations` e devem ser aplicadas antes de marcar o serviço como ready. O seed é idempotente e permanece vazio neste módulo porque não há permissões ou dados de negócio estáticos que devam ser inseridos pelo serviço.

## Configuração

O arquivo `.env` versionado contém apenas valores locais não sensíveis, seguindo o padrão dos demais standalones. Em ambientes compartilhados, substitua as chaves de desenvolvimento e credenciais de banco por secret management do ambiente; nenhum segredo real deve ser commitado.

| Variável | Padrão local | Descrição |
| --- | --- | --- |
| `PORT` | `4760` | Porta HTTP |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | PostgreSQL local | Banco próprio do read model |
| `DATABASE_URL` | vazio | URL alternativa de conexão |
| `SERVICE_API_KEY` | chave de desenvolvimento | Chave backend-a-backend |
| `JWT_ALGORITHM` | `HS256` | Algoritmo de validação |
| `JWT_SECRET` | segredo local | Segredo local de teste; produção deve usar secret management |
| `JWT_ISSUER` | `operaon-identity` | Emissor aceito |
| `JWT_AUDIENCE` | `operaon-api,operaon-identity,operaon-reporting` | Audiências aceitas |
| `JWT_PUBLIC_KEY` | vazio | Chave pública quando o ambiente usar algoritmo assimétrico |
| `MAX_QUERY_LIMIT` | `100` | Limite máximo de paginação |
| `MAX_TREND_MONTHS` | `24` | Limite de meses em tendências |
| `INGESTION_BATCH_SIZE` | `500` | Limite de eventos por lote |
| `EXPORT_MAX_ROWS` | `5000` | Limite de linhas exportáveis |
| `BACKFILL_WRITE_ENABLED` | `false` | Mantém o backfill em dry-run por padrão |

## Backfill legado

O script `scripts/backfill-legacy.js` é somente-aditivo e foi desenhado para uma migração gradual. Ele lê o banco legado configurado em `LEGACY_*`, calcula ou lista os fatos elegíveis e permanece em dry-run quando `BACKFILL_WRITE_ENABLED=false`. A escrita deve ser habilitada apenas após validação de escopo, volume, idempotência e observabilidade no ambiente de destino.

```bash
npm run backfill:legacy
BACKFILL_WRITE_ENABLED=true npm run backfill:legacy
```

A execução de escrita não deve ser usada como mecanismo de sincronização contínua. Para operação recorrente, os serviços de origem devem publicar lotes com `batchId`, `sourceSystem` e `sourceId` estáveis, permitindo reprocessamento seguro.

## Cutover gradual

O gateway pode encaminhar novas chamadas pelo namespace `/api/reporting-standalone` enquanto as rotas legadas `/api/reports` e `/api/analytics` permanecem ativas. O cutover recomendado é observar primeiro health/readiness, testar leitura com um tenant controlado, validar ingestão e replays, comparar métricas com a implementação legada e só então direcionar consumidores adicionais. A remoção das rotas legadas fica fora do escopo desta extração e exige uma decisão operacional posterior.

O serviço não deve ser iniciado em produção sem uma chave `X-Service-Key` exclusiva, JWT emitido pelo Identity, banco próprio e políticas de limite de taxa compatíveis com o volume de ingestão e exportação.

## Desenvolvimento e testes

A suíte `tests/reportingAnalytics.test.js` cobre o contrato HTTP de ingestão, idempotência, consultas analíticas, exportação e isolamento de tenant. Para executar somente essa suíte:

```bash
NODE_ENV=test \
DB_NAME=operaon_reporting_test \
DB_USER=dbadmin \
DB_PASSWORD='SenhaForte2026' \
DB_HOST=localhost \
DB_PORT=5432 \
npx jest tests/reportingAnalytics.test.js --runInBand
```

Antes de abrir um commit, execute a suíte completa, a checagem sintática e verifique que não há credenciais reais em arquivos versionados. O serviço deve encerrar conexões Sequelize de forma graciosa por meio de `src/server.js`.

## Estrutura principal

| Caminho | Papel |
| --- | --- |
| `src/app.js` | Bootstrap Express, health checks, middlewares e rotas |
| `src/server.js` | Inicialização do processo e shutdown gracioso |
| `src/routes/reportingRoutes.js` | Contrato HTTP protegido |
| `src/services/reportingService.js` | Ingestão, escopo e agregações |
| `src/controllers/reportingController.js` | Tradução HTTP e exportações |
| `src/models` | Read model Sequelize |
| `src/migrations` | Evolução versionada do banco |
| `scripts/backfill-legacy.js` | Backfill controlado e dry-run |
| `tests/reportingAnalytics.test.js` | Testes de contrato |

## Referências do repositório

Este README documenta o contrato implementado no próprio serviço. Os pontos de entrada relacionados são [rotas do Reporting](src/routes/reportingRoutes.js), [middleware de autenticação](src/middlewares/auth.js), [serviço central](src/services/reportingService.js), [migration inicial](src/migrations/20260814000001-create-reporting-read-model.js) e [configuração de ambiente](.env.example).

<!-- OPERAON-DOCUMENTATION-LINK -->
## Documentação

A documentação técnica padronizada está em [docs/INDEX.md](docs/INDEX.md). Ela inclui arquitetura, responsabilidades, segurança, contratos, operação, testes, runbooks e decisões.
