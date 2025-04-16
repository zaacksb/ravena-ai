# Menu de Comandos

O módulo `Menu.js` implementa comandos para exibir uma lista organizada de todos os comandos disponíveis no bot, incluindo comandos fixos, personalizados e de gerenciamento.

## Implementação

Este módulo foi projetado para fornecer uma maneira fácil para os usuários descobrirem os comandos disponíveis no bot. Ele:

- Coleta todos os comandos fixos do sistema
- Obtém comandos personalizados específicos para o grupo atual
- Organiza comandos por categorias para melhor visualização
- Exibe informações detalhadas incluindo descrições e reações

## Comandos Disponíveis

| Comando | Descrição | Aliases |
|---------|-----------|---------|
| `!cmd` | Mostra todos os comandos disponíveis | - |
| `!menu` | Alias para o comando `!cmd` | - |

## Exemplos de Uso

### Comando !cmd ou !menu

**Entrada:**
```
!cmd
```
ou
```
!menu
```

**Saída:**
```
Comandos Disponíveis

Comandos Personalizados:
• !meme
• !regras
• !boas-vindas

Comandos de Grupo:
• !atencao: Menciona todos os membros do grupo silenciosamente
• !galera: Menciona todos os membros do grupo silenciosamente
• !ignorar: Alterna ser ignorado pelas menções de grupo

Comandos Gerais:
• !ping: Verifica se o bot está online
• !ai: Pergunte algo à IA
• !echo: Repete o texto fornecido
• !roll: Joga um dado (padrão: 6 lados)
• !yt: Baixa um vídeo do YouTube
• !sr: Baixa um áudio do YouTube
• !clima: Mostra o clima atual e previsão para uma localização
• !weather: Show weather forecast for a location (English version)
...

Comandos de Gerenciamento:
• !g-help: Mostra ajuda de comandos de gerenciamento
• !g-info: Mostra informações detalhadas do grupo
• !g-setName: Muda nome do grupo
• !g-addCmd: Adiciona um comando personalizado
• !g-delCmd: Exclui um comando personalizado
• !g-enableCmd: Habilita um comando personalizado
• !g-disableCmd: Desabilita um comando personalizado
• !g-setCustomPrefix: Muda prefixo de comando
• !g-setWelcome: Define mensagem de boas-vindas
• !g-setFarewell: Define mensagem de despedida
• !g-setReact: Define reação 'depois' do comando
• !g-setStartReact: Define reação 'antes' do comando
• !g-filtro-palavra: Adiciona/remove palavras do filtro
• !g-filtro-links: Ativa/desativa filtro de links
• !g-filtro-pessoa: Adiciona/remove pessoas do filtro
• !g-filtro-nsfw: Ativa/desativa filtro de conteúdo NSFW
```

O resultado exato do comando varia dependendo dos comandos disponíveis no bot e dos comandos personalizados criados no grupo.

## Funcionamento Interno

O módulo usa as seguintes funções principais:

### `groupCommandsByCategory`

Agrupa os comandos por categoria para melhor organização visual. As categorias incluem:
- **group**: Comandos relacionados a funcionalidades de grupo
- **fixed**: Comandos do sistema
- **management**: Comandos de gerenciamento
- **custom**: Comandos personalizados criados pelos usuários

### `formatCommand`

Formata cada comando para exibição, incluindo:
- Nome do comando
- Aliases (comandos alternativos)
- Reações de emoji associadas
- Descrição

### `sendCommandList`

A função principal que:
1. Obtém todos os comandos fixos do sistema
2. Obtém comandos personalizados para o grupo atual
3. Agrupa os comandos por categoria
4. Formata a mensagem de saída
5. Envia a lista de comandos para o chat

## Personalização do Prefixo

O módulo respeita o prefixo de comando personalizado de cada grupo. Por exemplo, se um grupo mudou seu prefixo para `#`, o menu exibirá comandos com este prefixo (ex: `#ping` em vez de `!ping`).

## Notas Adicionais

- O menu exibe primeiro os comandos personalizados, priorizando funcionalidades específicas do grupo
- Os comandos de gerenciamento são sempre exibidos por último, já que são usados com menos frequência
- O módulo atualiza automaticamente o menu quando novos comandos são adicionados ou quando comandos personalizados são criados
- Comandos ocultos (`hidden: true`) não são exibidos no menu