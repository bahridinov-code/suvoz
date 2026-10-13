# Suvoz

Landing page, sign-up/login and the audio tool (script to multi-voice MP3). No packages to install, only Node.js 20+.

Pages: `/` landing, `/login` sign up and log in, `/app` the tool. Languages: English, Arabic, Russian, Tajik, Uzbek.

## Run on your computer
1. Copy `.env.example` to `.env` and fill in the ElevenLabs key (and the two Supabase lines, already filled in the example).
2. In this folder run: `npm run dev`
3. Open http://localhost:3000

## Set up accounts (one time)
1. Supabase > SQL Editor: paste the whole file `supabase-setup.sql` and click Run.
2. Supabase > Authentication > URL Configuration: Site URL `http://localhost:3000`, and add `http://localhost:3000/**` to Redirect URLs. When the real domain goes live, add `https://suvoz.io/**` and change Site URL.
3. Supabase > Authentication > Sign In / Providers > Email: keep "Confirm email" ON, set minimum password length to 8.

New users get a free trial of 1800 characters (about 2 minutes). To change it, edit the number 1800 in `supabase-setup.sql` and run it again.

## Change the brand or the text
`public/i18n.js` (first line: name, domain, legal company name; landing and tool text in 5 languages) and `public/i18n-auth.js` (sign-up, login and account text).

## Before going public
- Tajik and Uzbek text must be checked by native speakers.
- Add your legal company name, Terms and Privacy pages.
- Confirm ElevenLabs commercial use on your plan.
- Connect your own email sender (Resend) in Supabase: the built-in sender allows only a few emails per hour.
