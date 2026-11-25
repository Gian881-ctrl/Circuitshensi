# Circuit Senshi Tech Solutions

Static service and quotation website for the Circuit Senshi repair bench in Dagupan City. GitHub Pages serves the repository root. The site uses vanilla HTML, CSS, and JavaScript and has no build step.

## Booking and follow-up

Each service card selects the corresponding option in the inquiry form. A submission uses the existing EmailJS template and Formspree endpoint to contact the shop. At least one shop notification must succeed before the form clears. If the customer’s email copy fails, the page still displays the reference. With JavaScript disabled, the form posts directly to Formspree.

Reply to the customer by email to confirm the diagnosis, price, turnaround, handover, and any payment. Verify transfers through your payment provider before issuing a receipt. The reference lookup reads this browser’s saved records and can open an email to the shop. Older CS- references continue to work.

## Updating the site

- Edit the service cards, matching form options, shop hours, FAQ, and portfolio in `index.html`. The form option’s `data-key` matches the card’s `data-service`. A missing `data-price` means the shop quotes after assessment.
- Update warranty, cancellation, and privacy details in `policies.html`. Keep the warranty summary and footer hours consistent on both pages.
- The estimator's issue tiers, planning ranges, and bench windows are in `estimateTiers` in `app.js`. Update the matching card, trust strip, and FAQ in `index.html` when prices or times change. The ₱300 diagnostic, board repair range and PCB starting/hourly rates come from the shop's published pricing. The other ranges and one-shop-day reply target are planning estimates.
- Locking an estimate attaches the selected issue, price, timing, and scope to the request. The customer can change or remove it before sending. A written quote and authorization follow separately.
- Replace each marked walkthrough in `#portfolio` with the approved job photos, challenge, work, and verified result. Replace the samples in `#assurance` with permissioned customer feedback and display names. Update the visible preview labels when the underlying content is genuine.
- Keep the active EmailJS service, template, and public key in `app.js`. The Formspree endpoint is the form action in `index.html`. To change the shop email, update both pages and `app.js`.
- Update the embedded video ID in `work-video.js` and the direct video link in `index.html` together.
- The social preview is `assets/social-preview.jpg`. If the public domain changes, update the absolute canonical, social, and structured-data URLs in the HTML.

The original photos and Manrope font remain in `assets/` alongside the optimized WebP and WOFF2 files used on the site. The phone hero and keyboard service illustration are AI-generated product images. The recent-work section links to the shop’s own video. The font license is in `assets/OFL.txt`.
