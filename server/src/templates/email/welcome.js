import { emailLayout } from './layout.js';

/**
 * @param {{ name: string }} params
 * @returns {{ subject: string, html: string, text: string }}
 */
export function welcomeTemplate({ name }) {
  const text = `Hi ${name}, welcome to Encore. Your account is ready — start browsing live shows and book seats in real time.`;
  const bodyHtml = `<p style="color:#F5F1EA;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;">${text}</p>`;

  return {
    subject: 'Welcome to Encore',
    html: emailLayout({ title: 'Welcome to Encore', bodyHtml }),
    text,
  };
}
