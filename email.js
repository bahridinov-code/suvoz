// Suvoz emails: one shared look for every email the server sends and for the templates pasted into Supabase.
const SITE = (process.env.SITE_URL || 'https://suvoz.io').replace(/\/$/, '');
const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// parts: { preheader, title, paragraphs: [text], rows: [[label, value]], button: {text, url}, note }
// Texts are escaped here, except when a part is passed as { raw: '...' } (used for template variables).
function layout(parts) {
  const t = (x) => (x && x.raw !== undefined ? x.raw : esc(x));
  const paras = (parts.paragraphs || []).map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#3a3a3f">${t(p)}</p>`).join('');
  const rows = parts.rows && parts.rows.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;border:1px solid #e4e4e9;border-radius:12px;border-collapse:separate;background:#fbfbfd">${parts.rows
        .map(([k, v], i) => `<tr><td style="padding:12px 16px;font-size:14px;color:#6e6e73;${i ? 'border-top:1px solid #e4e4e9;' : ''}">${t(k)}</td><td align="right" style="padding:12px 16px;font-size:14px;font-weight:600;color:#1d1d1f;${i ? 'border-top:1px solid #e4e4e9;' : ''}">${t(v)}</td></tr>`)
        .join('')}</table>`
    : '';
  const button = parts.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px"><tr><td style="background:#3b3fe0;border-radius:10px"><a href="${t(parts.button.url)}" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none">${t(parts.button.text)}</a></td></tr></table>`
    : '';
  const code = parts.code ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 24px"><tr><td align="center" style="background:#eeeffd;border-radius:12px;padding:20px 12px;font-family:'SF Mono',Menlo,Consolas,monospace;font-size:34px;font-weight:700;letter-spacing:10px;color:#2e32c4">${t(parts.code)}</td></tr></table>` : '';
  const note = parts.note ? `<p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#6e6e73">${t(parts.note)}</p>` : '';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${t(parts.title)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${t(parts.preheader || '')}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f8"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
<tr><td style="padding:0 4px 20px"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td><img src="${SITE}/email-logo.png" width="36" height="36" alt="" style="display:block;border:0"></td><td style="padding-left:10px;font-size:22px;font-weight:800;letter-spacing:-0.02em;color:#1d1d1f">Suvoz</td></tr></table></td></tr>
<tr><td style="background:#ffffff;border-radius:16px;padding:36px 32px">
<h1 style="margin:0 0 18px;font-size:24px;line-height:1.3;letter-spacing:-0.02em;color:#1d1d1f">${t(parts.title)}</h1>
${paras}${code}${rows}${button}${note}
</td></tr>
<tr><td style="padding:22px 8px 0;font-size:12px;line-height:1.7;color:#8a8a90;text-align:center">Suvoz &middot; HORIZON GATE COMMERCE FZE LLC, Ajman, United Arab Emirates<br>Questions? Just reply to this email or write to <a href="mailto:support@suvoz.io" style="color:#6e6e73">support@suvoz.io</a></td></tr>
</table></td></tr></table></body></html>`;
}

// Plain-text twin of an email (better for spam filters and for people who read text only).
function text(parts) {
  const strip = (x) => (x && x.raw !== undefined ? x.raw : String(x));
  const out = [strip(parts.title), ''];
  (parts.paragraphs || []).forEach((p) => out.push(strip(p), ''));
  (parts.rows || []).forEach(([k, v]) => out.push(strip(k) + ': ' + strip(v)));
  if (parts.rows && parts.rows.length) out.push('');
  if (parts.code) out.push('Code: ' + strip(parts.code), '');
  if (parts.button) out.push(strip(parts.button.text) + ': ' + strip(parts.button.url), '');
  if (parts.note) out.push(strip(parts.note), '');
  out.push('Suvoz - HORIZON GATE COMMERCE FZE LLC, Ajman, UAE', 'support@suvoz.io');
  return out.join('\n');
}

const money = (cents, cur) => {
  const c = String(cur || 'usd').toUpperCase();
  const n = (cents / 100).toFixed(2);
  return c === 'USD' ? '$' + n : n + ' ' + c;
};
const dateText = (unixSeconds) => new Date(unixSeconds * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

// ---- The emails ----
function receiptEmail({ planName, minutes, amount, currency, renewal, until, yearly }) {
  const parts = {
    preheader: renewal ? 'Your Suvoz plan was renewed.' : 'Your plan is active. Your minutes are ready.',
    title: renewal ? 'Your plan was renewed' : 'Thank you! Your plan is active',
    paragraphs: [
      renewal ? (yearly ? 'We received your payment and renewed your plan for another year.' : 'We received your payment and added your minutes for the new month.') : 'We received your payment. Your minutes are ready, so you can start creating audio now.',
    ],
    rows: yearly
      ? [['Plan', planName + ' (yearly)'], ['Minutes each month', String(minutes)], ['Paid', money(amount, currency)], ['Plan valid until', until]]
      : [['Plan', planName], ['Minutes this month', String(minutes)], ['Paid', money(amount, currency)], ['Minutes valid until', until]],
    button: { text: 'Open Suvoz', url: SITE + '/app' },
    note: (yearly ? 'Your minutes refill every month. Unused minutes do not carry over to the next month. ' : 'Unused minutes do not carry over to the next month. ') + 'You can cancel any time with the Manage plan button in the app.',
  };
  return { subject: renewal ? 'Your Suvoz plan was renewed' : 'Your Suvoz plan is active', html: layout(parts), text: text(parts) };
}
function cancelEmail({ planName, until }) {
  const parts = {
    preheader: 'Your plan will not renew. You keep your minutes until ' + until + '.',
    title: 'Your subscription is cancelled',
    paragraphs: [
      'We are sorry to see you go. Your ' + planName + ' plan will not renew, and you will not be charged again.',
      'You can keep using your remaining minutes until ' + until + '.',
      'Changed your mind? You can subscribe again at any time.',
    ],
    button: { text: 'Open Suvoz', url: SITE + '/app' },
    note: 'If you cancelled by mistake or need help, reply to this email and we will sort it out.',
  };
  return { subject: 'Your Suvoz subscription is cancelled', html: layout(parts), text: text(parts) };
}

// ---- Templates pasted into Supabase (Authentication > Email). {{ ... }} are Supabase's own variables. ----
const templates = {
  // One template for two cases, so it holds both versions. People who signed up with a code are marked
  // (signup_via) when we send the code, and Supabase shows only the matching version.
  confirm: {
    subject: 'Confirm your email for Suvoz',
    parts: {
      preheader: 'One click and your account is ready.',
      title: 'Confirm your email',
      paragraphs: ['Welcome to Suvoz! Press the button to confirm your email and start turning scripts into conversations. Your free minutes are waiting.'],
      button: { text: 'Confirm email', url: { raw: '{{ .ConfirmationURL }}' } },
      note: 'If you did not create a Suvoz account, you can safely ignore this email.',
    },
    codeParts: {
      preheader: 'Your code to finish creating your Suvoz account.',
      title: 'Your sign-up code',
      paragraphs: ['Welcome to Suvoz! Enter this code on the Suvoz page to finish creating your account. Your free minutes are waiting.'],
      code: { raw: '{{ .Token }}' },
      note: 'If you did not create a Suvoz account, you can safely ignore this email.',
    },
  },
  magic: {
    subject: 'Your Suvoz login code',
    parts: {
      preheader: 'Your code to log in to Suvoz.',
      title: 'Your login code',
      paragraphs: ['Enter this code on the Suvoz page to log in. It works for a short time only.'],
      code: { raw: '{{ .Token }}' },
      note: 'If you did not ask to log in, you can ignore this email. Nobody can get into your account without this code.',
    },
  },
  reset: {
    subject: 'Reset your Suvoz password',
    parts: {
      preheader: 'Choose a new password for your Suvoz account.',
      title: 'Reset your password',
      paragraphs: ['We received a request to reset the password of your Suvoz account. Press the button to choose a new one.'],
      button: { text: 'Choose a new password', url: { raw: '{{ .ConfirmationURL }}' } },
      note: 'If you did not ask for this, you can ignore this email. Your password stays the same.',
    },
  },
};

module.exports = { layout, text, receiptEmail, cancelEmail, templates, dateText, money };
