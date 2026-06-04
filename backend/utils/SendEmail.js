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
// 		await mailTransporter.sendMail({
// 			from: `"WintreeTech Support" <${process.env.SMTP_USER}>`,
// 			to: email,
// 			subject: "Your Settlement Portal Login OTP",
// 			text: `Your OTP is ${otp}. It expires in 5 minutes.`,
// 			html: `
// <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

// <div style="margin:0;padding:0;background:#eef2ff;font-family:'Poppins',Arial,sans-serif;">
//   <table width="100%" cellspacing="0" cellpadding="0" style="padding:50px 20px;background:linear-gradient(180deg,#eef2ff 0%,#f8fafc 100%);">
//     <tr>
//       <td align="center">

//         <table width="640" cellspacing="0" cellpadding="0" style="max-width:640px;width:100%;background:#ffffff;border-radius:32px;overflow:hidden;box-shadow:0 25px 80px rgba(79,70,229,0.12);">

//           <!-- Header -->
//           <tr>
//             <td style="background:linear-gradient(135deg,#1d4ed8 0%,#4338ca 50%,#7c3aed 100%);padding:22px 45px;text-align:right;">
//               <span style="font-size:12px;font-weight:600;letter-spacing:.14em;color:rgba(255,255,255,.78);text-transform:uppercase;">
//                 Secure Verification
//               </span>
//             </td>
//           </tr>

//           <!-- Hero -->
//           <tr>
//             <td style="background:linear-gradient(135deg,#1d4ed8 0%,#4338ca 50%,#7c3aed 100%);padding:20px 55px 70px;text-align:center;">

//               <img src="https://wintreetech.com/wp-content/uploads/2025/06/logo-wintreetech-white-1-1.png"
//                    alt="WintreeTech"
//                    style="max-width:150px;margin-bottom:40px;" />

//               <div style="width:110px;height:110px;margin:0 auto 28px;
//                           background:rgba(255,255,255,0.14);
//                           border:1px solid rgba(255,255,255,0.22);
//                           border-radius:30px;
//                           line-height:110px;
//                           backdrop-filter:blur(12px);">
//                 <span style="font-size:50px;">🔐</span>
//               </div>

//               <div style="font-size:13px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.75);margin-bottom:16px;">
//                 Login Authentication
//               </div>

//               <h1 style="margin:0;font-size:44px;line-height:52px;font-weight:800;color:#fff;">
//                 Verify Access
//               </h1>

//               <p style="max-width:470px;margin:22px auto 0;font-size:17px;line-height:30px;color:rgba(255,255,255,.84);">
//                 Use the one-time verification code below to securely access your Settlement Portal account.
//               </p>

//             </td>
//           </tr>

//           <!-- Main -->
//           <tr>
//             <td style="padding:65px 55px;background:#ffffff;text-align:center;">

//               <div style="display:inline-block;background:#ecfeff;color:#0891b2;
//                           font-size:12px;font-weight:700;
//                           padding:8px 18px;border-radius:999px;
//                           letter-spacing:.08em;text-transform:uppercase;
//                           margin-bottom:24px;">
//                 Security Code
//               </div>

//               <h2 style="margin:0 0 18px;font-size:28px;font-weight:700;color:#111827;">
//                 Your OTP
//               </h2>

//               <!-- Premium OTP Box -->
//               <div style="
//                   margin:0 auto 30px;
//                   max-width:420px;
//                   background:linear-gradient(135deg,#f8fafc 0%,#eef2ff 100%);
//                   border:1px solid #dbeafe;
//                   border-radius:26px;
//                   padding:28px 24px;
//                   box-shadow:0 15px 35px rgba(37,99,235,0.08);
//               ">
//                 <div style="
//                     font-size:52px;
//                     font-weight:800;
//                     letter-spacing:16px;
//                     color:#1d4ed8;
//                     text-align:center;
//                 ">
//                   ${otp}
//                 </div>
//               </div>

//               <p style="margin:0 0 28px;font-size:16px;line-height:28px;color:#4b5563;">
//                 This code will expire in
//                 <strong style="color:#111827;">5 minutes</strong>
//               </p>

