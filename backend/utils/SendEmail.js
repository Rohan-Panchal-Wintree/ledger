import nodemailer from "nodemailer";
import "dotenv/config";

export const mailTransporter = nodemailer.createTransport({
	host: process.env.SMTP_HOST,
	port: Number(process.env.SMTP_PORT),
	secure: true,
	auth: {
		user: process.env.SMTP_USER,
		pass: process.env.SMTP_PASS,
	},
	tls: {
		rejectUnauthorized: false,
	},
});

// export const sendOtpEmail = async (email, otp) => {
// 	try {
// 		const otpCode = String(otp);

// 		const digits = otpCode
// 			.split("")
// 			.map(
// 				(d) => `
//           <td style="padding: 0 4px;">
//             <div style="
//               width: 52px;
//               height: 68px;
//               background: #f5f3ff;
//               border: 1.5px solid #c4b5fd;
//               border-radius: 14px;
//               text-align: center;
//               line-height: 68px;
//               font-size: 32px;
//               font-weight: 700;
//               color: #4338ca;
//               font-family: 'Poppins', Arial, sans-serif;
//               letter-spacing: 0;
//             ">${d}</div>
//           </td>`,
// 			)
// 			.join("");

// 		await mailTransporter.sendMail({
// 			from: `"WintreeTech Support" <${process.env.SMTP_USER}>`,
// 			to: email,
// 			subject: "Your Settlement Portal Login OTP",
// 			text: `Your OTP is ${otpCode}. It expires in 5 minutes.`,
// 			html: `<!DOCTYPE html>
// <html lang="en">
// <head>
//   <meta charset="UTF-8" />
//   <meta name="viewport" content="width=device-width, initial-scale=1.0" />
//   <meta http-equiv="X-UA-Compatible" content="IE=edge" />
//   <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
//   <title>Verify your identity – WintreeTech</title>
// </head>

// <body style="margin:0;padding:0;background-color:#f5f3ff;-webkit-text-size-adjust:100%;mso-line-height-rule:exactly;">

//   <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f5f3ff;">
//     <tr>
//       <td align="center" style="padding:48px 16px;">

//         <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0"
//           style="max-width:560px;width:100%;background:#ffffff;border-radius:24px;overflow:hidden;border:1px solid #ede9fe;box-shadow:0 20px 45px rgba(67,56,202,0.12);">

//           <tr>
//             <td style="background-color:#4338ca;padding:16px 32px;">
//               <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
//                 <tr>
//                   <td style="vertical-align:middle;">
//                     <table role="presentation" cellspacing="0" cellpadding="0" border="0">
//                       <tr>
//                         <td style="
//                           width:32px;
//                           height:32px;
//                           background:rgba(255,255,255,0.15);
//                           border-radius:8px;
//                           text-align:center;
//                           vertical-align:middle;
//                         ">
//                           <span style="font-size:17px;line-height:32px;display:block;">🔒</span>
//                         </td>
//                         <td style="padding-left:10px;">
//                           <span style="
//                             font-family:'Poppins',Arial,sans-serif;
//                             font-size:13px;
//                             font-weight:600;
//                             color:rgba(255,255,255,0.92);
//                             letter-spacing:0.04em;
//                           ">WintreeTech</span>
//                         </td>
//                       </tr>
//                     </table>
//                   </td>

//                   <td align="right" style="vertical-align:middle;">
//                     <span style="
//                       font-family:'Poppins',Arial,sans-serif;
//                       font-size:11px;
//                       font-weight:500;
//                       color:rgba(255,255,255,0.65);
//                       letter-spacing:0.08em;
//                       text-transform:uppercase;
//                     ">Secure Verification</span>
//                   </td>
//                 </tr>
//               </table>
//             </td>
//           </tr>

//           <tr>
//             <td align="center" style="padding:44px 40px 0;">
//               <div style="
//                 width:64px;
//                 height:64px;
//                 background:#eef2ff;
//                 border-radius:18px;
//                 margin:0 auto 20px;
//                 text-align:center;
//                 line-height:64px;
//                 font-size:30px;
//               ">🔐</div>

//               <h1 style="
//                 font-family:'Poppins',Arial,sans-serif;
//                 font-size:22px;
//                 font-weight:700;
//                 color:#111827;
//                 margin:0 0 10px;
//                 letter-spacing:-0.02em;
//               ">Verify your identity</h1>

//               <p style="
//                 font-family:'Poppins',Arial,sans-serif;
//                 font-size:14px;
//                 color:#6b7280;
//                 line-height:1.7;
//                 margin:0 auto;
//                 max-width:360px;
//               ">
//                 Use this one-time code to access your Settlement Portal.
//                 It expires in <strong style="color:#111827;">5 minutes</strong>.
//               </p>
//             </td>
//           </tr>

