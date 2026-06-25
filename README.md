# SAP Invoice Downloader

Extension Chrome de test pour automatiser progressivement le telechargement des factures depuis SAP Fiori / VIM Analytics.

## Installation

1. Telecharger le depot en ZIP depuis GitHub ou le cloner.
2. Ouvrir Chrome et aller sur `chrome://extensions`.
3. Activer le mode developpeur.
4. Cliquer sur `Charger l'extension non empaquetee`.
5. Selectionner le dossier qui contient `manifest.json`.
6. Ouvrir SAP Fiori / VIM Analytics.

## V0.1

Cette version injecte un panneau dans SAP avec des boutons de test :

- Tester la detection
- Cliquer Attachment List
- Ouvrir France Supplier Invoices
- Cliquer Download
- Test facture courante

## Important

Cette version sert a calibrer l'automatisation sur ton SAP reel. Le telechargement massif viendra apres validation des clics de base.
