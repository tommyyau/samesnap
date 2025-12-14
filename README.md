<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1at5pUAv0ii0qaIjIxAXoLVO9Zqk_DZ8Z

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Lobby Timeout & Rematch Behavior

- Multiplayer rooms stay in the waiting state for up to **60 seconds**. If the host does not start a game before the timer expires, the server emits a `room_expired` event and closes every connection so players return to the lobby. Create a new room to try again.
- After a game ends, players can tap **Play Again** within the 10-second rejoin window. The next match reuses the **last selected difficulty and duration**, so short games stay short unless the host changes the settings during the GAME_OVER phase.
