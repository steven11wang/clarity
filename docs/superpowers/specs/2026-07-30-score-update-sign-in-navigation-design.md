 # Score update and sign-in navigation

 ## Goal

 Make the two account-related entry points lead to the distinct flows shown in the provided screenshots:

 - Settings → Score update opens the full score upload page.
 - The green top-right account/profile control opens the sign-in/profile entry flow.

 ## Existing structure

 `SettingsPopover` already owns the Score update action and receives an `onScoreUpdate` callback from `ProgressDashboard`. The upload UI already exists in `Onboarding` and can be rendered as the score-update experience. The existing auth boundary owns the sign-in form and local profile chooser, so the top-right control should invoke that existing entry flow rather than duplicating auth UI.

 ## Design

 Keep score update as an explicit dashboard action. Its handler should switch the app into the existing onboarding/upload experience without changing stored progression until the user confirms the uploaded results.

 Give the top-right green control its own account-entry action. When activated, it should expose the existing auth/profile gate. The settings popover remains available through the settings trigger, and the two controls must not share a destination.

 ## Testing

 Add focused DOM-level coverage for the two user-visible actions and their destinations. The regression test should verify that activating Score update renders the upload experience, while activating the top-right green control renders the sign-in/profile entry experience. Run the focused test first to confirm it fails, then implement the smallest change and run the complete test suite and production build.

 ## Out of scope

 No changes to score parsing, confirmation semantics, account persistence, visual styling, or unrelated dashboard navigation.
