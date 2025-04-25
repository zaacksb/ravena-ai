# Comandos de Roleta Russa

Este módulo implementa um jogo de roleta russa no WhatsApp, onde os participantes podem testar sua sorte e são temporariamente silenciados se "perderem".

## Comandos

### !roletarussa

Joga roleta russa, com risco de ser silenciado.

**Descrição:** Simula o jogo de roleta russa, com 1/6 de chance de "morrer" e ser temporariamente silenciado no grupo.

**Uso:** `!roletarussa`

**Detalhes:**
- Cada vez que o comando é usado, há 1/6 de chance (como um revólver de 6 câmaras) de "morrer"
- Se o usuário "morrer", fica silenciado (não pode usar o bot) por um período configurável (padrão: 5 minutos)
- O bot mostra o total de tentativas seguidas sem "morte" do usuário
- Mantém recorde de máximo de tentativas consecutivas sem "morrer" para cada jogador
- Um jogador não pode jogar duas vezes consecutivas (deve esperar outro jogador tentar)

### !roletaranking

Mostra ranking da roleta russa.

**Descrição:** Exibe os rankings de sorte (máximo de tentativas) e de mortes na roleta russa.

**Uso:** `!roletaranking`

**Detalhes:**
- Mostra dois rankings diferentes:
  1. **Ranking de Sorte**: Jogadores com mais tentativas consecutivas sem "morrer"
  2. **Ranking de Mortes**: Jogadores com maior número total de "mortes"
- Exibe até 10 jogadores em cada ranking
- Destaca os primeiros colocados com emojis especiais
- Mostra a sequência atual de cada jogador (se estiver ativo)
- Disponível apenas em grupos

## Mecânica do Jogo

O jogo segue estas regras:

1. Quando um jogador usa `!roletarussa`, o sistema gera um número aleatório entre 0 e 5
2. Se o número for 0 (1/6 de chance), o jogador "morre" e é temporariamente silenciado
3. Se não, a contagem de tentativas do jogador aumenta e ele pode continuar jogando
4. Um jogador não pode jogar duas vezes consecutivas (precisa esperar outro jogador)
5. Quando um jogador "morre":
   - Sua contagem atual de tentativas é resetada para 0
   - O recorde pessoal é atualizado se a sequência atual for maior
   - O jogador fica em "timeout" pelo tempo configurado no grupo
   - O total de mortes do jogador é incrementado

## Sistema de Timeout

O sistema de timeout implementa:

- Verificação automática a cada 30 segundos para liberar jogadores
- Persistência do status entre reinicializações do bot
- Identificação do jogador por número de telefone
- Monitoramento de tempo restante para cada jogador em timeout

## Código-fonte

Este módulo está implementado no arquivo `src/functions/RoletaRussaCommands.js` e utiliza:
- Sistema de persistência baseado em JSON para manter rankings e status
- Timer para gerenciar os tempos de timeout dos jogadores
- Integração com sistema de apelidos do grupo

## Configuração

O tempo de timeout pode ser configurado para cada grupo usando o comando de gerenciamento:

```
!g-setTempoRoleta [segundos]
```

O valor padrão é de 300 segundos (5 minutos).

---

*Este documento faz parte da [Documentação de Comandos do RavenaBot AI](README.md#documentação-dos-comandos)*