//           <tr>
//             <td align="center" style="padding:32px 40px 8px;">
//               <p style="
//                 font-family:'Poppins',Arial,sans-serif;
//                 font-size:11px;
//                 font-weight:600;
//                 letter-spacing:0.08em;
//                 text-transform:uppercase;
//                 color:#9ca3af;
//                 margin:0 0 16px;
//               ">Your Login Code</p>

//               <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;">
//                 <tr>
//                   ${digits}
//                 </tr>
//               </table>

//             </td>
//           </tr>

//           <tr>
//             <td align="center" style="padding:16px 40px 28px;">
//               <p style="
//                 font-family:'Poppins',Arial,sans-serif;
//                 font-size:13px;
//                 color:#9ca3af;
//                 margin:0;
//               ">Valid for a single use · expires in 5 minutes</p>
//             </td>
//           </tr>

//           <tr>
//             <td style="padding:0 40px;">
//               <div style="height:1px;background:#f3f4f6;"></div>
//             </td>
//           </tr>

//           <tr>
//             <td style="padding:24px 40px;">
//               <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
//                 <tr>
//                   <td style="width:36px;vertical-align:top;padding-top:1px;">
//                     <div style="
//                       width:32px;
//                       height:32px;
//                       background:#f9fafb;
//                       border:1px solid #f3f4f6;
//                       border-radius:8px;
//                       text-align:center;
//                       line-height:32px;
//                       font-size:15px;
//                     ">ℹ️</div>
//                   </td>

//                   <td style="padding-left:14px;vertical-align:top;">
//                     <p style="
//                       font-family:'Poppins',Arial,sans-serif;
//                       font-size:13px;
//                       font-weight:600;
//                       color:#111827;
//                       margin:0 0 4px;
//                     ">Didn't request this?</p>

//                     <p style="
//                       font-family:'Poppins',Arial,sans-serif;
//                       font-size:13px;
//                       color:#6b7280;
//                       margin:0;
//                       line-height:1.6;
//                     ">
//                       You can safely ignore this email. No changes have been made to your account.
//                     </p>
//                   </td>
//                 </tr>
//               </table>
//             </td>
//           </tr>

//           <tr>
//             <td style="padding:20px 40px;border-top:1px solid #f3f4f6;">
//               <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
//                 <tr>
//                   <td style="
//                     font-family:'Poppins',Arial,sans-serif;
//                     font-size:12px;
//                     color:#9ca3af;
//                     vertical-align:middle;
//                   ">© 2026 WintreeTech</td>

//                   <td align="right" style="vertical-align:middle;">
//                     <a href="https://wintreetech.com/help" style="font-family:'Poppins',Arial,sans-serif;font-size:12px;color:#9ca3af;text-decoration:none;margin-left:16px;">Help</a>
//                     <a href="https://wintreetech.com/privacy" style="font-family:'Poppins',Arial,sans-serif;font-size:12px;color:#9ca3af;text-decoration:none;margin-left:16px;">Privacy</a>
//                     <a href="mailto:support@wintreetech.com" style="font-family:'Poppins',Arial,sans-serif;font-size:12px;color:#9ca3af;text-decoration:none;margin-left:16px;">Contact</a>
//                   </td>
//                 </tr>
//               </table>
//             </td>
//           </tr>

//         </table>

//         <p style="
//           font-family:'Poppins',Arial,sans-serif;
//           font-size:12px;
//           color:#a78bfa;
//           margin:20px 0 0;
//           text-align:center;
//         ">
//           This is an automated message from WintreeTech · support@wintreetech.com
//         </p>

//       </td>
//     </tr>
//   </table>

// </body>
// </html>`,
// 		});
// 	} catch (error) {
// 		throw new ApiError(502, "OTP generated but email delivery failed");
// 	}
// };

// export const sendOtpEmail = async (email, otp) => {
// 	try {
// 		await mailTransporter.sendMail({
// 			from: `"WintreeTech Support" <${process.env.SMTP_USER}>`,
// 			to: email,
// 			subject: "Your settlement portal login OTP",
// 			text: `Your OTP is ${otp}. It expires in 5 minutes.`,
// 			html: `<p>Your OTP is <strong>${otp}</strong>.</p><p>It expires in 5 minutes.</p>`,
// 		});
// 	} catch (error) {
// 		throw new ApiError(502, "OTP generated but email delivery failed");
// 	}
// };

