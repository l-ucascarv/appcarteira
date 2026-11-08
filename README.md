# Carteira

Crie um aplicativo financeiro premium chamado "Meu Caixa".

O aplicativo deve iniciar totalmente funcional utilizando dados reais de um usuário chamado Lucas, apenas como dados iniciais (seed data). Toda a estrutura deve permitir posteriormente apagar esses dados e criar novos usuários normalmente.

#############################

OBJETIVO

O aplicativo deve ser um consultor financeiro pessoal.

Ele não deve apenas registrar gastos.

Ele deve organizar automaticamente o dinheiro do usuário conforme prioridades financeiras.

O foco principal é Fluxo de Caixa.

Toda decisão do sistema deve responder à pergunta:

"Quanto desse dinheiro realmente está disponível para gastar?"

#############################

DESIGN

Inspirado em:

Apple

Nubank

Linear

Notion

Interface extremamente limpa.

Poucas cores.

Muito espaço em branco.

Cards arredondados.

Animações suaves.

Design premium.

Responsivo para mobile e desktop.

Dark Mode.

Light Mode.

#############################

TECNOLOGIAS

React

TypeScript

Tailwind

Shadcn UI

Lucide Icons

Supabase

PostgreSQL

Recharts

React Query

Zod

React Hook Form

#############################

AUTENTICAÇÃO

Login Google

Login Apple

Login Email

Biometria

#############################

BANCO DE DADOS

Criar tabelas:

users

accounts

income

expenses

categories

cashflow

goals

reserves

notifications

transactions

forecast

#############################

DADOS INICIAIS

Usuário

Nome

Lucas

#############################

Receita fixa

Salário CLT

Bruto

3000

Considerar líquido aproximado

2825

Plantão mensal

75

#############################

Comissões previstas

Agosto

4150

Setembro

11500

Outubro

2500

Novembro

2500

Dezembro

2000

#############################

Receita extraordinária

Venda sistema

1500

Status

Receber

#############################

DESPESAS FIXAS

Condomínio

350

Dia 10

--------------------

Parcela carro

1777

Dia 12

Status

Em atraso recorrente

Observação

Hoje é paga normalmente dia 30 devido ao fluxo de caixa.

Criar insight automático sugerindo reservar esse valor assim que entrar comissão.

--------------------

Financiamento

1100

Dia 20

--------------------

Energia

100

Dia 30

--------------------

Empréstimo

1400

Dia 30

Parcela

3 de 6

#############################

META PRINCIPAL

Reserva de Emergência

Meta

60000

Mostrar barra de progresso.

Mostrar tempo previsto para conclusão.

#############################

OBJETIVOS SECUNDÁRIOS

Eliminar juros da parcela do carro.

Criar reserva de fluxo.

Criar reserva de emergência.

Criar patrimônio.

#############################

TELA 1

Dashboard

Mostrar:

Bom dia Lucas

Saldo em conta

Dinheiro reservado

Dinheiro disponível

Reserva Emergência

Patrimônio

Receita do mês

Despesas do mês

Comissão prevista

Próxima conta

Gráfico Receitas x Despesas

Gráfico Evolução Patrimonial

Barra da Reserva

#############################

TELA 2

Fluxo de Caixa

Linha do tempo.

Receitas.

Despesas.

Reservas.

Saldo após cada movimentação.

Filtros.

Pesquisa.

#############################

TELA 3

Calendário

Mostrar todas as contas.

Dia 10

Condomínio

Dia 12

Carro

Dia 20

Financiamento

Dia 30

Energia

Empréstimo

Alterar cor conforme:

Pago

Próximo

Atrasado

#############################

TELA 4

Reservas

Reserva Carro

Meta

1777

Reserva Emergência

Meta

60000

Reserva Investimentos

Reserva Estabilidade

Cada cartão mostra:

Valor

Meta

%

Tempo estimado

#############################

TELA 5

Metas

Meta atual

Quanto falta

Quanto guardar por mês

Gráfico evolução

#############################

TELA 6

Previsão

Projetar automaticamente:

30 dias

60 dias

90 dias

180 dias

12 meses

Utilizar receitas previstas.

#############################

TELA 7

Insights

Criar IA financeira.

Exemplos:

"Você já pode pagar a parcela do carro sem juros."

"Você possui R$ 2.300 realmente livres."

"Sua reserva atingirá R$ 60 mil em aproximadamente X meses."

"Você gastou menos que no mês anterior."

"Sua comissão foi suficiente para aumentar sua reserva."

"Seu fluxo de caixa ficará negativo em outubro caso mantenha este ritmo."

#############################

AUTOMAÇÕES

Quando entrar qualquer receita:

Abrir modal.

"Receita recebida"

Valor

Botão

Distribuir automaticamente

Distribuição padrão

1 Reservar contas

2 Reservar carro

3 Reserva emergência

4 Investimentos

5 Dinheiro livre

#############################

DASHBOARD

Criar indicadores:

Receita

Despesas

Economia

Patrimônio

Fluxo de Caixa

Reserva

Metas

Disponível para gastar

#############################

DIFERENCIAL

O aplicativo nunca deve mostrar apenas o saldo bancário.

Sempre mostrar:

Saldo em Conta

Saldo Reservado

Saldo Comprometido

Saldo Livre

Este último deve ser o principal indicador do sistema.

#############################

ARQUITETURA

Código limpo.

Componentização.

Escalável.

Preparado para multiusuários.

Pronto para publicação.

Separar frontend e backend.

Criar estrutura profissional seguindo boas práticas.

Gerar uma aplicação completa, pronta para produção.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://appcarteira.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/31efa919-3080-4037-8fd5-72d42a57e0a6).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
