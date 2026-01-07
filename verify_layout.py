
import asyncio
import subprocess
from playwright.async_api import async_playwright
import time

async def main():
    print("Lancement du serveur Node.js...")
    # Exécute le serveur en arrière-plan
    server_process = subprocess.Popen(
        ['node', 'server.js'],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )

    # Donne au serveur un moment pour démarrer
    await asyncio.sleep(3)
    print("Serveur démarré.")

    try:
        async with async_playwright() as p:
            print("Lancement du navigateur...")
            browser = await p.chromium.launch()
            page = await browser.new_page()

            # Simule une vue mobile pour le test
            await page.set_viewport_size({"width": 375, "height": 667})

            print("Navigation vers http://localhost:8080...")
            await page.goto("http://localhost:8080", wait_until="networkidle")

            print("Passage en mode production...")
            await page.check('#appModeToggle')
            # Attendre que le changement de mode se propage
            await page.wait_for_timeout(500)

            print("Prise de la capture d'écran...")
            await page.screenshot(path="layout_final.png")
            print("Capture d'écran sauvegardée sous le nom de layout_final.png")

            await browser.close()
    finally:
        print("Arrêt du serveur...")
        server_process.kill()
        # Affiche la sortie du serveur pour le débogage si nécessaire
        stdout, stderr = server_process.communicate()
        print("Sortie du serveur:", stdout)
        if stderr:
            print("Erreurs du serveur:", stderr)

if __name__ == "__main__":
    asyncio.run(main())
