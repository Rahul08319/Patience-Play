# YouTube Playables release notes

## Scope

This project uses the YouTube Playables SDK for readiness, player saves, system audio, pause/resume, language, health reporting, and score reporting. It does not use any ads or monetization API.

## Responsive canvas

The game fills the viewport and keeps interactive content inside safe-area padding. It has been designed for portrait, landscape, square, and ultrawide viewports without locking orientation. Resizing preserves the current React game state.

## Test before submission

Use the Test Suite Link supplied by the YouTube Playables Developer Portal after uploading a release. Check all SDK events plus touch, mouse, keyboard, fullscreen, pause/resume, and cloud saves. Test at least 9:32, 9:21, 9:16, 3:4, 1:1, 4:3, 16:9, 21:9, and 32:9.

## Publishing reminders

- Configure all required metadata and thumbnails in the Developer Portal.
- Keep the final bundle within the portal's current size limits.
- Review the portal test results before submitting for certification.
- Test the generated Dev Link on desktop web, mobile web, Android, and iOS.
