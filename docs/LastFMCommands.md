# Comandos Last.fm

O módulo `LastFMCommands.js` implementa funcionalidades para obter informações de perfis e estatísticas do Last.fm, o serviço de rastreamento musical.

## Comandos Disponíveis

| Comando | Descrição | Uso |
|---------|-----------|-----|
| `!lastfm` | Exibe informações de um perfil do Last.fm | `!lastfm username` |
| `!lfm` | Alias para o comando lastfm | `!lfm username` |

## Detalhes do comando

### !lastfm / !lfm

Este comando utiliza a API do Last.fm para obter e exibir informações detalhadas sobre um perfil de usuário, incluindo estatísticas de reprodução, artistas e músicas mais ouvidas.

#### Funcionalidades:
- Obtém informações gerais do perfil (nome, país, contagem de reproduções)
- Mostra se o usuário está ouvindo música no momento
- Exibe os principais artistas do usuário
- Exibe as principais músicas do usuário
- Mostra estatísticas gerais (quantidade de scrobbles, músicas e álbuns)

#### Parâmetros:
- **username**: Nome de usuário do Last.fm
  - Exemplo: `!lastfm nomeusuario`

#### Configuração necessária:
- Uma chave de API do Last.fm deve estar configurada no arquivo `.env` como `LASTFM_APIKEY`
- Um segredo de API do Last.fm deve estar configurado no arquivo `.env` como `LASTFM_SECRET`

#### Formato da resposta:
A resposta inclui:
- Informações básicas do perfil (nome, país, idade se disponível)
- Data de registro no serviço
- Contagem total de scrobbles
- Música que o usuário está ouvindo ou que ouviu por último
- Top 3 artistas mais ouvidos
- Top 3 músicas mais ouvidas
- Link para o perfil do usuário

#### Exemplo de uso:
```
!lastfm nomeusuario
```

Isso retornará informações detalhadas sobre o perfil do Last.fm do usuário especificado.

#### Reações de emoji:
- Antes de processar: ⏳
- Após processamento bem-sucedido: 📻
- Em caso de erro: ❌

#### Limitações:
- Depende da disponibilidade da API do Last.fm
- Alguns dados podem estar indisponíveis se o perfil do usuário for privado
- Perfis inexistentes retornarão uma mensagem de erro

#### Dicas:
- Use `!lfm` como um atalho mais rápido para o comando
- A resposta incluirá um aviso se o usuário estiver ouvindo música naquele momento
- As estatísticas são atualizadas em tempo real pela API do Last.fm