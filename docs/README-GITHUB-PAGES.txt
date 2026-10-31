OU KTV — Browser Test Version

This package is for testing the existing web interface through GitHub Pages.
It does not include a backend. Account registration is bypassed in this test-mode
source, but server-dependent functions (login, room creation/joining, song search,
shared queue/playback, admin tools) will not work until a backend is connected.

PUBLISH TO YOUR EXISTING REPOSITORY:
1. Open https://github.com/OUTheBuilder/OU-KTV
2. Add the contents of this folder (index.html, ext/, README-GITHUB-PAGES.txt)
   to a NEW folder named `docs` on the main branch.
3. Commit the files.
4. Open repository Settings > Pages.
5. Under Build and deployment, choose Deploy from a branch.
6. Select branch `main` and folder `/docs`, then Save.
7. Wait for GitHub Pages to publish. The test URL will be:
   https://outhebuilder.github.io/OU-KTV/

IMPORTANT:
- Do not replace or edit .github/workflows/android.yml.
- Do not replace the Android source ZIP for this web test.
- Keep this web test in /docs so the existing APK workflow stays intact.
