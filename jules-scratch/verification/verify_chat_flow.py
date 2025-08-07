import re
from playwright.sync_api import sync_playwright, Page, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    try:
        page.goto("http://localhost:3000/")

        # Check if we need to enter API keys
        api_key_heading = page.get_by_role("heading", name="Add Your API Keys To Start Chatting")
        if api_key_heading.is_visible():
            # Fill in a dummy Google API key
            page.get_by_label("Google API Key").fill("dummy-google-api-key")
            page.get_by_role("button", name="Save API Keys").click()

        # Wait for the main chat interface to load
        page.screenshot(path="jules-scratch/verification/debug_before_chat_input.png")
        expect(page.get_by_placeholder("What can I do for you?")).to_be_visible(timeout=10000)

        # Send a message
        page.get_by_placeholder("What can I do for you?").fill("Hello, world!")
        page.get_by_label("Send message").click()

        # Wait for the user message to appear
        expect(page.get_by_text("Hello, world!")).to_be_visible()

        # Wait for the AI response to start streaming
        # We can look for the message container and then check that its text changes.
        # The AI response is inside a div that is a sibling of the user message's div.
        # This is a bit brittle, a better way would be to have a data-testid on the message elements.

        # Let's find the container for the assistant's response.
        # The messages are in <section> inside <main>. Each message is a <div role="article">
        assistant_message_locator = page.locator('div[role="article"]').nth(1)
        expect(assistant_message_locator).to_be_visible(timeout=10000)

        # Now, check for streaming. We'll take the initial text, wait a bit,
        # and expect the text to have changed.
        initial_text = assistant_message_locator.inner_text()

        # Wait for a short period to allow more content to stream in
        page.wait_for_timeout(1000)

        expect(assistant_message_locator).not_to_have_text(initial_text, timeout=10000)

        page.screenshot(path="jules-scratch/verification/verification.png")

    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)
