# Code Signing Guide (Windows) — Digital Branding Masters

You cannot legally or technically **backdate** a code signature. A trusted Timestamp Authority (TSA) will record the actual signing time.
For commercial distribution, sign at release time and include a timestamp so the signature remains valid after the cert expires.

## Choose a certificate
- **EV Code Signing (recommended for public sales)**: Hardware token (YubiKey) required, faster SmartScreen reputation.
- **OV Code Signing**: File-based `.pfx` certificate is fine for smaller distributions.

Popular CAs: DigiCert, Sectigo, GlobalSign. Register under **Digital Branding Masters** (exact legal name).

## Using electron-builder
Electron Builder supports two approaches:

### A) With a `.pfx` file (OV)
Set environment variables (recommended):
```
$env:CSC_LINK="C:\path\to\your-cert.pfx"
$env:CSC_KEY_PASSWORD="yourPfxPassword"
```
Then build:
```
npx electron-builder --win --x64
```

### B) With cert in the Windows Certificate Store (EV/OV)
Install the cert into the **Current User → Personal** store. Set the subject name to match your org:
```
# Example:
# "Digital Branding Masters, LLC" (must match exactly)
```
Add to `package.json > build > win` (already scaffolded to accept this):
```json
{
  "certificateSubjectName": "Digital Branding Masters"
}
```
Then:
```
npx electron-builder --win --x64
```

electron-builder automatically uses a trusted timestamp server (RFC 3161).
If you want to set a specific TSA:
```
setx WIN_CSC_LINK "C:\path\to\cert.pfx"
setx WIN_CSC_KEY_PASSWORD "pfxPassword"
# electron-builder picks a TSA automatically; override via CSC_BUILD_TSA or build.win.signDlls options if needed.
```

## Portable build (unsigned)
For quick sharing:
```
npx electron-builder --win portable
```
This creates a standalone `.exe` without an installer. Signing is optional, but recommended when distributing publicly.

## Notes
- After signing, SmartScreen reputation builds as more users install the app.
- Keep your private keys secure; never commit them to Git.
- The signing timestamp will reflect **the moment of signing**, not the patent date.