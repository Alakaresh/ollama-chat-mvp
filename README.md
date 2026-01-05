# Ollama Chat MVP

Ollama Chat MVP est un projet expérimental visant à construire une interface de discussion locale
basée sur **Ollama**, avec un **contrôle strict du style de réponse**, indépendant du modèle utilisé.

L’objectif n’est pas seulement de discuter avec un LLM, mais de poser les bases d’un **moteur de conversation narratif**, proche des applications mobiles de roleplay / chat immersif.

---

## 🎯 Objectifs du projet

- Fournir une **interface de chat locale simple** connectée à Ollama
- Permettre le **choix du modèle IA** (MythoMax, Dolphin, Mistral, etc.)
- Imposer un **style narratif global cohérent**, quel que soit le modèle
- Séparer clairement :
  - le **style global de l’application**
  - les **personnalités** (à venir)
  - la **logique technique**

À terme :
- ajout de personnalités (personas)
- historique des conversations
- streaming fluide
- application mobile

---

## ✨ Fonctionnalités actuelles

- ✅ Chat simple en un seul flux
- ✅ Sélection du modèle IA via Ollama
- ✅ Réponses en français
- ✅ Style narratif contrôlé :
  - narration fluide
  - paroles entre guillemets
  - pas de listes, pas de ton pédagogique
- ✅ Indicateur de génération (chargement)
- ❌ Pas encore de base de données
- ❌ Pas encore de personas visibles

---

## 🧠 Principe clé

Le projet repose sur une idée centrale :

> **Le style de réponse est défini par l’application, pas par le modèle.**

Un prompt système global impose :
- la forme des réponses
- le rythme
- le réalisme

Si un modèle ne respecte pas le format attendu, une **réécriture automatique** est appliquée côté serveur.

---

## 🛠️ Stack technique

- **Node.js**
- **Express**
- **Ollama (local)**
- JavaScript vanilla (front simple)
- Aucune dépendance frontend lourde

---

## 📦 Prérequis

- Node.js ≥ 18 recommandé
- Ollama installé et lancé
- Au moins un modèle Ollama téléchargé  
  (ex : `HammerAI/mythomax-l2`, `dolphin-mistral`, `mistral`)

---

## 🚀 Installation

```bash
npm install
node server.js
