# Vercel edition

The `crestwatch-vercel` branch runs the complete current UI and river APIs as a native Next.js deployment. Build with `npm run build`, then `npm start`. `vercel.json` selects Next.js and `.next` output. No new API keys are required by the application.

The participant study continues using the existing private D1 service at https://crestwatch-river-guide.utsavsresearch.chatgpt.site/api/participant. Vercel's server route validates same-origin writes, forwards only the anonymous study cookie (never Vercel login or unrelated browser cookies), and returns the study service's own cookie/status. Requests and responses are uncached. The public Sites app and its study service must remain published; this is an explicit backend dependency. No study database migration, duplication or public results endpoint is introduced.

The original D1 handler is preserved at server/cloudflare-participant-service.ts for provenance; it is not imported by the Next.js runtime. The Sites checkout remains separate and unchanged. Both domains save responses to the same private project database, while browser cookies and saved places belong to each domain. Existing saved responses are not automatically linked across browser origins.

Deploy a preview to the existing Vercel project, check all page routes, river feeds, audit files and the full study start/save/resume/withdrawal flow, then promote the verified deployment to production. Do not claim a deployment has completed until Vercel reports READY and the intended production domain serves it.
