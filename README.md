# Lya

Lya est un projet expérimental visant à construire une interface de discussion locale
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
```

---

## 🎨 Structure des Données d'un Persona

La définition d'un persona est répartie dans la base de données SQLite (`chat.db`) à travers plusieurs tables, garantissant une structure modulaire et détaillée.

### 1. Table `personas`

C'est la table principale qui contient les informations de base du personnage.

-   **`id`** : Un identifiant unique (ex: `"mei"`).
-   **`name`** : Le nom du personnage (ex: `"Mei"`).
-   **`label`** : Une très courte description pour l'interface (ex: `"Jeune étudiante timide"`).
-   **`nsfw`** : Un booléen (`0` ou `1`) indiquant si le personnage accepte le contenu NSFW.
-   **`introduction`** : La première phrase que le personnage prononce pour démarrer la conversation.
-   **`environment`** : Un texte décrivant la scène ou le contexte initial de la conversation. Ce message est envoyé à l'IA en tant que message système pour définir le cadre.

### 2. Tables de Données Détaillées (`characters`, `relationships`, `outfits`)

Ces tables contiennent des informations complexes stockées au format JSON dans une colonne `data`. Chaque entrée est liée à un `persona_id`.

-   **`characters`** : Décrit l'identité et l'apparence physique du personnage.
    -   Exemple de structure : `{ "id": "mei", "name": "Mei", "age": 18, "profile": { ... }, "appearance": { ... } }`
-   **`relationships`** : Définit la relation entre le personnage et l'utilisateur.
    -   Exemple de structure : `{ "status": "camarade", "dynamics": { ... }, "boundaries": { ... } }`
-   **`outfits`** : Décrit en détail la tenue que porte le personnage.
    -   Exemple de structure : `{ "upper_body": { ... }, "lower_body": { ... }, ... }`

### Construction du Prompt Système

Le message système envoyé à l'IA est construit en deux parties :

1.  **Contexte Détaillé (JSON)** : Les données des tables `characters`, `relationships`, et `outfits` sont combinées en un seul objet JSON. Cet objet est encapsulé dans un bloc `[PROMPT CONTEXTE]` pour fournir à l'IA toutes les informations structurelles sur le personnage.
2.  **Environnement Scénique** : Le contenu du champ `environment` de la table `personas` est envoyé comme un second message système distinct. Il sert à planter le décor de la conversation.

Cette approche sépare clairement **"qui est le personnage"** (les données JSON) de **"où est le personnage et que se passe-t-il"** (l'environnement).