//               <!-- Security Alert Card -->
//               <table width="100%" cellspacing="0" cellpadding="0"
//                      style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:22px;">
//                 <tr>
//                   <td style="padding:28px;text-align:left;">

//                     <p style="margin:0 0 12px;font-size:16px;font-weight:700;color:#111827;">
//                       Didn’t request this login?
//                     </p>

//                     <p style="margin:0;font-size:14px;line-height:26px;color:#6b7280;">
//                       You can safely ignore this email. Your account remains protected and no changes have been made.
//                     </p>

//                   </td>
//                 </tr>
//               </table>

//             </td>
//           </tr>

//           <!-- Footer -->
//           <tr>
//             <td style="padding:38px 55px;background:#f8fafc;border-top:1px solid #e5e7eb;text-align:center;">

//               <p style="margin:0 0 14px;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8;">
//                 WintreeTech Security Center
//               </p>

//               <p style="margin:0 0 16px;font-size:14px;line-height:24px;color:#64748b;">
//                 Need assistance? Contact our support team anytime.
//               </p>

//               <p style="margin:0;font-size:12px;line-height:22px;color:#94a3b8;">
//                 © 2026 WintreeTech. All rights reserved.<br>
//                 support@wintreetech.com
//               </p>

//             </td>
//           </tr>

//         </table>

//       </td>
//     </tr>
//   </table>
// </div>
// 			`,
// 		});
// 	} catch (error) {
// 		throw new ApiError(502, "OTP generated but email delivery failed");
// 	}
// };

