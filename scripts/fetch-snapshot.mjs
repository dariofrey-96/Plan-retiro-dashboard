name: Snapshot horario de la cartera

on:
  schedule:
    # Cada hora, en el minuto 0. GitHub no garantiza el minuto exacto (puede
    # correr con unos minutos de demora), pero sí una corrida por hora.
    - cron: '0 * * * *'
  workflow_dispatch: {} # permite tocar "Run workflow" a mano desde la pestaña Actions

permissions:
  contents: write # necesario para que el propio workflow pueda commitear history.json

jobs:
  snapshot:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout del repo
        uses: actions/checkout@v4

      - name: Node 20
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Generar snapshot
        env:
          TWELVEDATA_API_KEY: ${{ secrets.TWELVEDATA_API_KEY }}
        run: node scripts/fetch-snapshot.mjs

      - name: Commitear history.json si cambió
        run: |
          git config user.name "snapshot-bot"
          git config user.email "actions@users.noreply.github.com"
          if ! git diff --quiet -- history.json; then
            git add history.json
            git commit -m "Snapshot de cartera $(date -u +%Y-%m-%d\ %H:%M)"
            git push
          else
            echo "Sin cambios, nada para commitear."
          fi
