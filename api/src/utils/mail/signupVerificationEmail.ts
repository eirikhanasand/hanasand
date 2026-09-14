export function signupVerificationEmail(code: string) {
    if (!/^\d{6}$/.test(code)) throw new Error('Verification email requires a six-digit code')
    return {
        subject: 'Verify your Hanasand email',
        textBody: `Hanasand\n\nVerify your email\n\nEnter this code to finish creating your account:\n\n${code}\n\nExpires in 10 minutes.\n\nIf you didn't request this, you can ignore this email.\n\nhanasand.com`,
        htmlBody: `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Verify your Hanasand email</title></head>
<body style="margin:0;padding:0;background-color:#f5f7fb;color:#19212f;font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Your verification code expires in 10 minutes.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f5f7fb;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;">
<tr><td style="padding:0 0 24px;">
<table role="presentation" cellspacing="0" cellpadding="0"><tr>
<td width="56" style="vertical-align:middle;"><img src="https://hanasand.com/hanasand-logo-transparent.png" width="48" height="48" alt="" style="display:block;border:0;background-color:#ffffff;border-radius:50%;"></td>
<td style="vertical-align:middle;font-size:23px;font-weight:700;color:#19212f;">Hanasand</td>
</tr></table>
</td></tr>
<tr><td style="background-color:#ffffff;border:1px solid #dce3f0;border-top:4px solid #3153db;border-radius:12px;padding:32px 24px;">
<h1 style="margin:0 0 16px;font-size:26px;line-height:34px;font-weight:700;color:#19212f;">Verify your email</h1>
<p style="margin:0 0 24px;font-size:16px;line-height:25px;color:#526071;">Enter this code to finish creating your account.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
<td align="center" style="padding:22px 8px;background-color:#f0f4ff;border:1px solid #dce4fc;border-radius:8px;font-family:'Courier New',monospace;font-size:34px;line-height:42px;font-weight:700;letter-spacing:6px;color:#2547c5;">${code}</td>
</tr></table>
<p style="margin:14px 0 28px;font-size:14px;line-height:22px;color:#526071;text-align:center;">Expires in 10 minutes.</p>
<p style="margin:0;padding-top:24px;border-top:1px solid #e7ebf2;font-size:14px;line-height:22px;color:#526071;">If you didn't request this, you can ignore this email.</p>
</td></tr>
<tr><td align="center" style="padding:24px 0;font-size:13px;line-height:20px;"><a href="https://hanasand.com" style="color:#526071;text-decoration:none;">hanasand.com</a></td></tr>
</table>
</td></tr></table>
</body></html>`
    }
}
