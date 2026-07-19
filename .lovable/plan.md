# Plano — Meu Caixa (MVP completo)

App financeiro pessoal focado em fluxo de caixa e "saldo livre", com todas as 7 telas, autenticação por email e dados-semente do usuário Lucas já populados.

## 1. Backend (Lovable Cloud)

Habilitar Lovable Cloud e criar a estrutura via migração única.

### Tabelas (schema `public`, com GRANTs + RLS por `auth.uid()`)
- `profiles` (id=auth.users, name, created_at)
- `accounts` (conta corrente, poupança; saldo atual)
- `categories` (fixa/variável, tipo receita/despesa, ícone, cor)
- `income` (tipo: salario | plantao | comissao | extra; valor; recorrencia; mês/ano referência; status)
- `expenses` (nome, valor, dia_vencimento, categoria, status: pago|pendente|atrasado, parcela_atual, parcelas_total, observacao)
- `transactions` (movimentações realizadas — linha do tempo do fluxo de caixa)
- `cashflow` (snapshots diários calculados: entrada, saída, saldo)
- `reserves` (nome, meta, valor_atual, prioridade, cor)
- `goals` (nome, meta, prazo, valor_atual)
- `forecast` (projeções 30/60/90/180/365 dias — materializadas sob demanda)
- `notifications` (tipo, título, mensagem, lida)
- `insights` (tipo, título, mensagem, severidade, gerado_em)

RLS: cada tabela restrita a `user_id = auth.uid()`. Trigger `on_auth_user_created` cria `profiles`.

### Seed do Lucas
Feito na mesma migração via função que só popula quando um usuário com email marcado como "demo" faz signup — OU via botão "Popular dados de demonstração" no primeiro login. Prefiro a segunda opção: server function `seedLucasData` chamada uma vez após o signup, criando:
- Conta principal
- Receitas: salário CLT líquido 2.825 + plantão 75; comissões previstas ago/set/out/nov/dez; venda sistema 1.500 (a receber)
- Despesas fixas: Condomínio 350 (dia 10), Carro 1.777 (dia 12, atrasado recorrente), Financiamento 1.100 (dia 20), Energia 100 (dia 30), Empréstimo 1.400 (dia 30, parcela 3/6)
- Reservas: Carro (meta 1.777), Emergência (meta 60.000), Investimentos, Estabilidade
- Meta principal: Reserva Emergência 60.000

## 2. Autenticação
- Email + senha (Lovable Cloud Auth)
- Rota pública `/auth` (login/signup)
- Layout gated `_authenticated` gerenciado pela integração
- Google/Apple/biometria ficam para fase 2 (não no MVP)

## 3. Motor de cálculo (server functions)
Server functions puras que consomem as tabelas e devolvem:
- `getBalances`: `{ saldoConta, saldoReservado, saldoComprometido, saldoLivre }` — **saldoLivre é o KPI principal**
- `getMonthSummary`: receitas/despesas/economia do mês
- `getUpcomingBills`: próximas contas ordenadas por vencimento
- `getForecast(days)`: projeção usando receitas previstas − despesas fixas
- `getInsights`: gera dinamicamente frases como "Você já pode pagar a parcela do carro sem juros", "Você possui R$ X realmente livres", "Fluxo ficará negativo em outubro", etc.
- `distributeIncome(incomeId)`: aplica a cascata Contas → Carro → Emergência → Investimentos → Livre

## 4. Frontend — 7 telas

Layout com sidebar (desktop) / bottom-nav (mobile), dark+light mode, saudação "Bom dia, Lucas".

1. **Dashboard** (`/`) — cards KPI (Saldo Conta, Reservado, **Livre**, Emergência, Patrimônio, Receita mês, Despesas mês, Comissão prevista, Próxima conta) + gráfico Receitas×Despesas (Recharts bar) + Evolução Patrimonial (line) + barra da reserva.
2. **Fluxo de Caixa** (`/fluxo`) — timeline vertical com receitas/despesas/reservas, saldo após cada movimento, filtros por tipo/período, pesquisa.
3. **Calendário** (`/calendario`) — grid mensal, contas marcadas com cor (verde pago / azul próximo / vermelho atrasado).
4. **Reservas** (`/reservas`) — cards por reserva com valor, meta, %, tempo estimado.
5. **Metas** (`/metas`) — meta atual, quanto falta, quanto guardar/mês, gráfico de evolução.
6. **Previsão** (`/previsao`) — tabs 30/60/90/180/365 dias com projeção de saldo.
7. **Insights** (`/insights`) — lista de cards de IA financeira (regras determinísticas, sem LLM no MVP).

### Automação de receita
Modal "Receita recebida" com botão "Distribuir automaticamente" → chama `distributeIncome` → mostra a cascata aplicada.

## 5. Design
- Tokens em `src/styles.css`: paleta neutra Apple/Linear, um accent único (verde-menta para positivos, vermelho suave para negativos), radius generoso (16–24px), sombras muito sutis.
- Tipografia: sans stack nativa + Inter carregada via `<link>` no `__root.tsx`.
- Motion: transições `duration-200` em cards; sem parallax nem gradientes chamativos.
- Dark mode via classe `.dark` no `<html>` + toggle no header.
- Responsivo: mobile-first, breakpoint `md:` para sidebar.

## 6. Stack técnica
React 19 + TanStack Start já presentes. Adicionar: `recharts`, `zod`, `react-hook-form`, `date-fns`. shadcn e lucide já disponíveis. React Query já configurado.

## 7. Entrega
- Loaders com `ensureQueryData` + `useSuspenseQuery`
- Todas rotas protegidas em `src/routes/_authenticated/`
- `/` público apenas se não logado (landing curta com CTA), redireciona para `/dashboard` se logado — ou `/` já é o dashboard sob `_authenticated` e `/auth` é a porta pública. Vou pela segunda: mais simples.
- `head()` por rota com título/descrição próprios.

## Fora do escopo do MVP (fase 2)
- Login Google/Apple/biometria
- IA generativa real (LLM) para insights
- Notificações push
- Import de extrato bancário
- Multi-conta bancária avançada
