import { Resend } from 'resend';
import { config } from '../config.js';

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Gmail-friendly HTML: table layout + inline CSS only.
 */
export function renderEditionEmail({ editionDate, editionNumber, payload, appUrl }) {
  const dateLabel = formatLongDate(editionDate);
  const stories = payload.top_stories
    .map((s, i) => {
      const primary = s.source_urls[0];
      const more =
        s.source_urls.length > 1
          ? `<div style="font-size:12px;color:#555;margin-top:6px;">Also: ${s.source_urls
              .slice(1)
              .map((u) => `<a href="${esc(u)}" style="color:#333;">${esc(shortHost(u))}</a>`)
              .join(' · ')}</div>`
          : '';
      const lead = i === 0;
      return `
        <tr>
          <td style="padding:18px 0;border-bottom:1px solid #222;">
            <div style="font-family:Georgia,'Times New Roman',serif;font-size:${
              lead ? '26px' : '20px'
            };line-height:1.25;font-weight:700;margin:0 0 8px;">
              <a href="${esc(primary)}" style="color:#111;text-decoration:none;">${esc(
                s.headline
              )}</a>
            </div>
            <div style="font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.55;color:#222;">
              ${esc(s.summary)}
            </div>
            <div style="font-family:Georgia,'Times New Roman',serif;font-size:13px;line-height:1.4;color:#444;margin-top:8px;font-style:italic;">
              Why it matters: ${esc(s.why_it_matters)}
            </div>
            ${more}
          </td>
        </tr>`;
    })
    .join('');

  const wire = payload.the_wire
    .map(
      (w) => `
      <tr>
        <td style="padding:6px 0;border-bottom:1px dotted #999;font-family:Georgia,'Times New Roman',serif;font-size:13px;line-height:1.4;">
          <a href="${esc(w.source_url)}" style="color:#111;text-decoration:none;">${esc(
            w.blurb
          )}</a>
        </td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f4f1ea;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ea;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#faf8f3;border:1px solid #222;">
          <tr>
            <td style="padding:20px 24px 8px;text-align:center;border-bottom:3px double #111;">
              <div style="font-family:Georgia,'Times New Roman',serif;font-size:36px;letter-spacing:0.02em;font-weight:700;color:#111;">Fresh Prints</div>
              <div style="font-family:Georgia,'Times New Roman',serif;font-size:12px;color:#333;margin-top:6px;letter-spacing:0.06em;text-transform:uppercase;">
                ${esc(dateLabel)} — Vol. 1, No. ${esc(String(editionNumber))}
              </div>
              <div style="font-family:Georgia,'Times New Roman',serif;font-size:14px;font-style:italic;color:#222;margin-top:10px;">
                ${esc(payload.edition_title)}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 24px 4px;">
              <div style="font-family:Georgia,'Times New Roman',serif;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;border-bottom:1px solid #111;padding-bottom:4px;margin-top:8px;">Top Stories</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${stories}</table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px 24px;">
              <div style="font-family:Georgia,'Times New Roman',serif;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;border-bottom:1px solid #111;padding-bottom:4px;">The Wire</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${wire}</table>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 24px;border-top:1px solid #222;font-family:Georgia,'Times New Roman',serif;font-size:12px;color:#555;text-align:center;">
              Read the web edition:
              <a href="${esc(appUrl)}/edition/${esc(editionDate)}" style="color:#111;">${esc(
                appUrl
              )}/edition/${esc(editionDate)}</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function shortHost(u) {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return u;
  }
}

function formatLongDate(isoDate) {
  // isoDate is YYYY-MM-DD — interpret as UTC noon to avoid TZ shift
  const d = new Date(`${isoDate}T12:00:00Z`);
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export async function sendEditionEmail({ editionDate, editionNumber, payload }) {
  if (!config.resendApiKey) throw new Error('RESEND_API_KEY is not set');
  if (!config.digestEmailFrom) throw new Error('DIGEST_EMAIL_FROM is not set');
  if (!config.digestEmailTo) throw new Error('DIGEST_EMAIL_TO is not set');

  const resend = new Resend(config.resendApiKey);
  const html = renderEditionEmail({
    editionDate,
    editionNumber,
    payload,
    appUrl: config.appUrl,
  });

  const subject = `Fresh Prints — ${formatLongDate(editionDate)}`;
  const { data, error } = await resend.emails.send({
    from: config.digestEmailFrom,
    to: [config.digestEmailTo],
    subject,
    html,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message || JSON.stringify(error)}`);
  }
  return { id: data?.id || null };
}
