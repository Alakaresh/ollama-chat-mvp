import subprocess
import time
import datetime
from playwright.sync_api import sync_playwright, expect

# --- Test Configuration ---
SERVER_COMMAND = "node server.js"
APP_URL = "http://localhost:8080"
SCREENSHOT_PATH = "verification.png"

def run_test():
    """
    Runs the end-to-end test to verify message persistence.
    """
    server_process = None
    unique_message = f"Bonjour! C'est un test du {datetime.datetime.now()}"
    print(f"Unique message for this run: '{unique_message}'")

    try:
        # 1. Start the server as a background process
        print(f"Starting server with command: '{SERVER_COMMAND}'")
        server_process = subprocess.Popen(SERVER_COMMAND.split(), stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        time.sleep(15) # Give the server time to start

        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page()

            # 2. Navigate to the app and set dev mode
            print(f"Navigating to {APP_URL}")
            page.goto(APP_URL)
            page.evaluate("localStorage.setItem('appModeOverride', 'dev')")
            page.reload()
            print("App reloaded in 'dev' mode.")

            # 3. Select persona and send a message
            persona_select = page.locator("#personaSelect")
            expect(persona_select).to_be_visible(timeout=10000)

            # Dynamically select the first persona
            first_persona_option = persona_select.locator("option").first
            persona_label_to_test = first_persona_option.text_content()
            print(f"Dynamically selecting first persona: {persona_label_to_test}")
            persona_select.select_option(label=persona_label_to_test)

            msg_input = page.locator("#msgInput")
            send_btn = page.locator("#sendBtn")

            print("Typing and sending the unique message...")
            msg_input.fill(unique_message)
            send_btn.click()

            # 4. Wait for the response to complete (send button is re-enabled)
            print("Waiting for assistant's response...")
            expect(send_btn).to_be_enabled(timeout=30000)
            print("Response received.")

            # 5. Reload the page to test persistence
            print("Reloading the page to check for persistence...")
            page.reload()

            # 6. Re-select the same persona
            expect(persona_select).to_be_visible(timeout=10000)
            print(f"Re-selecting persona: {persona_label_to_test}")
            persona_select.select_option(label=persona_label_to_test)

            # 7. Verify the message is in the chat history
            chat_box = page.locator("#chatBox")
            message_locator = chat_box.locator(f"text='{unique_message}'")

            print("Verifying the message is present in the chat history...")
            expect(message_locator).to_be_visible(timeout=10000)
            print("✅ Verification successful: Message was found in the chat history after reload.")

            # 8. Capture a screenshot
            page.screenshot(path=SCREENSHOT_PATH)
            print(f"Screenshot saved to '{SCREENSHOT_PATH}'")

            browser.close()

    except Exception as e:
        print(f"❌ An error occurred during the test: {e}")
    finally:
        # 9. Clean up the server process
        if server_process:
            print("Stopping the server.")
            server_process.terminate()
            server_process.wait()

if __name__ == "__main__":
    run_test()