export const sendOtpEmail = async (email, otp) => {
	try {
		if (!email) {
			throw new ApiError(400, "Email is required");
		}

		const otpCode = String(otp).trim();

		if (!/^\d{4,8}$/.test(otpCode)) {
			throw new ApiError(400, "Invalid OTP format");
		}

		const escapeHtml = (value) =>
			String(value)
				.replace(/&/g, "&amp;")
				.replace(/</g, "&lt;")
				.replace(/>/g, "&gt;")
				.replace(/"/g, "&quot;")
				.replace(/'/g, "&#039;");

		const safeOtpCode = escapeHtml(otpCode);

		const digits = safeOtpCode
			.split("")
			.map(
				(digit) => `
          <td style="padding:0 4px;">
            <div style="
              width:48px;
              height:64px;
              background:#f5f3ff;
              border:1px solid #c4b5fd;
              border-radius:14px;
              text-align:center;
              line-height:64px;
              font-size:30px;
              font-weight:700;
              color:#4338ca;
              font-family:Arial,Helvetica,sans-serif;
            ">${digit}</div>
          </td>`,
			)
			.join("");

		await mailTransporter.sendMail({
			from: `"WintreeTech Support" <${process.env.SMTP_USER}>`,
			to: email,
			subject: "Your Settlement Portal Login OTP",
			text: `Your OTP is ${otpCode}. It expires in 5 minutes. Do not share this code with anyone.`,
			html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Your Login OTP - WintreeTech</title>
</head>

<body style="margin:0;padding:0;background-color:#f5f3ff;-webkit-text-size-adjust:100%;">

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f5f3ff;">
    <tr>
      <td align="center" style="padding:40px 16px;">

        <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0"
          style="max-width:560px;width:100%;background:#ffffff;border-radius:24px;overflow:hidden;border:1px solid #ede9fe;box-shadow:0 20px 45px rgba(67,56,202,0.12);">

          <tr>
            <td style="background-color:#4338ca;padding:18px 32px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:#ffffff;">
                    🔒 WintreeTech
                  </td>
                  <td align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:600;color:rgba(255,255,255,0.72);letter-spacing:0.08em;text-transform:uppercase;">
                    Secure Verification
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:42px 32px 0;">
              <div style="
                width:64px;
                height:64px;
                background:#eef2ff;
                border-radius:18px;
                margin:0 auto 20px;
                text-align:center;
                line-height:64px;
                font-size:30px;
              ">🔐</div>

              <h1 style="
                font-family:Arial,Helvetica,sans-serif;
                font-size:24px;
                font-weight:700;
                color:#111827;
                margin:0 0 10px;
              ">Verify your identity</h1>

              <p style="
                font-family:Arial,Helvetica,sans-serif;
                font-size:14px;
                color:#6b7280;
                line-height:1.7;
                margin:0 auto;
                max-width:380px;
              ">
                Use this one-time code to access your Settlement Portal.
                This code expires in <strong style="color:#111827;">5 minutes</strong>.
              </p>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:32px 24px 8px;">
              <p style="
                font-family:Arial,Helvetica,sans-serif;
                font-size:11px;
                font-weight:700;
                letter-spacing:0.08em;
                text-transform:uppercase;
                color:#9ca3af;
                margin:0 0 16px;
              ">Your Login Code</p>

              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 18px;">
                <tr>
                  ${digits}
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:16px 32px 28px;">
              <p style="
                font-family:Arial,Helvetica,sans-serif;
                font-size:13px;
                color:#9ca3af;
                margin:0;
              ">Valid for single use · expires in 5 minutes</p>
            </td>
          </tr>

          <tr>
            <td style="padding:0 40px;">
              <div style="height:1px;background:#f3f4f6;"></div>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 40px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="width:36px;vertical-align:top;padding-top:1px;">
                    <div style="
                      width:32px;
                      height:32px;
                      background:#f9fafb;
                      border:1px solid #f3f4f6;
                      border-radius:8px;
                      text-align:center;
                      line-height:32px;
                      font-size:15px;
                    ">ℹ️</div>
                  </td>

                  <td style="padding-left:14px;vertical-align:top;">
                    <p style="
                      font-family:Arial,Helvetica,sans-serif;
                      font-size:13px;
                      font-weight:700;
                      color:#111827;
                      margin:0 0 4px;
                    ">Didn't request this?</p>

                    <p style="
                      font-family:Arial,Helvetica,sans-serif;
                      font-size:13px;
                      color:#6b7280;
                      margin:0;
                      line-height:1.6;
                    ">
                      You can safely ignore this email. No changes have been made to your account.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 32px;border-top:1px solid #f3f4f6;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="
                    font-family:Arial,Helvetica,sans-serif;
                    font-size:12px;
                    color:#9ca3af;
                    vertical-align:middle;
                  ">© 2026 WintreeTech</td>

                  <td align="right" style="vertical-align:middle;">
                    <a href="https://wintreetech.com/help" style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9ca3af;text-decoration:none;margin-left:14px;">Help</a>
                    <a href="https://wintreetech.com/privacy" style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9ca3af;text-decoration:none;margin-left:14px;">Privacy</a>
                    <a href="mailto:support@wintreetech.com" style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9ca3af;text-decoration:none;margin-left:14px;">Contact</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>

        <p style="
          font-family:Arial,Helvetica,sans-serif;
          font-size:12px;
          color:#a78bfa;
          margin:20px 0 0;
          text-align:center;
        ">
          This is an automated message from WintreeTech · support@wintreetech.com
        </p>

      </td>
    </tr>
  </table>

</body>
</html>`,
		});
	} catch (error) {
		throw new ApiError(502, "OTP generated but email delivery failed");
	}
};
