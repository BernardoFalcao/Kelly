# MEMÓRIAS — Versão com opção de tirar foto no site

Esta versão adiciona:

- Botão `Tirar foto` (abre a câmera no modo foto)
- Botão `Gravar vídeo` (abre a câmera no modo vídeo)
- Botão `Escolher da galeria`
- Envio direto para Google Drive
- Pontuação no Google Sheets
- Galeria
- Ranking

## Como funciona a câmera

O botão `Tirar foto agora` usa este recurso nativo do celular:

```html
<input type="file" accept="image/*" capture="environment">
```

No celular, isso abre a câmera.
Depois que a pessoa tira a foto, ela volta para o site e clica em `Enviar e pontuar`.

## Importante

Em alguns navegadores ou celulares, o sistema pode abrir opções como:
- Câmera
- Galeria
- Arquivos

Isso é comportamento do próprio celular/navegador.

## Como atualizar

1. Substitua os arquivos do site.
2. No `config.js`, coloque sua URL do Apps Script.
3. Se você já está com o Apps Script funcionando, pode manter.
4. Se quiser garantir, substitua também pelo `apps-script.js` deste pacote.
5. Se alterar Apps Script, publique nova versão em:
   `Implantar > Gerenciar implantações > Editar > Nova versão > Implantar`