export const sendOtpEmail = async (email, otp) => {
	try {
		const digits = String(otp)
			.split("")
			.map(
				(d) => `
				<td style="padding: 0 4px;">
					<div style="
						width: 52px;
						height: 68px;
						background: #f5f3ff;
						border: 1.5px solid #c4b5fd;
						border-radius: 14px;
						text-align: center;
						line-height: 68px;
						font-size: 32px;
						font-weight: 700;
						color: #4338ca;
						font-family: 'Inter', Arial, sans-serif;
						letter-spacing: 0;
					">${d}</div>
				</td>`,
			)
			.join("");

		await mailTransporter.sendMail({
			from: `"WintreeTech Support" <${process.env.SMTP_USER}>`,
			to: email,
			subject: "Your Settlement Portal Login OTP",
			text: `Your OTP is ${otp}. It expires in 5 minutes.`,
			html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <title>Verify your identity – WintreeTech</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f3ff;-webkit-text-size-adjust:100%;mso-line-height-rule:exactly;">

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
         style="background-color:#f5f3ff;">
    <tr>
      <td align="center" style="padding: 48px 16px;">

        <!--[if mso]>
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0"><tr><td>
        <![endif]-->

        <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0"
               style="max-width:560px;width:100%;background:#ffffff;border-radius:24px;overflow:hidden;border:1px solid #ede9fe;">

          <!-- ═══════════════════════════════════════════
               HEADER BAND
          ═══════════════════════════════════════════ -->
          <tr>
            <td style="background-color:#4338ca;padding:16px 32px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <!-- Logo / brand -->
                  <td style="vertical-align:middle;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="
                          width:32px;height:32px;
                          background:rgba(255,255,255,0.15);
                          border-radius:8px;
                          text-align:center;
                          vertical-align:middle;
                        ">
                          <span style="font-size:17px;line-height:32px;display:block;">🔒</span>
                        </td>
                        <td style="padding-left:10px;">
                          <span style="
                            font-family:'Inter',Arial,sans-serif;
                            font-size:13px;
                            font-weight:600;
                            color:rgba(255,255,255,0.92);
                            letter-spacing:0.04em;
                          ">WintreeTech</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <!-- Tag -->
                  <td align="right" style="vertical-align:middle;">
                    <span style="
                      font-family:'Inter',Arial,sans-serif;
                      font-size:11px;
                      font-weight:500;
                      color:rgba(255,255,255,0.55);
                      letter-spacing:0.08em;
                      text-transform:uppercase;
                    ">Secure Verification</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ═══════════════════════════════════════════
               HERO
          ═══════════════════════════════════════════ -->
          <tr>
            <td align="center" style="padding:44px 40px 0;">

              <!-- Lock icon box -->
              <div style="
                width:64px;height:64px;
                background:#eef2ff;
                border-radius:18px;
                margin:0 auto 20px;
                text-align:center;
                line-height:64px;
                font-size:30px;
              ">🔐</div>

              <h1 style="
                font-family:'Inter',Arial,sans-serif;
                font-size:22px;
                font-weight:700;
                color:#111827;
                margin:0 0 10px;
                letter-spacing:-0.02em;
              ">Verify your identity</h1>

              <p style="
                font-family:'Inter',Arial,sans-serif;
                font-size:14px;
                color:#6b7280;
                line-height:1.7;
                margin:0 auto;
                max-width:340px;
              ">
                Use this one-time code to access your<br>
                Settlement Portal. It expires in <strong style="color:#111827;">5 minutes</strong>.
              </p>

            </td>
          </tr>

          <!-- ═══════════════════════════════════════════
               OTP SECTION
          ═══════════════════════════════════════════ -->
          <tr>
            <td align="center" style="padding:32px 40px 8px;">

              <!-- Label -->
              <p style="
                font-family:'Inter',Arial,sans-serif;
                font-size:11px;
                font-weight:600;
                letter-spacing:0.08em;
                text-transform:uppercase;
                color:#9ca3af;
                margin:0 0 16px;
              ">Your Login Code</p>

              <!-- Digit tiles -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0"
                     style="margin:0 auto;">
                <tr>
                  ${digits}
                </tr>
              </table>

            </td>
          </tr>

          <!-- Expiry note -->
          <tr>
            <td align="center" style="padding:16px 40px 28px;">
              <p style="
                font-family:'Inter',Arial,sans-serif;
                font-size:13px;
                color:#9ca3af;
                margin:0;
              ">Valid for a single use · expires in 5 minutes</p>
            </td>
          </tr>

          <!-- ═══════════════════════════════════════════
               DIVIDER
          ═══════════════════════════════════════════ -->
          <tr>
            <td style="padding:0 40px;">
              <div style="height:1px;background:#f3f4f6;"></div>
            </td>
          </tr>

          <!-- ═══════════════════════════════════════════
               SECURITY NOTE
          ═══════════════════════════════════════════ -->
          <tr>
            <td style="padding:24px 40px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <!-- Icon -->
                  <td style="width:36px;vertical-align:top;padding-top:1px;">
                    <div style="
                      width:32px;height:32px;
                      background:#f9fafb;
                      border:1px solid #f3f4f6;
                      border-radius:8px;
                      text-align:center;
                      line-height:32px;
                      font-size:15px;
                    ">ℹ️</div>
                  </td>
                  <!-- Text -->
                  <td style="padding-left:14px;vertical-align:top;">
                    <p style="
                      font-family:'Inter',Arial,sans-serif;
                      font-size:13px;
                      font-weight:600;
                      color:#111827;
                      margin:0 0 4px;
                    ">Didn't request this?</p>
                    <p style="
                      font-family:'Inter',Arial,sans-serif;
                      font-size:13px;
                      color:#6b7280;
                      margin:0;
                      line-height:1.6;
                    ">You can safely ignore this email. No changes have been made to your account.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ═══════════════════════════════════════════
               FOOTER
          ═══════════════════════════════════════════ -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #f3f4f6;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="
                    font-family:'Inter',Arial,sans-serif;
                    font-size:12px;
                    color:#9ca3af;
                    vertical-align:middle;
                  ">© 2026 WintreeTech</td>
                  <td align="right" style="vertical-align:middle;">
                    <a href="https://wintreetech.com/help" style="font-family:'Inter',Arial,sans-serif;font-size:12px;color:#9ca3af;text-decoration:none;margin-left:16px;">Help</a>
                    <a href="https://wintreetech.com/privacy" style="font-family:'Inter',Arial,sans-serif;font-size:12px;color:#9ca3af;text-decoration:none;margin-left:16px;">Privacy</a>
                    <a href="mailto:support@wintreetech.com" style="font-family:'Inter',Arial,sans-serif;font-size:12px;color:#9ca3af;text-decoration:none;margin-left:16px;">Contact</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>

        <!--[if mso]>
        </td></tr></table>
        <![endif]-->

        <!-- Sub-footer -->
        <p style="
          font-family:'Inter',Arial,sans-serif;
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
