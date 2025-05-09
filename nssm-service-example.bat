nssm install ravenabot "C:\Program Files\nodejs\node.exe"
nssm set ravenabot AppDirectory "C:\ravenabot"
nssm set ravenabot AppParameters index.js
nssm set ravenabot AppStdout "C:\ravenabot\logs\ravenabot.service.log"
nssm set ravenabot AppStderr "C:\ravenabot\logs\ravenabot.service.log"