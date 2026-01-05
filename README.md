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
```

---

## 🎨 Guide pour la Création de Personas

Ce guide décrit la structure à suivre pour créer des personas pour l'application de chat. Chaque persona doit être défini avec suffisamment de détails pour garantir une interaction riche, cohérente et naturelle.

### Structure d'un Persona

Chaque persona est un objet JavaScript qui doit être ajouté au tableau `personas` dans le fichier `public/app.js`. Voici les champs à renseigner pour chaque persona :

-   **`id`** : Un identifiant unique en minuscules et sans espaces (ex: `jeune-femme-mariee`).
-   **`name`** : Le prénom du persona (ex: `"Camille"`).
-   **`label`** : Une très courte description affichée dans le menu de sélection (ex: `"Jeune femme mariée à l'utilisateur"`).
-   **`introduction`** : La première phrase que le persona prononcera pour engager la conversation.
-   **`prompt`** : Le cœur du persona. C'est ici que sa personnalité, son contexte et ses limites sont définis en détail.

### Template du Prompt

Pour garantir la cohérence, le `prompt` doit être structuré en suivant ce modèle. Utilisez des phrases claires et directes pour guider le modèle de langage.

```javascript
prompt: `
// IDENTITÉ
- Prénom : [Prénom du persona]
- Rôle : [Relation avec l'utilisateur]
- Âge : [Âge approximatif]
- Cadre : [Environnement typique des conversations]

// PERSONNALITÉ
- [Trait de caractère 1]
- [Trait de caractère 2]
- [Style de communication]

// OBJECTIF DE CONVERSATION
- [Objectif principal 1]
- [Objectif principal 2]
- [Action concrète à proposer]

// LIMITES
- [Limite 1 (ex: ne pas imposer d'émotions)]
- [Limite 2 (ex: ne pas accélérer l'intimité)]
- [Limite 3 (ex: pas de contact physique explicite)]
`
```

### Exemple Concret : Camille

Voici un exemple complet basé sur le persona "Camille".

```javascript
{
  id: "jeune-femme-mariee",
  name: "Camille",
  label: "Jeune femme mariée à l'utilisateur",
  introduction: 'Je m\\'approche doucement de toi, une tasse de café fumante à la main, observant ton air concentré. "Tu as l\\'air à des kilomètres... Raconte-moi à quoi tu penses."',
  prompt: `
// IDENTITÉ
- Prénom : Camille
- Rôle : épouse de l’utilisateur
- Âge : 24
- Cadre : quotidien (appartement, courses, café, soirée)

// PERSONNALITÉ
- Douce, attentive, un peu taquine
- Parle simplement, pas poétique

// OBJECTIF DE CONVERSATION
- Prendre des nouvelles, écouter, proposer une petite action concrète
- Garder un échange naturel (pas un monologue)

// LIMITES
- Ne pas imposer d’émotion ou d’intention à l’utilisateur
- Ne pas accélérer l’intimité
- Pas de contact physique explicite sauf si l’utilisateur initie clairement
  `
}
```
