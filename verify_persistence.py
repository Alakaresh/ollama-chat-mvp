
import time
import subprocess
import sys
from playwright.sync_api import sync_playwright, expect

def run_test():
    server = None
    # Supprimer l'ancienne base de données pour garantir un état propre
    try:
        subprocess.run(["rm", "-f", "chat.db"], check=True)
        print("Ancienne base de données supprimée.")
    except Exception as e:
        print(f"Avertissement : n'a pas pu supprimer l'ancienne base de données : {e}")

    try:
        # Démarrer le serveur en arrière-plan
        server = subprocess.Popen(["node", "server.js"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        print("Serveur démarré...")
        time.sleep(5) # Laisser le temps au serveur de s'initialiser

        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page()

            # Intercepter l'appel API pour les modèles
            print("Mise en place du mock pour /api/models...")
            def handle_route(route):
                if "/api/models" in route.request.url:
                    print("Interception de /api/models et renvoi d'un mock.")
                    route.fulfill(
                        status=200,
                        content_type="application/json",
                        body='["mock-model:latest"]'
                    )
                elif "/api/embeddings" in route.request.url:
                    print("Interception de /api/embeddings et renvoi d'un mock.")
                    # nomic-embed-text uses 768 dimensions
                    mock_embedding = [0.1] * 768
                    route.fulfill(
                        status=200,
                        content_type="application/json",
                        body=f'{{"embedding": {str(mock_embedding)}}}'
                    )
                else:
                    route.continue_()
            page.route("**/*", handle_route)


            print("Navigation vers l'application...")
            page.goto("http://localhost:8080")

            # Passer en mode dev pour simplifier le test
            print("Passage en mode 'dev'...")
            page.evaluate("localStorage.setItem('appModeOverride', 'dev')")
            page.reload()

            # Attendre que la page soit prête
            page.wait_for_load_state('networkidle', timeout=15000)

            # Attendre que le sélecteur de persona soit prêt
            persona_selector = page.locator("#personaSelect")
            expect(persona_selector).to_be_visible(timeout=10000)

            # Sélectionner un persona (par exemple, Lina)
            correct_label = "Lina (voisine)"
            print(f"Sélection du persona '{correct_label}'...")
            persona_selector.select_option(label=correct_label)

            # Envoyer un message de test
            test_message = "Ceci est un test de persistance."
            print(f"Envoi du message : '{test_message}'")
            page.locator("#msgInput").fill(test_message)
            page.locator("#sendBtn").click()

            # Attendre que la réponse de l'assistant apparaisse
            print("Attente de la réponse de l'assistant...")
            last_assistant_message = page.locator(".assistant-message .chat-text").last
            expect(last_assistant_message).not_to_be_empty(timeout=30000)
            print("Réponse reçue.")

            # Recharger la page
            print("Rechargement de la page...")
            page.reload()

            # Attendre que la page soit complètement chargée après le rechargement
            page.wait_for_load_state('networkidle', timeout=15000)
            print("Page rechargée.")

            # Vérifier si le message de test est toujours là
            print("Vérification de la persistance...")
            chat_box = page.locator("#chatBox")

            user_message_locator = chat_box.locator(f"text='{test_message}'")
            expect(user_message_locator).to_be_visible(timeout=10000)

            print("✅ Succès : Le message de test est bien présent après rechargement.")
            browser.close()
            return True

    except Exception as e:
        print(f"❌ Échec du test : {e}")
        return False
    finally:
        if server:
            print("Arrêt du serveur...")
            server.terminate()
            server.wait()

if __name__ == "__main__":
    if run_test():
        sys.exit(0)
    else:
        sys.exit(1)
